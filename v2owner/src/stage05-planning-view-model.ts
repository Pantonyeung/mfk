import type {OwnerReadModelSnapshot} from './product-types';
import {OWNER_COST_DEFINITIONS,type OwnerCostKey,type OwnerMonthlyPlanDraft} from './stage05-planning-persistence';
import {calculateOwnerCostTotals,calculateOwnerTargetProgress} from './stage05-planning-math';

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
  return validBusinessDate(snapshot?.planningBasis?.businessDate)??validBusinessDate(snapshot?.store?.businessDate)??hktDate(now);
}

export function resolveOwnerPlanningMonth(snapshot:OwnerReadModelSnapshot|null,now=new Date()){
  const basisMonth=String(snapshot?.planningBasis?.month||'');
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(basisMonth)?basisMonth:resolveOwnerPlanningBusinessDate(snapshot,now).slice(0,7);
}

export function buildOwnerPlanningViewModel(
  snapshot:OwnerReadModelSnapshot|null,
  plan:OwnerMonthlyPlanDraft,
  now=new Date(),
):OwnerPlanningViewModel{
  const businessDate=resolveOwnerPlanningBusinessDate(snapshot,now);
  const month=resolveOwnerPlanningMonth(snapshot,now);
  const basis=snapshot?.planningBasis;
  const mtdAvailable=basis?.sourceMetric==='CURRENT_EFFECTIVE_SALES'
    &&basis.sourceAuthority==='CANONICAL_REPORTING_PROJECTION'
    &&basis.currentEffectiveSalesMtdMinor!==null
    &&typeof basis.currentEffectiveSalesMtdMinor==='number'
    &&Number.isFinite(basis.currentEffectiveSalesMtdMinor);
  const mtdMinor=mtdAvailable?Math.round(basis?.currentEffectiveSalesMtdMinor??0):0;
  const activePlan=plan.monthKey===month?plan:null;
  const targetMinor=activePlan?.targetMinor??null;
  const {remainingMinor,attainmentPct,dailyNeededMinor,projectedTargetDate}=calculateOwnerTargetProgress({
    businessDate,mtdAvailable,mtdMinor,targetMinor,
  });
  const [,monthPart]=businessDate.split('-').map(Number);
  const year=Number(businessDate.slice(0,4));
  const daysInMonth=new Date(Date.UTC(year,monthPart,0)).getUTCDate();
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
  const {plannedCostMinor,actualCostMinor,actualCostFilled,actualCostTotal,actualCostComplete}=calculateOwnerCostTotals(costRows);
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
