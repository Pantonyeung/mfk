export type DonorStatus='WIRED_CURRENT'|'READ_ONLY_CURRENT'|'NEEDS_ADAPTER'|'DEFERRED'|'RETIRED';

export interface AdminCapability{
  readonly id:string;
  readonly label:string;
  readonly donorPath?:string;
  readonly mfkPath:string;
  readonly status:DonorStatus;
  readonly owner:'ADMIN_CONFIG'|'STORE_EXECUTION'|'REPORTING'|'AUTH'|'CHANNEL'|'PRINT_LOGICAL'|'PRESENTATION';
  readonly note:string;
}
export interface AdminCapabilityGroup{
  readonly id:string;
  readonly label:string;
  readonly capabilities:readonly AdminCapability[];
}

const c=(id:string,label:string,donorPath:string|undefined,mfkPath:string,status:DonorStatus,owner:AdminCapability['owner'],note:string):AdminCapability=>({
  id,label,donorPath,mfkPath,status,owner,note,
});

export const ADMIN_CAPABILITY_GROUPS:readonly AdminCapabilityGroup[]=[
  {id:'overview',label:'首頁',capabilities:[
    c('overview','營運總覽','/admin/overview','/admin/overview','READ_ONLY_CURRENT','REPORTING','保留 donor 首頁骨架；只讀 MFK read models。'),
  ]},
  {id:'operations',label:'營運',capabilities:[
    c('open-orders','進行中訂單','/admin/orders/open','/admin/orders/open','READ_ONLY_CURRENT','STORE_EXECUTION','Admin 只監察；Order mutation 仍由交易主權處理。'),
    c('availability','售罄／供應','/admin/availability','/admin/availability','NEEDS_ADAPTER','ADMIN_CONFIG','Owner-defined sellability policy 由 Admin 發布；現場操作另走執行 seam。'),
    c('capacity','每日產能／原料額度','/admin/operations/capacity','/admin/operations/capacity','NEEDS_ADAPTER','ADMIN_CONFIG','配置能力保留，禁止變成交易 blocker。'),
    c('inventory','庫存統計','/admin/operations/inventory','/admin/operations/inventory','DEFERRED','REPORTING','保留入口；V1 唔以 inventory 阻交易。'),
    c('business-day','營業日／交更','/admin/business-day','/admin/business-day','NEEDS_ADAPTER','ADMIN_CONFIG','Admin 發布分界時間；Business Day 永不阻交易。'),
  ]},
  {id:'products',label:'商品',capabilities:[
    c('products','商品資料','/admin/catalog/products','/admin/catalog/products','NEEDS_ADAPTER','ADMIN_CONFIG','Product authoring 由 MFK Admin 重新定義。'),
    c('categories','商品分類','/admin/catalog/categories','/admin/catalog/categories','NEEDS_ADAPTER','ADMIN_CONFIG','Category authoring / ordering。'),
    c('modifiers','選項／加料','/admin/catalog/modifiers','/admin/catalog/modifiers','NEEDS_ADAPTER','ADMIN_CONFIG','Modifier Group / Option / required / min-max / delta。'),
    c('pricing','價格管理','/admin/catalog/pricing','/admin/catalog/pricing','NEEDS_ADAPTER','ADMIN_CONFIG','Admin 只發布 Pricing config；計價仍由唯一 Pricing authority。'),
    c('combo','套餐','/admin/catalog/combos','/admin/catalog/combos','NEEDS_ADAPTER','ADMIN_CONFIG','Combo sections / child refs / rules / display order。'),
    c('menu-sort','Menu／顯示排序','/admin/catalog/menu-display','/admin/catalog/menu-display','NEEDS_ADAPTER','ADMIN_CONFIG','Published Menu presentation order。'),
    c('customer-presentation','客戶端首頁','/admin/presentation/customer-home','/admin/presentation/customer-home','DEFERRED','PRESENTATION','保留 donor surface，後續接 Customer presentation。'),
    c('owner-presentation','Owner 今日首頁','/admin/presentation/owner-home','/admin/presentation/owner-home','DEFERRED','PRESENTATION','保留 donor surface。'),
    c('frontline-presentation','SMT／SMM 點單版面','/admin/presentation/frontline-ordering','/admin/presentation/frontline-ordering','DEFERRED','PRESENTATION','只可發布 presentation config；唔改交易主權。'),
  ]},
  {id:'orders',label:'訂單',capabilities:[
    c('orders-history','訂單歷史','/admin/orders/history','/admin/orders/history','READ_ONLY_CURRENT','REPORTING','只讀 canonical Order history。'),
    c('exceptions','退款／異常','/admin/orders/exceptions','/admin/orders/exceptions','NEEDS_ADAPTER','STORE_EXECUTION','Admin 提供受權入口；真正 mutation 仍由 canonical order/payment/refund domain。'),
  ]},
  {id:'print',label:'打印',capabilities:[
    c('print-center','打印中心','/admin/print','/admin/print','NEEDS_ADAPTER','PRINT_LOGICAL','Admin 只定 logical printer / capability / routing policy。'),
    c('print-templates','打印模板中心','/admin/print/templates','/admin/print/templates','NEEDS_ADAPTER','PRINT_LOGICAL','模板與輸出規則由 Admin 發布；實體 IP/USB 留 SMT。'),
  ]},
  {id:'channels',label:'平台',capabilities:[
    c('channel-overview','平台管理',undefined,'/admin/inventory/channel-overview','NEEDS_ADAPTER','CHANNEL','舊 donor pending；MFK 重新定義。'),
    c('net-estimate','實收估算設定','/admin/channels/net-estimate','/admin/channels/net-estimate','NEEDS_ADAPTER','CHANNEL','只作平台估算 config；不可冒充 settlement truth。'),
    c('store-binding','門店授權映射',undefined,'/admin/inventory/store-binding','DEFERRED','CHANNEL','保留能力清單。'),
    c('product-mapping','商品映射管理','/admin/channels/product-mapping','/admin/channels/product-mapping','NEEDS_ADAPTER','CHANNEL','External identity → MFK Product/Option identity。'),
    c('mapping-failure','匹配失敗明細',undefined,'/admin/inventory/mapping-failure','NEEDS_ADAPTER','CHANNEL','異常 projection / action queue。'),
    c('accept-policy','接單／自動接單',undefined,'/admin/inventory/accept-policy','NEEDS_ADAPTER','CHANNEL','正常單自動 admission；異常 Pending。'),
    c('sync-policy','售罄／庫存同步',undefined,'/admin/inventory/sync-policy','NEEDS_ADAPTER','CHANNEL','沿 sellability authority，不另建 inventory engine。'),
  ]},
  {id:'members',label:'會員',capabilities:[
    c('members','Customer 360','/admin/members/customer360','/admin/members/customer360','DEFERRED','REPORTING','保留 donor surface；非目前交易主線。'),
    c('loyalty','會員等級／積分',undefined,'/admin/inventory/loyalty','DEFERRED','ADMIN_CONFIG','後續能力。'),
    c('coupons','優惠券',undefined,'/admin/inventory/coupons','DEFERRED','ADMIN_CONFIG','後續能力。'),
  ]},
  {id:'reports',label:'報表',capabilities:[
    c('sales-report','銷售報表','/admin/reports/sales','/admin/reports/sales','READ_ONLY_CURRENT','REPORTING','只讀 current effective reporting facts。'),
    c('operations-report','營運報表','/admin/reports/operations','/admin/reports/operations','READ_ONLY_CURRENT','REPORTING','只讀 projection。'),
    c('rfm-report','RFM 客戶分析','/admin/reports/rfm','/admin/reports/rfm','DEFERRED','REPORTING','保留 donor surface。'),
  ]},
  {id:'store',label:'門店',capabilities:[
    c('store-settings','門店設定','/admin/store/settings','/admin/store/settings','NEEDS_ADAPTER','ADMIN_CONFIG','Owner-managed Store config。'),
    c('staff','員工／權限','/admin/staff','/admin/staff','NEEDS_ADAPTER','AUTH','沿 MFK Auth/RBAC，唔直接復活 legacy session writer。'),
    c('announcement','公告／通知',undefined,'/admin/inventory/announcement','DEFERRED','ADMIN_CONFIG','保留能力。'),
  ]},
  {id:'system',label:'系統',capabilities:[
    c('audit','操作記錄','/admin/system/audit','/admin/system/audit','READ_ONLY_CURRENT','REPORTING','不可變 audit projection。'),
    c('advanced','進階／原材料',undefined,'/admin/inventory/advanced','DEFERRED','ADMIN_CONFIG','保留能力，不阻 P0。'),
  ]},
];

export const ADMIN_CAPABILITIES=ADMIN_CAPABILITY_GROUPS.flatMap(group=>group.capabilities);
export function findAdminCapability(pathname:string){
  return ADMIN_CAPABILITIES.find(capability=>pathname===capability.mfkPath||pathname.startsWith(capability.mfkPath+'/'));
}
