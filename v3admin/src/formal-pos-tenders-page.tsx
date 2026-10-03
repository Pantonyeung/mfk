import {useRef,useState} from 'react';
import type {MfkPosTenderDefinition,MfkPosTenderPolicy} from '../../contracts/pos-tender-policy-v1.ts';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {createInitialFormalPosTenders,hasFormalPosTenders,readFormalPosTenders,writeFormalPosTenders} from './formal-pos-tenders.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

type Edit={revision:number|null;rows:MfkPosTenderDefinition[];existingIds:readonly string[]};
type Mutator=(snapshot:Record<string,unknown>)=>Record<string,unknown>;
function errorText(error:unknown){
  if(error instanceof V3FormalDraftHttpError&&error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '其他分頁已更新正式草稿。請重新讀取後再編輯。';
  if(error instanceof V3FormalDraftHttpError&&error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。草稿保留，請重新讀取。';
  return error instanceof Error?error.message:'POS_TENDER_POLICY_SAVE_FAILED';
}

export function PosTendersWorkspace({snapshot,busy,onSave,onRefresh,preview=false,loadError}: {
  snapshot:Record<string,unknown>;busy:boolean;onSave:(mutator:Mutator)=>Promise<unknown>;
  onRefresh?:()=>Promise<void>;preview?:boolean;loadError?:Error|null;
}){
  const [edit,setEdit]=useState<Edit|null>(null);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const inFlight=useRef(false);
  let policy:MfkPosTenderPolicy|null=null,sourceError='';
  try{policy=readFormalPosTenders(snapshot);}catch(err){sourceError=errorText(err);}
  const missing=!hasFormalPosTenders(snapshot);
  const blocked=busy||saving||Boolean(loadError);
  const stale=edit!==null&&(edit.revision===null?!missing:edit.revision!==policy?.revision);
  const initialize=()=>{
    const template=readFormalPosTenders(createInitialFormalPosTenders({}));
    setEdit({revision:null,rows:template.tenders.map(row=>({...row})),existingIds:[]});setError('');setSaved(false);
  };
  const begin=()=>{
    if(!policy)return;
    setEdit({revision:policy.revision,rows:policy.tenders.map(row=>({...row})),existingIds:policy.tenders.map(row=>row.id)});setError('');setSaved(false);
  };
  const change=(index:number,patch:Partial<MfkPosTenderDefinition>)=>setEdit(current=>current?{...current,rows:current.rows.map((row,i)=>i===index?{...row,...patch}:row)}:current);
  const mutation:Mutator=current=>{
    if(!edit)throw new Error('POS_TENDER_POLICY_EDIT_REQUIRED');
    if(edit.revision===null){
      const initialized=createInitialFormalPosTenders(current);
      // Initialization is explicitly reviewed as one policy revision, including local edits.
      const updated=writeFormalPosTenders(initialized,1,edit.rows);
      return {...updated,posTenders:{...(updated.posTenders as Record<string,unknown>),revision:1}};
    }
    return writeFormalPosTenders(current,edit.revision,edit.rows);
  };
  let validation='';
  if(edit){try{mutation(snapshot);}catch(err){validation=errorText(err);}}
  const save=async()=>{
    if(blocked||inFlight.current||!edit||validation||stale)return;
    inFlight.current=true;setSaving(true);setError('');
    try{await onSave(mutation);setEdit(null);setSaved(true);}
    catch(err){setError(errorText(err));}
    finally{inFlight.current=false;setSaving(false);}
  };
  const refresh=async()=>{setError('');try{await onRefresh?.();}catch(err){setError(errorText(err));}};
  return <div className="v3-functional-page">
    <PageHeader eyebrow="門店設定" title="POS 收款方式" description="設定 POS 可選收款方式。現金由員工點算，電子方式由員工確認；本頁只管理設定。" aside={onRefresh?<button type="button" disabled={busy||saving} onClick={()=>void refresh()}>重新讀取</button>:undefined}/>
    <div className="v3-mobile-form-note">{preview?'只供介面驗收，只保留於本頁記憶體；不會儲存或發佈到伺服器。':'儲存正式草稿後，仍需到發佈中心確認正式發佈，再由 POS 讀取及套用。'}</div>
    {(error||loadError)?<div className="v3-error" role="alert">{error||errorText(loadError)}</div>:null}
    {saved?<div role="status">{preview?'已儲存本頁預覽草稿':'已儲存正式草稿，尚未發佈'}</div>:null}
    {!edit&&!policy?<section className="v3-functional-section">
      <h3>{missing?'缺少 POS 收款政策':'POS 收款政策無效'}</h3><p>{sourceError}</p>
      <p>未有有效政策前不能發佈。初始五項只會在你確認儲存草稿後寫入。</p>
      {missing?<button className="v3-primary" type="button" disabled={blocked} onClick={initialize}>建立初始五項草稿</button>:null}
    </section>:null}
    {!edit&&policy?<section className="v3-functional-section">
      <header><div><h3>收款設定</h3><p>停用會保留 ID 與歷史收款記錄。ID 及類型建立後不可更改。</p></div><button type="button" disabled={blocked} onClick={begin}>編輯收款方式</button></header>
      <div className="v3-action-list">{policy.tenders.map(row=><article key={row.id}><div><strong>{row.label}</strong><small>{row.id} · {row.kind==='CASH'?'CASH_COUNTED · 現金點算':'STAFF_CONFIRMED · 員工確認'}</small></div><StatusBadge tone={row.enabled?'good':'neutral'}>{row.enabled?'啟用':'停用'}</StatusBadge></article>)}</div>
      {!policy.tenders.length?<p>沒有可選收款方式。POS 將無法建立收款。</p>:null}
      <small>政策修訂 {policy.revision} · {policy.tenders.filter(row=>row.enabled).length} 項啟用</small>
    </section>:null}
    {edit?<section className="v3-functional-section" aria-label="收款方式草稿編輯">
      <header><div><h3>{edit.revision===null?'初始五項草稿':'編輯收款方式'}</h3><p>移除已儲存方式請改為停用，保留穩定 ID；新方式必須明確指定 ID、名稱及類型。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
      {stale?<div className="v3-error" role="alert">政策已更新，不能覆蓋新版本。取消編輯後重新開啟。</div>:null}
      <fieldset disabled={blocked} className="v3-pos-tender-fields">
        {edit.rows.map((row,index)=>{
          const immutable=index<edit.existingIds.length||edit.revision===null&&index<5;
          return <section key={index} className="v3-functional-section">
            <div className="v3-functional-grid">
              <label><span>穩定 ID</span><input aria-label={'穩定 ID '+(index+1)} value={row.id} readOnly={immutable} maxLength={64} onChange={event=>change(index,{id:event.target.value})}/></label>
              <label><span>名稱</span><input aria-label={'名稱 '+(index+1)} value={row.label} maxLength={80} onChange={event=>change(index,{label:event.target.value})}/></label>
              <label><span>類型</span><select aria-label={'類型 '+(index+1)} value={row.kind} disabled={immutable} onChange={event=>change(index,{kind:event.target.value as MfkPosTenderDefinition['kind']})}><option value="">請選擇</option><option value="CASH">現金 · CASH_COUNTED</option><option value="NON_CASH">電子／其他 · STAFF_CONFIRMED</option></select></label>
            </div>
            <label className="v3-functional-switch"><input aria-label={'啟用 '+(index+1)} type="checkbox" checked={row.enabled} onChange={event=>change(index,{enabled:event.target.checked})}/><span>{row.enabled?'啟用':'停用'}</span></label>
            {!immutable?<button type="button" onClick={()=>setEdit(current=>current?{...current,rows:current.rows.filter((_,i)=>i!==index)}:current)}>移除未儲存項目</button>:null}
          </section>;
        })}
        <button type="button" disabled={edit.rows.length>=64} onClick={()=>setEdit(current=>current?{...current,rows:[...current.rows,{id:'',label:'',enabled:true,kind:'' as MfkPosTenderDefinition['kind']}]}:current)}>＋ 新增收款方式</button>
      </fieldset>
      {validation?<div className="v3-error" role="alert">{validation}</div>:null}
      <footer className="v3-functional-footer"><button type="button" disabled={blocked} onClick={()=>{setEdit(null);setError('');}}>取消</button><button type="button" className="v3-primary" disabled={blocked||stale||Boolean(validation)} onClick={()=>void save()}>{saving?'儲存中…':preview?'儲存預覽草稿':'儲存正式草稿'}</button></footer>
    </section>:null}
  </div>;
}

export function FormalPosTendersPage(){
  const formal=useV3FormalDraft();
  return <PosTendersWorkspace snapshot={formal.workingSnapshot} busy={formal.isLoading||formal.isSaving||formal.isPublishing} loadError={formal.readError} onSave={formal.mutateSnapshot} onRefresh={formal.refresh}/>;
}

export function PreviewPosTendersPage(){
  const [snapshot,setSnapshot]=useState<Record<string,unknown>>({});
  return <PosTendersWorkspace snapshot={snapshot} busy={false} preview onSave={async mutator=>{const next=mutator(snapshot);setSnapshot(next);}}/>;
}
