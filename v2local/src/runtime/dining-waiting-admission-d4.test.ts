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

const KEY='mfk.v2local.runtime.v1';
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

describe('D4 ordered Dining waiting admission',()=>{
  it('admits an ordered waiting Dining Hold into ONE Formal Order before seating and prints immediately',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
      note:'堂食輪候',
    });

    expect(runtime.orders()).toHaveLength(0);
    const admitted=await runtime.admitDiningHold(hold.id);

    expect(admitted.assignedTable).toBeUndefined();
    expect(admitted.formalOrderId).toBeTruthy();
    expect(admitted.formalOrderDisplay).toBeTruthy();
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0]).toMatchObject({
      id:admitted.formalOrderId,
      display:admitted.formalOrderDisplay,
      diningHoldId:hold.id,
      recognizedSalesMinor:0,
      outstandingMinor:4100,
      paymentLabel:'未收款',
    });

    const print=await runtime.ensureDiningInitialPrint(hold.id);
    expect(print).toMatchObject({state:'DONE',planned:2,sent:2,failed:0});

    const raster=await import('./ticket-bitmap.ts');
    const calls=(raster.renderEscPosRasterTicket as any).mock.calls.map((row:any[])=>row[0]);
    const waiting=calls.find((row:any)=>row.kind==='dining-table');
    expect(waiting).toBeTruthy();
    expect(waiting.kickDrawer).toBe(false);
    expect(waiting.order.diningTicketTitle).toBe('堂食輪候單');
    expect(waiting.order.diningTableLabel).toBe('輪候 '+admitted.formalOrderDisplay);
    expect(calls.some((row:any)=>row.kind==='receipt')).toBe(false);
    expect(calls.some((row:any)=>row.kind==='production')).toBe(true);
  });

  it('later seating keeps the SAME Formal Order and does not repeat the first print',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const admitted=await runtime.admitDiningHold(hold.id);
    const firstPrint=await runtime.ensureDiningInitialPrint(hold.id);

    const native=await import('./native-print.ts');
    const callsBefore=(native.printBytesLan as any).mock.calls.length;

    await runtime.assignDiningTable(hold.id,'T03');
    const seated=await runtime.readDiningHold(hold.id);
    expect(seated.assignedTable).toBe('T03');
    expect(seated.formalOrderId).toBe(admitted.formalOrderId);
    expect(seated.formalOrderDisplay).toBe(admitted.formalOrderDisplay);
    expect(runtime.orders()).toHaveLength(1);

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay).toEqual(firstPrint);
    expect((native.printBytesLan as any).mock.calls.length).toBe(callsBefore);
  });

  it('restart preserves waiting Formal Order identity and first-print certainty',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const admitted=await runtime.admitDiningHold(hold.id);
    const firstPrint=await runtime.ensureDiningInitialPrint(hold.id);

    vi.resetModules();
    runtime=await boot();

    const recovered=await runtime.readDiningHold(hold.id);
    expect(recovered.formalOrderId).toBe(admitted.formalOrderId);
    expect(recovered.formalOrderDisplay).toBe(admitted.formalOrderDisplay);
    expect(recovered.assignedTable).toBeUndefined();
    expect(runtime.orders()).toHaveLength(1);

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay).toEqual(firstPrint);

    await runtime.assignDiningTable(hold.id,'T01');
    const seated=await runtime.readDiningHold(hold.id);
    expect(seated.formalOrderId).toBe(admitted.formalOrderId);
    expect(runtime.orders()).toHaveLength(1);
  });

  it('admit replay is idempotent and does not allocate a second Display',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const first=await runtime.admitDiningHold(hold.id);
    const second=await runtime.admitDiningHold(hold.id);

    expect(second.formalOrderId).toBe(first.formalOrderId);
    expect(second.formalOrderDisplay).toBe(first.formalOrderDisplay);
    expect(runtime.orders()).toHaveLength(1);
  });

  it('SMM WAITING creates the Formal Order before seating and returns that identity',async()=>{
    const runtime=await boot();
    const hold=runtime.upsertSmmDiningHold({
      providerRef:'SMM:waiting-1',
      target:{kind:'WAITING',covers:2},
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      sourceLabel:'SMM',
    });

    expect(hold.assignedTable).toBeUndefined();
    expect(hold.formalOrderId).toBeTruthy();
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(hold.formalOrderId);

    const print=await runtime.ensureDiningInitialPrint(hold.id);
    expect(print.state).toBe('DONE');
  });
});
