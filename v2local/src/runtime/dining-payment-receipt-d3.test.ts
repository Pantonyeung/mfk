import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {buildLocalReport} from './local-operations.ts';

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

const PRINTER_KEY='mfk.v2local.printers.v5';
let values:Map<string,string>;

const receiptBinding={
  id:'receipt',
  routeKey:'logical.receipt',
  name:'receipt',
  model:'LAN',
  role:'顧客小票',
  host:'10.0.0.11',
  port:9100,
  capability:'receipt-80mm/kitchen',
  encoding:'gb18030',
};

async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

async function setup(qty=2){
  const runtime=await boot();
  const hold=runtime.createHold({
    kind:'dining',
    items:[{id:'riceball',name:'原味飯團',qty,unitMinor:4100}],
    totalMinor:qty*4100,
    partySize:2,
  });
  await runtime.assignDiningTable(hold.id,'T03');
  return {runtime,hold};
}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
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
  localStorage.setItem(PRINTER_KEY,JSON.stringify([receiptBinding]));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D3 Dining payment receipt and cash drawer boundary',()=>{
  it('prints one payment-scoped CASH receipt after durable payment and opens drawer exactly through that receipt',async()=>{
    const {runtime,hold}=await setup(2);
    const before=await runtime.readDiningHold(hold.id);
    const settled=await runtime.settleDiningHold(
      hold.id,
      [{lineIndex:0,qty:1}],
      'CASH',
      {submissionId:'cash-1',expectedRevision:before.checkoutRevision,receivedMinor:5000},
    );
    expect(settled.paidMinor).toBe(4100);
    expect(settled.remainingMinor).toBe(4100);

    const result=await runtime.ensureDiningPaymentReceipt(hold.id,'cash-1');
    expect(result).toMatchObject({state:'DONE',planned:1,sent:1,failed:0});

    const raster=await import('./ticket-bitmap.ts');
    expect(raster.renderEscPosRasterTicket).toHaveBeenCalledTimes(1);
    const input=(raster.renderEscPosRasterTicket as any).mock.calls[0][0];
    expect(input.kind).toBe('receipt');
    expect(input.kickDrawer).toBe(true);
    expect(input.order.display).toBe(settled.formalOrderDisplay);
    expect(input.order.totalMinor).toBe(4100);
    expect(input.order.items).toHaveLength(1);
    expect(input.order.items[0]).toMatchObject({id:'riceball',qty:1,unitMinor:4100});
    expect(input.order.receiptTitle).toBe('堂食付款收據');
    expect(input.order.receiptNoteLines).toEqual(expect.arrayContaining([
      '本次付款：$41.00',
      '實收：$50.00',
      '找續：$9.00',
      '付款後未收款：$41.00',
    ]));

    const payment=(await runtime.readDiningHold(hold.id)).payments.find((row:any)=>row.submissionId==='cash-1');
    expect(payment).toMatchObject({
      receiptState:'DONE',
      receiptPlanned:1,
      receiptSent:1,
      receiptFailed:0,
    });
    expect(payment.receiptAttemptedAt).toBeTruthy();
    expect(payment.receiptCompletedAt).toBeTruthy();
  });

  it('non-cash Dining receipt never opens drawer',async()=>{
    const {runtime,hold}=await setup(1);
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'fps-1',expectedRevision:before.checkoutRevision},
    );
    const result=await runtime.ensureDiningPaymentReceipt(hold.id,'fps-1');
    expect(result.state).toBe('DONE');

    const raster=await import('./ticket-bitmap.ts');
    const input=(raster.renderEscPosRasterTicket as any).mock.calls[0][0];
    expect(input.kickDrawer).toBe(false);
    expect(input.order.paymentLabel).toBe('FPS');
  });

  it('COMBO preserves split tender truth, counts only CASH component and opens drawer once when CASH exists',async()=>{
    const {runtime,hold}=await setup(1);
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'COMBO',
      {
        submissionId:'combo-1',
        expectedRevision:before.checkoutRevision,
        splitTenders:[
          {tender:'CASH',amountMinor:2000},
          {tender:'FPS',amountMinor:2100},
        ],
      },
    );
    const result=await runtime.ensureDiningPaymentReceipt(hold.id,'combo-1');
    expect(result.state).toBe('DONE');

    const payment=(await runtime.readDiningHold(hold.id)).payments[0];
    expect(payment.splitTenders).toEqual([
      {tender:'CASH',amountMinor:2000},
      {tender:'FPS',amountMinor:2100},
    ]);

    const raster=await import('./ticket-bitmap.ts');
    const input=(raster.renderEscPosRasterTicket as any).mock.calls[0][0];
    expect(input.kickDrawer).toBe(true);
    expect(input.order.paymentLabel).toContain('CASH $20.00');
    expect(input.order.paymentLabel).toContain('FPS $21.00');

    const report=buildLocalReport(runtime.orders(),{now:Date.now(),businessStartHour:5});
    expect(report.confirmedPaidMinor).toBe(4100);
    expect(report.cashSalesMinor).toBe(2000);
  });

  it('rejects COMBO whose split tender total does not equal selected Dining amount',async()=>{
    const {runtime,hold}=await setup(1);
    const before=await runtime.readDiningHold(hold.id);
    await expect(runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'COMBO',
      {
        submissionId:'combo-bad',
        expectedRevision:before.checkoutRevision,
        splitTenders:[
          {tender:'CASH',amountMinor:2000},
          {tender:'FPS',amountMinor:2000},
        ],
      },
    )).rejects.toThrow('DINING_SPLIT_TENDER_TOTAL_MISMATCH');
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(0);
  });

  it('receipt replay and restart never repeat print or drawer',async()=>{
    let {runtime,hold}=await setup(1);
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',
      {submissionId:'cash-replay',expectedRevision:before.checkoutRevision,receivedMinor:4100},
    );
    const first=await runtime.ensureDiningPaymentReceipt(hold.id,'cash-replay');

    const native=await import('./native-print.ts');
    const calls=(native.printBytesLan as any).mock.calls.length;
    expect(first.state).toBe('DONE');
    expect(calls).toBe(1);

    const replay=await runtime.ensureDiningPaymentReceipt(hold.id,'cash-replay');
    expect(replay).toEqual(first);
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);

    vi.resetModules();
    runtime=await boot();
    const afterRestart=await runtime.ensureDiningPaymentReceipt(hold.id,'cash-replay');
    expect(afterRestart).toEqual(first);
    const nativeAfter=await import('./native-print.ts');
    expect((nativeAfter.printBytesLan as any).mock.calls.length).toBe(calls);
  });

  it('UNKNOWN physical outcome is persisted and never auto-retried',async()=>{
    const native=await import('./native-print.ts');
    (native.printBytesLan as any).mockImplementationOnce(async()=>{throw new Error('PRINT_OUTCOME_UNKNOWN');});

    const {runtime,hold}=await setup(1);
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',
      {submissionId:'cash-unknown',expectedRevision:before.checkoutRevision,receivedMinor:4100},
    );
    const first=await runtime.ensureDiningPaymentReceipt(hold.id,'cash-unknown');
    expect(first.state).toBe('UNKNOWN');
    const calls=(native.printBytesLan as any).mock.calls.length;

    const replay=await runtime.ensureDiningPaymentReceipt(hold.id,'cash-unknown');
    expect(replay.state).toBe('UNKNOWN');
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);
  });

  it('durable payment can recover a not-yet-attempted receipt without creating another payment',async()=>{
    const {runtime,hold}=await setup(2);
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'PAYME',
      {submissionId:'recover-receipt',expectedRevision:before.checkoutRevision},
    );
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);

    const receipt=await runtime.ensureDiningPaymentReceipt(hold.id,'recover-receipt');
    expect(receipt.state).toBe('DONE');
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);
  });
});
