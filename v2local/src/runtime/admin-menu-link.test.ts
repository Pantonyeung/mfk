import {beforeEach,describe,expect,it} from 'vitest';
import {buildAdminMenuIndexRevisionFromDraft} from '../../../v2admin/src/admin-menu-link.ts';
import type {AdminSessionDraft} from '../../../v2admin/src/admin-draft.tsx';
import {
  LOCAL_ADMIN_MENU_ACTIVE_KEY,
  LOCAL_ADMIN_MENU_DRAFT_KEY,
  LOCAL_ADMIN_MENU_HISTORY_KEY,
  applyAdminMenuIndexRevision,
  readLocalAdminMenu,
  readLocalAdminMenuDraft,
} from './local-admin-menu.ts';

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

const draft:AdminSessionDraft=Object.freeze({
  categories:[
    {id:'cat-riceball',name:'飯團',position:10,active:true},
    {id:'cat-drink',name:'飲品',position:20,active:true},
    {id:'cat-hidden',name:'隱藏',position:30,active:false},
  ],
  products:[
    {id:'riceball',name:'磨飯飯團',categoryId:'cat-riceball',active:true,basePrice:'41.00',takeawayAdjustment:'1.00',modifierGroupIds:[]},
    {id:'milkTea',name:'台式奶茶',categoryId:'cat-drink',active:true,basePrice:'16.00',takeawayAdjustment:'0.00',modifierGroupIds:[]},
    {id:'hidden-product',name:'隱藏商品',categoryId:'cat-hidden',active:true,basePrice:'9.00',takeawayAdjustment:'0.00',modifierGroupIds:[]},
  ],
  modifierGroups:[],
  combos:[],
});

describe('Admin connection A1: Menu Index revision → SMT Local LKG',()=>{
  beforeEach(()=>{
    installStorage();
    localStorage.removeItem(LOCAL_ADMIN_MENU_ACTIVE_KEY);
    localStorage.removeItem(LOCAL_ADMIN_MENU_DRAFT_KEY);
    localStorage.removeItem(LOCAL_ADMIN_MENU_HISTORY_KEY);
    localStorage.removeItem('mfk.local-admin.menu.v1');
  });

  it('builds one Admin published menu index and applies it to SMT LKG',()=>{
    const before=readLocalAdminMenu();
    expect(before.revision).toBe(1);

    const revision=buildAdminMenuIndexRevisionFromDraft(draft,before.revision,'2026-09-22T07:30:00.000Z');
    expect(revision.baseRevision).toBe(1);
    expect(revision.revision).toBe(2);
    expect(revision.categories.map(x=>x.id)).toEqual(['cat-riceball','cat-drink']);
    expect(revision.products.map(x=>x.id)).toEqual(['riceball','milkTea']);

    const applied=applyAdminMenuIndexRevision(revision);
    expect(applied.disposition).toBe('APPLIED');
    expect(applied.revision).toBe(2);

    const active=readLocalAdminMenu();
    expect(active.revision).toBe(2);
    expect(active.products.find(x=>x.id==='riceball')?.name).toBe('磨飯飯團');
    expect(active.products.some(x=>x.id==='hidden-product')).toBe(false);

    const rebased=readLocalAdminMenuDraft();
    expect(rebased.basePublishedRevision).toBe(2);
    expect(rebased.products.find(x=>x.id==='riceball')?.name).toBe('磨飯飯團');
  });

  it('replaying the same revision is idempotent',()=>{
    const base=readLocalAdminMenu().revision;
    const revision=buildAdminMenuIndexRevisionFromDraft(draft,base,'2026-09-22T07:31:00.000Z');
    expect(applyAdminMenuIndexRevision(revision).disposition).toBe('APPLIED');
    expect(applyAdminMenuIndexRevision(revision).disposition).toBe('IDEMPOTENT');
    expect(readLocalAdminMenu().revision).toBe(2);
  });

  it('rejects stale base revision instead of overwriting newer local LKG',()=>{
    const base=readLocalAdminMenu().revision;
    const first=buildAdminMenuIndexRevisionFromDraft(draft,base,'2026-09-22T07:32:00.000Z');
    applyAdminMenuIndexRevision(first);

    const stale=buildAdminMenuIndexRevisionFromDraft(draft,1,'2026-09-22T07:33:00.000Z');
    expect(()=>applyAdminMenuIndexRevision(stale)).toThrow('ADMIN_MENU_INDEX_REVISION_CONFLICT');
    expect(readLocalAdminMenu().revision).toBe(2);
  });

  it('rejects malformed or tampered revision',()=>{
    const base=readLocalAdminMenu().revision;
    const revision=buildAdminMenuIndexRevisionFromDraft(draft,base,'2026-09-22T07:34:00.000Z');
    expect(()=>applyAdminMenuIndexRevision({...revision,fingerprint:'fnv1a32:00000000'})).toThrow('ADMIN_MENU_INDEX_FINGERPRINT_MISMATCH');
  });
});
