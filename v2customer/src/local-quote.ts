// Customer local published-menu quote + line-scoped repair.
// This is a published-menu draft projection only. SMT remains final authority.
import {customerComboEffectiveMin} from './selection';
import type {
  CustomerCartComboIntent,
  CustomerCartComboSelection,
  CustomerCartLine,
  CustomerCartRepair,
  CustomerCartSelection,
  CustomerMenuSnapshot,
  CustomerProduct,
  CustomerQuoteSnapshot,
} from './product-types.ts';

const moneyMinor=(minor:number)=>'HK$'+(minor/100).toFixed(2);

function ordinaryConfigIssue(line:CustomerCartLine,product:CustomerProduct):string|null{
  if(line.selectedVariationId){
    const variation=product.variations?.find(row=>row.variationId===line.selectedVariationId);
    if(!variation||!variation.available)return '已選規格已更新或暫停供應';
  }else if(product.variationRequired){
    return '商品新增咗必選規格';
  }

  for(const group of product.optionGroups){
    const selected=line.selections.filter(row=>row.optionGroupId===group.optionGroupId);
    const min=Math.max(group.required?1:0,Number(group.minSelections)||0);
    const max=Math.max(min,Number(group.maxSelections)||min);
    if(selected.length<min)return '「'+group.name+'」需要重新選擇';
    if(selected.length>max)return '「'+group.name+'」選擇數量規則有更新';
  }

  for(const selection of line.selections){
    const group=product.optionGroups.find(row=>row.optionGroupId===selection.optionGroupId);
    const option=group?.options.find(row=>row.optionId===selection.optionId);
    if(!group||!option||!option.available)return '「'+selection.optionName+'」已更新或暫停供應';
  }
  return null;
}

function comboConfigIssue(
  line:CustomerCartLine,
  product:CustomerProduct,
  menu:CustomerMenuSnapshot,
):string|null{
  if(!line.combo)return null;
  if(!product.comboId||product.comboId!==line.combo.comboId)return '套餐綁定已更新';

  const combo=menu.combos?.find(row=>row.comboId===line.combo!.comboId);
  if(!combo)return '套餐已更新或暫停供應';

  const poolById=new Map((menu.comboPools??[]).map(pool=>[pool.poolId,pool] as const));
  const mainPool=combo.mainPoolId?poolById.get(combo.mainPoolId):undefined;
  const mainMatches=mainPool?.kind==='MAIN_COURSE'
    ?mainPool.groups.flatMap(group=>group.subPools.flatMap(subPool=>subPool.choices)).filter(choice=>
      choice.choiceType==='PRODUCT'&&choice.productId===product.productId&&choice.available
    )
    :[];
  if(!mainPool||mainPool.kind!=='MAIN_COURSE'||mainMatches.length!==1)return '套餐主餐綁定已更新';

  const allowedPoolIds=new Set(combo.addonPoolIds);
  const seen=new Set<string>();
  for(const selection of line.combo.selections){
    const key=[selection.poolId,selection.groupId,selection.subPoolId,selection.choiceId].join('::');
    if(seen.has(key))return '套餐包含重複選項';
    seen.add(key);
    if(!allowedPoolIds.has(selection.poolId))return '套餐選項群組已更新';
    const pool=poolById.get(selection.poolId);
    const group=pool?.groups.find(row=>row.groupId===selection.groupId);
    const subPool=group?.subPools.find(row=>row.subPoolId===selection.subPoolId);
    const choice=subPool?.choices.find(row=>row.choiceId===selection.choiceId);
    if(!pool||pool.kind!=='ADDON'||!group||!subPool||!choice||!choice.available)return '套餐選項已更新或暫停供應';
    if(selection.choiceType!==choice.choiceType)return '套餐選項類型已更新';
    if((selection.productId??'')!==(choice.productId??''))return '套餐商品選項已更新';
  }

  for(const poolId of combo.addonPoolIds){
    const pool=poolById.get(poolId);
    if(!pool||pool.kind!=='ADDON')return '套餐加配資料已更新';
    for(const group of pool.groups){
      const selected=line.combo.selections.filter(row=>row.poolId===pool.poolId&&row.groupId===group.groupId);
      const min=customerComboEffectiveMin(pool,group);
      const max=Math.max(min,group.maxSelections);
      if(selected.length<min)return '「'+group.name+'」需要重新選擇';
      if(selected.length>max)return '「'+group.name+'」選擇數量規則有更新';
    }
  }

  return null;
}

function configIssue(
  line:CustomerCartLine,
  product:CustomerProduct,
  menu:CustomerMenuSnapshot,
):string|null{
  return ordinaryConfigIssue(line,product)??comboConfigIssue(line,product,menu);
}

function currentOrdinarySelections(line:CustomerCartLine,product:CustomerProduct){
  let optionMinor=0;
  const selections:CustomerCartSelection[]=[];
  for(const selection of line.selections){
    const group=product.optionGroups.find(row=>row.optionGroupId===selection.optionGroupId);
    const option=group?.options.find(row=>row.optionId===selection.optionId&&row.available);
    if(!group||!option)return null;
    if(option.publishedAdjustmentMinor===undefined)return null;
    const adjustment=Number(option.publishedAdjustmentMinor);
    if(!Number.isSafeInteger(adjustment))return null;
    optionMinor+=adjustment;
    selections.push(Object.freeze({
      optionGroupId:group.optionGroupId,
      optionId:option.optionId,
      optionName:option.name,
      publishedAdjustmentMinor:adjustment,
    }));
  }
  return Object.freeze({optionMinor,selections:Object.freeze(selections)});
}

function currentComboPrice(
  line:CustomerCartLine,
  product:CustomerProduct,
  menu:CustomerMenuSnapshot,
  ordinary:{readonly optionMinor:number;readonly selections:readonly CustomerCartSelection[]},
){
  if(!line.combo||!product.comboId||line.combo.comboId!==product.comboId)return null;
  const combo=menu.combos?.find(row=>row.comboId===line.combo!.comboId);
  if(!combo)return null;
  if(!Number.isSafeInteger(Number(combo.publishedBasePriceMinor))||Number(combo.publishedBasePriceMinor)<0)return null;

  const poolById=new Map((menu.comboPools??[]).map(pool=>[pool.poolId,pool] as const));
  let unitMinor=Number(combo.publishedBasePriceMinor)+ordinary.optionMinor;
  const selections:CustomerCartComboSelection[]=[];
  let comboPublishedFactsChanged=
    line.combo.comboName!==combo.name||
    Number(line.combo.publishedBasePriceMinor)!==Number(combo.publishedBasePriceMinor);

  for(const stored of line.combo.selections){
    const pool=poolById.get(stored.poolId);
    const group=pool?.groups.find(row=>row.groupId===stored.groupId);
    const subPool=group?.subPools.find(row=>row.subPoolId===stored.subPoolId);
    const choice=subPool?.choices.find(row=>row.choiceId===stored.choiceId&&row.available);
    if(!pool||!group||!subPool||!choice)return null;

    const subPoolAdjustment=Number(subPool.publishedAdjustmentMinor);
    const choiceAdjustment=Number(choice.publishedAdjustmentMinor);
    if(!Number.isSafeInteger(subPoolAdjustment)||!Number.isSafeInteger(choiceAdjustment))return null;
    const adjustment=subPool.publishedAdjustmentMinor+choice.publishedAdjustmentMinor;
    if(!Number.isSafeInteger(adjustment))return null;
    unitMinor+=adjustment;

    if(
      stored.choiceType!==choice.choiceType||
      stored.choiceLabel!==choice.label||
      (stored.productId??'')!==(choice.productId??'')||
      Number(stored.publishedAdjustmentMinor)!==adjustment
    )comboPublishedFactsChanged=true;

    selections.push(Object.freeze({
      poolId:pool.poolId,
      groupId:group.groupId,
      subPoolId:subPool.subPoolId,
      choiceId:choice.choiceId,
      choiceType:choice.choiceType,
      choiceLabel:choice.label,
      ...(choice.productId?{productId:choice.productId}:{}),
      publishedAdjustmentMinor:adjustment,
    }));
  }

  if(!Number.isSafeInteger(unitMinor)||unitMinor<0)return null;
  const refreshed:CustomerCartComboIntent=Object.freeze({
    comboId:combo.comboId,
    comboName:combo.name,
    publishedBasePriceMinor:combo.publishedBasePriceMinor,
    selections:Object.freeze(selections),
  });
  return Object.freeze({
    unitMinor,
    selections:ordinary.selections,
    combo:refreshed,
    comboPublishedFactsChanged,
  });
}

function currentLinePrice(
  line:CustomerCartLine,
  product:CustomerProduct,
  menu:CustomerMenuSnapshot,
){
  const ordinary=currentOrdinarySelections(line,product);
  if(!ordinary)return null;

  if(line.combo)return currentComboPrice(line,product,menu,ordinary);

  if(!Number.isSafeInteger(Number(product.publishedUnitPriceMinor)))return null;
  const unitMinor=Number(product.publishedUnitPriceMinor)+ordinary.optionMinor;
  if(!Number.isSafeInteger(unitMinor)||unitMinor<0)return null;
  return Object.freeze({
    unitMinor,
    selections:ordinary.selections,
    combo:undefined,
    comboPublishedFactsChanged:false,
  });
}

export function publishedCartRepairs(
  cart:readonly CustomerCartLine[],
  menu:CustomerMenuSnapshot|null|undefined,
):readonly CustomerCartRepair[]{
  if(!menu||!cart.length)return Object.freeze([]);
  const products=new Map(menu.products.map(product=>[product.productId,product] as const));
  const repairs:CustomerCartRepair[]=[];

  for(const line of cart){
    const product=products.get(line.productId);
    const previous=Number(line.publishedUnitPriceMinor);
    if(!product||!product.available||(!line.combo&&!Number.isSafeInteger(Number(product.publishedUnitPriceMinor)))){
      repairs.push(Object.freeze({
        lineId:line.lineId,
        kind:'PRODUCT_UNAVAILABLE',
        title:'呢項餐點需要更新',
        detail:!product?'餐點已不在目前餐牌；其他餐點會保留。':'餐點目前暫停供應；其他餐點會保留。',
        canAcceptCurrentPrice:false,
        canEdit:Boolean(product),
        ...(Number.isSafeInteger(previous)?{previousUnitPriceMinor:previous}:{}),
      }));
      continue;
    }

    const issue=configIssue(line,product,menu);
    if(issue){
      repairs.push(Object.freeze({
        lineId:line.lineId,
        kind:'CONFIG_CHANGED',
        title:'呢項設定有更新',
        detail:issue+'；只需要修正呢一項。',
        canAcceptCurrentPrice:false,
        canEdit:true,
        ...(Number.isSafeInteger(previous)?{previousUnitPriceMinor:previous}:{}),
      }));
      continue;
    }

    const current=currentLinePrice(line,product,menu);
    if(!current)continue;
    if(!Number.isSafeInteger(previous)||previous!==current.unitMinor||current.comboPublishedFactsChanged){
      repairs.push(Object.freeze({
        lineId:line.lineId,
        kind:'PRICE_CHANGED',
        title:line.combo?'套餐資料有更新':'呢項價格有更新',
        detail:previous!==current.unitMinor
          ?(Number.isSafeInteger(previous)?moneyMinor(previous):'舊價未記錄')+' → '+moneyMinor(current.unitMinor)
          :'套餐已發佈價格資料有更新，請重新確認。',
        canAcceptCurrentPrice:true,
        canEdit:true,
        ...(Number.isSafeInteger(previous)?{previousUnitPriceMinor:previous}:{}),
        currentUnitPriceMinor:current.unitMinor,
      }));
    }
  }
  return Object.freeze(repairs);
}

export function repairPublishedCartLine(
  line:CustomerCartLine,
  menu:CustomerMenuSnapshot|null|undefined,
):CustomerCartLine|null{
  if(!menu)return null;
  const product=menu.products.find(row=>row.productId===line.productId);
  if(!product||!product.available||configIssue(line,product,menu))return null;
  const current=currentLinePrice(line,product,menu);
  if(!current)return null;
  const variation=line.selectedVariationId
    ?product.variations?.find(row=>row.variationId===line.selectedVariationId&&row.available)
    :undefined;
  return Object.freeze({
    ...line,
    productName:product.name,
    ...(variation?{selectedVariationName:variation.name}:{}),
    selections:current.selections,
    ...(current.combo?{combo:current.combo}:{}),
    publishedUnitPriceMinor:current.unitMinor,
  });
}

export function quotePublishedCart(
  cart:readonly CustomerCartLine[],
  menu:CustomerMenuSnapshot|null|undefined,
):CustomerQuoteSnapshot|null{
  if(!menu||!cart.length)return null;
  const products=new Map(menu.products.map(product=>[product.productId,product] as const));
  let totalMinor=0;
  let materialChange=false;

  for(const line of cart){
    const product=products.get(line.productId);
    const storedUnit=Number(line.publishedUnitPriceMinor);
    const qty=Math.max(1,Math.floor(Number(line.quantity)||1));
    if(!product||!product.available||(!line.combo&&!Number.isSafeInteger(Number(product.publishedUnitPriceMinor)))){
      if(!Number.isSafeInteger(storedUnit)||storedUnit<0)return null;
      totalMinor+=storedUnit*qty;
      materialChange=true;
      continue;
    }

    const issue=configIssue(line,product,menu);
    if(issue)materialChange=true;
    const current=issue?null:currentLinePrice(line,product,menu);
    if(!current){
      if(!Number.isSafeInteger(storedUnit)||storedUnit<0)return null;
      totalMinor+=storedUnit*qty;
      materialChange=true;
      continue;
    }

    if(
      !Number.isSafeInteger(storedUnit)||
      storedUnit!==current.unitMinor||
      current.comboPublishedFactsChanged
    )materialChange=true;
    totalMinor+=current.unitMinor*qty;
  }

  if(!Number.isSafeInteger(totalMinor)||totalMinor<0)return null;
  return Object.freeze({
    quoteId:'PUBLISHED-MENU:'+menu.revision,
    revision:menu.revision,
    currency:'HKD',
    totalMinor,
    observedAt:menu.observedAt,
    freshness:materialChange?'MATERIAL_CHANGE' as const:'CURRENT' as const,
  });
}
