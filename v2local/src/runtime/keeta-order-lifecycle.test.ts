import {beforeEach,describe,expect,it,vi} from 'vitest';
import {localRuntime} from './local-runtime.ts';
import {reconcileKeetaOrderLifecycle} from './keeta-order-lifecycle.ts';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
}

function makeOrder(){
  return localRuntime.createOrder({
    items:[{id:'p1',name:'商品一',qty:1,unitMinor:4200,serviceMode:'takeaway'}],
    totalMinor:4200,
    paymentLabel:'KEETA',
    sourceLabel:'Keeta · K998',
    providerRef:'KEETA:998',
    providerMessageId:'msg-placement-998',
    initialFulfillmentLabel:'待處理',
  });
}

describe('Keeta lifecycle → SMT linked canonical order',()=>{
  beforeEach(()=>{
    installStorage();
    localRuntime.clear();
  });

  it('applies provider acceptance, delivery evidence and cancellation without creating another order',()=>{
    const order=makeOrder();

    const accepted=localRuntime.applyProviderLifecycle({
      orderId:order.id,eventId:1002,eventName:'ORDER_ACCEPTANCE',providerMessageId:'event-1002',
      providerPushedAt:'2026-09-23T01:00:00.000Z',
      rawMessage:JSON.stringify({orderViewId:998,shopId:721578302,status:30,opTime:1790120000000}),
    });
    expect(accepted.disposition).toBe('APPLIED');
    expect(localRuntime.orders()).toHaveLength(1);
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('進行中');

    const duplicate=localRuntime.applyProviderLifecycle({
      orderId:order.id,eventId:1002,eventName:'ORDER_ACCEPTANCE',providerMessageId:'event-1002',
      providerPushedAt:'2026-09-23T01:00:00.000Z',
      rawMessage:'{}',
    });
    expect(duplicate.disposition).toBe('IDEMPOTENT');

    const delivery=localRuntime.applyProviderLifecycle({
      orderId:order.id,eventId:1006,eventName:'DELIVERY_STATUS_UPDATE',providerMessageId:'event-1006',
      providerPushedAt:'2026-09-23T01:05:00.000Z',
      rawMessage:JSON.stringify({orderViewId:998,shopId:721578302,logisticsStatus:25,opTime:1790120300000}),
    });
    expect(delivery.disposition).toBe('EVIDENCE_ONLY');
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('進行中');

    const cancelled=localRuntime.applyProviderLifecycle({
      orderId:order.id,eventId:1004,eventName:'ORDER_CANCELLATION',providerMessageId:'event-1004',
      providerPushedAt:'2026-09-23T01:10:00.000Z',
      rawMessage:JSON.stringify({orderViewId:998,shopId:721578302,status:50,cancelReason:'客人取消'}),
    });
    expect(cancelled.disposition).toBe('APPLIED');
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('已取消');
    expect(localRuntime.orders()[0]?.cancellationReason).toBe('客人取消');
    expect(localRuntime.orders()).toHaveLength(1);
  });

  it('does not overwrite a completed canonical order with a later provider cancellation conflict',()=>{
    const order=makeOrder();
    localRuntime.applyProviderLifecycle({
      orderId:order.id,eventId:1003,eventName:'ORDER_COMPLETION',providerMessageId:'event-complete',
      providerPushedAt:'2026-09-23T02:00:00.000Z',rawMessage:'{}',
    });
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('已完成');

    const conflict=localRuntime.applyProviderLifecycle({
      orderId:order.id,eventId:1008,eventName:'OBSERVED_SYSTEM_ORDER_CANCELLATION',providerMessageId:'event-cancel',
      providerPushedAt:'2026-09-23T02:05:00.000Z',rawMessage:JSON.stringify({cancelReason:'system cancel'}),
    });
    expect(conflict.disposition).toBe('CONFLICT');
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('已完成');
    expect(localRuntime.orders()[0]?.providerLifecycleNote).toContain('本地訂單已完成');
  });

  it('reconciles a pending verified lifecycle event and ACKs it only after local application',async()=>{
    const order=makeOrder();
    const pending={
      schema:'MFK_KEETA_ORDER_EVENT_V1',storeId:'MF01',provider:'KEETA',providerShopId:721578302,
      providerOrderId:'998',providerMessageId:'event-remote-1004',eventId:1004,eventName:'ORDER_CANCELLATION',
      providerPushedAt:'2026-09-23T03:00:00.000Z',receivedAt:'2026-09-23T03:00:01.000Z',
      fingerprint:'c'.repeat(64),rawMessage:JSON.stringify({orderViewId:998,cancelReason:'provider cancel'}),
      state:'PENDING_SMT',
    };
    const fetchMock=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url.includes('/events/pending'))return new Response(JSON.stringify({events:[pending]}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/events/ack')){
        const body=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
        expect(body.canonicalOrderId).toBe(order.id);
        expect(body.providerMessageId).toBe('event-remote-1004');
        return new Response(JSON.stringify({state:'ACKED'}),{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('UNEXPECTED_FETCH:'+url);
    });
    vi.stubGlobal('fetch',fetchMock);
    try{
      await reconcileKeetaOrderLifecycle();
      expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('已取消');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }finally{vi.unstubAllGlobals();}
  });
});
