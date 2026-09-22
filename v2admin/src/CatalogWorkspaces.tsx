import {useEffect,useMemo,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readAdminStored} from './admin-local-store.ts';
import {normalizeProductMedia,normalizeProductPrintRule,PRODUCT_MEDIA_BACKEND_CONTRACT,useProductMediaConfig,useProductPrintRules,type ProductMediaConfig,type ProductPrintRule} from './admin-product-operational-config.ts';
import {useOptionCenter,type OptionCenterController} from './admin-option-center.ts';

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


export function ProductOperationalDetail({productId,optionCenter}:{productId:string;optionCenter:OptionCenterController}){
  const {draft,updateProduct,removeProduct}=useAdminDraft();
  const [printRules,setPrintRules]=useProductPrintRules();
  const [mediaByProduct,setMediaByProduct]=useProductMediaConfig();
  const product=draft.products.find(row=>row.id===productId);
  if(!product)return null;

  const productLinks=optionCenter.productLinks.filter(link=>link.productId===product.id);
  const boundGroups=optionCenter.groups.filter(group=>productLinks.some(link=>link.groupId===group.id));
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
      <summary><span><b>選項</b><small>{boundGroups.length} 個已連結選項組 · 默認按商品設定</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-callout compact">選項名稱、選項 ID 同價錢只喺「選項中心」維護一次；商品詳細資料只負責連結、套用同設定此商品嘅默認。 <a href="/admin/catalog/modifiers">前往選項中心</a></div>
        <div className="admin-product-link-list">
          {optionCenter.groups.length===0?<div className="admin-read-empty">選項中心未有選項組。請先建立選項同選項組。</div>:optionCenter.groups.map(group=>{
            const link=optionCenter.getLink(product.id,group.id);
            const linked=Boolean(link);
            const requirement=group.required?'必選':group.forceShow?'可選但必須顯示':'一般可選';
            const optionRows=group.optionIds.map(optionId=>optionCenter.options.find(option=>option.id===optionId)).filter((option):option is NonNullable<typeof option>=>Boolean(option));
            return <section className={'admin-product-link-card '+(linked?'is-linked':'')} key={group.id}>
              <header>
                <label><input type="checkbox" checked={linked} onChange={event=>optionCenter.setProductGroupLinked(product.id,group.id,event.target.checked)}/><span><b>{group.name}</b><small>{requirement} · {group.selection==='SINGLE'?'單選':'多選'} · {group.min}–{group.max}</small></span></label>
                <a href="/admin/catalog/modifiers">前往選項中心</a>
              </header>
              {linked?<div className="admin-product-linked-options">
                <div className="admin-product-linked-options-head"><span>套用</span><span>選項 ID</span><span>名稱</span><span>價錢</span><span>此商品默認</span></div>
                {optionRows.map(option=>{
                  const included=link?.optionIds.includes(option.id)??false;
                  const isDefault=link?.defaultOptionIds.includes(option.id)??false;
                  return <article key={option.id}>
                    <input aria-label={'套用 '+option.name} type="checkbox" checked={included} onChange={event=>optionCenter.setProductOptionLinked(product.id,group.id,option.id,event.target.checked)}/>
                    <code>{option.code}</code>
                    <b>{option.name}</b>
                    <span>{Number(option.priceAdjustment)>=0?'+':''}{Number(option.priceAdjustment).toFixed(2)}</span>
                    <label><input type="checkbox" checked={isDefault} disabled={!included} onChange={event=>optionCenter.setProductDefault(product.id,group.id,option.id,event.target.checked)}/><span>默認</span></label>
                  </article>;
                })}
              </div>:null}
            </section>;
          })}
        </div>
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
            <label><span>Canonical 圖片連結</span><input value={media.canonicalImageRef} onChange={event=>setCanonicalImage(event.target.value)} placeholder="圖片 URL 或 /media/products/..."/></label>
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
          <button type="button" onClick={()=>{if(typeof window==='undefined'||window.confirm('確定刪除「'+product.name+'」？刪除前一般應優先使用停用。'))removeProduct(product.id)}}>刪除商品</button>
        </div>
      </div>
    </details>
  </div>;
}

export function ProductsWorkspace(){
  const {draft,addProduct,updateProduct,removeProduct}=useAdminDraft();
  const optionCenter=useOptionCenter(draft);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<'ALL'|'ACTIVE'|'INACTIVE'>('ALL');
  const [category,setCategory]=useState('ALL');
  const [page,setPage]=useState(1);
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [printRules,setPrintRules]=useProductPrintRules();
  const [mediaRows,setMediaRows]=useProductMediaConfig();
  const logicalPrinters=readAdminStored<Array<{id:string;name:string;type:string;active:boolean}>>('logical-printers.v1',[]);
  const labelPrinters=logicalPrinters.filter(row=>row.type==='LABEL'&&row.active);
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

  useEffect(()=>{setPage(1);setExpandedId(null);},[query,status,category]);
  useEffect(()=>{if(page>pageCount)setPage(pageCount);},[page,pageCount]);

  const toggleExpanded=(id:string)=>setExpandedId(current=>current===id?null:id);
  const deleteProduct=(id:string,name:string)=>{
    if(typeof window!=='undefined'&&!window.confirm('確定刪除「'+name+'」？'))return;
    removeProduct(id);
    setExpandedId(current=>current===id?null:current);
  };
  const currentPrint=(id:string)=>normalizeProductPrintRule(printRules[id]);
  const patchPrint=(id:string,change:Partial<ProductPrintRule>)=>{
    const before=currentPrint(id);
    const after=normalizeProductPrintRule({...before,...change});
    setPrintRules(current=>({...current,[id]:after}));
    appendAdminAudit({action:'修改商品打印規則',target:id,before,after});
  };
  const currentMedia=(id:string,imageRef:string|undefined)=>normalizeProductMedia(mediaRows[id],imageRef??'');
  const patchMedia=(id:string,imageRef:string|undefined,change:Partial<ProductMediaConfig>)=>{
    const before=currentMedia(id,imageRef);
    const after=normalizeProductMedia({...before,...change},before.canonicalImageRef);
    setMediaRows(current=>({...current,[id]:after}));
    if(change.canonicalImageRef!==undefined)updateProduct(id,{imageRef:after.canonicalImageRef});
    appendAdminAudit({action:'修改商品圖片設定',target:id,before,after});
  };

  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品資料" description="預設只顯示營運摘要；要改某件商品先展開。基本資料、價格、選項、打印同圖片設定集中喺同一個 detail。" onAdd={addProduct} addLabel="新增商品"/>
    <div className="admin-kpi-grid">
      <article><span>商品總數</span><strong>{draft.products.length}</strong><small>包含停用資料</small></article>
      <article><span>已啟用</span><strong>{draft.products.filter(row=>row.active).length}</strong><small>目前菜單候選</small></article>
      <article><span>已停用</span><strong>{draft.products.filter(row=>!row.active).length}</strong><small>保留歷史身份</small></article>
      <article><span>未填價格</span><strong>{draft.products.filter(row=>row.active&&!row.basePrice.trim()).length}</strong><small>建立版本前必須處理</small></article>
    </div>
    <div className="admin-product-toolbar">
      <div className="admin-filterbar">
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱／商品編號／條碼／庫存編號"/>
        <select value={category} onChange={event=>setCategory(event.target.value)}><option value="ALL">全部分類</option>{draft.categories.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="ALL">全部狀態</option><option value="ACTIVE">已啟用</option><option value="INACTIVE">已停用</option></select>
        <span>找到 {filtered.length} 件</span>
      </div>
      <div className="admin-product-page-status"><span>第 {safePage} / {pageCount} 頁</span><small>每頁最多 {PAGE_SIZE} 件</small></div>
    </div>

    {filtered.length===0?<div className="admin-read-empty">搵唔到符合條件嘅商品。</div>:<div className="admin-product-list">
      <header className="admin-product-list-head"><span>商品</span><span>分類</span><span>售價</span><span>狀態</span><span></span></header>
      {pageRows.map(row=>{
        const expanded=expandedId===row.id;
        const needsPrice=row.active&&!row.basePrice.trim();
        const boundGroups=optionCenter.productLinks.filter(link=>link.productId===row.id);
        const print=currentPrint(row.id);
        const media=currentMedia(row.id,row.imageRef);
        return <article className={'admin-product-row '+(expanded?'is-open':'')} key={row.id}>
          <div className="admin-product-summary">
            <div className="admin-product-identity"><b>{row.name||'未命名商品'}</b><small>{row.productCode||row.id}{row.legacyBarcode?' · '+row.legacyBarcode:''}</small></div>
            <span className="admin-product-category">{categoryName.get(row.categoryId)??'未分類'}</span>
            <span className={'admin-product-price '+(needsPrice?'is-warning':'')}>{row.basePrice.trim()?'HK$'+Number(row.basePrice).toFixed(2):'未填價格'}</span>
            <div className="admin-product-state"><span className={'admin-product-status '+(row.active?'is-active':'is-inactive')}>{row.active?'啟用':'停用'}</span>{boundGroups.length?<small>{boundGroups.length} 個選項組</small>:null}</div>
            <button type="button" className="admin-product-edit-button" aria-expanded={expanded} onClick={()=>toggleExpanded(row.id)}>{expanded?'收起':'編輯'}</button>
          </div>

          {expanded?<ProductOperationalDetail productId={row.id} optionCenter={optionCenter}/>:null}
        </article>;
      })}
      <footer className="admin-product-pagination"><span>顯示 {(safePage-1)*PAGE_SIZE+1}–{Math.min(safePage*PAGE_SIZE,filtered.length)} / {filtered.length}</span><div><button type="button" disabled={safePage<=1} onClick={()=>{setPage(value=>Math.max(1,value-1));setExpandedId(null);}}>上一頁</button><b>{safePage} / {pageCount}</b><button type="button" disabled={safePage>=pageCount} onClick={()=>{setPage(value=>Math.min(pageCount,value+1));setExpandedId(null);}}>下一頁</button></div></footer>
    </div>}
  </section>;
}

export function ModifiersWorkspace(){
  const {draft}=useAdminDraft();
  const optionCenter=useOptionCenter(draft);
  const [tab,setTab]=useState<'OPTION'|'GROUP'>('OPTION');
  const [query,setQuery]=useState('');
  const token=query.trim().toLowerCase();

  const optionRows=optionCenter.options.filter(option=>!token||(option.name+' '+option.code).toLowerCase().includes(token));
  const groupRows=optionCenter.groups.filter(group=>!token||(group.name+' '+group.id).toLowerCase().includes(token));

  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>唯一選項資料來源</small><h1>選項中心</h1><p>選項只建立一次，再由選項組引用，最後連結到商品。Product Detail 唔會再複製另一份選項資料。</p></div>
      <div className="admin-editor-actions">
        {tab==='OPTION'?<button type="button" className="primary" onClick={optionCenter.addOption}>新增選項</button>:<button type="button" className="primary" onClick={optionCenter.addGroup}>新增選項組</button>}
      </div>
    </header>

    <div className="admin-kpi-grid">
      <article><span>選項 Master</span><strong>{optionCenter.options.length}</strong><small>每個身份只存在一次</small></article>
      <article><span>選項組</span><strong>{optionCenter.groups.length}</strong><small>只引用既有選項</small></article>
      <article><span>商品連結</span><strong>{optionCenter.productLinks.length}</strong><small>Product ↔ Group</small></article>
      <article><span>資料問題</span><strong>{optionCenter.errors.length}</strong><small>{optionCenter.errors.length?'需要處理':'目前有效'}</small></article>
    </div>

    {optionCenter.errors.length?<div className="admin-validation is-error"><b>選項中心有 {optionCenter.errors.length} 項需要處理</b><ul>{optionCenter.errors.slice(0,12).map((error,index)=><li key={index}>{error}</li>)}</ul></div>:null}

    <div className="admin-filterbar">
      <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={tab==='OPTION'?'搜尋選項名稱／ID':'搜尋選項組名稱／ID'}/>
      <button type="button" onClick={()=>setTab('OPTION')} disabled={tab==='OPTION'}>選項</button>
      <button type="button" onClick={()=>setTab('GROUP')} disabled={tab==='GROUP'}>選項組</button>
      <span>{tab==='OPTION'?optionRows.length:groupRows.length} 項</span>
    </div>

    {tab==='OPTION'?<div className="admin-option-master-list">
      <div className="admin-option-master-head"><span>選項 ID *</span><span>名稱 *</span><span>價錢調整 HK$ *</span><span>狀態</span><span>使用中</span><span></span></div>
      {optionRows.length===0?<div className="admin-read-empty">未有選項。例：多飯、小飯、走飯。</div>:optionRows.map(option=>{
        const usedBy=optionCenter.groups.filter(group=>group.optionIds.includes(option.id)).length;
        return <article key={option.id}>
          <input value={option.code} onChange={event=>optionCenter.updateOption(option.id,{code:event.target.value})} aria-label="選項 ID"/>
          <input value={option.name} onChange={event=>optionCenter.updateOption(option.id,{name:event.target.value})} aria-label="選項名稱"/>
          <input inputMode="decimal" value={option.priceAdjustment} onChange={event=>optionCenter.updateOption(option.id,{priceAdjustment:event.target.value})} aria-label="選項價格"/>
          <Toggle checked={option.active} onChange={active=>optionCenter.updateOption(option.id,{active})} label={option.active?'啟用':'停用'}/>
          <span>{usedBy} 個選項組</span>
          <button type="button" disabled={usedBy>0} title={usedBy>0?'先由選項組移除先可以刪除':''} onClick={()=>optionCenter.removeOption(option.id)}>刪除</button>
        </article>;
      })}
    </div>:<div className="admin-option-group-list">
      {groupRows.length===0?<div className="admin-read-empty">未有選項組。先建立 Option Master，再建立例如「飯量」選項組。</div>:groupRows.map(group=>{
        const requirement=group.required?'REQUIRED':group.forceShow?'OPTIONAL_FORCE_SHOW':'OPTIONAL';
        const linkedProducts=optionCenter.productLinks.filter(link=>link.groupId===group.id).length;
        return <details className="admin-option-group-card" key={group.id}>
          <summary><span><b>{group.name}</b><small>{group.id} · {group.optionIds.length} 個選項 · {linkedProducts} 件商品</small></span><span>{requirement==='REQUIRED'?'必選':requirement==='OPTIONAL_FORCE_SHOW'?'可選但必須顯示':'一般可選'}</span></summary>
          <div className="admin-option-group-body">
            <div className="admin-form-grid three">
              <label><span>選項組名稱 *</span><input value={group.name} onChange={event=>optionCenter.updateGroup(group.id,{name:event.target.value})}/></label>
              <label><span>要求方式</span><select value={requirement} onChange={event=>{const mode=event.target.value;optionCenter.updateGroup(group.id,{required:mode==='REQUIRED',forceShow:mode!=='OPTIONAL',min:mode==='REQUIRED'?Math.max(1,group.min):0})}}><option value="REQUIRED">必選</option><option value="OPTIONAL_FORCE_SHOW">可選，但必須顯示一次</option><option value="OPTIONAL">一般可選</option></select></label>
              <label><span>選擇方式</span><select value={group.selection} onChange={event=>optionCenter.updateGroup(group.id,{selection:event.target.value as 'SINGLE'|'MULTI'})}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
              <label><span>最少選擇</span><input type="number" min={0} value={group.min} onChange={event=>optionCenter.updateGroup(group.id,{min:Number(event.target.value)||0})}/></label>
              <label><span>最多選擇</span><input type="number" min={0} value={group.max} onChange={event=>optionCenter.updateGroup(group.id,{max:Number(event.target.value)||0})}/></label>
              <Toggle checked={group.allowQuantities} onChange={allowQuantities=>optionCenter.updateGroup(group.id,{allowQuantities})} label="同一選項可重覆數量"/>
            </div>

            <section className="admin-sub-editor">
              <header><b>組內選項</b><small>只引用 Option Master，唔複製名稱／價錢</small></header>
              {optionCenter.options.length===0?<p>未有 Option Master。</p>:<div className="admin-option-membership-grid">{optionCenter.options.map(option=><label key={option.id}><input type="checkbox" checked={group.optionIds.includes(option.id)} onChange={event=>optionCenter.setGroupOption(group.id,option.id,event.target.checked)}/><span><b>{option.name}</b><small>{option.code} · {Number(option.priceAdjustment)>=0?'+':''}{Number(option.priceAdjustment).toFixed(2)}</small></span></label>)}</div>}
            </section>

            <div className="admin-editor-actions">
              <Toggle checked={group.active} onChange={active=>optionCenter.updateGroup(group.id,{active})} label={group.active?'啟用':'停用'}/>
              <button type="button" disabled={linkedProducts>0} title={linkedProducts>0?'仍有商品連結呢個組':''} onClick={()=>optionCenter.removeGroup(group.id)}>刪除選項組</button>
            </div>
          </div>
        </details>;
      })}
    </div>}
  </section>;
}

export function PricingWorkspace(){
  const {draft,updateProduct}=useAdminDraft();
  const optionCenter=useOptionCenter(draft);
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<'PRODUCT'|'OPTION'>('PRODUCT');
  const token=query.trim().toLowerCase();
  const productRows=useMemo(()=>draft.products.filter(product=>!token||[product.name,product.productCode].filter(Boolean).join(' ').toLowerCase().includes(token)),[draft.products,token]);
  const optionRows=optionCenter.options.filter(option=>!token||(option.name+' '+option.code).toLowerCase().includes(token));
  const productConfigured=draft.products.filter(product=>product.basePrice.trim()!=='').length;
  const optionConfigured=optionCenter.options.filter(option=>option.priceAdjustment.trim()!=='').length;

  return <section className="admin-editor-page">
    <WorkspaceHeader title="價格管理" description="商品價同 Option Master 價錢集中管理；同一選項只得一份價錢設定，所有 Product Link 讀同一份。正式 Quote 仍由唯一 Pricing authority 計算。"/>
    <div className="admin-kpi-grid">
      <article><span>商品價格</span><strong>{productConfigured}/{draft.products.length}</strong><small>基本價必填</small></article>
      <article><span>選項價格</span><strong>{optionConfigured}/{optionCenter.options.length}</strong><small>Option Master</small></article>
      <article><span>外賣 +$1</span><strong>{draft.products.filter(product=>product.takeawaySurchargeEnabled).length}</strong><small>Product flag</small></article>
      <article><span>負數選項價</span><strong>{optionCenter.options.filter(option=>Number(option.priceAdjustment)<0).length}</strong><small>支援減價</small></article>
    </div>
    <div className="admin-filterbar">
      <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={tab==='PRODUCT'?'搜尋商品':'搜尋選項名稱／ID'}/>
      <button type="button" onClick={()=>setTab('PRODUCT')} disabled={tab==='PRODUCT'}>商品價格</button>
      <button type="button" onClick={()=>setTab('OPTION')} disabled={tab==='OPTION'}>選項價格</button>
    </div>
    {tab==='PRODUCT'?<div className="admin-pricing-table">
      <header><span>商品</span><span>基本價</span><span>外賣 +$1</span><span>其他調整</span></header>
      {productRows.map(product=><article key={product.id}>
        <b>{product.name||product.id}<small> · {product.productCode}</small></b>
        <input inputMode="decimal" value={product.basePrice} onChange={event=>updateProduct(product.id,{basePrice:event.target.value})} placeholder="0.00"/>
        <Toggle checked={Boolean(product.takeawaySurchargeEnabled)} onChange={takeawaySurchargeEnabled=>updateProduct(product.id,{takeawaySurchargeEnabled})} label={product.takeawaySurchargeEnabled?'+$1 開':'關'}/>
        <input inputMode="decimal" value={product.takeawayAdjustment} onChange={event=>updateProduct(product.id,{takeawayAdjustment:event.target.value})} placeholder="0.00"/>
      </article>)}
    </div>:<div className="admin-pricing-table admin-option-pricing-table">
      <header><span>選項</span><span>選項 ID</span><span>使用組數</span><span>價錢 HK$</span></header>
      {optionRows.map(option=><article key={option.id}>
        <b>{option.name}</b><code>{option.code}</code><span>{optionCenter.groups.filter(group=>group.optionIds.includes(option.id)).length}</span>
        <input inputMode="decimal" value={option.priceAdjustment} onChange={event=>optionCenter.updateOption(option.id,{priceAdjustment:event.target.value})} placeholder="0.00 / -1.00"/>
      </article>)}
    </div>}
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
