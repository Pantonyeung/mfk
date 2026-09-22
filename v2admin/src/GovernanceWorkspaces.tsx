import {useMemo,useState} from 'react';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {useAdminDraft} from './admin-draft.tsx';
import {buildAdminA2TransferFromDraft,inspectAdminA2Readback} from './admin-menu-transfer.ts';
import type {MfkAdminMenuReadbackReceipt,MfkAdminMenuTransferBundle} from '../../contracts/admin-menu-transfer-v1.ts';

function downloadAdminJson(filename:string,value:unknown){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readAdminJsonFile(file:File){
  return JSON.parse(await file.text()) as unknown;
}

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
  const [baseRevision,setBaseRevision]=useState(1);
  const [bundle,setBundle]=useState<MfkAdminMenuTransferBundle|null>(null);
  const [readback,setReadback]=useState<MfkAdminMenuReadbackReceipt|null>(null);
  const [compareState,setCompareState]=useState<'MATCH'|'MISMATCH'|'UNKNOWN'|'NOT_OBSERVED'>('NOT_OBSERVED');
  const [message,setMessage]=useState('A2 係 human-controlled transport：先匯出 Publish Bundle，再由 SMT 匯入並回傳 Readback Receipt。');
  const counts=useMemo(()=>({
    categories:draft.categories.length,
    products:draft.products.length,
    modifiers:draft.modifierGroups.length,
    combos:draft.combos.length,
  }),[draft]);

  const runValidation=()=>{
    const errors=validate();
    setLastValidationAt(new Date().toISOString());
    setImpactPreviewed(false);
    setBundle(null);
    setReadback(null);
    setCompareState('NOT_OBSERVED');
    setMessage(errors.length?'Validate 未通過；A2 bundle 未建立。':'Validate 通過。先做 Impact Preview，再建立 A2 Publish Bundle。');
  };
  const canPreview=Boolean(lastValidationAt)&&validationErrors.length===0;
  const createBundle=()=>{
    try{
      const next=buildAdminA2TransferFromDraft(draft,baseRevision);
      setBundle(next);
      setReadback(null);
      setCompareState('NOT_OBSERVED');
      setMessage('SOURCE_INTENT 已建立：R'+next.revision.revision+' / '+next.revision.fingerprint+'。下載 bundle 後交畀 SMT。');
      downloadAdminJson('mfk-admin-menu-'+next.transportId.replace(/[:]/g,'_')+'.json',next);
    }catch(error){
      setMessage(error instanceof Error?error.message:'ADMIN_A2_BUNDLE_BUILD_FAILED');
    }
  };
  const importReadback=async(file:File)=>{
    try{
      if(!bundle){setMessage('請先建立同一個 A2 Publish Bundle，再匯入 SMT Readback。');return;}
      const result=inspectAdminA2Readback(bundle,await readAdminJsonFile(file));
      setReadback(result.receipt);
      setCompareState(result.state);
      setMessage(result.state==='MATCH'
        ?'TARGET_OBSERVED = MATCH。Admin expected 同 SMT observed 完全一致。'
        :result.state==='MISMATCH'
          ?'TARGET_OBSERVED = MISMATCH。唔准當 Publish 成功。'
          :'TARGET_OBSERVED = UNKNOWN。唔准新建另一個 revision；只可查返同一 identity。');
    }catch(error){
      setCompareState('UNKNOWN');
      setMessage(error instanceof Error?error.message:'ADMIN_A2_READBACK_INVALID');
    }
  };

  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>ADMIN CONNECTION A2 · HUMAN CONTROLLED</small><h1>Pending Changes／發布</h1><p>Draft → Validate → Impact → Export Bundle → SMT Apply → Readback Receipt → Compare。冇 Target Readback 就唔算 GREEN。</p></div>
      <div className="admin-editor-actions"><span className="admin-not-wired-chip">NO CLOUD / NO HTTP / NO POLLING</span></div>
    </header>

    <div className="admin-kpi-grid">
      <article><span>Categories</span><strong>{counts.categories}</strong><small>SESSION DRAFT</small></article>
      <article><span>Products</span><strong>{counts.products}</strong><small>SESSION DRAFT</small></article>
      <article><span>Modifier Groups</span><strong>{counts.modifiers}</strong><small>NOT IN A2</small></article>
      <article><span>Combos</span><strong>{counts.combos}</strong><small>NOT IN A2</small></article>
    </div>

    <div className="admin-policy-grid two">
      <article className="admin-policy-card">
        <h2>1. Source Draft</h2>
        <p>{dirty?'有未發布變更':'目前冇變更'}</p>
        <span className="admin-not-wired-chip">ADMIN SOURCE</span>
      </article>

      <article className="admin-policy-card">
        <h2>2. Validate</h2>
        <button type="button" onClick={runValidation}>執行 Validate</button>
        <small>{lastValidationAt?'最後驗證：'+lastValidationAt:'未驗證'}</small>
        {validationErrors.length?<ul>{validationErrors.map((error,index)=><li key={index}>{error}</li>)}</ul>:null}
      </article>

      <article className="admin-policy-card">
        <h2>3. Impact Preview</h2>
        <p>A2 只影響 Category / Product Menu Index。Pricing / Modifier / Combo / Availability 全部唔喺今次。</p>
        <button type="button" disabled={!canPreview} onClick={()=>setImpactPreviewed(true)}>確認 A2 Impact</button>
        <small>{impactPreviewed?'A2_MENU_INDEX_ONLY':'先完成 Validate'}</small>
      </article>

      <article className="admin-policy-card">
        <h2>4. Expected SMT Base</h2>
        <label><span>Expected Base Revision</span><input type="number" min={1} value={baseRevision} onChange={event=>setBaseRevision(Math.max(1,Number(event.target.value)||1))}/></label>
        <small>例如 SMT 而家係 R1，就只可以建立 R2。Target base 唔吻合會由 SMT fail closed。</small>
      </article>

      <article className="admin-policy-card">
        <h2>5. SOURCE_INTENT / Transport Bundle</h2>
        <button type="button" disabled={!impactPreviewed||validationErrors.length>0} onClick={createBundle}>建立並下載 A2 Publish Bundle</button>
        {bundle?<div className="admin-readback-proof">
          <p><span>Seam</span><b>{bundle.seamId}</b></p>
          <p><span>Transport ID</span><b>{bundle.transportId}</b></p>
          <p><span>Expected Revision</span><b>R{bundle.revision.revision}</b></p>
          <p><span>Expected Fingerprint</span><code>{bundle.revision.fingerprint}</code></p>
        </div>:<div className="admin-read-empty">SOURCE_INTENT_NOT_CREATED</div>}
      </article>

      <article className="admin-policy-card">
        <h2>6. TARGET_OBSERVED / Readback</h2>
        <label className="admin-file-control"><span>匯入 SMT Readback Receipt</span><input type="file" accept=".json,application/json" disabled={!bundle} onChange={event=>{const file=event.target.files?.[0];if(file)void importReadback(file);}}/></label>
        {readback?<div className="admin-readback-proof">
          <p><span>Observed Revision</span><b>R{readback.observedRevision}</b></p>
          <p><span>Observed Fingerprint</span><code>{readback.observedFingerprint}</code></p>
          <p><span>Disposition</span><b>{readback.deliveryDisposition}</b></p>
          <p><span>Evidence</span><code>{readback.evidenceRef}</code></p>
        </div>:<div className="admin-read-empty">TARGET_READBACK_NOT_OBSERVED</div>}
      </article>
    </div>

    <section className={'admin-rule-card admin-a2-result '+compareState.toLowerCase()}>
      <h2>7. Human Compare Result</h2>
      <strong>{compareState}</strong>
      <p>{message}</p>
      <small>Hard rule：NO READBACK PROOF = NOT GREEN。Transport bundle 建立成功亦唔代表 SMT 已 Apply。</small>
    </section>

    <section className="admin-rule-card">
      <h2>8. Governance Boundary</h2>
      <p>完整治理詞彙保留：MATCH / PARTIAL / MISMATCH / UNKNOWN。A2 exact Menu Index compare 只會產生 MATCH / MISMATCH / UNKNOWN；PARTIAL 留畀未來多-target readback。</p>
      <div className="admin-editor-actions">
        <button type="button" disabled>Rollback as New Revision</button>
        <button type="button" disabled>Automatic Publish 未接駁</button>
      </div>
      <small>Rollback 同自動網絡 Publish 都唔喺 A2；今次只係 human-controlled bundle + exact target receipt。</small>
    </section>
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
