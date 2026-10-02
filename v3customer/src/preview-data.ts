import {CUSTOMER_V3_ASSETS as A} from './assets';
import type {QuickCardId} from './home-model';

export type CustomerRoute=
  |'home'
  |'search'
  |'notifications'
  |'menu'
  |'popular'
  |'offers'
  |'pickup-guide'
  |'product'
  |'jar'
  |'checkout'
  |'orders'
  |'order-detail'
  |'reorder'
  |'profile';

export type PreviewProductTag=QuickCardId;
export type PaymentMethod='cash'|'electronic';

export type PreviewProduct=Readonly<{
  id:string;
  name:string;
  description:string;
  price:number;
  pickupMinutes:number;
  image:string;
  tags:readonly PreviewProductTag[];
}>;

export type JarItem=Readonly<{
  product:PreviewProduct;
  combo:'單點'|'配飲品'|'配小食＋飲品';
  options:readonly string[];
  quantity:number;
  note?:string;
}>;

export const PREVIEW_CUSTOMER_PHONE='9123 4567';
export const pickupCodeFromPhone=(phone:string)=>phone.replace(/\D/g,'').slice(-4);
export const PREVIEW_PICKUP_CODE=pickupCodeFromPhone(PREVIEW_CUSTOMER_PHONE);
export const PREVIEW_FALLBACK_REFERENCE='WA-240926-07';

export const PREVIEW_FEATURED_CAMPAIGN=Object.freeze({
  title:'今日主廚精選',
  eyebrow:'今日精選',
  description:'香草烤雞腿飯配時蔬，以今日新鮮食材即席手作。',
  productId:'herb-chicken',
  ctaLabel:'查看今日精選',
  image:A.salad
});

export const PREVIEW_COUPON=Object.freeze({
  code:'MORE20',
  title:'今日開心減 $20',
  description:'每張訂單只可使用一次',
  discount:20
});

export const PREVIEW_PRODUCTS:readonly PreviewProduct[]=Object.freeze([
  Object.freeze({
    id:'herb-chicken',
    name:'香草烤雞腿飯',
    description:'慢烤雞腿配時蔬與香Q米飯，香草醬汁清新不膩。',
    price:160,
    pickupMinutes:15,
    image:A.salad,
    tags:Object.freeze(['featured','popular','pickup'] as const)
  }),
  Object.freeze({
    id:'fresh-salad',
    name:'香酥雞粒飯',
    description:'香酥雞粒配菜脯、滷蛋與熱飯，口感豐富又有飽足感。',
    price:138,
    pickupMinutes:12,
    image:A.bowl,
    tags:Object.freeze(['featured','pickup'] as const)
  }),
  Object.freeze({
    id:'riceball-set',
    name:'紫薯飯糰組合',
    description:'限時優惠紫薯飯糰，配搭是日飲品，適合輕鬆帶走。',
    price:128,
    pickupMinutes:20,
    image:A.riceball,
    tags:Object.freeze(['popular','offer','pickup'] as const)
  })
]);

export const PREVIEW_NOTIFICATIONS=Object.freeze([
  Object.freeze({id:'ready',title:'可以取餐了',body:`取餐碼 ${PREVIEW_PICKUP_CODE}，餐點已經準備好。`,time:'11:42',tone:'mint'}),
  Object.freeze({id:'preparing',title:'餐點準備中',body:'舖頭正在用心製作你嘅餐點。',time:'11:15',tone:'purple'}),
  Object.freeze({id:'accepted',title:'舖頭已接單',body:'訂單已接收，稍後會更新進度。',time:'11:02',tone:'blue'}),
  Object.freeze({id:'seasonal',title:'限時優惠登場',body:'紫薯飯糰今個星期優惠供應。',time:'09:00',tone:'cream'})
]);

export const PREVIEW_ORDERS=Object.freeze([
  Object.freeze({
    key:'active-preview',displayNumber:'MF-0128',pickupCode:PREVIEW_PICKUP_CODE,status:'準備中',active:true,orderedAt:'今日 12:30',summary:'香草烤雞腿飯・加蛋',total:190,payment:'electronic' as PaymentMethod
  }),
  Object.freeze({
    key:'completed-preview',displayNumber:'MF-0071',pickupCode:PREVIEW_PICKUP_CODE,status:'已完成',active:false,orderedAt:'5月18日 11:45',summary:'日式牛肉飯・凍奶茶',total:160,payment:'cash' as PaymentMethod
  })
]);

export const comboDelta=(combo:JarItem['combo'])=>combo==='單點'?0:combo==='配飲品'?40:80;
export const optionDelta=(options:readonly string[])=>options.reduce((sum,item)=>sum+(item==='加蛋'?15:item==='加芝士'?20:0),0);
export const jarUnitTotal=(item:JarItem)=>item.product.price+comboDelta(item.combo)+optionDelta(item.options);
export const jarTotal=(item:JarItem)=>jarUnitTotal(item)*item.quantity;
export const jarItemsTotal=(items:readonly JarItem[])=>items.reduce((sum,item)=>sum+jarTotal(item),0);
