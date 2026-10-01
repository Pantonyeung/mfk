import {CUSTOMER_V3_ASSETS as A} from './assets';
import type {QuickCardId} from './home-model';

export type CustomerRoute=
  |'home'
  |'search'
  |'notifications'
  |'menu'
  |'product'
  |'jar'
  |'checkout'
  |'orders'
  |'order-detail'
  |'reorder'
  |'profile';

export type MenuCollection='all'|QuickCardId;

export type PreviewProduct=Readonly<{
  id:string;
  name:string;
  description:string;
  price:number;
  pickupMinutes:number;
  image:string;
  tags:readonly MenuCollection[];
}>;

export type JarItem=Readonly<{
  product:PreviewProduct;
  combo:'單點'|'配飲品'|'配小食＋飲品';
  options:readonly string[];
  quantity:number;
}>;

export const PREVIEW_PRODUCTS:readonly PreviewProduct[]=Object.freeze([
  Object.freeze({
    id:'herb-chicken',
    name:'香草烤雞腿飯',
    description:'慢烤雞腿配時蔬與香Q米飯，香草醬汁清新不膩。',
    price:160,
    pickupMinutes:15,
    image:A.salad,
    tags:Object.freeze(['all','featured','popular','pickup'] as const)
  }),
  Object.freeze({
    id:'fresh-salad',
    name:'香酥雞粒飯',
    description:'香酥雞粒配菜脯、滷蛋與熱飯，口感豐富又有飽足感。',
    price:138,
    pickupMinutes:12,
    image:A.bowl,
    tags:Object.freeze(['all','featured','pickup'] as const)
  }),
  Object.freeze({
    id:'riceball-set',
    name:'紫薯飯糰組合',
    description:'期間限定紫薯飯糰，配搭是日飲品，適合輕鬆帶走。',
    price:128,
    pickupMinutes:20,
    image:A.riceball,
    tags:Object.freeze(['all','popular','offer','pickup'] as const)
  })
]);

export const PREVIEW_NOTIFICATIONS=Object.freeze([
  Object.freeze({id:'ready',title:'可以取餐了',body:'取餐編號 A128，餐點已經準備好。',time:'11:42',tone:'mint'}),
  Object.freeze({id:'preparing',title:'餐點準備中',body:'舖頭正在用心製作你嘅餐點。',time:'11:15',tone:'purple'}),
  Object.freeze({id:'accepted',title:'舖頭已接單',body:'訂單已接收，稍後會更新進度。',time:'11:02',tone:'blue'}),
  Object.freeze({id:'seasonal',title:'期間限定登場',body:'紫薯飯糰今個星期限定供應。',time:'09:00',tone:'cream'})
]);

export const PREVIEW_ORDERS=Object.freeze([
  Object.freeze({
    id:'A128',status:'準備中',active:true,orderedAt:'今日 12:30',summary:'香草烤雞腿飯・加蛋',total:190
  }),
  Object.freeze({
    id:'B071',status:'已完成',active:false,orderedAt:'5月18日 11:45',summary:'日式牛肉飯・凍奶茶',total:160
  })
]);

export const COLLECTION_LABELS:Record<MenuCollection,string>={
  all:'全部',
  featured:'今日精選',
  popular:'人氣組合',
  offer:'期間限定',
  pickup:'30分鐘內可取'
};

export const comboDelta=(combo:JarItem['combo'])=>combo==='單點'?0:combo==='配飲品'?40:80;
export const optionDelta=(options:readonly string[])=>options.reduce((sum,item)=>sum+(item==='加蛋'?15:item==='加芝士'?20:0),0);
export const jarUnitTotal=(item:JarItem)=>item.product.price+comboDelta(item.combo)+optionDelta(item.options);
export const jarTotal=(item:JarItem)=>jarUnitTotal(item)*item.quantity;
