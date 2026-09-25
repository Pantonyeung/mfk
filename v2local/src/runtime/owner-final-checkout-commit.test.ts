import {beforeEach,describe,expect,it,vi} from 'vitest';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
}

describe('Owner FINAL checkout commit semantics',()=>{
  beforeEach(()=>{vi.resetModules();installStorage();});

  it('dedupes a repeated checkout submission and preserves one formal order identity',async()=>{
    const module=await import('./local-runtime.ts');
    const input={
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway' as const}],
      totalMinor:4100,
      paymentLabel:'CASH',
      sourceLabel:'現場',
      submissionId:'SUBMISSION-001',
    };
    const first=module.localRuntime.createOrder(input);
    const second=module.localRuntime.createOrder(input);
    expect(second.id).toBe(first.id);
    expect(second.display).toBe(first.display);
    expect(module.localRuntime.orders()).toHaveLength(1);
  });

  it('payment correction stays on the same order and appends audit history without creating a new order',async()=>{
    const module=await import('./local-runtime.ts');
    const order=module.localRuntime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,
      paymentLabel:'CASH',
      sourceLabel:'現場',
      submissionId:'SUBMISSION-002',
    });
    const corrected=await module.localRuntime.correctOrderPayment(order.id,'FPS');
    expect(corrected.id).toBe(order.id);
    expect(corrected.display).toBe(order.display);
    expect(corrected.paymentLabel).toBe('FPS');
    expect(corrected.paymentCorrections).toEqual([
      expect.objectContaining({from:'CASH',to:'FPS'}),
    ]);
    expect(module.localRuntime.orders()).toHaveLength(1);
  });

  it('blocks customer electronic acceptance until payment evidence is verified',async()=>{
    const module=await import('./local-runtime.ts');
    const order=module.localRuntime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,
      paymentLabel:'電子支付（待核對）',
      sourceLabel:'自家 App',
      providerRef:'CUSTOMER:PAY-001',
      paymentEvidenceRef:'customer-payment/MF01/evidence/a.png',
      paymentVerificationState:'PENDING',
      initialFulfillmentLabel:'待處理',
      customerName:'陳小姐',
      customerPhone:'91234567',
    });
    await expect(module.localRuntime.acceptOrder(order.id)).rejects.toThrow('PAYMENT_EVIDENCE_NOT_VERIFIED');
    await module.localRuntime.reviewPaymentEvidence?.(order.id,'VERIFIED');
    await expect(module.localRuntime.acceptOrder(order.id)).resolves.toMatchObject({status:'ACCEPTED'});
  });

  it('allows Keeta 稍後處理 at most twice without cancelling or accepting the order',async()=>{
    const module=await import('./local-runtime.ts');
    const order=module.localRuntime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,
      paymentLabel:'KEETA',
      sourceLabel:'Keeta · K001',
      providerRef:'KEETA:1',
      initialFulfillmentLabel:'待處理',
    });
    const once=await module.localRuntime.deferKeetaOrder(order.id);
    expect(once.keetaDeferCount).toBe(1);
    expect(once.fulfillmentLabel).toBe('待處理');
    const twice=await module.localRuntime.deferKeetaOrder(order.id);
    expect(twice.keetaDeferCount).toBe(2);
    expect(twice.fulfillmentLabel).toBe('待處理');
    await expect(module.localRuntime.deferKeetaOrder(order.id)).rejects.toThrow('KEETA_DEFER_LIMIT_REACHED');
  });

  it('admits initial print only once even when the call is repeated',async()=>{
    const module=await import('./local-runtime.ts');
    const order=module.localRuntime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,
      paymentLabel:'CASH',
      sourceLabel:'現場',
      submissionId:'SUBMISSION-003',
    });
    const first=await module.localRuntime.printInitialOrderOutputsOnce(order.id);
    const second=await module.localRuntime.printInitialOrderOutputsOnce(order.id);
    expect(first.orderId).toBe(order.id);
    expect(second.orderId).toBe(order.id);
    expect(module.localRuntime.orders()[0]?.initialPrintAttemptedAt).toBeTruthy();
  });
});
