import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {createStaffPinVerifier,projectStaffForRuntime} from '../../../contracts/staff-auth-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {hasStaffPermission,loginStaff,logoutStaff,readActiveStaffSession,staffAuthRequired} from './staff-auth.ts';

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

describe('SMT staff auth',()=>{
  beforeEach(()=>{installStorage();logoutStaff();});

  it('requires login when an active PIN verifier exists and creates an in-memory permission context',async()=>{
    const staffAuth=await projectStaffForRuntime([{
      id:'staff-1',name:'店員甲',role:'STAFF',pin:'2468',scope:'STORE',adminLogin:false,active:true,
      permissions:['ORDER_REVIEW'],
    }]);
    applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:1,publishedAt:'2026-09-22T10:00:00.000Z',adminFingerprint:'fnv1a32:test',
      snapshot:{catalog:{categories:[],products:[],combos:[],comboPools:[]},staffAuth},
    }));
    expect(staffAuthRequired()).toBe(true);
    expect((await loginStaff('staff-1','1111')).ok).toBe(false);
    const result=await loginStaff('staff-1','2468');
    expect(result.ok).toBe(true);
    expect(readActiveStaffSession()?.staffId).toBe('staff-1');
    expect(hasStaffPermission('ORDER_REVIEW')).toBe(true);
    expect(hasStaffPermission('ORDER_CORRECTION')).toBe(false);
  });

  it('does not persist staff session and ignores disabled staff',async()=>{
    const verifier=await createStaffPinVerifier('9999');
    applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:2,publishedAt:'2026-09-22T10:01:00.000Z',adminFingerprint:'fnv1a32:test2',
      snapshot:{catalog:{categories:[],products:[],combos:[],comboPools:[]},staffAuth:{
        schema:'MFK_STAFF_AUTH_V1',
        staff:[{staffId:'off',name:'停用員工',role:'STAFF',scope:'STORE',adminLogin:false,active:false,permissions:['ORDER_REVIEW'],pinVerifier:verifier}],
      }},
    }));
    expect(staffAuthRequired()).toBe(false);
    expect((await loginStaff('off','9999')).ok).toBe(false);
    expect(readActiveStaffSession()).toBeNull();
    expect([...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).filter(Boolean).some(key=>String(key).includes('staff-session'))).toBe(false);
  });
});
