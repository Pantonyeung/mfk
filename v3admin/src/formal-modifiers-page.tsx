import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {readFormalCatalog} from './formal-catalog.ts';
import {
  addFormalOptionSet,
  readFormalOptionCenter,
  removeFormalOptionSet,
  replaceFormalOptionSet,
  validateFormalOptionCenter,
  type FormalOptionSet,
} from './formal-option-center.ts';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  if(error instanceof Error){
    if(error.message==='FORMAL_OPTION_SET_IN_USE')return '仍有商品使用呢個選項組，請先解除商品映射。';
    return error.message;
  }
  return 'FORMAL_OPTION_SAVE_FAILED';
}
function cloneSet(set:FormalOptionSet):FormalOptionSet{
  return{...set,options:set.options.map(option=>({...option}))};
}
function nextOptionCode(options:readonly {code:string}[]){
  const used=new Set(options.map(option=>option.code.toUpperCase()));
  let n=1;
  while(used.has('OPT-'+String(n).padStart(3,'0')))n++;
  return 'OPT-'+String(n).padStart(3,'0');
}

function FormalOptionSetEditor({setId,onClose}:{setId:string;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const center=useMemo(()=>readFormalOptionCenter(formal.workingSnapshot),[formal.workingSnapshot]);
  const source=center.sets.find(item=>item.id===setId);
  const [draft,setDraft]=useState<FormalOptionSet>(()=>source?cloneSet(source):{id:setId,name:'',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,options:[]});
  const [productIds,setProductIds]=useState<Set<string>>(()=>new Set(center.productLinks.filter(link=>link.setId===setId).map(link=>link.productId)));
  const [error,setError]=useState('');

  if(!source)return <div className="v3-error">搵唔到正式選項組。</div>;

  const update=(patch:Partial<FormalOptionSet>)=>setDraft(current=>({...current,...patch}));
  const addOption=()=>setDraft(current=>{
    const id='option-'+crypto.randomUUID();
    return{...current,options:[...current.options,{id,code:nextOptionCode(current.options),name:'新選項',priceAdjustment:'0.00',active:true,position:(current.options.length+1)*10}]};
  });
  const updateOption=(optionId:string,patch:Partial<FormalOptionSet['options'][number]>)=>setDraft(current=>({...current,options:current.options.map(option=>option.id===optionId?{...option,...patch}:option)}));
  const removeOption=(optionId:string)=>setDraft(current=>({...current,options:current.options.filter(option=>option.id!==optionId).map((option,index)=>({...option,position:(index+1)*10}))}));
  const moveOption=(optionId:string,direction:-1|1)=>setDraft(current=>{
    const options=[...current.options].sort((a,b)=>a.position-b.position);
    const index=options.findIndex(option=>option.id===optionId),target=index+direction;
    if(index<0||target<0||target>=options.length)return current;
    [options[index],options[target]]=[options[target],options[index]];
    return{...current,options:options.map((option,i)=>({...option,position:(i+1)*10}))};
  });
  const validation=validateFormalOptionCenter({sets:[draft],productLinks:[]});
  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>replaceFormalOptionSet(snapshot,draft,[...productIds]));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>removeFormalOptionSet(snapshot,setId));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };

  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{draft.name||'新選項組'}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>基本規則</h3><p>選項組同商品映射一次儲存入 Formal Server Draft。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
          <div className="v3-functional-grid">
            <label><span>選項組名稱 *</span><input value={draft.name} onChange={event=>update({name:event.target.value})}/></label>
            <label><span>選擇方式</span><select value={draft.selection} onChange={event=>{const selection=event.target.value as FormalOptionSet['selection'];update({selection,max:selection==='SINGLE'?1:Math.max(draft.max,1),allowQuantities:selection==='MULTI'&&draft.allowQuantities});}}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
            <label><span>最少選擇</span><input type="number" min={0} value={draft.min} onChange={event=>update({min:Number(event.target.value)||0})}/></label>
            <label><span>最多選擇</span><input type="number" min={0} value={draft.max} onChange={event=>update({max:draft.selection==='SINGLE'?1:Number(event.target.value)||0})}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.required} onChange={event=>update({required:event.target.checked,min:event.target.checked?Math.max(1,draft.min):0,forceShow:event.target.checked||draft.forceShow})}/><span>必選</span></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.forceShow} onChange={event=>update({forceShow:event.target.checked})}/><span>強制顯示</span></label>
          {draft.selection==='MULTI'?<label className="v3-functional-switch"><input type="checkbox" checked={draft.allowQuantities} onChange={event=>update({allowQuantities:event.target.checked})}/><span>允許同一子選項多件</span></label>:null}
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.active} onChange={event=>update({active:event.target.checked})}/><span>{draft.active?'啟用選項組':'停用選項組'}</span></label>
        </section>

        <section className="v3-functional-section">
          <header><div><h3>子選項</h3><p>名稱、Code、價差、啟用狀態同次序都會正式保存。</p></div><button type="button" onClick={addOption}>＋ 新增子選項</button></header>
          <div className="v3-option-edit-list">{draft.options.map((option,index)=><article key={option.id}>
            <label><span>Option Code *</span><input value={option.code} onChange={event=>updateOption(option.id,{code:event.target.value})}/></label>
            <label><span>名稱 *</span><input value={option.name} onChange={event=>updateOption(option.id,{name:event.target.value})}/></label>
            <label><span>價差 HK$ *</span><input inputMode="decimal" value={option.priceAdjustment} onChange={event=>updateOption(option.id,{priceAdjustment:event.target.value.replace(/[^0-9.-]/g,'')})}/></label>
            <label className="v3-functional-switch"><input type="checkbox" checked={option.active} onChange={event=>updateOption(option.id,{active:event.target.checked})}/><span>{option.active?'啟用':'停用'}</span></label>
            <div className="v3-inline-order-buttons"><button type="button" disabled={index===0} onClick={()=>moveOption(option.id,-1)}>↑</button><button type="button" disabled={index===draft.options.length-1} onClick={()=>moveOption(option.id,1)}>↓</button></div>
            <button type="button" onClick={()=>removeOption(option.id)}>刪除</button>
          </article>)}</div>
        </section>

        <section className="v3-functional-section">
          <h3>套用商品</h3>
          <p>商品映射會同步寫入 optionCenter.productLinks，同時保留現有 catalog compatibility。</p>
          <MobileGroupedPager items={catalog.products.map(product=>({...product,group:catalog.categories.find(category=>category.id===product.categoryId)?.name??'未分類'}))} pageSize={10} renderItem={product=><label key={product.id} className="v3-product-map-row"><input type="checkbox" checked={productIds.has(product.id)} onChange={event=>setProductIds(current=>{const next=new Set(current);if(event.target.checked)next.add(product.id);else next.delete(product.id);return next;})}/><span><strong>{product.name}</strong><small>{product.productCode}</small></span></label>}/>
        </section>

        {validation.length?<div className="v3-error">{validation.join('；')}</div>:null}
        {error?<div className="v3-error">{error}</div>:null}
        <section className="v3-functional-danger"><div><strong>刪除選項組</strong><small>{productIds.size?'仍有商品使用，必須先解除映射。':'目前冇商品引用。'}</small></div><button type="button" disabled={productIds.size>0||formal.isSaving} onClick={()=>void remove()}>刪除選項組</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={formal.isSaving||validation.length>0} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalModifiersPage(){
  const formal=useV3FormalDraft();
  const center=useMemo(()=>readFormalOptionCenter(formal.workingSnapshot),[formal.workingSnapshot]);
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  const filtered=center.sets.filter(set=>!query.trim()||(set.name+' '+set.options.map(option=>option.name+' '+option.code).join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const create=async()=>{
    const id='option-set-'+crypto.randomUUID();
    setError('');
    try{await formal.mutateSnapshot(snapshot=>addFormalOptionSet(snapshot,id));setSelected(id);}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="選項／口味管理" description="選項組、子選項、價格同商品映射直接寫 Formal Server Draft。" aside={<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void create()}>＋ 新增選項組</button>}/>
    {error?<div className="v3-error">{error}</div>:null}
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋選項組／子選項／Code"/></div><div className="v3-product-count">{center.sets.length} 個選項組 · {catalog.products.length} 件商品</div></section>
    <div className="v3-functional-card-grid">{filtered.map(set=><button type="button" key={set.id} onClick={()=>setSelected(set.id)}>
      <div><strong>{set.name}</strong><small>{set.selection==='SINGLE'?'單選':'多選'} · 最少 {set.min}／最多 {set.max}</small></div>
      <b>{set.options.length}</b><span>個子選項</span>
      <StatusBadge tone={set.active?'good':'neutral'}>{set.active?'啟用':'停用'}</StatusBadge>
      <small>{center.productLinks.filter(link=>link.setId===set.id).length} 件商品使用</small>
    </button>)}</div>
    {selected?<FormalOptionSetEditor setId={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}
