import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';

// Test the real runtime. Only external effects are replaced, never settlement logic.
vi.mock('./native-print.ts',()=>({printBytesLan:vi.fn(()=>{throw new Error('PHYSICAL_FORBIDDEN');}),printTextLan:vi.fn(()=>{throw new Error('PHYSICAL_FORBIDDEN');})}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn(()=>{throw new Error('PROJECTION_FORBIDDEN');})}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(()=>{throw new Error('PROVIDER_FORBIDDEN');})}));
const KEY='mfk.v2local.runtime.v1';
let values:Map<string,string>;
let failWrite=false;
let writes=0;
const item=(id='rice',qty=2,unitMinor=4100)=>({id,name:id,qty,unitMinor,serviceMode:'dine-in' as const});
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}
async function setup(qty=2){
  const runtime=await boot();
  const hold=runtime.createHold({kind:'dining',items:[item('rice',qty)],totalMinor:qty*4100,partySize:4});
  await runtime.assignDiningTable(hold.id,'T01');
  return {runtime,hold};
}
async function command(runtime:any,id:string,submissionId='pay-1',receivedMinor=10000){
  const detail=await runtime.readDiningHold(id);
  return {submissionId,expectedRevision:detail.checkoutRevision,receivedMinor};
}
beforeEach(()=>{
  vi.resetModules();values=new Map();writes=0;failWrite=false;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{if(failWrite&&key===KEY)throw new Error('QUOTA_TEST');if(key===KEY)writes++;values.set(key,String(value));},
    removeItem:(key:string)=>values.delete(key),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,
    get length(){return values.size;},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('Dining R2 actual payment and history',()=>{
  it('part-payment keeps table, pays only selected units, and preserves SAME hold',async()=>{
    const {runtime,hold}=await setup();
    const before=writes;
    const result=await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id));
    expect(result.holdId).toBe(hold.id);expect(result.remainingMinor).toBe(4100);
    expect(result.payments).toHaveLength(1);expect(result.payments[0]).toMatchObject({submissionId:'pay-1',amountMinor:4100,receivedMinor:10000,changeMinor:5900});
    expect(result.assignedTable).toBe('T01');expect(writes-before).toBe(1);
  });
  it('same submission repeated and double clicked makes one payment',async()=>{
    const {runtime,hold}=await setup();const cmd=await command(runtime,hold.id);
    await Promise.all([runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd),runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd)]);
    const after=await runtime.readDiningHold(hold.id);expect(after.payments).toHaveLength(1);expect(after.paidMinor).toBe(4100);
  });
  it('same submission survives module restart and original revision becoming old',async()=>{
    let {runtime,hold}=await setup();const cmd=await command(runtime,hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    vi.resetModules();runtime=await boot();
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);
  });
  it('rejects same submission reused with a changed amount or tender',async()=>{
    const {runtime,hold}=await setup();const cmd=await command(runtime,hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:2}],'CASH',cmd)).rejects.toThrow('DINING_SUBMISSION_CONFLICT');
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',cmd)).rejects.toThrow('DINING_SUBMISSION_CONFLICT');
  });
  it('rejects duplicate line indexes instead of exceeding the remaining quantity',async()=>{
    const {runtime,hold}=await setup(1);
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1},{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id))).rejects.toThrow('DINING_DUPLICATE_SELECTION');
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(0);
  });
  it.each([0,-1,0.5,NaN,Infinity])('rejects invalid quantity %s',async(qty)=>{
    const {runtime,hold}=await setup();
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty}],'CASH',await command(runtime,hold.id))).rejects.toThrow('DINING_SELECTION_INVALID');
  });
  it('stale snapshot after another partial payment is refused, not repriced silently',async()=>{
    const {runtime,hold}=await setup(3);const cmd=await command(runtime,hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',{...cmd,submissionId:'stale-2'})).rejects.toThrow('DINING_CHECKOUT_STALE');
  });
  it('fresh storage is checked even when another runtime changed the price without a UI event',async()=>{
    const {runtime,hold}=await setup();const cmd=await command(runtime,hold.id);
    const data=JSON.parse(values.get(KEY)!);data.holds[0].items[0].unitMinor=5000;data.holds[0].totalMinor=10000;values.set(KEY,JSON.stringify(data));
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd)).rejects.toThrow('DINING_CHECKOUT_STALE');
  });
  it('storage failure cannot publish an in-memory payment or free a table',async()=>{
    const {runtime,hold}=await setup(1);const cmd=await command(runtime,hold.id);const raw=values.get(KEY);
    const subscriber=vi.fn();runtime.subscribe(subscriber);failWrite=true;
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd)).rejects.toThrow('QUOTA_TEST');
    expect(values.get(KEY)).toBe(raw);expect(subscriber).not.toHaveBeenCalled();
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(0);
  });
  it('full payment frees table in SAME write and preserves history across restart',async()=>{
    let {runtime,hold}=await setup(1);const cmd=await command(runtime,hold.id);const before=writes;
    const result=await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    expect(writes-before).toBe(1);expect(result.archivedAt).toBeTruthy();expect(result.assignedTable).toBeUndefined();expect(result.lastAssignedTable).toBe('T01');
    expect((await runtime.readDining()).tables[0].state).toBe('available');
    expect((await runtime.readDining()).queue).toHaveLength(0);expect(runtime.holds()).toHaveLength(0);
    expect(JSON.parse(values.get(KEY)!).holds).toHaveLength(1);
    vi.resetModules();runtime=await boot();
    expect((await runtime.readDiningHistory())[0].holdId).toBe(hold.id);
    expect((await runtime.readDiningHold(hold.id)).payments[0].submissionId).toBe(cmd.submissionId);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);
  });
  it('ordered waiting hold can pay without first occupying a table',async()=>{
    const runtime=await boot();const hold=runtime.createHold({kind:'dining',items:[item('wait',1)],totalMinor:4100});
    const result=await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',await command(runtime,hold.id,'waiting-pay',4100));
    expect(result.paidMinor).toBe(4100);expect(result.archivedAt).toBeTruthy();expect(result.assignedTable).toBeUndefined();
  });
  it('paid history cannot be erased by clear/remove/queue delete',async()=>{
    const {runtime,hold}=await setup(1);await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id));
    await runtime.clearDiningHold(hold.id);
    await expect(runtime.removeDiningWait(hold.id)).rejects.toThrow('DINING_HISTORY_PROTECTED');
    expect(()=>runtime.removeHold(hold.id)).toThrow('DINING_HISTORY_PROTECTED');
    expect((await runtime.readDiningHold(hold.id)).paidMinor).toBe(4100);
  });
  it('occupied table is protected in runtime, not only by disabled UI',async()=>{
    const {runtime,hold}=await setup();await new Promise(r=>setTimeout(r,2));
    const other=await runtime.createDiningWait({partySize:2});
    await expect(runtime.assignDiningTable(other.id,'T01')).rejects.toThrow('DINING_TABLE_OCCUPIED');
    expect((await runtime.readDiningHold(hold.id)).assignedTable).toBe('T01');
  });
  it('requires stable identity, revision and sufficient cash at authoritative payment boundary',async()=>{
    const {runtime,hold}=await setup();
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH')).rejects.toThrow('DINING_CHECKOUT_REFRESH_REQUIRED');
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id,'low',100))).rejects.toThrow('DINING_CASH_INSUFFICIENT');
  });
});
