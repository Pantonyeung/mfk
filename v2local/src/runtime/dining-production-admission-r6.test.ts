import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';

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
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn()}));

const KEY='mfk.v2local.runtime.v1';
const PRINTER_KEY='mfk.v2local.printers.v5';
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
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  installStorage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
  values.set(PRINTER_KEY,JSON.stringify([
    {id:'receipt',routeKey:'logical.receipt',name:'小票',model:'LAN',role:'顧客小票',host:'127.0.0.1',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
    {id:'production',routeKey:'logical.production',name:'廚房',model:'LAN',role:'製作單',host:'127.0.0.2',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  ]));
});
afterEach(()=>vi.unstubAllGlobals());

describe('Dining R6 automatic table-order admission',()=>{
  it('table assignment itself creates the formal Order and dispatches the first dining print set',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    const order=runtime.orders().find((row:any)=>row.diningHoldId===hold.id);
    expect(detail.formalOrderId).toBe(order.id);
    expect(order.productionAdmissionAttemptedAt).toBeTruthy();
    expect(order.productionAdmissionState).toBe('DONE');
  });
  it('creates one formal Order and links the SAME dining hold durably',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:2,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:8200,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');

    const firstOrder=runtime.orders().find((row:any)=>row.diningHoldId===hold.id);
    expect(firstOrder).toBeTruthy();
    const first=await runtime.admitDiningProduction(hold.id);
    const detail=await runtime.readDiningHold(hold.id);
    const stored=JSON.parse(values.get(KEY)!);

    expect(first.orderId).toBe(detail.formalOrderId);
    expect(detail.productionAdmittedAt).toBeTruthy();
    expect(stored.holds.find((row:any)=>row.id===hold.id).formalOrderId).toBe(first.orderId);
    expect(stored.orders.filter((row:any)=>row.diningHoldId===hold.id)).toHaveLength(1);
    expect(stored.orders.find((row:any)=>row.id===first.orderId)).toMatchObject({
      paymentLabel:'未結帳',sourceLabel:'堂食',fulfillmentLabel:'進行中',diningHoldId:hold.id,
    });
  });

  it('repeated admission reuses the formal Order and never duplicates first production dispatch',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    const first=await runtime.admitDiningProduction(hold.id);
    const second=await runtime.admitDiningProduction(hold.id);
    expect(second.orderId).toBe(first.orderId);
    expect(runtime.orders().filter((row:any)=>row.diningHoldId===hold.id)).toHaveLength(1);
    expect(second.print.results).toHaveLength(0);
  });

  it('production admission excludes customer receipt and therefore cannot open drawer before payment',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    const result=await runtime.admitDiningProduction(hold.id);
    const ticket=await import('./ticket-bitmap.ts');
    const calls=(ticket.renderEscPosRasterTicket as any).mock.calls.map((row:any[])=>row[0]);
    expect(result.print.results.map((row:any)=>row.role)).not.toContain('顧客小票');
    expect(calls.some((row:any)=>row.kind==='receipt')).toBe(false);
    expect(calls.every((row:any)=>row.kickDrawer!==true)).toBe(true);
  });

  it('first table assignment includes table ticket but never a paid customer receipt',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    const options=await runtime.readDiningReprintOptions(hold.id);
    expect(options.some((row:any)=>row.role==='枱單')).toBe(true);
    expect(options.some((row:any)=>row.role==='顧客小票')).toBe(false);
  });

  it('dining reprint reuses SAME Order and forces drawer off',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    const before=runtime.orders().filter((row:any)=>row.diningHoldId===hold.id);
    const options=await runtime.readDiningReprintOptions(hold.id);
    const table=options.find((row:any)=>row.role==='枱單');
    expect(table).toBeTruthy();
    await runtime.reprintDiningJobs(hold.id,[table.jobId],'TEST');
    const after=runtime.orders().filter((row:any)=>row.diningHoldId===hold.id);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
    const ticket=await import('./ticket-bitmap.ts');
    const last=(ticket.renderEscPosRasterTicket as any).mock.calls.at(-1)?.[0];
    expect(last.kind).toBe('table');
    expect(last.kickDrawer).toBe(false);
  });

  it('dining payment updates the SAME formal Order tender projection',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:2,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:8200});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{submissionId:'pay-fps',expectedRevision:detail.checkoutRevision,receivedMinor:4100});
    const order=runtime.orders().find((row:any)=>row.diningHoldId===hold.id);
    expect(order.paymentLabel).toBe('FPS');
    expect(runtime.orders().filter((row:any)=>row.diningHoldId===hold.id)).toHaveLength(1);
  });

  it('mixed split tenders project COMBO without creating another Order',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:2,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:8200});
    await runtime.assignDiningTable(hold.id,'T01');
    let detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{submissionId:'pay-1',expectedRevision:detail.checkoutRevision,receivedMinor:4100});
    detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',{submissionId:'pay-2',expectedRevision:detail.checkoutRevision,receivedMinor:5000});
    const orders=runtime.orders().filter((row:any)=>row.diningHoldId===hold.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].paymentLabel).toBe('COMBO');
  });

  it('cash dining payment receipt is the drawer boundary while non-cash never kicks drawer',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:2,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:8200});
    await runtime.assignDiningTable(hold.id,'T01');
    let detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{submissionId:'fps',expectedRevision:detail.checkoutRevision,receivedMinor:4100});
    await runtime.printDiningPaymentReceipt(hold.id,'fps');
    detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',{submissionId:'cash',expectedRevision:detail.checkoutRevision,receivedMinor:5000});
    await runtime.printDiningPaymentReceipt(hold.id,'cash');
    const ticket=await import('./ticket-bitmap.ts');
    const calls=(ticket.renderEscPosRasterTicket as any).mock.calls.filter((row:any[])=>row[0].kind==='receipt').map((row:any[])=>row[0]);
    expect(calls.at(-2).kickDrawer).toBe(false);
    expect(calls.at(-1).kickDrawer).toBe(true);
  });

  it('formal Order link survives runtime restart',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'rice',name:'飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    const first=await runtime.admitDiningProduction(hold.id);
    vi.resetModules();
    runtime=await boot();
    const detail=await runtime.readDiningHold(hold.id);
    expect(detail.formalOrderId).toBe(first.orderId);
    const again=await runtime.admitDiningProduction(hold.id);
    expect(again.orderId).toBe(first.orderId);
    expect(runtime.orders().filter((row:any)=>row.diningHoldId===hold.id)).toHaveLength(1);
  });
});
