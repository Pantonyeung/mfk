export const RICEBALL_DRINK_PROMOTION_STORAGE_KEY='pricing-promotions.v1' as const;

export const RICEBALL_DRINK_PROMOTION_R1=Object.freeze({
  schema:'MFK_RICEBALL_DRINK_PROMOTION_V1',
  id:'riceball-standalone-drink-promo',
  active:true,
  source:'Owner menu poster 2026-05-30 + Owner confirmation 2026-09-26',
  eligibleMainPoolIds:Object.freeze([
    'combo-rice-pool-a',
    'combo-rice-pool-b',
    'combo-rice-pool-c',
    'combo-rice-pool-d',
  ]),
  ratio:Object.freeze({mainUnits:1,drinkUnits:1}),
  drinks:Object.freeze([
    Object.freeze({productId:'02d54674-feb5-571d-b8ac-2668bd2fc1d5',label:'冰菊普洱茶',promoPrice:'13.00'}),
    Object.freeze({productId:'ad3fe24f-2617-52d3-8416-031269e5f122',label:'日式玄米茶',promoPrice:'13.00'}),
    Object.freeze({productId:'28bc7c84-0e43-5e32-a5c1-ea78b25a0abc',label:'限定茶',promoPrice:'13.00'}),
    Object.freeze({productId:'bf2334d9-5ffb-5d7d-b454-279cc640a23d',label:'磨飯氣泡水',promoPrice:'13.00'}),
    Object.freeze({productId:'dcf1a976-ec1d-5d24-bc64-ab9d0a15fa02',label:'台式奶茶',promoPrice:'16.00'}),
    // Owner correction: poster label 手打檸檬茶 is the same canonical product as this existing Product ID.
    Object.freeze({productId:'b3529ce7-9b4e-5d20-9e1e-e4ef68319561',label:'手打檸檬茶',promoPrice:'17.00'}),
  ]),
});

export const DEFAULT_PRICING_PROMOTIONS=Object.freeze({
  riceballDrink:RICEBALL_DRINK_PROMOTION_R1,
});
