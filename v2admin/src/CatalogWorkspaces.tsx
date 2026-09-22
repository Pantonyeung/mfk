import {useEffect,useMemo,useRef,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readActiveAdminRelease,readAdminReleases,readAdminStored} from './admin-local-store.ts';
import {saveAdminConfig} from './admin-config-save.ts';
import {normalizeProductMedia,normalizeProductPrintRule,PRODUCT_MEDIA_BACKEND_CONTRACT,useProductMediaConfig,useProductPrintRules,type ProductMediaConfig,type ProductPrintRule} from './admin-product-operational-config.ts';
import {projectOptionSetsForProduct,useOptionSetCenter,type OptionSetCenterController,type OptionSetCenterState,type ProductOptionSetLink} from './admin-option-set-center.ts';

function WorkspaceHeader({
  title,description,onAdd,addLabel,optionCenterState,optionDirty=false,onOptionSaved,
}:{
  title:string;description:string;onAdd?:()=>void;addLabel?:string;
  optionCenterState?:OptionSetCenterState;optionDirty?:boolean;onOptionSaved?:()=>void;
}){
  const {draft,dirty,validationErrors,validate,reset,markClean}=useAdminDraft();
  const [validated,setValidated]=useState(false);
  const [saveErrors,setSaveErrors]=useState<readonly string[]>([]);
  const [active,setActive]=useState(()=>readActiveAdminRelease());
  const [saveMessage,setSaveMessage]=useState('');
  useEffect(()=>{setValidated(false);setSaveErrors([]);setSaveMessage('');},[draft]);
  const runValidate=()=>{validate();setValidated(true);};
  const runSave=()=>{
    const result=saveAdminConfig(draft,optionCenterState);
    if(!result.ok){
      validate();
      setSaveErrors(result.errors);
      setValidated(true);
      setSaveMessage('未能保存；請先修正以下資料。');
      return;
    }
    markClean();
    onOptionSaved?.();
    setActive({version:result.release.version,createdAt:result.release.createdAt,fingerprint:result.release.fingerprint});
    setSaveErrors([]);
    setValidated(false);
    setSaveMessage('已保存 · R'+result.release.version);
  };
  const unsaved=dirty||optionDirty;
  const errors=saveErrors.length?saveErrors:validationErrors;
  return <header className="admin-editor-head">
    <div><small>{unsaved?'未保存變更':active?'已保存 · R'+active.version:'未有保存版本'}</small><h1>{title}</h1><p>{description}</p>{saveMessage?<span>{saveMessage}</span>:null}</div>
    <div className="admin-editor-actions">
      {onAdd?<button type="button" className="secondary" onClick={onAdd}>{addLabel??'新增'}</button>:null}
      <button type="button" className="secondary" onClick={reset}>還原原始 MF01 菜單</button>
      <button type="button" className="secondary" onClick={runValidate}>檢查完整性</button>
      <button type="button" className="primary" onClick={runSave}>保存</button>
    </div>
    {validated?<div className={'admin-validation '+(errors.length?'is-error':'is-ok')} role="status">
      {errors.length
        ?<><b>有 {errors.length} 項需要處理</b><ul>{errors.map((error,index)=><li key={index}>{error}</li>)}</ul></>
        :<><b>資料完整性檢查通過</b><span>撳「保存」會建立一個新版本並即時成為目前版本。</span></>}
    </div>:null}
  </header>;
}

function EmptyState({title,description,action,onAction}:{title:string;description:string;action:string;onAction:()=>void}){
  return <section className="admin-empty-state"><b>{title}</b><p>{description}</p><button type="button" onClick={onAction}>{action}</button></section>;
}

function Toggle({checked,onChange,label}:{checked:boolean;onChange:(next:boolean)=>void;label:string}){
  return <label className="admin-toggle"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span>{label}</span></label>;
}


function TriStateCheckbox({checked,partial,onChange,label}:{checked:boolean;partial:boolean;onChange:(next:boolean)=>void;label:string}){
  const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(ref.current)ref.current.indeterminate=partial;},[partial]);
  return <label className="admin-bulk-check">
    <input ref={ref} type="checkbox" checked={checked} aria-checked={partial?'mixed':checked} onChange={event=>onChange(event.target.checked)}/>
    <span>{label}</span>
  </label>;
}

function readActiveProductOptionLinks():readonly ProductOptionSetLink[]{
  const active=readActiveAdminRelease();
  if(!active)return [];
  const release=readAdminReleases().find(row=>row.version===active.version);
  if(!release||!release.snapshot||typeof release.snapshot!=='object')return [];
  const snapshot=release.snapshot as {optionCenter?:{productLinks?:readonly ProductOptionSetLink[]}};
  return snapshot.optionCenter?.productLinks??[];
}

export function CategoriesWorkspace(){
  const {draft,addCategory,updateCategory,removeCategory,moveCategory}=useAdminDraft();
  return <section className="admin-editor-page">
    <WorkspaceHeader title="商品分類" description="建立分類、顯示次序同啟用狀態。完成修改後撳「保存」，成功即建立新版本並生效。" onAdd={addCategory} addLabel="新增分類"/>
    <div className="admin-kpi-grid">
      <article><span>分類總數</span><strong>{draft.categories.length}</strong><small>目前編輯內容</small></article>
      <article><span>已啟用</span><strong>{draft.categories.filter(row=>row.active).length}</strong><small>保存後進入新版本</small></article>
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


export function ProductOperationalDetail({productId,optionCenter}:{productId:string;optionCenter:OptionSetCenterController}){
  const {draft,updateProduct,removeProduct}=useAdminDraft();
  const [printRules,setPrintRules]=useProductPrintRules();
  const [mediaByProduct,setMediaByProduct]=useProductMediaConfig();
  const product=draft.products.find(row=>row.id===productId);
  if(!product)return null;

  const productLinks=optionCenter.productLinks.filter(link=>link.productId===product.id);
  const boundGroups=optionCenter.sets.filter(set=>productLinks.some(link=>link.setId===set.id));
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
      <summary><span><b>選項</b><small>{boundGroups.length} 個已加入選項組 · 默認按商品設定</small></span><span>›</span></summary>
      <div className="admin-product-section-body">
        <div className="admin-callout compact">先喺「選項中心」建立完整選項組，例如「青瓜 → 多青瓜／少青瓜／走青瓜」。商品詳細資料只負責「加入選項」、移除，同設定呢件商品嘅默認子選項。</div>

        <section className="admin-sub-editor">
          <header><b>加入選項</b><small>揀一個已建立嘅選項組</small></header>
          <div className="admin-product-option-add-grid">
            {optionCenter.sets.filter(set=>set.active&&!optionCenter.getProductLink(product.id,set.id)).length===0
              ?<div className="admin-read-empty">冇其他可加入選項組。<a href="/admin/catalog/modifiers">前往選項中心</a></div>
              :optionCenter.sets.filter(set=>set.active&&!optionCenter.getProductLink(product.id,set.id)).map(set=><article key={set.id}>
                <span><b>{set.name}</b><small>{set.options.length} 個子選項 · {set.selection==='SINGLE'?'單選':'多選'}</small></span>
                <button type="button" onClick={()=>optionCenter.setProductSetLinked(product.id,set.id,true)}>加入</button>
              </article>)}
          </div>
        </section>

        <div className="admin-product-link-list">
          {boundGroups.length===0?<div className="admin-read-empty">呢件商品未有加入任何選項組。</div>:boundGroups.map(set=>{
            const link=optionCenter.getProductLink(product.id,set.id);
            const requirement=set.required?'必選':set.forceShow?'可選但必須顯示':'一般可選';
            return <section className="admin-product-link-card is-linked" key={set.id}>
              <header>
                <span><b>{set.name}</b><small>{requirement} · {set.selection==='SINGLE'?'單選':'多選'} · {set.options.length} 個子選項</small></span>
                <div className="admin-product-link-actions">
                  <a href="/admin/catalog/modifiers">編輯選項組</a>
                  <button type="button" onClick={()=>optionCenter.setProductSetLinked(product.id,set.id,false)}>移除</button>
                </div>
              </header>
              <div className="admin-product-linked-options">
                <div className="admin-product-linked-options-head"><span>選項 ID</span><span>名稱</span><span>價錢</span><span>狀態</span><span>此商品默認</span></div>
                {set.options.map(option=>{
                  const isDefault=link?.defaultOptionIds.includes(option.id)??false;
                  return <article key={option.id}>
                    <code>{option.code}</code>
                    <b>{option.name}</b>
                    <span>{Number(option.priceAdjustment)>=0?'+':''}{Number(option.priceAdjustment).toFixed(2)}</span>
                    <span>{option.active?'啟用':'停用'}</span>
                    <label>
                      <input
                        type={set.selection==='SINGLE'?'radio':'checkbox'}
                        name={'product-default-'+product.id+'-'+set.id}
                        checked={isDefault}
                        disabled={!option.active}
                        onChange={event=>optionCenter.setProductDefault(product.id,set.id,option.id,event.target.checked)}
                      />
                      <span>默認</span>
                    </label>
                  </article>;
                })}
              </div>
              {link?.defaultOptionIds.length?<button type="button" className="admin-inline-add" onClick={()=>link.defaultOptionIds.forEach(optionId=>optionCenter.setProductDefault(product.id,set.id,optionId,false))}>清除默認</button>:null}
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
  const optionCenter=useOptionSetCenter(draft);
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
    <WorkspaceHeader title="商品資料" description="預設只顯示營運摘要；要改某件商品先展開。基本資料、價格、選項、打印同圖片設定集中喺同一個 detail。" onAdd={addProduct} addLabel="新增商品" optionCenterState={optionCenter.state} optionDirty={optionCenter.dirty} onOptionSaved={optionCenter.markClean}/>
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
  const optionCenter=useOptionSetCenter(draft);
  const [query,setQuery]=useState('');
  const [mappingQueryBySet,setMappingQueryBySet]=useState<Record<string,string>>({});
  const [activeProductLinks,setActiveProductLinks]=useState<readonly ProductOptionSetLink[]>(()=>readActiveProductOptionLinks());
  const token=query.trim().toLowerCase();
  const rows=optionCenter.sets.filter(set=>!token||(set.name+' '+set.id+' '+set.options.map(option=>option.name+' '+option.code).join(' ')).toLowerCase().includes(token));
  const activeProducts=draft.products.filter(product=>product.active);

  const handleOptionSaved=()=>{
    optionCenter.markClean();
    setActiveProductLinks(readActiveProductOptionLinks());
  };

  return <section className="admin-editor-page">
    <WorkspaceHeader
      title="選項中心"
      description="一個選項組就係一個完整可重用單位。除咗逐件商品加入，亦可以用「批量映射」一次套用全分類、分類內部分商品，或者跨分類自選商品。"
      onAdd={optionCenter.addSet}
      addLabel="新增選項組"
      optionCenterState={optionCenter.state}
      optionDirty={optionCenter.dirty}
      onOptionSaved={handleOptionSaved}
    />

    <div className="admin-callout compact">操作方式：先建立選項組同子選項，再用「批量映射」揀商品。勾選整個分類只會套用到保存當刻已存在嘅商品；日後新加入分類嘅商品唔會偷偷自動繼承。</div>

    <div className="admin-kpi-grid">
      <article><span>選項組</span><strong>{optionCenter.sets.length}</strong><small>可重用單位</small></article>
      <article><span>子選項</span><strong>{optionCenter.sets.reduce((sum,set)=>sum+set.options.length,0)}</strong><small>組內管理</small></article>
      <article><span>商品連結</span><strong>{optionCenter.productLinks.length}</strong><small>商品 × 選項組</small></article>
      <article><span>資料問題</span><strong>{optionCenter.errors.length}</strong><small>{optionCenter.errors.length?'需要處理':'目前有效'}</small></article>
    </div>

    {optionCenter.errors.length?<div className="admin-validation is-error"><b>選項中心有 {optionCenter.errors.length} 項需要處理</b><ul>{optionCenter.errors.slice(0,12).map((error,index)=><li key={index}>{error}</li>)}</ul></div>:null}

    <div className="admin-filterbar">
      <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋選項組／子選項名稱／ID"/>
      <span>{rows.length} 個選項組</span>
    </div>

    {rows.length===0?<div className="admin-read-empty">未有選項組。撳「新增選項組」，例如先建立「飯量」或者「青瓜」；建立後展開組別，再撳「新增子選項」。</div>:<div className="admin-option-set-list">
      {rows.map(set=>{
        const requirement=set.required?'REQUIRED':set.forceShow?'OPTIONAL_FORCE_SHOW':'OPTIONAL';
        const currentLinkedIds=new Set(optionCenter.productLinks.filter(link=>link.setId===set.id).map(link=>link.productId));
        const savedLinkedIds=new Set(activeProductLinks.filter(link=>link.setId===set.id).map(link=>link.productId));
        const linkedProducts=currentLinkedIds.size;
        const newlyAdded=[...currentLinkedIds].filter(id=>!savedLinkedIds.has(id)).length;
        const pendingRemoved=[...savedLinkedIds].filter(id=>!currentLinkedIds.has(id)).length;
        const allProductIds=activeProducts.map(product=>product.id);
        const allChecked=allProductIds.length>0&&allProductIds.every(id=>currentLinkedIds.has(id));
        const allPartial=!allChecked&&allProductIds.some(id=>currentLinkedIds.has(id));
        const mappingToken=(mappingQueryBySet[set.id]??'').trim().toLowerCase();
        const categoryRows=draft.categories.map(category=>{
          const products=activeProducts.filter(product=>product.categoryId===category.id);
          const visibleProducts=products.filter(product=>!mappingToken||[product.name,product.productCode,product.legacyBarcode].filter(Boolean).join(' ').toLowerCase().includes(mappingToken));
          return {category,products,visibleProducts};
        }).filter(row=>row.products.length>0&&(!mappingToken||row.visibleProducts.length>0));
        const knownCategoryIds=new Set(draft.categories.map(category=>category.id));
        const orphanProducts=activeProducts.filter(product=>!knownCategoryIds.has(product.categoryId))
          .filter(product=>!mappingToken||[product.name,product.productCode,product.legacyBarcode].filter(Boolean).join(' ').toLowerCase().includes(mappingToken));

        return <details className="admin-option-group-card" key={set.id}>
          <summary>
            <span><b>{set.name||'未命名選項組'}</b><small>{set.id} · {set.options.length} 個子選項 · {linkedProducts} 件商品使用</small></span>
            <span>{requirement==='REQUIRED'?'必選':requirement==='OPTIONAL_FORCE_SHOW'?'可選但必須顯示':'一般可選'}</span>
          </summary>
          <div className="admin-option-group-body">
            <div className="admin-form-grid three">
              <label><span>選項組名稱 *</span><input value={set.name} onChange={event=>optionCenter.updateSet(set.id,{name:event.target.value})} placeholder="例如：飯量／青瓜"/></label>
              <label><span>要求方式</span><select value={requirement} onChange={event=>{const mode=event.target.value;optionCenter.updateSet(set.id,{required:mode==='REQUIRED',forceShow:mode!=='OPTIONAL',min:mode==='REQUIRED'?Math.max(1,set.min):0})}}><option value="REQUIRED">必選</option><option value="OPTIONAL_FORCE_SHOW">可選，但必須顯示一次</option><option value="OPTIONAL">一般可選</option></select></label>
              <label><span>選擇方式</span><select value={set.selection} onChange={event=>optionCenter.updateSet(set.id,{selection:event.target.value as 'SINGLE'|'MULTI'})}><option value="SINGLE">單選</option><option value="MULTI">多選</option></select></label>
              <label><span>最少選擇</span><input type="number" min={0} value={set.min} onChange={event=>optionCenter.updateSet(set.id,{min:Number(event.target.value)||0})}/></label>
              <label><span>最多選擇</span><input type="number" min={0} value={set.max} onChange={event=>optionCenter.updateSet(set.id,{max:Number(event.target.value)||0})}/></label>
              <Toggle checked={set.allowQuantities} onChange={allowQuantities=>optionCenter.updateSet(set.id,{allowQuantities})} label="同一子選項可重覆數量"/>
            </div>

            <section className="admin-sub-editor">
              <header><b>組內選項</b><button type="button" onClick={()=>optionCenter.addChild(set.id)}>＋ 新增子選項</button></header>
              {set.options.length===0?<p>未有子選項。例：「青瓜」可以加入多青瓜／少青瓜／走青瓜。</p>:<div className="admin-option-child-table">
                <header><span>次序</span><span>選項 ID *</span><span>名稱 *</span><span>價錢調整 HK$ *</span><span>狀態</span><span></span></header>
                {set.options.map((option,index)=><article key={option.id}>
                  <div className="admin-option-order-buttons"><button type="button" disabled={index===0} onClick={()=>optionCenter.moveChild(set.id,option.id,-1)}>↑</button><button type="button" disabled={index===set.options.length-1} onClick={()=>optionCenter.moveChild(set.id,option.id,1)}>↓</button></div>
                  <input value={option.code} onChange={event=>optionCenter.updateChild(set.id,option.id,{code:event.target.value})} aria-label="選項 ID"/>
                  <input value={option.name} onChange={event=>optionCenter.updateChild(set.id,option.id,{name:event.target.value})} aria-label="選項名稱"/>
                  <input inputMode="decimal" value={option.priceAdjustment} onChange={event=>optionCenter.updateChild(set.id,option.id,{priceAdjustment:event.target.value})} aria-label="選項價錢"/>
                  <Toggle checked={option.active} onChange={active=>optionCenter.updateChild(set.id,option.id,{active})} label={option.active?'啟用':'停用'}/>
                  <button type="button" onClick={()=>optionCenter.removeChild(set.id,option.id)}>刪除</button>
                </article>)}
              </div>}
            </section>

            <details className="admin-option-bulk-map">
              <summary><span><b>批量映射商品</b><small>全選／整個分類／分類內自選／跨分類自選</small></span><span>{linkedProducts} 件已選</span></summary>
              <div className="admin-option-bulk-body">
                <div className="admin-option-bulk-stats">
                  <article><span>已選商品</span><strong>{linkedProducts}</strong></article>
                  <article><span>原本已有</span><strong>{[...currentLinkedIds].filter(id=>savedLinkedIds.has(id)).length}</strong></article>
                  <article><span>今次新增</span><strong>{newlyAdded}</strong></article>
                  <article><span>今次移除</span><strong>{pendingRemoved}</strong></article>
                </div>

                <div className="admin-option-bulk-toolbar">
                  <TriStateCheckbox
                    checked={allChecked}
                    partial={allPartial}
                    onChange={next=>optionCenter.setProductSetLinksBulk(allProductIds,set.id,next)}
                    label={'全部商品（'+activeProducts.length+' 件啟用商品）'}
                  />
                  <input
                    value={mappingQueryBySet[set.id]??''}
                    onChange={event=>setMappingQueryBySet(current=>({...current,[set.id]:event.target.value}))}
                    placeholder="搜尋商品名稱／商品編號／條碼"
                  />
                </div>

                <div className="admin-callout compact">勾選分類會套用該分類目前全部啟用商品，不受搜尋結果限制。已存在嘅商品連結會保留原本默認選項；重覆勾選唔會建立第二條連結。</div>

                {activeProducts.length===0?<div className="admin-read-empty">目前冇啟用商品可以映射。</div>:<div className="admin-option-category-map">
                  {categoryRows.map(({category,products,visibleProducts})=>{
                    const ids=products.map(product=>product.id);
                    const checked=ids.length>0&&ids.every(id=>currentLinkedIds.has(id));
                    const partial=!checked&&ids.some(id=>currentLinkedIds.has(id));
                    return <section key={category.id}>
                      <header>
                        <TriStateCheckbox checked={checked} partial={partial} onChange={next=>optionCenter.setProductSetLinksBulk(ids,set.id,next)} label={category.name||category.id}/>
                        <small>{products.filter(product=>currentLinkedIds.has(product.id)).length}/{products.length} 已映射</small>
                      </header>
                      <div className="admin-option-product-map-grid">
                        {visibleProducts.map(product=><label key={product.id}>
                          <input type="checkbox" checked={currentLinkedIds.has(product.id)} onChange={event=>optionCenter.setProductSetLinksBulk([product.id],set.id,event.target.checked)}/>
                          <span><b>{product.name||product.id}</b><small>{product.productCode??product.id}</small></span>
                        </label>)}
                      </div>
                    </section>;
                  })}
                  {orphanProducts.length?<section>
                    <header><b>未分類／分類資料異常</b><small>{orphanProducts.length} 件</small></header>
                    <div className="admin-option-product-map-grid">{orphanProducts.map(product=><label key={product.id}>
                      <input type="checkbox" checked={currentLinkedIds.has(product.id)} onChange={event=>optionCenter.setProductSetLinksBulk([product.id],set.id,event.target.checked)}/>
                      <span><b>{product.name||product.id}</b><small>{product.productCode??product.id}</small></span>
                    </label>)}</div>
                  </section>:null}
                  {mappingToken&&categoryRows.length===0&&orphanProducts.length===0?<div className="admin-read-empty">搵唔到符合搜尋條件嘅商品。</div>:null}
                </div>}
              </div>
            </details>

            <div className="admin-editor-actions">
              <Toggle checked={set.active} onChange={active=>optionCenter.updateSet(set.id,{active})} label={set.active?'啟用選項組':'停用選項組'}/>
              <button type="button" disabled={linkedProducts>0} title={linkedProducts>0?'仍有商品使用呢個選項組':''} onClick={()=>optionCenter.removeSet(set.id)}>刪除選項組</button>
            </div>
          </div>
        </details>;
      })}
    </div>}
  </section>;
}

export function PricingWorkspace(){
  const {draft,updateProduct}=useAdminDraft();
  const optionCenter=useOptionSetCenter(draft);
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<'PRODUCT'|'OPTION'>('PRODUCT');
  const token=query.trim().toLowerCase();
  const productRows=useMemo(()=>draft.products.filter(product=>!token||[product.name,product.productCode].filter(Boolean).join(' ').toLowerCase().includes(token)),[draft.products,token]);
  const optionRows=optionCenter.sets.flatMap(set=>set.options.map(option=>({set,option}))).filter(({set,option})=>!token||(set.name+' '+option.name+' '+option.code).toLowerCase().includes(token));
  const productConfigured=draft.products.filter(product=>product.basePrice.trim()!=='').length;
  const optionConfigured=optionRows.filter(({option})=>option.priceAdjustment.trim()!=='').length;

  return <section className="admin-editor-page">
    <WorkspaceHeader title="價格管理" description="商品價同選項組內子選項價集中管理。子選項價屬於嗰個選項組，例如「多青瓜 +$1」；商品 Link 唔會複製一份價格。正式 Quote 仍由唯一 Pricing authority 計算。" optionCenterState={optionCenter.state} optionDirty={optionCenter.dirty} onOptionSaved={optionCenter.markClean}/>
    <div className="admin-kpi-grid">
      <article><span>商品價格</span><strong>{productConfigured}/{draft.products.length}</strong><small>基本價必填</small></article>
      <article><span>子選項價格</span><strong>{optionConfigured}/{optionRows.length}</strong><small>組內 Option</small></article>
      <article><span>外賣 +$1</span><strong>{draft.products.filter(product=>product.takeawaySurchargeEnabled).length}</strong><small>Product flag</small></article>
      <article><span>負數選項價</span><strong>{optionRows.filter(({option})=>Number(option.priceAdjustment)<0).length}</strong><small>支援減價</small></article>
    </div>
    <div className="admin-filterbar">
      <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={tab==='PRODUCT'?'搜尋商品':'搜尋選項組／子選項／ID'}/>
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
      <header><span>選項組</span><span>子選項</span><span>選項 ID</span><span>價錢 HK$</span></header>
      {optionRows.map(({set,option})=><article key={set.id+':'+option.id}>
        <span>{set.name}</span><b>{option.name}</b><code>{option.code}</code>
        <input inputMode="decimal" value={option.priceAdjustment} onChange={event=>optionCenter.updateChild(set.id,option.id,{priceAdjustment:event.target.value})} placeholder="0.00 / -1.00"/>
      </article>)}
    </div>}
  </section>;
}

export function CombosWorkspace(){
  const {
    draft,addCombo,updateCombo,removeCombo,
    addComboSection,updateComboSection,removeComboSection,moveComboSection,
    addComboBand,updateComboBand,removeComboBand,moveComboBand,
    addComboChoice,updateComboChoice,removeComboChoice,moveComboChoice,
  }=useAdminDraft();
  const optionCenter=useOptionSetCenter(draft);
  const productById=useMemo(()=>new Map(draft.products.map(product=>[product.id,product])),[draft.products]);

  return <section className="admin-editor-page">
    <WorkspaceHeader
      title="套餐"
      description="套餐係可編輯模板：先定步驟，再定價格帶，再引用正式商品。Combo 唔複製商品；商品本身嘅選項組會原樣繼承。"
      onAdd={addCombo}
      addLabel="新增套餐"
      optionCenterState={optionCenter.state}
      optionDirty={optionCenter.dirty}
      onOptionSaved={optionCenter.markClean}
    />

    <div className="admin-callout compact">目前已按你提供嘅「自選紫米套餐」海報建立第一個可編輯模板：飯糰 → 小食 → 飲品。海報只係初始資料，之後全部都可以改。</div>

    {draft.combos.length===0
      ?<EmptyState title="未有套餐" description="建立套餐後加入步驟，例如飯糰、小食、飲品，再為每步建立價格帶同商品選擇。" action="新增套餐" onAction={addCombo}/>
      :<div className="admin-combo-list">{draft.combos.map(combo=><article className="admin-combo-card" key={combo.id}>
        <header className="admin-combo-head">
          <div><small>{combo.id}</small><h2>{combo.name||'未命名套餐'}</h2><span>{combo.sections.length} 個步驟 · 基本價 HK${Number(combo.basePrice||0).toFixed(2)}</span></div>
          <div className="admin-editor-actions">
            <Toggle checked={combo.active} onChange={active=>updateCombo(combo.id,{active})} label={combo.active?'啟用':'停用'}/>
            <button type="button" onClick={()=>removeCombo(combo.id)}>刪除套餐</button>
          </div>
        </header>

        <div className="admin-form-grid three">
          <label><span>套餐名稱</span><input value={combo.name} onChange={event=>updateCombo(combo.id,{name:event.target.value})}/></label>
          <label><span>對應主商品（選填）</span><select value={combo.productId??''} onChange={event=>updateCombo(combo.id,{productId:event.target.value||undefined})}><option value="">未指定</option>{draft.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label><span>套餐基本價 HK$</span><input inputMode="decimal" value={combo.basePrice} onChange={event=>updateCombo(combo.id,{basePrice:event.target.value})}/></label>
          <Toggle checked={Boolean(combo.takeawaySurchargeEnabled)} onChange={takeawaySurchargeEnabled=>updateCombo(combo.id,{takeawaySurchargeEnabled})} label={combo.takeawaySurchargeEnabled?'整個套餐外賣 +$1':'套餐外賣 +$1 關'}/>
          <label><span>其他外賣調整 HK$</span><input inputMode="decimal" value={combo.takeawayAdjustment} onChange={event=>updateCombo(combo.id,{takeawayAdjustment:event.target.value})}/></label>
        </div>

        <section className="admin-sub-editor admin-combo-steps">
          <header><b>套餐步驟</b><button type="button" onClick={()=>addComboSection(combo.id)}>＋ 新增步驟</button></header>
          {combo.sections.length===0?<p>未有步驟。</p>:combo.sections.map((section,sectionIndex)=><article className="admin-combo-step" key={section.id}>
            <header>
              <div className="admin-combo-step-title">
                <span className="admin-combo-step-number">{String(sectionIndex+1).padStart(2,'0')}</span>
                <div><b>{section.name||section.id}</b><small>{section.choices.length} 個商品 · {section.bands.length} 個價格帶</small></div>
              </div>
              <div className="admin-editor-actions">
                <button type="button" disabled={sectionIndex===0} onClick={()=>moveComboSection(combo.id,section.id,-1)}>↑</button>
                <button type="button" disabled={sectionIndex===combo.sections.length-1} onClick={()=>moveComboSection(combo.id,section.id,1)}>↓</button>
                <button type="button" onClick={()=>removeComboSection(combo.id,section.id)}>刪除步驟</button>
              </div>
            </header>

            <div className="admin-form-grid four">
              <label><span>步驟名稱</span><input value={section.name} onChange={event=>updateComboSection(combo.id,section.id,{name:event.target.value})}/></label>
              <label><span>最少選擇</span><input type="number" min={0} value={section.min} onChange={event=>updateComboSection(combo.id,section.id,{min:Number(event.target.value)||0})}/></label>
              <label><span>最多選擇</span><input type="number" min={0} value={section.max} onChange={event=>updateComboSection(combo.id,section.id,{max:Number(event.target.value)||0})}/></label>
              <Toggle checked={section.required} onChange={required=>updateComboSection(combo.id,section.id,{required,min:required?Math.max(1,section.min):0})} label={section.required?'必選':'可選'}/>
            </div>

            <section className="admin-combo-band-editor">
              <header><div><b>價格帶</b><small>例如 Set A / +$3 / +$5；差價係相對套餐基本價。</small></div><button type="button" onClick={()=>addComboBand(combo.id,section.id)}>＋ 新增價格帶</button></header>
              {section.bands.length===0?<div className="admin-read-empty">未有價格帶；先建立至少一個價格帶先可以加入商品。</div>:<div className="admin-combo-band-list">
                {section.bands.map((band,bandIndex)=><article key={band.id}>
                  <div className="admin-option-order-buttons">
                    <button type="button" disabled={bandIndex===0} onClick={()=>moveComboBand(combo.id,section.id,band.id,-1)}>↑</button>
                    <button type="button" disabled={bandIndex===section.bands.length-1} onClick={()=>moveComboBand(combo.id,section.id,band.id,1)}>↓</button>
                  </div>
                  <input value={band.name} onChange={event=>updateComboBand(combo.id,section.id,band.id,{name:event.target.value})} aria-label="價格帶名稱"/>
                  <label><span>差價 HK$</span><input inputMode="decimal" value={band.priceAdjustment} onChange={event=>updateComboBand(combo.id,section.id,band.id,{priceAdjustment:event.target.value})}/></label>
                  <Toggle checked={band.active} onChange={active=>updateComboBand(combo.id,section.id,band.id,{active})} label={band.active?'啟用':'停用'}/>
                  <button type="button" disabled={section.choices.some(choice=>choice.bandId===band.id)} title={section.choices.some(choice=>choice.bandId===band.id)?'先移走呢個價格帶入面嘅商品':''} onClick={()=>removeComboBand(combo.id,section.id,band.id)}>刪除</button>
                </article>)}
              </div>}
            </section>

            <section className="admin-combo-choice-editor">
              <header><div><b>可選商品</b><small>引用正式 Product；商品本身選項組唔會被複製。</small></div><button type="button" disabled={section.bands.length===0} onClick={()=>addComboChoice(combo.id,section.id)}>＋ 新增商品</button></header>
              {section.choices.length===0?<div className="admin-read-empty">未有商品選擇。</div>:<div className="admin-combo-choice-list">
                {section.choices.map((choice,choiceIndex)=>{
                  const product=productById.get(choice.productId);
                  const inherited=projectOptionSetsForProduct(optionCenter.state,choice.productId);
                  return <article key={choice.id}>
                    <div className="admin-option-order-buttons">
                      <button type="button" disabled={choiceIndex===0} onClick={()=>moveComboChoice(combo.id,section.id,choice.id,-1)}>↑</button>
                      <button type="button" disabled={choiceIndex===section.choices.length-1} onClick={()=>moveComboChoice(combo.id,section.id,choice.id,1)}>↓</button>
                    </div>
                    <label><span>商品</span><select value={choice.productId} onChange={event=>updateComboChoice(combo.id,section.id,choice.id,{productId:event.target.value})}>{draft.products.filter(row=>row.active||row.id===choice.productId).map(row=><option key={row.id} value={row.id}>{row.name} · {row.productCode??row.id}</option>)}</select></label>
                    <label><span>價格帶</span><select value={choice.bandId} onChange={event=>updateComboChoice(combo.id,section.id,choice.id,{bandId:event.target.value})}>{section.bands.map(band=><option key={band.id} value={band.id}>{band.name} · {Number(band.priceAdjustment)>=0?'+':''}{Number(band.priceAdjustment).toFixed(2)}</option>)}</select></label>
                    <label><span>商品額外差價 HK$</span><input inputMode="decimal" value={choice.priceAdjustment} onChange={event=>updateComboChoice(combo.id,section.id,choice.id,{priceAdjustment:event.target.value})}/></label>
                    <div className="admin-combo-choice-inherit">
                      <b>{product?.name??choice.productId}</b>
                      <small>{inherited.length?('繼承 '+inherited.length+' 個商品選項組：'+inherited.map(set=>set.name).join('、')):'此商品目前冇已加入選項組'}</small>
                    </div>
                    <Toggle checked={choice.active} onChange={active=>updateComboChoice(combo.id,section.id,choice.id,{active})} label={choice.active?'啟用':'停用'}/>
                    <button type="button" onClick={()=>removeComboChoice(combo.id,section.id,choice.id)}>刪除</button>
                  </article>;
                })}
              </div>}
            </section>
          </article>)}
        </section>
      </article>)}</div>}
  </section>;
}

export function MenuDisplayWorkspace(){
  const {draft,moveCategory,moveProduct}=useAdminDraft();
  const optionCenter=useOptionSetCenter(draft);
  const categoryName=useMemo(()=>new Map(draft.categories.map(category=>[category.id,category.name||category.id])),[draft.categories]);
  return <section className="admin-editor-page">
    <WorkspaceHeader title="菜單／顯示排序" description="正式管理分類、商品顯示次序同商品已加入嘅選項組；選項資料直接讀取「選項中心」唯一資料來源。" optionCenterState={optionCenter.state} optionDirty={optionCenter.dirty} onOptionSaved={optionCenter.markClean}/>
    <div className="admin-sort-columns">
      <section><header><b>分類次序</b><span>{draft.categories.length}</span></header>{draft.categories.map((category,index)=><article key={category.id}><span><b>{index+1}. {category.name||category.id}</b><small>{category.active?'啟用':'停用'}</small></span><div><button disabled={index===0} onClick={()=>moveCategory(category.id,-1)}>↑</button><button disabled={index===draft.categories.length-1} onClick={()=>moveCategory(category.id,1)}>↓</button></div></article>)}</section>
      <section><header><b>商品次序／選項</b><span>{draft.products.length}</span></header>{draft.products.map((product,index)=>{
        const optionSets=projectOptionSetsForProduct(optionCenter.state,product.id);
        return <article key={product.id} className="admin-menu-product-projection">
          <span>
            <b>{index+1}. {product.name||product.id}</b>
            <small>{categoryName.get(product.categoryId)??'未分類'} · {product.active?'啟用':'停用'} · {optionSets.length} 個選項組</small>
            {optionSets.length?<div className="admin-menu-option-projection">{optionSets.map(set=><div key={set.id}>
              <strong>{set.name}</strong>
              <small>{set.required?'必選':set.forceShow?'可選但必須顯示':'可選'} · {set.selection==='SINGLE'?'單選':'多選'} · 最少 {set.min}／最多 {set.max}</small>
              <div>{set.options.map(option=><span key={option.id}><code>{option.code}</code> {option.name} {Number(option.priceAdjustment)>=0?'+':''}{Number(option.priceAdjustment).toFixed(2)}{option.defaultSelected?' · 默認':''}</span>)}</div>
            </div>)}</div>:null}
          </span>
          <div><button disabled={index===0} onClick={()=>moveProduct(product.id,-1)}>↑</button><button disabled={index===draft.products.length-1} onClick={()=>moveProduct(product.id,1)}>↓</button></div>
        </article>;
      })}</section>
    </div>
  </section>;
}
