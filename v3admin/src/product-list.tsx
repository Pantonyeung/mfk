import {useMemo,useState,type KeyboardEvent} from 'react';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {productMediaPreviewEnabled,uploadPreviewProductMedia,PRODUCT_MEDIA_STORAGE_POLICY,type ProductMediaSurface} from './product-media-api.ts';
import {
  usePreviewCatalog,
  type PreviewProduct,
} from './preview-catalog-store.ts';
import {DraftBar,PageHeader,StatusBadge} from './ui.tsx';
import {usePreviewAdmin} from './preview-admin-store.ts';

type RowObject=Record<string,unknown>;

export type ProductListRecord={
  id:string;
  name:string;
  code:string;
  category:string;
  priceMinor:number;
  status:'已發佈'|'草稿'|'待回讀'|'已停用'|'資料過期'|'結果未明';
  printRule:string;
  updatedAt:string;
  imageUrl?:string;
  optionSetCount?:number;
  comboCount?:number;
  printDestinationNames?:Partial<Record<ProductPrintTarget,readonly string[]>>;
  printTemplateNames?:Partial<Record<ProductPrintTarget,string>>;
};

const STATUS_OPTIONS=['全部','已發佈','草稿','待回讀','已停用'] as const;
export const MOBILE_PRODUCT_PAGE_SIZE=10;

export type ProductPrintTarget='PRODUCTION'|'PACKING'|'LABEL'|'RECEIPT';

export const PRODUCT_PRINT_TARGET_OPTIONS=Object.freeze([
  {id:'PRODUCTION' as const,label:'製作單',description:'廚房／製作位需要收到嘅商品製作資料。'},
  {id:'PACKING' as const,label:'打包單',description:'執單／打包位需要收到嘅商品資料。'},
  {id:'LABEL' as const,label:'標籤',description:'需要逐件貼標籤嘅商品。'},
  {id:'RECEIPT' as const,label:'小票',description:'需要喺小票輸出呢件商品。'},
]);

export function productPrintTargetsFromRule(rule:string):ProductPrintTarget[]{
  const text=String(rule||'').trim().toLocaleLowerCase();
  const targets:ProductPrintTarget[]=[];
  if(text.includes('製作單')||text.includes('production'))targets.push('PRODUCTION');
  if(text.includes('打包單')||text.includes('packing'))targets.push('PACKING');
  if(text.includes('標籤')||text.includes('label'))targets.push('LABEL');
  if(text.includes('小票')||text.includes('收據')||text.includes('receipt'))targets.push('RECEIPT');
  return targets;
}

export function productPrintSummary(targets:readonly ProductPrintTarget[]){
  const selected=new Set(targets);
  const labels=PRODUCT_PRINT_TARGET_OPTIONS.filter(option=>selected.has(option.id)).map(option=>option.label);
  return labels.length?labels.join('＋'):'不打印';
}

export function productPrintConfigCanSave(
  targets:readonly ProductPrintTarget[],
  destinationIds:Partial<Record<ProductPrintTarget,readonly string[]>>,
  templateIds:Partial<Record<ProductPrintTarget,string>>={},
){
  return targets.every(target=>(destinationIds[target]?.length??0)>0&&Boolean(templateIds[target]));
}


export function productFormCanSave(input:{name:string;category:string;price:string}){
  const priceNumber=Number(input.price);
  return Boolean(input.name.trim()&&input.category&&input.category!=='全部'&&input.price.trim()&&Number.isFinite(priceNumber)&&priceNumber>=0);
}

function row(value:unknown):RowObject{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as RowObject:{};
}
function rows(value:unknown){return Array.isArray(value)?value:[];}
function textValue(...values:unknown[]){
  for(const value of values){if(typeof value==='string'&&value.trim())return value.trim();}
  return '';
}
function numberValue(...values:unknown[]){
  for(const value of values){const n=Number(value);if(Number.isFinite(n))return n;}
  return 0;
}
function money(minor:number){
  const value=Math.max(0,minor)/100;
  return 'HK$'+(Number.isInteger(value)?String(value):value.toFixed(2));
}
function humanStatus(product:RowObject):ProductListRecord['status']{
  const raw=textValue(product.status,product.publishState,product.state).toUpperCase();
  if(product.enabled===false||product.active===false||['DISABLED','INACTIVE','ARCHIVED'].includes(raw))return '已停用';
  if(['DRAFT','SAVED_DRAFT'].includes(raw))return '草稿';
  if(['PENDING','PENDING_READBACK','PUBLISHED_PENDING_ACK'].includes(raw))return '待回讀';
  if(['STALE'].includes(raw))return '資料過期';
  if(['UNKNOWN'].includes(raw))return '結果未明';
  return '已發佈';
}
function statusTone(status:ProductListRecord['status']){
  if(status==='已發佈')return 'good' as const;
  if(status==='已停用')return 'neutral' as const;
  if(status==='結果未明'||status==='資料過期')return 'unknown' as const;
  return 'warning' as const;
}
function productPriceMinor(product:RowObject){
  if(product.priceMinor!==undefined)return Math.round(numberValue(product.priceMinor));
  if(product.basePriceMinor!==undefined)return Math.round(numberValue(product.basePriceMinor));
  return Math.round(numberValue(product.price,product.basePrice,product.unitPrice)*100);
}
function categoryLookup(snapshot:RowObject){
  const catalog=row(snapshot.catalog);
  return new Map(rows(catalog.categories).map(raw=>{
    const category=row(raw);
    const id=textValue(category.id,category.categoryId,category.code);
    const name=textValue(category.name,category.title,category.label,id);
    return [id,name] as const;
  }));
}
export function productRecordsFromSnapshot(snapshot:unknown):ProductListRecord[]{
  const root=row(snapshot);
  const catalog=row(root.catalog);
  const categories=categoryLookup(root);
  const mediaByProduct=row(root.productMedia);
  return rows(catalog.products).map((raw,index)=>{
    const product=row(raw);
    const id=textValue(product.id,product.productId,product.code,product.productCode)||'product-'+String(index+1);
    const categoryId=textValue(product.categoryId,product.category,product.categoryCode);
    const category=categories.get(categoryId)||textValue(product.categoryName,product.categoryLabel,categoryId)||'未分類';
    const print=row(product.printSettings??product.printRule);
    const media=row(mediaByProduct[id]);
    const updated=textValue(product.updatedAt,product.modifiedAt,product.createdAt);
    return{
      id,
      name:textValue(product.name,product.productName,product.displayName,product.title)||'未命名商品',
      code:textValue(product.productCode,product.code,product.sku,id),
      category,
      priceMinor:productPriceMinor(product),
      status:humanStatus(product),
      printRule:print.label===true?'標籤':print.production===true?'製作單':textValue(product.printLabel,product.printDestination)||'跟隨打印規則',
      updatedAt:updated?new Date(updated).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):'—',
      imageUrl:textValue(media.publicUrl,media.customerImageUrl,product.imageRef)||undefined,
    };
  });
}

function previewRecord(product:PreviewProduct,comboCount:number,printDestinationNames:Partial<Record<ProductPrintTarget,readonly string[]>>,printTemplateNames:Partial<Record<ProductPrintTarget,string>>):ProductListRecord{
  return{
    id:product.id,
    name:product.name,
    code:product.code,
    category:product.category,
    priceMinor:product.priceMinor,
    status:product.status,
    printRule:product.printRule,
    updatedAt:product.updatedAt,
    imageUrl:product.customerImageUrl||undefined,
    optionSetCount:product.optionSetIds.length,
    comboCount,
    printDestinationNames,
    printTemplateNames,
  };
}

function ProductThumb({name,imageUrl}:{name:string;imageUrl?:string}){
  if(imageUrl)return <div className="v3-product-thumb has-image"><img src={imageUrl} alt=""/></div>;
  const mark=name.replace(/[・\s]/g,'').slice(0,2)||'品';
  return <div className="v3-product-thumb" aria-hidden="true">{mark}</div>;
}

function ProductDrawer({product,onClose}:{product:ProductListRecord;onClose:()=>void}){
  return <><button type="button" className="v3-product-drawer-backdrop" aria-label="關閉產品詳情" onClick={onClose}/>
    <aside className="v3-product-drawer" aria-label="產品詳情">
      <div className="v3-product-drawer-head"><div><small>產品詳情</small><h2>{product.name}</h2></div><button type="button" onClick={onClose}>關閉</button></div>
      <dl>
        <div><dt>商品編號</dt><dd>{product.code}<small>系統自動生成，不可手動修改</small></dd></div>
        <div><dt>分類</dt><dd>{product.category}</dd></div>
        <div><dt>基本價格</dt><dd>{money(product.priceMinor)}</dd></div>
        <div><dt>狀態</dt><dd><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></dd></div>
        <div><dt>圖片</dt><dd>{product.imageUrl?'已設定':'未設定'}</dd></div><div><dt>打印</dt><dd>{product.printRule||'不打印'}{product.printDestinationNames?PRODUCT_PRINT_TARGET_OPTIONS.filter(option=>(product.printDestinationNames?.[option.id]?.length??0)>0).map(option=><small key={option.id}>{option.label} → {product.printDestinationNames?.[option.id]?.join('、')}{product.printTemplateNames?.[option.id]?' · '+product.printTemplateNames?.[option.id]:''}</small>):null}</dd></div>
      </dl>
    </aside>
  </>;
}

function r2RefFromUrl(value:string){
  try{return new URL(value).searchParams.get('ref')??'';}catch{return '';}
}

function ProductMediaField({
  label,
  description,
  value,
  productId,
  surface,
  onUploaded,
}:{
  label:string;
  description:string;
  value:string;
  productId:string;
  surface:ProductMediaSurface;
  onUploaded:(url:string)=>void;
}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const enabled=productMediaPreviewEnabled();
  const upload=async(file:File)=>{
    setBusy(true);setError('');
    try{
      const result=await uploadPreviewProductMedia({productId,surface,file});
      onUploaded(result.mediaUrl);
    }catch(error){
      setError(error instanceof Error?error.message:'圖片上載失敗');
    }finally{setBusy(false);}
  };
  return <section className="v3-r2-media-field">
    <header><div><strong>{label}</strong><small>{description}</small></div><StatusBadge tone={value?'good':enabled?'neutral':'warning'}>{value?'R2 已有圖片':enabled?'未設定':'入口已開 · R2 待接通'}</StatusBadge></header>
    <div className="v3-r2-media-body">
      <div className="v3-r2-media-preview">{value?<img src={value} alt={label}/>:<span>未有圖片</span>}</div>
      <div className="v3-r2-media-actions">
        <label className={"v3-r2-upload-button"+(!enabled?" is-disabled":"")}><span>{!enabled?'R2 待認收後接通':busy?'上載中…':value?'更換圖片':'上載圖片'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy||!enabled} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.currentTarget.value='';}}/></label>
        {value?<><small>R2 Object</small><code>{r2RefFromUrl(value)||'R2 media ref'}</code></>:null}
        {error?<div className="v3-error" role="alert">{error}</div>:null}
      </div>
    </div>
  </section>;
}

function PreviewProductEditor({productId,onClose}:{productId:string|null;onClose:()=>void}){
  const product=usePreviewCatalog(state=>productId?state.products.find(item=>item.id===productId):undefined);
  const categories=usePreviewCatalog(state=>state.categories);
  const optionSets=usePreviewCatalog(state=>state.optionSets);
  const combos=usePreviewCatalog(state=>state.combos);
  const createProduct=usePreviewCatalog(state=>state.createProduct);
  const updateProduct=usePreviewCatalog(state=>state.updateProduct);
  const logicalPrinters=usePreviewAdmin(state=>state.printers);
  const printTemplates=usePreviewAdmin(state=>state.templates);
  const activePrinters=logicalPrinters.filter(printer=>printer.active);
  const activeTemplates=printTemplates.filter(template=>template.active);
  const [draftId]=useState(()=>product?.id??'draft-'+crypto.randomUUID());
  const [name,setName]=useState(product?.name??'');
  const [category,setCategory]=useState(product?.category??categories.find(item=>item.active)?.name??'');
  const [price,setPrice]=useState(product?String(product.priceMinor/100):'');
  const [active,setActive]=useState(product?.status!=='已停用');
  const [description,setDescription]=useState(product?.description??'');
  const [printTargets,setPrintTargets]=useState<Set<ProductPrintTarget>>(()=>new Set(productPrintTargetsFromRule(product?.printRule??'製作單')));
  const [printDestinationIds,setPrintDestinationIds]=useState<Record<ProductPrintTarget,Set<string>>>(()=>({
    PRODUCTION:new Set(product?.printDestinationIds.PRODUCTION??[]),
    PACKING:new Set(product?.printDestinationIds.PACKING??[]),
    LABEL:new Set(product?.printDestinationIds.LABEL??[]),
    RECEIPT:new Set(product?.printDestinationIds.RECEIPT??[]),
  }));
  const [printTemplateIds,setPrintTemplateIds]=useState<Partial<Record<ProductPrintTarget,string>>>(()=>({...product?.printTemplateIds}));
  const [customerImage,setCustomerImage]=useState(product?.customerImageUrl??'');
  const [keetaImage,setKeetaImage]=useState(product?.channelImages.KEETA??'');
  const [optionIds,setOptionIds]=useState<Set<string>>(new Set(product?.optionSetIds??[]));
  const destinationSnapshot:Partial<Record<ProductPrintTarget,readonly string[]>>={
    PRODUCTION:[...printDestinationIds.PRODUCTION],
    PACKING:[...printDestinationIds.PACKING],
    LABEL:[...printDestinationIds.LABEL],
    RECEIPT:[...printDestinationIds.RECEIPT],
  };
  const valid=productFormCanSave({name,category,price})&&productPrintConfigCanSave([...printTargets],destinationSnapshot,printTemplateIds);
  const editing=Boolean(product);

  const relatedCombos=combos.filter(combo=>combo.groups.some(group=>group.choices.some(choice=>choice.productId===product?.id)));
  const save=()=>{
    if(!valid)return;
    const base={
      name:name.trim(),
      category,
      priceMinor:Math.round(Number(price)*100),
      description:description.trim(),
      customerImageUrl:customerImage,
      channelImages:{KEETA:keetaImage},
      optionSetIds:[...optionIds],
      printRule:productPrintSummary([...printTargets]),
      printDestinationIds:{
        PRODUCTION:printTargets.has('PRODUCTION')?[...printDestinationIds.PRODUCTION]:[],
        PACKING:printTargets.has('PACKING')?[...printDestinationIds.PACKING]:[],
        LABEL:printTargets.has('LABEL')?[...printDestinationIds.LABEL]:[],
        RECEIPT:printTargets.has('RECEIPT')?[...printDestinationIds.RECEIPT]:[],
      },
      printTemplateIds:Object.fromEntries([...printTargets].map(target=>[target,printTemplateIds[target]]).filter(([,value])=>Boolean(value))) as Partial<Record<ProductPrintTarget,string>>,
    };
    if(product){
      updateProduct(product.id,{...base,status:active?'草稿':'已停用'});
    }else{
      const created=createProduct({
        id:draftId,
        ...base,
      });
      if(!active)updateProduct(created.id,{status:'已停用'});
    }
    onClose();
  };

  return <div className="v3-functional-editor v3-product-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>{editing?'編輯商品':'新增商品'}</small><h2>{editing?product?.name:'新增商品'}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <h3>基本資料</h3>
          <div className="v3-functional-grid">
            <label><span>商品名稱 *</span><input autoFocus value={name} onChange={event=>setName(event.target.value)} placeholder="輸入商品名稱"/></label>
            <label><span>商品編號</span><input value={product?.code??'儲存後由系統自動生成'} disabled/></label>
            <label><span>分類 *</span><select value={category} onChange={event=>setCategory(event.target.value)}>{categories.filter(item=>item.active||item.name===category).sort((a,b)=>a.sortOrder-b.sortOrder).map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
            <label><span>基本價格 *</span><div className="v3-money-input"><b>HK$</b><input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value.replace(/[^0-9.]/g,''))}/></div></label>
          </div>
          <label><span>商品描述</span><textarea rows={3} value={description} onChange={event=>setDescription(event.target.value)}/></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/><span>{active?'啟用商品':'停用商品'}</span></label>
        </section>

        <section className="v3-functional-section">
          <header><div><h3>圖片／媒體</h3><p>所有產品圖片 binary 一律放 Cloudflare R2；唔接受外部 URL 做正式圖片 authority。</p></div><StatusBadge tone="good">R2 ONLY</StatusBadge></header>
          <div className="v3-r2-media-grid">
            <ProductMediaField label="自家／Customer 顯示圖" description="Customer、SMM 等自家介面預設使用。" value={customerImage} productId={draftId} surface="CUSTOMER" onUploaded={setCustomerImage}/>
            <ProductMediaField label="Keeta 平台圖" description="第三方平台獨立圖片，可同自家顯示圖不同。" value={keetaImage} productId={draftId} surface="KEETA" onUploaded={setKeetaImage}/>
          </div>
          <small>Storage Policy：{PRODUCT_MEDIA_STORAGE_POLICY.binaryStore} · 入口已建立 · R2 正式接通延後至 Admin 認收後 · Browser 無 R2 credential · 最高 8MB</small>
        </section>

        <section className="v3-functional-section">
          <h3>選項／口味</h3>
          <p>直接將已建立嘅選項組套用到呢件商品。</p>
          <div className="v3-option-link-grid">{optionSets.map(set=><label key={set.id}>
            <input type="checkbox" checked={optionIds.has(set.id)} onChange={event=>setOptionIds(current=>{const next=new Set(current);if(event.target.checked)next.add(set.id);else next.delete(set.id);return next;})}/>
            <span><strong>{set.name}</strong><small>{set.selection==='SINGLE'?'單選':'多選'} · {set.options.length} 個子選項 · 最少 {set.min}／最多 {set.max}</small></span>
          </label>)}</div>
        </section>

        <section className="v3-functional-section">
          <h3>套餐關係</h3>
          {relatedCombos.length?<div className="v3-related-combos">{relatedCombos.map(combo=><div key={combo.id}><strong>{combo.name}</strong><span>{money(combo.basePriceMinor)}</span></div>)}</div>:<p>目前未有套餐引用呢件商品。可去「套餐管理」加入。</p>}
        </section>

        <section className="v3-functional-section">
          <h3>打印</h3>
          <p>可多選。剔中邊啲，呢件商品就會出邊啲；唔再限制只能揀一個組合。</p>
          <div className="v3-option-link-grid">
            {PRODUCT_PRINT_TARGET_OPTIONS.map(option=><label key={option.id}>
              <input
                type="checkbox"
                checked={printTargets.has(option.id)}
                onChange={event=>{
                  const enabled=event.target.checked;
                  setPrintTargets(current=>{
                    const next=new Set(current);
                    if(enabled)next.add(option.id);else next.delete(option.id);
                    return next;
                  });
                  if(enabled){
                    const matches=activePrinters.filter(printer=>printer.type===option.id);
                    if(matches.length===1&&printDestinationIds[option.id].size===0){
                      setPrintDestinationIds(current=>({...current,[option.id]:new Set([matches[0].id])}));
                    }
                    const templates=activeTemplates.filter(template=>template.type===option.id);
                    if(templates.length===1&&!printTemplateIds[option.id]){
                      setPrintTemplateIds(current=>({...current,[option.id]:templates[0].id}));
                    }
                  }
                }}
              />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>)}
          </div>
          {[...printTargets].map(target=>{
            const option=PRODUCT_PRINT_TARGET_OPTIONS.find(item=>item.id===target);
            const printers=activePrinters.filter(printer=>printer.type===target);
            const selected=printDestinationIds[target];
            return <div className="v3-label-printer-routing" key={target}>
              <div><strong>{option?.label} 目的地 *</strong><small>名稱同邏輯用途由 Admin 設定；實際實體機／IP 由現場 SMT 配對。可以選一部或者多部。</small></div>
              <div className="v3-option-link-grid">
                {printers.map(printer=><label key={printer.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(printer.id)}
                    onChange={event=>setPrintDestinationIds(current=>{
                      const next=new Set(current[target]);
                      if(event.target.checked)next.add(printer.id);else next.delete(printer.id);
                      return {...current,[target]:next};
                    })}
                  />
                  <span><strong>{printer.name}</strong><small>{printer.id} · Logical {printer.type} · {printer.widthMm}mm</small></span>
                </label>)}
              </div>
              {!printers.length?<div className="v3-error">未有啟用中嘅 {option?.label} Logical Printer；請先去「打印管理 → 邏輯打印機」建立。</div>:null}
              {printers.length>0&&!selected.size?<div className="v3-error">已選「{option?.label}」，必須最少指定一個 Logical Printer 先可以儲存。</div>:null}
              <label className="v3-print-template-select"><span>{option?.label} Template *</span><select value={printTemplateIds[target]??''} onChange={event=>setPrintTemplateIds(current=>({...current,[target]:event.target.value}))}><option value="">請選擇 Template</option>{activeTemplates.filter(template=>template.type===target).map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              {!activeTemplates.some(template=>template.type===target)?<div className="v3-error">未有啟用中嘅 {option?.label} Template；請先去「打印管理 → 打印模板」建立。</div>:null}
              {activeTemplates.some(template=>template.type===target)&&!printTemplateIds[target]?<div className="v3-error">已選「{option?.label}」，必須指定 Template 先可以儲存。</div>:null}
            </div>;
          })}
          <div className="v3-mobile-form-note">
            目前會輸出：{productPrintSummary([...printTargets])}
            {[...printTargets].map(target=>{
              const option=PRODUCT_PRINT_TARGET_OPTIONS.find(item=>item.id===target);
              const names=activePrinters.filter(printer=>printDestinationIds[target].has(printer.id)).map(printer=>printer.name);
              const templateName=activeTemplates.find(template=>template.id===printTemplateIds[target])?.name;
              return names.length?<span key={target}> · {option?.label} → {names.join('、')}{templateName?' · '+templateName:''}</span>:null;
            })}
          </div>
        </section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={!valid} onClick={save}>儲存草稿</button></footer>
    </section>
  </div>;
}

function isMobileViewport(){
  return typeof window!=='undefined'&&window.matchMedia('(max-width: 767px)').matches;
}

export function ProductListPage({canonicalSnapshot,previewMode=false,onReviewDraft}:{canonicalSnapshot?:unknown;previewMode?:boolean;onReviewDraft?:()=>void}){
  const canonicalRows=useMemo(()=>productRecordsFromSnapshot(canonicalSnapshot),[canonicalSnapshot]);
  const previewProducts=usePreviewCatalog(state=>state.products);
  const previewCategories=usePreviewCatalog(state=>state.categories);
  const combos=usePreviewCatalog(state=>state.combos);
  const logicalPrinters=usePreviewAdmin(state=>state.printers);
  const printTemplates=usePreviewAdmin(state=>state.templates);
  const printerNameById=useMemo(()=>new Map(logicalPrinters.map(printer=>[printer.id,printer.name])),[logicalPrinters]);
  const templateNameById=useMemo(()=>new Map(printTemplates.map(template=>[template.id,template.name])),[printTemplates]);
  const previewRows=useMemo(()=>previewProducts.map(product=>{
    const names:Partial<Record<ProductPrintTarget,readonly string[]>>={
      PRODUCTION:product.printDestinationIds.PRODUCTION.map(id=>printerNameById.get(id)??id),
      PACKING:product.printDestinationIds.PACKING.map(id=>printerNameById.get(id)??id),
      LABEL:product.printDestinationIds.LABEL.map(id=>printerNameById.get(id)??id),
      RECEIPT:product.printDestinationIds.RECEIPT.map(id=>printerNameById.get(id)??id),
    };
    const templateNames:Partial<Record<ProductPrintTarget,string>>={
      PRODUCTION:product.printTemplateIds.PRODUCTION?templateNameById.get(product.printTemplateIds.PRODUCTION)??product.printTemplateIds.PRODUCTION:undefined,
      PACKING:product.printTemplateIds.PACKING?templateNameById.get(product.printTemplateIds.PACKING)??product.printTemplateIds.PACKING:undefined,
      LABEL:product.printTemplateIds.LABEL?templateNameById.get(product.printTemplateIds.LABEL)??product.printTemplateIds.LABEL:undefined,
      RECEIPT:product.printTemplateIds.RECEIPT?templateNameById.get(product.printTemplateIds.RECEIPT)??product.printTemplateIds.RECEIPT:undefined,
    };
    return previewRecord(product,combos.filter(combo=>combo.groups.some(group=>group.choices.some(choice=>choice.productId===product.id))).length,names,templateNames);
  }),[previewProducts,combos,printerNameById,templateNameById]);
  const sourceRows=previewMode?previewRows:canonicalRows;

  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('全部');
  const [status,setStatus]=useState('全部');
  const [sort,setSort]=useState('updated');
  const [view,setView]=useState<'list'|'grid'>('list');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [openProduct,setOpenProduct]=useState<ProductListRecord|null>(null);
  const [previewEditorId,setPreviewEditorId]=useState<string|null|undefined>(undefined);

  const categoryOptions=useMemo(()=>{
    if(previewMode)return ['全部',...previewCategories.filter(item=>item.active).sort((a,b)=>a.sortOrder-b.sortOrder).map(item=>item.name)];
    const values=[...new Set(sourceRows.map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-HK'));
    return ['全部',...values];
  },[previewMode,previewCategories,sourceRows]);

  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase();
    const list=sourceRows.filter(item=>{
      const queryMatch=!needle||[item.name,item.code,item.category].some(value=>value.toLocaleLowerCase().includes(needle));
      const categoryMatch=category==='全部'||item.category===category;
      const statusMatch=status==='全部'||item.status===status;
      return queryMatch&&categoryMatch&&statusMatch;
    });
    return [...list].sort((a,b)=>{
      if(sort==='name')return a.name.localeCompare(b.name,'zh-HK');
      if(sort==='price-low')return a.priceMinor-b.priceMinor;
      if(sort==='price-high')return b.priceMinor-a.priceMinor;
      return b.updatedAt.localeCompare(a.updatedAt,'zh-HK');
    });
  },[sourceRows,query,category,status,sort]);

  const openDetail=(product:ProductListRecord)=>{
    if(previewMode){setPreviewEditorId(product.id);return;}
    setOpenProduct(product);
  };
  const openFromKeyboard=(event:KeyboardEvent<HTMLElement>,product:ProductListRecord)=>{
    if(event.key==='Enter'){event.preventDefault();openDetail(product);}
  };
  const toggleSelection=(id:string)=>{
    setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  };

  return <div className="v3-product-page">
    {previewMode?<div className="v3-preview-banner" role="status"><strong>產品管理已接實際 Preview State</strong><span>圖片入口已建立，產品圖正式只會存 R2；目前 R2 連線按驗收 Gate 暫未啟用。產品／選項／套餐修改會喺 Preview session 即時互相反映。</span></div>:null}
    <PageHeader
      eyebrow="菜單管理"
      title="產品管理"
      description="Desktop 保留完整列表；手機版按分類收納，每頁最多 10 件商品。"
      aside={<><span className="v3-product-count">{filtered.length} / {sourceRows.length} 項商品</span><button className="v3-primary" type="button" disabled={!previewMode} onClick={()=>setPreviewEditorId(null)}>＋ 新增產品</button></>}
    />

    <section className="v3-product-toolbar" aria-label="產品搜尋與篩選">
      <div className="v3-product-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱、商品編號、關鍵字"/></div>
      <div className="v3-product-selects">
        <label><span>狀態</span><select value={status} onChange={event=>setStatus(event.target.value)}>{STATUS_OPTIONS.map(option=><option key={option}>{option}</option>)}</select></label>
        <label><span>排序</span><select value={sort} onChange={event=>setSort(event.target.value)}><option value="updated">最近更新</option><option value="name">商品名稱</option><option value="price-low">價格：低至高</option><option value="price-high">價格：高至低</option></select></label>
        <div className="v3-view-toggle" aria-label="顯示方式"><button type="button" aria-pressed={view==='list'} className={view==='list'?'is-active':''} onClick={()=>setView('list')}>列表</button><button type="button" aria-pressed={view==='grid'} className={view==='grid'?'is-active':''} onClick={()=>setView('grid')}>卡片</button></div>
      </div>
    </section>

    <div className="v3-category-chips" aria-label="分類快捷篩選">
      {categoryOptions.map(option=><button key={option} type="button" className={category===option?'is-active':''} aria-pressed={category===option} onClick={()=>setCategory(option)}>{option}</button>)}
    </div>

    {filtered.length===0?<section className="v3-product-empty"><h2>目前未有符合條件嘅商品</h2><p>試下清除搜尋，或者切返「全部」分類／狀態。</p><button type="button" onClick={()=>{setQuery('');setCategory('全部');setStatus('全部');}}>清除篩選</button></section>:
      <>
        <div className="v3-product-desktop-content">
          {view==='grid'?<div className="v3-product-grid">{filtered.map(product=><article key={product.id} className="v3-product-card" tabIndex={0} onKeyDown={event=>openFromKeyboard(event,product)} onClick={()=>openDetail(product)}>
            <div className="v3-product-card-top"><ProductThumb name={product.name} imageUrl={product.imageUrl}/><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></div>
            <h3>{product.name}</h3><p>{product.category} · {product.code}</p><strong>{money(product.priceMinor)}</strong><small>{product.optionSetCount??0} 個選項組 · {product.comboCount??0} 個套餐</small>
          </article>)}</div>:
          <div className="v3-product-table-wrap"><table className="v3-product-table"><thead><tr><th className="v3-select-col"><span className="v3-visually-hidden">選擇</span></th><th>商品</th><th>商品編號</th><th>分類</th><th>基本價格</th><th>狀態</th><th>選項／套餐</th><th>最近更新</th><th><span className="v3-visually-hidden">操作</span></th></tr></thead>
            <tbody>{filtered.map(product=><tr key={product.id} tabIndex={0} onKeyDown={event=>openFromKeyboard(event,product)} onClick={()=>openDetail(product)}>
              <td className="v3-select-col"><input type="checkbox" aria-label={'選擇 '+product.name} checked={selected.has(product.id)} onClick={event=>event.stopPropagation()} onChange={()=>toggleSelection(product.id)}/></td>
              <td><div className="v3-product-identity"><ProductThumb name={product.name} imageUrl={product.imageUrl}/><div><strong>{product.name}</strong><small>點擊即編輯</small></div></div></td>
              <td><code>{product.code}</code></td><td>{product.category}</td><td className="v3-money">{money(product.priceMinor)}</td><td><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></td><td>{product.optionSetCount??0} 選項組 · {product.comboCount??0} 套餐</td><td>{product.updatedAt}</td>
              <td><button type="button" className="v3-row-more" aria-label={product.name+' 其他操作'} onClick={event=>event.stopPropagation()}>•••</button></td>
            </tr>)}</tbody></table></div>}
        </div>

        <div className="v3-product-mobile-groups">
          <MobileGroupedPager
            items={filtered.map(product=>({...product,group:product.category}))}
            pageSize={MOBILE_PRODUCT_PAGE_SIZE}
            emptyLabel="目前未有商品"
            renderItem={product=><article key={product.id} className="v3-product-mobile-card" tabIndex={0} onKeyDown={event=>openFromKeyboard(event,product)} onClick={()=>openDetail(product)}>
              <ProductThumb name={product.name} imageUrl={product.imageUrl}/>
              <div className="v3-product-mobile-main">
                <div><strong>{product.name}</strong><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></div>
                <span>{product.code} · {product.optionSetCount??0} 選項組</span>
                <footer><b>{money(product.priceMinor)}</b><small>{product.updatedAt}</small></footer>
              </div>
            </article>}
          />
        </div>
      </>}

    {selected.size?<div className="v3-selection-bar" role="status"><strong>已選 {selected.size} 項</strong><span>批量操作會喺對應功能正式接入後啟用。</span><button type="button" onClick={()=>setSelected(new Set())}>取消選取</button></div>:null}
    {previewMode?<DraftBar count={4} onReview={onReviewDraft??(()=>{})}/>:null}
    {openProduct?<ProductDrawer product={openProduct} onClose={()=>setOpenProduct(null)}/>:null}
    {previewMode&&previewEditorId!==undefined?<PreviewProductEditor productId={previewEditorId} onClose={()=>setPreviewEditorId(undefined)}/>:null}
  </div>;
}
