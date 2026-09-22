import {useMemo,useState} from 'react';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {useAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {appendAdminAudit,createAdminRelease,readAdminReleases,readAdminStored,restoreAdminReleaseAsDraft,usePersistentAdminState,writeAdminStored,type AdminRelease} from './admin-local-store.ts';
import {normalizeProductPrintRule,useProductPrintRules,type ProductPrintRule} from './admin-product-operational-config.ts';
import {OPTION_CENTER_STORAGE_KEYS,readOptionCenterState,validateOptionCenter} from './admin-option-center.ts';

function Header({title,description,badge='已自動保存'}:{title:string;description:string;badge?:string}){
  return <header className="admin-editor-head"><div><small>{badge}</small><h1>{title}</h1><p>{description}</p></div></header>;
}

function collectAdminSnapshot(catalog:AdminSessionDraft){
  const optionCenter=readOptionCenterState(catalog);
  return {
    catalog,
    optionCenter,
    availability:readAdminStored('availability.v1',{}),
    businessDay:readAdminStored('business-day.v1',{}),
    logicalPrinters:readAdminStored('logical-printers.v1',[]),
    printTemplates:readAdminStored('print-templates.v1',{}),
    printRules:readAdminStored('print-rules.v1',{}),
    productMedia:readAdminStored('product-media.v1',{}),
    storeSettings:readAdminStored('store-settings.v1',{}),
    quickReasons:readAdminStored('quick-reasons.v1',[]),
    staff:readAdminStored('staff.v1',[]),
    channelPolicy:readAdminStored('channel-policy.keeta.v1',{}),
    channelMapping:readAdminStored('channel-mapping.keeta.v1',[]),
    capacity:readAdminStored('capacity.v1',{}),
    presentation:readAdminStored('presentation.v1',{}),
    inventory:readAdminStored('inventory-lite.v1',[]),
    loyalty:readAdminStored('loyalty.v1',{}),
    coupons:readAdminStored('coupons.v1',[]),
    announcements:readAdminStored('announcements.v1',[]),
  };
}

function restoreSnapshot(release:AdminRelease,replaceDraft:(draft:AdminSessionDraft,reason:string)=>void){
  const snapshot=restoreAdminReleaseAsDraft<Record<string,unknown>>(release);
  if(snapshot.catalog)replaceDraft(snapshot.catalog as AdminSessionDraft,'由設定版本 R'+release.version+' 建立新草稿');
  if(snapshot.optionCenter&&typeof snapshot.optionCenter==='object'&&!Array.isArray(snapshot.optionCenter)){
    const optionCenter=snapshot.optionCenter as {options?:unknown;groups?:unknown;productLinks?:unknown};
    if(optionCenter.options!==undefined)writeAdminStored(OPTION_CENTER_STORAGE_KEYS.options,optionCenter.options);
    if(optionCenter.groups!==undefined)writeAdminStored(OPTION_CENTER_STORAGE_KEYS.groups,optionCenter.groups);
    if(optionCenter.productLinks!==undefined)writeAdminStored(OPTION_CENTER_STORAGE_KEYS.productLinks,optionCenter.productLinks);
  }
  const map:Record<string,string>={
    availability:'availability.v1',businessDay:'business-day.v1',logicalPrinters:'logical-printers.v1',
    printTemplates:'print-templates.v1',printRules:'print-rules.v1',productMedia:'product-media.v1',storeSettings:'store-settings.v1',
    quickReasons:'quick-reasons.v1',staff:'staff.v1',channelPolicy:'channel-policy.keeta.v1',
    channelMapping:'channel-mapping.keeta.v1',capacity:'capacity.v1',presentation:'presentation.v1',
    inventory:'inventory-lite.v1',loyalty:'loyalty.v1',coupons:'coupons.v1',announcements:'announcements.v1',
  };
  for(const [key,storeKey] of Object.entries(map))if(snapshot[key]!==undefined)writeAdminStored(storeKey,snapshot[key]);
}

export function PublishCenterWorkspace(){
  const {draft,dirty,validationErrors,validate,markClean,replaceDraft}=useAdminDraft();
  const [optionValidationErrors,setOptionValidationErrors]=useState<readonly string[]>([]);
  const [lastValidationAt,setLastValidationAt]=useState<string>();
  const [impactPreviewed,setImpactPreviewed]=useState(false);
  const [reason,setReason]=useState('');
  const [releases,setReleases]=useState(()=>readAdminReleases());
  const [message,setMessage]=useState('先檢查內容，再確認影響範圍；通過後建立不可變設定版本。門店派送屬下一階段，呢度唔會假裝已送達。');
  const optionCenter=readOptionCenterState(draft);
  const counts=useMemo(()=>({
    categories:draft.categories.length,
    products:draft.products.length,
    modifiers:optionCenter.groups.length,
    options:optionCenter.options.length,
    combos:draft.combos.length,
  }),[draft,optionCenter.groups.length,optionCenter.options.length]);

  const runValidation=()=>{
    const errors=validate();
    const optionErrors=validateOptionCenter(readOptionCenterState(draft));
    setOptionValidationErrors(optionErrors);
    setLastValidationAt(new Date().toISOString());
    setImpactPreviewed(false);
    setMessage(errors.length||optionErrors.length?'內容檢查未通過；先修正問題。':'內容檢查通過，可以確認影響範圍。');
  };
  const canPreview=Boolean(lastValidationAt)&&validationErrors.length===0&&optionValidationErrors.length===0;
  const createRelease=()=>{
    const errors=validate();
    const optionErrors=validateOptionCenter(readOptionCenterState(draft));
    setOptionValidationErrors(optionErrors);
    if(errors.length||optionErrors.length){setMessage('仍有資料問題，未建立版本。');return;}
    const row=createAdminRelease(collectAdminSnapshot(draft),reason);
    markClean();
    setReleases(readAdminReleases());
    setImpactPreviewed(false);
    setReason('');
    setMessage('已建立 '+row.label+'；內容驗證碼 '+row.fingerprint+'。設定版本已保存。');
  };
  const restore=(release:AdminRelease)=>{
    restoreSnapshot(release,replaceDraft);
    setMessage('已由 R'+release.version+' 建立新草稿；歷史版本本身冇被修改。');
    window.setTimeout(()=>window.location.reload(),50);
  };

  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>設定版本管理</small><h1>待發布變更</h1><p>Draft → 檢查內容 → 確認影響 → 建立新設定版本。任何 rollback 都係建立新草稿／新版本，唔會改寫歷史。</p></div>
    </header>
    <div className="admin-kpi-grid">
      <article><span>分類</span><strong>{counts.categories}</strong><small>{dirty?'有變更':'已保存'}</small></article>
      <article><span>商品</span><strong>{counts.products}</strong><small>完整商品資料</small></article>
      <article><span>選項 / 組</span><strong>{counts.options} / {counts.modifiers}</strong><small>Option Center</small></article>
      <article><span>套餐</span><strong>{counts.combos}</strong><small>保留 child 關係</small></article>
    </div>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>1. 檢查內容</h2><button type="button" onClick={runValidation}>檢查完整性</button><small>{lastValidationAt?'最後檢查：'+new Date(lastValidationAt).toLocaleString('zh-HK'):'未檢查'}</small>{validationErrors.length||optionValidationErrors.length?<ul>{[...validationErrors,...optionValidationErrors].map((error,index)=><li key={index}>{error}</li>)}</ul>:null}</article>
      <article className="admin-policy-card"><h2>2. 確認影響範圍</h2><p>今次設定版本包含菜單、價格設定、選項、套餐、供應、打印規則、門店政策、人員權限草稿同其他已完成 Admin 設定。</p><button type="button" disabled={!canPreview} onClick={()=>setImpactPreviewed(true)}>確認影響範圍</button><small>{impactPreviewed?'已確認':'先完成內容檢查'}</small></article>
      <article className="admin-policy-card"><h2>3. 版本備註</h2><label><span>原因／變更說明（建議填寫）</span><textarea rows={4} value={reason} onChange={event=>setReason(event.target.value)} placeholder="例如：秋季菜單更新／調整外賣附加費"/></label></article>
      <article className="admin-policy-card"><h2>4. 建立正式設定版本</h2><button type="button" disabled={!impactPreviewed||validationErrors.length>0} onClick={createRelease}>建立新設定版本</button><p>{message}</p><small>建立設定版本只代表後台已保存一份不可變版本；未有正式生效證據之前，介面唔會顯示已生效。</small></article>
    </div>
    <section className="admin-rule-card">
      <h2>版本歷史</h2>
      {releases.length===0?<div className="admin-read-empty">未有正式設定版本。</div>:<div className="admin-editor-list">{releases.map(release=><article className="admin-policy-row" key={release.version}>
        <div><b>R{release.version}</b><small>{new Date(release.createdAt).toLocaleString('zh-HK')}</small></div>
        <code>{release.fingerprint}</code>
        <span>{release.reason||'未填備註'}</span>
        <button type="button" onClick={()=>restore(release)}>由此版本建立新草稿</button>
      </article>)}</div>}
    </section>
  </section>;
}

export function PrintRulesWorkspace(){
  const {draft}=useAdminDraft();
  const [rows,setRows]=useProductPrintRules();
  const printers=readAdminStored<Array<{id:string;name:string;type:string;active:boolean}>>('logical-printers.v1',[]);
  const labelPrinters=printers.filter(row=>row.type==='LABEL'&&row.active);
  const current=(id:string):ProductPrintRule=>normalizeProductPrintRule(rows[id]);
  const patch=(id:string,change:Partial<ProductPrintRule>)=>setRows(value=>{
    const before=current(id);
    const after=normalizeProductPrintRule({...before,...change});
    appendAdminAudit({action:'修改商品打印規則',target:id,before,after});
    return {...value,[id]:after};
  });
  return <section className="admin-editor-page">
    <Header title="商品打印規則" description="每件商品獨立設定收據、製作單、打包單、Label、堂食同外賣打印。Label 開啟時可指定一個或多個 Logical Label destination。"/>
    <div className="admin-editor-list">
      {draft.products.map(product=>{const row=current(product.id);return <article className="admin-card-editor" key={product.id}>
        <header><div><b>{product.name}</b><small>{product.productCode??product.id}</small></div></header>
        <div className="admin-check-grid">
          {([['receipt','收據'],['production','製作單'],['packing','打包單'],['label','Label'],['dineIn','堂食打印'],['takeaway','外賣打印']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={row[key]} onChange={event=>patch(product.id,{[key]:event.target.checked})}/><span>{label}</span></label>)}
        </div>
        {row.label?<section className="admin-sub-editor"><header><b>Label 目的地</b><small>{row.labelPrinterIds.length} 個</small></header>{labelPrinters.length===0?<p>請先喺打印中心建立 Logical Label Printer。</p>:<div className="admin-check-grid">{labelPrinters.map(printer=><label key={printer.id}><input type="checkbox" checked={row.labelPrinterIds.includes(printer.id)} onChange={event=>patch(product.id,{labelPrinterIds:event.target.checked?[...row.labelPrinterIds,printer.id]:row.labelPrinterIds.filter(id=>id!==printer.id)})}/><span>{printer.name}</span></label>)}</div>}</section>:null}
      </article>})}
    </div>
  </section>;
}

interface QuickReasonDraft{readonly id:string;readonly scope:'TENDER_CORRECTION'|'REPRINT'|'CANCEL'|'REFUND';readonly label:string;readonly active:boolean}
export function QuickReasonsWorkspace(){
  const [reasons,setReasons]=usePersistentAdminState<QuickReasonDraft[]>('quick-reasons.v1',[
    {id:'reason-payment-mistake',scope:'TENDER_CORRECTION',label:'撳錯付款方式',active:true},
    {id:'reason-customer-change',scope:'TENDER_CORRECTION',label:'客人更改付款方式',active:true},
    {id:'reason-reconcile',scope:'TENDER_CORRECTION',label:'收款核對修正',active:true},
  ]);
  const add=()=>setReasons(rows=>{const row:QuickReasonDraft={id:'reason-'+Date.now().toString(36),scope:'TENDER_CORRECTION',label:'',active:true};appendAdminAudit({action:'新增快捷原因',target:row.id});return [...rows,row];});
  const patch=(id:string,change:Partial<QuickReasonDraft>)=>setReasons(rows=>rows.map(row=>{if(row.id!==id)return row;const after={...row,...change};appendAdminAudit({action:'修改快捷原因',target:id,before:row,after});return after;}));
  const remove=(id:string)=>setReasons(rows=>{appendAdminAudit({action:'刪除快捷原因',target:id});return rows.filter(row=>row.id!==id);});
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>可選／不阻交易</small><h1>快捷原因</h1><p>提供更改付款方式、重印、取消、退款等常用原因。原因永遠係 OPTIONAL，員工可以自填或不填。</p></div><div className="admin-editor-actions"><button type="button" className="secondary" onClick={add}>新增原因</button></div></header>
    <div className="admin-editor-list">{reasons.map(reason=><article className="admin-policy-row quick-reason-row" key={reason.id}>
      <select value={reason.scope} onChange={event=>patch(reason.id,{scope:event.target.value as QuickReasonDraft['scope']})}><option value="TENDER_CORRECTION">更改付款方式</option><option value="REPRINT">重印</option><option value="CANCEL">取消</option><option value="REFUND">退款</option></select>
      <input value={reason.label} onChange={event=>patch(reason.id,{label:event.target.value})} placeholder="原因文字"/>
      <label className="admin-toggle"><input type="checkbox" checked={reason.active} onChange={event=>patch(reason.id,{active:event.target.checked})}/><span>{reason.active?'啟用':'停用'}</span></label>
      <button type="button" onClick={()=>remove(reason.id)}>刪除</button>
    </article>)}</div>
  </section>;
}

interface SettlementFact{
  id:string;period:string;provider:string;reference:string;grossMinor:number;commissionMinor:number;refundMinor:number;adjustmentMinor:number;status:'MATCH'|'MISMATCH'|'PENDING';
}
export function SettlementWorkspace(){
  const [provider,setProvider]=useState('ALL');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [facts]=usePersistentAdminState<SettlementFact[]>('settlement-facts.v1',[]);
  const filtered=facts.filter(row=>(provider==='ALL'||row.provider===provider)&&(!from||row.period>=from)&&(!to||row.period<=to));
  const sum=(key:'grossMinor'|'commissionMinor'|'refundMinor'|'adjustmentMinor')=>filtered.reduce((total,row)=>total+row[key],0);
  const money=(minor:number)=>'HK$'+(minor/100).toFixed(2);
  return <section className="admin-editor-page">
    <Header title="平台對帳" description="顯示平台提供嘅正式對帳資料、佣金、退款、調整同差異；後台唔會自行改寫結算資料。"/>
    <div className="admin-filterbar">
      <select value={provider} onChange={event=>setProvider(event.target.value)}><option value="ALL">全部平台</option><option value="KEETA">Keeta</option><option value="FOODPANDA">Foodpanda</option></select>
      <label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    </div>
    <div className="admin-kpi-grid">
      <article><span>平台總額</span><strong>{money(sum('grossMinor'))}</strong><small>{filtered.length} 筆</small></article>
      <article><span>平台佣金</span><strong>{money(sum('commissionMinor'))}</strong><small>平台正式資料</small></article>
      <article><span>退款／調整</span><strong>{money(sum('refundMinor')+sum('adjustmentMinor'))}</strong><small>只讀事實</small></article>
      <article><span>差異項目</span><strong>{filtered.filter(row=>row.status==='MISMATCH').length}</strong><small>需要 reconciliation</small></article>
    </div>
    {filtered.length===0?<div className="admin-read-empty">目前未有正式平台對帳資料。介面、篩選同計算責任已完成；未接資料來源前唔會製造假數據。</div>:<section className="admin-read-table"><header><span>期間</span><span>平台</span><span>參考編號</span><span>總額</span><span>狀態</span></header>{filtered.map(row=><article key={row.id}><span>{row.period}</span><span>{row.provider}</span><span>{row.reference}</span><span>{money(row.grossMinor)}</span><span>{row.status==='MATCH'?'一致':row.status==='MISMATCH'?'有差異':'待核對'}</span></article>)}</section>}
  </section>;
}

export function MigrationCoverageWorkspace(){
  const ready=ADMIN_CAPABILITIES.filter(item=>item.status==='NOT_WIRED').length;
  const deferred=ADMIN_CAPABILITIES.filter(item=>item.status==='DEFERRED').length;
  return <section className="admin-editor-page">
    <Header title="功能準備進度" description="只用作內部產品盤點，唔係營運員工每日工作入口。"/>
    <div className="admin-kpi-grid">
      <article><span>已建立功能面</span><strong>{ready}</strong><small>等待資料／連接唔等於冇 UI</small></article>
      <article><span>保留功能</span><strong>{deferred}</strong><small>保留能力</small></article>
      <article><span>功能總數</span><strong>{ADMIN_CAPABILITIES.length}</strong><small>能力清單</small></article>
      <article><span>假成功</span><strong>0</strong><small>未有正式回傳就唔顯示成功</small></article>
    </div>
  </section>;
}
