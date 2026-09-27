import {beforeEach,describe,expect,it,vi} from 'vitest';

let session:any={staffId:'staff-1',displayName:'店員甲',role:'STAFF',scope:'STORE',permissions:['PRICE_OVERRIDE'],signedInAt:'2026-09-27T00:00:00Z'};
vi.mock('./staff-auth.ts',()=>({
  readActiveStaffSession:()=>session,
  hasStaffPermission:(permission:string)=>Boolean(session?.permissions?.includes(permission)),
  staffAuthRequired:()=>false,
}));
vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({state:'SYNCED'}))}));

let values:Map<string,string>;
function storage(){
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size},
  }});
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  storage();
  session={staffId:'staff-1',displayName:'店員甲',role:'STAFF',scope:'STORE',permissions:['PRICE_OVERRIDE'],signedInAt:'2026-09-27T00:00:00Z'};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
});

describe('SMT Owner consolidation: Dining manual price override',()=>{
  it('Admin permission allows ordinary STAFF to set a negative deal price with blank reason',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    const before=await runtime.readDiningHold(hold.id);
    const after=await runtime.overrideDiningLinePrice(hold.id,0,-500,'',before.checkoutRevision);
    expect(after.totalMinor).toBe(-500);
    expect(after.remainingMinor).toBe(-500);
    expect(after.priceOverrides.at(-1)).toMatchObject({
      originalUnitMinor:4100,effectiveUnitMinor:-500,deltaMinor:-4600,reason:'',
      staffId:'staff-1',staffName:'店員甲',source:'MANUAL_OVERRIDE',permission:'PRICE_OVERRIDE',
    });
  });

  it('role alone never bypasses missing Admin permission',async()=>{
    session={...session,role:'OWNER',permissions:[]};
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'')).rejects.toThrow('DINING_PRICE_OVERRIDE_FORBIDDEN');
  });

  it('stale revision cannot overwrite a newer manual deal',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    const first=await runtime.readDiningHold(hold.id);
    await runtime.overrideDiningLinePrice(hold.id,0,4000,'第一次',first.checkoutRevision);
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'第二次',first.checkoutRevision))
      .rejects.toThrow('DINING_PRICE_OVERRIDE_STALE');
    expect((await runtime.readDiningHold(hold.id)).lines[0].unitMinor).toBe(4000);
  });

  it('repeated overrides form an immutable chronological chain and same-price submit is a no-op',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    let detail=await runtime.readDiningHold(hold.id);
    detail=await runtime.overrideDiningLinePrice(hold.id,0,4000,'第一次',detail.checkoutRevision);
    detail=await runtime.overrideDiningLinePrice(hold.id,0,3900,'',detail.checkoutRevision);
    expect(detail.priceOverrides).toHaveLength(2);
    expect(detail.priceOverrides[0]).toMatchObject({sequence:1,originalUnitMinor:4100,effectiveUnitMinor:4000,reason:'第一次'});
    expect(detail.priceOverrides[1]).toMatchObject({sequence:2,originalUnitMinor:4000,effectiveUnitMinor:3900,reason:''});
    const noOp=await runtime.overrideDiningLinePrice(hold.id,0,3900,'無變化',detail.checkoutRevision);
    expect(noOp.priceOverrides).toHaveLength(2);
    expect(noOp.checkoutRevision).toBe(detail.checkoutRevision);
  });

  it('updates the SAME Formal Order and never creates another order',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    const before=await runtime.readDiningHold(hold.id);
    const orderId=before.formalOrderId;
    const display=before.formalOrderDisplay;
    const after=await runtime.overrideDiningLinePrice(hold.id,0,3900,'議價',before.checkoutRevision);
    expect(after.formalOrderId).toBe(orderId);
    expect(after.formalOrderDisplay).toBe(display);
    expect(runtime.orders()).toHaveLength(1);
    expect(runtime.orders()[0]).toMatchObject({id:orderId,display,totalMinor:3900,outstandingMinor:3900});
  });

  it('blocks ordinary collection for a negative balance rather than inventing payout/refund semantics',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    let detail=await runtime.readDiningHold(hold.id);
    detail=await runtime.overrideDiningLinePrice(hold.id,0,-500,'特別處理',detail.checkoutRevision);
    await expect(runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'CASH',{
      submissionId:'NEGATIVE-CHECKOUT',
      expectedRevision:detail.checkoutRevision,
      receivedMinor:0,
    })).rejects.toThrow('DINING_NEGATIVE_BALANCE_REQUIRES_ADJUSTMENT');
  });

  it('price override is blocked once any payment exists',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{
      submissionId:'PAID',
      expectedRevision:detail.checkoutRevision,
    });
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'')).rejects.toThrow('DINING_PRICE_OVERRIDE_AFTER_PAYMENT_FORBIDDEN');
  });
});