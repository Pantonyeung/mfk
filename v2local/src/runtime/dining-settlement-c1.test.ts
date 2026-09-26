import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(()=>{throw new Error('PHYSICAL_FORBIDDEN');}),
  printTextLan:vi.fn(()=>{throw new Error('PHYSICAL_FORBIDDEN');}),
}));
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
  vi.resetModules();
  values=new Map();
  writes=0;
  failWrite=false;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{
      if(failWrite&&key===KEY)throw new Error('QUOTA_TEST');
      if(key===KEY)writes++;
      values.set(key,String(value));
    },
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('C1 Dining settlement reliability',()=>{
  it('partial payment keeps the same Hold/table and records actual received cash/change',async()=>{
    const {runtime,hold}=await setup();
    const before=writes;
    const result=await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id)
    );
    expect(result.holdId).toBe(hold.id);
    expect(result.remainingMinor).toBe(4100);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({
      submissionId:'pay-1',
      amountMinor:4100,
      receivedMinor:10000,
      changeMinor:5900,
    });
    expect(result.assignedTable).toBe('T01');
    expect(writes-before).toBe(1);
  });

  it('same submission replay and double-click creates one payment',async()=>{
    const {runtime,hold}=await setup();
    const cmd=await command(runtime,hold.id);
    await Promise.all([
      runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd),
      runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd),
    ]);
    const after=await runtime.readDiningHold(hold.id);
    expect(after.payments).toHaveLength(1);
    expect(after.paidMinor).toBe(4100);
  });

  it('same submission survives module restart and returns the original result',async()=>{
    let {runtime,hold}=await setup();
    const cmd=await command(runtime,hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    vi.resetModules();
    runtime=await boot();
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);
  });

  it('rejects reusing one submission id with changed selection or tender',async()=>{
    const {runtime,hold}=await setup();
    const cmd=await command(runtime,hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:2}],'CASH',cmd))
      .rejects.toThrow('DINING_SUBMISSION_CONFLICT');
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',cmd))
      .rejects.toThrow('DINING_SUBMISSION_CONFLICT');
  });

  it('rejects duplicate line indexes and invalid quantities at the runtime boundary',async()=>{
    const {runtime,hold}=await setup(1);
    await expect(runtime.settleDiningHold(
      hold.id,
      [{lineIndex:0,qty:1},{lineIndex:0,qty:1}],
      'CASH',
      await command(runtime,hold.id),
    )).rejects.toThrow('DINING_DUPLICATE_SELECTION');
    for(const qty of [0,-1,0.5,NaN,Infinity]){
      await expect(runtime.settleDiningHold(
        hold.id,[{lineIndex:0,qty}],'CASH',await command(runtime,hold.id,'qty-'+String(qty))
      )).rejects.toThrow('DINING_SELECTION_INVALID');
    }
  });

  it('rejects stale Checkout revision after another payment changes the Hold',async()=>{
    const {runtime,hold}=await setup(3);
    const stale=await command(runtime,hold.id,'first');
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',stale);
    await expect(runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',{...stale,submissionId:'second'}
    )).rejects.toThrow('DINING_CHECKOUT_STALE');
  });

  it('fresh-reads durable storage before commit and rejects out-of-band price changes',async()=>{
    const {runtime,hold}=await setup();
    const cmd=await command(runtime,hold.id);
    const raw=JSON.parse(values.get(KEY)!);
    raw.holds[0].items[0].unitMinor=5000;
    raw.holds[0].totalMinor=10000;
    values.set(KEY,JSON.stringify(raw));
    await expect(runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',cmd
    )).rejects.toThrow('DINING_CHECKOUT_STALE');
  });

  it('storage failure publishes no memory success and does not release the table',async()=>{
    const {runtime,hold}=await setup(1);
    const cmd=await command(runtime,hold.id);
    const raw=values.get(KEY);
    const subscriber=vi.fn();
    runtime.subscribe(subscriber);
    failWrite=true;
    await expect(runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',cmd
    )).rejects.toThrow('QUOTA_TEST');
    expect(values.get(KEY)).toBe(raw);
    expect(subscriber).not.toHaveBeenCalled();
    failWrite=false;
    const after=await runtime.readDiningHold(hold.id);
    expect(after.payments).toHaveLength(0);
    expect(after.assignedTable).toBe('T01');
  });

  it('full payment archives history and releases the table in the same durable write',async()=>{
    let {runtime,hold}=await setup(1);
    const cmd=await command(runtime,hold.id);
    const before=writes;
    const result=await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',cmd
    );
    expect(writes-before).toBe(1);
    expect(result.archivedAt).toBeTruthy();
    expect(result.assignedTable).toBeUndefined();
    expect(result.lastAssignedTable).toBe('T01');
    expect((await runtime.readDining()).tables.find((row:any)=>row.id==='T01')?.state).toBe('available');
    expect(runtime.holds()).toHaveLength(0);

    vi.resetModules();
    runtime=await boot();
    expect((await runtime.readDiningHistory())[0].holdId).toBe(hold.id);
    expect((await runtime.readDiningHold(hold.id)).payments[0].submissionId).toBe(cmd.submissionId);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',cmd);
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);
  });

  it('supports an ordered waiting Dining Hold without forcing table assignment first',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item('wait',1)],totalMinor:4100});
    const result=await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',await command(runtime,hold.id,'waiting-pay',4100)
    );
    expect(result.paidMinor).toBe(4100);
    expect(result.archivedAt).toBeTruthy();
    expect(result.assignedTable).toBeUndefined();
  });

  it('paid Dining history cannot be erased by clear/remove actions',async()=>{
    const {runtime,hold}=await setup(1);
    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id)
    );
    await runtime.clearDiningHold(hold.id);
    await expect(runtime.removeDiningWait(hold.id)).rejects.toThrow('DINING_HISTORY_PROTECTED');
    expect(()=>runtime.removeHold(hold.id)).toThrow('DINING_HISTORY_PROTECTED');
    expect((await runtime.readDiningHold(hold.id)).paidMinor).toBe(4100);
  });

  it('requires stable submission identity, expected revision and sufficient received cash',async()=>{
    const {runtime,hold}=await setup();
    await expect(runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH'
    )).rejects.toThrow('DINING_CHECKOUT_REFRESH_REQUIRED');
    await expect(runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'CASH',await command(runtime,hold.id,'low',100)
    )).rejects.toThrow('DINING_CASH_INSUFFICIENT');
  });
});
