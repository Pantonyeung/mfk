import {beforeEach,describe,expect,it,vi} from 'vitest';

let session:any={staffId:'staff-1',displayName:'店員甲',role:'STAFF',scope:'STORE',permissions:['PRICE_OVERRIDE'],signedInAt:'2026-09-27T01:00:00Z'};

vi.mock('./staff-auth.ts',()=>({
  readActiveStaffSession:()=>session,
  hasStaffPermission:(permission:string)=>Boolean(session?.permissions?.includes(permission)),
  staffAuthRequired:()=>true,
}));
vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({ok:true,providerStatus:'ACCEPTED'}))}));

let values:Map<string,string>;
function installStorage(){
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  installStorage();
  session={staffId:'staff-1',displayName:'店員甲',role:'STAFF',scope:'STORE',permissions:['PRICE_OVERRIDE'],signedInAt:'2026-09-27T01:00:00Z'};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
});

describe('SMT consolidation A1 — Owner-approved Dining manual price override',()=>{
  it('allows permissioned STAFF to set a negative deal price with blank reason and preserve signed truth',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],
      totalMinor:4100,
      partySize:2,
    });
    const before=await runtime.readDiningHold(hold.id);
    const after=await runtime.overrideDiningLinePrice(hold.id,0,-500,'',before.checkoutRevision);

    expect(after.totalMinor).toBe(-500);
    expect(after.remainingMinor).toBe(-500);
    expect(after.priceOverrides.at(-1)).toMatchObject({
      sequence:1,
      originalUnitMinor:4100,
      effectiveUnitMinor:-500,
      deltaMinor:-4600,
      reason:'',
      staffId:'staff-1',
      staffName:'店員甲',
      source:'MANUAL_OVERRIDE',
      permission:'PRICE_OVERRIDE',
    });
  });

  it('never allows role name to bypass missing Admin PRICE_OVERRIDE permission',async()=>{
    session={...session,role:'OWNER',permissions:[]};
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    const before=await runtime.readDiningHold(hold.id);
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'',before.checkoutRevision))
      .rejects.toThrow('DINING_PRICE_OVERRIDE_FORBIDDEN');
  });

  it('requires an active staff session even if no role shortcut exists',async()=>{
    session=null;
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    const before=await runtime.readDiningHold(hold.id);
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'',before.checkoutRevision))
      .rejects.toThrow('DINING_PRICE_OVERRIDE_AUTH_REQUIRED');
  });

  it('rejects stale revision and leaves the newer manual deal untouched',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    const first=await runtime.readDiningHold(hold.id);
    await runtime.overrideDiningLinePrice(hold.id,0,4000,'第一次',first.checkoutRevision);
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'第二次',first.checkoutRevision))
      .rejects.toThrow('DINING_PRICE_OVERRIDE_STALE');
    expect((await runtime.readDiningHold(hold.id)).lines[0].unitMinor).toBe(4000);
  });

  it('keeps immutable chronological override history and same Formal Order',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    await runtime.admitDiningHold(hold.id);
    let detail=await runtime.readDiningHold(hold.id);
    const formalOrderId=detail.formalOrderId;

    detail=await runtime.overrideDiningLinePrice(hold.id,0,4000,'第一次',detail.checkoutRevision);
    detail=await runtime.overrideDiningLinePrice(hold.id,0,3900,'',detail.checkoutRevision);

    expect(detail.formalOrderId).toBe(formalOrderId);
    expect(detail.priceOverrides).toHaveLength(2);
    expect(detail.priceOverrides[0]).toMatchObject({sequence:1,originalUnitMinor:4100,effectiveUnitMinor:4000,reason:'第一次'});
    expect(detail.priceOverrides[1]).toMatchObject({sequence:2,originalUnitMinor:4000,effectiveUnitMinor:3900,reason:''});
    const order=runtime.orders().find((row:any)=>row.id===formalOrderId);
    expect(order).toMatchObject({id:formalOrderId,totalMinor:3900,outstandingMinor:3900});
    expect(order.items[0].unitMinor).toBe(3900);
  });

  it('same effective price is a no-op with no fake audit row and unchanged revision',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    const detail=await runtime.readDiningHold(hold.id);
    const after=await runtime.overrideDiningLinePrice(hold.id,0,4100,'無變化',detail.checkoutRevision);
    expect(after.priceOverrides).toHaveLength(0);
    expect(after.checkoutRevision).toBe(detail.checkoutRevision);
  });

  it('blocks retroactive price override after any payment and blocks ordinary checkout for a negative balance',async()=>{
    const runtime=await boot();
    const paidHold=runtime.createHold({kind:'dining',items:[{id:'paid',name:'已付款商品',qty:2,unitMinor:4100}],totalMinor:8200});
    await runtime.admitDiningHold(paidHold.id);
    let paid=await runtime.readDiningHold(paidHold.id);
    await runtime.settleDiningHold(paidHold.id,[{lineIndex:0,qty:1}],'FPS',{
      submissionId:'PAY:A1:1',
      expectedRevision:paid.checkoutRevision,
    });
    paid=await runtime.readDiningHold(paidHold.id);
    await expect(runtime.overrideDiningLinePrice(paidHold.id,0,3900,'',paid.checkoutRevision))
      .rejects.toThrow('DINING_PRICE_OVERRIDE_AFTER_PAYMENT_FORBIDDEN');

    const negativeHold=runtime.createHold({kind:'dining',items:[{id:'negative',name:'負數成交商品',qty:1,unitMinor:4100}],totalMinor:4100});
    let negative=await runtime.readDiningHold(negativeHold.id);
    negative=await runtime.overrideDiningLinePrice(negativeHold.id,0,-500,'',negative.checkoutRevision);
    await runtime.admitDiningHold(negativeHold.id);
    negative=await runtime.readDiningHold(negativeHold.id);
    expect(negative.formalOrderId).toBeTruthy();
    expect(negative.remainingMinor).toBe(-500);
    await expect(runtime.settleDiningHold(negativeHold.id,[{lineIndex:0,qty:1}],'CASH',{
      submissionId:'PAY:A1:NEG',
      expectedRevision:negative.checkoutRevision,
      receivedMinor:0,
    })).rejects.toThrow('DINING_NEGATIVE_BALANCE_REQUIRES_ADJUSTMENT');
  });
});