import {describe,expect,it} from 'vitest';
import {
  addFormalDiningTable,
  moveFormalDiningTable,
  patchFormalBusinessDay,
  patchFormalDiningTable,
  patchFormalStoreSettings,
  patchFormalWeeklyHours,
  readFormalBusinessDay,
  readFormalStoreSettings,
} from './formal-store.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    storeSettings:{
      storeName:'磨飯',storeCode:'MF01',currency:'HKD',timezone:'Asia/Hong_Kong',
      dineInEnabled:true,takeawayEnabled:true,
      lateArrivalMinutes:15,fulfillmentMinutes:20,archiveHours:24,diningOverdueMinutes:35,
      reminderAfterMinutes:5,reminderIntervalMinutes:5,repeatReminder:true,timeoutPriority:'HIGH',
      weeklyHours:{MON:{closed:false,opensAt:'11:00',closesAt:'20:00',extra:'keep-hours'}},
      diningTables:[{id:'T0001',name:'1號枱',active:true,sortOrder:1,versions:[{versionId:'V1',label:'1號枱',status:'ACTIVE'}],extra:'keep-table'}],
      extraStore:{keep:true},
    },
    businessDay:{cutoff:'05:00',postCloseCorrectionRoles:['OWNER'],cashTolerance:'0.00',requireCloseApproval:true,extraBusiness:{keep:true}},
  } as Record<string,unknown>;
}

describe('formal store adapters',()=>{
  it('patches store settings and weekly hours without dropping unknown fields',()=>{
    const basic=patchFormalStoreSettings(snapshot(),{storeName:'磨飯 More Fun'}) as any;
    expect(basic.storeSettings).toMatchObject({storeName:'磨飯 More Fun',extraStore:{keep:true}});
    const hours=patchFormalWeeklyHours(snapshot(),'MON',{opensAt:'10:30'}) as any;
    expect(hours.storeSettings.weeklyHours.MON).toMatchObject({opensAt:'10:30',extra:'keep-hours'});
    expect(hours.untouched.keep).toBe(true);
  });

  it('patches business day preserving unknown fields',()=>{
    const next=patchFormalBusinessDay(snapshot(),{cutoff:'04:30'}) as any;
    expect(readFormalBusinessDay(next).cutoff).toBe('04:30');
    expect(next.businessDay.extraBusiness.keep).toBe(true);
  });

  it('adds and renames dining tables while retaining table history and unknown fields',()=>{
    const added=addFormalDiningTable(snapshot(),'T0002');
    expect(readFormalStoreSettings(added).diningTables.map(item=>item.id)).toEqual(['T0001','T0002']);
    const renamed=patchFormalDiningTable(snapshot(),'T0001',{name:'窗口枱'}) as any;
    expect(renamed.storeSettings.diningTables[0]).toMatchObject({name:'窗口枱',extra:'keep-table'});
    expect(renamed.storeSettings.diningTables[0].versions.length).toBe(2);
  });

  it('reorders dining tables through formal draft',()=>{
    const two=addFormalDiningTable(snapshot(),'T0002');
    const moved=moveFormalDiningTable(two,'T0002',-1);
    expect(readFormalStoreSettings(moved).diningTables.map(item=>item.id)).toEqual(['T0002','T0001']);
  });
});
