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
  id,routeKey:'logical.'+id,name:id,model:'LAN',role,host,port:9100,
  capability:'receipt-80mm/kitchen',encoding:'gb18030',
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

describe('D8 SAME-order Dining table transfer',()=>{
  it('moves an active Dining Hold to an available table without changing Order / Display or reprinting',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    const firstPrint=await runtime.ensureDiningInitialPrint(hold.id);

    const native=await import('./native-print.ts');
    const calls=(native.printBytesLan as any).mock.calls.length;
    expect(firstPrint.state).toBe('DONE');

    await runtime.assignDiningTable(hold.id,'T02');

    const moved=await runtime.readDiningHold(hold.id);
    expect(moved.assignedTable).toBe('T02');
    expect(moved.formalOrderId).toBe(before.formalOrderId);
    expect(moved.formalOrderDisplay).toBe(before.formalOrderDisplay);
    expect(moved.totalMinor).toBe(before.totalMinor);
    expect(moved.paidMinor).toBe(before.paidMinor);
    expect(moved.remainingMinor).toBe(before.remainingMinor);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0].id).toBe(before.formalOrderId);

    const replay=await runtime.ensureDiningInitialPrint(hold.id);
    expect(replay).toEqual(firstPrint);
    expect((native.printBytesLan as any).mock.calls.length).toBe(calls);

    const view=await runtime.readDining();
    expect(view.tables.find((row:any)=>row.id==='T01')?.state).toBe('available');
    expect(view.tables.find((row:any)=>row.id==='T02')).toMatchObject({
      state:'occupied',
      holdId:hold.id,
      outstandingLabel:before.formalOrderDisplay,
    });
  });

  it('fails closed when the transfer target table is occupied and preserves the source table',async()=>{
    const runtime=await boot();
    const first=runtime.createHold({
      kind:'dining',items:[{id:'a',name:'A',qty:1,unitMinor:1000}],totalMinor:1000,partySize:2,
    });
    const second=runtime.createHold({
      kind:'dining',items:[{id:'b',name:'B',qty:1,unitMinor:1000}],totalMinor:1000,partySize:2,
    });
    expect(first.id).not.toBe(second.id);
    await runtime.assignDiningTable(first.id,'T01');
    await runtime.assignDiningTable(second.id,'T02');
    const identity=(await runtime.readDiningHold(first.id)).formalOrderId;
    const secondIdentity=(await runtime.readDiningHold(second.id)).formalOrderId;
    expect(identity).toBeTruthy();
    expect(secondIdentity).toBeTruthy();
    expect(identity).not.toBe(secondIdentity);

    await expect(runtime.assignDiningTable(first.id,'T02')).rejects.toThrow('DINING_TABLE_OCCUPIED');

    const after=await runtime.readDiningHold(first.id);
    expect(after.assignedTable).toBe('T01');
    expect(after.formalOrderId).toBe(identity);
    expect(runtime.orders()).toHaveLength(2);
  });
});
