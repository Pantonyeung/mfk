import {useMemo,useState} from 'react';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {useAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {appendAdminAudit,createAdminRelease,readActiveAdminRelease,readAdminReleases,readAdminStored,restoreAdminReleaseAsDraft,usePersistentAdminState,writeAdminStored,type AdminRelease} from './admin-local-store.ts';
import {normalizeProductPrintRule,useProductPrintRules,type ProductPrintRule} from './admin-product-operational-config.ts';
import {OPTION_SET_CENTER_STORAGE_KEYS} from './admin-option-set-center.ts';

function Header({title,description,badge='已自動保存'}:{title:string;description:string;badge?:string}){
  return <header className="admin-editor-head"><div><small>{badge}</small><h1>{title}</h1><p>{description}</p></div></header>;
}

function restoreSnapshot(release:AdminRelease,replaceDraft:(draft:AdminSessionDraft,reason:string)=>void){
  const snapshot=restoreAdminReleaseAsDraft<Record<string,unknown>>(release);
  if(snapshot.catalog)replaceDraft(snapshot.catalog as AdminSessionDraft,'由設定版本 R'+release.version+' 還原內容');
  if(snapshot.optionCenter&&typeof snapshot.optionCenter==='object'&&!Array.isArray(snapshot.optionCenter)){
    const optionCenter=snapshot.optionCenter as {sets?:unknown;productLinks?:unknown};
    if(optionCenter.sets!==undefined)writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.sets,optionCenter.sets);
    if(optionCenter.productLinks!==undefined)writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.productLinks,optionCenter.productLinks);
    writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.dirty,false);
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
  const {markClean,replaceDraft}=useAdminDraft();
  const [releases,setReleases]=useState(()=>readAdminReleases());
  const [active,setActive]=useState(()=>readActiveAdminRelease());
  const [message,setMessage]=useState('每次喺菜單／商品／選項／套餐撳「保存」，就會建立一個不可變新版本並即時成為目前版本。呢度只保留版本歷史同還原。');

  const restore=(release:AdminRelease)=>{
    restoreSnapshot(release,replaceDraft);
    const row=createAdminRelease(release.snapshot,'還原自 R'+release.version);
    markClean();
    writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.dirty,false);
    setReleases(readAdminReleases());
    setActive({version:row.version,createdAt:row.createdAt,fingerprint:row.fingerprint});
    setMessage('已由 R'+release.version+' 還原並保存成 R'+row.version+'；舊版本冇被修改。');
    window.setTimeout(()=>window.location.reload(),50);
  };

  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>{active?'目前版本 R'+active.version:'未有保存版本'}</small><h1>設定版本歷史</h1><p>「保存」就係正式版本邊界。呢度冇額外確認步驟；歷史版本只讀，還原會建立另一個新版本。</p></div>
    </header>

    <div className="admin-kpi-grid">
      <article><span>目前版本</span><strong>{active?'R'+active.version:'—'}</strong><small>{active?new Date(active.createdAt).toLocaleString('zh-HK'):'未建立'}</small></article>
      <article><span>版本總數</span><strong>{releases.length}</strong><small>不可變歷史</small></article>
      <article><span>目前驗證碼</span><strong>{active?active.fingerprint.replace('fnv1a32:',''):'—'}</strong><small>保存後 readback</small></article>
      <article><span>額外確認步驟</span><strong>0</strong><small>保存即目前版本</small></article>
    </div>

    <div className="admin-callout compact">{message}</div>

    <section className="admin-rule-card">
      <h2>版本歷史</h2>
      {releases.length===0?<div className="admin-read-empty">未有保存版本。去菜單／商品／選項／套餐修改後直接撳「保存」。</div>:<div className="admin-editor-list">{releases.map(release=><article className="admin-policy-row" key={release.version}>
        <div><b>R{release.version}{active?.version===release.version?' · 目前':''}</b><small>{new Date(release.createdAt).toLocaleString('zh-HK')}</small></div>
        <code>{release.fingerprint}</code>
        <span>{release.reason||'一般保存'}</span>
        <button type="button" disabled={active?.version===release.version} onClick={()=>restore(release)}>還原為新版本</button>
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
