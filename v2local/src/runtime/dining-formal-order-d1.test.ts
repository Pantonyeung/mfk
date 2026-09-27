import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {buildLocalReport} from './local-operations.ts';

vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(()=>{throw new Error('D1_MUST_NOT_PRINT');}),
  printTextLan:vi.fn(()=>{throw new Error('D1_MUST_NOT_PRINT');}),
}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(()=>{throw new Error('PROVIDER_FORBIDDEN');})}));

const KEY='mfk.v2local.runtime.v1';
let values:Map<string,string>;
let failWrite=false;
let writes=0;

const item=(id='rice',qty=2,unitMinor=4100)=>({id,name:id,qty,unitMinor});

async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  values=new Map();
  failWrite=false;
  writes=0;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{
      if(failWrite&&key===KEY)throw new Error('QUOTA_D1_TEST');
      if(key===KEY)writes++;
      values.set(key,String(value));
    },
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D1 Dining Formal Order authority',()=>{
  it('creates exactly one unpaid Formal Order atomically when an ordered Dining Hold is assigned to a table',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item()],totalMinor:8200,partySize:2});
    expect(runtime.orders()).toHaveLength(0);

    const before=writes;
    await runtime.assignDiningTable(hold.id,'T01');

    expect(writes-before).toBe(1);
    expect(runtime.orders()).toHaveLength(1);
    const order=runtime.orders()[0];
    expect(order).toMatchObject({
      totalMinor:8200,
      paymentLabel:'未收款',
      fulfillmentLabel:'進行中',
      diningHoldId:hold.id,
      recognizedSalesMinor:0,
      outstandingMinor:8200,
    });
    expect(order.paymentEntries).toEqual([]);
    expect(order.items.every((row:any)=>row.serviceMode==='dine-in')).toBe(true);

    const detail=await runtime.readDiningHold(hold.id);
    expect(detail.formalOrderId).toBe(order.id);
    expect(detail.formalOrderDisplay).toBe(order.display);
    expect(detail.codeLabel).toBe(order.display);
    expect(detail.remainingMinor).toBe(8200);

    const print=await import('./native-print.ts');
    expect(print.printBytesLan).not.toHaveBeenCalled();
    expect(print.printTextLan).not.toHaveBeenCalled();
  });

  it('replay and restart keep the SAME Formal Order and Display identity',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item('rice',1)],totalMinor:4100,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');
    const first=runtime.orders()[0];
    const writesAfterFirst=writes;

    await runtime.assignDiningTable(hold.id,'T01');
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(first.id);
    expect(runtime.orders()[0].display).toBe(first.display);
    expect(writes).toBe(writesAfterFirst);

    vi.resetModules();
    runtime=await boot();
    await runtime.assignDiningTable(hold.id,'T01');
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(first.id);
    expect(runtime.orders()[0].display).toBe(first.display);
  });

  it('partial Dining payment updates the SAME Formal Order paid/outstanding facts and report projection',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item()],totalMinor:8200,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    const orderId=before.formalOrderId;

    await runtime.settleDiningHold(
      hold.id,
      [{lineIndex:0,qty:1}],
      'CASH',
      {submissionId:'d1-pay-1',expectedRevision:before.checkoutRevision,receivedMinor:5000},
    );

    expect(runtime.orders()).toHaveLength(1);
    const order=runtime.orders()[0];
    expect(order.id).toBe(orderId);
    expect(order.recognizedSalesMinor).toBe(4100);
    expect(order.outstandingMinor).toBe(4100);
    expect(order.paymentEntries).toHaveLength(1);
    expect(order.paymentEntries[0]).toMatchObject({tender:'CASH',amountMinor:4100});

    const report=buildLocalReport(runtime.orders(),{now:Date.now(),businessStartHour:5});
    expect(report.orderValueMinor).toBe(8200);
    expect(report.confirmedPaidMinor).toBe(4100);
    expect(report.outstandingMinor).toBe(4100);
    expect(report.grossSalesMinor).toBe(4100);
    expect(report.cashSalesMinor).toBe(4100);
    expect(report.itemUnits).toBe(1);
  });

  it('adding a second SMM Dining submission to an occupied table updates the SAME Formal Order',async()=>{
    const runtime=await boot();
    const first=runtime.upsertSmmDiningHold({
      providerRef:'smm-1',
      target:{kind:'TABLE',tableId:'T01',covers:2},
      items:[item('rice',1,4100)],
      totalMinor:4100,
      sourceLabel:'SMM',
    });
    expect(first.formalOrderId).toBeTruthy();
    const orderId=first.formalOrderId;

    const second=runtime.upsertSmmDiningHold({
      providerRef:'smm-2',
      target:{kind:'TABLE',tableId:'T01',covers:2},
      items:[item('tea',1,1500)],
      totalMinor:1500,
      sourceLabel:'SMM',
    });

    expect(second.formalOrderId).toBe(orderId);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(orderId);
    expect(runtime.orders()[0].totalMinor).toBe(5600);
    expect(runtime.orders()[0].outstandingMinor).toBe(5600);
    expect(runtime.orders()[0].items).toHaveLength(2);
  });

  it('cancel after partial payment keeps confirmed money until Refund but removes collectible outstanding',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item()],totalMinor:8200,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'d1-pay-fps',expectedRevision:before.checkoutRevision},
    );
    const orderId=runtime.orders()[0].id;

    await runtime.cancelOrder(orderId,'客人取消');

    const order=runtime.orders()[0];
    expect(order.fulfillmentLabel).toBe('已取消');
    expect(order.recognizedSalesMinor).toBe(4100);
    expect(order.outstandingMinor).toBe(0);
    expect((await runtime.readDining()).tables.find((row:any)=>row.id==='T01')?.state).toBe('available');
    const history=await runtime.readDiningHistory();
    expect(history[0].cancelledAt).toBeTruthy();
    expect(history[0].remainingMinor).toBe(0);

    const report=buildLocalReport(runtime.orders(),{now:Date.now(),businessStartHour:5});
    expect(report.confirmedPaidMinor).toBe(4100);
    expect(report.outstandingMinor).toBe(0);
  });

  it('storage failure cannot publish a Formal Order or table assignment in memory',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item('rice',1)],totalMinor:4100,partySize:2});
    const raw=values.get(KEY);
    failWrite=true;
    await expect(runtime.assignDiningTable(hold.id,'T01')).rejects.toThrow('QUOTA_D1_TEST');
    failWrite=false;

    expect(values.get(KEY)).toBe(raw);
    expect(runtime.orders()).toHaveLength(0);
    const detail=await runtime.readDiningHold(hold.id);
    expect(detail.assignedTable).toBeUndefined();
    expect(detail.formalOrderId).toBeUndefined();
  });

  it('paying an ordered waiting Dining Hold creates one Formal Order before recording money',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item('wait',1)],totalMinor:4100,partySize:2});
    const detail=await runtime.readDiningHold(hold.id);
    expect(detail.formalOrderId).toBeUndefined();

    const paid=await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'PAYME',
      {submissionId:'waiting-paid',expectedRevision:detail.checkoutRevision},
    );

    expect(paid.formalOrderId).toBeTruthy();
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].recognizedSalesMinor).toBe(4100);
    expect(runtime.orders()[0].outstandingMinor).toBe(0);
  });
});
