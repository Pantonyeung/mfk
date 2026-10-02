import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';

import {
  createMfpOrderingDomain,
  type MfpComboSelectionInput,
  type MfpOrderingCatalog,
  type MfpOrderingDomain,
  type MfpOrderingDraft,
  type MfpOrderingDraftLine,
  type MfpOrderingProduct,
  type MfpOrderingSurface,
  type MfpProductSelectionInput,
} from './ordering-domain.ts';
import {
  DEFAULT_MFP_DISPLAY_SETTINGS,
  loadMfpDisplaySettings,
  mfpDisplaySettingsStyle,
  saveMfpDisplaySettings,
} from './ordering-owner-closure.ts';
import {
  MfpCartDraft,
  MfpDisplaySettingsPanel,
  MfpFastLanes,
  MfpShellNavigation,
  MfpSilentGuidance,
} from './ordering-owner-workspaces.tsx';
import {isMfpFrontlineSessionEligible,type MfpSecurityPort} from './security-port.ts';
import type {MfpSyncSnapshot} from './sync-port.ts';

const money=new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'});
const formatMoney=(minor:number|null)=>minor===null?'未有已發布價錢':money.format(minor/100);

type Editor=
  |Readonly<{kind:'product';productId:string;lineId?:string}>
  |Readonly<{kind:'combo';comboId:string;lineId?:string}>
  |null;

function freshness(snapshot:MfpSyncSnapshot){
  if(snapshot.state==='OFFLINE')return 'OFFLINE / LOCAL_LKG';
  if(snapshot.state==='LOCAL_LKG')return 'LOCAL_LKG';
  if(snapshot.state==='RECOVERING'||snapshot.state==='BEHIND')return 'SYNC RECOVERING / LOCAL_LKG';
  if(snapshot.state==='READY')return 'ACTIVE PROJECTION';
  return 'PROJECTION UNAVAILABLE';
}

function optionRecord(line?:MfpOrderingDraftLine){
  return Object.fromEntries((line?.optionSelections??[]).map(selection=>[selection.optionSetId,[...selection.optionIds]]));
}

function comboRecord(line?:MfpOrderingDraftLine){
  const out:Record<string,{subPoolId:string;choiceId:string}[]>={};
  for(const selection of line?.comboSelections??[])(out[selection.groupId]??=[]).push({
    subPoolId:selection.subPoolId,choiceId:selection.choiceId,
  });
  return out;
}

function ProductEditor({domain,draft,product,line,canDraft,onSave,onClose}:{
  domain:MfpOrderingDomain;draft:MfpOrderingDraft;product:MfpOrderingProduct;line?:MfpOrderingDraftLine;
  canDraft:boolean;onSave:(input:MfpProductSelectionInput)=>void;onClose:()=>void;
}){
  const [quantity,setQuantity]=useState(line?.quantity??1);
  const [note,setNote]=useState(line?.note??'');
  const [selected,setSelected]=useState<Record<string,string[]>>(()=>line?optionRecord(line):Object.fromEntries(
    Object.entries(domain.defaultProductSelection(product.productId)).map(([id,ids])=>[id,[...ids]]),
  ));
  const input:MfpProductSelectionInput={
    cartLineId:line?.cartLineId??'PREVIEW',productId:product.productId,quantity,note,optionSelections:selected,
  };
  const preview=useMemo(()=>{
    try{
      const next=line?domain.editProduct(draft,input,{allowIncomplete:true}):domain.addProduct(draft,input,{allowIncomplete:true});
      return next.lines.find(row=>row.cartLineId===input.cartLineId)??null;
    }catch{return null;}
  },[domain,draft,input.cartLineId,input.productId,input.quantity,line,note,selected]);
  const toggle=(setId:string,optionId:string,single:boolean,max:number)=>setSelected(current=>{
    const values=current[setId]??[];
    if(single)return {...current,[setId]:values.includes(optionId)?[]:[optionId]};
    const next=values.includes(optionId)?values.filter(id=>id!==optionId):[...values,optionId];
    return {...current,[setId]:next.slice(0,max)};
  });
  return <section className="mfp-config" role="dialog" aria-modal="true" aria-labelledby="mfp-product-config-title">
    <header><div><small>PRODUCT CONFIG</small><h2 id="mfp-product-config-title">{product.name}</h2></div><button type="button" autoFocus aria-label="關閉商品設定" onClick={onClose}>×</button></header>
    <div className="mfp-config-scroll">{product.imageUrl?<img className="mfp-config-media" src={product.imageUrl} alt={product.name}/>:null}
    <div className="mfp-quantity" aria-label="數量"><span>{formatMoney(product.publishedUnitPrice?.amountMinor??null)}</span><button type="button" onClick={()=>setQuantity(Math.max(1,quantity-1))}>−</button><strong>{quantity}</strong><button type="button" onClick={()=>setQuantity(quantity+1)}>＋</button></div>
    {product.optionSets.map(set=><fieldset key={set.id}>
      <legend><strong>{set.name}</strong><span>{set.required?'必選':'可選'} · {set.selection==='SINGLE'?'單選':'多選'} · {set.min}–{set.max}</span></legend>
      <div className="mfp-choice-grid">{set.options.map(option=>{
        const active=(selected[set.id]??[]).includes(option.id);
        return <button type="button" key={option.id} aria-pressed={active} disabled={!option.sellable}
          className={active?'active':''} onClick={()=>toggle(set.id,option.id,set.selection==='SINGLE',set.max)}>
          <b>{option.name}</b><small>{option.sellable?(option.priceAdjustment.amountMinor===0?'已發布 $0':formatMoney(option.priceAdjustment.amountMinor)):'暫停供應'}</small>
        </button>;
      })}</div>
    </fieldset>)}
    {!product.optionSets.length?<p className="mfp-empty-copy">呢件商品無已發布選項。</p>:null}
    <label className="mfp-note">備註<textarea maxLength={200} value={note} onChange={event=>setNote(event.target.value)} placeholder="可留空"/></label></div>
    <footer><div><small>LOCAL_PREVIEW_FROM_PUBLISHED_FACTS</small><strong>{formatMoney(preview?.previewUnitMinor??null)}</strong>{preview?.issues.map(code=><span key={code}>{code}</span>)}</div>
      <button type="button" disabled={!canDraft||preview?.state!=='READY'} onClick={()=>onSave(input)}>{line?'儲存修改':'加入 Cart Draft'}</button>
    </footer>
  </section>;
}

function ComboEditor({domain,draft,comboId,line,canDraft,onSave,onClose}:{
  domain:MfpOrderingDomain;draft:MfpOrderingDraft;comboId:string;line?:MfpOrderingDraftLine;
  canDraft:boolean;onSave:(input:MfpComboSelectionInput)=>void;onClose:()=>void;
}){
  const combo=domain.catalog.combos.find(row=>row.id===comboId)!;
  const pools=[combo.mainPoolId,...combo.addonPoolIds].filter((id):id is string=>Boolean(id))
    .map(id=>domain.catalog.comboPools.find(pool=>pool.id===id)).filter((pool):pool is NonNullable<typeof pool>=>Boolean(pool));
  const [quantity,setQuantity]=useState(line?.quantity??1);
  const [note,setNote]=useState(line?.note??'');
  const [selected,setSelected]=useState<Record<string,{subPoolId:string;choiceId:string}[]>>(()=>comboRecord(line));
  const input:MfpComboSelectionInput={cartLineId:line?.cartLineId??'PREVIEW',comboId,quantity,note,comboSelections:selected};
  const preview=useMemo(()=>{
    try{
      const next=line?domain.editCombo(draft,input,{allowIncomplete:true}):domain.addCombo(draft,input,{allowIncomplete:true});
      return next.lines.find(row=>row.cartLineId===input.cartLineId)??null;
    }catch{return null;}
  },[domain,draft,input.cartLineId,input.comboId,input.quantity,line,note,selected]);
  const toggle=(groupId:string,subPoolId:string,choiceId:string,max:number)=>setSelected(current=>{
    const values=current[groupId]??[];
    const exists=values.some(row=>row.subPoolId===subPoolId&&row.choiceId===choiceId);
    const next=exists?values.filter(row=>row.subPoolId!==subPoolId||row.choiceId!==choiceId):[...values,{subPoolId,choiceId}];
    return {...current,[groupId]:max===1?next.slice(-1):next.slice(0,max)};
  });
  return <section className="mfp-config" role="dialog" aria-modal="true" aria-labelledby="mfp-combo-config-title">
    <header><div><small>COMBO / POOL / CHOICE</small><h2 id="mfp-combo-config-title">{combo.name}</h2></div><button type="button" autoFocus aria-label="關閉套餐設定" onClick={onClose}>×</button></header>
    <div className="mfp-config-scroll"><div className="mfp-quantity" aria-label="數量"><span>{formatMoney(combo.publishedBasePrice?.amountMinor??null)}</span><button type="button" onClick={()=>setQuantity(Math.max(1,quantity-1))}>−</button><strong>{quantity}</strong><button type="button" onClick={()=>setQuantity(quantity+1)}>＋</button></div>
    {pools.flatMap(pool=>pool.groups.map(group=><fieldset key={pool.id+':'+group.id}>
      <legend><strong>{group.name}</strong><span>{group.required?'必選':'可選'} · {group.min}–{group.max}</span></legend>
      {group.subPools.map(subPool=><div key={subPool.id} className="mfp-sub-pool"><p><b>{subPool.name}</b><span>{formatMoney(subPool.priceAdjustment.amountMinor)}</span></p><div className="mfp-choice-grid">
        {subPool.choices.map(choice=>{
          const active=(selected[group.id]??[]).some(row=>row.subPoolId===subPool.id&&row.choiceId===choice.id);
          return <button type="button" key={choice.id} aria-pressed={active} disabled={!choice.sellable} className={active?'active':''}
            onClick={()=>toggle(group.id,subPool.id,choice.id,group.max)}><b>{choice.label}</b><small>{choice.sellable?formatMoney(choice.priceAdjustment.amountMinor):'暫停供應'}</small></button>;
        })}
      </div></div>)}
    </fieldset>))}<label className="mfp-note">備註<textarea maxLength={200} value={note} onChange={event=>setNote(event.target.value)} placeholder="可留空"/></label></div>
    <footer><div><small>LOCAL_PREVIEW_FROM_PUBLISHED_FACTS</small><strong>{formatMoney(preview?.previewUnitMinor??null)}</strong>{preview?.issues.map(code=><span key={code}>{code}</span>)}</div>
      <button type="button" disabled={!canDraft||!preview} onClick={()=>onSave(input)}>{line?'儲存修改':preview?.state==='READY'?'加入 Cart Draft':'加入未完成 Cart Draft'}</button>
    </footer>
  </section>;
}

function ProductGrid({products,mode,onProduct}:{
  products:readonly MfpOrderingProduct[];mode:'quick'|'normal';onProduct:(product:MfpOrderingProduct,mode:'quick'|'normal')=>void;
}){
  return <div className="mfp-product-grid">{products.length?products.map(product=>{
    const enabled=product.sellable&&product.priceReady;
    return <button type="button" key={product.productId} disabled={!enabled} onClick={()=>onProduct(product,mode)}>
      {product.imageUrl?<img src={product.imageUrl} alt="" loading="lazy"/>:<span className="mfp-product-placeholder" aria-hidden="true">MFP</span>}
      <span><b>{product.name}</b>{product.description?<small>{product.description}</small>:null}<strong>{enabled?formatMoney(product.publishedUnitPrice!.amountMinor):product.sellable?'價錢未準備':'暫停供應'}</strong></span>
    </button>;
  }):<p className="mfp-empty-copy">呢個分類未有可用商品。</p>}</div>;
}

export function MfpOrderingWorkspace({surface,catalog,security,syncSnapshot}:{
  surface:MfpOrderingSurface;catalog:MfpOrderingCatalog|null;security:MfpSecurityPort;syncSnapshot:MfpSyncSnapshot;
}){
  const domain=useMemo(()=>catalog?createMfpOrderingDomain(catalog):null,[catalog]);
  const [draft,setDraft]=useState<MfpOrderingDraft>({draftOnly:true,serviceMode:'takeaway',lines:[]});
  const [selectedCategoryId,setSelectedCategoryId]=useState(catalog?.categories[0]?.id??'');
  const [orderingMode,setOrderingMode]=useState<'quick'|'normal'>('quick');
  const [editor,setEditor]=useState<Editor>(null);
  const [heldDraft,setHeldDraft]=useState<MfpOrderingDraft|null>(null);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [displaySettings,setDisplaySettings]=useState(()=>typeof window==='undefined'?DEFAULT_MFP_DISPLAY_SETTINGS:loadMfpDisplaySettings(window.localStorage));
  const [mobilePage,setMobilePage]=useState<'browse'|'cart'>('browse');
  const [feedback,setFeedback]=useState('');
  const lineSequence=useRef(0);
  const priorProjection=useRef(catalog?.source.projectionHash??null);
  const securitySnapshot=security.getSnapshot();
  const canDraft=isMfpFrontlineSessionEligible(securitySnapshot);

  useEffect(()=>{
    try{if(typeof window!=='undefined')saveMfpDisplaySettings(window.localStorage,displaySettings);}
    catch{/* Browser storage unavailable: keep the current presentation in memory. */}
  },[displaySettings]);

  useEffect(()=>{
    if(!domain||!catalog)return;
    if(priorProjection.current&&priorProjection.current!==catalog.source.projectionHash){
      setDraft(current=>domain.reconcile(current,catalog));
      setHeldDraft(current=>current?domain.reconcile(current,catalog):null);
    }
    priorProjection.current=catalog.source.projectionHash;
    if(!catalog.categories.some(category=>category.id===selectedCategoryId))setSelectedCategoryId(catalog.categories[0]?.id??'');
  },[catalog,domain,selectedCategoryId]);

  if(!catalog||!domain)return <section className="mfp-ordering-unavailable" data-ordering-surface={surface}>
    <small>A4 ORDERING SURFACES</small><h2>暫時未有可用菜單</h2><p>A3 Active Projection / LOCAL_LKG 未準備好；MFP 唔會顯示假產品。</p>
  </section>;

  const products=catalog.products.filter(product=>product.categoryId===selectedCategoryId);
  const openProduct=(product:MfpOrderingProduct,mode:'quick'|'normal')=>{
    if(!canDraft){setFeedback('A2 SECURITY GATE · 只讀模式');setEditor({kind:'product',productId:product.productId});return;}
    if(mode==='normal'||surface==='MFP_MOBILE'){setEditor({kind:'product',productId:product.productId});return;}
    const input:MfpProductSelectionInput={
      cartLineId:`LINE-${++lineSequence.current}`,productId:product.productId,quantity:1,
      optionSelections:domain.defaultProductSelection(product.productId),
    };
    try{
      const next=domain.addProduct(draft,input,{allowIncomplete:true});
      setDraft(next);
      setFeedback(next.lines.at(-1)?.state==='INCOMPLETE'?`${product.name} 已加入；Required 尚未完成`:`${product.name} 已加入 Cart Draft`);
    }
    catch{lineSequence.current--;setEditor({kind:'product',productId:product.productId});setFeedback('必選未完成，請先設定');}
  };
  const saveProduct=(input:MfpProductSelectionInput)=>{
    const finalInput={...input,cartLineId:editor?.lineId??`LINE-${++lineSequence.current}`};
    try{
      setDraft(editor?.lineId?domain.editProduct(draft,finalInput):domain.addProduct(draft,finalInput));
      setEditor(null);setFeedback('Cart Draft 已更新');
    }catch(error){
      if(!editor?.lineId)lineSequence.current--;
      setFeedback(error instanceof Error?error.message:'MFP_ORDERING_DRAFT_UPDATE_FAILED');
    }
  };
  const saveCombo=(input:MfpComboSelectionInput)=>{
    const finalInput={...input,cartLineId:editor?.lineId??`LINE-${++lineSequence.current}`};
    try{
      setDraft(editor?.lineId?domain.editCombo(draft,finalInput,{allowIncomplete:true}):domain.addCombo(draft,finalInput,{allowIncomplete:true}));
      setEditor(null);setFeedback('Combo 已加入 Cart Draft');
    }catch(error){
      if(!editor?.lineId)lineSequence.current--;
      setFeedback(error instanceof Error?error.message:'MFP_ORDERING_DRAFT_UPDATE_FAILED');
    }
  };
  const editLine=(line:MfpOrderingDraftLine)=>setEditor(line.kind==='PRODUCT'
    ?{kind:'product',productId:line.productId!,lineId:line.cartLineId}
    :{kind:'combo',comboId:line.comboId!,lineId:line.cartLineId});
  const editorLine=editor?.lineId?draft.lines.find(line=>line.cartLineId===editor.lineId):undefined;
  const editorProduct=editor?.kind==='product'?catalog.products.find(product=>product.productId===editor.productId):undefined;
  const editorCombo=editor?.kind==='combo'?catalog.combos.find(combo=>combo.id===editor.comboId):undefined;
  const editorBody=editor?.kind==='product'&&editorProduct
    ?<ProductEditor key={editor.lineId??editor.productId} domain={domain} draft={draft} product={editorProduct} line={editorLine} canDraft={canDraft} onSave={saveProduct} onClose={()=>setEditor(null)}/>
    :editor?.kind==='combo'&&editorCombo
      ?<ComboEditor key={editor.lineId??editor.comboId} domain={domain} draft={draft} comboId={editorCombo.id} line={editorLine} canDraft={canDraft} onSave={saveCombo} onClose={()=>setEditor(null)}/>
      :null;
  const settingsBody=settingsOpen?<MfpDisplaySettingsPanel settings={displaySettings} onChange={setDisplaySettings} onClose={()=>setSettingsOpen(false)}/>:null;
  const cart=<MfpCartDraft domain={domain} catalog={catalog} draft={draft} heldDraft={heldDraft} canDraft={canDraft} onChange={setDraft} onHeldDraft={setHeldDraft} onEdit={editLine}/>;
  const status=<div className="mfp-ordering-status"><span className={syncSnapshot.state==='OFFLINE'?'offline':''}>{freshness(syncSnapshot)}</span><span>Projection #{catalog.source.appliedSeq}</span><span>{canDraft?`A2 AUTHENTICATED · ${securitySnapshot.session?.displayName}`:`A2 SECURITY GATE · ${securitySnapshot.sessionState} · 只讀模式`}</span></div>;
  const categories=<nav className="mfp-ordering-categories" aria-label="商品分類">{catalog.categories.map(category=><button type="button" key={category.id} aria-pressed={category.id===selectedCategoryId} className={category.id===selectedCategoryId?'active':''} onClick={()=>setSelectedCategoryId(category.id)}>{category.label}</button>)}</nav>;
  const combos=catalog.combos.length?<section className="mfp-combo-strip"><header><b>Combo</b><span>Pool / Choice 由同一 Active Projection 提供</span></header><div>{catalog.combos.map(combo=><button type="button" key={combo.id} disabled={!combo.sellable||!combo.priceReady} onClick={()=>setEditor({kind:'combo',comboId:combo.id})}><b>{combo.name}</b><span>{combo.publishedBasePrice?formatMoney(combo.publishedBasePrice.amountMinor):'價錢未準備'}</span></button>)}</div></section>:null;

  const displayStyle=mfpDisplaySettingsStyle(displaySettings) as CSSProperties;
  if(surface==='MFP_PAD')return <section className="mfp-ordering mfp-pad" data-ordering-surface="MFP_PAD" data-show-images={displaySettings.showImages} style={displayStyle}>
    <MfpShellNavigation/>{status}<header className="mfp-ordering-head"><div><small>MFP PAD</small><h1>商品目錄</h1></div><div className="mfp-ordering-head-actions"><div className="mfp-ordering-mode" role="group" aria-label="點單模式"><button type="button" aria-pressed={orderingMode==='quick'} className={orderingMode==='quick'?'active':''} onClick={()=>setOrderingMode('quick')}>快速</button><button type="button" aria-pressed={orderingMode==='normal'} className={orderingMode==='normal'?'active':''} onClick={()=>setOrderingMode('normal')}>普通</button></div><button type="button" className="mfp-settings-button" onClick={()=>setSettingsOpen(true)}>Display Settings</button></div></header>
    <div className="mfp-pad-layout"><aside>{categories}</aside><main><MfpSilentGuidance catalog={catalog} draft={draft}/><MfpFastLanes catalog={catalog} draft={draft} onEdit={editLine} onCombo={comboId=>setEditor({kind:'combo',comboId})}/><ProductGrid products={products} mode={orderingMode} onProduct={openProduct}/>{combos}</main>{cart}</div>
    {editorBody?<div className="mfp-config-layer">{editorBody}</div>:null}{settingsBody?<div className="mfp-config-layer">{settingsBody}</div>:null}<output className="mfp-ordering-feedback" aria-live="polite">{feedback}</output>
  </section>;

  return <section className="mfp-ordering mfp-mobile" data-ordering-surface="MFP_MOBILE" data-show-images={displaySettings.showImages} style={displayStyle}>
    {status}<header className="mfp-mobile-head"><div><small>MFP MOBILE</small><h1>{mobilePage==='browse'?'點餐':'購物車'}</h1></div><div><button type="button" className="mfp-settings-button" onClick={()=>setSettingsOpen(true)}>顯示</button><button type="button" onClick={()=>setMobilePage(mobilePage==='browse'?'cart':'browse')}>{mobilePage==='browse'?`查看購物車 (${draft.lines.length})`:'返回商品'}</button></div></header>
    {mobilePage==='browse'?<main><MfpSilentGuidance catalog={catalog} draft={draft}/><MfpFastLanes catalog={catalog} draft={draft} onEdit={editLine} onCombo={comboId=>setEditor({kind:'combo',comboId})}/>{categories}<ProductGrid products={products} mode="normal" onProduct={openProduct}/>{combos}</main>:cart}
    {editorBody?<div className="mfp-mobile-sheet">{editorBody}</div>:null}{settingsBody?<div className="mfp-mobile-sheet">{settingsBody}</div>:null}<output className="mfp-ordering-feedback" aria-live="polite">{feedback}</output>
    <nav className="mfp-mobile-nav" aria-label="Mobile ordering navigation"><button type="button" className={mobilePage==='browse'?'active':''} onClick={()=>setMobilePage('browse')}>商品</button><button type="button" className={mobilePage==='cart'?'active':''} onClick={()=>setMobilePage('cart')}>Cart {draft.lines.length}</button></nav>
  </section>;
}
