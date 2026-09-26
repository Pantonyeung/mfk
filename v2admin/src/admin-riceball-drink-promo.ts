import type {AdminSessionDraft} from './admin-draft.tsx';

export const RICEBALL_DRINK_PROMO_STORAGE_KEY='riceball-drink-promo.v1' as const;

export interface RiceballDrinkPromoDraft{
  readonly schema:'MFK_RICEBALL_DRINK_PROMO_V1';
  readonly enabled:boolean;
  readonly drinks:readonly {
    readonly productId:string;
    readonly label:string;
    readonly promoPrice:string;
    readonly active:boolean;
  }[];
}

export const MF01_RICEBALL_DRINK_PROMO_V1:RiceballDrinkPromoDraft=Object.freeze({
  schema:'MFK_RICEBALL_DRINK_PROMO_V1',
  enabled:true,
  drinks:Object.freeze([
    Object.freeze({productId:'02d54674-feb5-571d-b8ac-2668bd2fc1d5',label:'冰菊普洱茶',promoPrice:'13.00',active:true}),
    Object.freeze({productId:'ad3fe24f-2617-52d3-8416-031269e5f122',label:'日式玄米茶',promoPrice:'13.00',active:true}),
    Object.freeze({productId:'28bc7c84-0e43-5e32-a5c1-ea78b25a0abc',label:'限定茶',promoPrice:'13.00',active:true}),
    Object.freeze({productId:'bf2334d9-5ffb-5d7d-b454-279cc640a23d',label:'磨飯氣泡水',promoPrice:'13.00',active:true}),
    Object.freeze({productId:'dcf1a976-ec1d-5d24-bc64-ab9d0a15fa02',label:'台式奶茶',promoPrice:'16.00',active:true}),
    // Owner correction 2026-09-26: 「爆檸·檸茶」 is the same canonical product as 「手打檸檬茶」.
    Object.freeze({productId:'b3529ce7-9b4e-5d20-9e1e-e4ef68319561',label:'手打檸檬茶',promoPrice:'17.00',active:true}),
  ]),
});

export function validateRiceballDrinkPromo(config:RiceballDrinkPromoDraft,catalog:AdminSessionDraft){
  const productIds=new Set(catalog.products.map(product=>product.id));
  const errors:string[]=[];
  if(config.schema!=='MFK_RICEBALL_DRINK_PROMO_V1')errors.push('飯團飲品優惠 schema 不支援');
  const seen=new Set<string>();
  for(const row of config.drinks){
    if(!row.productId||!productIds.has(row.productId))errors.push('飯團飲品優惠 Product 不存在：'+row.productId);
    if(seen.has(row.productId))errors.push('飯團飲品優惠 Product 重複：'+row.productId);
    seen.add(row.productId);
    if(!row.label.trim())errors.push('飯團飲品優惠缺少名稱：'+row.productId);
    const n=Number(row.promoPrice);
    if(!Number.isFinite(n)||n<0)errors.push('飯團飲品優惠價無效：'+row.label);
  }
  return errors;
}
