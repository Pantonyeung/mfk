import {useEffect,useMemo,useState} from 'react';
import type {OwnerConnectionState,OwnerReadModelSnapshot} from './product-types';
import {
  OWNER_COST_DEFINITIONS,
  readOwnerMonthlyPlan,
  writeOwnerMonthlyPlan,
  type OwnerCostKey,
  type OwnerMonthlyPlan,
} from './stage05-planning-persistence';
import {buildOwnerPlanningViewModel,resolveOwnerPlanningMonth} from './stage05-planning-view-model';

function inputValue(minor:number|null){
  if(minor===null)return '';
  return String(Math.round(minor)/100);
}

function parseInput(value:string){
  const cleaned=value.replace(/[^0-9.]/g,'');
  if(!cleaned)return null;
  const amount=Number(cleaned);
  return Number.isFinite(amount)&&amount>=0?Math.round(amount*100):null;
}

function planWithTarget(plan:OwnerMonthlyPlan,targetMinor:number|null):OwnerMonthlyPlan{
  return {...plan,targetMinor,updatedAt:new Date().toISOString()};
}

function planWithCost(plan:OwnerMonthlyPlan,key:OwnerCostKey,field:'plannedMinor'|'actualToDateMinor',value:number|null):OwnerMonthlyPlan{
  return {
    ...plan,
    costs:{
      ...plan.costs,
      [key]:{...plan.costs[key],[field]:value},
    },
    updatedAt:new Date().toISOString(),
  };
}

export function MonthlyPlanningWorkspace({
  snapshot,
  connection,
}:{
  snapshot:OwnerReadModelSnapshot|null;
  connection:OwnerConnectionState;
}){
  const month=resolveOwnerPlanningMonth(snapshot);
  const [plan,setPlan]=useState<OwnerMonthlyPlan>(()=>readOwnerMonthlyPlan(month));
  useEffect(()=>{setPlan(readOwnerMonthlyPlan(month));},[month]);

  const update=(next:OwnerMonthlyPlan)=>{
    const stored=writeOwnerMonthlyPlan(next);
    setPlan(stored);
  };
  const vm=useMemo(()=>buildOwnerPlanningViewModel(snapshot,plan),[snapshot,plan]);
  const progress=vm.attainmentPct===null?0:Math.max(0,Math.min(100,vm.attainmentPct));

  return <section className="planning-workspace">
    <p className="callout">MTD 只讀 canonical Current Effective Sales。目標同成本係 Owner 本機計劃輸入，唔會改 Order、Pricing 或 Reporting truth。</p>

    <section className="planning-target-card">
      <header><div><small>{vm.month}</small><h3>月營業額目標</h3></div><span>{vm.sourceMetric==='CURRENT_EFFECTIVE_SALES'?'正式有效營業額':'—'}</span></header>
      <label className="planning-money-input">
        <span>本月 Target（HK$）</span>
        <input
          inputMode="decimal"
          value={inputValue(plan.targetMinor)}
          onChange={event=>update(planWithTarget(plan,parseInput(event.target.value)))}
          placeholder="例如 200000"
        />
      </label>
      <div className="planning-progress" aria-label="達標率"><i style={{width:progress+'%'}}/></div>
      <div className="planning-metric-grid">
        <div><span>MTD</span><strong>{vm.mtdLabel}</strong><small>Current Effective Sales</small></div>
        <div><span>尚欠</span><strong>{vm.remainingLabel}</strong><small>Target − MTD</small></div>
        <div><span>達標率</span><strong>{vm.attainmentLabel}</strong><small>MTD / Target</small></div>
        <div><span>每日所需</span><strong>{vm.dailyNeededLabel}</strong><small>{vm.dailyNeededBasis}</small></div>
      </div>
      <div className="planning-forecast"><span>預計達標時間</span><strong>{vm.projectedTargetLabel}</strong></div>
      {!vm.mtdAvailable?<p className="planning-warning">今月尚未有 canonical Current Effective Sales 數值讀回；禁止用訂單列表或畫面金額自行重算。</p>:null}
    </section>

    <section className="planning-cost-card">
      <header><div><small>成本規劃</small><h3>計劃成本／實際至今</h3></div><span>{vm.actualCostFilled}/{vm.actualCostTotal} 已填</span></header>
      <div className="planning-cost-head"><span>項目</span><span>計劃</span><span>實際至今</span></div>
      {OWNER_COST_DEFINITIONS.map(({key,label})=><div className="planning-cost-row" key={key}>
        <strong>{label}</strong>
        <label><span className="sr-only">{label}計劃成本</span><input inputMode="decimal" value={inputValue(plan.costs[key].plannedMinor)} onChange={event=>update(planWithCost(plan,key,'plannedMinor',parseInput(event.target.value)))} placeholder="0"/></label>
        <label><span className="sr-only">{label}實際至今成本</span><input inputMode="decimal" value={inputValue(plan.costs[key].actualToDateMinor)} onChange={event=>update(planWithCost(plan,key,'actualToDateMinor',parseInput(event.target.value)))} placeholder="未填"/></label>
      </div>)}
      <div className="planning-cost-summary">
        <div><span>計劃成本合計</span><strong>{vm.plannedCostLabel}</strong></div>
        <div><span>已輸入實際成本</span><strong>{vm.actualCostLabel}</strong></div>
        <div className="planning-profit"><span>{vm.estimatedOperatingProfitTitle}</span><strong>{vm.estimatedOperatingProfitLabel}</strong></div>
      </div>
      {!vm.actualCostComplete?<p className="planning-warning">成本未完整，所以淨利只係按已輸入成本估算；唔會標示成正式會計淨利。</p>:null}
      {connection==='OFFLINE_READONLY'?<p className="planning-note">目前離線：你仍可編輯本機 Target／成本；MTD 保持最後一次已讀回嘅 canonical projection。</p>:null}
    </section>
  </section>;
}
