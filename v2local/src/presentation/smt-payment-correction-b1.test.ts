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
}

async function installStaff(revision:number,permissions:string[]){
  const {createMfkAdminConfigEnvelope}=await import('../../../contracts/admin-config-sync-v1.ts');
  const {projectStaffForRuntime}=await import('../../../contracts/staff-auth-v1.ts');
  const {applyAdminConfigEnvelope}=await import('../runtime/admin-config-sync.ts');
  const staffAuth=await projectStaffForRuntime([{
    id:'staff-1',name:'店員甲',role:'STAFF',pin:'2468',scope:'STORE',adminLogin:false,active:true,permissions,
  }]);
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision,
    publishedAt:'2026-09-26T09:'+String(revision).padStart(2,'0')+':00.000Z',
    adminFingerprint:'fnv1a32:b1-'+String(revision),
    snapshot:{catalog:{categories:[],products:[],combos:[],comboPools:[]},staffAuth},
  }));
  const auth=await import('../runtime/staff-auth.ts');
  expect((await auth.loginStaff('staff-1','2468')).ok).toBe(true);
}

describe('SMT B1 payment correction',()=>{
  beforeEach(()=>{installStorage();vi.resetModules();});

  it('keeps SAME Order/Display, appends full tender history, and makes the latest tender effective',async()=>{
    await installStaff(1,['ORDER_REVIEW','ORDER_CORRECTION']);
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const original=localRuntime.createOrder({
      items:[{id:'p1',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,
      paymentLabel:'CASH',
      sourceLabel:'現場',
    });
    localStorage.setItem('mfk.v2local.print-diagnostic.v1','{"sentinel":true}');

    const fps=await localRuntime.correctOrderPayment(original.id,'FPS');
    const payme=await localRuntime.correctOrderPayment(original.id,'PAYME');

    expect(fps.id).toBe(original.id);
    expect(payme.id).toBe(original.id);
    expect(payme.display).toBe(original.display);
    expect(localRuntime.orders()).toHaveLength(1);
    expect(payme.paymentLabel).toBe('PAYME');
    expect(payme.paymentCorrections?.map(row=>[row.id,row.from,row.to])).toEqual([
      ['PC-'+original.id+'-001','CASH','FPS'],
      ['PC-'+original.id+'-002','FPS','PAYME'],
    ]);
    expect(localStorage.getItem('mfk.v2local.print-diagnostic.v1')).toBe('{"sentinel":true}');

    const readback=await localRuntime.readOrders(original.id);
    expect(readback.selectedOrder?.paymentLabel).toBe('PAYME');
    expect(readback.selectedOrder?.paymentCorrections?.map(row=>[row.from,row.to])).toEqual([
      ['CASH','FPS'],['FPS','PAYME'],
    ]);

    const replay=await localRuntime.correctOrderPayment(original.id,'PAYME');
    expect(replay.paymentCorrections).toHaveLength(2);
    expect(localRuntime.orders()).toHaveLength(1);
  });

  it('fails closed at the runtime mutation boundary without ORDER_CORRECTION permission',async()=>{
    await installStaff(1,['ORDER_REVIEW']);
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'p1',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await expect(localRuntime.correctOrderPayment(order.id,'FPS')).rejects.toThrow('ORDER_CORRECTION_PERMISSION_REQUIRED');
    expect(localRuntime.orders()[0]?.paymentLabel).toBe('CASH');
    expect(localRuntime.orders()[0]?.paymentCorrections).toBeUndefined();
  });

  it('survives module restart with the effective tender and correction history intact',async()=>{
    await installStaff(1,['ORDER_REVIEW','ORDER_CORRECTION']);
    const first=await import('../runtime/local-runtime.ts');
    first.localRuntime.clear();
    const order=first.localRuntime.createOrder({
      items:[{id:'p1',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await first.localRuntime.correctOrderPayment(order.id,'FPS');

    vi.resetModules();
    const restarted=await import('../runtime/local-runtime.ts');
    const persisted=restarted.localRuntime.orders().find(row=>row.id===order.id);
    expect(persisted?.display).toBe(order.display);
    expect(persisted?.paymentLabel).toBe('FPS');
    expect(persisted?.paymentCorrections?.map(row=>[row.from,row.to])).toEqual([['CASH','FPS']]);
  });

  it('contains no Order creation, print dispatch, reprint or drawer side effect in the correction method',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    const start=runtime.indexOf('  async correctOrderPayment(orderId,paymentLabel){');
    const end=runtime.indexOf('  async readOrderReprintOptions(orderId){',start);
    const block=runtime.slice(start,end);
    expect(start).toBeGreaterThan(0);
    expect(block).toContain("hasStaffPermission('ORDER_CORRECTION')");
    expect(block).not.toContain('createOrder(');
    expect(block).not.toContain('dispatchOrderOutputs');
    expect(block).not.toContain('reprintOrderJobs');
    expect(block).not.toContain('kickDrawer');
  });

  it('exposes only single-tender correction targets and shows immutable history in Orders UI',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const ui=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');
    expect(ui).toContain("type Modal='actions'|'edit'|'cancel'|'reprint'|'payment'|null");
    expect(ui).toContain('付款方式修正歷史');
    expect(ui).toContain('目前有效付款方式');
    expect(ui).toContain("runtime.correctOrderPayment");
    expect(ui).toContain("{id:'CASH',label:'現金'}");
    expect(ui).toContain("{id:'FPS',label:'FPS／轉數快'}");
    expect(ui).toContain("{id:'PAYME',label:'PayMe'}");
    expect(ui).not.toContain("{id:'COMBO',label:");
  });
});
