import {beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ordersSource=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');

describe('Owner FINAL Orders / fulfillment',()=>{
  beforeEach(()=>{vi.resetModules();installStorage();});

  it('keeps READY reversible and completes pickup only from READY',async()=>{
    const module=await import('./local-runtime.ts');
    const order=module.localRuntime.createOrder({
      items:[{id:'p1',name:'商品',qty:1,unitMinor:1000,serviceMode:'takeaway'}],
      totalMinor:1000,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await module.localRuntime.markOrderReady(order.id);
    expect(module.localRuntime.orders()[0]?.fulfillmentLabel).toBe('可取餐');

    await module.localRuntime.markOrderUnready(order.id);
    const back=module.localRuntime.orders()[0]!;
    expect(back.fulfillmentLabel).toBe('進行中');
    expect(back.etaReadyAt).toBeUndefined();

    await module.localRuntime.markOrderReady(order.id);
    await module.localRuntime.markOrderCompleted(order.id);
    expect(module.localRuntime.orders()[0]?.fulfillmentLabel).toBe('已完成');
  });

  it('uses three Owner source lanes and source-first then payment filters',()=>{
    expect(ordersSource).toContain("label:'現場／直接來源'");
    expect(ordersSource).toContain("label:'自家平台'");
    expect(ordersSource).toContain("label:'第三方平台'");
    expect(ordersSource).toContain('order-source-filter');
    expect(ordersSource.indexOf('order-source-filter')).toBeLessThan(ordersSource.indexOf('order-payment-bar'));
  });

  it('maps phone/WhatsApp to direct source and MoreFun App to owned platform',()=>{
    expect(ordersSource).toContain("value.startsWith('現場')||value.startsWith('電話')||value.startsWith('WhatsApp')");
    expect(ordersSource).toContain("value.startsWith('磨飯 App')||value.startsWith('自家 App')");
  });

  it('allows any authenticated SMT operator to use order functions and exposes reversible fulfillment controls',()=>{
    expect(ordersSource).toContain('Boolean(activeStaff)||!staffAuthRequired()');
    expect(ordersSource).not.toContain("hasStaffPermission('ORDER_REVIEW')");
    expect(ordersSource).not.toContain("hasStaffPermission('ORDER_CORRECTION')");
    expect(ordersSource).toContain('退回未完成');
    expect(ordersSource).toContain('已取餐');
    expect(ordersSource).toContain('可取餐');
  });

  it('shows customer and external identifiers on order cards when available',()=>{
    expect(ordersSource).toContain('order.customerName');
    expect(ordersSource).toContain('order.externalOrderNo');
    expect(ordersSource).toContain('order.pickupCode');
  });
});
