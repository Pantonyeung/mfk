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
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D14-A physical-table join',()=>{
  it('joins an empty physical table to the same Dining session and keeps first seatedAt / Formal Order',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:4,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);

    await runtime.joinDiningTable(hold.id,'T02');
    const after=await runtime.readDiningHold(hold.id);

    expect(after.formalOrderId).toBe(before.formalOrderId);
    expect(after.seatedAt).toBe(before.seatedAt);
    expect(after.assignedTable).toBe('T01');
    expect(after.joinedTables).toEqual(['T02']);

    const floor=await runtime.readDining();
    const t01=floor.tables.find((row:any)=>row.id==='T01');
    const t02=floor.tables.find((row:any)=>row.id==='T02');
    expect(t01?.holdId).toBe(hold.id);
    expect(t02?.holdId).toBe(hold.id);
    expect(t02?.areaLabel).toContain('併枱');
    expect(t02?.startedAt).toBe(before.seatedAt);
  });

  it('persists joined tables and SAME Formal Order across runtime restart',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:4,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    await runtime.joinDiningTable(hold.id,'T02');
    const before=await runtime.readDiningHold(hold.id);

    vi.resetModules();
    runtime=await boot();
    const after=await runtime.readDiningHold(hold.id);
    expect(after.formalOrderId).toBe(before.formalOrderId);
    expect(after.seatedAt).toBe(before.seatedAt);
    expect(after.joinedTables).toEqual(['T02']);
    const floor=await runtime.readDining();
    expect(floor.tables.find((row:any)=>row.id==='T01')?.holdId).toBe(hold.id);
    expect(floor.tables.find((row:any)=>row.id==='T02')?.holdId).toBe(hold.id);
  });

  it('never joins an occupied table / second Formal Order',async()=>{
    const runtime=await boot();
    const a=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const b=runtime.createHold({
      kind:'dining',
      items:[{id:'pork',name:'泡菜豬肉飯團',qty:1,unitMinor:4700}],
      totalMinor:4700,
      partySize:2,
    });
    await runtime.assignDiningTable(a.id,'T01');
    await runtime.assignDiningTable(b.id,'T02');

    await expect(runtime.joinDiningTable(a.id,'T02')).rejects.toThrow('DINING_TABLE_OCCUPIED');
    const aAfter=await runtime.readDiningHold(a.id);
    const bAfter=await runtime.readDiningHold(b.id);
    expect(aAfter.formalOrderId).not.toBe(bAfter.formalOrderId);
    expect(aAfter.joinedTables??[]).toEqual([]);
  });

  it('requires joined tables to be removed before primary-table transfer',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:3,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    await runtime.joinDiningTable(hold.id,'T02');

    await expect(runtime.assignDiningTable(hold.id,'T03')).rejects.toThrow('DINING_TRANSFER_REQUIRES_UNJOIN');
    const after=await runtime.readDiningHold(hold.id);
    expect(after.assignedTable).toBe('T01');
    expect(after.joinedTables).toEqual(['T02']);
  });

  it('removes only the joined table and keeps the Dining session seated on its primary table',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:3,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    await runtime.joinDiningTable(hold.id,'T02');
    const joined=await runtime.readDiningHold(hold.id);

    await expect(runtime.unassignDiningTable(hold.id)).rejects.toThrow('DINING_UNASSIGN_REQUIRES_UNJOIN');
    await runtime.unjoinDiningTable(hold.id,'T02');

    const after=await runtime.readDiningHold(hold.id);
    expect(after.assignedTable).toBe('T01');
    expect(after.joinedTables??[]).toEqual([]);
    expect(after.seatedAt).toBe(joined.seatedAt);
    expect(after.formalOrderId).toBe(joined.formalOrderId);
    const floor=await runtime.readDining();
    expect(floor.tables.find((row:any)=>row.id==='T01')?.holdId).toBe(hold.id);
    expect(floor.tables.find((row:any)=>row.id==='T02')?.state).toBe('available');
  });
});

describe('D15-A Dining line correction / void',()=>{
  it('uses append-only correction before production while keeping SAME Formal Order identity',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);

    const result=await runtime.correctDiningLine(hold.id,{
      submissionId:'D15:pre:1',
      lineIndex:0,
      quantity:1,
      reason:'客人取消一件',
    });

    expect(result.detail.formalOrderId).toBe(before.formalOrderId);
    expect(result.detail.totalMinor).toBe(4100);
    expect(result.detail.remainingMinor).toBe(4100);
    expect(result.detail.lines[0]).toMatchObject({
      originalQty:2,
      voidedQty:1,
      qty:1,
      paidQty:0,
      remainingQty:1,
    });
    expect(result.correction).toMatchObject({
      phase:'PRE_PRODUCTION',
      productionNoticeState:'NOT_REQUIRED',
      lineIndex:0,
      quantity:1,
      amountMinor:4100,
    });

    const order=runtime.orders().find((row:any)=>row.id===before.formalOrderId);
    expect(order).toMatchObject({
      originalTotalMinor:8200,
      totalMinor:4100,
      outstandingMinor:4100,
    });
    expect(order.items[0].qty).toBe(1);
    expect(order.diningLineCorrections).toHaveLength(1);

    const replay=await runtime.correctDiningLine(hold.id,{
      submissionId:'D15:pre:1',
      lineIndex:0,
      quantity:1,
      reason:'客人取消一件',
    });
    expect(replay.correction.id).toBe(result.correction.id);
    expect(replay.detail.lines[0].voidedQty).toBe(1);
  });

  it('persists append-only correction and effective totals across restart',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.correctDiningLine(hold.id,{
      submissionId:'D15:restart:1',
      lineIndex:0,
      quantity:1,
      reason:'客人取消一件',
    });

    vi.resetModules();
    runtime=await boot();
    const after=await runtime.readDiningHold(hold.id);
    expect(after.formalOrderId).toBe(before.formalOrderId);
    expect(after.totalMinor).toBe(4100);
    expect(after.lines[0]).toMatchObject({originalQty:2,voidedQty:1,qty:1});
    expect(after.corrections).toHaveLength(1);
    const order=runtime.orders().find((row:any)=>row.id===before.formalOrderId);
    expect(order).toMatchObject({originalTotalMinor:8200,totalMinor:4100,outstandingMinor:4100});
  });

  it('after production preserves original line and emits exactly one production correction notice',async()=>{
    localStorage.setItem(PRINTER_KEY,JSON.stringify([
      binding('receipt','顧客小票','10.0.0.11'),
      binding('production','製作單','10.0.0.12'),
      binding('packing','打包單','10.0.0.13'),
    ]));
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    const printed=await runtime.ensureDiningInitialPrint(hold.id);
    expect(printed.state).toBe('DONE');
    expect(runtime.orders().find((row:any)=>row.id===before.formalOrderId)?.productionIssuedAt).toBeTruthy();

    const native=await import('./native-print.ts');
    const beforeNotices=(native.printTextLan as any).mock.calls.length;

    const result=await runtime.correctDiningLine(hold.id,{
      submissionId:'D15:post:1',
      lineIndex:0,
      quantity:1,
      reason:'客人取消一件',
    });
    expect(result.correction).toMatchObject({
      phase:'POST_PRODUCTION',
      productionNoticeState:'DONE',
      lineIndex:0,
      quantity:1,
    });
    expect(result.detail.lines[0]).toMatchObject({originalQty:2,voidedQty:1,qty:1});
    expect(result.detail.formalOrderId).toBe(before.formalOrderId);

    const noticeCalls=(native.printTextLan as any).mock.calls.slice(beforeNotices);
    expect(noticeCalls).toHaveLength(1);
    expect(String(noticeCalls[0]?.[0]?.text)).toContain('商品更正通知');
    expect(String(noticeCalls[0]?.[0]?.text)).toContain('原味飯團');
    expect(String(noticeCalls[0]?.[0]?.text)).toContain('取消 1 件');

    const replay=await runtime.correctDiningLine(hold.id,{
      submissionId:'D15:post:1',
      lineIndex:0,
      quantity:1,
      reason:'客人取消一件',
    });
    expect(replay.correction.id).toBe(result.correction.id);
    expect((native.printTextLan as any).mock.calls.length).toBe(beforeNotices+1);
  });

  it('fails closed when production certainty is UNKNOWN and never rewrites the line',async()=>{
    localStorage.setItem(PRINTER_KEY,JSON.stringify([
      binding('production','製作單','10.0.0.12'),
    ]));
    const native=await import('./native-print.ts');
    (native.printBytesLan as any).mockImplementationOnce(async()=>{throw new Error('PRINT_OUTCOME_UNKNOWN');});

    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const printed=await runtime.ensureDiningInitialPrint(hold.id);
    expect(printed.state).toBe('UNKNOWN');

    await expect(runtime.correctDiningLine(hold.id,{
      submissionId:'D15:unknown:1',
      lineIndex:0,
      quantity:1,
      reason:'客人取消',
    })).rejects.toThrow('DINING_PRODUCTION_CERTAINTY_UNKNOWN');

    const detail=await runtime.readDiningHold(hold.id);
    expect(detail.lines[0]).toMatchObject({qty:1,voidedQty:0});
    expect(detail.corrections).toHaveLength(0);
  });

  it('never destructively removes paid quantity; paid removal stays on Refund/Adjustment path',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',{
      submissionId:'PAY:D15:1',
      expectedRevision:before.checkoutRevision,
      receivedMinor:4100,
    });

    await expect(runtime.correctDiningLine(hold.id,{
      submissionId:'D15:paid:1',
      lineIndex:0,
      quantity:1,
      reason:'已付款商品移除',
    })).rejects.toThrow('DINING_PAID_LINE_USE_REFUND');
  });
});