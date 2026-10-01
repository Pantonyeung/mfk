import type {CustomerLongHomeVM} from './home-model';

export const PREVIEW_HOME:CustomerLongHomeVM=Object.freeze({
  locationLabel:'台北市 中正區',
  searchPlaceholder:'搜尋餐點…',
  quickCards:Object.freeze([
    {id:'featured',title:'今日精選',subtitle:'主廚推薦\n天天新驚喜',tone:'cream'},
    {id:'popular',title:'人氣組合',subtitle:'美味搭配\n更多滿足',tone:'blue'},
    {id:'offer',title:'限時優惠',subtitle:'把握機會\n美味不等人',tone:'purple'},
    {id:'pickup',title:'30分鐘內可取',subtitle:'美味即時\n輕鬆帶走',tone:'mint'}
  ] as const),
  recentOrder:Object.freeze({itemSummary:'經典手作輕食組合',orderedAtLabel:'2024/05/20 12:28'})
});
