import {beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {etaMinutesForActiveCount,normalizeSmtEtaRules} from './admin-operational-config.ts';

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
const appSource=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

describe('Owner FINAL ETA / ready countdown',()=>{
  beforeEach(()=>{vi.resetModules();installStorage();});

  it('selects ETA from Admin load thresholds without hardcoding one busy level',()=>{
    const rules=normalizeSmtEtaRules([
      {minActiveOrders:0,minutes:10},
      {minActiveOrders:5,minutes:20},
      {minActiveOrders:10,minutes:35},
    ],15);
    expect(etaMinutesForActiveCount(1,rules)).toBe(10);
    expect(etaMinutesForActiveCount(5,rules)).toBe(20);
    expect(etaMinutesForActiveCount(12,rules)).toBe(35);
  });

  it('falls back to the current fulfillment minutes when Admin has no ETA table',()=>{
    expect(normalizeSmtEtaRules([],18)).toEqual([{minActiveOrders:0,minutes:18}]);
  });

  it('starts ETA only when an order formally enters preparation and persists the deadline',async()=>{
    const module=await import('./local-runtime.ts');
    const direct=module.localRuntime.createOrder({
      items:[{id:'p1',name:'商品',qty:1,unitMinor:1000,serviceMode:'takeaway'}],
      totalMinor:1000,paymentLabel:'CASH',sourceLabel:'現場',
    });
    expect(direct.fulfillmentLabel).toBe('進行中');
    expect(direct.etaMinutes).toBeGreaterThan(0);
    expect(Date.parse(direct.etaReadyAt??'')).toBeGreaterThan(Date.parse(direct.createdAt));

    const pending=module.localRuntime.createOrder({
      items:[{id:'p2',name:'平台商品',qty:1,unitMinor:1200,serviceMode:'takeaway'}],
      totalMinor:1200,paymentLabel:'到店付款',sourceLabel:'自家 App',
      providerRef:'CUSTOMER:ETA-1',initialFulfillmentLabel:'待處理',
    });
    expect(pending.etaReadyAt).toBeUndefined();
    await module.localRuntime.acceptOrder(pending.id);
    const accepted=module.localRuntime.orders().find(row=>row.id===pending.id)!;
    expect(accepted.fulfillmentLabel).toBe('進行中');
    expect(accepted.etaMinutes).toBeGreaterThan(0);
    expect(accepted.etaReadyAt).toBeTruthy();
  });

  it('has a restart-safe UI loop that advances expired preparation orders to READY',()=>{
    expect(appSource).toContain("order.fulfillmentLabel!=='進行中'||!order.etaReadyAt");
    expect(appSource).toContain('localRuntime.markOrderReady?.(order.id)');
    expect(appSource).toContain('window.setInterval(tick,10_000)');
  });
});
