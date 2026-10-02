import type {CustomerLongHomeVM} from './home-model';

export const PREVIEW_HOME:CustomerLongHomeVM=Object.freeze({
  storeStatus:'open',
  storeStatusLabel:'營業中',
  searchPlaceholder:'搜尋餐點…',
  quickCards:Object.freeze([
    {id:'featured',title:'今日精選',subtitle:'主廚推薦\n天天新驚喜',tone:'cream'},
    {id:'popular',title:'人氣組合',subtitle:'美味搭配\n更多滿足',tone:'blue'},
    {id:'offer',title:'期間限定',subtitle:'限定登場\n錯過要再等',tone:'purple'},
    {id:'pickup',title:'30分鐘內可取',subtitle:'點餐方法\n一眼睇明',tone:'mint'}
  ] as const),
  recentOrder:Object.freeze({itemSummary:'經典手作輕食組合',orderedAtLabel:'2024/05/20 12:28'})
});
