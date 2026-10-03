import {useEffect,useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {isFormalOptionPrice} from './formal-option-center.ts';
import {
  createFormalCategory,
  moveFormalCategory,
  moveFormalProductWithinCategory,
  patchFormalCatalogProduct,
  patchFormalCategory,
  patchFormalComboPrice,
  patchFormalModifierOptionPrice,
  readFormalCatalog,
  readFormalCatalogPricing,
  removeFormalCategory,
  type FormalCatalogCategory,
} from './formal-catalog.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再試。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  if(error instanceof Error){
    if(error.message==='FORMAL_MODIFIER_PRICE_STALE')return '價格已被更新。重新開啟價格頁後再儲存。';
    if(error.message==='FORMAL_CATEGORY_IN_USE')return '仲有商品使用呢個分類，未可以刪除。';
    return error.message;
  }
  return 'FORMAL_SAVE_FAILED';
}

function FormalCategoryEditor({category,onClose}:{category:FormalCatalogCategory;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const current=catalog.categories.find(item=>item.id===category.id)??category;
  const productCount=catalog.products.filter(product=>product.categoryId===current.id).length;
  const [name,setName]=useState(current.name);
  const [active,setActive]=useState(current.active);
  const [error,setError]=useState('');
  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>patchFormalCategory(snapshot,current.id,{name:name.trim(),active}));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>removeFormalCategory(snapshot,current.id));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{current.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>分類設定</h3><p>儲存會直接寫 Formal Server Draft。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
          <label><span>分類名稱 *</span><input value={name} onChange={event=>setName(event.target.value)}/></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/><span>{active?'啟用分類':'停用分類'}</span></label>
          <div className="v3-mobile-form-note">{productCount} 件商品使用呢個分類。</div>
          {error?<div className="v3-error">{error}</div>:null}
        </section>
        <section className="v3-functional-danger">
          <div><strong>刪除分類</strong><small>{productCount?'有商品引用時唔可以刪除。':'目前冇商品引用。'}</small></div>
          <button type="button" disabled={productCount>0||formal.isSaving} onClick={()=>void remove()}>刪除分類</button>
        </section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={!name.trim()||formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalCategoriesPage(){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  const sorted=[...catalog.categories].sort((a,b)=>a.position-b.position);
  const create=async()=>{
    setError('');
    const id='category-'+crypto.randomUUID();
    try{
      await formal.mutateSnapshot(snapshot=>createFormalCategory(snapshot,{id,name:'新分類'}));
      setSelected(id);
    }catch(err){setError(errorCopy(err));}
  };
  const move=async(id:string,direction:-1|1)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>moveFormalCategory(snapshot,id,direction));}
    catch(err){setError(errorCopy(err));}
  };
  const selectedCategory=selected?catalog.categories.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="分類管理" description="分類名稱、啟用狀態同排序直接寫 Formal Server Draft。" aside={<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void create()}>＋ 新增分類</button>}/>
    {error?<div className="v3-error">{error}</div>:null}
    <div className="v3-functional-card-grid">{sorted.map((category,index)=>{
      const count=catalog.products.filter(product=>product.categoryId===category.id).length;
      return <article className="v3-functional-card" key={category.id}>
        <button type="button" className="v3-functional-card-main" onClick={()=>setSelected(category.id)}>
          <div><strong>{category.name}</strong><small>{category.id}</small></div>
          <b>{count}</b><span>件商品</span>
          <StatusBadge tone={category.active?'good':'neutral'}>{category.active?'啟用':'停用'}</StatusBadge>
          <small>次序 {index+1}</small>
        </button>
        <div className="v3-inline-order-buttons"><button type="button" disabled={index===0||formal.isSaving} onClick={()=>void move(category.id,-1)}>↑</button><button type="button" disabled={index===sorted.length-1||formal.isSaving} onClick={()=>void move(category.id,1)}>↓</button></div>
      </article>;
    })}</div>
    {selectedCategory?<FormalCategoryEditor category={selectedCategory} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function FormalPricingPage(){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const pricing=useMemo(()=>readFormalCatalogPricing(formal.workingSnapshot),[formal.workingSnapshot]);
  const incompatiblePrices=pricing.modifierGroups.flatMap(group=>group.options).filter(option=>!isFormalOptionPrice(option.priceAdjustment)).length;
  const [tab,setTab]=useState<'PRODUCT'|'OPTION'|'COMBO'>('PRODUCT');
  const [query,setQuery]=useState('');
  const [error,setError]=useState('');
  const needle=query.trim().toLocaleLowerCase();
  const saveProductPrice=async(productId:string,value:string)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalCatalogProduct(snapshot,productId,{basePrice:value}));}
    catch(err){setError(errorCopy(err));}
  };
  const saveOptionPrice=async(groupId:string,optionId:string,value:string,expectedPrice:string)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalModifierOptionPrice(snapshot,groupId,optionId,value,expectedPrice));}
    catch(err){setError(errorCopy(err));}
  };
  const saveComboPrice=async(comboId:string,value:string)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalComboPrice(snapshot,comboId,value));}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="價格管理" description="商品價、選項差價、套餐基本價直接寫 Formal Server Draft；正式交易仍由唯一 Pricing authority 計算。"/>
    {incompatiblePrices?<div className="v3-error" role="status">{incompatiblePrices} 項歷史選項價格未符合原生報價格式。原值已保留；保留不等於可報價，須先核對及明確修正，不能作為 Runtime 可啟用證據。</div>:null}
    {error?<div className="v3-error">{error}</div>:null}
    <div className="v3-pricing-tabs">
      <button className={tab==='PRODUCT'?'is-active':''} onClick={()=>setTab('PRODUCT')}>商品價格</button>
      <button className={tab==='OPTION'?'is-active':''} onClick={()=>setTab('OPTION')}>選項價格</button>
      <button className={tab==='COMBO'?'is-active':''} onClick={()=>setTab('COMBO')}>套餐價格</button>
    </div>
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋名稱／商品編號"/></div></section>
    {tab==='PRODUCT'?<div className="v3-price-edit-list">{catalog.products.filter(item=>!needle||(item.name+' '+item.productCode).toLocaleLowerCase().includes(needle)).map(product=><FormalPriceRow key={product.id} name={product.name} meta={product.productCode} value={product.basePrice} disabled={formal.isSaving} onCommit={value=>void saveProductPrice(product.id,value)}/>)}</div>:null}
    {tab==='OPTION'?<div className="v3-price-edit-list">{pricing.modifierGroups.flatMap(group=>group.options.map(option=>({group,option}))).filter(({group,option})=>!needle||(group.name+' '+option.name+' '+option.code).toLocaleLowerCase().includes(needle)).map(({group,option})=><FormalPriceRow key={group.id+':'+option.id} name={option.name} meta={group.name+' · '+option.code} value={option.priceAdjustment} disabled={formal.isSaving} onCommit={(value,expectedPrice)=>void saveOptionPrice(group.id,option.id,value,expectedPrice)}/>)}</div>:null}
    {tab==='COMBO'?<div className="v3-price-edit-list">{pricing.combos.filter(combo=>!needle||combo.name.toLocaleLowerCase().includes(needle)).map(combo=><FormalPriceRow key={combo.id} name={combo.name} meta="套餐基本價格" value={combo.basePrice} disabled={formal.isSaving} onCommit={value=>void saveComboPrice(combo.id,value)}/>)}</div>:null}
  </div>;
}

function FormalPriceRow({name,meta,value,disabled,onCommit}:{name:string;meta:string;value:string;disabled:boolean;onCommit:(value:string,expectedPrice:string)=>void}){
  const [draft,setDraft]=useState(value);
  const [editBaseline,setEditBaseline]=useState(value);
  useEffect(()=>{
    if(draft===editBaseline||draft===value){setDraft(value);setEditBaseline(value);}
  },[value,draft,editBaseline]);
  const normalized=Number(draft);
  const valid=draft.trim()!==''&&Number.isFinite(normalized);
  return <article>
    <div><strong>{name}</strong><small>{meta}</small></div>
    <label><span>HK$</span><div className="v3-money-input"><b>HK$</b><input inputMode="decimal" value={draft} onChange={event=>setDraft(event.target.value.replace(/[^0-9.-]/g,''))}/></div></label>
    <button type="button" disabled={disabled||!valid||draft===value} onClick={()=>onCommit(draft.trim(),editBaseline)}>儲存草稿</button>
  </article>;
}

export function FormalMenuDisplayPage(){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const sortedCategories=[...catalog.categories].sort((a,b)=>a.position-b.position);
  const [selectedCategory,setSelectedCategory]=useState(sortedCategories[0]?.id??'');
  const [error,setError]=useState('');
  const moveCategory=async(id:string,direction:-1|1)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>moveFormalCategory(snapshot,id,direction));}
    catch(err){setError(errorCopy(err));}
  };
  const moveProduct=async(id:string,direction:-1|1)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>moveFormalProductWithinCategory(snapshot,id,direction));}
    catch(err){setError(errorCopy(err));}
  };
  const products=catalog.products.filter(product=>product.categoryId===selectedCategory);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="顯示與排序" description="排序操作直接儲存 Formal Server Draft；商品排序沿用現有 catalog product sequence。"/>
    {error?<div className="v3-error">{error}</div>:null}
    <section className="v3-sort-workspace">
      <div className="v3-sort-category-column">
        <header><strong>分類次序</strong><small>{sortedCategories.length} 個分類</small></header>
        {sortedCategories.map((category,index)=><article key={category.id} className={selectedCategory===category.id?'is-active':''}>
          <button type="button" className="v3-sort-category-select" onClick={()=>setSelectedCategory(category.id)}><span><b>{index+1}. {category.name}</b><small>{catalog.products.filter(product=>product.categoryId===category.id).length} 件商品</small></span></button>
          <span className="v3-inline-order-buttons"><button type="button" disabled={index===0||formal.isSaving} onClick={()=>void moveCategory(category.id,-1)}>↑</button><button type="button" disabled={index===sortedCategories.length-1||formal.isSaving} onClick={()=>void moveCategory(category.id,1)}>↓</button></span>
        </article>)}
      </div>
      <div className="v3-sort-product-column">
        <header><strong>{sortedCategories.find(item=>item.id===selectedCategory)?.name??'商品次序'}</strong><small>{products.length} 件商品</small></header>
        {products.map((product,index)=><article key={product.id}><span><b>{index+1}. {product.name}</b><small>{product.productCode}</small></span><div className="v3-inline-order-buttons"><button type="button" disabled={formal.isSaving||index===0} onClick={()=>void moveProduct(product.id,-1)}>↑</button><button type="button" disabled={formal.isSaving||index===products.length-1} onClick={()=>void moveProduct(product.id,1)}>↓</button></div></article>)}
      </div>
    </section>
  </div>;
}
