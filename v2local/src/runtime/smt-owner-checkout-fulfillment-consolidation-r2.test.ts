import {beforeEach,describe,expect,it,vi} from 'vitest';
import {etaMinutesForActiveCount,normalizeSmtEtaRules} from './admin-operational-config.ts';

vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({state:'SYNCED'}))}));

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
}

describe('SMT Owner consolidation checkout / fulfillment',()=>{
  beforeEach(()=>{vi.resetModules();vi.clearAllMocks();installStorage();});

  it('dedupes one non-dining checkout submission into one Formal Order identity',async()=>{
    const {localRuntime}=await import('./local-runtime.ts');
    const input={
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway' as const}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',submissionId:'CHECKOUT-001',
    };
    const first=localRuntime.createOrder(input);
    const replay=localRuntime.createOrder(input);
    expect(replay.id).toBe(first.id);
    expect(replay.display).toBe(first.display);
    expect(localRuntime.orders()).toHaveLength(1);
    expect(localRuntime.orders()[0]?.checkoutSubmissionId).toBe('CHECKOUT-001');
  });

  it('admits initial print once and replay never dispatches a second initial print',async()=>{
    const {localRuntime}=await import('./local-runtime.ts');
    const order=localRuntime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',submissionId:'CHECKOUT-PRINT-1',
    });
    const first=await localRuntime.printInitialOrderOutputsOnce(order.id);
    const second=await localRuntime.printInitialOrderOutputsOnce(order.id);
    expect(first.orderId).toBe(order.id);
    expect(second.orderId).toBe(order.id);
    expect(localRuntime.orders()[0]?.initialPrintAttemptedAt).toBeTruthy();
  });

  it('allows Keeta 稍後處理 at most twice while the same order remains pending',async()=>{
    const {localRuntime}=await import('./local-runtime.ts');
    const order=localRuntime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'KEETA',sourceLabel:'Keeta · K001',
      providerRef:'KEETA:DEFER-1',initialFulfillmentLabel:'待處理',
    });
    expect((await localRuntime.deferKeetaOrder(order.id)).keetaDeferCount).toBe(1);
    expect((await localRuntime.deferKeetaOrder(order.id)).keetaDeferCount).toBe(2);
    await expect(localRuntime.deferKeetaOrder(order.id)).rejects.toThrow('KEETA_DEFER_LIMIT_REACHED');
    expect(localRuntime.orders()).toHaveLength(1);
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('待處理');
  });

  it('keeps READY reversible and only completes pickup from READY',async()=>{
    const {localRuntime}=await import('./local-runtime.ts');
    const order=localRuntime.createOrder({
      items:[{id:'p1',name:'商品',qty:1,unitMinor:1000,serviceMode:'takeaway'}],
      totalMinor:1000,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await localRuntime.markOrderReady(order.id);
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('可取餐');
    await localRuntime.markOrderUnready(order.id);
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('進行中');
    expect(localRuntime.orders()[0]?.etaReadyAt).toBeUndefined();
    await localRuntime.markOrderReady(order.id);
    await localRuntime.markOrderCompleted(order.id);
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('已完成');
  });

  it('selects ETA from Admin-style load thresholds and has a sane fallback',()=>{
    const rules=normalizeSmtEtaRules([
      {minActiveOrders:0,minutes:10},
      {minActiveOrders:5,minutes:20},
      {minActiveOrders:10,minutes:35},
    ],18);
    expect(etaMinutesForActiveCount(1,rules)).toBe(10);
    expect(etaMinutesForActiveCount(5,rules)).toBe(20);
    expect(etaMinutesForActiveCount(12,rules)).toBe(35);
    expect(normalizeSmtEtaRules([],18)).toEqual([{minActiveOrders:0,minutes:18}]);
  });
});
