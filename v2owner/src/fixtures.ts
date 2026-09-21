export type Certainty='CONFIRMED'|'PARTIAL'|'UNKNOWN';
export type ActionItem={
  id:string;severity:'緊急'|'注意'|'資訊';domain:string;title:string;detail:string;
  elapsed:string;target:string;certainty:Certainty;action:string;
};
export type OwnerOrder={
  code:string;source:string;time:string;status:string;readback:Certainty;amount:string;tender:string;
  fulfillment:string;externalRef:string;items:string[];prints:string[];timeline:string[];exceptions:string[];
};
export type ChannelRow={
  id:string;name:string;health:'正常'|'降級'|'未知';desired:string;observed:string;freshness:string;action:string;
};
export type StaffRow={
  id:string;name:string;clock:string;schedule:string;actual:string;breakState:string;hours:string;role:string;permissions:string;
};
export type DeviceRow={
  id:string;name:string;kind:string;health:'正常'|'降級'|'離線'|'未知';lastSeen:string;binding:string;jobs:string;affected:string;
};
export type SellabilityRow={id:string;name:string;grain:string;state:string;scope:string;action:string};
export type ReportRow={id:string;name:string;value:string;compare:string;freshness:string;bars:number[]};
export type NotificationRow={id:string;cadence:'即時'|'摘要'|'收件箱';title:string;detail:string;time:string;state:string};

export const today={
  store:'磨飯｜元朗',
  businessDay:'2026-09-21',
  observedAt:'21:42',
  sales:'$6,320',
  orders:'94',
  aov:'$67.2',
  compare:'+8.0%',
  compareLabel:'較上週同日同期',
  staffNow:'4 人',
  attention:'3 項',
};

export const readiness=[
  {label:'本地前線',value:'正常',tone:'good'},
  {label:'Keeta',value:'降級',tone:'warn'},
  {label:'列印',value:'1 項注意',tone:'warn'},
  {label:'資料',value:'截至 21:42',tone:'plain'},
];

export const actionItems:ActionItem[]=[
  {id:'A-014',severity:'緊急',domain:'渠道',title:'Keeta 狀態未能確認',detail:'Desired：接受新單；Observed：UNKNOWN。唔可假設已恢復。',elapsed:'7 分鐘',target:'Keeta',certainty:'UNKNOWN',action:'確認處理'},
  {id:'A-013',severity:'注意',domain:'打印',title:'製作單路線有 UNKNOWN Job',detail:'舊 Job 是否出紙未有證據；恢復連線唔等於舊 Job 成功。',elapsed:'4 分鐘',target:'#024',certainty:'UNKNOWN',action:'覆核'},
  {id:'A-012',severity:'注意',domain:'交易',title:'付款紀錄需要覆核',detail:'目前只顯示 Review / Correct 形狀；不得由 Owner App 自建付款結果。',elapsed:'2 分鐘',target:'#023',certainty:'PARTIAL',action:'更正／覆核'},
];

export const orders:OwnerOrder[]=[
  {code:'024',source:'Keeta',time:'21:39',status:'未完成',readback:'PARTIAL',amount:'$82',tender:'平台代收｜展示',fulfillment:'製作中',externalRef:'K-98421',items:['紫米飯餐 ×1','鹽酥雞小食 ×1'],prints:['收據：已知成功','製作單：UNKNOWN','打包單：已知成功'],timeline:['21:39 正式單摘要','21:40 製作開始','21:41 Print route UNKNOWN'],exceptions:['A-013 Print UNKNOWN']},
  {code:'023',source:'現場',time:'21:34',status:'可取餐',readback:'CONFIRMED',amount:'$66',tender:'轉數快｜展示',fulfillment:'可取餐',externalRef:'—',items:['紫米飯團套餐 ×1','飲品 ×1'],prints:['收據：已知成功','製作單：已知成功'],timeline:['21:34 正式單摘要','21:36 製作完成','21:37 可取餐'],exceptions:['A-012 付款覆核']},
  {code:'022',source:'自家客戶端',time:'21:20',status:'已取餐',readback:'CONFIRMED',amount:'$58',tender:'門店付款｜展示',fulfillment:'已取餐',externalRef:'C-1732',items:['紫米飯餐 ×1'],prints:['收據：已知成功','製作單：已知成功','打包單：已知成功'],timeline:['21:20 建立摘要','21:24 可取餐','21:31 已取餐'],exceptions:[]},
  {code:'021',source:'電話',time:'20:58',status:'已取餐',readback:'CONFIRMED',amount:'$74',tender:'現金｜展示',fulfillment:'已取餐',externalRef:'—',items:['紫米飯團 ×2'],prints:['收據：已知成功','製作單：已知成功'],timeline:['20:58 正式單摘要','21:05 可取餐','21:12 已取餐'],exceptions:[]},
];

export const channels:ChannelRow[]=[
  {id:'keeta',name:'Keeta',health:'降級',desired:'接受新單',observed:'UNKNOWN',freshness:'7 分鐘前',action:'暫停渠道'},
  {id:'customer',name:'自家客戶端',health:'正常',desired:'接受新單',observed:'接受新單',freshness:'1 分鐘前',action:'暫停渠道'},
  {id:'future',name:'其他外部渠道',health:'未知',desired:'未設定',observed:'UNKNOWN',freshness:'未有讀數',action:'查看'},
];

export const staff:StaffRow[]=[
  {id:'s1',name:'小米粒',clock:'已打卡',schedule:'14:00–22:00',actual:'13:56–進行中',breakState:'已完成休息',hours:'7h 46m',role:'店長',permissions:'營運摘要｜覆核形狀'},
  {id:'s2',name:'阿晴',clock:'已打卡',schedule:'17:00–22:30',actual:'16:58–進行中',breakState:'未休息',hours:'4h 44m',role:'前線',permissions:'點單｜交收'},
  {id:'s3',name:'阿峰',clock:'已打卡',schedule:'18:00–23:00',actual:'18:02–進行中',breakState:'休息中',hours:'3h 40m',role:'製作',permissions:'製作｜打包'},
  {id:'s4',name:'Panton',clock:'已打卡',schedule:'自由',actual:'20:10–進行中',breakState:'—',hours:'1h 32m',role:'Owner',permissions:'Observation｜Bounded Decision'},
];

export const devices:DeviceRow[]=[
  {id:'d1',name:'主收銀 SMT',kind:'POS',health:'正常',lastSeen:'剛剛',binding:'店舖前線執行面',jobs:'—',affected:'0'},
  {id:'d2',name:'廚房製作單機',kind:'Printer',health:'降級',lastSeen:'4 分鐘前',binding:'Logical：製作單',jobs:'1 UNKNOWN',affected:'1 張'},
  {id:'d3',name:'收據機',kind:'Printer',health:'正常',lastSeen:'1 分鐘前',binding:'Logical：收據',jobs:'0 Pending',affected:'0'},
  {id:'d4',name:'飯糰 Label',kind:'Printer',health:'未知',lastSeen:'未有讀數',binding:'Logical：Label',jobs:'UNKNOWN',affected:'未確認'},
];

export const sellability:SellabilityRow[]=[
  {id:'p1',name:'紫米飯團',grain:'Product',state:'供應中',scope:'門店 + Online',action:'售罄'},
  {id:'o1',name:'加鹽酥雞',grain:'Option / Modifier',state:'供應中',scope:'全部渠道',action:'售罄'},
  {id:'c1',name:'套餐小食：脆薯',grain:'Combo Child',state:'暫停供應',scope:'Online',action:'恢復'},
];

export const reports:ReportRow[]=[
  {id:'today',name:'今日營業',value:'$6,320',compare:'+8.0%',freshness:'截至 21:42',bars:[34,48,42,63,71,68,84,77]},
  {id:'time',name:'時段',value:'19:00–20:00 最高',compare:'+12%',freshness:'截至 21:42',bars:[22,31,39,58,82,67,55,43]},
  {id:'product',name:'商品',value:'紫米飯餐 #1',compare:'+9%',freshness:'截至 21:42',bars:[61,75,54,83,66,72,88,80]},
  {id:'channel',name:'渠道',value:'門店 61%',compare:'Keeta 24%',freshness:'截至 21:42',bars:[61,24,15,0,0,0,0,0]},
  {id:'tender',name:'Tender',value:'現金 38%',compare:'轉數快 27%',freshness:'截至 21:42',bars:[38,27,18,17,0,0,0,0]},
  {id:'adjustment',name:'Adjustments',value:'$86',compare:'3 項',freshness:'截至 21:42',bars:[8,14,9,16,11,12,10,6]},
  {id:'labor',name:'Staff / Labor',value:'4 人在場',compare:'27.8 工時',freshness:'截至 21:40',bars:[35,41,48,62,70,68,55,44]},
  {id:'health',name:'Operational Health',value:'2 項需注意',compare:'1 項 UNKNOWN',freshness:'截至 21:42',bars:[90,90,72,68,84,76,88,80]},
];

export const notifications:NotificationRow[]=[
  {id:'n1',cadence:'即時',title:'Keeta 渠道需要注意',detail:'7 分鐘未能確認 observed state。',time:'21:41',state:'未處理'},
  {id:'n2',cadence:'即時',title:'製作單 Job 結果未知',detail:'#024 可能已出紙，禁止自動重印。',time:'21:40',state:'已進待處理'},
  {id:'n3',cadence:'摘要',title:'今日 Staff / Labor 摘要',detail:'4 人在場；目前無 clock exception。',time:'21:30',state:'摘要'},
  {id:'n4',cadence:'收件箱',title:'收據機已恢復',detail:'只代表裝置健康恢復，不代表舊 Job 自動成功。',time:'20:52',state:'歷史'},
];

export const activity=[
  {time:'21:41',actor:'系統',action:'建立待處理摘要',target:'Keeta',result:'UNKNOWN'},
  {time:'21:37',actor:'前線',action:'更新履約狀態',target:'#023',result:'可取餐'},
  {time:'21:31',actor:'前線',action:'交收完成',target:'#022',result:'已取餐'},
  {time:'20:52',actor:'系統',action:'裝置健康恢復',target:'收據機',result:'已恢復'},
];

export const adminLinks=[
  {id:'catalog',label:'商品／Modifier／Combo',detail:'正式結構設定留 Admin'},
  {id:'pricing',label:'Pricing',detail:'價格與規則 authoring 留 Admin'},
  {id:'printer',label:'Printer Registry / Routing',detail:'Logical routing authoring 留 Admin'},
  {id:'rbac',label:'Staff / RBAC',detail:'角色與權限 authoring 留 Admin'},
  {id:'integration',label:'Integration / Mapping',detail:'Credentials / Mapping 留 Admin'},
];

export const recoveryStates=[
  {state:'OFFLINE',meaning:'無 live read；只可顯示 last-known / fixture shape。',action:'不可假裝 command 已送出。'},
  {state:'STALE',meaning:'資料可顯示，但必須標「截至」。',action:'禁止當成 Live truth。'},
  {state:'UNKNOWN',meaning:'無足夠 evidence 判斷結果。',action:'禁止 blind retry。'},
  {state:'PARTIAL',meaning:'部分 domain / route 已有結果，部分未證。',action:'保留已知成功，逐項 readback。'},
  {state:'FAILURE',meaning:'已證實未完成。',action:'只提供 domain-safe recovery presentation。'},
  {state:'RETRY',meaning:'Retry 是否安全由 authority / idempotency 決定。',action:'今輪按鈕只係 NOT_WIRED。'},
];


export const customerOverview={
  newCustomers:'18',
  returningCustomers:'42',
  returningRate:'70%',
  averageSpend:'$68',
  lastUpdated:'21:42',
  consentSummary:'SMS consent：12 已授權 · 其他保持 UNKNOWN',
  experience:'4.6 / 5 · 2 個 unresolved complaint fixture',
} as const;

export const campaignFixtures=[
  {id:'cmp-01',name:'晚市套餐推廣',status:'ACTIVE',channel:'自家渠道',attributedOrders:'14',attributedSales:'$910',merchantCost:'$86',funding:'MERCHANT_FUNDED',freshness:'截至 21:40'},
  {id:'cmp-02',name:'Keeta 平台優惠',status:'PROVIDER_FACT',channel:'Keeta',attributedOrders:'9',attributedSales:'$602',merchantCost:'UNKNOWN',funding:'PROVIDER_FACT_ONLY',freshness:'截至 21:38'},
] as const;

export const platformFinanceFixtures=[
  {provider:'Keeta',orderSales:'$1,520',fees:'$228',merchantAmount:'$1,292',finality:'ESTIMATED',freshness:'截至 21:35',differences:'1 項待覆核'},
  {provider:'自家渠道',orderSales:'$2,104',fees:'—',merchantAmount:'—',finality:'NOT_APPLICABLE',freshness:'截至 21:42',differences:'0'},
] as const;

export const cashOverview={
  effectiveCashTender:'$2,402',
  cashMovementNet:'-$120',
  openDrawerCount:'1',
  pendingCloseout:'1',
  variance:'UNKNOWN / NOT_WIRED',
  lastCloseout:'昨日 22:11',
  responsibleStaff:'前線收銀 · fixture',
} as const;

export const inventoryLiteFixtures=[
  {id:'inv-1',name:'紫米',projected:'8.2 kg',par:'6 kg',state:'OK',lastCount:'昨日 22:05',note:'Projected quantity only'},
  {id:'inv-2',name:'鹽酥雞原料',projected:'1.4 kg',par:'2 kg',state:'ATTENTION',lastCount:'昨日 22:07',note:'Below par = reminder only'},
  {id:'inv-3',name:'飲品杯',projected:'-12',par:'80',state:'RECOUNT',lastCount:'2 日前',note:'Negative quantity ≠ transaction blocker'},
] as const;

export const auditActivityDetails=[
  {time:'21:41',initiatedBy:'系統',authorizedBy:'—',action:'建立 Action Item',target:'Keeta',result:'UNKNOWN',readback:'PROOF_PENDING'},
  {time:'21:37',initiatedBy:'前線',authorizedBy:'前線權限',action:'履約狀態更新',target:'#023',result:'可取餐',readback:'CONFIRMED'},
  {time:'20:52',initiatedBy:'系統',authorizedBy:'—',action:'裝置健康恢復',target:'收據機',result:'RECOVERED',readback:'DEVICE_ONLY'},
] as const;
