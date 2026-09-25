import type {CustomerCartLine,CustomerMenuSnapshot,CustomerQuoteSnapshot} from './product-types.ts';

export function quotePublishedCart(
  cart:readonly CustomerCartLine[],
  menu:CustomerMenuSnapshot|null|undefined,
):CustomerQuoteSnapshot|null{
  if(!menu||!cart.length)return null;
  let totalMinor=0;
  for(const line of cart){
    const unit=Number(line.publishedUnitPriceMinor);
    const qty=Math.max(1,Math.floor(Number(line.quantity)||1));
    if(!Number.isSafeInteger(unit)||unit<0)return null;
    totalMinor+=unit*qty;
  }
  if(!Number.isSafeInteger(totalMinor)||totalMinor<0)return null;
  return Object.freeze({
    quoteId:'PUBLISHED-MENU:'+menu.revision,
    revision:menu.revision,
    currency:'HKD',
    totalMinor,
    observedAt:menu.observedAt,
    freshness:'CURRENT' as const,
  });
}
