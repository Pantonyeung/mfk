import {describe,expect,it} from 'vitest';
import {projectStaffForRuntime,verifyStaffPin} from '../../contracts/staff-auth-v1.ts';

describe('Admin staff auth runtime projection',()=>{
  it('never emits raw PIN and verifies the projected PIN offline',async()=>{
    const projection=await projectStaffForRuntime([{
      id:'staff-1',
      loginId:'1111',
      name:'店員甲',
      role:'STAFF',
      pin:'1234',
      scope:'STORE',
      adminLogin:false,
      active:true,
      permissions:['ORDER_REVIEW'],
    }]);
    const staff=projection.staff[0]!;
    expect(JSON.stringify(projection)).not.toContain('"pin":"1234"');
    expect(staff.staffId).toBe('staff-1');
    expect(staff.loginId).toBe('1111');
    expect(staff.pinVerifier?.algorithm).toBe('PBKDF2-SHA256');
    expect(await verifyStaffPin('1234',staff.pinVerifier!)).toBe(true);
    expect(await verifyStaffPin('4321',staff.pinVerifier!)).toBe(false);
  });

  it('does not invent login credentials for blank PIN rows',async()=>{
    const projection=await projectStaffForRuntime([{
      id:'viewer-1',
      loginId:'viewer01',
      name:'只讀',
      role:'VIEWER',
      pin:'',
      scope:'REPORT_ONLY',
      adminLogin:true,
      active:true,
      permissions:['REPORT_VIEW'],
    }]);
    expect(projection.staff[0]?.pinVerifier).toBeUndefined();
  });
});


  it('preserves an existing verifier when canonical browser hydration does not know the raw PIN',async()=>{
    const first=await projectStaffForRuntime([{
      id:'staff-owner',
      loginId:'1111',
      name:'老闆',
      role:'OWNER',
      pin:'2468',
      scope:'STORE',
      adminLogin:true,
      active:true,
      permissions:['PUBLISH_CONFIG'],
    }]);
    const verifier=first.staff[0]?.pinVerifier;
    expect(verifier).toBeTruthy();
    const second=await projectStaffForRuntime([{
      id:'staff-owner',
      loginId:'1111',
      name:'老闆',
      role:'OWNER',
      pin:'',
      pinVerifier:verifier,
      scope:'STORE',
      adminLogin:true,
      active:true,
      permissions:['PUBLISH_CONFIG'],
    }]);
    expect(second.staff[0]?.pinVerifier).toEqual(verifier);
    expect(await verifyStaffPin('2468',second.staff[0]!.pinVerifier!)).toBe(true);
  });

  it('migrates a legacy account label to loginId once when no explicit loginId exists',async()=>{
    const projection=await projectStaffForRuntime([{
      id:'staff-legacy',
      name:'1111',
      role:'OWNER',
      pin:'1234',
      scope:'STORE',
      adminLogin:true,
      active:true,
      permissions:['PUBLISH_CONFIG'],
    }]);
    expect(projection.staff[0]?.staffId).toBe('staff-legacy');
    expect(projection.staff[0]?.loginId).toBe('1111');
  });
