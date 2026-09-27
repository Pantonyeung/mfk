import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {AdminSyncStore,calculateOwnerPlanningMetrics,normalizeOwnerKeetaChannel,normalizeOwnerOwnPlatformChannel,ownerRemainingOperatingDays} from '../worker.ts';

describe('Owner Stage04 channel + planning',()=>{
  it('keeps channel health separate from accepting orders and exposes only supported controls',()=>{
    const channel=normalizeOwnerKeetaChannel({
      state:'AVAILABLE',
      operation:{state:'COMPLETED',action:'REST',completedAt:'2026-09-27T04:00:00Z'},
      readback:{observedAt:'2026-09-27T04:00:01Z',details:{data:{status:4}},hours:{data:{}}},
    },'2026-09-27T04:00:02Z');
    expect(channel.acceptingOrders).toBe(false);
    expect(channel.health).toBe('HEALTHY');
    expect(channel.mode).toBe('PAUSED');
    expect(channel.cause).toBe('manual');
    expect(channel.readback).toBe('CONFIRMED');
    expect(channel.controls).toEqual({pause:false,resume:false,snooze:false,busy:false});
  });

  it('own platform availability does not pretend integration health is the same fact',()=>{
    const channel=normalizeOwnerOwnPlatformChannel({snapshot:{customerChannelPolicy:{enabled:false}}},{reachable:true,observedAt:'2026-09-27T04:00:00Z'},'2026-09-27T04:00:01Z');
    expect(channel.acceptingOrders).toBe(false);
    expect(channel.health).toBe('HEALTHY');
    expect(channel.mode).toBe('PAUSED');
    expect(channel.controls.pause).toBe(false);
  });

  it('calculates target, cost and estimated operating profit without using open-check estimates',()=>{
    const plan={
      monthlyRevenueTargetMinor:3000000,
      costLines:[
        {plannedMonthlyMinor:500000,actualToDateMinor:250000},
        {plannedMonthlyMinor:200000,actualToDateMinor:100000},
      ],
    };
    const metrics=calculateOwnerPlanningMetrics({
      monthKey:'2026-09',
      currentEffectiveSalesMinor:2100000,
      plan,
      observedAt:'2026-09-27T04:00:00Z',
    });
    expect(metrics.salesSource).toBe('CURRENT_EFFECTIVE_SALES');
    expect(metrics.currentEffectiveSalesMinor).toBe(2100000);
    expect(metrics.remainingMinor).toBe(900000);
    expect(metrics.achievementPercent).toBe(70);
    expect(metrics.remainingCalendarDays).toBe(4);
    expect(metrics.requiredDailyAverageMinor).toBe(225000);
    expect(metrics.monthlyPlannedCostMinor).toBe(700000);
    expect(metrics.targetOperatingSurplusMinor).toBe(2300000);
    expect(metrics.actualToDateCostMinor).toBe(350000);
    expect(metrics.estimatedOperatingProfitToDateMinor).toBe(1750000);
    expect(metrics.costCoverage).toBe('MANUAL_ESTIMATE');
  });

  it('uses canonical weekly schedule for remaining operating days when available',()=>{
    const active={snapshot:{storeSettings:{weeklyHours:{
      MON:{closed:false},TUE:{closed:false},WED:{closed:false},THU:{closed:false},FRI:{closed:false},SAT:{closed:true},SUN:{closed:false},
    }}}};
    expect(ownerRemainingOperatingDays(active,'2026-09','2026-09-25T04:00:00Z')).toBe(5);
  });

  it('shows target reached without mutating transaction truth and keeps incomplete actual cost partial',()=>{
    const metrics=calculateOwnerPlanningMetrics({
      monthKey:'2026-09',
      currentEffectiveSalesMinor:3200000,
      plan:{monthlyRevenueTargetMinor:3000000,costLines:[{plannedMonthlyMinor:500000}]},
      observedAt:'2026-09-27T04:00:00Z',
    });
    expect(metrics.remainingMinor).toBe(0);
    expect(metrics.requiredDailyAverageMinor).toBe(0);
    expect(metrics.paceState).toBe('TARGET_REACHED');
    expect(metrics.actualCostAvailable).toBe(false);
    expect(metrics.estimatedOperatingProfitToDateMinor).toBeUndefined();
    expect(metrics.costCoverage).toBe('PARTIAL');
  });

  it('canonical planning writer is bounded to AdminSyncStore and OA-CHN stays read-only',()=>{
    const worker=fs.readFileSync(path.resolve(process.cwd(),'worker.ts'),'utf8');
    expect(worker).toContain("MFK_OWNER_MONTHLY_PLAN_V1");
    expect(worker).toContain("owner:planning:'+storeId+':'+monthKey");
    expect(worker).toContain("owner:planning:operation:");
    expect(worker).toContain("expectedRevision");
    expect(worker).toContain("CANONICAL_READBACK_MISMATCH");
    expect(worker).toContain("recognizedSalesMinor");
    expect(worker).toContain("'/owner/planning'");
    expect(worker).toContain("'/owner/channels'");
    expect(worker).not.toContain("'/owner/channels/command'");
    expect(worker).not.toContain("owner:channel:operation:");
    expect(worker).not.toContain('OWNER_FINANCE_DB');
  });

  it('canonical plan write increments revision and a fresh runtime instance reads the same plan',async()=>{
    const data=new Map<string,unknown>();
    const storage={
      get:async(key:string)=>data.get(key),
      put:async(key:string,value:unknown)=>{data.set(key,value);},
      list:async({prefix}:{prefix:string})=>new Map([...data].filter(([key])=>key.startsWith(prefix))),
    };
    const state={storage,getWebSockets:()=>[]} as never;
    const session={staffId:'owner-1',loginId:'1111',displayName:'Owner'};
    const first=new AdminSyncStore(state,{} as never);
    const result=await first.saveOwnerMonthlyPlan(session,{
      monthKey:'2026-09',monthlyRevenueTargetMinor:3000000,expectedRevision:0,operationId:'plan-op-1',
      note:'September plan',
      costLines:[
        {costLineId:'rent',category:'RENT',label:'屋租',plannedMonthlyMinor:500000,actualToDateMinor:500000},
        {costLineId:'labor',category:'LABOR',label:'人工',plannedMonthlyMinor:800000,actualToDateMinor:400000},
      ],
    });
    expect(result.state).toBe('CONFIRMED');
    expect(result.snapshot.plan.revision).toBe(1);
    expect(result.snapshot.plan.updatedBy).toBe('owner-1');

    const freshDeviceRuntime=new AdminSyncStore(state,{} as never);
    const readback=await freshDeviceRuntime.readOwnerMonthlyPlan('2026-09','MF01');
    expect(readback.revision).toBe(1);
    expect(readback.monthlyRevenueTargetMinor).toBe(3000000);
    expect(readback.costLines[0].label).toBe('屋租');
    expect(data.has('owner:planning:MF01:2026-09')).toBe(true);
  });

  it('revision conflict fails closed and requires refresh',async()=>{
    const data=new Map<string,unknown>();
    const storage={
      get:async(key:string)=>data.get(key),
      put:async(key:string,value:unknown)=>{data.set(key,value);},
      list:async({prefix}:{prefix:string})=>new Map([...data].filter(([key])=>key.startsWith(prefix))),
    };
    const runtime=new AdminSyncStore({storage,getWebSockets:()=>[]} as never,{} as never);
    const session={staffId:'owner-1',loginId:'1111',displayName:'Owner'};
    const input={monthKey:'2026-09',monthlyRevenueTargetMinor:3000000,expectedRevision:0,costLines:[{costLineId:'rent',category:'RENT',label:'屋租',plannedMonthlyMinor:500000}]};
    expect((await runtime.saveOwnerMonthlyPlan(session,{...input,operationId:'op-a'})).state).toBe('CONFIRMED');
    const conflict=await runtime.saveOwnerMonthlyPlan(session,{...input,operationId:'op-b',monthlyRevenueTargetMinor:4000000});
    expect(conflict.state).toBe('REJECTED');
    expect(conflict.currentRevision).toBe(1);
    expect((await runtime.readOwnerMonthlyPlan('2026-09','MF01')).monthlyRevenueTargetMinor).toBe(3000000);
  });

  it('canonical readback mismatch returns UNKNOWN and never fake-green',async()=>{
    const data=new Map<string,unknown>();
    let corruptReadback=false;
    const storage={
      get:async(key:string)=>{
        const value=data.get(key) as any;
        if(corruptReadback&&key==='owner:planning:MF01:2026-09'&&value)return {...value,revision:999};
        return value;
      },
      put:async(key:string,value:unknown)=>{
        data.set(key,value);
        if(key==='owner:planning:MF01:2026-09')corruptReadback=true;
      },
      list:async({prefix}:{prefix:string})=>new Map([...data].filter(([key])=>key.startsWith(prefix))),
    };
    const runtime=new AdminSyncStore({storage,getWebSockets:()=>[]} as never,{} as never);
    const result=await runtime.saveOwnerMonthlyPlan({staffId:'owner-1',loginId:'1111',displayName:'Owner'},{
      monthKey:'2026-09',monthlyRevenueTargetMinor:3000000,expectedRevision:0,operationId:'op-unknown',
      costLines:[{costLineId:'rent',category:'RENT',label:'屋租',plannedMonthlyMinor:500000}],
    });
    expect(result.state).toBe('UNKNOWN');
    expect(result.message).toContain('重新讀取');
  });

});
