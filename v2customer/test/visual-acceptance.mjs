const params=new URLSearchParams(location.search);
const scenario=params.get('scenario')??'populated';
const stage=params.get('stage')??'READY';
const quoteFreshness=params.get('quote')??'CURRENT';
const now=new Date().toISOString();

if(params.get('motion')==='reduce'){
  const nativeMatchMedia=window.matchMedia.bind(window);
  Object.defineProperty(window,'matchMedia',{configurable:true,value:(query)=>query==='(prefers-reduced-motion: reduce)'?{
    matches:true,media:query,onchange:null,
    addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},
  }:nativeMatchMedia(query)});
  document.documentElement.dataset.acceptanceMotion='reduce';
  const style=document.createElement('style');
  style.textContent='html[data-acceptance-motion="reduce"] *,html[data-acceptance-motion="reduce"] *::before,html[data-acceptance-motion="reduce"] *::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}';
  document.head.append(style);
}

const products=[
  {
    productId:'product-rice-01',categoryId:'rice',name:'紫米照燒雞便當',description:'嫩滑雞腿、紫米飯與時蔬，甜鹹照燒收得剛好。',badge:'人氣之選',available:true,displayPriceLabel:'HK$68',imageUrl:'/brand/mf-home-hero-bowl.webp',imageAlt:'紫米照燒雞便當',variationRequired:true,
    variations:[{variationId:'regular',name:'標準份量',available:true},{variationId:'large',name:'加大份量',available:true}],
    optionGroups:[
      {optionGroupId:'rice-choice',name:'米飯選擇',required:true,minSelections:1,maxSelections:1,options:[{optionId:'purple-rice',name:'紫米飯',available:true},{optionId:'white-rice',name:'白飯',available:true}]},
      {optionGroupId:'sauce-choice',name:'醬汁份量',required:true,minSelections:1,maxSelections:1,options:[{optionId:'regular-sauce',name:'正常醬汁',available:true},{optionId:'less-sauce',name:'少汁',available:true},{optionId:'separate-sauce',name:'醬汁分開',available:false}]},
      {optionGroupId:'addons',name:'加配',required:false,minSelections:0,maxSelections:2,options:[{optionId:'egg',name:'溫泉蛋',available:true},{optionId:'veg',name:'加時蔬',available:true},{optionId:'soup',name:'是日湯',available:true}]},
    ],
  },
  {
    productId:'product-chicken-02',categoryId:'rice',name:'香草烤雞暖沙律',description:'烤雞、南瓜、時令蔬菜與清新香草醬。',badge:'店長推介',available:true,displayPriceLabel:'HK$72',imageUrl:'/brand/mf-home-hero-f4.webp',imageAlt:'香草烤雞暖沙律',optionGroups:[{optionGroupId:'dressing',name:'醬汁',required:true,minSelections:1,maxSelections:1,options:[{optionId:'herb',name:'香草醬',available:true},{optionId:'sesame',name:'芝麻醬',available:true}]}],
  },
  {
    productId:'product-salad-03',categoryId:'light',name:'柑橘時蔬沙律',description:'爽脆葉菜、柑橘與烤種子，清新又有層次。',badge:'清新之選',available:true,displayPriceLabel:'HK$58',imageUrl:'/brand/mf-home-hero-salad.webp',imageAlt:'柑橘時蔬沙律',optionGroups:[{optionGroupId:'protein',name:'蛋白質',required:false,minSelections:0,maxSelections:1,options:[{optionId:'tofu',name:'烤豆腐',available:true},{optionId:'chicken',name:'香草雞',available:true}]}],
  },
  {
    productId:'product-soup-04',categoryId:'light',name:'南瓜濃湯',description:'慢煮南瓜與洋蔥，口感柔滑。',badge:'期間限定',available:false,displayPriceLabel:'HK$36',optionGroups:[],
  },
];

const cartLine={
  lineId:'local-line-01',productId:'product-rice-01',productName:'紫米照燒雞便當',quantity:2,selectedVariationId:'regular',selectedVariationName:'標準份量',
  selections:[{optionGroupId:'rice-choice',optionId:'purple-rice',optionName:'紫米飯'},{optionGroupId:'sauce-choice',optionId:'less-sauce',optionName:'少汁'}],note:'醬汁請分開放。',createdAt:now,
};

const workspace={
  schemaVersion:1,storageKind:'LOCAL_NON_AUTHORITATIVE',cart:scenario==='empty'?[]:[cartLine],checkout:{name:'阿晴',phone:'91234567'},pendingIntents:[],preferences:{activeView:'home',activeCategoryId:'rice'},updatedAt:now,
};

if(scenario==='pending'||scenario==='unknown'){
  workspace.preferences.activeView='checkout';
  workspace.pendingIntents=[{submissionId:'internal-acceptance-submission',idempotencyKey:'customer-order:internal-acceptance-submission',createdAt:now,updatedAt:now,state:scenario==='pending'?'PENDING':'UNKNOWN',cart:[cartLine],checkout:workspace.checkout,lastMessage:scenario==='pending'?'等待店舖確認提交結果':'提交結果仍在確認'}];
}
localStorage.setItem('mfk:customer:workspace:v1',JSON.stringify(workspace));

const orderStage=stage;
const timeline=[
  {at:now,stage:'RECEIVED',label:'店舖已收到',detail:'等待店舖正式確認。'},
  ...(orderStage==='RECEIVED'?[]:[{at:now,stage:'ACCEPTED',label:'店舖已接單',detail:'餐點會按次序製作。'}]),
  ...(['PREPARING','DELAYED','READY','PICKUP_VERIFICATION','HANDED_OVER','COMPLETED'].includes(orderStage)?[{at:now,stage:'PREPARING',label:'製作中',detail:'廚房正在準備餐點。'}]:[]),
  ...(['READY','PICKUP_VERIFICATION','HANDED_OVER','COMPLETED'].includes(orderStage)?[{at:now,stage:'READY',label:'可取餐',detail:'請到店出示取餐碼。'}]:[]),
];

window.__MFK_CUSTOMER_PRODUCT_PORT__={
  portId:'MFK_CUSTOMER_PORT_V1',
  async readSnapshot(){
    return {
      store:{storeId:'store-01',storeName:'磨飯 · 中環',channelAvailable:true,etaLabel:'約 18–25 分鐘',notice:'午市時段餐點即叫即製。',observedAt:now},
      menu:{revision:'menu-r2',observedAt:now,categories:[{categoryId:'rice',name:'暖飯',sortOrder:1},{categoryId:'light',name:'輕盈',sortOrder:2}],products},
      activeOrders:scenario==='noorder'?[]:[{orderId:'order-current-01',displayCode:'MF 038',stage:orderStage,itemSummary:'紫米照燒雞便當 × 2',amountLabel:'HK$136',pickupCode:'5382',phoneMasked:'9*** 4567',etaLabel:orderStage==='DELAYED'?'13:12（已更新）':'12:48',handoverState:orderStage==='HANDED_OVER'||orderStage==='COMPLETED'?'HANDED_OVER':orderStage==='PICKUP_VERIFICATION'?'VERIFIED':'NOT_ARRIVED',observedAt:now,readback:'CONFIRMED',timeline}],
      history:[{orderId:'order-history-01',displayCode:'MF 021',completedAt:'2026-09-18T05:20:00.000Z',itemSummary:'香草烤雞暖沙律、柑橘時蔬沙律',amountLabel:'HK$130',reorderEligible:true},{orderId:'order-history-02',displayCode:'MF 014',completedAt:'2026-09-07T04:05:00.000Z',itemSummary:'紫米照燒雞便當',amountLabel:'HK$68',reorderEligible:true}],
      member:{state:'READY',displayName:'阿晴',memberLabel:'磨飯記憶會員',lastVisitLabel:'上次返嚟：9 月 18 日',observedAt:now,preferences:['少汁','唔食青瓜','飲品走冰'],frequentTasteLabels:['紫米飯','香草雞','清新酸甜'],careMessage:'上次等耐咗，我哋想補返一點心意。',seeds:{state:'READY',valueLabel:'18 粒',progressLabel:'正式會員進度已更新',nextBenefitLabel:'再累積一段回憶，就會見到新心意',history:[{label:'完成中環自取訂單',occurredAt:'2026-09-18T05:20:00.000Z'},{label:'完成金鐘自取訂單',occurredAt:'2026-09-07T04:05:00.000Z'}]},coupons:[{couponId:'coupon-01',name:'一份小食心意',state:'AVAILABLE',detail:'落單時由正式優惠規則確認適用範圍。',expiryLabel:'10 月 31 日前'},{couponId:'coupon-02',name:'下一段回憶',state:'LOCKED',detail:'解鎖條件由正式會員資料提供。'}],badges:[{badgeId:'badge-01',name:'第一口記憶',state:'EARNED',detail:'完成第一次正式訂單。',earnedAt:'2026-07-21T04:00:00.000Z'},{badgeId:'badge-02',name:'紫米同路人',state:'EARNED',detail:'一段真實嘅紫米回憶。',earnedAt:'2026-09-18T05:20:00.000Z'},{badgeId:'badge-03',name:'四季味道',state:'LOCKED',progressLabel:'進度由正式會員資料提供。'}]},
      observedAt:now,
    };
  },
  async quoteCart(){return {quoteId:'quote-01',revision:'quote-r2',currency:'HKD',totalMinor:13600,observedAt:now,freshness:quoteFreshness};},
  async submitOrder(intent){
    if(params.get('submit')==='pending')return new Promise(()=>{});
    return {state:'UNKNOWN',message:'正在確認訂單結果，請勿重複提交。'};
  },
  async readSubmission(){return {state:'UNKNOWN',message:'店舖結果仍在確認，未有重新提交。'};},
  async buildReorderCart(){return {state:'CONFIRMED',message:'已按目前菜單重新驗證。',cart:[cartLine],attention:[]};},
  async requestFallback(){return {state:'NOT_CONNECTED',message:'備用聯絡方法尚未連接。'};},
};

await import('../src/main.tsx');
