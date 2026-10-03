import {useEffect,useRef,useState} from 'react';
import {useV3FormalDraft,type V3FormalAdminDraft} from './formal-draft.tsx';
import {applyLinkedOptionMirrorPlan,planLinkedOptionMirrors,type LinkedOptionMirrorPlan} from './linked-option-mirror-plan.ts';

type Preview={epoch:number;plan:LinkedOptionMirrorPlan};
type Notice={epoch:number;code:'INSPECTION_UNAVAILABLE'|'DRAFT_PREPARED'|'DRAFT_SAVE_UNCONFIRMED';identity?:string|null};
type Formal=ReturnType<typeof useV3FormalDraft>;
function sourceIdentity(formal:Formal,draft:V3FormalAdminDraft|null=formal.draft,snapshot=formal.workingSnapshot){return JSON.stringify([formal.canonical.storeId,formal.canonical.fingerprint,formal.canonical.publishedAt,formal.canonical.revision,draft?.storeId,draft?.draftId,draft?.draftRevision,draft?.baseFingerprint,draft?.basePublishedAt,snapshot]);}
const pathFields=new Set(['snapshot','catalog','products','modifierGroups','modifierGroupIds','optionCenter','sets','productLinks','id','name','required','forceShow','selection','min','max','allowQuantities','active','options','code','priceAdjustment','position','defaultSelected','priceStatus','productId','setId','defaultOptionIds']);
// Readiness may report unknown extension keys. Never disclose those keys or raw values.
function displayPath(path:string){return path.startsWith('/snapshot')&&path.split('/').slice(1).every(part=>pathFields.has(part)||/^(0|[1-9][0-9]*)$/.test(part))?path:'/snapshot [未驗證欄位]';}

/** Explicit inspection and one existing isolated draft mutation; no reads or publication here. */
export function LinkedOptionMirrorDisclosure(){
  const formal=useV3FormalDraft();
  const [preview,setPreview]=useState<Preview|null>(null),[notice,setNotice]=useState<Notice|null>(null),[busy,setBusy]=useState(false),[saveFailed,setSaveFailed]=useState(false);
  const mounted=useRef(true),busyRef=useRef(false),previewRef=useRef<Preview|null>(null);
  const pending=useRef<{initial:string;canonical:string;expectedSnapshot:string;draftId:string|null;revision:number;invalidated:boolean}|null>(null);
  let identity:string|null=null;
  try{identity=sourceIdentity(formal);}catch{/* Non-JSON sources are unavailable, never repaired. */}
  const canonicalIdentity=JSON.stringify([formal.canonical.storeId,formal.canonical.fingerprint,formal.canonical.publishedAt,formal.canonical.revision]);
  const unavailable=identity===null||formal.isLoading||formal.isSaving||formal.isPublishing||formal.isRollingBack||Boolean(formal.readError);
  if(pending.current){
    const write=pending.current;
    if(identity!==write.initial&&(identity===null||canonicalIdentity!==write.canonical||!formal.draft||(write.draftId!==null&&formal.draft.draftId!==write.draftId)||formal.draft.draftRevision!==write.revision||JSON.stringify(formal.workingSnapshot)!==write.expectedSnapshot))write.invalidated=true;
    if(identity===null||formal.isLoading||formal.isPublishing||formal.isRollingBack||formal.readError)write.invalidated=true;
  }
  const latest=useRef({identity,unavailable,epoch:0,formal});
  if(latest.current.identity!==identity||latest.current.unavailable!==unavailable){latest.current.epoch++;previewRef.current=null;}
  latest.current={identity,unavailable,epoch:latest.current.epoch,formal};
  const epoch=latest.current.epoch;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;previewRef.current=null;};},[]);
  const current=preview?.epoch===epoch&&!unavailable?preview:null;
  const currentNotice=notice&&(notice.code==='DRAFT_PREPARED'?notice.identity===identity&&!unavailable:notice.epoch===epoch)?notice:null;

  function inspect(){
    if(!mounted.current||busyRef.current||latest.current.unavailable||saveFailed)return;
    const at=latest.current.epoch;previewRef.current=null;setPreview(null);setNotice(null);
    try{const next={epoch:at,plan:planLinkedOptionMirrors(latest.current.formal.workingSnapshot)};previewRef.current=next;setPreview(next);}
    catch{setNotice({epoch:at,code:'INSPECTION_UNAVAILABLE'});}
  }
  async function prepare(){
    const selected=current;
    if(!mounted.current||busyRef.current||saveFailed||latest.current.unavailable||!selected||selected.epoch!==latest.current.epoch||selected!==previewRef.current||selected.plan.state!=='READY')return;
    const before=latest.current.formal;
    const write={initial:latest.current.identity!,canonical:canonicalIdentity,expectedSnapshot:JSON.stringify(selected.plan.snapshot),draftId:before.draft?.draftId??null,revision:(before.draft?.draftRevision??0)+1,invalidated:false};
    pending.current=write;
    busyRef.current=true;setBusy(true);previewRef.current=null;setPreview(null);setNotice(null);
    try{
      const saved=await before.mutateSnapshot(snapshot=>{
        if(!mounted.current||latest.current.epoch!==selected.epoch||latest.current.unavailable)throw Error('LINKED_OPTION_PREVIEW_STALE');
        return applyLinkedOptionMirrorPlan(snapshot,selected.plan.baseline);
      });
      if(mounted.current&&!write.invalidated&&JSON.stringify(saved.snapshot)===write.expectedSnapshot&&saved.draftRevision===write.revision&&(!write.draftId||saved.draftId===write.draftId)){
        setNotice({epoch:latest.current.epoch,code:'DRAFT_PREPARED',identity:sourceIdentity(before,saved,saved.snapshot)});
      }
    }catch{
      if(mounted.current){setSaveFailed(true);if(latest.current.epoch===selected.epoch)setNotice({epoch:selected.epoch,code:'DRAFT_SAVE_UNCONFIRMED'});}
    }finally{pending.current=null;busyRef.current=false;if(mounted.current)setBusy(false);}
  }
  return <details className="v3-functional-section"><summary><strong>選項相容性</strong> · 隔離測試草稿</summary>
    <p>只檢查已載入資料。READY 才可明確準備鏡像對齊草稿；原始 MF01 及目前已發佈設定不變，發佈仍需另行操作。</p>
    <button type="button" disabled={unavailable||busy||saveFailed} onClick={inspect}>檢查選項相容性</button>
    <button type="button" disabled={unavailable||busy||saveFailed||current?.plan.state!=='READY'} onClick={prepare}>準備鏡像對齊草稿</button>
    {unavailable?<p role="status">UNAVAILABLE · 資料未就緒或正在讀寫，請稍後重新檢查。</p>:busy?<p role="status">正在準備隔離測試草稿…</p>:current?<section aria-label="唯讀選項相容性結果">
      <p><strong>{current.plan.state}</strong> · canonical 選項組 {current.plan.summary.canonicalSets} · legacy 選項組 {current.plan.summary.legacySets} · 商品映射差異 {current.plan.summary.bindingConflicts}</p>
      <p><small>{`canonical ${formal.canonical.fingerprint} · canonical revision ${formal.canonical.revision} · ${formal.draft?'draft revision '+formal.draft.draftRevision:'尚無草稿'}`}</small></p>
      <ul>{current.plan.diagnostics.map((item,index)=><li key={index}>{item.code} · {displayPath(item.path)}{item.ids?.length?' · ID: '+item.ids.join('、'):''}</li>)}</ul>
      <p>允許變更的鏡像路徑：</p><ul>{current.plan.changedPaths.map(path=><li key={path}>{displayPath(path)}</li>)}</ul>
      <p>{current.plan.state==='READY'?'只會建立或更新隔離測試草稿。':current.plan.state==='UNCHANGED'?'鏡像無需變更。':'BLOCKED：未能證明安全，不會準備草稿。'}</p>
    </section>:<p>{preview?'資料已更新，請重新檢查。':'尚未檢查或檢查已失效，請重新檢查。'}</p>}
    {currentNotice?<p role="status">{currentNotice.code}{currentNotice.code==='DRAFT_PREPARED'?' · 已準備隔離測試草稿，尚未發佈。':currentNotice.code==='DRAFT_SAVE_UNCONFIRMED'?' · 草稿結果未確認；請重新整理頁面後再檢查。':' · 未能安全檢查；未有變更。'}</p>:null}
    {saveFailed&&!currentNotice?<p role="status">草稿操作已鎖定；請重新整理頁面後再檢查。</p>:null}
  </details>;
}
