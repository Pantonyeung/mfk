import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {patchFormalCatalogProduct,readFormalCatalog} from './formal-catalog.ts';
import {StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
    if(error.code==='ADMIN_PRODUCT_CATEGORY_NOT_FOUND')return '所選分類已不存在。請重新讀取再揀分類。';
    if(error.code==='ADMIN_PRODUCT_CREATE_INPUT_INVALID')return '新增商品資料未完整或格式無效。';
  }
  return error instanceof Error?error.message:'SAVE_DRAFT_FAILED';
}

export function FormalProductEditor({productId,onClose}:{productId:string|null;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const product=productId?catalog.products.find(item=>item.id===productId):undefined;
  const editing=Boolean(productId);
  const [name,setName]=useState(product?.name??'');
  const [categoryId,setCategoryId]=useState(product?.categoryId??catalog.categories.filter(item=>item.active).sort((a,b)=>a.position-b.position)[0]?.id??'');
  const [basePrice,setBasePrice]=useState(product?.basePrice??'');
  const [description,setDescription]=useState(product?.description??'');
  const [active,setActive]=useState(product?.active??true);
  const [error,setError]=useState('');
  const price=Number(basePrice);
  const valid=Boolean(name.trim()&&categoryId&&basePrice.trim()&&Number.isFinite(price)&&price>=0);

  if(editing&&!product)return <div className='v3-error'>搵唔到正式商品資料。</div>;

  const save=async()=>{
    if(!valid||formal.isSaving)return;
    setError('');
    try{
      if(product){
        await formal.mutateSnapshot(snapshot=>patchFormalCatalogProduct(snapshot,product.id,{
          name:name.trim(),
          categoryId,
          basePrice:basePrice.trim(),
          description:description.trim(),
          active,
        }));
      }else{
        await formal.createProduct({
          name:name.trim(),
          categoryId,
          basePrice:basePrice.trim(),
          description:description.trim(),
          active,
        });
      }
      onClose();
    }catch(err){setError(errorCopy(err));}
  };

  return <div className='v3-functional-editor' role='dialog' aria-modal='true' aria-label={product?'編輯商品 '+product.name:'新增商品'}>
    <button className='v3-functional-backdrop' type='button' aria-label='關閉' onClick={onClose}/>
    <section className='v3-functional-sheet'>
      <header><div><small>Formal Server Draft</small><h2>{product?.name||'新增商品'}</h2></div><button type='button' onClick={onClose}>關閉</button></header>
      <div className='v3-functional-body'>
        <section className='v3-functional-section'>
          <header><div><h3>基本資料</h3><p>{product?'儲存會直接 PUT 去 Formal Server Draft；唔會即時發佈。':'填齊資料先儲存；Server 會喺同一次正式 Draft 寫入先產生 Product Code，唔會預先建立空白商品。'}</p></div><StatusBadge tone='warning'>Saved ≠ Published</StatusBadge></header>
          <div className='v3-functional-grid'>
            <label><span>商品名稱 *</span><input value={name} onChange={event=>setName(event.target.value)}/></label>
            <label><span>商品編號</span><input value={product?.productCode??'儲存時由 Server 自動生成'} disabled/></label>
            <label><span>分類 *</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value=''>請選擇分類</option>{catalog.categories.filter(item=>item.active||item.id===categoryId).sort((a,b)=>a.position-b.position).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>基本價格 HK$ *</span><input inputMode='decimal' value={basePrice} onChange={event=>setBasePrice(event.target.value.replace(/[^0-9.]/g,''))}/></label>
          </div>
          <label><span>商品描述</span><textarea rows={4} value={description} onChange={event=>setDescription(event.target.value)}/></label>
          <label className='v3-functional-switch'><input type='checkbox' checked={active} onChange={event=>setActive(event.target.checked)}/><span>{active?'啟用商品':'停用商品'}</span></label>
          {error?<div className='v3-error'>{error}</div>:null}
        </section>
        <section className='v3-mobile-form-note'>{product?'打印、圖片同 per-output routing 會按已驗證 schema seam 開放；未接好嘅欄位唔會假裝持久化。':'新增只會建立完整基本商品。建立完成後先再進入商品編輯設定選項、套餐關係、圖片同打印。'}</section>
      </div>
      <footer className='v3-functional-footer'><button type='button' onClick={onClose}>取消</button><button className='v3-primary' type='button' disabled={!valid||formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':product?'儲存正式草稿':'建立商品並儲存草稿'}</button></footer>
    </section>
  </div>;
}