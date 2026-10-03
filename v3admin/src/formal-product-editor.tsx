import {useEffect,useMemo,useRef,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {readFormalCatalog} from './formal-catalog.ts';
import {readFormalOptionCenter} from './formal-option-center.ts';
import {formalProductEditBaseline,saveFormalProductOptions} from './formal-product-options.ts';
import {useFormalProductNavigationBlocker} from './formal-product-navigation.tsx';
import {StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。你未儲存的內容仍保留在此；重新讀取後核對，再關閉並重新開啟。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本；你未儲存的內容仍保留在此。';
    if(error.code==='ADMIN_PRODUCT_CATEGORY_NOT_FOUND')return '所選分類已不存在。請重新讀取再揀分類。';
    if(error.code==='ADMIN_PRODUCT_CREATE_INPUT_INVALID')return '新增商品資料未完整或格式無效。';
  }
  if(error instanceof Error&&error.message==='FORMAL_PRODUCT_EDIT_STALE')return '商品、選項或預設已被更新。你未儲存的內容仍保留在此；核對後關閉並重新開啟，避免覆蓋新資料。';
  return error instanceof Error?error.message:'SAVE_DRAFT_FAILED';
}

export function FormalProductEditor({productId,onClose}:{productId:string|null;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const center=useMemo(()=>readFormalOptionCenter(formal.workingSnapshot),[formal.workingSnapshot]);
  const currentProduct=productId?catalog.products.find(item=>item.id===productId):undefined;
  const [product]=useState(currentProduct);
  const editing=Boolean(productId);
  const [initial]=useState(()=>({
    name:product?.name??'',categoryId:product?.categoryId??catalog.categories.filter(item=>item.active).sort((a,b)=>a.position-b.position)[0]?.id??'',
    basePrice:product?.basePrice??'',description:product?.description??'',active:product?.active??true,
    bindings:center.productLinks.filter(link=>link.productId===productId).map(({setId,defaultOptionIds})=>({setId,defaultOptionIds:[...defaultOptionIds]})),
    baseline:productId?formalProductEditBaseline(formal.workingSnapshot,productId):'',
  }));
  const [name,setName]=useState(initial.name),[categoryId,setCategoryId]=useState(initial.categoryId);
  const [basePrice,setBasePrice]=useState(initial.basePrice),[description,setDescription]=useState(initial.description),[active,setActive]=useState(initial.active);
  const [setIds,setSetIds]=useState(()=>initial.bindings.map(link=>link.setId));
  // Detached choices stay local until Save/Discard, so an accidental toggle does not erase defaults.
  const [defaults,setDefaults]=useState<Record<string,string[]>>(()=>Object.fromEntries(initial.bindings.map(link=>[link.setId,link.defaultOptionIds])));
  const [error,setError]=useState(''),[confirmClose,setConfirmClose]=useState(false),[uncertain,setUncertain]=useState(false);
  const [historyNotice,setHistoryNotice]=useState('');
  const pendingLeave=useRef<(()=>void)|null>(null),session=useRef<symbol|null>(null);
  const [pending,setPending]=useState(false),savingRef=useRef(false);
  const bindings=setIds.map(setId=>({setId,defaultOptionIds:defaults[setId]??[]}));
  const dirty=name!==initial.name||categoryId!==initial.categoryId||basePrice!==initial.basePrice||description!==initial.description||active!==initial.active||JSON.stringify(bindings)!==JSON.stringify(initial.bindings);
  const busy=formal.isSaving||pending;
  const latest=useRef({dirty,busy,uncertain});latest.current={dirty,busy,uncertain};
  const close=()=>onClose();
  const requestClose=()=>{if(busy||savingRef.current)return;if(dirty||uncertain){pendingLeave.current=null;setConfirmClose(true);}else close();};
  useFormalProductNavigationBlocker({
    blocked:()=>latest.current.dirty||latest.current.busy||latest.current.uncertain||savingRef.current,
    requestLeave:(proceed,notice)=>{
      setHistoryNotice(notice);
      if(latest.current.busy||savingRef.current)return;
      pendingLeave.current=proceed;setConfirmClose(true);
    },
  });
  useEffect(()=>{
    session.current=Symbol('product-editor-session');
    const onUnload=(event:BeforeUnloadEvent)=>{if(latest.current.dirty||latest.current.busy||latest.current.uncertain||savingRef.current){event.preventDefault();event.returnValue='';}};
    if(typeof window!=='undefined')window.addEventListener('beforeunload',onUnload);
    return()=>{session.current=null;if(typeof window!=='undefined')window.removeEventListener('beforeunload',onUnload);};
  },[]);
  const price=Number(basePrice);
  const valid=Boolean(name.trim()&&categoryId&&basePrice.trim()&&Number.isFinite(price)&&price>=0);
  let optionError='';
  if(product){try{saveFormalProductOptions(formal.workingSnapshot,product.id,{},bindings,initial.baseline);}catch(err){optionError=errorCopy(err);}}

  if(editing&&!product)return <div className='v3-error'>搵唔到正式商品資料。<button type='button' onClick={requestClose}>關閉</button></div>;

  const save=async()=>{
    if(!valid||busy||savingRef.current||optionError||uncertain||formal.isLoading||formal.readError)return;
    savingRef.current=true;setPending(true);setError('');setConfirmClose(false);pendingLeave.current=null;
    const saveSession=session.current;
    const fields={name:name.trim(),categoryId,basePrice:basePrice.trim(),description:description.trim(),active};
    try{
      if(product){
        const changed:Partial<typeof fields>={};
        if(name!==initial.name)changed.name=fields.name;
        if(categoryId!==initial.categoryId)changed.categoryId=fields.categoryId;
        if(basePrice!==initial.basePrice)changed.basePrice=fields.basePrice;
        if(description!==initial.description)changed.description=fields.description;
        if(active!==initial.active)changed.active=fields.active;
        await formal.mutateSnapshot(snapshot=>saveFormalProductOptions(snapshot,product.id,changed,bindings,initial.baseline));
      }
      else await formal.createProduct(fields);
      if(session.current===saveSession)close();
    }catch(err){
      if(session.current!==saveSession)return;
      setError(errorCopy(err));
      // Unknown transport/server outcomes need readback, never an automatic or blind duplicate write.
      if(!(err instanceof V3FormalDraftHttpError)||err.status>=500){
        if(!(err instanceof Error&&err.message.startsWith('FORMAL_')))setUncertain(true);
      }
    }finally{savingRef.current=false;if(session.current===saveSession)setPending(false);}
  };
  const attach=(id:string,checked:boolean)=>setSetIds(current=>checked?[...current,id]:current.filter(value=>value!==id));
  const selectDefault=(setId:string,optionId:string,checked:boolean,single:boolean)=>setDefaults(current=>({...current,[setId]:checked?(single?[optionId]:[...(current[setId]??[]),optionId]):(current[setId]??[]).filter(id=>id!==optionId)}));

  return <div className='v3-functional-editor' role='dialog' aria-modal='true' aria-label={product?'編輯商品 '+product.name:'新增商品'}>
    <button className='v3-functional-backdrop' type='button' aria-label='關閉' disabled={busy} onClick={requestClose}/>
    <section className='v3-functional-sheet'>
      <header><div><small>Formal Server Draft</small><h2>{product?.name||'新增商品'}</h2></div><button type='button' disabled={busy} onClick={requestClose}>關閉</button></header>
      <div className='v3-functional-body'>
        <section className='v3-functional-section'>
          <header><div><h3>基本資料</h3><p>{product?'基本資料、選項映射及預設一次儲存到 Formal Server Draft；唔會即時發佈。':'填齊資料先儲存；Server 會喺同一次正式 Draft 寫入先產生 Product Code，唔會預先建立空白商品。'}</p></div><StatusBadge tone='warning'>Saved ≠ Published</StatusBadge></header>
          <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
            <div className='v3-functional-grid'>
              <label><span>商品名稱 *</span><input value={name} onChange={event=>setName(event.target.value)}/></label>
              <label><span>商品編號</span><input value={product?.productCode??'儲存時由 Server 自動生成'} disabled/></label>
              <label><span>分類 *</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value=''>請選擇分類</option>{catalog.categories.filter(item=>item.active||item.id===categoryId).sort((a,b)=>a.position-b.position).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>基本價格 HK$ *</span><input inputMode='decimal' value={basePrice} onChange={event=>setBasePrice(event.target.value.replace(/[^0-9.]/g,''))}/></label>
            </div>
            <label><span>商品描述</span><textarea rows={4} value={description} onChange={event=>setDescription(event.target.value)}/></label>
            <label className='v3-functional-switch'><input type='checkbox' checked={active} onChange={event=>setActive(event.target.checked)}/><span>{active?'啟用商品':'停用商品'}</span></label>
          </fieldset>
        </section>
        {product?<section className='v3-functional-section'>
          <header><div><h3>商品選項與預設</h3><p>套用可重用選項組。預設只按明確選擇保存；推薦、顯示次序或第一項唔會自動成為預設。未有完整預設時，下單時要完成必選項。</p></div></header>
          {center.sets.length===0?<p>未有可用選項組，請先到「選項／口味管理」建立。</p>:null}
          {center.sets.map(set=>{
            const attached=setIds.includes(set.id),selected=defaults[set.id]??[],unavailable=!set.active||set.allowQuantities;
            return <fieldset key={set.id} disabled={busy} className='v3-functional-section'>
              <legend>{set.name}</legend>
              <label className='v3-functional-switch'><input type='checkbox' aria-label={'套用 '+set.name} checked={attached} disabled={busy||(!attached&&unavailable)} onChange={event=>attach(set.id,event.target.checked)}/><span>套用 {set.name}{!set.active?'（停用）':''}</span></label>
              <p>{set.selection==='SINGLE'?'單選':'多選'} · 最少 {set.min}／最多 {set.max}{set.required?' · 必選':''}</p>
              {set.allowQuantities?<p role='status'>目前原生流程未支援每個選項的數量。既有設定原值保留；不可新增套用或編輯預設，亦未可作為可發佈證據。</p>:null}
              {attached?<>
                {set.options.map(option=>{
                  const checked=selected.includes(option.id),atMax=set.selection==='MULTI'&&selected.length>=set.max;
                  return <label className='v3-product-map-row' key={option.id}><input type='checkbox' aria-label={'預設 '+set.name+' / '+option.name} checked={checked} disabled={busy||unavailable||!option.active||(!checked&&atMax)} onChange={event=>selectDefault(set.id,option.id,event.target.checked,set.selection==='SINGLE')}/><span><strong>{option.name}{!option.active?'（停用）':''}</strong><small>{option.code} · 價差 HK$ {option.priceAdjustment}</small></span></label>;
                })}
                <button type='button' disabled={busy||unavailable||selected.length===0} onClick={()=>setDefaults(current=>({...current,[set.id]:[]}))}>清除 {set.name} 預設</button>
                <p>{selected.length?'已選 '+selected.length+' 項明確預設。':'未設預設。'}{selected.length<set.min?'下單時必須完成此組必選項；唔會自動補選。':''}</p>
              </>:null}
            </fieldset>;
          })}
          <p>本頁只做已知選項來源檢查。儲存草稿不代表完整商品、Server 驗證、正式發佈或主機已套用。</p>
        </section>:<section className='v3-mobile-form-note'>建立基本草稿後，請重新開啟商品設定選項組與預設。此步只建立基本資料，選項尚未配置或驗證；唔代表已完成商品或可發佈。取消不會建立商品。</section>}
        {optionError?<div className='v3-error' role='alert'>{optionError}</div>:null}
        {error?<div className='v3-error' role='alert'>{error}</div>:null}
        {formal.readError?<div className='v3-error'>草稿讀取失敗，未可安全儲存。</div>:null}
        {uncertain?<div className='v3-error' role='alert'>儲存結果未確認，已停止重試。請重新讀取草稿及核對商品清單，確認有否已保存；新增商品尤其不可直接重複建立。</div>:null}
        {error||optionError||formal.readError||uncertain?<button type='button' disabled={busy} onClick={()=>void formal.refresh().catch(err=>setError(errorCopy(err)))}>重新讀取草稿</button>:null}
        {historyNotice?<div className='v3-error' role='status'>{historyNotice}</div>:null}
        {confirmClose?<section className='v3-functional-danger' role='alertdialog' aria-label='放棄未儲存變更'><div><strong>放棄未儲存變更？</strong><small>關閉會捨棄本頁尚未儲存的修改；已保存的草稿不受影響。</small></div><button type='button' disabled={busy} onClick={()=>{if(savingRef.current)return;pendingLeave.current=null;setConfirmClose(false);}}>繼續編輯</button><button type='button' disabled={busy} onClick={()=>{if(savingRef.current||busy)return;const proceed=pendingLeave.current;pendingLeave.current=null;close();proceed?.();}}>放棄變更並關閉</button></section>:null}
        <section className='v3-mobile-form-note'>打印、圖片同 per-output routing 會按已驗證 schema seam 開放；未接好嘅欄位唔會假裝持久化。</section>
      </div>
      <footer className='v3-functional-footer'><button type='button' disabled={busy} onClick={requestClose}>取消</button><button className='v3-primary' type='button' disabled={!valid||busy||Boolean(optionError)||uncertain||formal.isLoading||Boolean(formal.readError)} onClick={save}>{busy?'儲存中…':product?'儲存正式草稿':'建立商品並儲存草稿'}</button></footer>
    </section>
  </div>;
}
