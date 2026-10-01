import {useMemo,useState} from 'react';
import {PageHeader,StatusBadge} from './ui.tsx';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';

function objectRow(value:unknown){
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function stableJson(value:unknown){
  try{return JSON.stringify(value);}catch{return String(value);}
}
function changedDomains(canonical:Record<string,unknown>,draft:Record<string,unknown>){
  const keys=[...new Set([...Object.keys(canonical),...Object.keys(draft)])].sort();
  return keys.filter(key=>stableJson(canonical[key])!==stableJson(draft[key]));
}
function hkt(value:string){
  const time=Date.parse(value);
  return Number.isFinite(time)?new Date(time).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}
function errorText(error:Error|null){
  if(!error)return '';
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '草稿已經喺另一個分頁更新。請重新讀取再操作。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已經改變。草稿保留，但唔可以直接覆蓋新正式版本。';
    if(error.code==='ADMIN_BROWSER_PUBLISH_FORBIDDEN')return '目前帳戶冇正式發佈權限。';
  }
  return error.message;
}

export function FormalDraftStatusBar(){
  const {draft,isLoading,isSaving,error}=useV3FormalDraft();
  return <div className='v3-formal-draft-strip' data-state={error?'error':draft?'draft':'clean'}>
    <span><strong>{isLoading?'讀取正式草稿…':draft?'正式草稿 R'+draft.draftRevision:'冇未發佈草稿'}</strong>{draft?<small>最後儲存 {hkt(draft.updatedAt)}</small>:null}</span>
    {isSaving?<StatusBadge tone='warning'>儲存中</StatusBadge>:error?<StatusBadge tone='danger'>需要處理</StatusBadge>:draft?<StatusBadge tone='warning'>Saved ≠ Published</StatusBadge>:<StatusBadge tone='good'>正式狀態</StatusBadge>}
  </div>;
}

export function FormalPendingChangesPage(){
  const {canonical,draft,workingSnapshot,isSaving,error,discard,refresh}=useV3FormalDraft();
  const canonicalSnapshot=objectRow(canonical.snapshot);
  const domains=useMemo(()=>draft?changedDomains(canonicalSnapshot,workingSnapshot):[],[canonicalSnapshot,draft,workingSnapshot]);
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const [localError,setLocalError]=useState('');
  const doDiscard=async()=>{
    setLocalError('');
    try{await discard();setConfirmDiscard(false);}catch(err){setLocalError(err instanceof Error?err.message:'DISCARD_FAILED');}
  };
  return <div className='v3-functional-page'>
    <PageHeader eyebrow='發佈與版本' title='未發佈變更' description='呢度讀嘅係 Formal Server Draft；重新開 Safari／另一部裝置都係同一份正式草稿。' aside={<button type='button' onClick={()=>void refresh()}>重新讀取</button>}/>
    <FormalDraftStatusBar/>
    {(localError||error)?<div className='v3-error'>{localError||errorText(error)}</div>:null}
    {!draft?<section className='v3-product-empty'><h2>目前未有未發佈變更</h2><p>正式頁面會直接使用目前 Canonical。</p></section>:<>
      <section className='v3-formal-draft-meta'>
        <div><span>Draft ID</span><strong>{draft.draftId}</strong></div>
        <div><span>Draft Revision</span><strong>{draft.draftRevision}</strong></div>
        <div><span>Base Published At</span><strong>{hkt(draft.basePublishedAt)}</strong></div>
        <div><span>最後修改</span><strong>{hkt(draft.updatedAt)}</strong></div>
      </section>
      <section className='v3-functional-section'>
        <header><div><h3>受影響資料域</h3><p>由 Formal Draft 同目前 Canonical snapshot 比較；唔用瀏覽器 timestamp 決定 authority。</p></div><StatusBadge tone={domains.length?'warning':'good'}>{domains.length} 個資料域</StatusBadge></header>
        {domains.length?<div className='v3-action-list'>{domains.map(domain=><article key={domain}><div><strong>{domain}</strong><small>Draft 同 Canonical 有差異</small></div><StatusBadge tone='warning'>未發佈</StatusBadge></article>)}</div>:<div className='v3-mobile-form-note'>草稿存在，但目前 top-level snapshot 比較未見差異。</div>}
      </section>
      <section className='v3-functional-danger'>
        <div><strong>放棄整份正式草稿</strong><small>會 DELETE Formal Server Draft；唔影響目前已發佈 Canonical。</small></div>
        {!confirmDiscard?<button type='button' onClick={()=>setConfirmDiscard(true)}>放棄草稿</button>:<div className='v3-inline-confirm'><button type='button' onClick={()=>setConfirmDiscard(false)}>取消</button><button type='button' disabled={isSaving} onClick={()=>void doDiscard()}>確認放棄</button></div>}
      </section>
    </>}
  </div>;
}

export function FormalPublishPage(){
  const {canonical,draft,workingSnapshot,isPublishing,error,publish,refresh}=useV3FormalDraft();
  const canonicalSnapshot=objectRow(canonical.snapshot);
  const domains=useMemo(()=>draft?changedDomains(canonicalSnapshot,workingSnapshot):[],[canonicalSnapshot,draft,workingSnapshot]);
  const [reviewed,setReviewed]=useState(false);
  const [result,setResult]=useState<Record<string,unknown>|null>(null);
  const [localError,setLocalError]=useState('');
  const doPublish=async()=>{
    setLocalError('');setResult(null);
    try{setResult(await publish());}catch(err){setLocalError(err instanceof Error?err.message:'PUBLISH_FAILED');}
  };
  return <div className='v3-functional-page'>
    <PageHeader eyebrow='發佈與版本' title='發佈中心' description='Formal Server Draft → server publish-grade validation → Canonical publish → readback。' aside={<button type='button' onClick={()=>void refresh()}>重新讀取</button>}/>
    <FormalDraftStatusBar/>
    {(localError||error)?<div className='v3-error'>{localError||errorText(error)}</div>:null}
    {!draft&&!result?<section className='v3-product-empty'><h2>目前冇正式草稿可以發佈</h2><p>先喺設定頁儲存草稿。</p></section>:null}
    {draft?<>
      <div className='v3-publish-stepper'>
        <div data-active={!reviewed?'true':'false'}><span>1</span><strong>Draft</strong></div>
        <div data-active={reviewed?'true':'false'}><span>2</span><strong>Validate</strong></div>
        <div data-active={reviewed?'true':'false'}><span>3</span><strong>Impact</strong></div>
        <div><span>4</span><strong>Publish</strong></div>
        <div><span>5</span><strong>Readback</strong></div>
      </div>
      <section className='v3-functional-section'>
        <h3>{reviewed?'影響確認':'草稿檢查'}</h3>
        <p>正式 publish endpoint 會重新檢查 Draft ID、Draft Revision、Base Fingerprint、Base Published Time，同埋 publish-grade config validation。</p>
        <div className='v3-action-list'>{domains.map(domain=><article key={domain}><div><strong>{domain}</strong><small>將由 Draft 發佈到 Canonical</small></div><StatusBadge tone='warning'>受影響</StatusBadge></article>)}</div>
        {!reviewed?<button className='v3-primary' type='button' onClick={()=>setReviewed(true)}>檢查變更影響</button>:<button className='v3-primary' type='button' disabled={isPublishing} onClick={()=>void doPublish()}>{isPublishing?'正式發佈中…':'確認正式發佈'}</button>}
      </section>
    </>:null}
    {result?<section className='v3-functional-section'>
      <header><div><h3>Server Publish Result</h3><p>以下係正式 publish endpoint 回傳；Canonical Query 已要求重新讀取。</p></div><StatusBadge tone='good'>已提交正式發佈</StatusBadge></header>
      <pre className='v3-formal-result'>{JSON.stringify(result,null,2)}</pre>
    </section>:null}
  </div>;
}