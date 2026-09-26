import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLocalReport} from '../runtime/local-operations.ts';

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
}

async function installStaff(){
  const {createMfkAdminConfigEnvelope}=await import('../../../contracts/admin-config-sync-v1.ts');
  const {projectStaffForRuntime}=await import('../../../contracts/staff-auth-v1.ts');
  const {applyAdminConfigEnvelope}=await import('../runtime/admin-config-sync.ts');
  const staffAuth=await projectStaffForRuntime([{
    id:'staff-1',name:'店員甲',role:'STAFF',pin:'2468',scope:'STORE',adminLogin:false,active:true,
    permissions:['ORDER_REVIEW','ORDER_CORRECTION'],
  }]);
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:1,
    publishedAt:'2026-09-26T09:00:00.000Z',
    adminFingerprint:'fnv1a32:b2a',
    snapshot:{catalog:{categories:[],products:[],combos:[],comboPools:[]},staffAuth},
  }));
  const auth=await import('../runtime/staff-auth.ts');
  expect((await auth.loginStaff('staff-1','2468')).ok).toBe(true);
}

describe('SMT B2a same-day item-linked refund',()=>{
  beforeEach(()=>{
    installStorage();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
  });
  afterEach(()=>{vi.useRealTimers();});

  it('records exact item, quantity reference, partial amount and an explicitly different refund method',async()=>{
    await installStaff();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[
        {id:'line-a',name:'A 飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'},
        {id:'line-b',name:'小食',qty:2,unitMinor:500,serviceMode:'takeaway'},
      ],
      totalMinor:5100,
      paymentLabel:'CASH',
      sourceLabel:'現場',
    });

    const refunded=await localRuntime.refundOrder(order.id,{
      lineId:'line-b',
      quantity:1,
      amountMinor:300,
      method:'FPS',
      note:'其中一件部分退款',
    });

    expect(refunded.id).toBe(order.id);
    expect(refunded.display).toBe(order.display);
    expect(refunded.paymentLabel).toBe('CASH');
    expect(refunded.fulfillmentLabel).toBe(order.fulfillmentLabel);
    expect(refunded.refunds).toHaveLength(1);
    expect(refunded.refunds?.[0]).toMatchObject({
      kind:'PARTIAL',
      amountMinor:300,
      method:'FPS',
      note:'其中一件部分退款',
      lines:[{lineId:'line-b',itemName:'小食',quantity:1,amountMinor:300}],
    });
  });

  it('does not let item-linked refunds exceed the original line amount',async()=>{
    await installStaff();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await localRuntime.refundOrder(order.id,{lineId:'line-a',quantity:1,amountMinor:3000,method:'CASH'});
    await expect(localRuntime.refundOrder(order.id,{lineId:'line-a',quantity:1,amountMinor:1200,method:'CASH'}))
      .rejects.toThrow('REFUND_EXCEEDS_LINE_REMAINING');
  });

  it('blocks SMT refund across Business Day and leaves it for Admin',async()=>{
    await installStaff();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    vi.setSystemTime(new Date('2026-09-27T10:00:00.000Z'));
    await expect(localRuntime.refundOrder(order.id,{lineId:'line-a',quantity:1,amountMinor:4100,method:'CASH'}))
      .rejects.toThrow('REFUND_ADMIN_REQUIRED_CLOSED_DAY');
    expect(localRuntime.orders()[0]?.refunds).toBeUndefined();
  });

  it('makes same-day reporting refund-aware and only changes drawer expectation for CASH refund method',async()=>{
    await installStaff();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const cash=localRuntime.createOrder({
      items:[{id:'cash-line',name:'飯團',qty:1,unitMinor:5000,serviceMode:'takeaway'}],
      totalMinor:5000,paymentLabel:'CASH',sourceLabel:'現場',
    });
    const fps=localRuntime.createOrder({
      items:[{id:'fps-line',name:'便當',qty:1,unitMinor:4000,serviceMode:'takeaway'}],
      totalMinor:4000,paymentLabel:'FPS',sourceLabel:'現場',
    });
    await localRuntime.refundOrder(cash.id,{lineId:'cash-line',quantity:1,amountMinor:1000,method:'CASH'});
    await localRuntime.refundOrder(fps.id,{lineId:'fps-line',quantity:1,amountMinor:500,method:'PAYME'});

    const report=buildLocalReport(localRuntime.orders(),{
      now:Date.now(),
      businessStartHour:5,
      businessStartMinute:0,
    });
    expect(report.grossSalesMinor).toBe(9000);
    expect(report.refundMinor).toBe(1500);
    expect(report.netSalesMinor).toBe(7500);
    expect(report.cashSalesMinor).toBe(5000);
    expect(report.cashRefundMinor).toBe(1000);
    expect(report.cashNetMinor).toBe(4000);
  });

  it('keeps Cancel and Refund as independent explicit actions',async()=>{
    await installStaff();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await localRuntime.cancelOrder(order.id,'客人取消');
    expect(localRuntime.orders()[0]?.refunds).toBeUndefined();
    await localRuntime.refundOrder(order.id,{lineId:'line-a',quantity:1,amountMinor:4100,method:'CASH',note:'確認退款'});
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('已取消');
    expect(localRuntime.orders()[0]?.refunds).toHaveLength(1);
  });

  it('persists refund history across restart and exposes no print or drawer side effect',async()=>{
    await installStaff();
    const first=await import('../runtime/local-runtime.ts');
    first.localRuntime.clear();
    const order=first.localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await first.localRuntime.refundOrder(order.id,{lineId:'line-a',quantity:1,amountMinor:500,method:'FPS'});
    vi.resetModules();
    const restarted=await import('../runtime/local-runtime.ts');
    expect(restarted.localRuntime.orders().find(row=>row.id===order.id)?.refunds?.[0]).toMatchObject({
      amountMinor:500,method:'FPS',lines:[{lineId:'line-a'}],
    });

    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    const start=runtime.indexOf('  async refundOrder(orderId,input){');
    const end=runtime.indexOf('  async readOrderReprintOptions(orderId){',start);
    const block=runtime.slice(start,end);
    expect(block).toContain("hasStaffPermission('ORDER_CORRECTION')");
    expect(block).toContain('REFUND_ADMIN_REQUIRED_CLOSED_DAY');
    expect(block).not.toContain('dispatchOrderOutputs');
    expect(block).not.toContain('kickDrawer');
    expect(block).not.toContain('cancelOrder(');
  });

  it('keeps platform refund on the provider after-sale path',async()=>{
    await installStaff();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'FPS',sourceLabel:'Keeta',
    });
    await expect(localRuntime.refundOrder(order.id,{lineId:'line-a',quantity:1,amountMinor:4100,method:'FPS'}))
      .rejects.toThrow('PROVIDER_REFUND_USE_AFTERSALE');
  });
});
