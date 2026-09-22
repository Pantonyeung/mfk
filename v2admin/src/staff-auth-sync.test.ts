import {describe,expect,it} from 'vitest';
import {projectStaffForRuntime,verifyStaffPin} from '../../contracts/staff-auth-v1.ts';

describe('Admin staff auth runtime projection',()=>{
  it('never emits raw PIN and verifies the projected PIN offline',async()=>{
    const projection=await projectStaffForRuntime([{
      id:'staff-1',
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
    expect(staff.pinVerifier?.algorithm).toBe('PBKDF2-SHA256');
    expect(await verifyStaffPin('1234',staff.pinVerifier!)).toBe(true);
    expect(await verifyStaffPin('4321',staff.pinVerifier!)).toBe(false);
  });

  it('does not invent login credentials for blank PIN rows',async()=>{
    const projection=await projectStaffForRuntime([{
      id:'viewer-1',
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
