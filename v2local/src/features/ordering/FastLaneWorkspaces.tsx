import {useMemo,useState} from 'react';
import type {SyncedCombo,SyncedComboPool} from '../../runtime/admin-config-projection.ts';
import {
  buildAutoPairingPlans,
  comboDraftCount,
  comboSlots,
  countMainCourseUnits,
  nextPairingIndex,
  pairingLabel,
  requiredTasks,
  type FastLaneCartLine,
  type FastLanePairPlan,
  type FastLaneProduct,
  type FastLaneRequiredTask,
} from './fast-lane-model.ts';
import './fast-lane-workspaces.css';

const money=(minor:number)=>(minor<0?'-':'')+String.fromCharCode(36)+(Math.abs(minor)/100).toFixed(2);

function ChoicePrice({minor}:{minor:number}){
  if(!minor)return null;
  return <small>{minor>0?'+':''}{money(minor)}</small>;
}

function TaskChoice({
  task,chosen,onToggle,
}:{
  task:FastLaneRequiredTask;
  chosen:readonly string[];
  onToggle:(id:string)=>void;
}){
  return <div className="fast-choice-grid">
    {task.options.map(option=><button
      type="button"
      key={option.id}
      className={chosen.includes(option.id)?'active':''}
      onClick={()=>onToggle(option.id)}
    ><b>{option.name}</b><ChoicePrice minor={option.priceAdjustmentMinor}/></button>)}
  </div>;
}

export function RequiredFastLaneWorkspace({
  cart,products,onApply,
}:{
  cart:readonly FastLaneCartLine[];
  products:readonly FastLaneProduct[];
  onApply:(lineId:string,groupId:string,optionIds:readonly string[])=>void;
}){
  const tasks=useMemo(()=>requiredTasks(cart,products),[cart,products]);
  const [draft,setDraft]=useState<Record<string,string[]>>({});
  const toggle=(task:FastLaneRequiredTask,optionId:string)=>{
    const current=draft[task.id]??[...task.selectedOptionIds];
    if(task.selection==='SINGLE'){
      setDraft(value=>({...value,[task.id]:[optionId]}));
      return;
    }
    const next=current.includes(optionId)?current.filter(id=>id!==optionId):[...current,optionId];
    setDraft(value=>({...value,[task.id]:next.slice(0,task.max)}));
  };

  return <div className="fast-lane">
    <header className="fast-lane-title">
      <div><small>ADMIN REQUIRED TRUTH</small><h2>必選區</h2><p>只列真正未完成嘅 Admin 必選組；逐項補齊，唔用硬編選項。</p></div>
      <strong>{tasks.length} 項</strong>
    </header>
    {tasks.length?<div className="fast-task-list">{tasks.map((task,index)=>{
      const chosen=draft[task.id]??task.selectedOptionIds;
      const ready=chosen.length>=task.min&&chosen.length<=task.max;
      return <article className="fast-task-card" key={task.id}>
        <header><span>{index+1}</span><div><b>{task.lineName}</b><small>{task.groupName} · 最少 {task.min} / 最多 {task.max}</small></div><em>欠 {task.missingCount}</em></header>
        <TaskChoice task={task} chosen={chosen} onToggle={id=>toggle(task,id)}/>
        <footer><span>{task.selection==='SINGLE'?'單選':'多選'} · 已選 {chosen.length}</span><button type="button" disabled={!ready} onClick={()=>onApply(task.lineId,task.groupId,chosen)}>套用到呢件商品</button></footer>
      </article>;
    })}</div>:<div className="fast-empty"><b>必選已齊</b><span>目前 Cart 冇未完成 Required group。</span></div>}
  </div>;
}

function PlanSummary({
  plan,cart,combo,pools,products,
}:{
  plan:FastLanePairPlan;
  cart:readonly FastLaneCartLine[];
  combo:SyncedCombo;
  pools:readonly SyncedComboPool[];
  products:readonly FastLaneProduct[];
}){
  const slots=comboSlots(combo,pools,products);
  const lineById=new Map(cart.map(line=>[line.id,line] as const));
  return <article className="fast-plan-card">
    <strong>{plan.pairingLabel} 組</strong>
    <div>{plan.selections.map(selection=>{
      const slot=slots.find(row=>row.groupId===selection.groupId);
      const choice=slot?.choices.find(row=>row.id===selection.choiceId);
      const line=selection.sourceLineId?lineById.get(selection.sourceLineId):undefined;
      return <span key={selection.groupId}><small>{slot?.groupName??selection.groupId}</small><b>{selection.deferred?'稍後補':line?.name??choice?.label??'未選'}</b></span>;
    })}</div>
  </article>;
}

export function RiceballPoolWorkspace({
  cart,products,combos,pools,onAutoPair,
}:{
  cart:readonly FastLaneCartLine[];
  products:readonly FastLaneProduct[];
  combos:readonly SyncedCombo[];
  pools:readonly SyncedComboPool[];
  onAutoPair:(plans:readonly FastLanePairPlan[])=>void;
}){
  const active=combos.filter(combo=>combo.active);
  const [selectedComboId,setSelectedComboId]=useState(active[0]?.id??'');
  const combo=active.find(row=>row.id===selectedComboId)??active[0];
  const start=nextPairingIndex(cart);
  const plans=useMemo(()=>buildAutoPairingPlans(cart,combo,pools,products,start),[cart,combo,pools,products,start]);
  const mainUnits=countMainCourseUnits(cart,active,pools,products);

  if(!combo)return <div className="fast-lane"><div className="fast-empty"><b>未有套餐規則</b><span>Admin 暫時未發布可用 Combo。</span></div></div>;

  return <div className="fast-lane">
    <header className="fast-lane-title">
      <div><small>REAL ASSIGNMENT</small><h2>飯團待組區</h2><p>用目前 Cart + Admin Combo pool 做真正配對；唔再只顯一粒假數字。</p></div>
      <strong>{mainUnits} 件主餐</strong>
    </header>
    {active.length>1?<nav className="fast-combo-tabs">{active.map(row=><button type="button" key={row.id} className={row.id===combo.id?'active':''} onClick={()=>setSelectedComboId(row.id)}>{row.name}<small>{money(row.basePriceMinor)}</small></button>)}</nav>:null}
    <section className="fast-auto-overview">
      <div><span>可即時自動組</span><b>{plans.length} 組</b></div>
      <div><span>目前套餐</span><b>{combo.name}</b></div>
      <div><span>已存在套餐</span><b>{comboDraftCount(cart)} 組</b></div>
    </section>
    {plans.length?<div className="fast-plan-grid">{plans.map(plan=><PlanSummary key={plan.pairingLabel} plan={plan} cart={cart} combo={combo} pools={pools} products={products}/>)}</div>
      :<div className="fast-empty compact"><b>未有完整主餐＋小食組合</b><span>飲品可以稍後補，但主餐／小食必須先符合 Admin Combo choice。</span></div>}
    <footer className="fast-sticky-action"><span>自動組合只會消耗已匹配 Cart unit；每組保持獨立 identity。</span><button type="button" disabled={!plans.length} onClick={()=>onAutoPair(plans)}>自動組合 {plans.length} 組</button></footer>
  </div>;
}

interface SpecifiedSelection{choiceId?:string;sourceLineId?:string;deferred?:boolean}

export function ComboFastLaneWorkspace({
  cart,products,combos,pools,onPair,onFillPending,onDissolve,
}:{
  cart:readonly FastLaneCartLine[];
  products:readonly FastLaneProduct[];
  combos:readonly SyncedCombo[];
  pools:readonly SyncedComboPool[];
  onPair:(plan:FastLanePairPlan)=>void;
  onFillPending:(comboLineId:string,groupId:string,choiceId:string,sourceLineId?:string)=>void;
  onDissolve:(comboLineId:string)=>void;
}){
  const active=combos.filter(combo=>combo.active);
  const [selectedComboId,setSelectedComboId]=useState(active[0]?.id??'');
  const [selected,setSelected]=useState<Record<string,SpecifiedSelection>>({});
  const combo=active.find(row=>row.id===selectedComboId)??active[0];
  const slots=useMemo(()=>combo?comboSlots(combo,pools,products):[],[combo,pools,products]);
  const existing=cart.filter(line=>Boolean(line.comboDraft));
  const nextLabel=pairingLabel(nextPairingIndex(cart));

  const select=(groupId:string,value:SpecifiedSelection)=>setSelected(current=>({...current,[groupId]:value}));
  const requiredMissing=slots.some(slot=>{
    if(!slot.required)return false;
    const value=selected[slot.groupId];
    return !value?.choiceId&&!value?.deferred;
  });

  const create=()=>{
    if(!combo||requiredMissing)return;
    const selections=slots.flatMap(slot=>{
      const value=selected[slot.groupId];
      if(!value)return [];
      return [{groupId:slot.groupId,...value}];
    });
    onPair({comboId:combo.id,comboName:combo.name,pairingLabel:nextLabel,source:'SPECIFIED',selections});
    setSelected({});
  };

  return <div className="fast-lane combo-lane">
    <header className="fast-lane-title">
      <div><small>ADMIN COMBO TRUTH</small><h2>紫米套餐區</h2><p>指定配對用 A／B／C… 管理；可以飲品稍後補，亦可以拆返原單品。</p></div>
      <strong>{existing.length} 組</strong>
    </header>

    {existing.length?<section className="fast-existing-combos">
      <header><b>已組套餐</b><span>{existing.length}</span></header>
      <div>{existing.map(line=>{
        const draft=line.comboDraft!;
        const sourceCombo=active.find(row=>row.id===draft.comboId);
        const sourceSlots=sourceCombo?comboSlots(sourceCombo,pools,products):[];
        return <article key={line.id}>
          <header><strong>{draft.pairingLabel} 組 · {line.name}</strong><b>{money(line.unitMinor)}</b></header>
          <p>{line.detail||'已組合'}</p>
          {draft.pendingGroups.map(group=>{
            const slot=sourceSlots.find(row=>row.groupId===group.groupId);
            return <div className="fast-pending-fill" key={group.groupId}>
              <span><b>{group.groupName}</b><small>{group.required?'必須完成先可結帳':'可選'}</small></span>
              <div>{slot?.choices.flatMap(choice=>{
                if(choice.type!=='PRODUCT'){
                  return [<button type="button" key={choice.id} onClick={()=>onFillPending(line.id,group.groupId,choice.id)}>{choice.label}<ChoicePrice minor={choice.priceAdjustmentMinor}/></button>];
                }
                const matches=cart.filter(candidate=>!candidate.comboDraft&&candidate.productId===choice.productId&&requiredTasks([candidate],products).length===0);
                return matches.map(candidate=><button type="button" key={choice.id+':'+candidate.id} onClick={()=>onFillPending(line.id,group.groupId,choice.id,candidate.id)}>{candidate.name}{candidate.qty>1?' ×'+candidate.qty:''}<ChoicePrice minor={choice.priceAdjustmentMinor}/></button>);
              })}</div>
            </div>;
          })}
          <footer><span>{draft.source==='AUTO'?'自動配對':'指定配對'} · {draft.pendingGroups.length?'待補 '+draft.pendingGroups.length:'完整'}</span><button type="button" onClick={()=>onDissolve(line.id)}>拆開套餐</button></footer>
        </article>;
      })}</div>
    </section>:null}

    {combo?<section className="fast-specified-builder">
      <header><div><b>指定配對 · {nextLabel} 組</b><span>每一格都引用目前 Admin Pool / Choice。</span></div><strong>{combo.name} · {money(combo.basePriceMinor)}</strong></header>
      {active.length>1?<nav className="fast-combo-tabs">{active.map(row=><button type="button" key={row.id} className={row.id===combo.id?'active':''} onClick={()=>{setSelectedComboId(row.id);setSelected({});}}>{row.name}<small>{money(row.basePriceMinor)}</small></button>)}</nav>:null}
      <div className="fast-slot-list">{slots.map((slot,index)=>{
        const value=selected[slot.groupId];
        return <article className="fast-slot" key={slot.groupId}>
          <header><span>{index+1}</span><div><b>{slot.groupName}</b><small>{slot.role==='MAIN_COURSE'?'主餐':slot.role==='SNACK'?'小食':'飲品'} · {slot.required?'必選':'可選'}</small></div>{value?.deferred?<em>稍後補</em>:null}</header>
          <div className="fast-candidate-grid">
            {slot.choices.flatMap(choice=>{
              if(choice.type!=='PRODUCT'){
                return [<button type="button" key={choice.id} className={value?.choiceId===choice.id?'active':''} onClick={()=>select(slot.groupId,{choiceId:choice.id})}><b>{choice.label}</b><ChoicePrice minor={choice.priceAdjustmentMinor}/></button>];
              }
              const matches=cart.filter(line=>!line.comboDraft&&line.productId===choice.productId&&requiredTasks([line],products).length===0);
              return matches.map(line=><button type="button" key={choice.id+':'+line.id} className={value?.choiceId===choice.id&&value?.sourceLineId===line.id?'active':''} onClick={()=>select(slot.groupId,{choiceId:choice.id,sourceLineId:line.id})}><b>{line.name}</b><small>{line.qty>1?'Cart ×'+line.qty:'Cart 1件'}</small><ChoicePrice minor={choice.priceAdjustmentMinor}/></button>);
            })}
            {slot.role==='DRINK'?<button type="button" className={value?.deferred?'active defer':''} onClick={()=>select(slot.groupId,{deferred:true})}><b>飲品稍後補</b><small>保留待補狀態</small></button>:null}
          </div>
        </article>;
      })}</div>
      <footer className="fast-sticky-action"><span>{requiredMissing?'仍有必選 Slot 未完成':'可以建立 '+nextLabel+' 組套餐'}</span><button type="button" disabled={requiredMissing} onClick={create}>建立 {nextLabel} 組指定配對</button></footer>
    </section>:<div className="fast-empty"><b>未有 Admin Combo</b><span>等 Admin 發布套餐後先可以建立配對。</span></div>}
  </div>;
}
