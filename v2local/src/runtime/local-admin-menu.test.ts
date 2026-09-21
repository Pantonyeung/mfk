import {beforeEach,describe,expect,it} from 'vitest';
import {
  LOCAL_ADMIN_MENU_STORAGE_KEY,
  readLocalAdminMenu,
  resetLocalAdminMenu,
  saveLocalAdminMenu,
  validateLocalAdminMenu,
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
    localStorage.removeItem(LOCAL_ADMIN_MENU_STORAGE_KEY);
  });

  it('boots with deterministic local seed',()=>{
    const menu=readLocalAdminMenu();
    expect(menu.schemaVersion).toBe(1);
    expect(menu.revision).toBe(1);
    expect(menu.products.some(row=>row.id==='riceball')).toBe(true);
  });

  it('saves with revision guard',()=>{
    const first=readLocalAdminMenu();
    const next=saveLocalAdminMenu({
      categories:first.categories,
      products:first.products.map(row=>row.id==='riceball'?{...row,name:'測試飯團'}:row),
    },first.revision);
    expect(next.revision).toBe(2);
    expect(next.products.find(row=>row.id==='riceball')?.name).toBe('測試飯團');
    expect(()=>saveLocalAdminMenu({categories:next.categories,products:next.products},1)).toThrow('ADMIN_MENU_REVISION_CONFLICT');
  });

  it('fails closed when product points to unknown category',()=>{
    const first=readLocalAdminMenu();
    expect(()=>validateLocalAdminMenu({
      ...first,
      products:first.products.map((row,index)=>index===0?{...row,categoryId:'missing'}:row),
    })).toThrow('ADMIN_MENU_PRODUCT_CATEGORY_UNKNOWN_missing');
  });

  it('reset creates a new revision instead of rewriting history in place',()=>{
    const first=readLocalAdminMenu();
    const edited=saveLocalAdminMenu({
      categories:first.categories,
      products:first.products.map(row=>row.id==='riceball'?{...row,name:'暫時名稱'}:row),
    },first.revision);
    const reset=resetLocalAdminMenu(edited.revision);
    expect(reset.revision).toBe(3);
    expect(reset.products.find(row=>row.id==='riceball')?.name).toBe('原味飯團');
  });
});
