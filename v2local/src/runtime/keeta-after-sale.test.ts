import {beforeEach,describe,expect,it,vi} from 'vitest';
import {localRuntime} from './local-runtime.ts';
import {decideKeetaAfterSale,readKeetaAfterSales,reconcileKeetaAfterSales} from './keeta-after-sale.ts';

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

describe('Keeta after-sale → SMT linked canonical order',()=>{
  beforeEach(()=>{
    installStorage();
    localRuntime.clear();
  });

  it('persists one linked local after-sale case and ACKs provider evidence after linkage',async()=>{
    const order=localRuntime.createOrder({
      items:[{id:'p1',name:'商品一',qty:1,unitMinor:4200,serviceMode:'takeaway'}],
      totalMinor:4200,paymentLabel:'KEETA',sourceLabel:'Keeta · K998',
      providerRef:'KEETA:998',providerMessageId:'msg-placement-998',initialFulfillmentLabel:'進行中',
    });
    const event={
      schema:'MFK_KEETA_AFTER_SALE_EVENT_V1',storeId:'MF01',provider:'KEETA',
      providerOrderId:'998',afterSaleOrderId:'88001',providerMessageId:'refund-msg-1',
      eventId:1005,providerStatus:2000,refundAmountMinor:2800,currency:'HKD',
      rawMessage:JSON.stringify({applyReason:'Customer requested refund',handleReason:'Pending',isAppeal:0}),
      state:'PENDING_SMT',receivedAt:'2026-09-23T00:00:01.000Z',
    };
    const fetchMock=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url.includes('/after-sales/pending'))return new Response(JSON.stringify({events:[event]}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/after-sales/ack')){
        const body=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
        expect(body.canonicalOrderId).toBe(order.id);
        expect(body.afterSaleOrderId).toBe('88001');
        return new Response(JSON.stringify({state:'ACKED'}),{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('UNEXPECTED_FETCH:'+url);
    });
    vi.stubGlobal('fetch',fetchMock);
    try{
      await reconcileKeetaAfterSales();
      expect(readKeetaAfterSales(order.id)).toEqual([expect.objectContaining({
        afterSaleOrderId:'88001',providerOrderId:'998',canonicalOrderId:order.id,eventId:1005,refundAmountMinor:2800,
      })]);
      expect(localRuntime.orders()[0]?.totalMinor).toBe(4200);
      expect(localRuntime.orders()[0]?.paymentLabel).toBe('KEETA');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }finally{vi.unstubAllGlobals();}
  });

  it('records explicit merchant decision without mutating canonical order money',async()=>{
    const order=localRuntime.createOrder({
      items:[{id:'p1',name:'商品一',qty:1,unitMinor:4200,serviceMode:'takeaway'}],
      totalMinor:4200,paymentLabel:'KEETA',sourceLabel:'Keeta · K998',
      providerRef:'KEETA:998',providerMessageId:'msg-placement-998',initialFulfillmentLabel:'進行中',
    });
    localStorage.setItem('mfk.keeta.after-sale.cases.v1',JSON.stringify([{
      afterSaleOrderId:'88001',providerOrderId:'998',canonicalOrderId:order.id,eventId:1005,
      providerMessageId:'refund-msg-1',providerStatus:2000,refundAmountMinor:2800,currency:'HKD',
      applyReason:'Customer requested refund',handleReason:'Pending',isAppeal:false,
      updatedAt:'2026-09-23T00:00:01.000Z',
    }]));
    const fetchMock=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      expect(url).toContain('/after-sales/decision');
      const body=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
      expect(body.decision).toBe('REJECT');
      expect(body.rejectCode).toBe(100000);
      expect(body.rejectReason).toBe('已開始製作');
      return new Response(JSON.stringify({state:'SUCCESS'}),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);
    try{
      await decideKeetaAfterSale('88001','REJECT',100000,'已開始製作');
      expect(readKeetaAfterSales(order.id)[0]?.decisionState).toBe('REJECTED');
      expect(localRuntime.orders()[0]?.totalMinor).toBe(4200);
      expect(localRuntime.orders()[0]?.paymentLabel).toBe('KEETA');
    }finally{vi.unstubAllGlobals();}
  });
});
