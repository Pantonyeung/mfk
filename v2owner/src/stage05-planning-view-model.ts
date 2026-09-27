import type {OwnerReadModelSnapshot} from './product-types';
import {OWNER_COST_DEFINITIONS,type OwnerCostKey,type OwnerMonthlyPlan} from './stage05-planning-persistence';

export interface OwnerPlanningViewModel{
  readonly month:string;
  readonly sourceMetric:'CURRENT_EFFECTIVE_SALES';
  readonly mtdAvailable:boolean;
  readonly mtdMinor:number;
  readonly mtdLabel:string;
  readonly targetMinor:number|null;
  readonly targetLabel:string;
  readonly remainingMinor:number|null;
  readonly remainingLabel:string;
  readonly attainmentPct:number|null;
  readonly attainmentLabel:string;
  readonly dailyNeededMinor:number|null;
  readonly dailyNeededLabel:string;
  readonly dailyNeededBasis:string;
  readonly projectedTargetDate:string|null;
  readonly projectedTargetLabel:string;
  readonly plannedCostMinor:number;
  readonly plannedCostLabel:string;
  readonly actualCostMinor:number;
  readonly actualCostLabel:string;
  readonly actualCostFilled:number;
  readonly actualCostTotal:number;
  readonly actualCostComplete:boolean;
  readonly estimatedOperatingProfitMinor:number|null;
  readonly estimatedOperatingProfitLabel:string;
  readonly estimatedOperatingProfitTitle:string;
  readonly costRows:readonly {
    key:OwnerCostKey;
    label:string;
    plannedMinor:number|null;
    actualToDateMinor:number|null;
  }[];
}

function money(minor:number|null){
  if(minor===null||!Number.isFinite(minor))return '—';
  const sign=minor<0?'-':'';
  const abs=Math.abs(Math.round(minor));
  const dollars=abs/100;
  return sign+'HK$'+dollars.toLocaleString('zh-HK',{minimumFractionDigits:abs%100===0?0:2,maximumFractionDigits:2});
}

function validBusinessDate(value:string|undefined){
  return /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(String(value||''))?String(value):null;
}

function hktDate(now:Date){
  return new Date(now.getTime()+8*60*60*1000).toISOString().slice(0,10);
}

export function resolveOwnerPlanningBusinessDate(snapshot:OwnerReadModelSnapshot|null,now=new Date()){
  return validBusinessDate(snapshot?.store?.businessDate)??hktDate(now);
}

export function resolveOwnerPlanningMonth(snapshot:OwnerReadModelSnapshot|null,now=new Date()){
  return resolveOwnerPlanningBusinessDate(snapshot,now).slice(0,7);
}

function addCalendarDays(date:string,days:number){
  const [year,month,day]=date.split('-').map(Number);
  const at=new Date(Date.UTC(year,month-1,day+days));
  return at.toISOString().slice(0,10);
}

export function buildOwnerPlanningViewModel(
  snapshot:OwnerReadModelSnapshot|null,
  plan:OwnerMonthlyPlan,
  now=new Date(),
):OwnerPlanningViewModel{
  const businessDate=resolveOwnerPlanningBusinessDate(snapshot,now);
  const month=businessDate.slice(0,7);
  const canonicalRows=(snapshot?.reports??[]).filter(row=>
    row.metricKind==='CURRENT_EFFECTIVE_SALES'
    &&typeof row.currentEffectiveSalesMinor==='number'
    &&Number.isFinite(row.currentEffectiveSalesMinor)
    &&row.businessDate?.startsWith(month)
    &&row.businessDate<=businessDate
  );
  const mtdAvailable=canonicalRows.length>0;
  const mtdMinor=canonicalRows.reduce((sum,row)=>sum+Math.round(row.currentEffectiveSalesMinor??0),0);
  const activePlan=plan.month===month?plan:null;
  const targetMinor=activePlan?.targetMinor??null;
  const remainingMinor=targetMinor!==null&&mtdAvailable?Math.max(0,targetMinor-mtdMinor):null;
  const attainmentPct=targetMinor!==null&&targetMinor>0&&mtdAvailable?mtdMinor/targetMinor*100:null;

  const [,monthPart,dayPart]=businessDate.split('-').map(Number);
  const year=Number(businessDate.slice(0,4));
  const daysInMonth=new Date(Date.UTC(year,monthPart,0)).getUTCDate();
  const elapsedDays=Math.max(1,dayPart);
  const remainingDaysInclusive=Math.max(1,daysInMonth-dayPart+1);
  const dailyNeededMinor=remainingMinor===null?null:remainingMinor===0?0:Math.ceil(remainingMinor/remainingDaysInclusive);
  const averageDailyMinor=mtdAvailable&&elapsedDays>0?mtdMinor/elapsedDays:0;
  const projectedDays=remainingMinor!==null&&remainingMinor>0&&averageDailyMinor>0?Math.ceil(remainingMinor/averageDailyMinor):0;
  const projectedTargetDate=remainingMinor===0&&targetMinor!==null
    ?businessDate
    :projectedDays>0
      ?addCalendarDays(businessDate,projectedDays)
      :null;
  const monthEnd=businessDate.slice(0,8)+String(daysInMonth).padStart(2,'0');
  const projectedTargetLabel=remainingMinor===0&&targetMinor!==null
    ?'已達標'
    :projectedTargetDate
      ?projectedTargetDate<=monthEnd
        ?projectedTargetDate+'（按 MTD 日均速度）'
        :projectedTargetDate+'（按目前速度未能於本月達標）'
      :'暫未能估算';

  const costRows=OWNER_COST_DEFINITIONS.map(({key,label})=>({
    key,label,
    plannedMinor:activePlan?.costs[key]?.plannedMinor??null,
    actualToDateMinor:activePlan?.costs[key]?.actualToDateMinor??null,
  }));
  const plannedCostMinor=costRows.reduce((sum,row)=>sum+(row.plannedMinor??0),0);
  const actualCostRows=costRows.filter(row=>row.actualToDateMinor!==null);
  const actualCostMinor=actualCostRows.reduce((sum,row)=>sum+(row.actualToDateMinor??0),0);
  const actualCostFilled=actualCostRows.length;
  const actualCostTotal=costRows.length;
  const actualCostComplete=actualCostFilled===actualCostTotal;
  const estimatedOperatingProfitMinor=mtdAvailable&&actualCostFilled>0?mtdMinor-actualCostMinor:null;

  return Object.freeze({
    month,
    sourceMetric:'CURRENT_EFFECTIVE_SALES',
    mtdAvailable,
    mtdMinor,
    mtdLabel:mtdAvailable?money(mtdMinor):'—',
    targetMinor,
    targetLabel:money(targetMinor),
    remainingMinor,
    remainingLabel:money(remainingMinor),
    attainmentPct,
    attainmentLabel:attainmentPct===null?'—':attainmentPct.toLocaleString('zh-HK',{minimumFractionDigits:0,maximumFractionDigits:1})+'%',
    dailyNeededMinor,
    dailyNeededLabel:money(dailyNeededMinor),
    dailyNeededBasis:'按本月餘下日曆日（含今日）',
    projectedTargetDate,
    projectedTargetLabel,
    plannedCostMinor,
    plannedCostLabel:money(plannedCostMinor),
    actualCostMinor,
    actualCostLabel:money(actualCostMinor),
    actualCostFilled,
    actualCostTotal,
    actualCostComplete,
    estimatedOperatingProfitMinor,
    estimatedOperatingProfitLabel:money(estimatedOperatingProfitMinor),
    estimatedOperatingProfitTitle:actualCostComplete?'估算營運淨利':'估算營運淨利（按已輸入成本）',
    costRows:Object.freeze(costRows),
  });
}
