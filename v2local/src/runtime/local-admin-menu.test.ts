import {beforeEach,describe,expect,it} from 'vitest';
import {
  LOCAL_ADMIN_MENU_ACTIVE_KEY,
  LOCAL_ADMIN_MENU_DRAFT_KEY,
  LOCAL_ADMIN_MENU_HISTORY_KEY,
  discardLocalAdminMenuDraft,
  inspectLocalAdminMenuDraft,
  publishLocalAdminMenu,
  readLocalAdminMenu,
  readLocalAdminMenuDraft,
  resetLocalAdminMenuToSeed,
  saveLocalAdminMenuDraft,
} from './local-admin-menu.ts';

describe('local Admin menu authority',()=>{
  beforeEach(()=>{
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
    localStorage.removeItem(LOCAL_ADMIN_MENU_ACTIVE_KEY);
    localStorage.removeItem(LOCAL_ADMIN_MENU_DRAFT_KEY);
    localStorage.removeItem(LOCAL_ADMIN_MENU_HISTORY_KEY);
    localStorage.removeItem('mfk.local-admin.menu.v1');
  });

  it('boots with independent active and draft revisions',()=>{
    const active=readLocalAdminMenu();
    const draft=readLocalAdminMenuDraft();
    expect(active.schemaVersion).toBe(2);
    expect(active.revision).toBe(1);
    expect(draft.schemaVersion).toBe(2);
    expect(draft.basePublishedRevision).toBe(1);
    expect(draft.draftRevision).toBe(1);
  });

  it('saving draft does not mutate active POS menu',()=>{
    const active=readLocalAdminMenu();
    const draft=readLocalAdminMenuDraft();
    const saved=saveLocalAdminMenuDraft({
      categories:draft.categories,
      products:draft.products.map(row=>row.id==='riceball'?{...row,name:'草稿飯團'}:row),
    },draft.draftRevision);
    expect(saved.draftRevision).toBe(2);
    expect(readLocalAdminMenu().products.find(row=>row.id==='riceball')?.name).toBe('原味飯團');
  });

  it('publishes only with matching active and draft revisions',()=>{
    const active=readLocalAdminMenu();
    const draft=readLocalAdminMenuDraft();
    const saved=saveLocalAdminMenuDraft({
      categories:draft.categories,
      products:draft.products.map(row=>row.id==='riceball'?{...row,name:'正式飯團'}:row),
    },draft.draftRevision);
    const published=publishLocalAdminMenu(saved.draftRevision,active.revision);
    expect(published.revision).toBe(2);
    expect(published.products.find(row=>row.id==='riceball')?.name).toBe('正式飯團');
    expect(()=>publishLocalAdminMenu(saved.draftRevision,1)).toThrow();
  });

  it('fails validation when product points to unknown category',()=>{
    const draft=readLocalAdminMenuDraft();
    const result=inspectLocalAdminMenuDraft({
      categories:draft.categories,
      products:draft.products.map((row,index)=>index===0?{...row,categoryId:'missing'}:row),
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toBe('ADMIN_MENU_PRODUCT_CATEGORY_UNKNOWN_missing');
  });

  it('discard restores active while seed reset remains draft-only',()=>{
    const draft=readLocalAdminMenuDraft();
    const saved=saveLocalAdminMenuDraft({
      categories:draft.categories,
      products:draft.products.map(row=>row.id==='riceball'?{...row,name:'暫時名稱'}:row),
    },draft.draftRevision);
    const discarded=discardLocalAdminMenuDraft(saved.draftRevision);
    expect(discarded.products.find(row=>row.id==='riceball')?.name).toBe('原味飯團');

    const changed=saveLocalAdminMenuDraft({
      categories:discarded.categories,
      products:discarded.products.map(row=>row.id==='riceball'?{...row,name:'另一名稱'}:row),
    },discarded.draftRevision);
    const reset=resetLocalAdminMenuToSeed(changed.draftRevision);
    expect(reset.products.find(row=>row.id==='riceball')?.name).toBe('原味飯團');
    expect(readLocalAdminMenu().revision).toBe(1);
  });
});
