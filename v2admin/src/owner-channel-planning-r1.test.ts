import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {calculateOwnerPlanningMetrics,normalizeOwnerKeetaChannel,normalizeOwnerOwnPlatformChannel} from '../worker.ts';

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
    expect(channel.controls).toEqual({pause:true,resume:true,snooze:false,busy:false});
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

  it('canonical planning writer is bounded to AdminSyncStore and channel command is readback-first',()=>{
    const worker=fs.readFileSync(path.resolve(process.cwd(),'worker.ts'),'utf8');
    expect(worker).toContain("MFK_OWNER_MONTHLY_PLAN_V1");
    expect(worker).toContain("owner:planning:");
    expect(worker).toContain("recognizedSalesMinor");
    expect(worker).toContain("'/owner/planning'");
    expect(worker).toContain("'/owner/channels/command'");
    const readIndex=worker.indexOf("https://internal/admin/store/readback");
    const commandIndex=worker.indexOf("https://internal/admin/store/status/'+(action==='PAUSE'?'rest':'open')");
    expect(readIndex).toBeGreaterThan(-1);
    expect(commandIndex).toBeGreaterThan(readIndex);
    expect(worker).not.toContain('OWNER_FINANCE_DB');
  });
});
