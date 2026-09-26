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
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(()=>{throw new Error('PROVIDER_FORBIDDEN');})}));

let values:Map<string,string>;

async function installStaff(){
  const {createMfkAdminConfigEnvelope}=await import('../../../contracts/admin-config-sync-v1.ts');
  const {projectStaffForRuntime}=await import('../../../contracts/staff-auth-v1.ts');
  const {applyAdminConfigEnvelope}=await import('./admin-config-sync.ts');
  const staffAuth=await projectStaffForRuntime([{
    id:'staff-d11',name:'堂食店員',role:'STAFF',pin:'2468',scope:'STORE',adminLogin:false,active:true,
    permissions:['ORDER_REVIEW','ORDER_CORRECTION'],
  }]);
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:11,
    publishedAt:'2026-09-26T10:00:00.000Z',
    adminFingerprint:'fnv1a32:d11',
    snapshot:{catalog:{categories:[],products:[],combos:[],comboPools:[]},staffAuth},
  }));
  const auth=await import('./staff-auth.ts');
  expect((await auth.loginStaff('staff-d11','2468')).ok).toBe(true);
}

async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('D11 Dining formal lifecycle and safe Orders handoff',()=>{
  it('keeps active unpaid Dining out of the general Orders board but allows exact deep-link after payment',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    const orderId=before.formalOrderId;

    expect((await runtime.readOrders()).items.some((row:any)=>row.orderId===orderId)).toBe(false);

    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'d11-partial',expectedRevision:before.checkoutRevision},
    );

    expect((await runtime.readOrders()).items.some((row:any)=>row.orderId===orderId)).toBe(false);
    const deep=await runtime.readOrders(orderId);
    expect(deep.selectedOrderId).toBe(orderId);
    expect(deep.selectedOrder).toMatchObject({
      orderId,
      diningHoldId:hold.id,
      recognizedSalesMinor:4100,
      outstandingMinor:4100,
      fulfillmentLabel:'進行中',
    });
  });

  it('fully paid Dining completes the SAME Formal Order and becomes visible in Order history projection',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T02');
    const before=await runtime.readDiningHold(hold.id);
    const orderId=before.formalOrderId;

    const settled=await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'PAYME',
      {submissionId:'d11-full',expectedRevision:before.checkoutRevision},
    );

    expect(settled.archivedAt).toBeTruthy();
    expect(settled.remainingMinor).toBe(0);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0]).toMatchObject({
      id:orderId,
      fulfillmentLabel:'已完成',
      recognizedSalesMinor:4100,
      outstandingMinor:0,
    });

    const projection=await runtime.readOrders();
    expect(projection.items.find((row:any)=>row.orderId===orderId)).toMatchObject({
      fulfillmentLabel:'已完成',
      paymentLabel:'PAYME',
    });
  });

  it('cancelled unpaid Dining becomes visible as history without creating money',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T03');
    const detail=await runtime.readDiningHold(hold.id);
    await runtime.cancelOrder(detail.formalOrderId,'客人取消');

    const order=runtime.orders()[0];
    expect(order).toMatchObject({
      fulfillmentLabel:'已取消',
      recognizedSalesMinor:0,
      outstandingMinor:0,
    });
    expect((await runtime.readOrders()).items.find((row:any)=>row.orderId===order.id)?.fulfillmentLabel).toBe('已取消');
  });

  it('fails closed on generic active-Dining mutations while keeping cancellation separate',async()=>{
    await installStaff();
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T04');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'d11-guard',expectedRevision:before.checkoutRevision},
    );
    const orderId=(await runtime.readDiningHold(hold.id)).formalOrderId;

    await expect(runtime.markOrderReady(orderId)).rejects.toThrow('DINING_FULFILLMENT_MANAGED_BY_DINING');
    await expect(runtime.updateOrderItems(orderId,[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}]))
      .rejects.toThrow('DINING_ITEMS_MANAGED_BY_DINING');
    await expect(runtime.correctOrderPayment(orderId,'CASH'))
      .rejects.toThrow('DINING_PAYMENT_CORRECTION_REQUIRES_PAYMENT_ENTRY');
    await expect(runtime.refundOrder(orderId,{lineId:'riceball',quantity:1,amountMinor:4100,method:'FPS'}))
      .rejects.toThrow('DINING_REFUND_REQUIRES_CLOSED_CHECK');

    await runtime.cancelOrder(orderId,'部分付款後取消');
    expect(runtime.orders()[0]).toMatchObject({
      fulfillmentLabel:'已取消',
      recognizedSalesMinor:4100,
      outstandingMinor:0,
    });
    expect(runtime.orders()[0].refunds??[]).toHaveLength(0);
  });

  it('after cancellation, Dining refund cannot exceed the actually paid quantity or confirmed money',async()=>{
    await installStaff();
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T05');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'d11-refund',expectedRevision:before.checkoutRevision},
    );
    const orderId=(await runtime.readDiningHold(hold.id)).formalOrderId;
    await runtime.cancelOrder(orderId,'取消並處理退款');

    const refunded=await runtime.refundOrder(orderId,{
      lineId:'riceball',quantity:1,amountMinor:4100,method:'FPS',note:'退回已付款部分',
    });
    expect(refunded.refunds).toHaveLength(1);
    expect(refunded.refunds?.[0]).toMatchObject({amountMinor:4100,method:'FPS'});

    await expect(runtime.refundOrder(orderId,{
      lineId:'riceball',quantity:1,amountMinor:100,method:'FPS',
    })).rejects.toThrow('DINING_REFUND_EXCEEDS_PAID_QUANTITY');
  });

  it('fails closed when duplicate Dining product ids make an item refund reference ambiguous',async()=>{
    await installStaff();
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[
        {id:'riceball',name:'原味飯團｜少飯',qty:1,unitMinor:4100},
        {id:'riceball',name:'原味飯團｜正常飯',qty:1,unitMinor:4100},
      ],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T06');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'d11-ambiguous',expectedRevision:before.checkoutRevision},
    );
    const orderId=(await runtime.readDiningHold(hold.id)).formalOrderId;
    await runtime.cancelOrder(orderId,'取消');

    await expect(runtime.refundOrder(orderId,{
      lineId:'riceball',quantity:1,amountMinor:4100,method:'FPS',
    })).rejects.toThrow('DINING_REFUND_LINE_AMBIGUOUS');
  });
});
