import {beforeEach,describe,expect,it,vi} from 'vitest';

let session:any={staffId:'staff-1',displayName:'店員甲',role:'STAFF',scope:'STORE',permissions:['PRICE_OVERRIDE'],signedInAt:'2026-09-26T00:00:00Z'};
vi.mock('./staff-auth.ts',()=>({
  readActiveStaffSession:()=>session,
  hasStaffPermission:(permission:string)=>Boolean(session?.permissions?.includes(permission)),
}));
vi.mock('./native-print.ts',()=>({printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),printTextLan:vi.fn(async()=>({ok:true,code:'SENT'}))}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn()}));

const KEY='mfk.v2local.runtime.v1';
let values:Map<string,string>;
function storage(){
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,String(v)),removeItem:(k:string)=>values.delete(k),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size},
  }});
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{vi.resetModules();storage();session={staffId:'staff-1',displayName:'店員甲',role:'STAFF',scope:'STORE',permissions:['PRICE_OVERRIDE'],signedInAt:'2026-09-26T00:00:00Z'};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});});

describe('Dining manual price override authority',()=>{
  it('Admin permission allows ordinary STAFF to set a negative deal price with blank reason',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
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
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'')).rejects.toThrow('DINING_PRICE_OVERRIDE_FORBIDDEN');
  });

  it('stale override revision cannot overwrite a newer manual deal',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    const first=await runtime.readDiningHold(hold.id);
    await runtime.overrideDiningLinePrice(hold.id,0,4000,'第一次',first.checkoutRevision);
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'第二次',first.checkoutRevision)).rejects.toThrow('DINING_PRICE_OVERRIDE_STALE');
    expect((await runtime.readDiningHold(hold.id)).lines[0].unitMinor).toBe(4000);
  });

  it('price override is blocked once any payment exists',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:4100});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    await runtime.settleDiningHold(hold.id,[{lineIndex:0,qty:1}],'FPS',{submissionId:'paid',expectedRevision:detail.checkoutRevision,receivedMinor:4100});
    await expect(runtime.overrideDiningLinePrice(hold.id,0,3900,'')).rejects.toThrow('DINING_PRICE_OVERRIDE_AFTER_PAYMENT_FORBIDDEN');
  });
});
