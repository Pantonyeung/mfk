import {useEffect,useMemo,useState} from 'react';
import type {OwnerConnectionState,OwnerReadModelSnapshot,OwnerRuntimePort} from './product-types';
import {
  OWNER_COST_DEFINITIONS,
  ownerMonthlyPlanDraftFromCanonical,
  ownerMonthlyPlanSaveInputFromDraft,
  readOwnerMonthlyPlanDraft,
  writeOwnerMonthlyPlanDraft,
  type OwnerCostKey,
  type OwnerMonthlyPlanDraft,
} from './stage05-planning-persistence';
import {buildOwnerPlanningViewModel,resolveOwnerPlanningMonth} from './stage05-planning-view-model';

type CanonicalReadState='LOADING'|'CONFIRMED'|'EMPTY'|'UNKNOWN';
type CanonicalSaveState='IDLE'|'SAVING'|'CONFIRMED'|'REJECTED'|'UNKNOWN';

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

function planWithTarget(plan:OwnerMonthlyPlanDraft,targetMinor:number|null):OwnerMonthlyPlanDraft{
  return {...plan,targetMinor,updatedAt:new Date().toISOString()};
}

function planWithCost(plan:OwnerMonthlyPlanDraft,key:OwnerCostKey,field:'plannedMinor'|'actualToDateMinor',value:number|null):OwnerMonthlyPlanDraft{
  return {
    ...plan,
    costs:{
      ...plan.costs,
      [key]:{...plan.costs[key],[field]:value},
    },
    updatedAt:new Date().toISOString(),
  };
}

function planWithNote(plan:OwnerMonthlyPlanDraft,note:string):OwnerMonthlyPlanDraft{
  return {...plan,note:note.slice(0,1000),updatedAt:new Date().toISOString()};
}

export function MonthlyPlanningWorkspace({
  snapshot,
  connection,
  runtime,
}:{
  snapshot:OwnerReadModelSnapshot|null;
  connection:OwnerConnectionState;
  runtime:OwnerRuntimePort|null;
}){
  const month=resolveOwnerPlanningMonth(snapshot);
  const [plan,setPlan]=useState<OwnerMonthlyPlanDraft>(()=>readOwnerMonthlyPlanDraft(month));
  const [readState,setReadState]=useState<CanonicalReadState>('LOADING');
  const [saveState,setSaveState]=useState<CanonicalSaveState>('IDLE');
  const [statusMessage,setStatusMessage]=useState('正在讀取 canonical 月度計劃。');
  const [dirty,setDirty]=useState(false);

  const readCanonical=async()=>{
    const cached=readOwnerMonthlyPlanDraft(month);
    setPlan(cached);
    setReadState('LOADING');
    setSaveState('IDLE');
    setStatusMessage('正在讀取 canonical 月度計劃。');
    if(!runtime?.readMonthlyPlan){
      setReadState('UNKNOWN');
      setStatusMessage('Canonical 月度計劃服務未連接；本機資料只係草稿／快取，唔會當成正式 Planning truth。');
      return;
    }
    try{
      const result=await runtime.readMonthlyPlan(month);
      if(result.state==='CONFIRMED'&&result.plan){
        const canonicalDraft=writeOwnerMonthlyPlanDraft(ownerMonthlyPlanDraftFromCanonical(result.plan));
        setPlan(canonicalDraft);
        setReadState('CONFIRMED');
        setDirty(false);
        setStatusMessage('已讀回 canonical 月度計劃 Revision '+result.revision+'。');
        return;
      }
      if(result.state==='EMPTY'){
        const fresh={...cached,baseRevision:0} as OwnerMonthlyPlanDraft;
        setPlan(writeOwnerMonthlyPlanDraft(fresh));
        setReadState('EMPTY');
        setStatusMessage('呢個月份未有 canonical 計劃；目前輸入只係草稿，第一次儲存會由 Revision 0 開始。');
        return;
      }
      setReadState('UNKNOWN');
      setStatusMessage(result.message??'Canonical 月度計劃讀回結果未明；禁止用本機草稿冒充正式資料。');
    }catch{
      setReadState('UNKNOWN');
      setStatusMessage('Canonical 月度計劃讀回失敗；本機資料只係草稿／快取。');
    }
  };

  useEffect(()=>{void readCanonical();},[month,runtime]);

  const update=(next:OwnerMonthlyPlanDraft)=>{
    const stored=writeOwnerMonthlyPlanDraft(next);
    setPlan(stored);
    setDirty(true);
    if(saveState!=='SAVING')setSaveState('IDLE');
  };

  const saveCanonical=async()=>{
    if(!runtime?.saveMonthlyPlan||!runtime.readMonthlyPlan){
      setSaveState('UNKNOWN');
      setStatusMessage('Canonical Planning write seam 未連接；未有任何正式計劃被保存。');
      return;
    }
    if(readState!=='CONFIRMED'&&readState!=='EMPTY'){
      setSaveState('UNKNOWN');
      setStatusMessage('未取得 READ CURRENT，禁止儲存；請先重新讀取 canonical 月度計劃。');
      return;
    }
    setSaveState('SAVING');
    setStatusMessage('正在用 expectedRevision '+plan.baseRevision+' 儲存，之後會重新讀回確認。');
    const input=ownerMonthlyPlanSaveInputFromDraft(plan,crypto.randomUUID());
    try{
      const result=await runtime.saveMonthlyPlan(input);
      if(result.state==='REJECTED'){
        setSaveState('REJECTED');
        setStatusMessage(result.message||'Revision conflict；請重新讀取 canonical 月度計劃。');
        return;
      }
      if(result.state!=='CONFIRMED'||!result.plan){
        setSaveState('UNKNOWN');
        setStatusMessage(result.message||'儲存結果未明；禁止當成成功，請重新讀取 canonical 月度計劃。');
        return;
      }
      const readback=await runtime.readMonthlyPlan(month);
      if(readback.state!=='CONFIRMED'||!readback.plan||readback.revision!==result.revision){
        setSaveState('UNKNOWN');
        setStatusMessage('Canonical apply 後 readback 未能確認同一 Revision；結果保持 UNKNOWN，禁止 fake green。');
        return;
      }
      const confirmed=writeOwnerMonthlyPlanDraft(ownerMonthlyPlanDraftFromCanonical(readback.plan));
      setPlan(confirmed);
      setReadState('CONFIRMED');
      setSaveState('CONFIRMED');
      setDirty(false);
      setStatusMessage('已 canonical apply + readback CONFIRMED，Revision '+readback.revision+'。');
    }catch{
      setSaveState('UNKNOWN');
      setStatusMessage('儲存結果未明；禁止當成成功，請重新讀取 canonical 月度計劃。');
    }
  };

  const vm=useMemo(()=>buildOwnerPlanningViewModel(snapshot,plan),[snapshot,plan]);
  const progress=vm.attainmentPct===null?0:Math.max(0,Math.min(100,vm.attainmentPct));
  const canSave=Boolean(runtime?.saveMonthlyPlan)&&(readState==='CONFIRMED'||readState==='EMPTY')&&saveState!=='SAVING';

  return <section className="planning-workspace">
    <p className="callout">MTD 只讀 canonical Current Effective Sales。Target／成本由 AdminSyncStore 嘅 MFK_OWNER_MONTHLY_PLAN_V1 保存；localStorage 只係草稿／快取，唔係正式 Planning truth。</p>

    <section className="planning-canonical-state" data-read-state={readState} data-save-state={saveState}>
      <div><span>Canonical Read</span><strong>{readState}</strong></div>
      <div><span>Revision</span><strong>{plan.baseRevision}</strong></div>
      <div><span>Save</span><strong>{saveState}</strong></div>
      <p>{statusMessage}</p>
      <button type="button" onClick={()=>void readCanonical()} disabled={readState==='LOADING'||saveState==='SAVING'}>重新讀取 canonical plan</button>
    </section>

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
      <label className="planning-note-input"><span>本月計劃備註</span><textarea value={plan.note} onChange={event=>update(planWithNote(plan,event.target.value))} placeholder="選填；只屬 Management Planning Domain"/></label>
      <div className="planning-cost-summary">
        <div><span>計劃成本合計</span><strong>{vm.plannedCostLabel}</strong></div>
        <div><span>已輸入實際成本</span><strong>{vm.actualCostLabel}</strong></div>
        <div className="planning-profit"><span>{vm.estimatedOperatingProfitTitle}</span><strong>{vm.estimatedOperatingProfitLabel}</strong></div>
      </div>
      {!vm.actualCostComplete?<p className="planning-warning">成本未完整，所以淨利只係按已輸入成本估算；唔會標示成正式會計淨利。</p>:null}
      {connection==='OFFLINE_READONLY'?<p className="planning-note">目前離線：可以保留本機草稿，但唔會將草稿當成 canonical Target／成本；恢復連線後必須 READ CURRENT 再儲存。</p>:null}
    </section>

    <section className="planning-save-card">
      <div><span>{dirty?'有未儲存變更':'已同步'}</span><strong>Expected Revision {plan.baseRevision}</strong></div>
      <button type="button" className="primary wide" disabled={!canSave||!dirty} onClick={()=>void saveCanonical()}>{saveState==='SAVING'?'正在保存並讀回…':'保存 canonical 月度計劃'}</button>
      {saveState==='REJECTED'?<p className="planning-warning">Revision conflict：資料已由另一個裝置更新。請先重新讀取，唔可以覆蓋新版本。</p>:null}
      {saveState==='UNKNOWN'?<p className="planning-warning">Save 結果 UNKNOWN；唔會顯示成成功。請重新讀取 canonical plan 確認。</p>:null}
    </section>
  </section>;
}
