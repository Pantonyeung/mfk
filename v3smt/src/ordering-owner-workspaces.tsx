import {useMemo,useState} from 'react';

import type {
  MfpOrderingCatalog,
  MfpOrderingDomain,
  MfpOrderingDraft,
  MfpOrderingDraftLine,
  MfpServiceMode,
} from './ordering-domain.ts';
import {
  assignMfpFastPair,
  buildMfpFastPairDraft,
  defaultMfpDraftDestination,
  mfpGuidanceTarget,
  mfpHoldEntryLabel,
  presentMfpCart,
  requiredTasksForMfpDraft,
  resolveMfpDraftDestination,
  sequencePreviewForMfpLine,
  swapMfpFastPair,
  type MfpCartViewMode,
  type MfpDisplaySettings,
  type MfpDraftDestination,
} from './ordering-owner-closure.ts';

const money=new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'});
const formatMoney=(minor:number|null)=>minor===null?'未有已發布價錢':money.format(minor/100);

export function MfpShellNavigation(){
  const [moreOpen,setMoreOpen]=useState(false);
  return <><nav className="mfp-primary-nav" aria-label="MFP high-frequency navigation">
    <button type="button" className="active" aria-current="page">Ordering</button>
    <button type="button" disabled title="A6 未接駁">Orders</button>
    <button type="button" disabled title="A6 未接駁">Dining</button>
    <button type="button" disabled title="A6 未接駁">Sold-out / Capacity</button>
    <button type="button" className="mfp-more-trigger" aria-expanded={moreOpen} onClick={()=>setMoreOpen(value=>!value)}>☰ More / Tools</button>
  </nav>{moreOpen?<aside className="mfp-more-menu" aria-label="More / Tools staged shell">
    {['Today summary','Day Close','Reports','Devices','Print','Check Center','Backup / Restore','Diagnostics','Admin Sync'].map(label=><button key={label} type="button" disabled title="Later stage 未接駁">{label}<small>未接駁</small></button>)}
  </aside>:null}</>;
}

export function MfpDisplaySettingsPanel({settings,onChange,onClose}:{
  settings:MfpDisplaySettings;onChange:(settings:MfpDisplaySettings)=>void;onClose:()=>void;
}){
  const range=(key:'categoryRows'|'productColumns'|'fontScale'|'densityScale',value:number)=>onChange({...settings,[key]:value});
  return <section className="mfp-config mfp-display-settings" role="dialog" aria-modal="true" aria-labelledby="mfp-display-settings-title">
    <header><div><small>PRESENTATION ONLY · INSTANT PREVIEW</small><h2 id="mfp-display-settings-title">Display Settings</h2></div><button type="button" autoFocus aria-label="關閉顯示設定" onClick={onClose}>×</button></header>
    <div className="mfp-config-scroll mfp-settings-grid">
      <label>分類行數 <output>{settings.categoryRows}</output><input type="range" min="1" max="4" step="1" value={settings.categoryRows} onChange={event=>range('categoryRows',Number(event.target.value))}/></label>
      <label>商品欄數 <output>{settings.productColumns}</output><input type="range" min="2" max="6" step="1" value={settings.productColumns} onChange={event=>range('productColumns',Number(event.target.value))}/></label>
      <label>字體比例 <output>{settings.fontScale.toFixed(2)}</output><input type="range" min="0.8" max="1.4" step="0.05" value={settings.fontScale} onChange={event=>range('fontScale',Number(event.target.value))}/></label>
      <label>整體密度 <output>{settings.densityScale.toFixed(2)}</output><input type="range" min="0.75" max="1.25" step="0.05" value={settings.densityScale} onChange={event=>range('densityScale',Number(event.target.value))}/></label>
      <label className="mfp-setting-check"><input type="checkbox" checked={settings.showImages} onChange={event=>onChange({...settings,showImages:event.target.checked})}/>顯示商品圖片</label>
      <p>設定只影響畫面；商品、價錢、選項、套餐同 Cart intent 不會改變。</p>
    </div>
    <footer><div><small>RESTART PERSISTED</small><strong>即時預覽已套用</strong></div><button type="button" onClick={onClose}>完成</button></footer>
  </section>;
}

export function MfpSilentGuidance({catalog,draft}:{catalog:MfpOrderingCatalog;draft:MfpOrderingDraft}){
  const target=mfpGuidanceTarget(catalog,draft);
  const labels:Record<typeof target,string>={REQUIRED:'Required',QUICK_DRINK:'Quick Drink',COMBO_BLOCKER:'Combo blocker',FAST_PAIR:'Fast Pair',CHECKOUT:'Checkout',PRODUCT:'Product'};
  return <div className="mfp-silent-guidance" data-guidance-target={target}><small>SILENT GUIDED FLOW</small><b>{labels[target]}</b><span>只提示焦點，不會自動提交或改動 Cart。</span></div>;
}

function FastPairPanel({catalog,draft,onClose}:{catalog:MfpOrderingCatalog;draft:MfpOrderingDraft;onClose:()=>void}){
  const plan=useMemo(()=>buildMfpFastPairDraft(catalog,draft),[catalog,draft]);
  const [assignments,setAssignments]=useState(()=>assignMfpFastPair(plan));
  const units=new Map(plan.snackUnits.map(unit=>[unit.id,unit] as const));
  return <section className="mfp-config" role="dialog" aria-modal="true" aria-labelledby="mfp-fast-pair-title">
    <header><div><small>POSITIONAL ONLY · NO RECOMMENDATION</small><h2 id="mfp-fast-pair-title">Fast Pair</h2></div><button type="button" autoFocus aria-label="關閉快速組合" onClick={onClose}>×</button></header>
    <div className="mfp-config-scroll mfp-fast-pair-list">{plan.slots.length?plan.slots.map(slot=><article key={slot.id}>
      <strong>{slot.label}</strong><span>{slot.mainUnitId}</span><select aria-label={`${slot.label} 小食配對`} value={assignments[slot.id]??''} onChange={event=>setAssignments(current=>swapMfpFastPair(plan,current,slot.id,event.target.value))}>
        <option value="">保持單點</option>{slot.compatibleSnackUnitIds.map(id=><option key={id} value={id}>{units.get(id)?.productId} · {id}</option>)}
      </select>
    </article>):<p className="mfp-empty-copy">目前未有可按 canonical Combo Pool 配對嘅單點。</p>}
      <p>剩餘主項：{plan.residualMainUnitIds.join('、')||'無'} · 剩餘小食：{plan.residualSnackUnitIds.join('、')||'無'}</p>
      <p>配對只係草稿預覽；唔會 duplicate、唔會補商品、亦唔會自動將單點升級。要建立套餐，請由「紫米套餐」明確操作。</p>
    </div>
    <footer><div><small>A/B/C/D… DYNAMIC SLOTS</small><strong>{Object.keys(assignments).length} 組預覽</strong></div><button type="button" onClick={onClose}>完成預覽</button></footer>
  </section>;
}

function RequiredPanel({catalog,draft,onEdit,onClose}:{
  catalog:MfpOrderingCatalog;draft:MfpOrderingDraft;onEdit:(line:MfpOrderingDraftLine)=>void;onClose:()=>void;
}){
  const tasks=requiredTasksForMfpDraft(catalog,draft);
  return <section className="mfp-config" role="dialog" aria-modal="true" aria-labelledby="mfp-required-title">
    <header><div><small>CANONICAL PRODUCT CONFIG ONLY</small><h2 id="mfp-required-title">Required</h2></div><button type="button" autoFocus aria-label="關閉必選" onClick={onClose}>×</button></header>
    <div className="mfp-config-scroll mfp-required-list">{tasks.length?tasks.map(task=><article key={`${task.cartLineId}:${task.optionSetId}`}>
      <div><b>{task.label}</b><small>{task.cartLineId} · {task.min}–{task.max}</small></div><button type="button" onClick={()=>onEdit(draft.lines.find(line=>line.cartLineId===task.cartLineId)!)}>補選同一 Cart Line</button>
    </article>):<p className="mfp-empty-copy">必選已齊。</p>}</div>
    <footer><div><small>UNRESOLVED = INCOMPLETE</small><strong>{tasks.length} 項待處理</strong></div><button type="button" onClick={onClose}>完成</button></footer>
  </section>;
}

function RiceComboPanel({catalog,onCombo,onClose}:{catalog:MfpOrderingCatalog;onCombo:(comboId:string)=>void;onClose:()=>void}){
  return <section className="mfp-config" role="dialog" aria-modal="true" aria-labelledby="mfp-rice-combo-title">
    <header><div><small>EXPLICIT STAFF ACTION ONLY</small><h2 id="mfp-rice-combo-title">紫米套餐</h2></div><button type="button" autoFocus aria-label="關閉紫米套餐" onClick={onClose}>×</button></header>
    <div className="mfp-config-scroll mfp-combo-picker">{catalog.combos.map(combo=><button type="button" key={combo.id} disabled={!combo.sellable||!combo.priceReady} onClick={()=>onCombo(combo.id)}><b>{combo.name}</b><span>{combo.publishedBasePrice?formatMoney(combo.publishedBasePrice.amountMinor):'價錢未準備'}</span></button>)}</div>
    <footer><div><small>NO AUTO-UPGRADE</small><strong>單點保持單點</strong></div><button type="button" onClick={onClose}>取消</button></footer>
  </section>;
}

export function MfpFastLanes({catalog,draft,onEdit,onCombo}:{
  catalog:MfpOrderingCatalog;draft:MfpOrderingDraft;onEdit:(line:MfpOrderingDraftLine)=>void;onCombo:(comboId:string)=>void;
}){
  const [panel,setPanel]=useState<'PAIR'|'REQUIRED'|'COMBO'|null>(null);
  const required=requiredTasksForMfpDraft(catalog,draft).length;
  const close=()=>setPanel(null);
  return <><div className="mfp-fast-lanes" aria-label="Fast Lane">
    <button type="button" onClick={()=>setPanel('PAIR')}>Fast Pair</button>
    <button type="button" className={required?'attention':''} onClick={()=>setPanel('REQUIRED')}>Required <span>{required}</span></button>
    <button type="button" onClick={()=>setPanel('COMBO')}>紫米套餐</button>
  </div>{panel?<div className="mfp-config-layer">
    {panel==='PAIR'?<FastPairPanel catalog={catalog} draft={draft} onClose={close}/>:panel==='REQUIRED'?<RequiredPanel catalog={catalog} draft={draft} onEdit={line=>{close();onEdit(line);}} onClose={close}/>:<RiceComboPanel catalog={catalog} onCombo={comboId=>{close();onCombo(comboId);}} onClose={close}/>}</div>:null}</>;
}

function updateCombinedQuantity(domain:MfpOrderingDomain,draft:MfpOrderingDraft,cartLineIds:readonly string[],delta:1|-1){
  const first=draft.lines.find(line=>line.cartLineId===cartLineIds[0])!;
  if(delta===1)return domain.setQuantity(draft,first.cartLineId,first.quantity+1);
  const last=[...cartLineIds].reverse().map(id=>draft.lines.find(line=>line.cartLineId===id)).find(Boolean)!;
  return last.quantity>1?domain.setQuantity(draft,last.cartLineId,last.quantity-1):domain.removeLine(draft,last.cartLineId);
}

export function MfpCartDraft({domain,catalog,draft,heldDraft,canDraft,onChange,onHeldDraft,onEdit}:{
  domain:MfpOrderingDomain;catalog:MfpOrderingCatalog;draft:MfpOrderingDraft;heldDraft:MfpOrderingDraft|null;canDraft:boolean;
  onChange:(draft:MfpOrderingDraft)=>void;onHeldDraft:(draft:MfpOrderingDraft|null)=>void;onEdit:(line:MfpOrderingDraftLine)=>void;
}){
  const [viewMode,setViewMode]=useState<MfpCartViewMode>('ORIGINAL');
  const [clearConfirm,setClearConfirm]=useState(false);
  const [holdOpen,setHoldOpen]=useState(false);
  const [destinationOverride,setDestinationOverride]=useState<MfpDraftDestination|null>(null);
  const intent=domain.normalize(draft);
  const rows=presentMfpCart(draft,catalog,viewMode);
  const destination=resolveMfpDraftDestination(draft,destinationOverride);
  const setMode=(serviceMode:MfpServiceMode)=>onChange(domain.setServiceMode(draft,serviceMode));
  const storeDraft=()=>{
    onHeldDraft(draft);onChange(domain.createDraft(draft.serviceMode));setDestinationOverride(null);setHoldOpen(false);
  };
  const retrieve=()=>{if(heldDraft){onChange(heldDraft);onHeldDraft(null);}};
  return <><section className="mfp-cart" aria-labelledby="mfp-cart-title">
    <header><div><small>DRAFT ONLY · PREVIEW #{String(draft.lines.length+1).padStart(3,'0')}</small><h2 id="mfp-cart-title">Cart Draft</h2></div><span className={intent.checkoutReady?'ready':'incomplete'}>{intent.checkoutReady?'CHECKOUT-READY':'INCOMPLETE'}</span></header>
    <div className="mfp-cart-toolbar"><div role="group" aria-label="Cart view">{(['ORIGINAL','SORT','COMBINE'] as const).map(mode=><button type="button" key={mode} className={viewMode===mode?'active':''} aria-pressed={viewMode===mode} onClick={()=>setViewMode(mode)}>{mode}</button>)}</div><button type="button" className="mfp-clear-secondary" disabled={!canDraft||!draft.lines.length} onClick={()=>setClearConfirm(true)}>清除</button></div>
    {clearConfirm?<div className="mfp-clear-confirm" role="alert"><span>確認清除本機 Cart Draft？</span><button type="button" onClick={()=>setClearConfirm(false)}>取消</button><button type="button" className="danger" onClick={()=>{onChange(domain.createDraft(draft.serviceMode));setClearConfirm(false);}}>確認清除</button></div>:null}
    <div className="mfp-service-mode" role="group" aria-label="全單用餐方式">
      <button type="button" aria-pressed={draft.serviceMode==='takeaway'} className={draft.serviceMode==='takeaway'?'active':''} disabled={!canDraft} onClick={()=>setMode('takeaway')}>全單外賣</button>
      <button type="button" aria-pressed={draft.serviceMode==='dine-in'} className={draft.serviceMode==='dine-in'?'active':''} disabled={!canDraft} onClick={()=>setMode('dine-in')}>全單堂食</button>
    </div>
    <div className="mfp-cart-lines">{rows.length?rows.map(row=><article key={row.cartLineIds.join(':')}>
      <div><b><i>#{sequencePreviewForMfpLine(draft,row.cartLineIds[0]!)}</i> {row.line.displayName}</b><small>{row.line.kind} · {row.line.state}{row.combined?' · COMBINED':''}</small>{row.line.note?<small>備註：{row.line.note}</small>:null}{row.line.issues.map(code=><span key={code}>{code}</span>)}</div>
      {row.combined&&viewMode==='COMBINE'?<div className="mfp-line-quantity"><button type="button" aria-label={`減少 ${row.line.displayName}`} disabled={!canDraft||row.quantity===1} onClick={()=>onChange(updateCombinedQuantity(domain,draft,row.cartLineIds,-1))}>−</button><strong>{row.quantity}</strong><button type="button" aria-label={`增加 ${row.line.displayName}`} disabled={!canDraft} onClick={()=>onChange(updateCombinedQuantity(domain,draft,row.cartLineIds,1))}>＋</button></div>:<strong>×{row.quantity}</strong>}
      <strong>{formatMoney(row.line.previewUnitMinor===null?null:row.line.previewUnitMinor*row.quantity)}</strong>
      <div className="mfp-line-service" role="group" aria-label={`${row.line.displayName} 用餐方式`}><button type="button" className={row.line.serviceMode==='takeaway'?'active':''} disabled={!canDraft||row.cartLineIds.length>1} onClick={()=>onChange(domain.setLineServiceMode(draft,row.line.cartLineId,'takeaway'))}>外賣</button><button type="button" className={row.line.serviceMode==='dine-in'?'active':''} disabled={!canDraft||row.cartLineIds.length>1} onClick={()=>onChange(domain.setLineServiceMode(draft,row.line.cartLineId,'dine-in'))}>堂食</button></div>
      <div className="mfp-line-actions"><button type="button" disabled={!canDraft||row.cartLineIds.length>1} onClick={()=>onEdit(row.line)}>修改</button><button type="button" disabled={!canDraft||row.cartLineIds.length>1} onClick={()=>onChange(domain.removeLine(draft,row.line.cartLineId))}>移除</button></div>
    </article>):<p className="mfp-empty-copy">未有商品。可用 Retrieve 取回今次本機 session 嘅暫存草稿。</p>}</div>
    <footer><div><small>{intent.pricing}</small><strong>{formatMoney(intent.previewSubtotalMinor)}</strong><span>Preview 唔係 final formal quote</span></div><div className="mfp-cart-primary-actions"><button type="button" className="mfp-hold-dining" disabled={!canDraft||(!draft.lines.length&&!heldDraft)} onClick={()=>draft.lines.length?setHoldOpen(true):retrieve()}>{mfpHoldEntryLabel(draft)}</button><button type="button" disabled>A5 結帳未接駁</button></div></footer>
  </section>{holdOpen?<div className="mfp-config-layer"><section className="mfp-config" role="dialog" aria-modal="true" aria-labelledby="mfp-hold-dining-title">
    <header><div><small>DRAFT / LOCAL UX ONLY</small><h2 id="mfp-hold-dining-title">Hold / Dining</h2></div><button type="button" autoFocus aria-label="關閉暫存堂食" onClick={()=>setHoldOpen(false)}>×</button></header>
    <div className="mfp-config-scroll mfp-destination-picker"><p>建議：{defaultMfpDraftDestination(draft)==='HOLD'?'Hold':'Dining'}。你可以隨時改。</p><div role="group" aria-label="暫存或堂食"><button type="button" className={destination==='HOLD'?'active':''} onClick={()=>setDestinationOverride('HOLD')}>Hold</button><button type="button" className={destination==='DINING'?'active':''} onClick={()=>setDestinationOverride('DINING')}>Dining</button></div>{destination==='DINING'?<p>Waiting / Table target 由 A6 正式接駁；A4 只保存完整本機草稿。</p>:null}</div>
    <footer><div><small>{destination} · NO FORMAL ORDER</small><strong>{draft.lines.length} 行草稿</strong></div><button type="button" onClick={storeDraft}>保存本機草稿</button></footer>
  </section></div>:null}</>;
}
