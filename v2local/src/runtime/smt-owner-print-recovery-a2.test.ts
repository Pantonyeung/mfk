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
    binding('packing','打包單','10.0.0.13'),
    binding('product-label-riceball','產品標籤','10.0.0.14','label-58mm'),
    binding('bag-label','袋標籤','10.0.0.15','label-58mm'),
  ]));
});
afterEach(()=>vi.unstubAllGlobals());

describe('SMT consolidation A2 — Dining print recovery',()=>{
  it('persists per-job initial transport evidence on the SAME Formal Order',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    const result=await runtime.ensureDiningInitialPrint(hold.id);
    expect(result).toMatchObject({state:'DONE',planned:5,sent:5,failed:0});

    const order=runtime.orders().find((row:any)=>row.id===detail.formalOrderId);
    expect(order.diningInitialPrintResults).toHaveLength(5);
    expect(order.diningInitialPrintResults.map((row:any)=>row.jobId)).toEqual(expect.arrayContaining([
      order.id+':dining-table',
      order.id+':production',
      order.id+':packing',
    ]));

    const readback=await runtime.readDiningHold(hold.id);
    expect(readback.firstPrintState).toBe('DONE');
    expect(readback.firstPrintSummary).toEqual({planned:5,sent:5,failed:0});
    expect(readback.firstPrintResults).toHaveLength(5);
    expect(readback.firstPrintAttention).toBe('NONE');
  });

  it('exposes neutral current-plan reprint options and reprints only selected jobs with drawer suppressed',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T02');
    await runtime.ensureDiningInitialPrint(hold.id);

    const options=await runtime.readDiningReprintOptions(hold.id);
    expect(options).toHaveLength(5);
    expect(options.every((row:any)=>!('firstPrintState' in row)&&!('recommended' in row))).toBe(true);
    expect(options.map((row:any)=>row.role)).toEqual(expect.arrayContaining(['顧客小票','製作單','打包單','產品標籤','袋標籤']));

    const native=await import('./native-print.ts');
    const before=(native.printBytesLan as any).mock.calls.length;
    const selected=options.find((row:any)=>row.role==='製作單');
    const result=await runtime.reprintDiningJobs(hold.id,[selected.jobId],'真人確認補印');
    expect(result).toMatchObject({planned:1,sent:1,failed:0});
    expect((native.printBytesLan as any).mock.calls.length).toBe(before+1);

    const raster=await import('./ticket-bitmap.ts');
    const last=(raster.renderEscPosRasterTicket as any).mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({kind:'production',kickDrawer:false});
  });

  it('rejects stale or forged Dining reprint job ids before physical dispatch',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T03');
    await runtime.ensureDiningInitialPrint(hold.id);

    const native=await import('./native-print.ts');
    const before=(native.printBytesLan as any).mock.calls.length;
    await expect(runtime.reprintDiningJobs(hold.id,['FORGED:JOB'],'test'))
      .rejects.toThrow('DINING_REPRINT_JOB_INVALID');
    expect((native.printBytesLan as any).mock.calls.length).toBe(before);
  });

  it('keeps UNKNOWN as transport uncertainty and never auto-reprints the initial set',async()=>{
    const native=await import('./native-print.ts');
    (native.printBytesLan as any).mockImplementationOnce(async()=>{throw new Error('PRINT_OUTCOME_UNKNOWN');});
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T04');

    const first=await runtime.ensureDiningInitialPrint(hold.id);
    expect(first.state).toBe('UNKNOWN');
    const calls=(native.printBytesLan as any).mock.calls.length;

    const detail=await runtime.readDiningHold(hold.id);
    expect(detail.firstPrintState).toBe('UNKNOWN');
    expect(detail.firstPrintAttention).toBe('TRANSPORT_UNKNOWN');
    expect(detail.firstPrintResults.length).toBeGreaterThan(0);

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay.state).toBe('UNKNOWN');
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);
  });
});