import {useMemo,useState} from 'react';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {useAdminDraft} from './admin-draft.tsx';

function MigrationHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>MIGRATION_ONLY · NOT_WIRED</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" className="publish" disabled>Publish 未接駁</button></div>
  </header>;
}

export function PublishCenterWorkspace(){
  const {draft,dirty,validationErrors,validate}=useAdminDraft();
  const [lastValidationAt,setLastValidationAt]=useState<string>();
  const [impactPreviewed,setImpactPreviewed]=useState(false);
  const counts=useMemo(()=>({
    categories:draft.categories.length,
    products:draft.products.length,
    modifiers:draft.modifierGroups.length,
    combos:draft.combos.length,
  }),[draft]);
  const runValidation=()=>{
    validate();
    setLastValidationAt(new Date().toISOString());
    setImpactPreviewed(false);
  };
  const canPreview=Boolean(lastValidationAt)&&validationErrors.length===0;
  return <section className="admin-editor-page">
    <MigrationHeader title="Pending Changes／發布" description="Draft → Validate → Impact → Publish → target readback → rollback 嘅完整治理 shape。今輪全部停喺 NOT_WIRED，唔會生成 Active Revision。"/>
    <div className="admin-kpi-grid">
      <article><span>Categories</span><strong>{counts.categories}</strong><small>SESSION DRAFT</small></article>
      <article><span>Products</span><strong>{counts.products}</strong><small>SESSION DRAFT</small></article>
      <article><span>Modifier Groups</span><strong>{counts.modifiers}</strong><small>SESSION DRAFT</small></article>
      <article><span>Combos</span><strong>{counts.combos}</strong><small>SESSION DRAFT</small></article>
    </div>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card">
        <h2>1. Draft</h2>
        <p>{dirty?'有未發布變更':'目前冇變更'}</p>
        <span className="admin-not-wired-chip">SESSION ONLY</span>
      </article>
      <article className="admin-policy-card">
        <h2>2. Validate</h2>
        <button type="button" onClick={runValidation}>執行 Validate</button>
        <small>{lastValidationAt?'最後驗證：'+lastValidationAt:'未驗證'}</small>
        {validationErrors.length?<ul>{validationErrors.map((error,index)=><li key={index}>{error}</li>)}</ul>:null}
      </article>
      <article className="admin-policy-card">
        <h2>3. Impact Preview</h2>
        <p>預覽受影響 Product / Channel / Presentation target，同 base revision conflict 風險。</p>
        <button type="button" disabled={!canPreview} onClick={()=>setImpactPreviewed(true)}>產生 Impact Preview</button>
        <small>{impactPreviewed?'IMPACT_PREVIEW_LOCAL_ONLY':'先完成 Validate'}</small>
      </article>
      <article className="admin-policy-card">
        <h2>4. Publish</h2>
        <label><span>Expected Base Revision</span><input disabled placeholder="ACTIVE_REVISION_NOT_WIRED"/></label>
        <button type="button" disabled>Publish 未接駁</button>
        <small>唔會向任何 runtime / provider 發送。</small>
      </article>
      <article className="admin-policy-card">
        <h2>5. Target Readback</h2>
        <div className="admin-read-empty">MATCH / PARTIAL / MISMATCH / UNKNOWN · NOT_WIRED</div>
        <small>每個 target 必須有 observed revision / evidence；冇 proof 唔可以顯示成功。</small>
      </article>
      <article className="admin-policy-card">
        <h2>6. Rollback</h2>
        <button type="button" disabled>Rollback as New Revision 未接駁</button>
        <small>Rollback 只會建立新 revision，唔 edit history。</small>
      </article>
    </div>
  </section>;
}
export function PrintRulesWorkspace(){
  const {draft}=useAdminDraft();
  const [rows,setRows]=useState<Record<string,{receipt:boolean;production:boolean;packing:boolean;label:boolean;dineIn:boolean}>>({});
  const current=(id:string)=>rows[id]??{receipt:true,production:true,packing:true,label:false,dineIn:true};
  const patch=(id:string,change:Partial<ReturnType<typeof current>>)=>setRows(value=>({...value,[id]:{...current(id),...change}}));
  return <section className="admin-editor-page">
    <MigrationHeader title="商品／堂食打印規則" description="只搬 Admin 規則設定面；實體 Print Admission、Queue、IP/USB、Native execution 全部唔喺呢度。"/>
    {draft.products.length===0?<div className="admin-empty-state"><b>未有 Product Draft</b><p>建立 Product 後先可以設定 output flags。</p></div>:<div className="admin-editor-list">
      {draft.products.map(product=>{
        const row=current(product.id);
        return <article className="admin-print-rule-row" key={product.id}>
          <div><b>{product.name||product.id}</b><small>{product.id}</small></div>
          <label><input type="checkbox" checked={row.receipt} onChange={event=>patch(product.id,{receipt:event.target.checked})}/><span>Receipt</span></label>
          <label><input type="checkbox" checked={row.production} onChange={event=>patch(product.id,{production:event.target.checked})}/><span>Production</span></label>
          <label><input type="checkbox" checked={row.packing} onChange={event=>patch(product.id,{packing:event.target.checked})}/><span>Packing</span></label>
          <label><input type="checkbox" checked={row.label} onChange={event=>patch(product.id,{label:event.target.checked})}/><span>Label</span></label>
          <label><input type="checkbox" checked={row.dineIn} onChange={event=>patch(product.id,{dineIn:event.target.checked})}/><span>堂食打印</span></label>
          <span className="admin-not-wired-chip">RULE ONLY</span>
        </article>;
      })}
    </div>}
  </section>;
}

interface QuickReasonDraft{readonly id:string;readonly scope:'TENDER_CORRECTION'|'REPRINT'|'CANCEL';readonly label:string;readonly active:boolean}
export function QuickReasonsWorkspace(){
  const [reasons,setReasons]=useState<readonly QuickReasonDraft[]>([]);
  const add=()=>setReasons(rows=>[...rows,{id:'reason-'+String(rows.length+1).padStart(3,'0'),scope:'TENDER_CORRECTION',label:'',active:true}]);
  const patch=(id:string,change:Partial<QuickReasonDraft>)=>setReasons(rows=>rows.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>MIGRATION_ONLY · NOT_WIRED</small><h1>快捷原因</h1><p>Reason 保持 optional / non-blocking；Admin 只管理快捷選項，唔改 transaction truth。</p></div>
      <div className="admin-editor-actions"><button type="button" className="secondary" onClick={add}>新增原因</button><button type="button" className="publish" disabled>Publish 未接駁</button></div>
    </header>
    {reasons.length===0?<div className="admin-empty-state"><b>未有快捷原因</b><p>可以建立 Tender Correction、Reprint、Cancel 常用原因。</p><button onClick={add}>新增原因</button></div>:<div className="admin-editor-list">{reasons.map(reason=><article className="admin-policy-row quick-reason-row" key={reason.id}>
      <select value={reason.scope} onChange={event=>patch(reason.id,{scope:event.target.value as QuickReasonDraft['scope']})}><option value="TENDER_CORRECTION">Tender Correction</option><option value="REPRINT">Reprint</option><option value="CANCEL">Cancel</option></select>
      <input value={reason.label} onChange={event=>patch(reason.id,{label:event.target.value})} placeholder="例如：客人更改付款方式"/>
      <label className="admin-toggle"><input type="checkbox" checked={reason.active} onChange={event=>patch(reason.id,{active:event.target.checked})}/><span>{reason.active?'啟用':'停用'}</span></label>
      <span className="admin-not-wired-chip">OPTIONAL</span>
    </article>)}</div>}
  </section>;
}

export function SettlementWorkspace(){
  const [provider,setProvider]=useState('ALL');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="Settlement／對帳" description="只搬 provider supplied facts / mismatch review surface；Admin 唔自行生成或改寫 settlement truth。"/>
    <div className="admin-filterbar">
      <select value={provider} onChange={event=>setProvider(event.target.value)}><option value="ALL">全部平台</option><option value="KEETA">Keeta</option><option value="FOODPANDA">Foodpanda</option></select>
      <label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
      <button disabled>讀取未接駁</button>
    </div>
    <div className="admin-kpi-grid">
      <article><span>Provider Gross</span><strong>—</strong><small>NOT_WIRED</small></article>
      <article><span>Commission</span><strong>—</strong><small>NOT_WIRED</small></article>
      <article><span>Refund / Adjustment</span><strong>—</strong><small>NOT_WIRED</small></article>
      <article><span>Mismatch</span><strong>—</strong><small>NOT_WIRED</small></article>
    </div>
    <section className="admin-read-table"><header><span>期間</span><span>Provider</span><span>Reference</span><span>Difference</span><span>Status</span></header><div className="admin-read-empty">SETTLEMENT_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}

export function MigrationCoverageWorkspace(){
  const wired=ADMIN_CAPABILITIES.filter(item=>item.status==='NOT_WIRED').length;
  const deferred=ADMIN_CAPABILITIES.filter(item=>item.status==='DEFERRED').length;
  return <section className="admin-editor-page">
    <MigrationHeader title="Admin 搬遷完整度" description="只用嚟對帳 MFK Admin surface；唔代表任何功能已經接通。"/>
    <div className="admin-kpi-grid">
      <article><span>Active Migration Surface</span><strong>{wired}</strong><small>NOT_WIRED</small></article>
      <article><span>Deferred Surface</span><strong>{deferred}</strong><small>DEFERRED</small></article>
      <article><span>Total Capabilities</span><strong>{ADMIN_CAPABILITIES.length}</strong><small>REGISTRY</small></article>
      <article><span>Live Connections</span><strong>0</strong><small>OWNER LOCK</small></article>
    </div>
  </section>;
}
