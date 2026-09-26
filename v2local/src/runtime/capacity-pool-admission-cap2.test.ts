import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({
  renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1,2,3])),
}));
vi.mock('./label-bitmap.ts',()=>({
  renderTscRasterLabel:vi.fn(async()=>new Uint8Array([4,5,6])),
}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({ok:true,providerStatus:'ACCEPTED'}))}));

import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {readLocalCapacityPoolRows} from './capacity-pool-state.ts';

let values:Map<string,string>;

function installStorage(){
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
}

function applyCapacity(pools:readonly unknown[],revision=1){
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision,
    publishedAt:'2026-09-27T04:00:0'+revision+'.000Z',
    adminFingerprint:'cap2-'+revision,
    snapshot:{
      catalog:{categories:[],products:[]},
      businessDay:{cutoff:'05:00'},
      capacity:{pools},
    },
  }));
}

const purple={
  id:'CAP01',
  name:'紫米',
  active:true,
  initialQty:5,
  productIds:['riceball','pork'],
  firstPartyStopAt:1,
  thirdPartyStopAt:2,
  note:'',
};

async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T04:00:00.000Z'));
  installStorage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CAP2 formal admission deduction and cancellation restore',()=>{
  it('deducts linked item quantity exactly once when a Formal Order is created',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();

    const order=runtime.createOrder({
      items:[
        {id:'riceball',name:'原味飯團',qty:2,unitMinor:4100},
        {id:'bento',name:'肉燥便當',qty:1,unitMinor:5000},
      ],
      totalMinor:13200,
      paymentLabel:'CASH',
      sourceLabel:'現場',
    });

    expect((order as any).capacityEvents).toHaveLength(1);
    expect((order as any).capacityEvents[0]).toMatchObject({
      kind:'DEDUCT',
      poolId:'CAP01',
      quantity:2,
      admissionId:'ORDER',
      orderId:order.id,
      businessDate:'2026-09-27',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(3);

    vi.resetModules();
    const restarted=await boot();
    expect((await restarted.readCapacityPoolState()).pools[0]?.remainingQty).toBe(3);
    expect((restarted.orders()[0] as any).capacityEvents).toHaveLength(1);
  });

  it('fails closed before Order creation if any required Pool lacks capacity',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:4,unitMinor:4100}],
      totalMinor:16400,paymentLabel:'FPS',sourceLabel:'現場',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(1);

    expect(()=>runtime.createOrder({
      items:[{id:'pork',name:'泡菜豬肉飯團',qty:2,unitMinor:4700}],
      totalMinor:9400,paymentLabel:'FPS',sourceLabel:'現場',
    })).toThrow('CAPACITY_POOL_INSUFFICIENT:CAP01');

    expect(runtime.orders()).toHaveLength(1);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(1);
  });

  it('deducts every intentionally linked Pool for one admitted Product',async()=>{
    applyCapacity([
      purple,
      {...purple,id:'CAP02',name:'飯團包材',initialQty:10,productIds:['riceball'],firstPartyStopAt:0,thirdPartyStopAt:0},
    ]);
    const runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    expect((order as any).capacityEvents.filter((row:any)=>row.kind==='DEDUCT').map((row:any)=>[row.poolId,row.quantity]))
      .toEqual([['CAP01',2],['CAP02',2]]);
    const state=await runtime.readCapacityPoolState();
    expect(state.pools.map((row:any)=>[row.poolId,row.remainingQty])).toEqual([['CAP01',3],['CAP02',8]]);
  });

  it('restores all unrecovered deductions once on formal cancellation and never on replay',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:3,unitMinor:4100}],
      totalMinor:12300,paymentLabel:'FPS',sourceLabel:'現場',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(2);

    await runtime.cancelOrder(order.id,'客人取消');
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);
    const after=runtime.orders().find((row:any)=>row.id===order.id);
    expect(after.capacityEvents.filter((row:any)=>row.kind==='RESTORE')).toHaveLength(1);
    expect(after.capacityEvents.filter((row:any)=>row.kind==='RESTORE')[0]).toMatchObject({
      poolId:'CAP01',quantity:3,orderId:order.id,businessDate:'2026-09-27',
    });

    await runtime.cancelOrder(order.id,'重複取消');
    const replay=runtime.orders().find((row:any)=>row.id===order.id);
    expect(replay.capacityEvents.filter((row:any)=>row.kind==='RESTORE')).toHaveLength(1);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);
  });

  it('deducts Dining initial admission and add-order delta exactly once, then restores both on cancellation',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const admitted=await runtime.readDiningHold(hold.id);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(4);

    const addInput={
      submissionId:'CAP2:ADD:1',
      items:[{id:'pork',name:'泡菜豬肉飯團',qty:2,unitMinor:4700}],
      totalMinor:9400,
      sourceLabel:'現場',
    };
    await runtime.appendDiningItems(hold.id,addInput);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(2);

    await runtime.appendDiningItems(hold.id,addInput);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(2);

    const orderBeforeCancel=runtime.orders().find((row:any)=>row.id===admitted.formalOrderId);
    expect(orderBeforeCancel.capacityEvents.filter((row:any)=>row.kind==='DEDUCT')).toHaveLength(2);
    expect(orderBeforeCancel.capacityEvents.filter((row:any)=>row.kind==='DEDUCT').map((row:any)=>row.quantity)).toEqual([1,2]);

    await runtime.cancelOrder(admitted.formalOrderId,'堂食取消');
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);
    const cancelled=runtime.orders().find((row:any)=>row.id===admitted.formalOrderId);
    expect(cancelled.capacityEvents.filter((row:any)=>row.kind==='RESTORE')).toHaveLength(2);
  });

  it('provider cancellation restores once even if another cancel event is received later',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      paymentLabel:'平台已收款',
      sourceLabel:'Keeta',
      providerRef:'K-CAP2-1',
      initialFulfillmentLabel:'待處理',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(3);

    runtime.applyProviderLifecycle({
      orderId:order.id,eventId:1004,eventName:'取消',providerMessageId:'M1',
      providerPushedAt:'2026-09-27T04:01:00.000Z',rawMessage:'{"cancelReason":"平台取消"}',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);

    runtime.applyProviderLifecycle({
      orderId:order.id,eventId:1008,eventName:'取消確認',providerMessageId:'M2',
      providerPushedAt:'2026-09-27T04:02:00.000Z',rawMessage:'{}',
    });
    const after=runtime.orders().find((row:any)=>row.id===order.id);
    expect(after.capacityEvents.filter((row:any)=>row.kind==='RESTORE')).toHaveLength(1);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);
  });

  it('payment settlement does not restore Capacity and capacity-linked generic item rewrite fails closed',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(4);

    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{
      submissionId:'CAP2:PAY:1',
      expectedRevision:before.checkoutRevision,
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(4);

    const normal=runtime.createOrder({
      items:[{id:'pork',name:'泡菜豬肉飯團',qty:1,unitMinor:4700}],
      totalMinor:4700,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await expect(runtime.updateOrderItems(normal.id,[{id:'pork',name:'泡菜豬肉飯團',qty:2,unitMinor:4700}]))
      .rejects.toThrow('CAPACITY_LINKED_ORDER_EDIT_REQUIRES_CORRECTION');
  });

  it('cross-Business-Day cancellation restores original-day row and does not inflate today Pool',async()=>{
    applyCapacity([purple]);
    vi.setSystemTime(new Date('2026-09-27T20:59:00.000Z')); // 04:59 HKT Sep 28, business day Sep 27
    const runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    expect((await runtime.readCapacityPoolState()).businessDate).toBe('2026-09-27');
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(3);

    vi.setSystemTime(new Date('2026-09-27T21:01:00.000Z')); // 05:01 HKT Sep 28
    expect((await runtime.readCapacityPoolState()).businessDate).toBe('2026-09-28');
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);

    await runtime.cancelOrder(order.id,'跨日取消');
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(5);
    const rows=readLocalCapacityPoolRows();
    expect(rows.find(row=>row.businessDate==='2026-09-27'&&row.poolId==='CAP01')?.remainingQty).toBe(5);
    expect(rows.find(row=>row.businessDate==='2026-09-28'&&row.poolId==='CAP01')?.remainingQty).toBe(5);
  });
});