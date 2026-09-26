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

const binding=(id:string,role:string,host:string,capability='receipt-80mm/kitchen')=>({
  id,
  routeKey:'logical.'+id,
  name:id,
  model:'LAN',
  role,
  host,
  port:9100,
  capability,
  encoding:capability==='label-58mm'?'big5':'gb18030',
  ...(role==='產品標籤'?{productIds:['riceball']}:{}),
});

async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
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
    binding('packing','打包單','10.0.0.13'),
    binding('product-label-riceball','產品標籤','10.0.0.14','label-58mm'),
    binding('bag-label','袋標籤','10.0.0.15','label-58mm'),
  ]));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D2 first Dining print certainty',()=>{
  it('prints table ticket + production + packing + labels after durable D1, without paid receipt or drawer',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T03');

    const before=await runtime.readDiningHold(hold.id);
    expect(before.formalOrderId).toBeTruthy();

    const result=await runtime.ensureDiningInitialPrint(hold.id);
    expect(result).toEqual(expect.objectContaining({
      orderId:before.formalOrderId,
      state:'DONE',
      planned:5,
      sent:5,
      failed:0,
    }));

    const order=runtime.orders().find((row:any)=>row.id===before.formalOrderId);
    expect(order).toMatchObject({
      diningInitialPrintState:'DONE',
      diningInitialPrintPlanned:5,
      diningInitialPrintSent:5,
      diningInitialPrintFailed:0,
    });
    expect(order.diningInitialPrintAttemptedAt).toBeTruthy();
    expect(order.diningInitialPrintCompletedAt).toBeTruthy();

    const raster=await import('./ticket-bitmap.ts');
    const kinds=(raster.renderEscPosRasterTicket as any).mock.calls.map((call:any[])=>call[0]?.kind);
    expect(kinds).toEqual(expect.arrayContaining(['dining-table','production','packing']));
    expect(kinds).not.toContain('receipt');
    const tableCall=(raster.renderEscPosRasterTicket as any).mock.calls.find((call:any[])=>call[0]?.kind==='dining-table');
    expect(tableCall?.[0]).toMatchObject({kickDrawer:false});
    expect(tableCall?.[0]?.order?.diningTableLabel).toBe('T03');

    const native=await import('./native-print.ts');
    expect(native.printBytesLan).toHaveBeenCalledTimes(5);
    expect(native.printTextLan).not.toHaveBeenCalled();
  });

  it('replay and restart read persisted D2 result and never blindly dispatch the first print again',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const first=await runtime.ensureDiningInitialPrint(hold.id);

    const native=await import('./native-print.ts');
    const calls=(native.printBytesLan as any).mock.calls.length;
    expect(first.state).toBe('DONE');

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay).toEqual(first);
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);

    vi.resetModules();
    runtime=await boot();
    const afterRestart=await runtime.ensureDiningInitialPrint(hold.id);
    expect(afterRestart).toEqual(first);
    const nativeAfter=await import('./native-print.ts');
    expect((nativeAfter.printBytesLan as any).mock.calls.length).toBe(calls);
  });

  it('persists UNKNOWN before any possible retry when physical outcome is uncertain',async()=>{
    const native=await import('./native-print.ts');
    (native.printBytesLan as any).mockImplementationOnce(async()=>{throw new Error('PRINT_OUTCOME_UNKNOWN');});

    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T02');

    const result=await runtime.ensureDiningInitialPrint(hold.id);
    expect(result.state).toBe('UNKNOWN');
    const calls=(native.printBytesLan as any).mock.calls.length;

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay.state).toBe('UNKNOWN');
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);
  });

  it('known missing routes becomes FAILED and also does not auto-retry',async()=>{
    localStorage.setItem(PRINTER_KEY,'[]');
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T04');

    const result=await runtime.ensureDiningInitialPrint(hold.id);
    expect(result).toMatchObject({state:'FAILED',planned:0,sent:0,failed:0});

    const native=await import('./native-print.ts');
    expect(native.printBytesLan).not.toHaveBeenCalled();
    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay.state).toBe('FAILED');
    expect(native.printBytesLan).not.toHaveBeenCalled();
  });
});
