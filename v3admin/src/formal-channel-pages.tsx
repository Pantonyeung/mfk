import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {readFormalCatalog} from './formal-catalog.ts';
import {
  FORMAL_KEETA_PROVIDER_GAPS,
  patchFormalKeetaPolicy,
  readFormalKeetaMappings,
  readFormalKeetaPolicy,
  removeFormalKeetaMapping,
  upsertFormalKeetaMapping,
  validateFormalKeetaMappings,
  type FormalKeetaMapping,
} from './formal-channel.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  return error instanceof Error?error.message:'FORMAL_CHANNEL_SAVE_FAILED';
}
function aliasOf(mapping:FormalKeetaMapping){
  return mapping.skuOpenItemCode||mapping.spuOpenItemCode||mapping.providerSkuId||mapping.providerSpuId||'';
}
function newMapping():FormalKeetaMapping{
  const id='keeta:'+crypto.randomUUID();
  return{mappingId:id,enabled:true,skuOpenItemCode:'',channelName:'',components:[],optionMappings:[]};
}

function MappingEditor({mapping,onClose}:{mapping:FormalKeetaMapping;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const [draft,setDraft]=useState<FormalKeetaMapping>(()=>({...mapping,components:mapping.components.map(component=>({...component})),optionMappings:[...mapping.optionMappings]}));
  const [error,setError]=useState('');
  const providerAlias=aliasOf(draft);
  const save=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>upsertFormalKeetaMapping(snapshot,draft));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>removeFormalKeetaMapping(snapshot,draft.mappingId));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{draft.channelName||providerAlias||'Keeta Mapping'}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>Provider Alias</h3><p>Keeta ID 只係渠道 alias；右邊製作內容永遠指向 MFK Canonical Product。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
          <div className="v3-functional-grid">
            <label><span>Keeta SKU / OpenItemCode *</span><input value={draft.skuOpenItemCode??''} onChange={event=>setDraft(current=>({...current,skuOpenItemCode:event.target.value,providerSkuId:undefined,providerSpuId:undefined,spuOpenItemCode:undefined}))}/></label>
            <label><span>Keeta 顯示名稱</span><input value={draft.channelName} onChange={event=>setDraft(current=>({...current,channelName:event.target.value}))}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft(current=>({...current,enabled:event.target.checked}))}/><span>{draft.enabled?'啟用映射':'停用映射'}</span></label>
        </section>
        <section className="v3-functional-section">
          <header><div><h3>磨飯製作內容</h3><p>多人餐／套餐可以映射到多件實際製作商品。</p></div><button type="button" onClick={()=>setDraft(current=>({...current,components:[...current.components,{canonicalProductId:'',quantity:1}]}))}>＋ 加入商品</button></header>
          <div className="v3-combo-choice-list">{draft.components.map((component,index)=><div key={index}>
            <select value={component.canonicalProductId} onChange={event=>setDraft(current=>({...current,components:current.components.map((item,i)=>i===index?{...item,canonicalProductId:event.target.value}:item)}))}><option value="">請選擇商品</option>{catalog.products.filter(product=>product.active).map(product=><option key={product.id} value={product.id}>{product.name} · {product.productCode}</option>)}</select>
            <label><span>數量</span><input type="number" min={1} value={component.quantity} onChange={event=>setDraft(current=>({...current,components:current.components.map((item,i)=>i===index?{...item,quantity:Math.max(1,Number(event.target.value)||1)}:item)}))}/></label>
            <button type="button" onClick={()=>setDraft(current=>({...current,components:current.components.filter((_,i)=>i!==index)}))}>刪除</button>
          </div>)}</div>
        </section>
        {error?<div className="v3-error">{error}</div>:null}
        <section className="v3-functional-danger"><div><strong>刪除 Keeta Mapping</strong><small>只刪除 Admin mapping；唔會直接向 Provider 執行 menu mutation。</small></div><button type="button" disabled={formal.isSaving} onClick={()=>void remove()}>刪除映射</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={formal.isSaving||!providerAlias.trim()||!draft.components.length||draft.components.some(component=>!component.canonicalProductId)} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalChannelPage({mode}:{mode:'overview'|'accept'|'sync'|'binding'|'mapping'|'failures'|'estimate'}){
  const formal=useV3FormalDraft();
  const policy=useMemo(()=>readFormalKeetaPolicy(formal.workingSnapshot),[formal.workingSnapshot]);
  const mappings=useMemo(()=>readFormalKeetaMappings(formal.workingSnapshot),[formal.workingSnapshot]);
  const mappingErrors=useMemo(()=>validateFormalKeetaMappings(formal.workingSnapshot,mappings),[formal.workingSnapshot,mappings]);
  const [draftPolicy,setDraftPolicy]=useState(()=>({...policy}));
  const [selected,setSelected]=useState<FormalKeetaMapping|null>(null);
  const [error,setError]=useState('');

  const savePolicy=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalKeetaPolicy(snapshot,draftPolicy));}
    catch(err){setError(errorCopy(err));}
  };
  const title=mode==='overview'?'平台總覽':mode==='accept'?'接單規則':mode==='sync'?'供應同步':mode==='binding'?'門店綁定':mode==='mapping'?'商品映射':mode==='failures'?'匹配失敗':'實收估算';

  return <div className="v3-functional-page">
    <PageHeader eyebrow="平台／渠道管理" title={title} description="Admin-owned Keeta policy / mapping 會寫 Formal Server Draft；Provider live command 同 readback 仍係獨立 integration authority。" aside={mode==='mapping'?<button className="v3-primary" type="button" onClick={()=>setSelected(newMapping())}>＋ 新增映射</button>:undefined}/>
    {error?<div className="v3-error">{error}</div>:null}

    {mode==='overview'?<section className="v3-functional-section">
      <header><div><h3>Keeta 平台設定</h3><p>呢度係正式 Admin config；OAuth / Provider live health 唔會由 browser state 冒充。</p></div><StatusBadge tone={draftPolicy.enabled?'good':'neutral'}>{draftPolicy.enabled?'設定啟用':'設定停用'}</StatusBadge></header>
      <label><span>顯示名稱</span><input value={draftPolicy.displayName} onChange={event=>setDraftPolicy(current=>({...current,displayName:event.target.value}))}/></label>
      <label className="v3-functional-switch"><input type="checkbox" checked={draftPolicy.enabled} onChange={event=>setDraftPolicy(current=>({...current,enabled:event.target.checked}))}/><span>啟用平台設定</span></label>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void savePolicy()}>儲存正式草稿</button>
      <div className="v3-mobile-form-note">Live Status：{FORMAL_KEETA_PROVIDER_GAPS.liveStatus}</div>
    </section>:null}

    {mode==='accept'?<section className="v3-functional-section">
      <h3>接單規則</h3>
      <label className="v3-functional-switch"><input type="checkbox" checked={draftPolicy.autoAccept} onChange={event=>setDraftPolicy(current=>({...current,autoAccept:event.target.checked}))}/><span>正常單自動接單</span></label>
      <label><span>遲到訂單界線（分鐘）</span><input type="number" min={0} value={draftPolicy.lateCutoffMinutes} onChange={event=>setDraftPolicy(current=>({...current,lateCutoffMinutes:Number(event.target.value)||0}))}/></label>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void savePolicy()}>儲存正式草稿</button>
    </section>:null}

    {mode==='sync'?<section className="v3-functional-section">
      <h3>供應同步 Policy</h3>
      <label className="v3-functional-switch"><input type="checkbox" checked={draftPolicy.syncSellability} onChange={event=>setDraftPolicy(current=>({...current,syncSellability:event.target.checked}))}/><span>允許正式 Published Availability 同步去 Keeta</span></label>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void savePolicy()}>儲存正式草稿</button>
      <div className="v3-mobile-form-note">{FORMAL_KEETA_PROVIDER_GAPS.providerCommands}</div>
    </section>:null}

    {mode==='estimate'?<section className="v3-functional-section">
      <h3>實收估算</h3>
      <label><span>佣金估算 %</span><input inputMode="decimal" value={draftPolicy.commissionPct} onChange={event=>setDraftPolicy(current=>({...current,commissionPct:event.target.value.replace(/[^0-9.]/g,'')}))}/></label>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void savePolicy()}>儲存正式草稿</button>
      <p>Provider Settlement evidence 仍然只讀，唔會改寫 Sales authority。</p>
    </section>:null}

    {mode==='binding'?<section className="v3-functional-section">
      <header><div><h3>Keeta 門店綁定</h3><p>未驗證到可以安全用 Canonical Draft 改 Provider Shop identity，所以唔會喺 V3 假設一個可寫欄位。</p></div><StatusBadge tone="warning">INTEGRATION SEAM REQUIRED</StatusBadge></header>
      <div className="v3-mobile-form-note">{FORMAL_KEETA_PROVIDER_GAPS.storeBinding}</div>
    </section>:null}

    {(mode==='mapping'||mode==='failures')?<section className="v3-functional-section">
      <header><div><h3>{mode==='mapping'?'Keeta 商品映射':'需要處理嘅映射'}</h3><p>Mapping 會同步寫 top-level channelMapping 同 catalog compatibility shape。</p></div><StatusBadge tone={mappingErrors.length?'warning':'good'}>{mappingErrors.length?mappingErrors.length+' 個問題':'完整'}</StatusBadge></header>
      {mappingErrors.length?<div className="v3-error">{mappingErrors.join('；')}</div>:null}
      <div className="v3-functional-card-grid">{mappings.filter(mapping=>mode==='mapping'||!aliasOf(mapping)||!mapping.components.length).map(mapping=><button type="button" key={mapping.mappingId} onClick={()=>setSelected(mapping)}>
        <div><strong>{mapping.channelName||aliasOf(mapping)||mapping.mappingId}</strong><small>{aliasOf(mapping)||'未有 Provider Alias'}</small></div>
        <b>{mapping.components.length}</b><span>件製作商品</span>
        <StatusBadge tone={mapping.enabled&&aliasOf(mapping)&&mapping.components.length?'good':'warning'}>{mapping.enabled?'啟用':'停用'}</StatusBadge>
      </button>)}</div>
      {mode==='failures'&&!mappings.some(mapping=>!aliasOf(mapping)||!mapping.components.length)?<div className="v3-product-empty"><h2>目前冇待處理映射</h2></div>:null}
    </section>:null}

    {selected?<MappingEditor mapping={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}
