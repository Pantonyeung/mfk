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

const PRINTER_KEY='mfk.v2local.printers.v5';
let values:Map<string,string>;

const binding=(id:string,role:string,host:string)=>({
  id,
  routeKey:'logical.'+id,
  name:id,
  model:'LAN',
  role,
  host,
  port:9100,
  capability:'receipt-80mm/kitchen',
  encoding:'gb18030',
});

async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

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
  localStorage.setItem(PRINTER_KEY,JSON.stringify([
    binding('receipt','顧客小票','10.0.0.11'),
    binding('production','製作單','10.0.0.12'),
  ]));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D9 unpaid Dining cancellation',()=>{
  it('cancels the SAME Dining Order, releases table, keeps money at zero and sends one production cancel notice',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.ensureDiningInitialPrint(hold.id);
    const orderId=before.formalOrderId;
    expect(orderId).toBeTruthy();
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].productionIssuedAt).toBeTruthy();

    const native=await import('./native-print.ts');
    vi.clearAllMocks();

    const result=await runtime.cancelOrder(orderId,'客人取消堂食');
    expect(result).toEqual({orderId,status:'CANCELLED'});

    const order=runtime.orders()[0];
    expect(order).toMatchObject({
      id:orderId,
      fulfillmentLabel:'已取消',
      recognizedSalesMinor:0,
      outstandingMinor:0,
      cancellationReason:'客人取消堂食',
      cancellationNoticeState:'DONE',
    });
    expect(runtime.orders()).toHaveLength(1);

    const view=await runtime.readDining();
    expect(view.tables.find((row:any)=>row.id==='T01')?.state).toBe('available');

    const history=await runtime.readDiningHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      holdId:hold.id,
      formalOrderId:orderId,
      paidMinor:0,
      remainingMinor:0,
    });
    expect(history[0].cancelledAt).toBeTruthy();

    expect(native.printTextLan).toHaveBeenCalledTimes(1);
    const printInput=(native.printTextLan as any).mock.calls[0][0];
    expect(printInput.text).toContain('取消通知單');
    expect(printInput.text).toContain('客人取消堂食');
    expect(printInput.kickDrawer).toBe(false);

    await runtime.cancelOrder(orderId,'重試');
    expect(native.printTextLan).toHaveBeenCalledTimes(1);
  });

  it('runtime keeps paid money truth on cancel; refund remains a separate action',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'paid-before-cancel',expectedRevision:detail.checkoutRevision},
    );
    const orderId=(await runtime.readDiningHold(hold.id)).formalOrderId;
    await runtime.cancelOrder(orderId,'已付款後取消');

    const order=runtime.orders()[0];
    expect(order.recognizedSalesMinor).toBe(4100);
    expect(order.outstandingMinor).toBe(0);
    expect(order.refunds??[]).toHaveLength(0);
    const history=await runtime.readDiningHistory();
    expect(history[0].paidMinor).toBe(4100);
    expect(history[0].remainingMinor).toBe(0);
  });
});
