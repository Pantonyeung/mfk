import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {hydrateAdminFromCanonical} from './admin-browser-session.ts';

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

describe('Admin canonical browser hydration',()=>{
  beforeEach(()=>installStorage());

  it('hydrates cloud active revision into local editable cache without inventing raw PIN',()=>{
    const verifier={algorithm:'PBKDF2-SHA256' as const,iterations:120000,saltHex:'11'.repeat(16),hashHex:'22'.repeat(32)};
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:7,
      publishedAt:'2026-09-27T02:00:00.000Z',
      adminFingerprint:'fnv1a32:admin-r7',
      snapshot:{
        catalog:{categories:[],products:[],modifierGroups:[],combos:[],comboPools:[]},
        optionCenter:{sets:[],productLinks:[]},
        staffAuth:{
          schema:'MFK_STAFF_AUTH_V1',
          staff:[{
            staffId:'staff-internal-1',
            loginId:'1111',
            name:'老闆',
            role:'OWNER',
            scope:'STORE',
            adminLogin:true,
            active:true,
            permissions:['PUBLISH_CONFIG'],
            pinVerifier:verifier,
          }],
        },
        availability:{},
        storeSettings:{storeName:'磨飯'},
      },
    });

    expect(hydrateAdminFromCanonical(envelope)).toBe(7);

    const staff=JSON.parse(localStorage.getItem('mfk.admin.staff.v1')||'[]');
    expect(staff).toHaveLength(1);
    expect(staff[0].id).toBe('staff-internal-1');
    expect(staff[0].loginId).toBe('1111');
    expect(staff[0].name).toBe('老闆');
    expect(staff[0].pin).toBe('');
    expect(staff[0].pinVerifier).toEqual(verifier);
    expect(JSON.stringify(staff)).not.toContain('"pin":"1234"');

    const active=JSON.parse(localStorage.getItem('mfk.admin.active-release.v1')||'null');
    expect(active.version).toBe(7);
    const releases=JSON.parse(localStorage.getItem('mfk.admin.releases.v1')||'[]');
    expect(releases[0].version).toBe(7);
    expect(JSON.parse(localStorage.getItem('mfk.admin.catalog-draft.v2')||'null')).toEqual(envelope.snapshot.catalog);
  });
});
