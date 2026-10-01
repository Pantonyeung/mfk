import type {CustomerLongHomeVM} from './home-model';
import {CUSTOMER_V3_ASSETS as A} from './assets';

export const PREVIEW_HOME:CustomerLongHomeVM=Object.freeze({
  locationLabel:'香港・元朗',
  searchPlaceholder:'搜尋餐點、飲品…',
  quickCards:Object.freeze([
    {id:'featured',title:'今日精選',subtitle:'主廚推薦\n天天新驚喜',icon:'👑',tone:'cream'},
    {id:'popular',title:'人氣組合',subtitle:'美味搭配\n更多滿足',icon:'🛍️',tone:'blue'},
    {id:'offer',title:'限時優惠',subtitle:'把握機會\n美味不等人',icon:'⏰',tone:'purple'},
    {id:'pickup',title:'30分鐘內可取',subtitle:'美味即時\n輕鬆帶走',icon:'⏱️',tone:'mint'}
  ]),
  categories:Object.freeze([
    {id:'breakfast',title:'早餐',subtitle:'開啟美好的一天',icon:'🍞',tone:'cream'},
    {id:'meal',title:'輕食飯餐',subtitle:'營養均衡好滿足',icon:'🥗',tone:'blue'},
    {id:'snack',title:'小食',subtitle:'好食停唔到',icon:'🍟',tone:'purple'},
    {id:'drink',title:'飲品',subtitle:'為生活加點甜',icon:'🥤',tone:'blue'},
    {id:'dessert',title:'甜點',subtitle:'療癒每一刻',icon:'🧁',tone:'pink'}
  ]),
  products:Object.freeze([
    {id:'p1',name:'經典雞肉三明治',description:'新鮮生菜・香煎雞胸',price:'$85',imageUrl:A.chefProduct01},
    {id:'p2',name:'地中海鮮蔬飯',description:'清爽美味・營養滿分',price:'$120',imageUrl:A.chefProduct02},
    {id:'p3',name:'奶油野菇義大利麵',description:'濃郁香氣・手作醬汁',price:'$130',imageUrl:A.chefProduct03},
    {id:'p4',name:'繽紛水果優格碗',description:'新鮮水果・健康輕食',price:'$95',imageUrl:A.chefProduct04}
  ]),
  pointsLabel:'1,250 積分',
  inviteRewardLabel:'各得 $50 購物金',
  recentOrder:Object.freeze({itemSummary:'經典手作輕食組合',orderedAtLabel:'2024/05/20 12:28'})
});
