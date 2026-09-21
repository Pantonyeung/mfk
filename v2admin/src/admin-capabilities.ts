export type CapabilityStatus='NOT_WIRED'|'DEFERRED'|'RETIRED';

export type MfkAdminOwner=
  |'ADMIN_CONFIG'
  |'STORE_READ_MODEL'
  |'REPORTING'
  |'AUTH'
  |'CHANNEL'
  |'PRINT_LOGICAL'
  |'PRESENTATION'
  |'GOVERNANCE';

export interface AdminCapability{
  readonly id:string;
  readonly label:string;
  readonly path:string;
  readonly status:CapabilityStatus;
  readonly owner:MfkAdminOwner;
  readonly purpose:string;
}

export interface AdminCapabilityGroup{
  readonly id:string;
  readonly label:string;
  readonly capabilities:readonly AdminCapability[];
}

const c=(id:string,label:string,path:string,status:CapabilityStatus,owner:MfkAdminOwner,purpose:string):AdminCapability=>({
  id,label,path,status,owner,purpose,
});

export const ADMIN_CAPABILITY_GROUPS:readonly AdminCapabilityGroup[]=[
  {id:'today',label:'今日',capabilities:[
    c('overview','營運總覽','/admin/overview','NOT_WIRED','REPORTING','每日入口：Readiness、KPI、Pending Changes 同異常摘要；只聚合狀態。'),
    c('action-queue','待處理／異常','/admin/action-queue','NOT_WIRED','GOVERNANCE','集中 actionable facts、UNKNOWN/PARTIAL/STALE 同責任頁 deep-link；唔持有 mutation。'),
  ]},
  {id:'orders',label:'訂單',capabilities:[
    c('open-orders','進行中訂單','/admin/orders/open','NOT_WIRED','STORE_READ_MODEL','只讀正式 Order / Fulfillment 狀態。'),
    c('orders-history','訂單歷史','/admin/orders/history','NOT_WIRED','STORE_READ_MODEL','只讀正式 Order history。'),
    c('exceptions','退款／異常','/admin/orders/exceptions','NOT_WIRED','STORE_READ_MODEL','提供售後／異常治理入口；mutation 留畀唯一對應 authority。'),
    c('availability','售罄／供應','/admin/availability','NOT_WIRED','ADMIN_CONFIG','管理可售政策草稿；唔建立交易 blocker。'),
  ]},
  {id:'menu',label:'菜單',capabilities:[
    c('products','商品資料','/admin/catalog/products','NOT_WIRED','ADMIN_CONFIG','建立及維護 Product 規則。'),
    c('categories','商品分類','/admin/catalog/categories','NOT_WIRED','ADMIN_CONFIG','建立、排序及管理 Category。'),
    c('modifiers','選項／加料','/admin/catalog/modifiers','NOT_WIRED','ADMIN_CONFIG','管理 Modifier Group、Option、必選、多選及價格調整設定。'),
    c('pricing','價格管理','/admin/catalog/pricing','NOT_WIRED','ADMIN_CONFIG','管理 Pricing config；Admin 唔執行正式交易計價。'),
    c('combo','套餐','/admin/catalog/combos','NOT_WIRED','ADMIN_CONFIG','定義 Combo、Section、Child 關係及選擇規則。'),
    c('menu-sort','Menu／顯示排序','/admin/catalog/menu-display','NOT_WIRED','ADMIN_CONFIG','管理 Menu 顯示次序與可見性規則。'),
    c('publish-center','Pending Changes／發布','/admin/publish','NOT_WIRED','ADMIN_CONFIG','Draft → Validate → Impact → Publish → target readback → rollback workflow shape。'),
    c('customer-presentation','客戶端首頁','/admin/presentation/customer-home','DEFERRED','PRESENTATION','管理 Customer presentation config。'),
    c('owner-presentation','Owner 今日首頁','/admin/presentation/owner-home','DEFERRED','PRESENTATION','管理 Owner presentation config。'),
    c('frontline-presentation','前線點單版面','/admin/presentation/frontline-ordering','DEFERRED','PRESENTATION','保留 Frontline presentation config；唔改交易主權。'),
  ]},
  {id:'connections',label:'連接與設備',capabilities:[
    c('channel-overview','平台管理','/admin/channels','NOT_WIRED','CHANNEL','平台狀態、政策同配置入口。'),
    c('net-estimate','實收估算設定','/admin/channels/net-estimate','NOT_WIRED','CHANNEL','設定平台估算規則，不冒充正式 settlement truth。'),
    c('store-binding','門店授權映射','/admin/channels/store-binding','DEFERRED','CHANNEL','管理平台門店與 MFK Store identity 關係。'),
    c('product-mapping','商品映射管理','/admin/channels/product-mapping','NOT_WIRED','CHANNEL','管理 external product/option identity mapping。'),
    c('mapping-failure','匹配失敗明細','/admin/channels/mapping-failure','NOT_WIRED','CHANNEL','顯示 mapping exceptions 同待處理項。'),
    c('accept-policy','接單／自動接單','/admin/channels/accept-policy','NOT_WIRED','CHANNEL','管理 intake policy 草稿。'),
    c('sync-policy','售罄／供應同步','/admin/channels/sync-policy','NOT_WIRED','CHANNEL','管理渠道供應同步政策草稿。'),
    c('settlement','Settlement／對帳','/admin/channels/settlement','NOT_WIRED','CHANNEL','顯示 provider supplied facts 同 reconciliation 差異。'),
    c('device-health','裝置管理','/admin/devices','NOT_WIRED','GOVERNANCE','Device profile / trust / version / config drift presentation。'),
    c('print-center','打印中心','/admin/print','NOT_WIRED','PRINT_LOGICAL','管理 Logical Printer、Capability 同 routing policy。'),
    c('print-templates','打印模板中心','/admin/print/templates','NOT_WIRED','PRINT_LOGICAL','管理票據模板同輸出規則。'),
    c('print-rules','商品／堂食打印規則','/admin/print/rules','NOT_WIRED','PRINT_LOGICAL','管理 Product output flags、堂食打印旗標同 logical route policy。'),
    c('ota','OTA／版本管理','/admin/ota','NOT_WIRED','GOVERNANCE','Approved artifact / observed runtime / rollback evidence presentation。'),
  ]},
  {id:'people',label:'人員',capabilities:[
    c('staff','員工／權限','/admin/staff','NOT_WIRED','AUTH','管理 Staff、Role 同 Admin access config。'),
    c('access-session','登入／Session／Scope','/admin/access','NOT_WIRED','AUTH','PIN、Scope、Admin session、trusted-device/revoke presentation。'),
  ]},
  {id:'reports',label:'報表',capabilities:[
    c('sales-report','銷售報表','/admin/reports/sales','NOT_WIRED','REPORTING','固定可信 Sales read model。'),
    c('product-report','商品報表','/admin/reports/products','NOT_WIRED','REPORTING','固定可信 Product read model。'),
    c('channel-report','渠道報表','/admin/reports/channels','NOT_WIRED','REPORTING','固定可信 Channel read model。'),
    c('refund-report','退款報表','/admin/reports/refunds','NOT_WIRED','REPORTING','固定可信 Refund read model。'),
    c('operations-report','營運報表','/admin/reports/operations','NOT_WIRED','REPORTING','固定可信 Operations read model。'),
    c('export-governance','匯出治理','/admin/reports/export','NOT_WIRED','GOVERNANCE','permission / scope / PII / export hash / audit evidence shape。'),
    c('rfm-report','RFM 客戶分析','/admin/reports/rfm','DEFERRED','REPORTING','保留 RFM 分析入口。'),
  ]},
  {id:'store',label:'門店',capabilities:[
    c('business-day','營業日／交更','/admin/business-day','NOT_WIRED','ADMIN_CONFIG','營業日分界同 record-only policy；永不阻交易。'),
    c('cash-close','現金／收舖記錄','/admin/cash-close','NOT_WIRED','GOVERNANCE','Open/Count/Close/Handover record workflow；attention only。'),
    c('capacity','每日產能／原料額度','/admin/operations/capacity','NOT_WIRED','ADMIN_CONFIG','設定營運容量政策；唔成為交易第二主權。'),
    c('inventory','庫存統計','/admin/operations/inventory','DEFERRED','REPORTING','Inventory Lite 保留，P1；目前唔用 inventory 阻交易。'),
    c('store-settings','門店設定','/admin/store/settings','NOT_WIRED','ADMIN_CONFIG','管理 Store config。'),
    c('quick-reasons','快捷原因','/admin/store/quick-reasons','NOT_WIRED','ADMIN_CONFIG','管理可重用快捷原因；原因保持 optional / non-blocking。'),
    c('announcement','公告／通知','/admin/store/announcements','DEFERRED','ADMIN_CONFIG','保留公告／通知配置。'),
  ]},
  {id:'members',label:'會員',capabilities:[
    c('members','Customer 360','/admin/members/customer360','DEFERRED','REPORTING','CRM Lite 保留，P1。'),
    c('loyalty','會員等級／積分','/admin/members/loyalty','DEFERRED','ADMIN_CONFIG','保留 Loyalty config。'),
    c('coupons','優惠券','/admin/members/coupons','DEFERRED','ADMIN_CONFIG','保留 Coupon config。'),
  ]},
  {id:'system',label:'系統',capabilities:[
    c('audit','操作記錄','/admin/system/audit','NOT_WIRED','REPORTING','只讀 immutable audit activity。'),
    c('diagnostics','Diagnostics','/admin/system/diagnostics','NOT_WIRED','GOVERNANCE','finding / trace / evidence / recovery proof read surface。'),
    c('integrations-governance','Integrations','/admin/system/integrations','NOT_WIRED','GOVERNANCE','credential ref / webhook / schema / replay / delivery-DLQ governance presentation。'),
    c('advanced','進階設定','/admin/system/advanced','NOT_WIRED','ADMIN_CONFIG','effective value / source / override / security floor shape。'),
  ]},
];

export const ADMIN_CAPABILITIES=ADMIN_CAPABILITY_GROUPS.flatMap(group=>group.capabilities);

export function findAdminCapability(pathname:string){
  return ADMIN_CAPABILITIES.find(capability=>pathname===capability.path||pathname.startsWith(capability.path+'/'));
}
