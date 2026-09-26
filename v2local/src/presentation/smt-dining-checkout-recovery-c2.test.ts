import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

vi.mock('../runtime/native-print.ts',()=>({
  printBytesLan:vi.fn(()=>{throw new Error('PHYSICAL_FORBIDDEN');}),
  printTextLan:vi.fn(()=>{throw new Error('PHYSICAL_FORBIDDEN');}),
}));
vi.mock('../runtime/projection-outbox.ts',()=>({queueOrderProjection:vi.fn(()=>{throw new Error('PROJECTION_FORBIDDEN');})}));
vi.mock('../runtime/keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(()=>{throw new Error('PROVIDER_FORBIDDEN');})}));

const KEY='mfk.v2local.runtime.v1';
let values:Map<string,string>;
const item={id:'rice',name:'飯團',qty:2,unitMinor:4100,serviceMode:'dine-in' as const};

function installStorage(){
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{values.set(key,String(value));},
    removeItem:(key:string)=>{values.delete(key);},
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
}
async function boot(){return (await import('../runtime/local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  installStorage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>vi.unstubAllGlobals());

describe('C2 Dining Checkout reload and recovery',()=>{
  it('restores the same unpaid intent after module restart without creating a payment',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item],totalMinor:8200,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);

    const helper=await import('../features/checkout/dining-checkout-ui-session.ts');
    const request={
      holdId:hold.id,
      submissionId:'DINPAY:'+hold.id+':restore:1',
      expectedRevision:detail.checkoutRevision,
      codeLabel:detail.codeLabel,
      tableLabel:'1 號枱',
      selections:[{lineIndex:0,qty:1}],
      lines:[{lineIndex:0,id:'rice',name:'飯團',qty:1,unitMinor:4100}],
    };
    helper.saveDiningCheckoutUiSession(request);

    vi.resetModules();
    const restoredHelper=await import('../features/checkout/dining-checkout-ui-session.ts');
    const restored=restoredHelper.readDiningCheckoutUiSession();
    runtime=await boot();
    const after=await runtime.readDiningHold(hold.id);

    expect(restored).toEqual(request);
    expect(after.checkoutRevision).toBe(request.expectedRevision);
    expect(after.payments).toHaveLength(0);
    expect(after.remainingMinor).toBe(8200);
  });

  it('after committed payment reload reads the original result and replay cannot double collect',async()=>{
    let runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item],totalMinor:8200,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    const request={
      holdId:hold.id,
      submissionId:'DINPAY:'+hold.id+':paid:1',
      expectedRevision:detail.checkoutRevision,
      codeLabel:detail.codeLabel,
      tableLabel:'1 號枱',
      selections:[{lineIndex:0,qty:1}],
      lines:[{lineIndex:0,id:'rice',name:'飯團',qty:1,unitMinor:4100}],
    };
    const helper=await import('../features/checkout/dining-checkout-ui-session.ts');
    helper.saveDiningCheckoutUiSession(request);
    await runtime.settleDiningHold(
      hold.id,
      request.selections,
      'CASH',
      {submissionId:request.submissionId,expectedRevision:request.expectedRevision,receivedMinor:5000},
    );

    vi.resetModules();
    runtime=await boot();
    const restoredHelper=await import('../features/checkout/dining-checkout-ui-session.ts');
    const restored=restoredHelper.readDiningCheckoutUiSession()!;
    const after=await runtime.readDiningHold(hold.id);
    const payment=after.payments.find((row:any)=>row.submissionId===restored.submissionId);

    expect(payment).toMatchObject({amountMinor:4100,receivedMinor:5000,changeMinor:900});
    expect(after.paidMinor).toBe(4100);

    await runtime.settleDiningHold(
      hold.id,
      restored.selections,
      'CASH',
      {submissionId:restored.submissionId,expectedRevision:restored.expectedRevision,receivedMinor:5000},
    );
    expect((await runtime.readDiningHold(hold.id)).payments).toHaveLength(1);
  });

  it('recognizes an unpaid recovered intent as stale after another settlement changes the Hold',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({kind:'dining',items:[item],totalMinor:8200,partySize:2});
    await runtime.assignDiningTable(hold.id,'T01');
    const detail=await runtime.readDiningHold(hold.id);
    const request={
      holdId:hold.id,
      submissionId:'DINPAY:'+hold.id+':stale:1',
      expectedRevision:detail.checkoutRevision,
      codeLabel:detail.codeLabel,
      tableLabel:'1 號枱',
      selections:[{lineIndex:0,qty:1}],
      lines:[{lineIndex:0,id:'rice',name:'飯團',qty:1,unitMinor:4100}],
    };
    const helper=await import('../features/checkout/dining-checkout-ui-session.ts');
    helper.saveDiningCheckoutUiSession(request);

    await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'other-payment',expectedRevision:detail.checkoutRevision},
    );
    const after=await runtime.readDiningHold(hold.id);
    expect(after.payments.find((row:any)=>row.submissionId===request.submissionId)).toBeUndefined();
    expect(after.checkoutRevision).not.toBe(request.expectedRevision);
  });

  it('wires startup restore, committed readback, stale failure and intentional clear in the real App',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

    expect(app).toContain("useState<DiningCheckoutRequest|null>(()=>readDiningCheckoutUiSession())");
    expect(app).toContain("useState<CartLine[]>(()=>diningCheckout?diningCheckoutCart(diningCheckout):[])");
    expect(app).toContain('saveDiningCheckoutUiSession(request)');
    expect(app).toContain('const prior=detail.payments.find(payment=>payment.submissionId===diningCheckout.submissionId)');
    expect(app).toContain("setPrintStatus('堂食付款已存在 · 已由本機記錄恢復，冇重複提交')");
    expect(app).toContain("detail.checkoutRevision!==diningCheckout.expectedRevision");
    expect(app).toContain('堂食內容已經更新；請返回堂食重新選擇未結項目，系統冇收款。');
    expect(app).toContain('clearDiningCheckoutUiSession();setDiningCheckout(null);');
  });

  it('keeps the UI session non-authoritative: recovery always reads runtime state before declaring success',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
    const helper=fs.readFileSync(path.join(root,'features/checkout/dining-checkout-ui-session.ts'),'utf8');

    expect(app).toContain('localRuntime.readDiningHold(diningCheckout.holdId)');
    expect(app).toContain('localRuntime.settleDiningHold(');
    expect(helper).not.toContain('paymentLabel');
    expect(helper).not.toContain('refund');
    expect(helper).not.toContain('createOrder');
  });
});
