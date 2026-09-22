import type {OwnerRuntimePort,OwnerReadModelSnapshot} from './product-types';

const observedAt='2026-09-22T13:50:00+08:00';

const snapshot:OwnerReadModelSnapshot={
  store:{storeId:'ACCEPTANCE-MF01',storeName:'磨飯｜驗收樣本店',businessDate:'2026-09-22',observedAt,freshness:'CURRENT'},
  today:{salesLabel:'HK$6,320.00',orderCount:94,averageOrderLabel:'HK$67.20',comparisonLabel:'較上週同日 +8.0%',staffNow:4,attentionCount:3},
  readiness:[
    {id:'R1',label:'本地前線',value:'正常',tone:'GOOD',observedAt},
    {id:'R2',label:'Keeta',value:'降級',tone:'WARN',observedAt},
    {id:'R3',label:'列印',value:'1 項注意',tone:'WARN',observedAt},
  ],
  actions:[
    {actionId:'A-014',severity:'URGENT',domain:'渠道',title:'Keeta 狀態未能確認',detail:'驗收樣本｜Desired 接受新單；Observed UNKNOWN。',target:'Keeta',certainty:'UNKNOWN',actionLabel:'確認處理',observedAt},
    {actionId:'A-013',severity:'ATTENTION',domain:'打印',title:'製作單 Job 結果未明',detail:'驗收樣本｜舊 Job 是否出紙未有證據。',target:'#A101',certainty:'UNKNOWN',actionLabel:'覆核',observedAt},
  ],
  orders:[
    {orderId:'OO-001',displayCode:'#A101',source:'Keeta',lifecycle:'PREPARING',amountLabel:'HK$96.00',tenderLabel:'平台結算',fulfillmentLabel:'外賣自取',externalRef:'K-9981',itemSummary:'紫米飯團 ×2 · 鹽酥雞 ×1',readback:'CONFIRMED',observedAt,prints:['Receipt CONFIRMED','Production UNKNOWN'],exceptions:['Production print unknown'],timeline:['13:25 Received','13:27 Accepted','13:30 Preparing']},
    {orderId:'OO-002',displayCode:'#A100',source:'現場',lifecycle:'COMPLETED',amountLabel:'HK$48.00',tenderLabel:'現金',fulfillmentLabel:'堂食',itemSummary:'肉燥便當 ×1',readback:'PARTIAL',observedAt,prints:['Receipt CONFIRMED'],exceptions:[],timeline:['12:55 Created','13:10 Completed']},
  ],
  channels:[
    {channelId:'CH-KEETA',name:'Keeta',desired:'接受新單',observed:'UNKNOWN',health:'UNKNOWN',freshness:'7 分鐘前',observedAt},
    {channelId:'CH-CUSTOMER',name:'自家客戶端',desired:'接受新單',observed:'ONLINE',health:'HEALTHY',freshness:'剛剛',observedAt},
  ],
  sellability:[
    {targetId:'P-001',name:'驗收樣本｜紫米飯團',grain:'PRODUCT',state:'AVAILABLE',scope:'MF01'},
    {targetId:'P-002',name:'驗收樣本｜限定午餐',grain:'PRODUCT',state:'SOLD_OUT',scope:'MF01'},
  ],
  staff:[
    {staffId:'S1',name:'驗收店員 A',role:'店員',presence:'在場',schedule:'12:00–21:00',permissions:'前線操作'},
    {staffId:'S2',name:'驗收店員 B',role:'主管',presence:'休息中',schedule:'11:00–20:00',permissions:'前線 + 覆核'},
  ],
  devices:[
    {deviceId:'D1',name:'SMT 主機',kind:'POS',health:'HEALTHY',lastSeen:'剛剛',binding:'MF01',jobs:'正常',affected:'—'},
    {deviceId:'D2',name:'製作打印機',kind:'Printer',health:'UNKNOWN',lastSeen:'4 分鐘前',binding:'KITCHEN',jobs:'1 個 UNKNOWN',affected:'#A101'},
  ],
  reports:[
    {reportId:'REP-SALES',name:'銷售',value:'HK$6,320.00',compare:'+8.0%',freshness:'CURRENT'},
    {reportId:'REP-ORDERS',name:'訂單',value:'94',compare:'+6',freshness:'CURRENT'},
    {reportId:'REP-REFUND',name:'退款',value:'HK$120.00',compare:'2 張',freshness:'CURRENT'},
  ],
  customers:{totalLabel:'1,240',newLabel:'84',returningLabel:'61%',consentLabel:'72%',experienceLabel:'4.6 / 5'},
  campaigns:[
    {campaignId:'CAM-1',name:'午市推廣',attributedOrdersLabel:'18',attributedSalesLabel:'HK$1,220.00',fundingLabel:'平台 HK$180',freshness:'CURRENT'},
  ],
  settlements:[
    {channel:'Keeta',salesLabel:'HK$2,180.00',feesLabel:'HK$305.00',payoutLabel:'HK$1,875.00',finality:'ESTIMATED',differenceLabel:'HK$0'},
  ],
  cash:{expectedLabel:'HK$1,540.00',actualLabel:'HK$1,530.00',varianceLabel:'-HK$10.00',closeoutState:'OPEN',observedAt},
  inventory:[
    {itemId:'INV-1',name:'紫米',state:'LOW',detail:'驗收樣本｜低於 Par'},
    {itemId:'INV-2',name:'雞蛋',state:'COUNT_REQUIRED',detail:'驗收樣本｜需要盤點'},
  ],
  notifications:[
    {notificationId:'N1',cadence:'IMMEDIATE',title:'渠道狀態未明',detail:'Keeta 讀回 UNKNOWN',state:'OPEN',observedAt},
    {notificationId:'N2',cadence:'DIGEST',title:'今日摘要',detail:'營業額較上週同日上升',state:'NEW',observedAt},
  ],
  activity:[
    {activityId:'ACT-1',title:'商品停售要求',actor:'驗收主管',requester:'驗收主管',approver:'驗收老闆',result:'REQUESTED',readback:'UNKNOWN',observedAt},
    {activityId:'ACT-2',title:'渠道恢復確認',actor:'驗收老闆',requester:'系統',approver:'驗收老闆',result:'CONFIRMED',readback:'MATCH',observedAt},
  ],
  adminLinkLabel:'Admin',
  observedAt,
};

const port:OwnerRuntimePort={
  portId:'MFK_OWNER_PORT_V1',
  async readSnapshot(){return snapshot},
  async requestBoundedAction(){return {state:'NOT_CONNECTED',message:'驗收環境：遠端有限操作未接線，冇改變任何正式狀態。'}},
  async requestAdminDeepLink(){return {state:'NOT_CONNECTED',message:'驗收環境：Admin 導航未接線；正式 Admin 請用已部署網址。'}},
};

window.__MFK_OWNER_PRODUCT_PORT__=port;
