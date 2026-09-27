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

describe('D16 Dining party / cover adjustment',()=>{
  it('changes waiting cover count without creating a Formal Order',async()=>{
    const runtime=await boot();
    const hold=await runtime.createDiningWait({partySize:2,note:'窗邊'});
    const before=await runtime.readDiningHold(hold.id);

    const after=await runtime.updateDiningPartySize(hold.id,4);

    expect(after.holdId).toBe(before.holdId);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.partySize).toBe(4);
    expect(after.formalOrderId).toBeUndefined();
    expect(runtime.orders()).toHaveLength(0);
    expect(after.totalMinor).toBe(0);
    expect(after.paidMinor).toBe(0);
    expect(after.remainingMinor).toBe(0);
  });

  it('keeps SAME Formal Order, seating time and table assignment after seated cover change',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    await runtime.joinDiningTable(hold.id,'T02');

    const before=await runtime.readDiningHold(hold.id);
    const after=await runtime.updateDiningPartySize(hold.id,5);

    expect(after.partySize).toBe(5);
    expect(after.formalOrderId).toBe(before.formalOrderId);
    expect(after.formalOrderDisplay).toBe(before.formalOrderDisplay);
    expect(after.seatedAt).toBe(before.seatedAt);
    expect(after.assignedTable).toBe('T01');
    expect(after.joinedTables).toEqual(['T02']);
    expect(after.totalMinor).toBe(before.totalMinor);
    expect(after.remainingMinor).toBe(before.remainingMinor);

    const floor=await runtime.readDining();
    expect(floor.tables.find((row:any)=>row.id==='T01')?.partySize).toBe(5);
    expect(floor.tables.find((row:any)=>row.id==='T02')?.partySize).toBe(5);
  });

  it('does not change money or emit print/drawer side effects after partial payment',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[
        {id:'riceball',name:'原味飯團',qty:1,unitMinor:4100},
        {id:'pork',name:'泡菜豬肉飯團',qty:1,unitMinor:4700},
      ],
      totalMinor:8800,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{
      submissionId:'PAY:D16:1',
      expectedRevision:before.checkoutRevision,
    });
    const paid=await runtime.readDiningHold(hold.id);

    const next=await runtime.updateDiningPartySize(hold.id,3);

    expect(next.partySize).toBe(3);
    expect(next.formalOrderId).toBe(paid.formalOrderId);
    expect(next.totalMinor).toBe(8800);
    expect(next.paidMinor).toBe(4100);
    expect(next.remainingMinor).toBe(4700);
    expect(next.payments).toEqual(paid.payments);

    const native=await import('./native-print.ts');
    expect(native.printBytesLan).not.toHaveBeenCalled();
    expect(native.printTextLan).not.toHaveBeenCalled();
  });

  it('rejects invalid cover count and closed history',async()=>{
    const runtime=await boot();
    const waiting=await runtime.createDiningWait({partySize:2});
    await expect(runtime.updateDiningPartySize(waiting.id,0)).rejects.toThrow('DINING_PARTY_SIZE_INVALID');

    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',{
      submissionId:'PAY:D16:CLOSE',
      expectedRevision:before.checkoutRevision,
      receivedMinor:4100,
    });

    await expect(runtime.updateDiningPartySize(hold.id,3)).rejects.toThrow('DINING_HISTORY_PROTECTED');
  });

  it('persists cover change across runtime restart',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T03');
    const before=await runtime.readDiningHold(hold.id);
    await runtime.updateDiningPartySize(hold.id,6);

    vi.resetModules();
    runtime=await boot();
    const after=await runtime.readDiningHold(hold.id);
    expect(after.partySize).toBe(6);
    expect(after.formalOrderId).toBe(before.formalOrderId);
    expect(after.seatedAt).toBe(before.seatedAt);
    expect(after.assignedTable).toBe('T03');
  });
});