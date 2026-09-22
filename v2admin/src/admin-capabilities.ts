export type CapabilityStatus='READY'|'READ_ONLY'|'P1'|'GOVERNANCE';

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
    c('overview','營運總覽','/admin/overview','READY','REPORTING','每日入口：營運準備、核心數字、待發布變更同異常摘要；只顯示狀態。'),
    c('action-queue','待處理／異常','/admin/action-queue','READY','GOVERNANCE','集中需要處理嘅事項同資料狀態，並帶你去相應責任頁；唔會直接改動正式資料。'),
  ]},
  {id:'orders',label:'訂單',capabilities:[
    c('open-orders','進行中訂單','/admin/orders/open','READ_ONLY','STORE_READ_MODEL','只讀正式訂單同出餐狀態。'),
    c('orders-history','訂單歷史','/admin/orders/history','READ_ONLY','STORE_READ_MODEL','只讀正式訂單記錄。'),
    c('exceptions','退款／異常','/admin/orders/exceptions','READ_ONLY','STORE_READ_MODEL','提供售後同異常處理入口；正式操作由相應功能執行。'),
    c('availability','售罄／供應','/admin/availability','READY','ADMIN_CONFIG','管理可售規則草稿；唔會成為交易阻擋。'),
  ]},
  {id:'menu',label:'菜單',capabilities:[
    c('products','商品資料','/admin/catalog/products','READY','ADMIN_CONFIG','建立及維護商品規則。'),
    c('categories','商品分類','/admin/catalog/categories','READY','ADMIN_CONFIG','建立、排序及管理商品分類。'),
    c('modifiers','選項／加料','/admin/catalog/modifiers','READY','ADMIN_CONFIG','管理選項組、選項、必選、多選及價格調整設定。'),
    c('pricing','價格管理','/admin/catalog/pricing','READY','ADMIN_CONFIG','管理價格設定；後台唔直接執行正式交易計價。'),
    c('combo','套餐','/admin/catalog/combos','READY','ADMIN_CONFIG','定義套餐、區段、可選商品關係及選擇規則。'),
    c('menu-sort','Menu／顯示排序','/admin/catalog/menu-display','READY','ADMIN_CONFIG','管理菜單顯示次序同可見性規則。'),
    c('publish-center','Pending Changes／版本','/admin/publish','READY','ADMIN_CONFIG','草稿 → 檢查內容 → 確認影響 → 建立不可變設定版本 → 由歷史版本建立新草稿。'),
    c('customer-presentation','客戶端首頁','/admin/presentation/customer-home','P1','PRESENTATION','管理客戶端首頁顯示設定。'),
    c('owner-presentation','Owner 今日首頁','/admin/presentation/owner-home','P1','PRESENTATION','管理老闆首頁顯示設定。'),
    c('frontline-presentation','前線點單版面','/admin/presentation/frontline-ordering','P1','PRESENTATION','管理前線點單版面顯示設定；唔會改動交易規則。'),
  ]},
  {id:'connections',label:'連接與設備',capabilities:[
    c('channel-overview','平台管理','/admin/channels','READY','CHANNEL','平台狀態、規則同設定入口。'),
    c('net-estimate','實收估算設定','/admin/channels/net-estimate','READY','CHANNEL','設定平台估算規則，唔會當作正式結算結果。'),
    c('store-binding','門店授權映射','/admin/channels/store-binding','READY','CHANNEL','管理平台門店與 MFK Store identity 關係。'),
    c('product-mapping','商品映射管理','/admin/channels/product-mapping','READY','CHANNEL','管理平台商品同選項對應。'),
    c('mapping-failure','匹配失敗明細','/admin/channels/mapping-failure','READY','CHANNEL','顯示商品對應失敗同待處理項。'),
    c('accept-policy','接單／自動接單','/admin/channels/accept-policy','READY','CHANNEL','管理接單規則草稿。'),
    c('sync-policy','售罄／供應同步','/admin/channels/sync-policy','READY','CHANNEL','管理平台供應同步規則草稿。'),
    c('settlement','平台對帳','/admin/channels/settlement','READ_ONLY','CHANNEL','顯示平台提供嘅對帳資料同差異。'),
    c('device-health','裝置管理','/admin/devices','GOVERNANCE','GOVERNANCE','顯示裝置類型、信任狀態、版本同設定差異。'),
    c('print-center','打印中心','/admin/print','READY','PRINT_LOGICAL','管理打印用途、能力同分流規則。'),
    c('print-templates','打印模板中心','/admin/print/templates','READY','PRINT_LOGICAL','管理打印模板同輸出規則。'),
    c('print-rules','商品／堂食打印規則','/admin/print/rules','READY','PRINT_LOGICAL','管理商品輸出、堂食打印同打印分流規則。'),
    c('ota','版本更新','/admin/ota','GOVERNANCE','GOVERNANCE','管理已批准版本、裝置目前版本同還原記錄。'),
  ]},
  {id:'people',label:'人員',capabilities:[
    c('staff','員工／權限','/admin/staff','READY','AUTH','管理員工、角色同後台登入設定。'),
    c('access-session','登入／Session／Scope','/admin/access','GOVERNANCE','AUTH','管理登入碼、權限範圍、登入狀態同可信裝置。'),
  ]},
  {id:'reports',label:'報表',capabilities:[
    c('sales-report','銷售報表','/admin/reports/sales','READ_ONLY','REPORTING','固定可信銷售報表。'),
    c('product-report','商品報表','/admin/reports/products','READ_ONLY','REPORTING','固定可信商品報表。'),
    c('channel-report','渠道報表','/admin/reports/channels','READ_ONLY','REPORTING','固定可信平台報表。'),
    c('refund-report','退款報表','/admin/reports/refunds','READ_ONLY','REPORTING','固定可信退款報表。'),
    c('operations-report','營運報表','/admin/reports/operations','READ_ONLY','REPORTING','固定可信營運報表。'),
    c('export-governance','匯出治理','/admin/reports/export','GOVERNANCE','GOVERNANCE','管理匯出權限、資料範圍、個人資料同操作記錄。'),
    c('rfm-report','客戶分群分析','/admin/reports/rfm','P1','REPORTING','保留客戶分群分析入口。'),
  ]},
  {id:'store',label:'門店',capabilities:[
    c('business-day','營業日／交更','/admin/business-day','READY','ADMIN_CONFIG','營業日分界只作記錄；永不阻交易。'),
    c('cash-close','現金／收舖記錄','/admin/cash-close','READY','GOVERNANCE','開舖／點算／收舖／交更記錄流程；只作提示。'),
    c('capacity','每日產能／原料額度','/admin/operations/capacity','READY','ADMIN_CONFIG','設定營運容量規則；唔會成為另一套交易判斷。'),
    c('inventory','庫存統計','/admin/operations/inventory','P1','REPORTING','Inventory Lite：收貨、調整、損耗、實盤同提示；唔用庫存數量阻交易。'),
    c('store-settings','門店設定','/admin/store/settings','READY','ADMIN_CONFIG','管理門店設定。'),
    c('quick-reasons','快捷原因','/admin/store/quick-reasons','READY','ADMIN_CONFIG','管理可重用快捷原因；原因保持可選，唔會阻交易。'),
    c('announcement','公告／通知','/admin/store/announcements','P1','ADMIN_CONFIG','保留公告／通知配置。'),
  ]},
  {id:'members',label:'會員',capabilities:[
    c('members','顧客資料','/admin/members/customer360','P1','REPORTING','CRM Lite：顧客身份、消費摘要、會員同標籤只讀正式資料。'),
    c('loyalty','會員等級／積分','/admin/members/loyalty','P1','ADMIN_CONFIG','保留會員規則設定。'),
    c('coupons','優惠券','/admin/members/coupons','P1','ADMIN_CONFIG','保留優惠券設定。'),
  ]},
  {id:'system',label:'系統',capabilities:[
    c('audit','操作記錄','/admin/system/audit','READY','REPORTING','只讀操作記錄。'),
    c('diagnostics','系統狀態','/admin/system/diagnostics','GOVERNANCE','GOVERNANCE','顯示異常、記錄同修復證據。'),
    c('integrations-governance','外部連接','/admin/system/integrations','GOVERNANCE','GOVERNANCE','顯示外部連接設定、接收安全同傳送狀態。'),
    c('advanced','進階設定','/admin/system/advanced','GOVERNANCE','ADMIN_CONFIG','顯示目前生效值、來源、覆寫同安全底線。'),
  ]},
];

export const ADMIN_CAPABILITIES=ADMIN_CAPABILITY_GROUPS.flatMap(group=>group.capabilities);

export function findAdminCapability(pathname:string){
  return ADMIN_CAPABILITIES.find(capability=>pathname===capability.path||pathname.startsWith(capability.path+'/'));
}
