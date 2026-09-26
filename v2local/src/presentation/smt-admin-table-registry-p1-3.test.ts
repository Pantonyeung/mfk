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

async function publishTables(){
  const {createMfkAdminConfigEnvelope}=await import('../../../contracts/admin-config-sync-v1.ts');
  const {applyAdminConfigEnvelope}=await import('../runtime/admin-config-sync.ts');
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:1,
    publishedAt:'2026-09-26T10:00:00.000Z',
    adminFingerprint:'fnv1a32:table-test',
    snapshot:{
      catalog:{categories:[],products:[],combos:[],comboPools:[]},
      storeSettings:{
        storeName:'磨飯',
        diningTables:[
          {id:'T01',name:'窗邊 A',active:true,sortOrder:2},
          {id:'T02',name:'大枱',active:true,sortOrder:1},
          {id:'T03',name:'暫停枱',active:false,sortOrder:3},
        ],
      },
    },
  }));
}

describe('SMT P1-3 Admin dining table registry convergence',()=>{
  beforeEach(()=>{
    installStorage();
    vi.resetModules();
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  });

  it('accepts only active Admin-published table IDs and rejects disabled / unknown IDs',async()=>{
    await publishTables();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const wait=await localRuntime.createDiningWait({partySize:2});
    await localRuntime.assignDiningTable(wait.id,'T02');
    expect((await localRuntime.readDiningHold(wait.id)).assignedTable).toBe('T02');

    const other=await localRuntime.createDiningWait({partySize:2});
    await expect(localRuntime.assignDiningTable(other.id,'T03')).rejects.toThrow('DINING_TABLE_NOT_ASSIGNABLE');
    await expect(localRuntime.assignDiningTable(other.id,'T99')).rejects.toThrow('DINING_TABLE_NOT_ASSIGNABLE');
  });

  it('rejects assigning an already occupied published table',async()=>{
    await publishTables();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const first=await localRuntime.createDiningWait({partySize:2});
    const second=await localRuntime.createDiningWait({partySize:2});
    await localRuntime.assignDiningTable(first.id,'T01');
    await expect(localRuntime.assignDiningTable(second.id,'T01')).rejects.toThrow('DINING_TABLE_OCCUPIED');
  });

  it('uses 1-9 fallback only when no Admin registry exists',async()=>{
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const wait=await localRuntime.createDiningWait({partySize:2});
    await localRuntime.assignDiningTable(wait.id,'T09');
    expect((await localRuntime.readDiningHold(wait.id)).assignedTable).toBe('T09');
    const other=await localRuntime.createDiningWait({partySize:2});
    await expect(localRuntime.assignDiningTable(other.id,'T10')).rejects.toThrow('DINING_TABLE_NOT_ASSIGNABLE');
  });

  it('keeps published display names in assignment, detail and checkout UI copy',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
    expect(runtime).toContain('readSmtDiningTableRegistry()');
    expect(runtime).toContain("throw new Error('DINING_TABLE_NOT_ASSIGNABLE')");
    expect(runtime).toContain("throw new Error('DINING_TABLE_OCCUPIED')");
    expect(ui).toContain("view?.tables.find(table=>table.id===tableId)?.label??tableId");
    expect(ui).toContain("view?.tables.find(table=>table.id===detail.assignedTable)?.label??detail.assignedTable");
    expect(app).toContain('const diningTableDefinitions=storeSettings.diningTables.length');
  });
});
