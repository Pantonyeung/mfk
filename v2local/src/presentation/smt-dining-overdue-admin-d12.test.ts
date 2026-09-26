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

async function publishThreshold(minutes:number){
  const {createMfkAdminConfigEnvelope}=await import('../../../contracts/admin-config-sync-v1.ts');
  const {applyAdminConfigEnvelope}=await import('../runtime/admin-config-sync.ts');
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:1,
    publishedAt:'2026-09-26T14:20:00.000Z',
    adminFingerprint:'fnv1a32:dining-overdue-d12',
    snapshot:{
      catalog:{categories:[],products:[],combos:[],comboPools:[]},
      storeSettings:{
        storeName:'磨飯',
        diningOverdueMinutes:minutes,
        diningTables:[{id:'T01',name:'1 號枱',active:true,sortOrder:1}],
      },
    },
  }));
}

describe('D12 Admin-controlled Dining overdue threshold',()=>{
  beforeEach(()=>{
    installStorage();
    vi.resetModules();
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  });

  it('reads the Admin-published threshold as the SMT source of truth',async()=>{
    await publishThreshold(47);
    const {readSmtStoreSettings}=await import('../runtime/admin-operational-config.ts');
    expect(readSmtStoreSettings().diningOverdueMinutes).toBe(47);
  });

  it('uses 35 only as the backward-compatible default when Admin has not published the field',async()=>{
    const {readSmtStoreSettings}=await import('../runtime/admin-operational-config.ts');
    expect(readSmtStoreSettings().diningOverdueMinutes).toBe(35);
  });

  it('removes the hard-coded 35-minute comparison from the Dining workspace',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    expect(ui).toContain('const diningOverdueMinutes=readSmtStoreSettings().diningOverdueMinutes');
    expect(ui).toContain('elapsed-diningOverdueMinutes');
    expect(ui).toContain('elapsed>=diningOverdueMinutes');
    expect(ui).not.toContain('elapsed-35');
    expect(ui).not.toContain('elapsed>=35');
    expect(ui).not.toContain('距離 35 分鐘');
  });
});
