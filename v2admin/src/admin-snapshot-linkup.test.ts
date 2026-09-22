import {beforeEach,describe,expect,it} from 'vitest';
import {collectAdminSnapshot} from './admin-config-save.ts';
import {LEGACY_MF01_ADMIN_DRAFT} from './admin-menu-seed-mf01-v2.ts';
import {migrateLegacyDraftToOptionSetCenter} from './admin-option-set-center.ts';
import type {AdminSessionDraft} from './admin-draft.tsx';

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

describe('Admin full snapshot link-up',()=>{
  beforeEach(()=>installStorage());

  it('publishes the real per-surface presentation keys instead of an unused presentation.v1 bucket',()=>{
    localStorage.setItem('presentation.customer.v1',JSON.stringify({headline:'Customer'}));
    localStorage.setItem('presentation.owner.v1',JSON.stringify({headline:'Owner'}));
    localStorage.setItem('presentation.frontline.v1',JSON.stringify({headline:'Frontline',showImages:false}));

    const catalog=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const optionCenter=migrateLegacyDraftToOptionSetCenter(catalog);
    const snapshot=collectAdminSnapshot(catalog,optionCenter) as Record<string,any>;

    expect(snapshot.presentation).toEqual({
      customer:{headline:'Customer'},
      owner:{headline:'Owner'},
      frontline:{headline:'Frontline',showImages:false},
    });
    expect(snapshot.presentation).not.toHaveProperty('v1');
  });
});
