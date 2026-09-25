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
