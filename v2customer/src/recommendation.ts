import type {CustomerCartLine,CustomerHistoryProjection,CustomerProduct} from './product-types';

export type CustomerRecommendationReason='BUY_AGAIN'|'FEATURED'|'CURRENT_CATEGORY'|'DISCOVERY';

export interface CustomerRecommendation {
  readonly product:CustomerProduct;
  readonly reason:CustomerRecommendationReason;
  readonly reasonLabel:string;
  readonly reasonDetail:string;
}

const normalize=(value:string)=>value.trim().toLocaleLowerCase('zh-HK').replace(/\s+/g,'');

function appearedInHistory(product:CustomerProduct,history:readonly CustomerHistoryProjection[]){
  const name=normalize(product.name);
  if(!name)return false;
  return history.some(order=>normalize(order.itemSummary).includes(name));
}

function reasonFor(product:CustomerProduct,history:readonly CustomerHistoryProjection[],activeCategoryId:string|null):CustomerRecommendation{
  if(appearedInHistory(product,history)){
    return Object.freeze({product,reason:'BUY_AGAIN',reasonLabel:'你食過',reasonDetail:'來自正式完成訂單；再次落單仍會按目前菜單重新驗證。'});
  }
  if(product.badge){
    return Object.freeze({product,reason:'FEATURED',reasonLabel:product.badge,reasonDetail:'來自店舖菜單提供嘅推薦標記。'});
  }
  if(activeCategoryId&&product.categoryId===activeCategoryId){
    return Object.freeze({product,reason:'CURRENT_CATEGORY',reasonLabel:'同類可以再睇',reasonDetail:'跟住你而家瀏覽嘅分類，方便快啲比較。'});
  }
  return Object.freeze({product,reason:'DISCOVERY',reasonLabel:'今日可選',reasonDetail:'來自目前正式可售菜單。'});
}

export function buildCustomerRecommendations({
  products,
  history=[],
  cart=[],
  activeCategoryId=null,
  limit=4,
}:{
  products:readonly CustomerProduct[];
  history?:readonly CustomerHistoryProjection[];
  cart?:readonly CustomerCartLine[];
  activeCategoryId?:string|null;
  limit?:number;
}):readonly CustomerRecommendation[]{
  const cartIds=new Set(cart.map(line=>line.productId));
  const candidates=products
    .filter(product=>product.available&&!cartIds.has(product.productId))
    .map(product=>{
      const recommendation=reasonFor(product,history,activeCategoryId);
      const historyScore=recommendation.reason==='BUY_AGAIN'?100:0;
      const badgeScore=recommendation.reason==='FEATURED'?60:0;
      const categoryScore=recommendation.reason==='CURRENT_CATEGORY'?30:0;
      const imageScore=product.imageUrl?8:0;
      return {recommendation,score:historyScore+badgeScore+categoryScore+imageScore};
    })
    .sort((a,b)=>b.score-a.score||a.recommendation.product.name.localeCompare(b.recommendation.product.name,'zh-HK'))
    .slice(0,Math.max(0,limit))
    .map(item=>item.recommendation);

  return Object.freeze(candidates);
}
