import type {CustomerCartLine,CustomerMenuSnapshot,CustomerQuoteSnapshot} from './product-types.ts';

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

    let unitMinor=Number(product.publishedUnitPriceMinor);
    for(const selection of line.selections){
      const group=product.optionGroups.find(row=>row.optionGroupId===selection.optionGroupId);
      const option=group?.options.find(row=>row.optionId===selection.optionId&&row.available);
      if(!option){
        materialChange=true;
        continue;
      }
      unitMinor+=Number(option.publishedAdjustmentMinor||0);
    }

    if(!Number.isSafeInteger(unitMinor)||unitMinor<0)return null;
    if(!Number.isSafeInteger(storedUnit)||storedUnit!==unitMinor)materialChange=true;
    totalMinor+=unitMinor*qty;
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
