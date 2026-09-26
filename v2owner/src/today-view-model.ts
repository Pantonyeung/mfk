import type {
  OwnerActionItem,
  OwnerHealthKind,
  OwnerReadModelSnapshot,
  OwnerReadinessItem,
} from './product-types';

export interface OwnerTodayActionSummary {
  readonly openCount:number;
  readonly topSeverity:OwnerActionItem|null;
  readonly oldestUnresolved:OwnerActionItem|null;
}

export interface OwnerTodayHealthEntry {
  readonly kind:Exclude<OwnerHealthKind,'OTHER'>;
  readonly label:string;
  readonly value:string;
  readonly tone:OwnerReadinessItem['tone'];
  readonly observedAt:string;
}

export interface OwnerTodayHealthSummary {
  readonly internet:OwnerTodayHealthEntry|null;
  readonly keeta:OwnerTodayHealthEntry|null;
  readonly ownPlatform:OwnerTodayHealthEntry|null;
  readonly smt:OwnerTodayHealthEntry|null;
  readonly printer:OwnerTodayHealthEntry|null;
}

export interface OwnerTodayStaffSummary {
  readonly workingNow:number|null;
  readonly scheduledNow:number|null;
  readonly onBreak:number|null;
  readonly abnormal:number|null;
}

export interface OwnerTodayInsightViewModel {
  readonly topProductLabel:string|null;
  readonly currentHourTrendLabel:string|null;
  readonly observedAt:string|null;
  readonly freshness:string|null;
}

export interface OwnerTodayViewModel {
  readonly storeName:string;
  readonly businessDate:string;
  readonly operatingStatus:string|null;
  readonly observedAt?:string;
  readonly storeFreshness:string|null;
  readonly salesLabel?:string;
  readonly orderCount?:number;
  readonly averageOrderLabel?:string;
  readonly comparisonLabel?:string;
  readonly liveOrders:NonNullable<OwnerReadModelSnapshot['liveOrders']>|null;
  readonly dineIn:NonNullable<OwnerReadModelSnapshot['dineIn']>|null;
  readonly actionSummary:OwnerTodayActionSummary;
  readonly healthSummary:OwnerTodayHealthSummary;
  readonly staffSummary:OwnerTodayStaffSummary;
  readonly insight:OwnerTodayInsightViewModel;
}

const severityRank:Record<OwnerActionItem['severity'],number>={URGENT:3,ATTENTION:2,INFO:1};

function firstHealth(snapshot:OwnerReadModelSnapshot|null,kind:Exclude<OwnerHealthKind,'OTHER'>,label:string):OwnerTodayHealthEntry|null{
  const item=snapshot?.readiness.find(row=>row.kind===kind);
  if(!item)return null;
  return {kind,label,value:item.value,tone:item.tone,observedAt:item.observedAt};
}

export function buildOwnerTodayViewModel(snapshot:OwnerReadModelSnapshot|null):OwnerTodayViewModel{
  const actions=[...(snapshot?.actions??[])];
  const topSeverity=actions.sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]||a.observedAt.localeCompare(b.observedAt))[0]??null;
  const oldestUnresolved=[...(snapshot?.actions??[])].sort((a,b)=>a.observedAt.localeCompare(b.observedAt))[0]??null;

  return {
    storeName:snapshot?.store?.storeName??'未連接門店',
    businessDate:snapshot?.store?.businessDate??'營業日未有資料',
    operatingStatus:snapshot?.store?.operatingStatus??null,
    observedAt:snapshot?.store?.observedAt,
    storeFreshness:snapshot?.store?.freshness??null,
    salesLabel:snapshot?.today?.salesLabel,
    orderCount:snapshot?.today?.orderCount,
    averageOrderLabel:snapshot?.today?.averageOrderLabel,
    comparisonLabel:snapshot?.today?.comparisonLabel,
    liveOrders:snapshot?.liveOrders??null,
    dineIn:snapshot?.dineIn??null,
    actionSummary:{
      openCount:snapshot?.actions.length??0,
      topSeverity,
      oldestUnresolved,
    },
    healthSummary:{
      internet:firstHealth(snapshot,'INTERNET','Internet'),
      keeta:firstHealth(snapshot,'KEETA','Keeta'),
      ownPlatform:firstHealth(snapshot,'OWN_PLATFORM','自家平台'),
      smt:firstHealth(snapshot,'SMT','SMT'),
      printer:firstHealth(snapshot,'PRINTER','Printer'),
    },
    staffSummary:{
      workingNow:snapshot?.today?.staffNow??null,
      scheduledNow:snapshot?.today?.scheduledStaffCount??null,
      onBreak:snapshot?.today?.onBreakStaffCount??null,
      abnormal:snapshot?.today?.abnormalStaffCount??null,
    },
    insight:{
      topProductLabel:snapshot?.insight?.topProductLabel??null,
      currentHourTrendLabel:snapshot?.insight?.currentHourTrendLabel??null,
      observedAt:snapshot?.insight?.observedAt??null,
      freshness:snapshot?.insight?.freshness??null,
    },
  };
}
