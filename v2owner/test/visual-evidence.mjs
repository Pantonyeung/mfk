import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const baseURL=process.env.OWNER_VISUAL_URL||'http://127.0.0.1:4173';
const out=path.resolve('artifacts/owner-p0-final-visual');
await mkdir(out,{recursive:true});

const observedAt='2026-09-28T12:10:00+08:00';
const snapshot={
  globalState:'FRESH',
  store:{storeId:'MF01',storeName:'磨飯－元朗',businessDate:'2026-09-28',operatingStatus:'營業中',observedAt,freshness:'CURRENT'},
  today:{salesLabel:'HK$ 6,842',orderCount:86,averageOrderLabel:'HK$ 79.6',comparisonLabel:'較上週同日 +12%',staffNow:3,scheduledStaffCount:4,onBreakStaffCount:0,abnormalStaffCount:0},
  insight:{topProductLabel:'紫米飯團 C · 18 份',currentHourTrendLabel:'午市較上週同日 +9%',observedAt,freshness:'CURRENT'},
  liveOrders:{activeCount:12,attentionCount:2,readyCount:4,observedAt,recentOrders:[
    {orderId:'o1',displayCode:'001',source:'自家客戶端',amountLabel:'HK$ 88',fulfillmentLabel:'製作中',elapsedLabel:'8 分鐘',promisedTimeLabel:'12:20'},
    {orderId:'o2',displayCode:'002',source:'Keeta',amountLabel:'HK$ 120',fulfillmentLabel:'準備出餐',elapsedLabel:'10 分鐘',promisedTimeLabel:'12:18',exceptionBadge:'需留意'},
    {orderId:'o3',displayCode:'003',source:'Foodpanda',amountLabel:'HK$ 76',fulfillmentLabel:'可取餐',elapsedLabel:'13 分鐘',promisedTimeLabel:'12:15'},
  ]},
  dineIn:{activeCheckCount:3,unpaidCheckCount:2,estimatedOpenAmountLabel:'HK$ 246',oldestOpenAgeLabel:'18 分鐘',includedInEffectiveSales:false,observedAt,openChecks:[
    {checkId:'c1',displayCode:'D016',tableLabel:'堂食 03',openedAt:observedAt,currentOrderTotalLabel:'HK$ 126',confirmedPaidLabel:'HK$ 0',outstandingLabel:'HK$ 126',paymentState:'UNPAID'},
    {checkId:'c2',displayCode:'D017',tableLabel:'堂食 05',openedAt:observedAt,currentOrderTotalLabel:'HK$ 120',confirmedPaidLabel:'HK$ 60',outstandingLabel:'HK$ 60',paymentState:'PARTIAL'},
  ]},
  readiness:[
    {id:'net',kind:'INTERNET',label:'網絡',value:'HEALTHY',tone:'GOOD',observedAt},
    {id:'keeta',kind:'KEETA',label:'Keeta',value:'HEALTHY',tone:'GOOD',observedAt},
    {id:'own',kind:'OWN_PLATFORM',label:'自家平台',value:'HEALTHY',tone:'GOOD',observedAt},
    {id:'smt',kind:'SMT',label:'SMT',value:'HEALTHY',tone:'GOOD',observedAt},
    {id:'printer',kind:'PRINTER',label:'打印機',value:'DEGRADED',tone:'WARN',observedAt},
  ],
  actions:[
    {actionId:'a1',severity:'URGENT',domain:'CHANNEL',title:'Keeta 接單連接中斷',detail:'最近 7 分鐘未能正常接收新單。',target:'Keeta',certainty:'CONFIRMED',safeNextStepLabel:'查看渠道狀態',elapsedLabel:'7 分鐘',state:'OPEN',observedAt:'2026-09-28T12:03:00+08:00'},
    {actionId:'a2',severity:'ATTENTION',domain:'PRINT',title:'製作單打印需要處理',detail:'其中一條打印路線未完成。',target:'訂單 002',certainty:'PARTIAL',safeNextStepLabel:'查看打印狀態',elapsedLabel:'4 分鐘',state:'OPEN',observedAt:'2026-09-28T12:06:00+08:00'},
  ],
  orders:[
    {orderId:'o1',displayCode:'001',source:'自家客戶端',lifecycle:'OPEN',workflowStatusLabel:'製作中',businessDate:'2026-09-28',customerName:'陳先生',customerPhone:'9123 4567',amountLabel:'HK$ 88',originalAmountLabel:'HK$ 88',adjustmentAmountLabel:'HK$ 0',currentEffectiveAmountLabel:'HK$ 88',tenderLabel:'FPS',currentTenderLabel:'FPS',paymentState:'SETTLED',fulfillmentLabel:'進行中',fulfillmentMode:'PICKUP',elapsedLabel:'8 分鐘',promisedTimeLabel:'12:20',itemSummary:'3 件',itemLines:[{lineId:'l1',name:'紫米飯團 A',quantity:1,amountLabel:'HK$ 41',modifierLabels:['牛肉','芝士']},{lineId:'l2',name:'台式炸雞便當',quantity:1,amountLabel:'HK$ 35',modifierLabels:['白飯','走蛋']},{lineId:'l3',name:'台式奶茶',quantity:1,amountLabel:'HK$ 12',modifierLabels:['少冰']}],orderRemark:'少醬／分開包裝',fulfillmentHistory:[{label:'訂單建立',state:'已接單',atLabel:'12:12'},{label:'開始製作',state:'製作中',atLabel:'12:14'}],sideEffects:{receipt:'已打印 12:12',production:'已打印 12:12',packing:'已打印 12:13',label:'已打印 12:13'},auditTrail:[{title:'訂單建立',actorLabel:'系統',atLabel:'12:12',resultLabel:'完成'},{title:'開始製作',actorLabel:'廚房',atLabel:'12:14',resultLabel:'完成'}],readback:'CONFIRMED',observedAt,prints:[],exceptions:[]},
    {orderId:'o2',displayCode:'002',source:'Keeta',lifecycle:'OPEN',workflowStatusLabel:'準備出餐',businessDate:'2026-09-28',customerName:'李小姐',amountLabel:'HK$ 120',currentEffectiveAmountLabel:'HK$ 120',currentTenderLabel:'平台付款',paymentState:'SETTLED',fulfillmentLabel:'可取餐',fulfillmentMode:'PICKUP',elapsedLabel:'10 分鐘',promisedTimeLabel:'12:18',externalProvider:'Keeta',externalRef:'K-89341',itemSummary:'4 件',exceptionBadges:['打印需留意'],readback:'CONFIRMED',observedAt,prints:[],exceptions:[]},
    {orderId:'o3',displayCode:'003',source:'Foodpanda',lifecycle:'COMPLETED',workflowStatusLabel:'已完成',businessDate:'2026-09-28',customerName:'黃先生',amountLabel:'HK$ 76',currentEffectiveAmountLabel:'HK$ 76',currentTenderLabel:'平台付款',paymentState:'SETTLED',fulfillmentLabel:'已完成',fulfillmentMode:'DELIVERY',elapsedLabel:'—',promisedTimeLabel:'12:15',itemSummary:'2 件',readback:'CONFIRMED',observedAt:'2026-09-28T12:05:00+08:00',prints:[],exceptions:[]},
  ],
  channels:[
    {channelId:'keeta',name:'Keeta',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',health:'HEALTHY',mode:'NORMAL',cause:'provider',observedAt,freshness:'CURRENT',readback:'CONFIRMED',controls:{pause:true,resume:false,snooze:true,busy:true}},
    {channelId:'foodpanda',name:'Foodpanda',acceptingOrders:false,desiredState:'PAUSED',observedState:'PAUSED',health:'HEALTHY',mode:'PAUSED',cause:'manual',observedAt,freshness:'CURRENT',lastCommand:{action:'PAUSE',state:'CONFIRMED',completedAt:observedAt},readback:'CONFIRMED',controls:{pause:false,resume:true,snooze:false,busy:false}},
    {channelId:'whatsapp',name:'WhatsApp',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',health:'HEALTHY',mode:'NORMAL',cause:'policy',observedAt,freshness:'CURRENT',readback:'CONFIRMED',controls:{pause:false,resume:false,snooze:false,busy:false}},
    {channelId:'own',name:'自家網站／App',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',health:'HEALTHY',mode:'NORMAL',cause:'policy',observedAt,freshness:'CURRENT',readback:'CONFIRMED',controls:{pause:true,resume:false,snooze:true,busy:true}},
  ],
  sellability:[
    {targetId:'p1',name:'紫米飯團 A',grain:'PRODUCT',state:'SELLABLE',scope:'ALL',quantity:18,observedAt,readback:'CONFIRMED'},
    {targetId:'p2',name:'紫米飯團 B',grain:'PRODUCT',state:'SELLABLE',scope:'ALL',quantity:14,observedAt,readback:'CONFIRMED'},
    {targetId:'p3',name:'紫米飯團 C',grain:'PRODUCT',state:'SOLD_OUT',scope:'ALL',quantity:0,observedAt,readback:'CONFIRMED'},
    {targetId:'p4',name:'紫米飯團 D',grain:'PRODUCT',state:'SELLABLE',scope:'ALL',quantity:11,observedAt,readback:'CONFIRMED'},
    {targetId:'p5',name:'台式炸雞便當',grain:'PRODUCT',state:'SELLABLE',scope:'ALL',quantity:9,observedAt,readback:'CONFIRMED'},
    {targetId:'p6',name:'台式奶茶',grain:'PRODUCT',state:'SOLD_OUT',scope:'ONLINE_ONLY',quantity:0,observedAt,readback:'CONFIRMED'},
  ],
  staff:[
    {staffId:'s1',loginId:'E001',name:'陳小明',role:'店長',presence:'在崗',schedule:'10:00–20:00',capabilitySummary:'店舖營運'},
    {staffId:'s2',loginId:'E002',name:'李小美',role:'廚房',presence:'在崗',schedule:'10:00–16:00',capabilitySummary:'廚房製作'},
    {staffId:'s3',loginId:'E003',name:'張大文',role:'外場',presence:'在崗',schedule:'11:00–20:00',capabilitySummary:'外場'},
    {staffId:'s4',loginId:'E004',name:'王小花',role:'兼職',presence:'請假',schedule:'未有資料',capabilitySummary:'前線協助'},
  ],
  devices:[],reports:[],campaigns:[],settlements:[],inventory:[],notifications:[],
  activity:[
    {activityId:'h1',title:'渠道狀態已檢查',actor:'陳小明',actorStaffId:'s1',linkedActionId:'a1',result:'仍需處理',observedAt},
    {activityId:'h2',title:'打印狀態已檢查',actor:'張大文',actorStaffId:'s3',linkedActionId:'a2',result:'部分完成',observedAt},
  ],
  observedAt,
};

const session={staffId:'owner',loginId:'owner',displayName:'Panton',role:'OWNER',scope:'STORE',permissions:['OWNER_READ'],sessionToken:'x'.repeat(64)};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
await page.addInitScript(({snapshotValue,sessionValue})=>{
  window.__MFK_OWNER_PRODUCT_PORT__={
    portId:'MFK_OWNER_PORT_V1',
    async readOwnerSession(){return sessionValue},
    async readSnapshot(){return snapshotValue},
    async readChannels(){return snapshotValue.channels},
    async readSellability(){return snapshotValue.sellability},
    async requestBoundedAction(){return {state:'CONFIRMED',message:'操作已完成'}},
    async commandSellability(input){
      return {state:'CONFIRMED',message:'已更新',targets:input.targets.map(target=>({targetId:target.targetId,grain:target.grain,state:'CONFIRMED',message:'已確認'}))};
    },
  };
},{snapshotValue:snapshot,sessionValue:session});
await page.goto(baseURL,{waitUntil:'networkidle'});
await page.getByRole('heading',{name:'而家間舖點？'}).waitFor();

async function shot(name){
  await page.screenshot({path:path.join(out,name),fullPage:true});
}
await shot('01_Today_FINAL_390.png');

await page.getByRole('button',{name:/待處理/}).click();
await page.getByRole('heading',{name:'真正要你介入嘅事'}).waitFor();
await shot('02_Action_FINAL_390.png');

await page.getByRole('button',{name:/訂單/}).click();
await page.getByRole('heading',{name:'訂單',exact:true}).waitFor();
await shot('03_Orders_FINAL_390.png');

async function openMore(){
  await page.getByRole('button',{name:/更多/}).click();
  await page.getByRole('heading',{name:'營運工具'}).waitFor();
}
await openMore();
await page.getByRole('button',{name:/^渠道/}).click();
await page.getByRole('heading',{name:'渠道健康'}).waitFor();
await shot('04_Channel_FINAL_390.png');

await openMore();
await page.getByRole('button',{name:/商品供應/}).click();
await page.getByRole('heading',{name:'售罄／恢復'}).waitFor();
await shot('05_Sellability_FINAL_390.png');

await openMore();
await page.getByRole('button',{name:/^員工/}).click();
await page.getByRole('heading',{name:'員工摘要'}).waitFor();
await shot('06_Staff_FINAL_390.png');

for(const width of [360,390,440]){
  await page.setViewportSize({width,height:844});
  await page.waitForTimeout(80);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>1)throw new Error('horizontal overflow at '+width+'px: '+overflow);
}

await browser.close();
console.log('OWNER_VISUAL_EVIDENCE_READY');
