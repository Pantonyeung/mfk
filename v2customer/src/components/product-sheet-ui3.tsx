import type {CustomerRecommendation} from '../recommendation';
import {
  customerComboChoiceSelected,
  customerComboEffectiveMin,
  customerComboGroupSelectionCount,
  customerComboPublishedUnitMinor,
  customerStandalonePublishedUnitMinor,
  selectedCustomerComboIntent,
  selectedCustomerOptions,
  validateCustomerComboSelection,
  validateCustomerSelections,
  type CustomerComboSelectionState,
  type CustomerSelectionState,
} from '../selection';
import type {CustomerMenuSnapshot,CustomerProduct} from '../product-types';
import {ActionButton,AnimatedValue,ProductDialog,QuantityStepper,type ProductOriginRect} from '../ui/primitives';

const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);

const adjustmentLabel=(minor:number)=>{
  if(!Number.isSafeInteger(minor))return '價格待同步';
  if(minor===0)return '已包括';
  return (minor>0?'+':'-')+money('HKD',Math.abs(minor));
};

function ProductMedia({product,compact=false}:{product:CustomerProduct;compact?:boolean}){
  return <span className={'product-media'+(compact?' compact':'')} aria-hidden={!product.imageUrl}>
    {product.imageUrl?<img src={product.imageUrl} alt={product.imageAlt??product.name}/>:<span className="product-media-fallback true-empty"/>}
    {!product.available?<b>暫停供應</b>:null}
  </span>;
}

export function ProductSheet({
  product,
  menu,
  selections,
  comboEnabled,
  comboSelections,
  selectedVariationId,
  quantity,
  note,
  editing,
  recommendations,
  setVariation,
  setComboEnabled,
  clearCombo,
  setQuantity,
  setNote,
  toggle,
  toggleCombo,
  origin,
  onClose,
  onAdd,
}:{
  product:CustomerProduct;
  menu:CustomerMenuSnapshot|null|undefined;
  selections:CustomerSelectionState;
  comboEnabled:boolean;
  comboSelections:CustomerComboSelectionState;
  selectedVariationId:string|null;
  quantity:number;
  note:string;
  editing:boolean;
  recommendations:readonly CustomerRecommendation[];
  setVariation:(id:string)=>void;
  setComboEnabled:(enabled:boolean)=>void;
  clearCombo:()=>void;
  setQuantity:(quantity:number)=>void;
  setNote:(note:string)=>void;
  toggle:(groupId:string,optionId:string)=>void;
  toggleCombo:(poolId:string,groupId:string,subPoolId:string,choiceId:string)=>void;
  origin:ProductOriginRect|null;
  onClose:()=>void;
  onAdd:()=>void;
}){
  const combo=product.comboId?menu?.combos?.find(item=>item.comboId===product.comboId):undefined;
  const poolById=new Map((menu?.comboPools??[]).map(pool=>[pool.poolId,pool] as const));
  const validation=validateCustomerSelections(product,selections);
  const comboValidation=comboEnabled
    ?validateCustomerComboSelection(product,menu,comboSelections)
    :{ok:true as const,issues:[] as readonly string[]};
  const variationOk=!product.variationRequired||Boolean(selectedVariationId);

  const requiredGroups=product.optionGroups.filter(group=>group.required||group.minSelections>0);
  const optionalGroups=product.optionGroups.filter(group=>!group.required&&group.minSelections===0);

  const ordinarySelections=selectedCustomerOptions(product,selections);
  const comboIntent=comboEnabled?selectedCustomerComboIntent(product,menu,comboSelections):null;
  const comboUnitMinor=comboIntent?customerComboPublishedUnitMinor(comboIntent,ordinarySelections):null;
  const standaloneUnitMinor=!comboEnabled
    ?customerStandalonePublishedUnitMinor(product,ordinarySelections)
    :null;
  const draftUnitMinor=comboEnabled?comboUnitMinor:standaloneUnitMinor;
  const draftTotalMinor=draftUnitMinor!==null&&Number.isSafeInteger(draftUnitMinor*quantity)?draftUnitMinor*quantity:null;
  const priceReady=draftTotalMinor!==null&&draftTotalMinor>=0;
  const addReady=product.available&&variationOk&&validation.ok&&comboValidation.ok&&priceReady&&quantity>=1;

  const comboChoiceNames=()=>{
    if(!comboEnabled||!combo)return [];
    const names:string[]=[];
    for(const poolId of combo.addonPoolIds){
      const pool=poolById.get(poolId);
      if(!pool)continue;
      for(const group of pool.groups){
        for(const subPool of group.subPools){
          for(const choice of subPool.choices){
            if(customerComboChoiceSelected(comboSelections,pool.poolId,group.groupId,subPool.subPoolId,choice.choiceId))names.push(choice.label);
          }
        }
      }
    }
    return names;
  };

  const renderOptionGroup=(group:CustomerProduct['optionGroups'][number])=>{
    const selected=selections[group.optionGroupId]??[];
    const minimum=Math.max(group.required?1:0,group.minSelections);
    const maxReached=group.maxSelections>1&&selected.length>=group.maxSelections;
    return <fieldset className="choice-group ui3-option-group" key={group.optionGroupId}>
      <legend><span>{group.name}</span><small>{minimum?'最少 '+minimum:'可選'} · 最多 {group.maxSelections}</small></legend>
      <p className="selection-count">已選 {selected.length} 項</p>
      <div className="choice-grid">{group.options.map(option=>{
        const active=selected.includes(option.optionId);
        const disabled=!option.available||(maxReached&&!active);
        return <button type="button" key={option.optionId} disabled={disabled} aria-pressed={active} className={active?'active':''} onClick={()=>toggle(group.optionGroupId,option.optionId)}>
          <span>{option.name}</span>
          <small>{!option.available?'暫不可選':(active?'已選 · ':'')+adjustmentLabel(Number(option.publishedAdjustmentMinor||0))}</small>
        </button>;
      })}</div>
      {selected.length<minimum?<p className="choice-error">仲要揀 {minimum-selected.length} 項</p>:null}
    </fieldset>;
  };

  const summaryParts=[
    product.variations?.find(item=>item.variationId===selectedVariationId)?.name,
    comboEnabled?combo?.name:undefined,
    ...comboChoiceNames(),
    ...product.optionGroups.flatMap(group=>group.options
      .filter(option=>(selections[group.optionGroupId]??[]).includes(option.optionId))
      .map(option=>option.name)),
  ].filter(Boolean);

  return <ProductDialog label={product.name+' 商品詳情'} origin={origin} returnFocusId={product.productId} onClose={onClose}>
    <div className="product-sheet-hero ui3-product-hero" data-ui3-section="hero">
      <ProductMedia product={product}/>
      <div className="product-sheet-copy">
        <span>{product.badge??'商品詳情'}</span>
        <h2>{product.name}</h2>
        <p>{product.description}</p>
        <AnimatedValue as="strong">{product.displayPriceLabel??'價格待店舖提供'}</AnimatedValue>
        <small className="ui3-published-note">起步價只顯示店舖已發布資料。</small>
      </div>
    </div>

    {product.comboId?<section className="ui3-config-section ui3-combo-section" data-ui3-section="combo">
      <header className="ui3-section-heading"><div><span>Combo Upgrade</span><h3>套餐升級</h3></div><small>只用 exact comboId</small></header>
      {combo?<>
        <div className="ui3-combo-summary"><div><span>{combo.name}</span><strong>{money('HKD',combo.publishedBasePriceMinor)}</strong></div><small>已發布套餐基本價 · 正式提交由 SMT 再核對</small></div>
        <div className="choice-grid ui3-combo-mode">
          <button type="button" aria-pressed={!comboEnabled} className={!comboEnabled?'active':''} onClick={()=>{setComboEnabled(false);clearCombo()}}><span>只要主餐</span><small>不升級套餐</small></button>
          <button type="button" aria-pressed={comboEnabled} className={comboEnabled?'active':''} onClick={()=>setComboEnabled(true)}><span>{combo.name}</span><small>升級套餐</small></button>
        </div>
        {comboEnabled?<>
          {combo.mainPoolId?(()=>{const mainPool=poolById.get(combo.mainPoolId);return <div className="ui3-main-pool"><span>{mainPool?.name??'主餐'}</span><strong>{product.name}</strong><small>保留原商品身份</small></div>})():null}
          {combo.addonPoolIds.map(poolId=>{
            const pool=poolById.get(poolId);
            if(!pool||pool.kind!=='ADDON')return <div className="choice-error" key={poolId}>套餐群組資料待同步。</div>;
            return <section className="ui3-combo-pool" key={pool.poolId} aria-label={pool.name}>{pool.groups.map(group=>{
              const minimum=customerComboEffectiveMin(pool,group);
              const selectedCount=customerComboGroupSelectionCount(comboSelections,pool.poolId,group.groupId);
              return <fieldset className="choice-group" key={group.groupId}>
                <legend><span>{group.name}</span><small>{pool.addonKind==='DRINK'?'飲品':pool.addonKind==='SNACK'?'小食':'加配'} · {minimum?'最少 '+minimum:'可選'} · 最多 {group.maxSelections}</small></legend>
                <p className="selection-count">已選 {selectedCount} 項</p>
                <div className="choice-grid">{group.subPools.flatMap(subPool=>subPool.choices.map(choice=>{
                  const active=customerComboChoiceSelected(comboSelections,pool.poolId,group.groupId,subPool.subPoolId,choice.choiceId);
                  const publishedAdjustmentMinor=Number(subPool.publishedAdjustmentMinor)+Number(choice.publishedAdjustmentMinor);
                  const maxReached=group.maxSelections>1&&selectedCount>=group.maxSelections;
                  return <button type="button" key={subPool.subPoolId+'::'+choice.choiceId} disabled={!choice.available||(maxReached&&!active)} aria-pressed={active} className={active?'active':''} onClick={()=>toggleCombo(pool.poolId,group.groupId,subPool.subPoolId,choice.choiceId)}>
                    <span>{choice.label}</span><small>{!choice.available?'暫不可選':subPool.name+' · '+adjustmentLabel(publishedAdjustmentMinor)}</small>
                  </button>;
                }))}</div>
                {selectedCount<minimum?<p className="choice-error">仲要揀 {minimum-selectedCount} 項</p>:null}
              </fieldset>;
            })}</section>;
          })}
          {!comboValidation.ok?<p className="choice-error">{comboValidation.issues[0]}</p>:null}
        </>:null}
      </>:<p className="choice-error">套餐資料待同步；未有 exact canonical Combo 前唔會建立假套餐。</p>}
    </section>:null}

    <section className="ui3-config-section" data-ui3-section="required">
      <header className="ui3-section-heading"><div><span>Required</span><h3>必選設定</h3></div><small>未完成不可加入</small></header>
      {product.variations?.length&&product.variationRequired?<fieldset className="choice-group">
        <legend><span>規格</span><small>必選</small></legend>
        <div className="choice-grid">{product.variations.map(item=><button type="button" key={item.variationId} disabled={!item.available} aria-pressed={selectedVariationId===item.variationId} className={selectedVariationId===item.variationId?'active':''} onClick={()=>setVariation(item.variationId)}><span>{item.name}</span><small>{!item.available?'暫不可選':selectedVariationId===item.variationId?'已選':'必選'}</small></button>)}</div>
        {!variationOk?<p className="choice-error">請揀一個規格</p>:null}
      </fieldset>:null}
      {requiredGroups.map(renderOptionGroup)}
      {!product.variationRequired&&!requiredGroups.length?<p className="ui3-quiet-copy">呢件商品冇額外必選項。</p>:null}
    </section>

    <section className="ui3-config-section" data-ui3-section="optional">
      <header className="ui3-section-heading"><div><span>Optional</span><h3>可選設定</h3></div><small>按需要調整</small></header>
      {product.variations?.length&&!product.variationRequired?<fieldset className="choice-group">
        <legend><span>規格</span><small>可選</small></legend>
        <div className="choice-grid">{product.variations.map(item=><button type="button" key={item.variationId} disabled={!item.available} aria-pressed={selectedVariationId===item.variationId} className={selectedVariationId===item.variationId?'active':''} onClick={()=>setVariation(item.variationId)}><span>{item.name}</span><small>{!item.available?'暫不可選':selectedVariationId===item.variationId?'已選':'可選'}</small></button>)}</div>
      </fieldset>:null}
      {optionalGroups.map(renderOptionGroup)}
      {!product.variations?.length&&!optionalGroups.length?<p className="ui3-quiet-copy">冇其他可選設定。</p>:null}
    </section>

    <section className="ui3-config-section ui3-quantity-section" data-ui3-section="quantity">
      <header className="ui3-section-heading"><div><span>Qty</span><h3>數量</h3></div><small>最少 1 件</small></header>
      <div className="ui3-quantity-row"><span>今次數量</span><QuantityStepper label={product.name} quantity={quantity} min={1} onChange={setQuantity}/></div>
      <label htmlFor="product-note" className="ui3-note"><span>今次備註 <small>選填</small></span><textarea id="product-note" value={note} onChange={event=>setNote(event.target.value)} maxLength={120} placeholder="例如：醬汁分開。請勿填寫敏感個人資料。"/><small>{note.length} / 120</small></label>
    </section>

    <section className="ui3-config-section ui3-recommendation-section" data-ui3-section="recommendation">
      <header className="ui3-section-heading"><div><span>Recommendation</span><h3>可以再配一樣</h3></div><small>唔影響加入</small></header>
      {recommendations.length?<div className="ui3-recommendation-list">{recommendations.slice(0,3).map(item=><article key={item.product.productId}><ProductMedia product={item.product} compact/><div><small>{item.reasonLabel}</small><strong>{item.product.name}</strong><span>{item.product.displayPriceLabel??'價格待店舖提供'}</span></div></article>)}</div>:<p className="ui3-quiet-copy">暫時未有合適推薦；可以照常完成今次設定。</p>}
    </section>

    <section className="ui3-config-section ui3-current-summary" data-ui3-section="summary">
      <header className="ui3-section-heading"><div><span>Current Configuration Summary</span><h3>目前設定</h3></div><small>{quantity} 件</small></header>
      <p>{summaryParts.join(' · ')||'原味設定'}</p>
      <div className="ui3-price-breakdown"><span>已發布預覽</span><strong>{priceReady?money('HKD',draftTotalMinor!):'價格待同步'}</strong></div>
      <small>此價格只根據目前已發布資料預覽；正式提交仍由 SMT 重新核對價格、供應同套餐規則。</small>
    </section>

    <div className="ui3-sticky-actions" data-ui3-section="add">
      <div><span>目前預覽</span><strong>{priceReady?money('HKD',draftTotalMinor!):'價格待同步'}</strong><small>{!addReady?'完成必選設定及同步價格後先可以加入':'設定完整，仍未建立正式訂單'}</small></div>
      <ActionButton disabled={!addReady} onClick={onAdd}>{editing?'更新記憶罐':'加入記憶罐'}</ActionButton>
    </div>
  </ProductDialog>;
}
