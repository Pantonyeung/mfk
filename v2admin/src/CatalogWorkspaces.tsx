import {useEffect,useMemo,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readAdminStored} from './admin-local-store.ts';
import {normalizeProductMedia,normalizeProductPrintRule,PRODUCT_MEDIA_BACKEND_CONTRACT,useProductMediaConfig,useProductPrintRules,type ProductMediaConfig,type ProductPrintRule} from './admin-product-operational-config.ts';

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


function ProductOperationalDetail({productId}:{productId:string}){
  const {draft,updateProduct,updateModifierGroup,addModifierOption,updateModifierOption,removeModifierOption}=useAdminDraft();
  const [printRules,setPrintRules]=useProductPrintRules();
  const [mediaByProduct,setMediaByProduct]=useProductMediaConfig();
  const product=draft.products.find(row=>row.id===productId);
  if(!product)return null;

  const boundGroups=draft.modifierGroups.filter(group=>product.modifierGroupIds.includes(group.id));
  const printers=readAdminStored<Array<{id:string;name:string;type:string;active:boolean}>>('logical-printers.v1',[]);
  const labelPrinters=printers.filter(row=>row.type==='LABEL'&&row.active);
  const printRule=normalizeProductPrintRule(printRules[product.id]);
  const media=normalizeProductMedia(mediaByProduct[product.id],product.imageRef??'');

  const patchPrint=(change:Partial<ProductPrintRule>)=>{
    setPrintRules(current=>{
      const before=normalizeProductPrintRule(current[product.id]);
      const after=normalizeProductPrintRule({...before,...change});
      appendAdminAudit({action:'修改商品打印規則',target:product.id,before,after});
      return {...current,[product.id]:after};
    });
  };

  const patchMedia=(change:Partial<ProductMediaConfig>)=>{
    setMediaByProduct(current=>{
      const before=normalizeProductMedia(current[product.id],product.imageRef??'');
      const after=normalizeProductMedia({...before,...change},product.imageRef??'');
      appendAdminAudit({action:'修改商品圖片設定',target:product.id,before,after});
      return {...current,[product.id]:after};
    });
  };

  const setCanonicalImage=(value:string)=>{
    updateProduct(product.id,{imageRef:value});
    patchMedia({
      canonicalImageRef:value,
      publicUrl:value,
      storageState:value.trim()?'REFERENCE_ONLY':'UNSET',
      lastVerifiedAt:'',
      r2ObjectKey:'',
      d1MediaRef:'',
    });
  };

  return <div className="admin-product-detail">
    <div className="admin-product-detail-head">
      <div><small>商品詳細資料</small><h2>{product.name||'未命名商品'}</h2></div>
      <Toggle checked={product.active} onChange={active=>updateProduct(product.id,{active})} label={product.active?'啟用':'停用'}/>
    </div>

    <details className="admin-product-section" open>
      <summary><span><b>基本資料</b><small>名稱、編號、分類、條碼、描述</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-form-grid two">
          <label><span>商品名稱 *</span><input value={product.name} onChange={event=>updateProduct(product.id,{name:event.target.value})}/></label>
          <label><span>商品編號 *</span><input value={product.productCode??''} onChange={event=>updateProduct(product.id,{productCode:event.target.value})}/></label>
          <label><span>簡稱</span><input value={product.shortName??''} onChange={event=>updateProduct(product.id,{shortName:event.target.value})}/></label>
          <label><span>庫存編號</span><input value={product.sku??''} onChange={event=>updateProduct(product.id,{sku:event.target.value})}/></label>
          <label><span>分類 *</span><select value={product.categoryId} onChange={event=>updateProduct(product.id,{categoryId:event.target.value})}><option value="">未選分類</option>{draft.categories.map(item=><option key={item.id} value={item.id}>{item.name||item.id}</option>)}</select></label>
          <label><span>條碼</span><input value={product.legacyBarcode??''} onChange={event=>updateProduct(product.id,{legacyBarcode:event.target.value})}/></label>
        </div>
        <div className="admin-product-detail-secondary">
          <label><span>商品描述</span><textarea rows={3} value={product.description??''} onChange={event=>updateProduct(product.id,{description:event.target.value})} placeholder="顧客／員工可讀描述"/></label>
          <label><span>標籤（逗號分隔）</span><input value={(product.tags??[]).join(', ')} onChange={event=>updateProduct(product.id,{tags:event.target.value.split(',').map(value=>value.trim()).filter(Boolean)})}/></label>
        </div>
      </div>
    </details>

    <details className="admin-product-section">
      <summary><span><b>價格</b><small>商品價、外賣 +$1、其他正負調整</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-form-grid two">
          <label><span>基本價 HK$ *</span><input inputMode="decimal" value={product.basePrice} onChange={event=>updateProduct(product.id,{basePrice:event.target.value})} placeholder="0.00"/></label>
          <label><span>其他外賣調整 HK$</span><input inputMode="decimal" value={product.takeawayAdjustment} onChange={event=>updateProduct(product.id,{takeawayAdjustment:event.target.value})} placeholder="可正可負，例如 -1.00 / 2.00"/></label>
        </div>
        <Toggle checked={Boolean(product.takeawaySurchargeEnabled)} onChange={takeawaySurchargeEnabled=>updateProduct(product.id,{takeawaySurchargeEnabled})} label={product.takeawaySurchargeEnabled?'此商品外賣 +$1：開':'此商品外賣 +$1：關'}/>
        <div className="admin-callout compact">商品價同選項價只係設定；正式交易仍由唯一 Pricing authority 計算。</div>
      </div>
    </details>

    <details className="admin-product-section">
      <summary><span><b>選項／選項組</b><small>{boundGroups.length} 組 · 名稱／ID／價錢必填</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-check-grid">{draft.modifierGroups.map(group=><label key={group.id}><input type="checkbox" checked={product.modifierGroupIds.includes(group.id)} onChange={event=>{
          const next=event.target.checked?[...product.modifierGroupIds,group.id]:product.modifierGroupIds.filter(id=>id!==group.id);
          updateProduct(product.id,{modifierGroupIds:next});
        }}/><span>{group.name||group.id}</span></label>)}</div>
        {boundGroups.length===0?<div className="admin-read-empty">呢件商品未綁定選項組。</div>:boundGroups.map(group=>{
          const promptMode=group.required?'REQUIRED':group.forceShow?'OPTIONAL_FORCE_SHOW':'OPTIONAL';
          return <section className="admin-product-option-group" key={group.id}>
            <header><div><b>{group.name||'未命名選項組'}</b><small>組 ID：{group.id}</small></div><Toggle checked={group.active} onChange={active=>updateModifierGroup(group.id,{active})} label={group.active?'啟用':'停用'}/></header>
            <div className="admin-form-grid three">
              <label><span>選項組名稱 *</span><input value={group.name} onChange={event=>updateModifierGroup(group.id,{name:event.target.value})}/></label>
              <label><span>顯示／必選規則</span><select value={promptMode} onChange={event=>{
                const mode=event.target.value;
                updateModifierGroup(group.id,{
                  required:mode==='REQUIRED',
                  forceShow:mode!=='OPTIONAL',
                  min:mode==='REQUIRED'?Math.max(1,group.min):0,
                });
              }}><option value="REQUIRED">必選</option><option value="OPTIONAL_FORCE_SHOW">可唔揀，但一定顯示</option><option value="OPTIONAL">一般可選</option></select></label>
              <label><span>選擇方式</span><select value={group.selection} onChange={event=>{const selection=event.target.value as 'SINGLE'|'MULTI';updateModifierGroup(group.id,{selection,max:selection==='SINGLE'?1:Math.max(1,group.max),allowQuantities:selection==='SINGLE'?false:group.allowQuantities})}}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
              <label><span>最少選擇</span><input type="number" min={0} value={group.min} onChange={event=>updateModifierGroup(group.id,{min:Number(event.target.value)||0})}/></label>
              <label><span>最多選擇</span><input type="number" min={0} max={group.selection==='SINGLE'?1:99} value={group.max} onChange={event=>updateModifierGroup(group.id,{max:Number(event.target.value)||0})}/></label>
              <Toggle checked={group.allowQuantities} onChange={allowQuantities=>updateModifierGroup(group.id,{allowQuantities})} label="同一選項可重覆數量"/>
            </div>
            <div className="admin-product-option-table">
              <header><span>選項名稱 *</span><span>選項 ID *</span><span>價錢調整 HK$ *</span><span>預設</span><span>狀態</span><span></span></header>
              {group.options.map(option=><article key={option.id}>
                <input aria-label="選項名稱" value={option.name} onChange={event=>updateModifierOption(group.id,option.id,{name:event.target.value})}/>
                <input aria-label="選項 ID" value={option.code} onChange={event=>updateModifierOption(group.id,option.id,{code:event.target.value})}/>
                <input aria-label="選項價錢" inputMode="decimal" value={option.priceAdjustment} onChange={event=>updateModifierOption(group.id,option.id,{priceAdjustment:event.target.value})}/>
                <input aria-label="預設選項" type="checkbox" checked={option.defaultSelected} onChange={event=>updateModifierOption(group.id,option.id,{defaultSelected:event.target.checked})}/>
                <input aria-label="選項啟用" type="checkbox" checked={option.active} onChange={event=>updateModifierOption(group.id,option.id,{active:event.target.checked})}/>
                <button type="button" onClick={()=>removeModifierOption(group.id,option.id)}>刪</button>
              </article>)}
            </div>
            <button type="button" className="admin-inline-add" onClick={()=>addModifierOption(group.id)}>＋ 新增選項</button>
            <small className="admin-shared-warning">修改呢個選項組會影響所有綁定同一組別嘅商品。</small>
          </section>;
        })}
      </div>
    </details>

    <details className="admin-product-section">
      <summary><span><b>打印</b><small>收據／製作單／打包單／Label／堂食／外賣</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-check-grid">
          {([['receipt','收據'],['production','廚房製作單'],['packing','打包單'],['label','Label'],['dineIn','堂食打印'],['takeaway','外賣打印']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={printRule[key]} onChange={event=>patchPrint({[key]:event.target.checked})}/><span>{label}</span></label>)}
        </div>
        {printRule.label?<section className="admin-sub-editor"><header><b>Label 去邊部打印機</b><small>{printRule.labelPrinterIds.length} 個目的地</small></header>{labelPrinters.length===0?<p>未有可用 Label Logical Printer；請先到「打印中心」建立。</p>:<div className="admin-check-grid">{labelPrinters.map(printer=><label key={printer.id}><input type="checkbox" checked={printRule.labelPrinterIds.includes(printer.id)} onChange={event=>patchPrint({labelPrinterIds:event.target.checked?[...printRule.labelPrinterIds,printer.id]:printRule.labelPrinterIds.filter(id=>id!==printer.id)})}/><span>{printer.name}</span></label>)}</div>}</section>:null}
        <div className="admin-callout compact">Admin 只設定 Logical Printer；實體 IP／USB 配對仍然由 SMT 現場負責。</div>
      </div>
    </details>

    <details className="admin-product-section">
      <summary><span><b>圖片／媒體</b><small>Canonical 主圖、R2/D1 狀態、Keeta 獨立圖片</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-media-layout">
          <div className="admin-media-preview">{media.publicUrl?<img src={media.publicUrl} alt={product.name}/>:<div><b>未設定商品圖片</b><span>Customer／SMM／SMT 日後會讀 canonical imageRef。</span></div>}</div>
          <div className="admin-media-fields">
            <label><span>Canonical 圖片連結</span><input value={media.canonicalImageRef} onChange={event=>setCanonicalImage(event.target.value)} placeholder="https://... 或 /media/products/..."/></label>
            <label><span>公開圖片 URL</span><input value={media.publicUrl} onChange={event=>patchMedia({publicUrl:event.target.value})} placeholder="Customer／前線預設讀取"/></label>
            <label><span>Keeta 獨立圖片連結</span><input value={media.keetaImageUrl} onChange={event=>patchMedia({keetaImageUrl:event.target.value})} placeholder="可指向 Keeta／平台圖片庫"/></label>
          </div>
        </div>
        <div className="admin-media-status-grid">
          <article><span>R2 Object Key</span><code>{media.r2ObjectKey||'未有'}</code></article>
          <article><span>D1 Media Ref</span><code>{media.d1MediaRef||'未有'}</code></article>
          <article><span>儲存狀態</span><b>{media.storageState==='R2_D1_VERIFIED'?'R2 + D1 已驗證':media.storageState==='REFERENCE_ONLY'?'只有圖片引用':media.storageState==='R2_D1_PENDING'?'等待 R2/D1 驗證':'未設定'}</b></article>
          <article><span>最後驗證</span><b>{media.lastVerifiedAt?new Date(media.lastVerifiedAt).toLocaleString('zh-HK'):'未有 readback'}</b></article>
        </div>
        <div className="admin-callout compact">而家 MFK Admin 未有安全圖片上載 Worker；所以唔會假裝 R2／D1 已經寫入。正式圖片後端要使用 MFK 自己嘅 R2 blob + D1 metadata，瀏覽器唔會直接持有 R2 credential。</div>
        <small>Backend contract：{PRODUCT_MEDIA_BACKEND_CONTRACT.binaryStore} / {PRODUCT_MEDIA_BACKEND_CONTRACT.metadataProjection} / {PRODUCT_MEDIA_BACKEND_CONTRACT.publicPath}</small>
      </div>
    </details>

    <details className="admin-product-section">
      <summary><span><b>進階／刪除</b><small>低頻資料同破壞性操作</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-product-danger-zone">
          <span>一般停售請使用「停用」；刪除只應用於確定唔需要保留身份嘅商品。</span>
          <button type="button" onClick={()=>{if(typeof window==='undefined'||window.confirm('確定刪除「'+product.name+'」？')){updateProduct(product.id,{active:false});}}}>停用商品</button>
        </div>
      </div>
    </details>
  </div>;
}

export function ProductsWorkspace(){
  const {draft,addProduct,updateProduct,removeProduct,updateModifierGroup,addModifierOption,updateModifierOption,removeModifierOption}=useAdminDraft();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<'ALL'|'ACTIVE'|'INACTIVE'>('ALL');
  const [category,setCategory]=useState('ALL');
  const [page,setPage]=useState(1);
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const PAGE_SIZE=20;

  const categoryName=useMemo(()=>new Map(draft.categories.map(row=>[row.id,row.name||row.id])),[draft.categories]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return draft.products.filter(row=>{
      const text=[row.name,row.productCode,row.legacyBarcode,row.sku,row.shortName].filter(Boolean).join(' ').toLowerCase();
      return (!needle||text.includes(needle))
        &&(status==='ALL'||(status==='ACTIVE'?row.active:!row.active))
        &&(category==='ALL'||row.categoryId===category);
    });
  },[draft.products,query,status,category]);

  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(page,pageCount);
  const pageRows=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);

  useEffect(()=>{
    setPage(1);
    setExpandedId(null);
  },[query,status,category]);
  useEffect(()=>{
    if(page>pageCount)setPage(pageCount);
  },[page,pageCount]);

  const toggleExpanded=(id:string)=>setExpandedId(current=>current===id?null:id);
  const deleteProduct=(id:string,name:string)=>{
    if(typeof window!=='undefined'&&!window.confirm('確定刪除「'+name+'」？'))return;
    removeProduct(id);
    setExpandedId(current=>current===id?null:current);
  };

  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品資料" description="預設只顯示營運需要嘅摘要；要修改某件商品先展開詳細資料。搜尋、分類同狀態篩選會即時收窄清單。" onAdd={addProduct} addLabel="新增商品"/>
    <div className="admin-kpi-grid">
      <article><span>商品總數</span><strong>{draft.products.length}</strong><small>包含停用資料</small></article>
      <article><span>已啟用</span><strong>{draft.products.filter(row=>row.active).length}</strong><small>目前菜單候選</small></article>
      <article><span>已停用</span><strong>{draft.products.filter(row=>!row.active).length}</strong><small>保留歷史身份</small></article>
      <article><span>未填價格</span><strong>{draft.products.filter(row=>row.active&&!row.basePrice.trim()).length}</strong><small>發布前必須處理</small></article>
    </div>

    <div className="admin-product-toolbar">
      <div className="admin-filterbar">
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱／商品編號／條碼／庫存編號"/>
        <select value={category} onChange={event=>setCategory(event.target.value)}><option value="ALL">全部分類</option>{draft.categories.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="ALL">全部狀態</option><option value="ACTIVE">已啟用</option><option value="INACTIVE">已停用</option></select>
        <span>找到 {filtered.length} 件</span>
      </div>
      <div className="admin-product-page-status">
        <span>第 {safePage} / {pageCount} 頁</span>
        <small>每頁最多 {PAGE_SIZE} 件</small>
      </div>
    </div>

    {draft.categories.length===0?<div className="admin-callout">請先建立至少一個分類。</div>:null}

    {filtered.length===0
      ?<div className="admin-read-empty">搵唔到符合條件嘅商品。</div>
      :<div className="admin-product-list">
        <header className="admin-product-list-head">
          <span>商品</span><span>分類</span><span>售價</span><span>狀態</span><span></span>
        </header>
        {pageRows.map(row=>{
          const expanded=expandedId===row.id;
          const needsPrice=row.active&&!row.basePrice.trim();
          return <article className={'admin-product-row '+(expanded?'is-open':'')} key={row.id}>
            <div className="admin-product-summary">
              <div className="admin-product-identity">
                <b>{row.name||'未命名商品'}</b>
                <small>{row.productCode||row.id}{row.legacyBarcode?' · '+row.legacyBarcode:''}</small>
              </div>
              <span className="admin-product-category">{categoryName.get(row.categoryId)??'未分類'}</span>
              <span className={'admin-product-price '+(needsPrice?'is-warning':'')}>{row.basePrice.trim()?'HK$'+Number(row.basePrice).toFixed(2):'未填價格'}</span>
              <div className="admin-product-state">
                <span className={'admin-product-status '+(row.active?'is-active':'is-inactive')}>{row.active?'啟用':'停用'}</span>
                {row.modifierGroupIds.length?<small>{row.modifierGroupIds.length} 個選項組</small>:null}
              </div>
              <button type="button" className="admin-product-edit-button" aria-expanded={expanded} onClick={()=>toggleExpanded(row.id)}>{expanded?'收起':'編輯'}</button>
            </div>

            {expanded?<div className="admin-product-detail">
              <div className="admin-product-detail-head">
                <div><small>商品詳細資料</small><h2>{row.name||'未命名商品'}</h2></div>
                <Toggle checked={row.active} onChange={active=>updateProduct(row.id,{active})} label={row.active?'啟用':'停用'}/>
              </div>

              <div className="admin-form-grid two">
                <label><span>商品名稱 *</span><input value={row.name} onChange={event=>updateProduct(row.id,{name:event.target.value})}/></label>
                <label><span>商品編號 *</span><input value={row.productCode??''} onChange={event=>updateProduct(row.id,{productCode:event.target.value})}/></label>
                <label><span>簡稱</span><input value={row.shortName??''} onChange={event=>updateProduct(row.id,{shortName:event.target.value})}/></label>
                <label><span>庫存編號</span><input value={row.sku??''} onChange={event=>updateProduct(row.id,{sku:event.target.value})}/></label>
                <label><span>分類 *</span><select value={row.categoryId} onChange={event=>updateProduct(row.id,{categoryId:event.target.value})}><option value="">未選分類</option>{draft.categories.map(item=><option key={item.id} value={item.id}>{item.name||item.id}</option>)}</select></label>
                <label><span>基本價 HK$ *</span><input inputMode="decimal" value={row.basePrice} onChange={event=>updateProduct(row.id,{basePrice:event.target.value})} placeholder="0.00"/></label>
                <label><span>條碼</span><input value={row.legacyBarcode??''} onChange={event=>updateProduct(row.id,{legacyBarcode:event.target.value})}/></label>
                <label><span>圖片參考</span><input value={row.imageRef??''} onChange={event=>updateProduct(row.id,{imageRef:event.target.value})} placeholder="圖片 URL / Asset ID"/></label>
              </div>

              <div className="admin-product-detail-secondary">
                <label><span>商品描述</span><textarea rows={3} value={row.description??''} onChange={event=>updateProduct(row.id,{description:event.target.value})} placeholder="顧客／員工可讀描述"/></label>
                <label><span>標籤（逗號分隔）</span><input value={(row.tags??[]).join(', ')} onChange={event=>updateProduct(row.id,{tags:event.target.value.split(',').map(value=>value.trim()).filter(Boolean)})}/></label>
              </div>

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

              <div className="admin-product-danger-zone">
                <span>刪除只應用於確定唔再保留嘅商品；一般停售請使用「停用」。</span>
                <button type="button" onClick={()=>deleteProduct(row.id,row.name||row.id)}>刪除商品</button>
              </div>
            </div>:null}
          </article>;
        })}

        <footer className="admin-product-pagination">
          <span>顯示 {(safePage-1)*PAGE_SIZE+1}–{Math.min(safePage*PAGE_SIZE,filtered.length)} / {filtered.length}</span>
          <div>
            <button type="button" disabled={safePage<=1} onClick={()=>{setPage(value=>Math.max(1,value-1));setExpandedId(null);}}>上一頁</button>
            <b>{safePage} / {pageCount}</b>
            <button type="button" disabled={safePage>=pageCount} onClick={()=>{setPage(value=>Math.min(pageCount,value+1));setExpandedId(null);}}>下一頁</button>
          </div>
        </footer>
      </div>}
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
