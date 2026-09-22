import {useEffect,useMemo,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';

function WorkspaceHeader({title,description,onAdd,addLabel}:{title:string;description:string;onAdd?:()=>void;addLabel?:string}){
  const {draft,dirty,validationErrors,validate,reset}=useAdminDraft();
  const [validated,setValidated]=useState(false);
  useEffect(()=>setValidated(false),[draft]);
  const runValidate=()=>{validate();setValidated(true);};
  return <header className="admin-editor-head">
    <div><small>{dirty?'已自動保存草稿 · 有待發布變更':'已自動保存草稿'}</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions">
      {onAdd?<button type="button" className="secondary" onClick={onAdd}>{addLabel??'新增'}</button>:null}
      <button type="button" className="secondary" onClick={reset}>還原原始 MF01 菜單</button>
      <button type="button" className="primary" onClick={runValidate}>檢查完整性</button>
    </div>
    {validated?<div className={'admin-validation '+(validationErrors.length?'is-error':'is-ok')} role="status">
      {validationErrors.length
        ?<><b>有 {validationErrors.length} 項需要處理</b><ul>{validationErrors.map((error,index)=><li key={index}>{error}</li>)}</ul></>
        :<><b>菜單資料完整性檢查通過</b><span>分類、商品、價格、選項同套餐關係目前有效。</span></>}
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
  const {draft,addCategory,updateCategory,removeCategory,moveCategory}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品分類" description="建立分類、顯示次序同啟用狀態。分類係正式菜單結構，改動會自動保存成草稿。" onAdd={addCategory} addLabel="新增分類"/>
    <div className="admin-kpi-grid">
      <article><span>分類總數</span><strong>{draft.categories.length}</strong><small>草稿</small></article>
      <article><span>已啟用</span><strong>{draft.categories.filter(row=>row.active).length}</strong><small>會進入發布版本</small></article>
      <article><span>停用</span><strong>{draft.categories.filter(row=>!row.active).length}</strong><small>保留資料</small></article>
      <article><span>未分類啟用商品</span><strong>{draft.products.filter(row=>row.active&&!draft.categories.some(category=>category.id===row.categoryId)).length}</strong><small>必須處理</small></article>
    </div>
    {draft.categories.length===0
      ?<EmptyState title="未有分類" description="先新增分類，之後先可以建立正式商品。" action="新增分類" onAction={addCategory}/>
      :<div className="admin-editor-list">{draft.categories.map((row,index)=><article className="admin-editor-row category-row" key={row.id}>
        <div className="admin-row-sequence"><b>{index+1}</b><small>{row.id}</small></div>
        <label><span>分類名稱</span><input value={row.name} onChange={event=>updateCategory(row.id,{name:event.target.value})} placeholder="例如：紫米飯糰"/></label>
        <label><span>排序</span><input type="number" min={0} value={row.position} onChange={event=>updateCategory(row.id,{position:Number(event.target.value)||0})}/></label>
        <Toggle checked={row.active} onChange={active=>updateCategory(row.id,{active})} label={row.active?'啟用':'停用'}/>
        <div className="admin-row-buttons">
          <button type="button" disabled={index===0} onClick={()=>moveCategory(row.id,-1)}>↑</button>
          <button type="button" disabled={index===draft.categories.length-1} onClick={()=>moveCategory(row.id,1)}>↓</button>
          <button type="button" disabled={draft.products.some(product=>product.categoryId===row.id)} onClick={()=>removeCategory(row.id)}>刪</button>
        </div>
      </article>)}</div>}
  </section>;
}

export function ProductsWorkspace(){
  const {draft,addProduct,updateProduct,removeProduct}=useAdminDraft();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<'ALL'|'ACTIVE'|'INACTIVE'>('ALL');
  const [category,setCategory]=useState('ALL');
  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return draft.products.filter(row=>{
      const text=[row.name,row.productCode,row.legacy條碼,row.sku,row.shortName].filter(Boolean).join(' ').toLowerCase();
      return (!needle||text.includes(needle))
        &&(status==='ALL'||(status==='ACTIVE'?row.active:!row.active))
        &&(category==='ALL'||row.categoryId===category);
    });
  },[draft.products,query,status,category]);

  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品資料" description="商品係正式營運資料：名稱、商品編號、分類、價格、外賣規則、選項組、庫存編號、描述同顯示資料都喺呢度管理。" onAdd={addProduct} addLabel="新增商品"/>
    <div className="admin-kpi-grid">
      <article><span>商品總數</span><strong>{draft.products.length}</strong><small>包含停用資料</small></article>
      <article><span>已啟用</span><strong>{draft.products.filter(row=>row.active).length}</strong><small>目前菜單候選</small></article>
      <article><span>已停用</span><strong>{draft.products.filter(row=>!row.active).length}</strong><small>保留歷史身份</small></article>
      <article><span>未填價格</span><strong>{draft.products.filter(row=>row.active&&!row.basePrice.trim()).length}</strong><small>發布前必須處理</small></article>
    </div>
    <div className="admin-filterbar">
      <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱／商品編號／條碼／庫存編號"/>
      <select value={category} onChange={event=>setCategory(event.target.value)}><option value="ALL">全部分類</option>{draft.categories.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
      <select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="ALL">全部狀態</option><option value="ACTIVE">已啟用</option><option value="INACTIVE">已停用</option></select>
      <span>{filtered.length} / {draft.products.length}</span>
    </div>
    {draft.categories.length===0?<div className="admin-callout">請先建立至少一個分類。</div>:null}
    {filtered.length===0
      ?<div className="admin-read-empty">搵唔到符合條件嘅商品。</div>
      :<div className="admin-editor-grid">{filtered.map(row=><article className="admin-card-editor" key={row.id}>
        <header><div><small>{row.productCode||row.id}{row.legacy條碼?' · '+row.legacy條碼:''}</small><b>{row.name||'未命名商品'}</b></div><div className="admin-editor-actions"><Toggle checked={row.active} onChange={active=>updateProduct(row.id,{active})} label={row.active?'啟用':'停用'}/><button type="button" onClick={()=>removeProduct(row.id)}>刪除</button></div></header>
        <div className="admin-form-grid two">
          <label><span>商品名稱 *</span><input value={row.name} onChange={event=>updateProduct(row.id,{name:event.target.value})}/></label>
          <label><span>商品編號 *</span><input value={row.productCode??''} onChange={event=>updateProduct(row.id,{productCode:event.target.value})}/></label>
          <label><span>簡稱</span><input value={row.shortName??''} onChange={event=>updateProduct(row.id,{shortName:event.target.value})}/></label>
          <label><span>庫存編號</span><input value={row.sku??''} onChange={event=>updateProduct(row.id,{sku:event.target.value})}/></label>
          <label><span>分類 *</span><select value={row.categoryId} onChange={event=>updateProduct(row.id,{categoryId:event.target.value})}><option value="">未選分類</option>{draft.categories.map(category=><option key={category.id} value={category.id}>{category.name||category.id}</option>)}</select></label>
          <label><span>基本價 HK$ *</span><input inputMode="decimal" value={row.basePrice} onChange={event=>updateProduct(row.id,{basePrice:event.target.value})} placeholder="0.00"/></label>
          <label><span>條碼</span><input value={row.legacy條碼??''} onChange={event=>updateProduct(row.id,{legacy條碼:event.target.value})}/></label>
          <label><span>圖片參考</span><input value={row.imageRef??''} onChange={event=>updateProduct(row.id,{imageRef:event.target.value})} placeholder="圖片 URL / Asset ID"/></label>
        </div>
        <label><span>商品描述</span><textarea rows={3} value={row.description??''} onChange={event=>updateProduct(row.id,{description:event.target.value})} placeholder="顧客／員工可讀描述"/></label>
        <label><span>標籤（逗號分隔）</span><input value={(row.tags??[]).join(', ')} onChange={event=>updateProduct(row.id,{tags:event.target.value.split(',').map(value=>value.trim()).filter(Boolean)})}/></label>
        <section className="admin-sub-editor">
          <header><b>外賣價格規則</b><small>正式計價規則會使用呢個設定</small></header>
          <Toggle checked={Boolean(row.takeawaySurchargeEnabled)} onChange={takeawaySurchargeEnabled=>updateProduct(row.id,{takeawaySurchargeEnabled})} label={row.takeawaySurchargeEnabled?'此商品外賣 +$1：開':'此商品外賣 +$1：關'}/>
          <label><span>其他外賣調整 HK$（選填）</span><input inputMode="decimal" value={row.takeawayAdjustment} onChange={event=>updateProduct(row.id,{takeawayAdjustment:event.target.value})} placeholder="例如 -1.00 / 2.00"/></label>
        </section>
        <section className="admin-sub-editor">
          <header><b>選項組綁定</b><small>{row.modifierGroupIds.length} 組</small></header>
          {draft.modifierGroups.length===0?<p>未有選項組。</p>:<div className="admin-check-grid">{draft.modifierGroups.map(group=><label key={group.id}><input type="checkbox" checked={row.modifierGroupIds.includes(group.id)} onChange={event=>{
            const next=event.target.checked?[...row.modifierGroupIds,group.id]:row.modifierGroupIds.filter(id=>id!==group.id);
            updateProduct(row.id,{modifierGroupIds:next});
          }}/><span>{group.name||group.id}</span></label>)}</div>}
        </section>
      </article>)}</div>}
  </section>;
}

export function ModifiersWorkspace(){
  const {draft,addModifierGroup,updateModifierGroup,removeModifierGroup,addModifierOption,updateModifierOption,removeModifierOption}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="選項／加料" description="管理選項組、必選／可選、單選／多選、最少／最多、預設選項，同正數或負數價格調整。" onAdd={addModifierGroup} addLabel="新增選項組"/>
    <div className="admin-kpi-grid">
      <article><span>選項組</span><strong>{draft.modifierGroups.length}</strong><small>草稿</small></article>
      <article><span>選項</span><strong>{draft.modifierGroups.reduce((sum,row)=>sum+row.options.length,0)}</strong><small>全部選項</small></article>
      <article><span>負數價格調整</span><strong>{draft.modifierGroups.flatMap(row=>row.options).filter(option=>Number(option.priceAdjustment)<0).length}</strong><small>支援減價</small></article>
      <article><span>商品綁定</span><strong>{draft.products.filter(row=>row.modifierGroupIds.length>0).length}</strong><small>已有選項商品</small></article>
    </div>
    {draft.modifierGroups.length===0
      ?<EmptyState title="未有選項組" description="建立選項組之後加入選項，再由商品頁綁定。" action="新增選項組" onAction={addModifierGroup}/>
      :<div className="admin-editor-grid">{draft.modifierGroups.map(group=><article className="admin-card-editor" key={group.id}>
        <header><div><small>{group.id}</small><b>{group.name||'未命名選項組'}</b></div><div className="admin-editor-actions"><Toggle checked={group.active} onChange={active=>updateModifierGroup(group.id,{active})} label={group.active?'啟用':'停用'}/><button type="button" onClick={()=>removeModifierGroup(group.id)}>刪除組別</button></div></header>
        <div className="admin-form-grid three">
          <label><span>組別名稱</span><input value={group.name} onChange={event=>updateModifierGroup(group.id,{name:event.target.value})}/></label>
          <label><span>選擇方式</span><select value={group.selection} onChange={event=>{const selection=event.target.value as 'SINGLE'|'MULTI';updateModifierGroup(group.id,{selection,max:selection==='SINGLE'?1:Math.max(1,group.max)})}}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
          <Toggle checked={group.required} onChange={required=>updateModifierGroup(group.id,{required,min:required?Math.max(1,group.min):0})} label={group.required?'必選':'可選'}/>
          <label><span>最少選擇</span><input type="number" min={0} value={group.min} onChange={event=>updateModifierGroup(group.id,{min:Number(event.target.value)||0})}/></label>
          <label><span>最多選擇</span><input type="number" min={0} max={group.selection==='SINGLE'?1:99} value={group.max} onChange={event=>updateModifierGroup(group.id,{max:Number(event.target.value)||0})}/></label>
        </div>
        <section className="admin-sub-editor">
          <header><b>選項</b><button type="button" onClick={()=>addModifierOption(group.id)}>＋ 新增選項</button></header>
          {group.options.length===0?<p>未有選項。</p>:<div className="admin-option-list">{group.options.map(option=><article key={option.id}>
            <label><span>名稱</span><input value={option.name} onChange={event=>updateModifierOption(group.id,option.id,{name:event.target.value})}/></label>
            <label><span>價格調整 HK$</span><input inputMode="decimal" value={option.priceAdjustment} onChange={event=>updateModifierOption(group.id,option.id,{priceAdjustment:event.target.value})} placeholder="可正可負"/></label>
            <label><span>選項 Code</span><input value={option.code??''} onChange={event=>updateModifierOption(group.id,option.id,{code:event.target.value})}/></label>
            <Toggle checked={option.defaultSelected} onChange={defaultSelected=>updateModifierOption(group.id,option.id,{defaultSelected})} label="預設"/>
            <Toggle checked={option.active} onChange={active=>updateModifierOption(group.id,option.id,{active})} label={option.active?'啟用':'停用'}/>
            <button type="button" onClick={()=>removeModifierOption(group.id,option.id)}>刪除</button>
          </article>)}</div>}
        </section>
      </article>)}</div>}
  </section>;
}

export function PricingWorkspace(){
  const {draft,updateProduct}=useAdminDraft();
  const configured=draft.products.filter(product=>product.basePrice.trim()!=='');
  return <section className="admin-editor-page">
    <WorkspaceHeader title="價格管理" description="集中管理 Product 基本價、外賣 +$1 flag 同其他價格調整。呢度係設定面，唔建立第二套計價引擎。"/>
    <div className="admin-pricing-table">
      <header><span>商品</span><span>基本價</span><span>外賣 +$1</span><span>其他調整</span></header>
      {draft.products.map(product=><article key={product.id}>
        <b>{product.name||product.id}<small> · {product.productCode}</small></b>
        <input inputMode="decimal" value={product.basePrice} onChange={event=>updateProduct(product.id,{basePrice:event.target.value})} placeholder="0.00"/>
        <Toggle checked={Boolean(product.takeawaySurchargeEnabled)} onChange={takeawaySurchargeEnabled=>updateProduct(product.id,{takeawaySurchargeEnabled})} label={product.takeawaySurchargeEnabled?'+$1 開':'關'}/>
        <input inputMode="decimal" value={product.takeawayAdjustment} onChange={event=>updateProduct(product.id,{takeawayAdjustment:event.target.value})} placeholder="0.00"/>
      </article>)}
      <footer>已填基本價：{configured.length} / {draft.products.length} · 選項價格調整請到「選項／加料」管理。</footer>
    </div>
  </section>;
}

export function CombosWorkspace(){
  const {draft,addCombo,updateCombo,removeCombo,addComboSection,updateComboSection,removeComboSection}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="套餐" description="套餐保留自己身份同 child 關係。每個區段可以指定必選／可選、數量規則、可選商品同差價。" onAdd={addCombo} addLabel="新增套餐"/>
    {draft.combos.length===0
      ?<EmptyState title="未有套餐" description="建立套餐後加入區段，例如飯糰、小食、飲品，再指定可選商品。" action="新增套餐" onAction={addCombo}/>
      :<div className="admin-editor-grid">{draft.combos.map(combo=><article className="admin-card-editor" key={combo.id}>
        <header><div><small>{combo.id}</small><b>{combo.name||'未命名套餐'}</b></div><div className="admin-editor-actions"><Toggle checked={combo.active} onChange={active=>updateCombo(combo.id,{active})} label={combo.active?'啟用':'停用'}/><button type="button" onClick={()=>removeCombo(combo.id)}>刪除套餐</button></div></header>
        <div className="admin-form-grid three">
          <label><span>套餐名稱</span><input value={combo.name} onChange={event=>updateCombo(combo.id,{name:event.target.value})}/></label>
          <label><span>對應主商品（選填）</span><select value={combo.productId??''} onChange={event=>updateCombo(combo.id,{productId:event.target.value||undefined})}><option value="">未指定</option>{draft.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label><span>套餐基本價 HK$</span><input inputMode="decimal" value={combo.basePrice} onChange={event=>updateCombo(combo.id,{basePrice:event.target.value})}/></label>
          <Toggle checked={Boolean(combo.takeawaySurchargeEnabled)} onChange={takeawaySurchargeEnabled=>updateCombo(combo.id,{takeawaySurchargeEnabled})} label={combo.takeawaySurchargeEnabled?'整個套餐外賣 +$1':'套餐外賣 +$1 關'}/>
          <label><span>其他外賣調整 HK$</span><input inputMode="decimal" value={combo.takeawayAdjustment} onChange={event=>updateCombo(combo.id,{takeawayAdjustment:event.target.value})}/></label>
        </div>
        <section className="admin-sub-editor">
          <header><b>套餐區段</b><button type="button" onClick={()=>addComboSection(combo.id)}>＋ 新增區段</button></header>
          {combo.sections.length===0?<p>未有區段。</p>:combo.sections.map(section=><article className="admin-card-editor" key={section.id}>
            <header><b>{section.name||section.id}</b><button type="button" onClick={()=>removeComboSection(combo.id,section.id)}>刪除區段</button></header>
            <div className="admin-form-grid three">
              <label><span>區段名稱</span><input value={section.name} onChange={event=>updateComboSection(combo.id,section.id,{name:event.target.value})}/></label>
              <label><span>最少選擇</span><input type="number" min={0} value={section.min} onChange={event=>updateComboSection(combo.id,section.id,{min:Number(event.target.value)||0})}/></label>
              <label><span>最多選擇</span><input type="number" min={0} value={section.max} onChange={event=>updateComboSection(combo.id,section.id,{max:Number(event.target.value)||0})}/></label>
              <Toggle checked={section.required} onChange={required=>updateComboSection(combo.id,section.id,{required,min:required?Math.max(1,section.min):0})} label={section.required?'必選':'可選'}/>
              <label><span>區段差價 HK$</span><input inputMode="decimal" value={section.priceAdjustment??'0.00'} onChange={event=>updateComboSection(combo.id,section.id,{priceAdjustment:event.target.value})}/></label>
            </div>
            <div className="admin-check-grid">{draft.products.filter(product=>product.active).map(product=><label key={product.id}><input type="checkbox" checked={(section.childProductIds??[]).includes(product.id)} onChange={event=>{
              const current=section.childProductIds??[];
              const next=event.target.checked?[...current,product.id]:current.filter(id=>id!==product.id);
              updateComboSection(combo.id,section.id,{childProductIds:next});
            }}/><span>{product.name}</span></label>)}</div>
          </article>)}
        </section>
      </article>)}</div>}
  </section>;
}

export function MenuDisplayWorkspace(){
  const {draft,moveCategory,moveProduct}=useAdminDraft();
  const categoryName=useMemo(()=>new Map(draft.categories.map(category=>[category.id,category.name||category.id])),[draft.categories]);
  return <section className="admin-editor-page">
    <WorkspaceHeader title="菜單／顯示排序" description="正式管理分類同商品顯示次序；停用資料保留身份，但唔會進入 Active Menu。"/>
    <div className="admin-sort-columns">
      <section><header><b>分類次序</b><span>{draft.categories.length}</span></header>{draft.categories.map((category,index)=><article key={category.id}><span><b>{index+1}. {category.name||category.id}</b><small>{category.active?'啟用':'停用'}</small></span><div><button disabled={index===0} onClick={()=>moveCategory(category.id,-1)}>↑</button><button disabled={index===draft.categories.length-1} onClick={()=>moveCategory(category.id,1)}>↓</button></div></article>)}</section>
      <section><header><b>商品次序</b><span>{draft.products.length}</span></header>{draft.products.map((product,index)=><article key={product.id}><span><b>{index+1}. {product.name||product.id}</b><small>{categoryName.get(product.categoryId)??'未分類'} · {product.active?'啟用':'停用'}</small></span><div><button disabled={index===0} onClick={()=>moveProduct(product.id,-1)}>↑</button><button disabled={index===draft.products.length-1} onClick={()=>moveProduct(product.id,1)}>↓</button></div></article>)}</section>
    </div>
  </section>;
}
