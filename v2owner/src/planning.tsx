import {useEffect,useMemo,useState} from 'react';
import type {OwnerCostCategory,OwnerMonthlyCostLine,OwnerPlanningSaveInput,OwnerPlanningSnapshot} from './product-types';

function hk(minor:number){
  const value=Number(minor)||0;
  return (value<0?'-':'')+'HK$'+(Math.abs(value)/100).toLocaleString('en-HK',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function dollarsToMinor(value:string){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?Math.round(n*100):0;
}
function minorToInput(value:number|undefined){
  return value===undefined?'':String((Math.max(0,value)/100).toFixed(2)).replace(/\.00$/,'');
}
function coverageLabel(value:OwnerPlanningSnapshot['metrics']['costCoverage']){
  return value==='COMPLETE'?'COMPLETE｜完整':value==='MANUAL_ESTIMATE'?'MANUAL_ESTIMATE｜只按已輸入資料估算':'PARTIAL｜部分資料';
}
function categoryLabel(value:OwnerCostCategory){
  const map:Record<OwnerCostCategory,string>={
    RENT:'屋租',
    UTILITIES_WATER:'水',
    UTILITIES_ELECTRICITY:'電',
    UTILITIES_GAS:'煤氣',
    LABOR:'人工',
    OTHER:'其他',
    CUSTOM:'自訂',
  };
  return map[value];
}

export function MonthlyTargetSummaryCard({value,onOpen}:{value:OwnerPlanningSnapshot|null|undefined;onOpen:()=>void}){
  if(!value||value.plan.revision===0&&value.metrics.monthlyRevenueTargetMinor===0){
    return <article className="card planning-summary empty-planning">
      <div><span>今月目標</span><strong>尚未設定</strong></div>
      <button onClick={onOpen}>設定</button>
    </article>;
  }
  const m=value.metrics;
  return <article className="card planning-summary">
    <header>
      <div><span>今月目標</span><strong>{hk(m.currentEffectiveSalesMinor)} / {hk(m.monthlyRevenueTargetMinor)}</strong></div>
      <button onClick={onOpen}>查看</button>
    </header>
    <div className="planning-summary-grid">
      <div><span>達標</span><b>{m.achievementPercent.toFixed(1)}%</b></div>
      <div><span>尚欠</span><b>{m.remainingMinor<=0?'本月目標已達成':hk(m.remainingMinor)}</b></div>
      <div><span>每日所需</span><b>{hk(m.requiredDailyAverageMinor)}</b></div>
      {m.actualCostAvailable&&m.estimatedOperatingProfitToDateMinor!==undefined
        ?<div><span>估算營運淨利</span><b>{hk(m.estimatedOperatingProfitToDateMinor)}</b></div>
        :null}
    </div>
    <small>{m.paceState==='TARGET_REACHED'?'本月目標已達成':m.paceState==='ON_TRACK'?'On Track／進度正常':'Attention／需要留意'} · 深入管理 → 營業目標與成本</small>
  </article>;
}

type DraftLine={
  costLineId:string;
  category:OwnerCostCategory;
  label:string;
  planned:string;
  actual:string;
  note:string;
};

function toDraft(line:OwnerMonthlyCostLine):DraftLine{
  return {
    costLineId:line.costLineId,
    category:line.category,
    label:line.label,
    planned:minorToInput(line.plannedMonthlyMinor),
    actual:minorToInput(line.actualToDateMinor),
    note:line.note??'',
  };
}

export function PlanningPage({
  value,loading,saving,onMonthChange,onSave,onBack,
}:{
  value:OwnerPlanningSnapshot|null;
  loading:boolean;
  saving:boolean;
  onMonthChange:(monthKey:string)=>void;
  onSave:(input:OwnerPlanningSaveInput)=>void;
  onBack:()=>void;
}){
  const [monthKey,setMonthKey]=useState(value?.plan.monthKey??new Date(Date.now()+8*60*60*1000).toISOString().slice(0,7));
  const [target,setTarget]=useState('0');
  const [note,setNote]=useState('');
  const [lines,setLines]=useState<DraftLine[]>([]);

  useEffect(()=>{
    if(!value)return;
    setMonthKey(value.plan.monthKey);
    setTarget(minorToInput(value.plan.monthlyRevenueTargetMinor));
    setNote(value.plan.note??'');
    setLines(value.plan.costLines.map(toDraft));
  },[value?.plan.monthKey,value?.plan.revision]);

  const plannedTotal=useMemo(()=>lines.reduce((sum,line)=>sum+dollarsToMinor(line.planned),0),[lines]);

  const changeMonth=(next:string)=>{
    setMonthKey(next);
    onMonthChange(next);
  };
  const updateLine=(id:string,patch:Partial<DraftLine>)=>{
    setLines(current=>current.map(line=>line.costLineId===id?{...line,...patch}:line));
  };
  const addLine=()=>{
    setLines(current=>[...current,{
      costLineId:'custom-'+crypto.randomUUID(),
      category:'CUSTOM',
      label:'其他成本',
      planned:'0',
      actual:'',
      note:'',
    }]);
  };
  const save=()=>{
    if(!value)return;
    onSave({
      monthKey,
      monthlyRevenueTargetMinor:dollarsToMinor(target),
      note:note.trim()||undefined,
      baseRevision:value.plan.revision,
      operationId:crypto.randomUUID(),
      costLines:lines.map(line=>({
        costLineId:line.costLineId,
        category:line.category,
        label:line.label.trim()||categoryLabel(line.category),
        plannedMonthlyMinor:dollarsToMinor(line.planned),
        ...(line.actual.trim()?{actualToDateMinor:dollarsToMinor(line.actual)}:{}),
        ...(line.note.trim()?{note:line.note.trim()}:{}),
      })),
    });
  };

  return <section className="page planning-page">
    <header className="page-head secondary-head">
      <button className="back-link" onClick={onBack}>‹ 更多</button>
      <div>
        <span>OA-PLN-001</span>
        <h1>營業目標與成本</h1>
        <small>管理用規劃資料；唔會反向修改訂單、付款或正式營業額。</small>
      </div>
    </header>

    <label className="month-picker">
      <span>月份</span>
      <input type="month" value={monthKey} onChange={event=>changeMonth(event.target.value)}/>
    </label>

    {loading||!value
      ?<section className="card empty-state"><h2>讀取規劃資料</h2><p>等待 canonical planning readback。</p></section>
      :<>
        <section className="card planning-hero">
          <div className="planning-target-input">
            <label>
              <span>今月營業額目標</span>
              <div className="money-input"><b>HK$</b><input inputMode="decimal" value={target} onChange={e=>setTarget(e.target.value.replace(/[^0-9.]/g,''))}/></div>
            </label>
            <label>
              <span>備註</span>
              <input value={note} onChange={e=>setNote(e.target.value.slice(0,240))} placeholder="可選"/>
            </label>
          </div>

          <div className="planning-metrics">
            <div><span>有效營業額 MTD</span><strong>{hk(value.metrics.currentEffectiveSalesMinor)}</strong></div>
            <div><span>達標</span><strong>{value.metrics.achievementPercent.toFixed(1)}%</strong></div>
            <div><span>尚欠</span><strong>{value.metrics.remainingMinor<=0?'本月目標已達成':hk(value.metrics.remainingMinor)}</strong></div>
            <div><span>本月剩餘日數</span><strong>{value.metrics.remainingCalendarDays}</strong></div>
            {value.metrics.remainingOperatingDays!==undefined?<div><span>剩餘預計營業日</span><strong>{value.metrics.remainingOperatingDays}</strong></div>:null}
            <div><span>達標所需每日平均</span><strong>{hk(value.metrics.requiredDailyAverageMinor)}</strong></div>
            <div><span>目前實際每日平均</span><strong>{hk(value.metrics.actualDailyAverageMinor)}</strong></div>
            <div><span>進度</span><strong>{value.metrics.paceState==='TARGET_REACHED'?'已達標':value.metrics.paceState==='ON_TRACK'?'On Track':'Attention'}</strong></div>
          </div>

          {value.metrics.forecastTargetDate
            ?<p className="forecast-note"><b>預計 / Forecast</b> 按目前速度預計達標日期：{value.metrics.forecastTargetDate}</p>
            :null}
        </section>

        <section className="card cost-plan">
          <header>
            <div><span>本月成本計劃</span><h2>{hk(plannedTotal)}</h2></div>
            <button onClick={addLine}>＋ 其他成本</button>
          </header>
          <div className="cost-lines">
            {lines.map(line=><article className="cost-line" key={line.costLineId}>
              <div className="cost-line-title"><strong>{line.label||categoryLabel(line.category)}</strong><span>{categoryLabel(line.category)}</span></div>
              <label><span>名稱</span><input value={line.label} onChange={e=>updateLine(line.costLineId,{label:e.target.value.slice(0,80)})}/></label>
              <label><span>本月預算 HK$</span><input inputMode="decimal" value={line.planned} onChange={e=>updateLine(line.costLineId,{planned:e.target.value.replace(/[^0-9.]/g,'')})}/></label>
              <label><span>截至目前實際 HK$（可選）</span><input inputMode="decimal" value={line.actual} onChange={e=>updateLine(line.costLineId,{actual:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="未輸入"/></label>
              <label className="cost-note"><span>備註（可選）</span><input value={line.note} onChange={e=>updateLine(line.costLineId,{note:e.target.value.slice(0,240)})}/></label>
            </article>)}
          </div>
        </section>

        <section className="card profit-card">
          <header><span>目標／成本結果</span><b>{coverageLabel(value.metrics.costCoverage)}</b></header>
          <div className="metric-grid">
            <div><small>Monthly Planned Cost</small><strong>{hk(value.metrics.monthlyPlannedCostMinor)}</strong></div>
            <div><small>目標營運淨額</small><strong>{hk(value.metrics.targetOperatingSurplusMinor)}</strong></div>
            <div><small>Actual-to-date Cost</small><strong>{value.metrics.actualCostAvailable?hk(value.metrics.actualToDateCostMinor):'未輸入'}</strong></div>
            {value.metrics.actualCostAvailable&&value.metrics.estimatedOperatingProfitToDateMinor!==undefined
              ?<div><small>估算營運淨利（按已輸入成本）</small><strong>{hk(value.metrics.estimatedOperatingProfitToDateMinor)}</strong></div>
              :null}
          </div>
          {!value.metrics.actualCostAvailable
            ?<p className="callout">只有 Monthly Plan、冇 actual-to-date 成本；本月目標收入 - 預算成本 = 目標營運淨額。唔會將全月成本當成今日已發生成本。</p>
            :value.metrics.costCoverage!=='COMPLETE'
              ?<p className="callout">成本資料未完整；只顯示「估算營運淨利（按已輸入成本）」，唔會叫正式淨利或會計淨利。</p>
              :null}
        </section>

        <p className="planning-source">Sales Source：Current Effective Sales。Draft / Pending / External Pre-admission / 未結帳 Open Check / estimatedOpenAmount 不會加入。</p>
        <button className="primary wide planning-save" onClick={save} disabled={saving}>{saving?'保存及讀回中…':'保存規劃'}</button>
      </>}
  </section>;
}
