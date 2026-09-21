import {useMemo,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';

function WorkspaceHeader({title,description,onAdd,addLabel}:{title:string;description:string;onAdd?:()=>void;addLabel?:string}){
  const {dirty,validationErrors,validate,reset}=useAdminDraft();
  const [validated,setValidated]=useState(false);
  const runValidate=()=>{validate();setValidated(true);};
  return <header className="admin-editor-head">
    <div><small>SESSION DRAFT · NOT_WIRED</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions">
      {onAdd?<button type="button" className="secondary" onClick={onAdd}>{addLabel??'新增'}</button>:null}
      <button type="button" className="secondary" disabled={!dirty} onClick={reset}>重設草稿</button>
      <button type="button" className="primary" onClick={runValidate}>Validate</button>
      <button type="button" className="publish" disabled title="Domain Adapter 未接駁">Publish 未接駁</button>
    </div>
    {validated?<div className={'admin-validation '+(validationErrors.length?'is-error':'is-ok')} role="status">
      {validationErrors.length
        ?<><b>Validation 有 {validationErrors.length} 項問題</b><ul>{validationErrors.map((error,index)=><li key={index}>{error}</li>)}</ul></>
        :<><b>Validation 通過</b><span>只代表目前工作階段草稿結構有效；未發布、未保存、未影響 SMT。</span></>}
    </div>:null}
  </header>;
}

function EmptyState({title,description,action,onAction}:{title:string;description:string;action:string;onAction:()=>void}){
  return <section className="admin-empty-state"><b>{title}</b><p>{description}</p><button type="button" onClick={onAction}>{action}</button></section>;
}

function Toggle({checked,onChange,label}:{checked:boolean;onChange:(next:boolean)=>void;label:string}){
  return <label className="admin-toggle"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span>{label}</span></label>;
}

export function CategoriesWorkspace(){
  const {draft,addCategory,updateCategory,moveCategory}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品分類" description="建立分類、顯示次序同啟用狀態。所有改動只存在目前瀏覽器工作階段草稿。" onAdd={addCategory} addLabel="新增分類"/>
    {draft.categories.length===0
      ?<EmptyState title="未有分類草稿" description="新增第一個分類，之後 Product 先可以指定所屬分類。" action="新增分類" onAction={addCategory}/>
      :<div className="admin-editor-list">{draft.categories.map((row,index)=><article className="admin-editor-row category-row" key={row.id}>
        <div className="admin-row-sequence"><b>{index+1}</b><small>{row.id}</small></div>
        <label><span>分類名稱</span><input value={row.name} onChange={event=>updateCategory(row.id,{name:event.target.value})} placeholder="例如：飯團"/></label>
        <label><span>排序</span><input type="number" min={0} value={row.position} onChange={event=>updateCategory(row.id,{position:Number(event.target.value)||0})}/></label>
        <Toggle checked={row.active} onChange={active=>updateCategory(row.id,{active})} label={row.active?'啟用':'停用'}/>
        <div className="admin-row-buttons">
          <button type="button" disabled={index===0} onClick={()=>moveCategory(row.id,-1)}>↑</button>
          <button type="button" disabled={index===draft.categories.length-1} onClick={()=>moveCategory(row.id,1)}>↓</button>
        </div>
      </article>)}</div>}
  </section>;
}

export function ProductsWorkspace(){
  const {draft,addProduct,updateProduct}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品資料" description="管理商品名稱、分類、基本價、外賣調整同選項組綁定。Price 欄位只係 Admin config 草稿，唔喺 Admin 計價。" onAdd={addProduct} addLabel="新增商品"/>
    {draft.categories.length===0?<div className="admin-callout">請先到「商品分類」建立至少一個 Category，再新增 Product。</div>:null}
    {draft.products.length===0
      ?<EmptyState title="未有商品草稿" description="建立商品後，可以再綁 Modifier Group、設定 base price config 同啟用狀態。" action="新增商品" onAction={addProduct}/>
      :<div className="admin-editor-grid">{draft.products.map(row=><article className="admin-card-editor" key={row.id}>
        <header><div><small>{row.id}</small><b>{row.name||'未命名商品'}</b></div><Toggle checked={row.active} onChange={active=>updateProduct(row.id,{active})} label={row.active?'啟用':'停用'}/></header>
        <div className="admin-form-grid two">
          <label><span>商品名稱</span><input value={row.name} onChange={event=>updateProduct(row.id,{name:event.target.value})} placeholder="商品名稱"/></label>
          <label><span>分類</span><select value={row.categoryId} onChange={event=>updateProduct(row.id,{categoryId:event.target.value})}><option value="">未選分類</option>{draft.categories.map(category=><option key={category.id} value={category.id}>{category.name||category.id}</option>)}</select></label>
          <label><span>基本價 Config</span><input inputMode="decimal" value={row.basePrice} onChange={event=>updateProduct(row.id,{basePrice:event.target.value})} placeholder="0.00"/></label>
          <label><span>外賣調整 Config</span><input inputMode="decimal" value={row.takeawayAdjustment} onChange={event=>updateProduct(row.id,{takeawayAdjustment:event.target.value})} placeholder="0.00"/></label>
        </div>
        <section className="admin-sub-editor">
          <header><b>選項組綁定</b><small>{row.modifierGroupIds.length} 組</small></header>
          {draft.modifierGroups.length===0?<p>未有 Modifier Group。先到「選項／加料」建立。</p>:<div className="admin-check-grid">{draft.modifierGroups.map(group=><label key={group.id}><input type="checkbox" checked={row.modifierGroupIds.includes(group.id)} onChange={event=>{
            const next=event.target.checked?[...row.modifierGroupIds,group.id]:row.modifierGroupIds.filter(id=>id!==group.id);
            updateProduct(row.id,{modifierGroupIds:next});
          }}/><span>{group.name||group.id}</span></label>)}</div>}
        </section>
      </article>)}</div>}
  </section>;
}

export function ModifiersWorkspace(){
  const {draft,addModifierGroup,updateModifierGroup,addModifierOption,updateModifierOption}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="選項／加料" description="建立 Modifier Group、required/optional、single/multi、Min/Max、Option 同正負價格調整。" onAdd={addModifierGroup} addLabel="新增選項組"/>
    {draft.modifierGroups.length===0
      ?<EmptyState title="未有選項組草稿" description="建立 Modifier Group 後再加入 Option；所有價格調整只係 config。" action="新增選項組" onAction={addModifierGroup}/>
      :<div className="admin-editor-grid">{draft.modifierGroups.map(group=><article className="admin-card-editor" key={group.id}>
        <header><div><small>{group.id}</small><b>{group.name||'未命名選項組'}</b></div><Toggle checked={group.active} onChange={active=>updateModifierGroup(group.id,{active})} label={group.active?'啟用':'停用'}/></header>
        <div className="admin-form-grid three">
          <label><span>組別名稱</span><input value={group.name} onChange={event=>updateModifierGroup(group.id,{name:event.target.value})} placeholder="例如：飯量"/></label>
          <label><span>選擇方式</span><select value={group.selection} onChange={event=>updateModifierGroup(group.id,{selection:event.target.value as 'SINGLE'|'MULTI'})}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
          <Toggle checked={group.required} onChange={required=>updateModifierGroup(group.id,{required,min:required?Math.max(1,group.min):group.min})} label={group.required?'必選':'可選'}/>
          <label><span>Min</span><input type="number" min={0} value={group.min} onChange={event=>updateModifierGroup(group.id,{min:Number(event.target.value)||0})}/></label>
          <label><span>Max</span><input type="number" min={0} value={group.max} onChange={event=>updateModifierGroup(group.id,{max:Number(event.target.value)||0})}/></label>
        </div>
        <section className="admin-sub-editor">
          <header><b>Options</b><button type="button" onClick={()=>addModifierOption(group.id)}>＋ 新增 Option</button></header>
          {group.options.length===0?<p>未有 Option。</p>:<div className="admin-option-list">{group.options.map(option=><article key={option.id}>
            <label><span>名稱</span><input value={option.name} onChange={event=>updateModifierOption(group.id,option.id,{name:event.target.value})} placeholder="選項名稱"/></label>
            <label><span>價格調整</span><input inputMode="decimal" value={option.priceAdjustment} onChange={event=>updateModifierOption(group.id,option.id,{priceAdjustment:event.target.value})} placeholder="0.00"/></label>
            <Toggle checked={option.defaultSelected} onChange={defaultSelected=>updateModifierOption(group.id,option.id,{defaultSelected})} label="Default"/>
            <Toggle checked={option.active} onChange={active=>updateModifierOption(group.id,option.id,{active})} label={option.active?'啟用':'停用'}/>
          </article>)}</div>}
        </section>
      </article>)}</div>}
  </section>;
}

export function PricingWorkspace(){
  const {draft,updateProduct}=useAdminDraft();
  const configured=draft.products.filter(product=>product.basePrice.trim()!=='');
  return <section className="admin-editor-page">
    <WorkspaceHeader title="價格管理" description="集中檢視 Product base price 同外賣 adjustment config。Admin 唔計 Quote；正式 Pricing authority 之後 consume Published Config。"/>
    {draft.products.length===0?<div className="admin-callout">未有 Product 草稿。請先建立商品。</div>:<div className="admin-pricing-table">
      <header><span>商品</span><span>Base Price</span><span>外賣調整</span><span>狀態</span></header>
      {draft.products.map(product=><article key={product.id}><b>{product.name||product.id}</b><input inputMode="decimal" value={product.basePrice} onChange={event=>updateProduct(product.id,{basePrice:event.target.value})} placeholder="0.00"/><input inputMode="decimal" value={product.takeawayAdjustment} onChange={event=>updateProduct(product.id,{takeawayAdjustment:event.target.value})} placeholder="0.00"/><span>{product.active?'啟用':'停用'}</span></article>)}
      <footer>已填基本價：{configured.length} / {draft.products.length}</footer>
    </div>}
  </section>;
}

export function CombosWorkspace(){
  const {draft,addCombo,updateCombo,addComboSection,updateComboSection}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="套餐" description="建立 Combo identity、價格 config 同 Sections；Child product assignment 會留待 MFK Product adapter 接通後處理。" onAdd={addCombo} addLabel="新增套餐"/>
    {draft.combos.length===0
      ?<EmptyState title="未有套餐草稿" description="新增 Combo 後，建立必選／可選 Section 同 Min/Max。" action="新增套餐" onAction={addCombo}/>
      :<div className="admin-editor-grid">{draft.combos.map(combo=><article className="admin-card-editor" key={combo.id}>
        <header><div><small>{combo.id}</small><b>{combo.name||'未命名套餐'}</b></div><Toggle checked={combo.active} onChange={active=>updateCombo(combo.id,{active})} label={combo.active?'啟用':'停用'}/></header>
        <div className="admin-form-grid three">
          <label><span>套餐名稱</span><input value={combo.name} onChange={event=>updateCombo(combo.id,{name:event.target.value})} placeholder="套餐名稱"/></label>
          <label><span>套餐基本價 Config</span><input inputMode="decimal" value={combo.basePrice} onChange={event=>updateCombo(combo.id,{basePrice:event.target.value})} placeholder="0.00"/></label>
          <label><span>外賣調整 Config</span><input inputMode="decimal" value={combo.takeawayAdjustment} onChange={event=>updateCombo(combo.id,{takeawayAdjustment:event.target.value})} placeholder="0.00"/></label>
        </div>
        <section className="admin-sub-editor">
          <header><b>Sections</b><button type="button" onClick={()=>addComboSection(combo.id)}>＋ 新增 Section</button></header>
          {combo.sections.length===0?<p>未有 Section。</p>:<div className="admin-option-list">{combo.sections.map(section=><article key={section.id}>
            <label><span>Section 名稱</span><input value={section.name} onChange={event=>updateComboSection(combo.id,section.id,{name:event.target.value})} placeholder="例如：飲品"/></label>
            <label><span>Min</span><input type="number" min={0} value={section.min} onChange={event=>updateComboSection(combo.id,section.id,{min:Number(event.target.value)||0})}/></label>
            <label><span>Max</span><input type="number" min={0} value={section.max} onChange={event=>updateComboSection(combo.id,section.id,{max:Number(event.target.value)||0})}/></label>
            <Toggle checked={section.required} onChange={required=>updateComboSection(combo.id,section.id,{required,min:required?Math.max(1,section.min):section.min})} label={section.required?'必選':'可選'}/>
          </article>)}</div>}
          <div className="admin-callout compact">Child Product 選擇暫時 NOT_WIRED；唔會自行複製 Product truth。</div>
        </section>
      </article>)}</div>}
  </section>;
}

export function MenuDisplayWorkspace(){
  const {draft,moveCategory,moveProduct}=useAdminDraft();
  const categoryName=useMemo(()=>new Map(draft.categories.map(category=>[category.id,category.name||category.id])),[draft.categories]);
  return <section className="admin-editor-page">
    <WorkspaceHeader title="Menu／顯示排序" description="調整 Admin Draft 嘅 Category / Product 顯示次序。Publish 未接駁，所以唔會影響 SMT。"/>
    <div className="admin-sort-columns">
      <section><header><b>Category 次序</b><span>{draft.categories.length}</span></header>{draft.categories.length===0?<p>未有分類。</p>:draft.categories.map((category,index)=><article key={category.id}><b>{index+1}. {category.name||category.id}</b><div><button disabled={index===0} onClick={()=>moveCategory(category.id,-1)}>↑</button><button disabled={index===draft.categories.length-1} onClick={()=>moveCategory(category.id,1)}>↓</button></div></article>)}</section>
      <section><header><b>Product 次序</b><span>{draft.products.length}</span></header>{draft.products.length===0?<p>未有商品。</p>:draft.products.map((product,index)=><article key={product.id}><span><b>{index+1}. {product.name||product.id}</b><small>{categoryName.get(product.categoryId)??'未分類'}</small></span><div><button disabled={index===0} onClick={()=>moveProduct(product.id,-1)}>↑</button><button disabled={index===draft.products.length-1} onClick={()=>moveProduct(product.id,1)}>↓</button></div></article>)}</section>
    </div>
  </section>;
}
