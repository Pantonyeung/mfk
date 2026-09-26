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

async function setup(){
  const runtime=await boot();
  const hold=runtime.createHold({
    kind:'dining',
    items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
    totalMinor:4100,
    partySize:2,
  });
  await runtime.assignDiningTable(hold.id,'T03');
  await runtime.ensureDiningInitialPrint(hold.id);
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
  localStorage.setItem(PRINTER_KEY,JSON.stringify([
    binding('receipt','顧客小票','10.0.0.11'),
    binding('production','製作單','10.0.0.12'),
    binding('packing','打包單','10.0.0.13'),
  ]));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D5 Dining add-order delta print',()=>{
  it('appends items to the SAME Formal Order and prints only the new delta',async()=>{
    const {runtime,hold}=await setup();
    const original=runtime.orders()[0];
    const originalId=original.id;
    const originalDisplay=original.display;

    const native=await import('./native-print.ts');
    const raster=await import('./ticket-bitmap.ts');
    vi.clearAllMocks();

    const appended=await runtime.appendDiningItems(hold.id,{
      submissionId:'add-1',
      items:[{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
      totalMinor:1500,
      sourceLabel:'現場',
    });

    expect(appended.detail.formalOrderId).toBe(originalId);
    expect(appended.detail.formalOrderDisplay).toBe(originalDisplay);
    expect(appended.detail.totalMinor).toBe(5600);
    expect(appended.detail.additions).toHaveLength(1);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0]).toMatchObject({
      id:originalId,
      display:originalDisplay,
      totalMinor:5600,
      recognizedSalesMinor:0,
      outstandingMinor:5600,
    });

    const printed=await runtime.ensureDiningAdditionPrint(hold.id,appended.additionId);
    expect(printed).toMatchObject({state:'DONE',planned:2,sent:2,failed:0});

    const calls=(raster.renderEscPosRasterTicket as any).mock.calls.map((row:any[])=>row[0]);
    expect(calls.map((row:any)=>row.kind)).toEqual(['production','packing']);
    expect(calls.some((row:any)=>row.kind==='receipt'||row.kind==='dining-table')).toBe(false);
    expect(calls.every((row:any)=>row.kickDrawer!==true)).toBe(true);
    expect(calls[0].order.items).toEqual([
      expect.objectContaining({id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}),
    ]);
    expect(calls[1].order.items).toEqual([
      expect.objectContaining({id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}),
    ]);
    expect((native.printBytesLan as any).mock.calls.length).toBe(2);
  });

  it('keeps prior paid truth while a later add-order increases only outstanding',async()=>{
    const {runtime,hold}=await setup();
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'pay-before-add',expectedRevision:before.checkoutRevision},
    );
    const paid=await runtime.readDiningHold(hold.id);
    expect(paid.paidMinor).toBe(4100);
    expect(paid.remainingMinor).toBe(0);

    // A fully settled Dining Hold is archived and cannot accept additions.
    expect(paid.archivedAt).toBeTruthy();
    await expect(runtime.appendDiningItems(hold.id,{
      submissionId:'add-after-full-settle',
      items:[{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
      totalMinor:1500,
    })).rejects.toThrow('DINING_HISTORY_PROTECTED');
  });

  it('partial-paid Dining can add items without changing already confirmed money',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T03');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'partial-before-add',expectedRevision:before.checkoutRevision},
    );

    const appended=await runtime.appendDiningItems(hold.id,{
      submissionId:'add-after-partial',
      items:[{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
      totalMinor:1500,
    });

    expect(appended.detail.paidMinor).toBe(4100);
    expect(appended.detail.totalMinor).toBe(9700);
    expect(appended.detail.remainingMinor).toBe(5600);
    expect(appended.detail.lines[0]).toMatchObject({qty:2,paidQty:1,remainingQty:1});
    expect(appended.detail.lines[1]).toMatchObject({id:'tea',qty:1,paidQty:0,remainingQty:1});
    expect(runtime.orders()[0]).toMatchObject({
      recognizedSalesMinor:4100,
      outstandingMinor:5600,
      totalMinor:9700,
    });
  });

  it('same add submission and print replay are exactly-once across restart',async()=>{
    let {runtime,hold}=await setup();
    const original=runtime.orders()[0];

    const first=await runtime.appendDiningItems(hold.id,{
      submissionId:'stable-add',
      items:[{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
      totalMinor:1500,
    });
    const firstPrint=await runtime.ensureDiningAdditionPrint(hold.id,first.additionId);

    const native=await import('./native-print.ts');
    const calls=(native.printBytesLan as any).mock.calls.length;

    const replay=await runtime.appendDiningItems(hold.id,{
      submissionId:'stable-add',
      items:[{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
      totalMinor:1500,
    });
    expect(replay.additionId).toBe(first.additionId);
    expect(replay.detail.totalMinor).toBe(5600);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(original.id);

    const replayPrint=await runtime.ensureDiningAdditionPrint(hold.id,first.additionId);
    expect(replayPrint).toEqual(firstPrint);
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);

    vi.resetModules();
    runtime=await boot();
    const afterRestart=await runtime.ensureDiningAdditionPrint(hold.id,first.additionId);
    expect(afterRestart).toEqual(firstPrint);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(original.id);
  });

  it('UNKNOWN addition print is persisted and never blindly retried',async()=>{
    const {runtime,hold}=await setup();
    const added=await runtime.appendDiningItems(hold.id,{
      submissionId:'add-unknown',
      items:[{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
      totalMinor:1500,
    });

    const native=await import('./native-print.ts');
    vi.clearAllMocks();
    (native.printBytesLan as any).mockImplementationOnce(async()=>{throw new Error('PRINT_OUTCOME_UNKNOWN');});

    const first=await runtime.ensureDiningAdditionPrint(hold.id,added.additionId);
    expect(first.state).toBe('UNKNOWN');
    const calls=(native.printBytesLan as any).mock.calls.length;

    const replay=await runtime.ensureDiningAdditionPrint(hold.id,added.additionId);
    expect(replay.state).toBe('UNKNOWN');
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);
  });
});
