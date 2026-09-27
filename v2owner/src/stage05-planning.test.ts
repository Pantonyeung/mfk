import {describe,expect,it} from 'vitest';
import {buildOwnerPlanningViewModel} from './stage05-planning-view-model';
import type {OwnerMonthlyPlan} from './stage05-planning-persistence';
import type {OwnerReadModelSnapshot} from './product-types';

const plan:OwnerMonthlyPlan={
  schemaVersion:1,
  storageKind:'LOCAL_NON_AUTHORITATIVE_PLANNING',
  month:'2026-09',
  targetMinor:20000000,
  costs:{
    rent:{plannedMinor:3000000,actualToDateMinor:3000000},
    water:{plannedMinor:100000,actualToDateMinor:80000},
    electricity:{plannedMinor:500000,actualToDateMinor:420000},
    gas:{plannedMinor:200000,actualToDateMinor:170000},
    labour:{plannedMinor:4000000,actualToDateMinor:3500000},
    other:{plannedMinor:500000,actualToDateMinor:300000},
  },
  updatedAt:'2026-09-27T00:00:00Z',
};

const snapshot={
  globalState:'PARTIAL',
  store:{storeId:'MF01',storeName:'磨飯',businessDate:'2026-09-27',operatingStatus:'OPEN',observedAt:'2026-09-27T12:00:00+08:00',freshness:'FRESH'},
  planningBasis:{
    month:'2026-09',
    businessDate:'2026-09-27',
    sourceMetric:'CURRENT_EFFECTIVE_SALES',
    sourceAuthority:'CANONICAL_REPORTING_PROJECTION',
    currentEffectiveSalesMtdMinor:1300000,
    metricVersion:'MFK_CURRENT_EFFECTIVE_SALES_V1',
    completeness:'PARTIAL',
    observedAt:'2026-09-27T12:00:00+08:00',
  },
  liveOrders:{activeCount:0,readyCount:0,recentOrders:[],observedAt:'2026-09-27T12:00:00+08:00'},
  readiness:[],actions:[],orders:[],channels:[],sellability:[],staff:[],devices:[],
  reports:[
    {reportId:'legacy',name:'legacy',value:'HK$999,999',freshness:'LEGACY',businessDate:'2026-09-25',currentEffectiveSalesMinor:99999900},
  ],
  campaigns:[],settlements:[],inventory:[],notifications:[],activity:[],observedAt:'2026-09-27T12:00:00+08:00',
} as unknown as OwnerReadModelSnapshot;
describe('OA-PLN-001 monthly planning',()=>{
  it('consumes only canonical Current Effective Sales MTD basis and derives target metrics',()=>{
    const vm=buildOwnerPlanningViewModel(snapshot,plan,new Date('2026-09-27T04:00:00Z'));
    expect(vm.mtdMinor).toBe(1300000);
    expect(vm.remainingMinor).toBe(18700000);
    expect(vm.attainmentPct).toBeCloseTo(6.5);
    expect(vm.dailyNeededMinor).toBe(4675000);
    expect(vm.sourceMetric).toBe('CURRENT_EFFECTIVE_SALES');
  });

  it('subtracts actual-to-date costs rather than planned costs from MTD',()=>{
    const vm=buildOwnerPlanningViewModel(snapshot,plan,new Date('2026-09-27T04:00:00Z'));
    expect(vm.actualCostMinor).toBe(7470000);
    expect(vm.plannedCostMinor).toBe(8300000);
    expect(vm.estimatedOperatingProfitMinor).toBe(-6170000);
    expect(vm.actualCostComplete).toBe(true);
  });

  it('labels profit as partial estimate when any actual cost is missing',()=>{
    const incomplete:OwnerMonthlyPlan={
      ...plan,
      costs:{...plan.costs,other:{...plan.costs.other,actualToDateMinor:null}},
    };
    const vm=buildOwnerPlanningViewModel(snapshot,incomplete,new Date('2026-09-27T04:00:00Z'));
    expect(vm.actualCostComplete).toBe(false);
    expect(vm.estimatedOperatingProfitTitle).toContain('按已輸入成本');
  });

  it('does not fabricate MTD from order or display totals when canonical metric is absent',()=>{
    const withoutMetric={...snapshot,planningBasis:undefined} as OwnerReadModelSnapshot;
    const vm=buildOwnerPlanningViewModel(withoutMetric,plan,new Date('2026-09-27T04:00:00Z'));
    expect(vm.mtdAvailable).toBe(false);
    expect(vm.mtdLabel).toBe('—');
    expect(vm.remainingMinor).toBeNull();
    expect(vm.dailyNeededMinor).toBeNull();
  });
});
