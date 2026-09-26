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

let values:Map<string,string>;
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
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
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('D13 Dining seating start time',()=>{
  it('starts Dining elapsed time at actual seating, not at waiting/order creation',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.admitDiningHold(hold.id);
    const waiting=await runtime.readDiningHold(hold.id);
    expect(waiting.createdAt).toBe('2026-09-26T10:00:00.000Z');
    expect(waiting.seatedAt).toBeUndefined();

    vi.setSystemTime(new Date('2026-09-26T10:20:00.000Z'));
    await runtime.assignDiningTable(hold.id,'T01');

    const seated=await runtime.readDiningHold(hold.id);
    expect(seated.createdAt).toBe('2026-09-26T10:00:00.000Z');
    expect(seated.seatedAt).toBe('2026-09-26T10:20:00.000Z');
    expect(seated.formalOrderId).toBe(waiting.formalOrderId);

    const table=(await runtime.readDining()).tables.find((row:any)=>row.id==='T01');
    expect(table?.startedAt).toBe('2026-09-26T10:20:00.000Z');
  });

  it('preserves first seating time across table transfer and temporary unassign/reassign',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    vi.setSystemTime(new Date('2026-09-26T10:05:00.000Z'));
    await runtime.assignDiningTable(hold.id,'T01');
    const original=await runtime.readDiningHold(hold.id);
    expect(original.seatedAt).toBe('2026-09-26T10:05:00.000Z');

    vi.setSystemTime(new Date('2026-09-26T10:25:00.000Z'));
    await runtime.assignDiningTable(hold.id,'T02');
    const moved=await runtime.readDiningHold(hold.id);
    expect(moved.seatedAt).toBe(original.seatedAt);
    expect(moved.formalOrderId).toBe(original.formalOrderId);

    vi.setSystemTime(new Date('2026-09-26T10:30:00.000Z'));
    await runtime.unassignDiningTable(hold.id);
    const waitingAgain=await runtime.readDiningHold(hold.id);
    expect(waitingAgain.seatedAt).toBe(original.seatedAt);
    expect(waitingAgain.assignedTable).toBeUndefined();

    vi.setSystemTime(new Date('2026-09-26T10:35:00.000Z'));
    await runtime.assignDiningTable(hold.id,'T03');
    const reseated=await runtime.readDiningHold(hold.id);
    expect(reseated.seatedAt).toBe(original.seatedAt);
    expect(reseated.formalOrderId).toBe(original.formalOrderId);
    expect((await runtime.readDining()).tables.find((row:any)=>row.id==='T03')?.startedAt).toBe(original.seatedAt);
  });

  it('records direct SMM table seating immediately while SMM waiting stays unseated until assignment',async()=>{
    const runtime=await boot();
    const direct=runtime.upsertSmmDiningHold({
      providerRef:'SMM:direct-seat',
      target:{kind:'TABLE',tableId:'T01',covers:2},
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      sourceLabel:'SMM',
    });
    expect(direct.seatedAt).toBe(direct.createdAt);

    vi.setSystemTime(new Date('2026-09-26T10:10:00.000Z'));
    const waiting=runtime.upsertSmmDiningHold({
      providerRef:'SMM:waiting-seat',
      target:{kind:'WAITING',covers:2},
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      sourceLabel:'SMM',
    });
    expect(waiting.seatedAt).toBeUndefined();

    vi.setSystemTime(new Date('2026-09-26T10:25:00.000Z'));
    await runtime.assignDiningTable(waiting.id,'T02');
    const seated=await runtime.readDiningHold(waiting.id);
    expect(seated.createdAt).toBe('2026-09-26T10:10:00.000Z');
    expect(seated.seatedAt).toBe('2026-09-26T10:25:00.000Z');
  });
});
