import {beforeEach,describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectAdminSnapshot} from './admin-config-save.ts';
import {LEGACY_MF01_ADMIN_DRAFT} from './admin-menu-seed-mf01-v2.ts';
import {migrateLegacyDraftToOptionSetCenter} from './admin-option-set-center.ts';
import type {AdminSessionDraft} from './admin-draft.tsx';

function installStorage(){
  const values=new Map<string,string>();
  const localStorage={
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{values.set(key,String(value));},
    removeItem:(key:string)=>{values.delete(key);},
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  };
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:localStorage});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage}});
}

describe('D12 Admin Dining overdue setting',()=>{
  beforeEach(()=>installStorage());

  it('publishes the configured Dining overdue threshold in canonical storeSettings',()=>{
    localStorage.setItem('mfk.admin.store-settings.v1',JSON.stringify({
      storeName:'磨飯',
      storeCode:'MF01',
      diningOverdueMinutes:47,
    }));
    const catalog=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const optionCenter=migrateLegacyDraftToOptionSetCenter(catalog);
    const snapshot=collectAdminSnapshot(catalog,optionCenter) as Record<string,any>;
    expect(snapshot.storeSettings.diningOverdueMinutes).toBe(47);
  });

  it('exposes a dedicated Admin field and keeps 35 only as the default',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const src=fs.readFileSync(path.join(here,'PolicyWorkspaces.tsx'),'utf8');
    expect(src).toContain('diningOverdueMinutes:number');
    expect(src).toContain('diningOverdueMinutes:35');
    expect(src).toContain('堂食超時變紅（分鐘）');
    expect(src).toContain('35 分鐘只係預設值');
    expect(src).toContain('堂食超時提醒分鐘必須至少 1 分鐘');
  });
});
