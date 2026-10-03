import {useMemo,useState} from 'react';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';
import {usePreviewCatalog,type PreviewCategory} from './preview-catalog-store.ts';

function money(minor:number){
  const value=minor/100;
  return 'HK$'+(Number.isInteger(value)?String(value):value.toFixed(2));
}

function CategoryEditor({category,onClose}:{category:PreviewCategory;onClose:()=>void}){
  const update=usePreviewCatalog(state=>state.updateCategory);
  const remove=usePreviewCatalog(state=>state.removeCategory);
  const products=usePreviewCatalog(state=>state.products);
  const count=products.filter(product=>product.category===category.name).length;
  const [removeBlocked,setRemoveBlocked]=useState(false);
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>分類管理</small><h2>{category.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <div className="v3-functional-grid">
            <label><span>分類名稱 *</span><input value={category.name} onChange={event=>update(category.id,{name:event.target.value})}/></label>
            <label><span>顯示次序</span><input type="number" min={0} value={category.sortOrder} onChange={event=>update(category.id,{sortOrder:Number(event.target.value)||0})}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={category.active} onChange={event=>update(category.id,{active:event.target.checked})}/><span>{category.active?'啟用分類':'停用分類'}</span></label>
        </section>
        <section className="v3-functional-section">
          <h3>分類內商品</h3>
          <p>{count} 件商品使用呢個分類。</p>
          <div className="v3-category-product-list">{products.filter(product=>product.category===category.name).map(product=><div key={product.id}><strong>{product.name}</strong><small>{product.code}</small></div>)}</div>
        </section>
        <section className="v3-functional-danger">
          <div><strong>刪除分類</strong><small>{count?'有商品引用時唔可以刪除；先重新分類。':'目前冇商品引用。'}</small></div>
          <button type="button" disabled={count>0} onClick={()=>{const ok=remove(category.id);setRemoveBlocked(!ok);if(ok)onClose();}}>刪除分類</button>
        </section>
        {removeBlocked?<div className="v3-error">仍有商品引用，未能刪除分類。</div>:null}
      </div>
    </section>
  </div>;
}

export function CategoriesPage(){
  const categories=usePreviewCatalog(state=>state.categories);
  const products=usePreviewCatalog(state=>state.products);
  const create=usePreviewCatalog(state=>state.createCategory);
  const move=usePreviewCatalog(state=>state.moveCategory);
  const [selected,setSelected]=useState<string|null>(null);
  const sorted=[...categories].sort((a,b)=>a.sortOrder-b.sortOrder);
  const selectedCategory=selected?categories.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="分類管理" description="實際管理分類名稱、啟用狀態、排序同商品引用。" aside={<button className="v3-primary" type="button" onClick={()=>{const next=create();setSelected(next.id);}}>＋ 新增分類</button>}/>
    <div className="v3-functional-card-grid">{sorted.map((category,index)=>{
      const count=products.filter(product=>product.category===category.name).length;
      return <article className="v3-functional-card" key={category.id}>
        <button type="button" className="v3-functional-card-main" onClick={()=>setSelected(category.id)}>
          <div><strong>{category.name}</strong><small>{category.id}</small></div>
          <b>{count}</b><span>件商品</span>
          <StatusBadge tone={category.active?'good':'neutral'}>{category.active?'啟用':'停用'}</StatusBadge>
          <small>次序 {index+1}</small>
        </button>
        <div className="v3-inline-order-buttons"><button type="button" disabled={index===0} onClick={()=>move(category.id,-1)}>↑</button><button type="button" disabled={index===sorted.length-1} onClick={()=>move(category.id,1)}>↓</button></div>
      </article>;
    })}</div>
    {selectedCategory?<CategoryEditor category={selectedCategory} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function PricingPage(){
  const products=usePreviewCatalog(state=>state.products);
  const optionSets=usePreviewCatalog(state=>state.optionSets);
  const combos=usePreviewCatalog(state=>state.combos);
  const updateProduct=usePreviewCatalog(state=>state.updateProduct);
  const updateOption=usePreviewCatalog(state=>state.updateOption);
  const updateCombo=usePreviewCatalog(state=>state.updateCombo);
  const [tab,setTab]=useState<'PRODUCT'|'OPTION'|'COMBO'>('PRODUCT');
  const [query,setQuery]=useState('');
  const needle=query.trim().toLocaleLowerCase();
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="價格管理" description="商品、子選項同套餐價錢集中管理；Preview 修改會即時反映其他菜單頁。" />
    <div className="v3-pricing-tabs">
      <button className={tab==='PRODUCT'?'is-active':''} onClick={()=>setTab('PRODUCT')}>商品價格</button>
      <button className={tab==='OPTION'?'is-active':''} onClick={()=>setTab('OPTION')}>選項價格</button>
      <button className={tab==='COMBO'?'is-active':''} onClick={()=>setTab('COMBO')}>套餐價格</button>
    </div>
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋名稱／商品編號"/></div></section>
    {tab==='PRODUCT'?<div className="v3-price-edit-list">{products.filter(item=>!needle||(item.name+' '+item.code).toLocaleLowerCase().includes(needle)).map(product=><article key={product.id}>
      <div><strong>{product.name}</strong><small>{product.category} · {product.code}</small></div>
      <label><span>基本價格</span><div className="v3-money-input"><b>HK$</b><input inputMode="decimal" value={String(product.priceMinor/100)} onChange={event=>updateProduct(product.id,{priceMinor:Math.round((Number(event.target.value)||0)*100)})}/></div></label>
      <StatusBadge tone={product.status==='已停用'?'neutral':'good'}>{product.status}</StatusBadge>
    </article>)}</div>:null}
    {tab==='OPTION'?<div className="v3-price-edit-list">{optionSets.flatMap(set=>set.options.map(option=>({set,option}))).filter(({set,option})=>!needle||(set.name+' '+option.name+' '+option.code).toLocaleLowerCase().includes(needle)).map(({set,option})=><article key={option.id}>
      <div><strong>{option.name}</strong><small>{set.name} · {option.code}</small></div>
      <label><span>價錢調整</span><div className="v3-money-input"><b>HK$</b><input inputMode="decimal" value={String(option.priceAdjustmentMinor/100)} onChange={event=>updateOption(set.id,option.id,{priceAdjustmentMinor:Math.round((Number(event.target.value)||0)*100)})}/></div></label>
      <StatusBadge tone={option.active?'good':'neutral'}>{option.active?'啟用':'停用'}</StatusBadge>
    </article>)}</div>:null}
    {tab==='COMBO'?<div className="v3-price-edit-list">{combos.filter(combo=>!needle||combo.name.toLocaleLowerCase().includes(needle)).map(combo=><article key={combo.id}>
      <div><strong>{combo.name}</strong><small>{combo.groups.length} 個分組</small></div>
      <label><span>套餐基本價格</span><div className="v3-money-input"><b>HK$</b><input inputMode="decimal" value={String(combo.basePriceMinor/100)} onChange={event=>updateCombo(combo.id,{basePriceMinor:Math.round((Number(event.target.value)||0)*100)})}/></div></label>
      <StatusBadge tone={combo.active?'good':'neutral'}>{combo.active?'啟用':'停用'}</StatusBadge>
    </article>)}</div>:null}
  </div>;
}

export function MenuDisplayPage(){
  const categories=usePreviewCatalog(state=>state.categories);
  const products=usePreviewCatalog(state=>state.products);
  const moveCategory=usePreviewCatalog(state=>state.moveCategory);
  const moveProduct=usePreviewCatalog(state=>state.moveProduct);
  const [selectedCategory,setSelectedCategory]=useState(()=>[...categories].sort((a,b)=>a.sortOrder-b.sortOrder)[0]?.name??'');
  const sortedCategories=[...categories].sort((a,b)=>a.sortOrder-b.sortOrder);
  const categoryProducts=products.filter(product=>product.category===selectedCategory);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="顯示與排序" description="分類同分類內商品次序會直接反映 Preview；手機同 Desktop 共用同一順序。" />
    <section className="v3-sort-workspace">
      <div className="v3-sort-category-column">
        <header><strong>分類次序</strong><small>{sortedCategories.length} 個分類</small></header>
        {sortedCategories.map((category,index)=><article key={category.id} className={selectedCategory===category.name?'is-active':''}>
          <button type="button" className="v3-sort-category-select" onClick={()=>setSelectedCategory(category.name)}>
            <span><b>{index+1}. {category.name}</b><small>{products.filter(product=>product.category===category.name).length} 件商品</small></span>
          </button>
          <span className="v3-inline-order-buttons"><button type="button" disabled={index===0} onClick={()=>moveCategory(category.id,-1)}>↑</button><button type="button" disabled={index===sortedCategories.length-1} onClick={()=>moveCategory(category.id,1)}>↓</button></span>
        </article>)}
      </div>
      <div className="v3-sort-product-column">
        <header><strong>{selectedCategory||'商品次序'}</strong><small>{categoryProducts.length} 件商品</small></header>
        {categoryProducts.map((product,index)=><article key={product.id}>
          <span><b>{index+1}. {product.name}</b><small>{product.code} · {money(product.priceMinor)}</small></span>
          <div className="v3-inline-order-buttons"><button disabled={index===0} onClick={()=>moveProduct(product.id,-1)}>↑</button><button disabled={index===categoryProducts.length-1} onClick={()=>moveProduct(product.id,1)}>↓</button></div>
        </article>)}
      </div>
    </section>
  </div>;
}

export function MobileCategoryProductPreview(){
  const products=usePreviewCatalog(state=>state.products);
  const grouped=useMemo(()=>products.map(product=>({...product,group:product.category})),[products]);
  return <MobileGroupedPager items={grouped} pageSize={10} renderItem={product=><div key={product.id}>{product.name}</div>}/>;
}
