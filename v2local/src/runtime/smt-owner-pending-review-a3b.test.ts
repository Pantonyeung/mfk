import {beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('./staff-auth.ts',()=>({
  readActiveStaffSession:()=>null,
  hasStaffPermission:()=>false,
  staffAuthRequired:()=>false,
}));
vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
const mirrorKeetaOrderCommand=vi.fn(async(order:any,action:string)=>({
  provider:'KEETA',
  action,
  state:String(order.providerRef||'').startsWith('KEETA:')?'SYNCED':'NOT_APPLICABLE',
}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand}));

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
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  Object.defineProperty(globalThis,'URL',{configurable:true,value:{
    createObjectURL:vi.fn(()=> 'blob:test'),
    revokeObjectURL:vi.fn(),
  }});
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  installStorage();
});

describe('SMT consolidation A3B — pending review / accept runtime',()=>{
  it('keeps Keeta defer durable, pending-only and capped at two without provider mutation',async()=>{
    let runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'meal',name:'套餐',qty:1,unitMinor:5900}],
      totalMinor:5900,
      paymentLabel:'KEETA',
      sourceLabel:'Keeta · K001',
      providerRef:'KEETA:provider-1',
      providerPickupCode:'K001',
      initialFulfillmentLabel:'待處理',
    });

    expect(await runtime.deferKeetaOrder(order.id)).toMatchObject({deferCount:1,state:'PENDING'});
    expect(await runtime.deferKeetaOrder(order.id)).toMatchObject({deferCount:2,state:'PENDING'});
    expect(mirrorKeetaOrderCommand).not.toHaveBeenCalled();

    vi.resetModules();
    runtime=await boot();
    const restored=runtime.orders().find((row:any)=>row.id===order.id);
    expect(restored.fulfillmentLabel).toBe('待處理');
    expect(restored.keetaDeferCount).toBe(2);
    await expect(runtime.deferKeetaOrder(order.id)).rejects.toThrow('KEETA_DEFER_LIMIT_REACHED');
  });

  it('fails closed on Customer electronic accept until payment evidence is VERIFIED',async()=>{
    const runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'bento',name:'肉燥便當',qty:1,unitMinor:4800}],
      totalMinor:4800,
      paymentLabel:'FPS（待核對）',
      sourceLabel:'自家 App',
      providerRef:'CUSTOMER:submission-1',
      paymentEvidenceRef:'evidence-1',
      paymentVerificationState:'PENDING',
      customerName:'陳小姐',
      customerPhone:'91234567',
      initialFulfillmentLabel:'待處理',
    });

    await expect(runtime.acceptOrder(order.id)).rejects.toThrow('PAYMENT_EVIDENCE_VERIFICATION_REQUIRED');
    expect(runtime.orders().find((row:any)=>row.id===order.id).fulfillmentLabel).toBe('待處理');

    await runtime.reviewPaymentEvidence(order.id,'VERIFIED');
    const accepted=await runtime.acceptOrder(order.id);
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.provider.state).toBe('NOT_APPLICABLE');
    expect(runtime.orders().find((row:any)=>row.id===order.id)).toMatchObject({
      fulfillmentLabel:'進行中',
      paymentVerificationState:'VERIFIED',
      customerName:'陳小姐',
      customerPhone:'91234567',
    });
  });

  it('does not allow defer on Customer or already accepted Keeta orders',async()=>{
    const runtime=await boot();
    const customer=runtime.createOrder({
      items:[{id:'meal',name:'套餐',qty:1,unitMinor:5900}],
      totalMinor:5900,paymentLabel:'到店付款',sourceLabel:'自家 App',
      providerRef:'CUSTOMER:1',initialFulfillmentLabel:'待處理',
    });
    await expect(runtime.deferKeetaOrder(customer.id)).rejects.toThrow('KEETA_DEFER_ORDER_REQUIRED');

    const keeta=runtime.createOrder({
      items:[{id:'meal',name:'套餐',qty:1,unitMinor:5900}],
      totalMinor:5900,paymentLabel:'KEETA',sourceLabel:'Keeta · K002',
      providerRef:'KEETA:provider-2',initialFulfillmentLabel:'待處理',
    });
    await runtime.acceptOrder(keeta.id);
    await expect(runtime.deferKeetaOrder(keeta.id)).rejects.toThrow('KEETA_DEFER_PENDING_ONLY');
  });
});
