import {beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {applyAdminConfigEnvelope,SMT_ADMIN_CONFIG_LKG_KEY,SMT_ADMIN_CONFIG_STATUS_KEY} from '../runtime/admin-config-sync.ts';
import {readSmtStoreSettings} from '../runtime/admin-operational-config.ts';
import {sourceLane} from './RuntimeOrdersWorkspace.tsx';

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

const snapshot:any={
  catalog:{categories:[],products:[],combos:[],comboPools:[]},
  optionCenter:{sets:[],productLinks:[]},
  availability:{},businessDay:{cutoff:'05:00'},logicalPrinters:[],printTemplates:{},printRules:{},productMedia:{},
  storeSettings:{
    storeName:'磨飯',storeCode:'MF01',currency:'HKD',timezone:'Asia/Hong_Kong',
    fulfillmentMinutes:20,lateArrivalMinutes:15,archiveHours:24,
    reminderAfterMinutes:5,reminderIntervalMinutes:5,repeatReminder:true,timeoutPriority:'HIGH',
    dineInEnabled:true,takeawayEnabled:true,paymentRefs:['CASH'],printRefs:[],channelRefs:[],
    diningTables:[
      {id:'T01',name:'窗邊',active:true,sortOrder:2},
      {id:'T02',name:'堂一',active:true,sortOrder:1},
      {id:'T03',name:'停用枱',active:false,sortOrder:3},
    ],
  },
  quickReasons:[],staff:[],channelPolicy:{},channelMapping:[],capacity:{},presentation:{frontline:{}},inventory:[],loyalty:{},coupons:[],announcements:[],
};

describe('Dining control reconcile R5',()=>{
  beforeEach(()=>{
    vi.resetModules();
    installStorage();
    localStorage.removeItem(SMT_ADMIN_CONFIG_LKG_KEY);
    localStorage.removeItem(SMT_ADMIN_CONFIG_STATUS_KEY);
  });

  it('consumes active Admin-published dining table definitions in sort order',()=>{
    applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:51,publishedAt:'2026-09-25T14:30:00.000Z',adminFingerprint:'fnv1a32:r5',snapshot,
    }));
    expect(readSmtStoreSettings().diningTables).toEqual([
      {id:'T02',name:'堂一',active:true,sortOrder:1},
      {id:'T01',name:'窗邊',active:true,sortOrder:2},
    ]);
  });

  it('classifies frontline, self-platform and third-party source lanes using current control semantics',()=>{
    expect(sourceLane('SMM')).toBe('direct');
    expect(sourceLane('現場')).toBe('direct');
    expect(sourceLane('電話')).toBe('direct');
    expect(sourceLane('WhatsApp')).toBe('direct');
    expect(sourceLane('Customer')).toBe('owned');
    expect(sourceLane('磨飯 App')).toBe('owned');
    expect(sourceLane('Keeta · K123')).toBe('platform');
    expect(sourceLane('Foodpanda')).toBe('platform');
  });

  it('renders the hold selector from Admin table registry instead of a hard-coded nine-table list',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    expect(app).toContain('storeSettings.diningTables');
    expect(app).not.toContain("const holdTables=Array.from({length:9}");
    expect(runtime).toContain('readSmtStoreSettings().diningTables');
  });

  it('keeps dine-in-only legacy formal orders out of active Order board projection',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    expect(runtime).toContain("order.items.every(item=>item.serviceMode==='dine-in')");
  });
});
