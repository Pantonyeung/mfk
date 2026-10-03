import {useMemo,useState} from 'react';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';
import {PREVIEW_CATALOG_CATEGORIES,usePreviewCatalog,type PreviewCombo,type PreviewOptionSet} from './preview-catalog-store.ts';

function money(minor:number){
  const value=minor/100;
  return 'HK$'+(Number.isInteger(value)?String(value):value.toFixed(2));
}

function OptionSetEditor({setId,onClose}:{setId:string;onClose:()=>void}){
  const setRow=usePreviewCatalog(state=>state.optionSets.find(item=>item.id===setId));
  const products=usePreviewCatalog(state=>state.products);
  const updateSet=usePreviewCatalog(state=>state.updateOptionSet);
  const addOption=usePreviewCatalog(state=>state.addOption);
  const updateOption=usePreviewCatalog(state=>state.updateOption);
  const removeOption=usePreviewCatalog(state=>state.removeOption);
  const toggleProduct=usePreviewCatalog(state=>state.toggleProductOptionSet);
  if(!setRow)return null;
  const linked=new Set(products.filter(product=>product.optionSetIds.includes(setRow.id)).map(product=>product.id));
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>選項／口味管理</small><h2>{setRow.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <h3>基本規則</h3>
          <div className="v3-functional-grid">
            <label><span>選項組名稱 *</span><input value={setRow.name} onChange={event=>updateSet(setRow.id,{name:event.target.value})}/></label>
            <label><span>選擇方式</span><select value={setRow.selection} onChange={event=>updateSet(setRow.id,{selection:event.target.value as 'SINGLE'|'MULTI',max:event.target.value==='SINGLE'?1:setRow.max})}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
            <label><span>最少選擇</span><input type="number" min={0} value={setRow.min} onChange={event=>updateSet(setRow.id,{min:Number(event.target.value)||0})}/></label>
            <label><span>最多選擇</span><input type="number" min={0} value={setRow.max} onChange={event=>updateSet(setRow.id,{max:Number(event.target.value)||0})}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={setRow.required} onChange={event=>updateSet(setRow.id,{required:event.target.checked,min:event.target.checked?Math.max(1,setRow.min):0})}/><span>必選</span></label>
        </section>

        <section className="v3-functional-section">
          <header><div><h3>子選項</h3><p>呢啲係顧客／員工實際會揀嘅選項。</p></div><button type="button" onClick={()=>addOption(setRow.id)}>＋ 新增子選項</button></header>
          <div className="v3-option-edit-list">
            {setRow.options.map(option=><article key={option.id}>
              <label><span>選項 ID</span><input value={option.code} onChange={event=>updateOption(setRow.id,option.id,{code:event.target.value})}/></label>
              <label><span>名稱</span><input value={option.name} onChange={event=>updateOption(setRow.id,option.id,{name:event.target.value})}/></label>
              <label><span>價錢調整 HK$</span><input inputMode="decimal" value={String(option.priceAdjustmentMinor/100)} onChange={event=>updateOption(setRow.id,option.id,{priceAdjustmentMinor:Math.round((Number(event.target.value)||0)*100)})}/></label>
              <label className="v3-functional-switch"><input type="checkbox" checked={option.active} onChange={event=>updateOption(setRow.id,option.id,{active:event.target.checked})}/><span>{option.active?'啟用':'停用'}</span></label>
              <button type="button" onClick={()=>removeOption(setRow.id,option.id)}>刪除</button>
            </article>)}
          </div>
        </section>

        <section className="v3-functional-section">
          <h3>套用商品</h3>
          <p>實際勾選邊件商品會使用呢個選項組。</p>
          <MobileGroupedPager
            items={products.map(product=>({...product,group:product.category}))}
            pageSize={10}
            renderItem={product=><label key={product.id} className="v3-product-map-row">
              <input type="checkbox" checked={linked.has(product.id)} onChange={event=>toggleProduct(product.id,setRow.id,event.target.checked)}/>
              <span><strong>{product.name}</strong><small>{product.code}</small></span>
            </label>}
          />
        </section>
      </div>
    </section>
  </div>;
}

export function ModifiersPage(){
  const optionSets=usePreviewCatalog(state=>state.optionSets);
  const products=usePreviewCatalog(state=>state.products);
  const createSet=usePreviewCatalog(state=>state.createOptionSet);
  const [selected,setSelected]=useState<string|null>(null);
  const [query,setQuery]=useState('');
  const filtered=optionSets.filter(set=>!query.trim()||(set.name+' '+set.options.map(option=>option.name).join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="選項／口味管理" description="建立真正可重用嘅選項組、子選項同商品映射。" aside={<button className="v3-primary" type="button" onClick={()=>{const next=createSet();setSelected(next.id);}}>＋ 新增選項組</button>}/>
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋選項組／子選項"/></div><div className="v3-product-count">{optionSets.length} 個選項組 · {products.length} 件商品</div></section>
    <div className="v3-functional-card-grid">{filtered.map(set=><button type="button" key={set.id} onClick={()=>setSelected(set.id)}>
      <div><strong>{set.name}</strong><small>{set.selection==='SINGLE'?'單選':'多選'} · 最少 {set.min}／最多 {set.max}</small></div>
      <b>{set.options.length}</b><span>個子選項</span>
      <StatusBadge tone={set.active?'good':'neutral'}>{set.active?'啟用':'停用'}</StatusBadge>
      <small>{products.filter(product=>product.optionSetIds.includes(set.id)).length} 件商品使用</small>
    </button>)}</div>
    {selected?<OptionSetEditor setId={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function ComboEditor({comboId,onClose}:{comboId:string;onClose:()=>void}){
  const combo=usePreviewCatalog(state=>state.combos.find(item=>item.id===comboId));
  const products=usePreviewCatalog(state=>state.products);
  const updateCombo=usePreviewCatalog(state=>state.updateCombo);
  const addGroup=usePreviewCatalog(state=>state.addComboGroup);
  const updateGroup=usePreviewCatalog(state=>state.updateComboGroup);
  const addChoice=usePreviewCatalog(state=>state.addComboChoice);
  const updateChoice=usePreviewCatalog(state=>state.updateComboChoice);
  const removeChoice=usePreviewCatalog(state=>state.removeComboChoice);
  if(!combo)return null;
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>套餐管理</small><h2>{combo.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <h3>套餐基本資料</h3>
          <div className="v3-functional-grid">
            <label><span>套餐名稱 *</span><input value={combo.name} onChange={event=>updateCombo(combo.id,{name:event.target.value})}/></label>
            <label><span>基本價格</span><input inputMode="decimal" value={String(combo.basePriceMinor/100)} onChange={event=>updateCombo(combo.id,{basePriceMinor:Math.round((Number(event.target.value)||0)*100)})}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={combo.active} onChange={event=>updateCombo(combo.id,{active:event.target.checked})}/><span>{combo.active?'啟用':'停用'}</span></label>
        </section>

        <section className="v3-functional-section">
          <header><div><h3>套餐分組</h3><p>每個分組都可以指定最少／最多選擇，同實際商品成員。</p></div><button type="button" onClick={()=>addGroup(combo.id)}>＋ 新增分組</button></header>
          <div className="v3-combo-groups">
            {combo.groups.map(group=><article key={group.id}>
              <div className="v3-functional-grid">
                <label><span>分組名稱</span><input value={group.name} onChange={event=>updateGroup(combo.id,group.id,{name:event.target.value})}/></label>
                <label><span>最少</span><input type="number" min={0} value={group.min} onChange={event=>updateGroup(combo.id,group.id,{min:Number(event.target.value)||0})}/></label>
                <label><span>最多</span><input type="number" min={0} value={group.max} onChange={event=>updateGroup(combo.id,group.id,{max:Number(event.target.value)||0})}/></label>
              </div>
              <label className="v3-functional-switch"><input type="checkbox" checked={group.required} onChange={event=>updateGroup(combo.id,group.id,{required:event.target.checked,min:event.target.checked?Math.max(1,group.min):0})}/><span>必選</span></label>
              <div className="v3-combo-choice-list">
                {group.choices.map(choice=>{
                  const product=choice.productId?products.find(item=>item.id===choice.productId):undefined;
                  return <div key={choice.id}>
                    <select value={choice.productId??''} onChange={event=>updateChoice(combo.id,group.id,choice.id,{productId:event.target.value||undefined,label:event.target.value?'':choice.label||'新選擇'})}>
                      <option value="">套餐專用文字選擇</option>
                      {products.filter(item=>item.status!=='已停用').map(item=><option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
                    </select>
                    {choice.productId?<span>{product?.category}</span>:<input value={choice.label??''} onChange={event=>updateChoice(combo.id,group.id,choice.id,{label:event.target.value})} placeholder="例如：唔要飲品"/>}
                    <label><span>差價</span><input inputMode="decimal" value={String(choice.priceAdjustmentMinor/100)} onChange={event=>updateChoice(combo.id,group.id,choice.id,{priceAdjustmentMinor:Math.round((Number(event.target.value)||0)*100)})}/></label>
                    <button type="button" onClick={()=>removeChoice(combo.id,group.id,choice.id)}>刪除</button>
                  </div>;
                })}
              </div>
              <button type="button" onClick={()=>addChoice(combo.id,group.id)}>＋ 加入商品／選擇</button>
            </article>)}
          </div>
        </section>
      </div>
    </section>
  </div>;
}

export function CombosPage(){
  const combos=usePreviewCatalog(state=>state.combos);
  const createCombo=usePreviewCatalog(state=>state.createCombo);
  const [selected,setSelected]=useState<string|null>(null);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="套餐管理" description="套餐唔再係效果卡；可以實際建立套餐、分組、商品成員同差價。" aside={<button className="v3-primary" type="button" onClick={()=>{const next=createCombo();setSelected(next.id);}}>＋ 新增套餐</button>}/>
    <div className="v3-functional-card-grid">{combos.map(combo=><button type="button" key={combo.id} onClick={()=>setSelected(combo.id)}>
      <div><strong>{combo.name}</strong><small>{combo.groups.length} 個分組</small></div>
      <b>{money(combo.basePriceMinor)}</b><span>基本價格</span>
      <StatusBadge tone={combo.active?'good':'neutral'}>{combo.active?'啟用':'停用'}</StatusBadge>
      <small>{combo.groups.reduce((sum,group)=>sum+group.choices.length,0)} 個可選成員</small>
    </button>)}</div>
    {selected?<ComboEditor comboId={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function CatalogFunctionSummary(){
  const products=usePreviewCatalog(state=>state.products);
  const optionSets=usePreviewCatalog(state=>state.optionSets);
  const combos=usePreviewCatalog(state=>state.combos);
  const categories=useMemo(()=>new Set(products.map(product=>product.category)),[products]);
  return {products:products.length,categories:categories.size,optionSets:optionSets.length,combos:combos.length,lockedCategories:PREVIEW_CATALOG_CATEGORIES.length};
}
