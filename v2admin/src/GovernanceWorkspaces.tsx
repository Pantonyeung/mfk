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

function compareStateLabel(state:'MATCH'|'MISMATCH'|'UNKNOWN'|'NOT_OBSERVED'){
  if(state==='MATCH')return '一致';
  if(state==='MISMATCH')return '不一致';
  if(state==='UNKNOWN')return '未確認';
  return '尚未收到門店回傳';
}

function MigrationHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>功能準備中</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" className="publish" disabled>尚未可發布</button></div>
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
  const [message,setMessage]=useState('今次採用人工確認流程：先下載發布檔案，喺門店套用，再將門店回傳檔案匯入呢度核對。');
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
    setMessage(errors.length?'內容檢查未通過；未建立發布檔案。':'內容檢查通過。先確認影響範圍，再建立發布檔案。');
  };
  const canPreview=Boolean(lastValidationAt)&&validationErrors.length===0;
  const createBundle=()=>{
    try{
      const next=buildAdminA2TransferFromDraft(draft,baseRevision);
      setBundle(next);
      setReadback(null);
      setCompareState('NOT_OBSERVED');
      setMessage('發布檔案已建立：第'+next.revision.revision+' / '+next.revision.fingerprint+'版。下載後交到門店套用。');
      downloadAdminJson('mfk-admin-menu-'+next.transportId.replace(/[:]/g,'_')+'.json',next);
    }catch(error){
      setMessage(error instanceof Error?error.message:'ADMIN_A2_BUNDLE_BUILD_FAILED');
    }
  };
  const importReadback=async(file:File)=>{
    try{
      if(!bundle){setMessage('請先建立今次發布檔案，再匯入同一次發布嘅門店回傳檔案。');return;}
      const result=inspectAdminA2Readback(bundle,await readAdminJsonFile(file));
      setReadback(result.receipt);
      setCompareState(result.state);
      setMessage(result.state==='MATCH'
        ?'門店回傳資料一致，今次發布核對成功。'
        :result.state==='MISMATCH'
          ?'門店回傳資料不一致，今次發布唔可以當成功。'
          :'門店回傳結果未能確認；唔好建立另一個版本，先查清楚今次發布。');
    }catch(error){
      setCompareState('UNKNOWN');
      setMessage(error instanceof Error?error.message:'ADMIN_A2_READBACK_INVALID');
    }
  };

  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>人工發布流程</small><h1>待發布變更</h1><p>草稿 → 檢查內容 → 確認影響 → 下載發布檔案 → 門店套用 → 匯入門店回傳 → 核對結果。未收到門店回傳，唔可以當發布成功。</p></div>
      <div className="admin-editor-actions"><span className="admin-not-wired-chip">人工確認後先發布</span></div>
    </header>

    <div className="admin-kpi-grid">
      <article><span>分類</span><strong>{counts.categories}</strong><small>未發布</small></article>
      <article><span>商品</span><strong>{counts.products}</strong><small>未發布</small></article>
      <article><span>選項組</span><strong>{counts.modifiers}</strong><small>今次不包含</small></article>
      <article><span>套餐</span><strong>{counts.combos}</strong><small>今次不包含</small></article>
    </div>

    <div className="admin-policy-grid two">
      <article className="admin-policy-card">
        <h2>1. 草稿內容</h2>
        <p>{dirty?'有未發布變更':'目前冇變更'}</p>
        <span className="admin-not-wired-chip">目前草稿</span>
      </article>

      <article className="admin-policy-card">
        <h2>2. 檢查內容</h2>
        <button type="button" onClick={runValidation}>檢查內容</button>
        <small>{lastValidationAt?'最後驗證：'+lastValidationAt:'未驗證'}</small>
        {validationErrors.length?<ul>{validationErrors.map((error,index)=><li key={index}>{error}</li>)}</ul>:null}
      </article>

      <article className="admin-policy-card">
        <h2>3. 確認影響範圍</h2>
        <p>今次只會發布分類同商品菜單資料。價格、選項、套餐同供應狀態都唔包含喺今次。</p>
        <button type="button" disabled={!canPreview} onClick={()=>setImpactPreviewed(true)}>確認影響範圍</button>
        <small>{impactPreviewed?'A2_MENU_INDEX_ONLY':'先完成內容檢查'}</small>
      </article>

      <article className="admin-policy-card">
        <h2>4. 門店目前菜單版本</h2>
        <label><span>門店目前版本</span><input type="number" min={1} value={baseRevision} onChange={event=>setBaseRevision(Math.max(1,Number(event.target.value)||1))}/></label>
        <small>例如門店目前使用第 1 版，呢度就填 1。版本唔一致時，門店會停止套用，避免覆蓋錯誤資料。</small>
      </article>

      <article className="admin-policy-card">
        <h2>5. 建立發布檔案</h2>
        <button type="button" disabled={!impactPreviewed||validationErrors.length>0} onClick={createBundle}>建立並下載發布檔案</button>
        {bundle?<div className="admin-readback-proof">
          <p><span>發布流程</span><b>{bundle.seamId}</b></p>
          <p><span>發布編號</span><b>{bundle.transportId}</b></p>
          <p><span>目標版本</span><b>R{bundle.revision.revision}</b></p>
          <p><span>內容驗證碼</span><code>{bundle.revision.fingerprint}</code></p>
        </div>:<div className="admin-read-empty">尚未建立發布檔案</div>}
      </article>

      <article className="admin-policy-card">
        <h2>6. 匯入門店回傳</h2>
        <label className="admin-file-control"><span>匯入門店回傳檔案</span><input type="file" accept=".json,application/json" disabled={!bundle} onChange={event=>{const file=event.target.files?.[0];if(file)void importReadback(file);}}/></label>
        {readback?<div className="admin-readback-proof">
          <p><span>門店版本</span><b>R{readback.observedRevision}</b></p>
          <p><span>門店內容驗證碼</span><code>{readback.observedFingerprint}</code></p>
          <p><span>套用結果</span><b>{readback.deliveryDisposition}</b></p>
          <p><span>記錄編號</span><code>{readback.evidenceRef}</code></p>
        </div>:<div className="admin-read-empty">尚未收到門店回傳</div>}
      </article>
    </div>

    <section className={'admin-rule-card admin-a2-result '+compareState.toLowerCase()}>
      <h2>7. 核對結果</h2>
      <strong>{compareStateLabel(compareState)}</strong>
      <p>{message}</p>
      <small>發布規則：未收到門店回傳，就唔可以當發布成功。只係建立咗發布檔案，亦唔代表門店已套用。</small>
    </section>

    <section className="admin-rule-card">
      <h2>8. 發布規則</h2>
      <p>系統會核對今次發布同門店回傳資料，並顯示「一致」、「不一致」或者「未確認」。只有「一致」先可以完成今次發布。</p>
      <div className="admin-editor-actions">
        <button type="button" disabled>建立新版還原</button>
        <button type="button" disabled>Automatic 尚未可發布</button>
      </div>
      <small>還原同自動發布都唔喺今次流程；今次只處理人工發布同門店回傳核對。</small>
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
    {draft.products.length===0?<div className="admin-empty-state"><b>未有商品草稿</b><p>建立商品後先可以設定打印項目。</p></div>:<div className="admin-editor-list">
      {draft.products.map(product=>{
        const row=current(product.id);
        return <article className="admin-print-rule-row" key={product.id}>
          <div><b>{product.name||product.id}</b><small>{product.id}</small></div>
          <label><input type="checkbox" checked={row.receipt} onChange={event=>patch(product.id,{receipt:event.target.checked})}/><span>收據</span></label>
          <label><input type="checkbox" checked={row.production} onChange={event=>patch(product.id,{production:event.target.checked})}/><span>製作單</span></label>
          <label><input type="checkbox" checked={row.packing} onChange={event=>patch(product.id,{packing:event.target.checked})}/><span>包裝單</span></label>
          <label><input type="checkbox" checked={row.label} onChange={event=>patch(product.id,{label:event.target.checked})}/><span>標籤</span></label>
          <label><input type="checkbox" checked={row.dineIn} onChange={event=>patch(product.id,{dineIn:event.target.checked})}/><span>堂食打印</span></label>
          <span className="admin-not-wired-chip">只設定規則</span>
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
      <div><small>功能準備中</small><h1>快捷原因</h1><p>原因屬於可選資料；呢度只管理快捷選項，唔會改動交易結果。</p></div>
      <div className="admin-editor-actions"><button type="button" className="secondary" onClick={add}>新增原因</button><button type="button" className="publish" disabled>尚未可發布</button></div>
    </header>
    {reasons.length===0?<div className="admin-empty-state"><b>未有快捷原因</b><p>可以建立更改付款方式、重印、取消等常用原因。</p><button onClick={add}>新增原因</button></div>:<div className="admin-editor-list">{reasons.map(reason=><article className="admin-policy-row quick-reason-row" key={reason.id}>
      <select value={reason.scope} onChange={event=>patch(reason.id,{scope:event.target.value as QuickReasonDraft['scope']})}><option value="TENDER_CORRECTION">更改付款方式</option><option value="REPRINT">重印</option><option value="CANCEL">取消</option></select>
      <input value={reason.label} onChange={event=>patch(reason.id,{label:event.target.value})} placeholder="例如：客人更改付款方式"/>
      <label className="admin-toggle"><input type="checkbox" checked={reason.active} onChange={event=>patch(reason.id,{active:event.target.checked})}/><span>{reason.active?'啟用':'停用'}</span></label>
      <span className="admin-not-wired-chip">可選</span>
    </article>)}</div>}
  </section>;
}

export function SettlementWorkspace(){
  const [provider,setProvider]=useState('ALL');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="平台對帳" description="只顯示平台提供嘅對帳資料同差異；呢度唔會自行改寫平台結算結果。"/>
    <div className="admin-filterbar">
      <select value={provider} onChange={event=>setProvider(event.target.value)}><option value="ALL">全部平台</option><option value="KEETA">Keeta</option><option value="FOODPANDA">Foodpanda</option></select>
      <label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
      <button disabled>讀取未接駁</button>
    </div>
    <div className="admin-kpi-grid">
      <article><span>平台總額</span><strong>—</strong><small>NOT_WIRED</small></article>
      <article><span>平台佣金</span><strong>—</strong><small>NOT_WIRED</small></article>
      <article><span>退款／調整</span><strong>—</strong><small>NOT_WIRED</small></article>
      <article><span>差異</span><strong>—</strong><small>NOT_WIRED</small></article>
    </div>
    <section className="admin-read-table"><header><span>期間</span><span>平台</span><span>參考編號</span><span>差額</span><span>狀態</span></header><div className="admin-read-empty">對帳資料尚未啟用</div></section>
  </section>;
}

export function MigrationCoverageWorkspace(){
  const wired=ADMIN_CAPABILITIES.filter(item=>item.status==='NOT_WIRED').length;
  const deferred=ADMIN_CAPABILITIES.filter(item=>item.status==='稍後開放').length;
  return <section className="admin-editor-page">
    <MigrationHeader title="功能準備進度" description="只用嚟查看功能準備進度；唔代表相關功能已經啟用。"/>
    <div className="admin-kpi-grid">
      <article><span>準備中功能</span><strong>{wired}</strong><small>NOT_WIRED</small></article>
      <article><span>稍後開放功能</span><strong>{deferred}</strong><small>稍後開放</small></article>
      <article><span>功能總數</span><strong>{ADMIN_CAPABILITIES.length}</strong><small>功能清單</small></article>
      <article><span>已啟用連接</span><strong>0</strong><small>尚未開放</small></article>
    </div>
  </section>;
}
