import type {SyncedComboPool,SyncedRiceballDrinkPromotion,SyncedOrderingProduct} from '../../runtime/admin-config-projection.ts';
import {isPairedComboLine,standalonePriceForLine} from './riceball-pairing-model.ts';

export const RICEBALL_DRINK_PROMO_DETAIL='飯團優惠飲品' as const;

export interface PromoCartLine{
  readonly id:string;
  readonly productId:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly serviceMode:'takeaway'|'dine-in';
  readonly detail?:string;
}

export interface PromoProductCatalogs{
  readonly takeaway:readonly SyncedOrderingProduct[];
  readonly 'dine-in':readonly SyncedOrderingProduct[];
}

function parts(detail?:string){
  return String(detail??'').split(' · ').map(part=>part.trim()).filter(Boolean);
}

function withoutPromoDetail(detail?:string){
  return parts(detail).filter(part=>part!==RICEBALL_DRINK_PROMO_DETAIL).join(' · ');
}

function withPromoDetail(detail?:string){
  return [RICEBALL_DRINK_PROMO_DETAIL,withoutPromoDetail(detail)].filter(Boolean).join(' · ');
}

function eligibleMainProductIds(
  pools:readonly SyncedComboPool[],
  rule:SyncedRiceballDrinkPromotion,
){
  const ids=new Set<string>();
  const poolIds=new Set(rule.eligibleMainPoolIds);
  for(const pool of pools){
    if(pool.kind!=='MAIN_COURSE'||!poolIds.has(pool.id))continue;
    for(const group of pool.groups){
      for(const subPool of group.subPools){
        for(const choice of subPool.choices){
          if(choice.type==='PRODUCT'&&choice.productId)ids.add(choice.productId);
        }
      }
    }
  }
  return ids;
}

function lineProduct(line:PromoCartLine,catalogs:PromoProductCatalogs){
  return catalogs[line.serviceMode].find(product=>product.id===line.productId);
}

function standalonePrice(line:PromoCartLine,catalogs:PromoProductCatalogs){
  const product=lineProduct(line,catalogs);
  if(!product)return line.unitMinor;
  const cleanDetail=withoutPromoDetail(line.detail);
  return standalonePriceForLine({...line,detail:cleanDetail},catalogs[line.serviceMode]);
}

function normalizedUnitId(line:PromoCartLine,index:number){
  if(index===0)return line.id;
  return line.id+'::riceball-drink-promo:'+String(index+1);
}

export function applyRiceballDrinkPromotion<T extends PromoCartLine>(
  input:readonly T[],
  catalogs:PromoProductCatalogs,
  pools:readonly SyncedComboPool[],
  rule:SyncedRiceballDrinkPromotion|null,
):T[]{
  if(!rule?.active)return input.map(line=>{
    if(!parts(line.detail).includes(RICEBALL_DRINK_PROMO_DETAIL))return line;
    const detail=withoutPromoDetail(line.detail);
    return {...line,unitMinor:standalonePrice(line,catalogs),detail:detail||undefined} as T;
  });

  const mainIds=eligibleMainProductIds(pools,rule);
  if(!mainIds.size)return [...input];

  const mainUnits:{takeaway:number;'dine-in':number}={takeaway:0,'dine-in':0};
  for(const line of input){
    if(isPairedComboLine(line))continue;
    if(!mainIds.has(line.productId))continue;
    mainUnits[line.serviceMode]+=Math.max(0,Math.floor(line.qty));
  }

  const promoByProduct=new Map(rule.drinks.map(drink=>[drink.productId,drink] as const));
  const remaining={...mainUnits};
  const output:T[]=[];

  for(const line of input){
    const promo=promoByProduct.get(line.productId);
    if(!promo||isPairedComboLine(line)){
      output.push(line);
      continue;
    }
    const product=lineProduct(line,catalogs);
    const cleanDetail=withoutPromoDetail(line.detail);
    const normal=standalonePrice({...line,detail:cleanDetail},catalogs);
    const optionAdjustment=product?normal-product.priceMinor:0;
    const qty=Math.max(0,Math.floor(line.qty));

    for(let index=0;index<qty;index++){
      const eligible=remaining[line.serviceMode]>0;
      if(eligible)remaining[line.serviceMode]-=1;
      const unitMinor=eligible?promo.promoPriceMinor+optionAdjustment:normal;
      output.push({
        ...line,
        id:normalizedUnitId(line,index),
        qty:1,
        unitMinor,
        detail:(eligible?withPromoDetail(cleanDetail):cleanDetail)||undefined,
      } as T);
    }
  }
  return output;
}

export function riceballDrinkPromotionStateEqual(
  left:readonly PromoCartLine[],
  right:readonly PromoCartLine[],
){
  if(left.length!==right.length)return false;
  for(let index=0;index<left.length;index++){
    const a=left[index]!,b=right[index]!;
    if(a.id!==b.id||a.productId!==b.productId||a.qty!==b.qty||a.unitMinor!==b.unitMinor||a.serviceMode!==b.serviceMode||(a.detail??'')!==(b.detail??''))return false;
  }
  return true;
}
