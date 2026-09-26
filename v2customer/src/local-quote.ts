// Customer local published-menu quote + line-scoped repair.
import type {
  CustomerCartLine,
  CustomerCartRepair,
  CustomerCartSelection,
  CustomerMenuSnapshot,
  CustomerProduct,
  CustomerQuoteSnapshot,
} from './product-types.ts';

const moneyMinor=(minor:number)=>'HK$'+(minor/100).toFixed(2);

function configIssue(line:CustomerCartLine,product:CustomerProduct):string|null{
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

function currentLinePrice(line:CustomerCartLine,product:CustomerProduct){
  if(!Number.isSafeInteger(Number(product.publishedUnitPriceMinor)))return null;
  let unitMinor=Number(product.publishedUnitPriceMinor);
  const selections:CustomerCartSelection[]=[];
  for(const selection of line.selections){
    const group=product.optionGroups.find(row=>row.optionGroupId===selection.optionGroupId);
    const option=group?.options.find(row=>row.optionId===selection.optionId&&row.available);
    if(!group||!option)return null;
    const adjustment=Number(option.publishedAdjustmentMinor||0);
    if(!Number.isSafeInteger(adjustment))return null;
    unitMinor+=adjustment;
    selections.push(Object.freeze({
      optionGroupId:group.optionGroupId,
      optionId:option.optionId,
      optionName:option.name,
      publishedAdjustmentMinor:adjustment,
    }));
  }
  if(!Number.isSafeInteger(unitMinor)||unitMinor<0)return null;
  return Object.freeze({unitMinor,selections:Object.freeze(selections)});
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
    if(!product||!product.available||!Number.isSafeInteger(Number(product.publishedUnitPriceMinor))){
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

    const issue=configIssue(line,product);
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

    const current=currentLinePrice(line,product);
    if(!current)continue;
    if(!Number.isSafeInteger(previous)||previous!==current.unitMinor){
      repairs.push(Object.freeze({
        lineId:line.lineId,
        kind:'PRICE_CHANGED',
        title:'呢項價格有更新',
        detail:(Number.isSafeInteger(previous)?moneyMinor(previous):'舊價未記錄')+' → '+moneyMinor(current.unitMinor),
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
  if(!product||!product.available||configIssue(line,product))return null;
  const current=currentLinePrice(line,product);
  if(!current)return null;
  const variation=line.selectedVariationId
    ?product.variations?.find(row=>row.variationId===line.selectedVariationId&&row.available)
    :undefined;
  return Object.freeze({
    ...line,
    productName:product.name,
    ...(variation?{selectedVariationName:variation.name}:{}),
    selections:current.selections,
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
    if(!product||!product.available||!Number.isSafeInteger(Number(product.publishedUnitPriceMinor))){
      if(!Number.isSafeInteger(storedUnit)||storedUnit<0)return null;
      totalMinor+=storedUnit*qty;
      materialChange=true;
      continue;
    }

    const issue=configIssue(line,product);
    if(issue)materialChange=true;
    const current=currentLinePrice(line,product);
    if(!current){
      if(!Number.isSafeInteger(storedUnit)||storedUnit<0)return null;
      totalMinor+=storedUnit*qty;
      materialChange=true;
      continue;
    }

    if(!Number.isSafeInteger(storedUnit)||storedUnit!==current.unitMinor)materialChange=true;
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
