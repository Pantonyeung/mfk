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
    binding('packing','打包單','10.0.0.13'),
  ]));
});
afterEach(()=>vi.unstubAllGlobals());

describe('D4 ordered Dining waiting admission',()=>{
  it('admits an ordered waiting Hold as ONE Formal Order and prints before a table exists',async()=>{
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
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0]).toMatchObject({
      id:admitted.formalOrderId,
      display:admitted.formalOrderDisplay,
      recognizedSalesMinor:0,
      outstandingMinor:4100,
    });

    const printed=await runtime.ensureDiningInitialPrint(hold.id);
    expect(printed).toMatchObject({state:'DONE',planned:3,sent:3,failed:0});

    const raster=await import('./ticket-bitmap.ts');
    const calls=(raster.renderEscPosRasterTicket as any).mock.calls;
    const waiting=calls.find((call:any[])=>call[0]?.kind==='dining-table');
    expect(waiting?.[0]?.order?.diningTicketTitle).toBe('堂食輪候單');
    expect(waiting?.[0]?.order?.diningTableLabel).toContain('輪候');
    expect(calls.map((call:any[])=>call[0]?.kind)).toEqual(expect.arrayContaining(['dining-table','production','packing']));
  });

  it('later seating keeps SAME Formal Order and does not repeat the initial print',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const admitted=await runtime.admitDiningHold(hold.id);
    await runtime.ensureDiningInitialPrint(hold.id);

    const native=await import('./native-print.ts');
    const calls=(native.printBytesLan as any).mock.calls.length;

    await runtime.assignDiningTable(hold.id,'T03');
    const seated=await runtime.readDiningHold(hold.id);
    expect(seated.formalOrderId).toBe(admitted.formalOrderId);
    expect(seated.formalOrderDisplay).toBe(admitted.formalOrderDisplay);
    expect(seated.assignedTable).toBe('T03');
    expect(runtime.orders()).toHaveLength(1);

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay.state).toBe('DONE');
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);
  });

  it('restart between waiting admission and seating preserves SAME Order identity',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const admitted=await runtime.admitDiningHold(hold.id);

    vi.resetModules();
    runtime=await boot();
    await runtime.assignDiningTable(hold.id,'T02');
    const seated=await runtime.readDiningHold(hold.id);
    expect(seated.formalOrderId).toBe(admitted.formalOrderId);
    expect(runtime.orders()).toHaveLength(1);
  });

  it('empty waiting entry remains non-financial and cannot be admitted as a Formal Order',async()=>{
    const runtime=await boot();
    const wait=await runtime.createDiningWait({partySize:2,note:'等位'});
    await expect(runtime.admitDiningHold(wait.id)).rejects.toThrow('DINING_ORDER_ITEMS_REQUIRED');
    expect(runtime.orders()).toHaveLength(0);
  });
});
