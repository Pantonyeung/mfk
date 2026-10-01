import {describe,expect,it} from 'vitest';
import {
  addFormalStaff,
  patchFormalStaff,
  readFormalStaff,
  removeFormalStaff,
  validateFormalStaff,
} from './formal-staff.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    staff:[
      {id:'owner',loginId:'owner',name:'老闆',role:'OWNER',scope:'STORE',adminLogin:true,active:true,permissions:['PUBLISH_CONFIG'],pinVerifier:{algorithm:'PBKDF2-SHA256'},extra:'keep-owner'},
      {id:'staff-1',loginId:'1111',name:'店員',role:'STAFF',scope:'STORE',adminLogin:false,active:true,permissions:['ORDER_REVIEW'],pinVerifier:{algorithm:'PBKDF2-SHA256'}},
    ],
  } as Record<string,unknown>;
}

describe('formal staff adapter',()=>{
  it('reads staff without exposing plaintext PIN',()=>{
    const staff=readFormalStaff(snapshot());
    expect(staff[0]).toMatchObject({id:'owner',hasPinVerifier:true});
    expect('pin' in staff[0]).toBe(false);
  });

  it('patches staff while preserving verifier and unknown fields',()=>{
    const next=patchFormalStaff(snapshot(),'staff-1',{name:'新店員',permissions:['ORDER_REVIEW','REPORT_VIEW']}) as any;
    expect(next.staff[1]).toMatchObject({name:'新店員',pinVerifier:{algorithm:'PBKDF2-SHA256'}});
    expect(next.untouched.keep).toBe(true);
  });

  it('creates new staff disabled until secure verifier exists',()=>{
    const next=addFormalStaff(snapshot(),'staff-new');
    const person=readFormalStaff(next).find(item=>item.id==='staff-new');
    expect(person).toMatchObject({active:false,adminLogin:false,hasPinVerifier:false});
    expect(()=>patchFormalStaff(next,'staff-new',{active:true})).toThrow('FORMAL_STAFF_PIN_VERIFIER_REQUIRED');
  });

  it('guards active owner removal',()=>{
    expect(()=>removeFormalStaff(snapshot(),'owner')).toThrow('FORMAL_ACTIVE_OWNER_REMOVE_FORBIDDEN');
  });

  it('validates login and verifier requirements',()=>{
    expect(validateFormalStaff(snapshot())).toEqual([]);
    const bad={...snapshot(),staff:[{id:'x',loginId:'bad space',name:'X',role:'STAFF',scope:'STORE',adminLogin:true,active:true,permissions:[]}]};
    const errors=validateFormalStaff(bad as any);
    expect(errors.some(error=>error.includes('登入編號格式錯誤'))).toBe(true);
    expect(errors.some(error=>error.includes('PIN Verifier'))).toBe(true);
  });
});
