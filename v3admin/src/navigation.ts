export type AdminDestination={
  path:string;
  title:string;
  primaryAction:string;
  empty:string;
  authority:'read-only'|'config'|'workflow';
};

export type AdminMenuGroup={
  id:string;
  index:string;
  label:string;
  destinations:readonly AdminDestination[];
};

export const ADMIN_MENU_GROUPS:readonly AdminMenuGroup[]=[
  {id:'today',index:'01',label:'今日',destinations:[
    {path:'/admin/overview',title:'營運總覽',primaryAction:'查看銷售報表',empty:'今日暫未有可顯示營運資料',authority:'read-only'},
    {path:'/admin/action-queue',title:'待處理事項',primaryAction:'處理',empty:'目前未有待處理事項',authority:'workflow'},
  ]},
  {id:'orders',index:'02',label:'訂單監察',destinations:[
    {path:'/admin/orders/open',title:'進行中訂單',primaryAction:'查看訂單',empty:'目前未有進行中訂單',authority:'read-only'},
    {path:'/admin/orders/history',title:'訂單歷史',primaryAction:'查看訂單',empty:'目前未有符合條件嘅訂單記錄',authority:'read-only'},
    {path:'/admin/orders/exceptions',title:'訂單異常',primaryAction:'查看／前往責任頁',empty:'目前未有訂單異常',authority:'read-only'},
  ]},
  {id:'catalog',index:'03',label:'菜單管理',destinations:[
    {path:'/admin/catalog/categories',title:'分類管理',primaryAction:'新增分類',empty:'目前未有分類',authority:'config'},
    {path:'/admin/catalog/products',title:'產品管理',primaryAction:'新增商品',empty:'目前未有商品',authority:'config'},
    {path:'/admin/catalog/modifiers',title:'選項／口味管理',primaryAction:'新增選項組',empty:'目前未有選項／口味組',authority:'config'},
    {path:'/admin/catalog/combos',title:'套餐管理',primaryAction:'新增套餐',empty:'目前未有套餐',authority:'config'},
    {path:'/admin/catalog/pricing',title:'價格管理',primaryAction:'編輯價格',empty:'目前未有可管理嘅價格資料',authority:'config'},
    {path:'/admin/catalog/menu-display',title:'顯示與排序',primaryAction:'儲存草稿',empty:'目前未有可排序內容',authority:'config'},
  ]},
  {id:'operations',index:'04',label:'營運管理',destinations:[
    {path:'/admin/availability',title:'售罄／供應',primaryAction:'查看商品',empty:'目前未有可顯示商品',authority:'workflow'},
    {path:'/admin/business-day',title:'營業日',primaryAction:'開始今日營業',empty:'目前未有營業日記錄',authority:'workflow'},
    {path:'/admin/cash-close',title:'現金／收舖',primaryAction:'點算',empty:'目前未有現金資料',authority:'workflow'},
    {path:'/admin/operations/capacity',title:'產能／原料額度',primaryAction:'新增額度',empty:'目前未有產能／原料額度',authority:'config'},
  ]},
  {id:'channels',index:'05',label:'平台／渠道管理',destinations:[
    {path:'/admin/channels',title:'平台總覽',primaryAction:'查看平台',empty:'目前未有已設定平台',authority:'read-only'},
    {path:'/admin/channels/accept-policy',title:'接單規則',primaryAction:'編輯接單規則',empty:'目前未有接單規則',authority:'config'},
    {path:'/admin/channels/sync-policy',title:'供應同步',primaryAction:'查看同步狀態',empty:'目前未有供應同步資料',authority:'read-only'},
    {path:'/admin/channels/store-binding',title:'門店綁定',primaryAction:'新增綁定',empty:'目前未有門店綁定',authority:'config'},
    {path:'/admin/channels/product-mapping',title:'商品映射',primaryAction:'編輯映射',empty:'目前未有商品映射',authority:'config'},
    {path:'/admin/channels/mapping-failure',title:'匹配失敗',primaryAction:'處理',empty:'目前未有匹配失敗',authority:'workflow'},
    {path:'/admin/channels/net-estimate',title:'實收估算',primaryAction:'編輯估算設定',empty:'目前未有實收估算資料',authority:'config'},
    {path:'/admin/channels/settlement',title:'平台對帳',primaryAction:'查看對帳',empty:'目前未有平台對帳記錄',authority:'read-only'},
  ]},
  {id:'print',index:'06',label:'打印管理',destinations:[
    {path:'/admin/print',title:'打印總覽',primaryAction:'查看打印異常',empty:'目前未有打印異常',authority:'read-only'},
    {path:'/admin/print/printers',title:'邏輯打印機',primaryAction:'新增邏輯打印機',empty:'目前未有邏輯打印機',authority:'config'},
    {path:'/admin/print/templates',title:'打印模板',primaryAction:'新增打印模板',empty:'目前未有打印模板',authority:'config'},
    {path:'/admin/print/rules',title:'打印規則',primaryAction:'新增打印規則',empty:'目前未有打印規則',authority:'config'},
    {path:'/admin/print/exceptions',title:'打印狀態／異常',primaryAction:'查看詳情',empty:'目前未有打印異常',authority:'read-only'},
  ]},
  {id:'devices',index:'07',label:'裝置管理',destinations:[
    {path:'/admin/devices',title:'裝置狀態',primaryAction:'查看裝置',empty:'目前未有裝置資料',authority:'read-only'},
    {path:'/admin/ota',title:'OTA／版本',primaryAction:'查看版本',empty:'目前未有版本資料',authority:'workflow'},
  ]},
  {id:'people',index:'08',label:'人員與權限',destinations:[
    {path:'/admin/staff',title:'員工管理',primaryAction:'新增員工',empty:'目前未有員工',authority:'config'},
    {path:'/admin/roles',title:'角色管理',primaryAction:'新增角色',empty:'目前未有角色',authority:'config'},
    {path:'/admin/permissions',title:'權限管理',primaryAction:'儲存草稿',empty:'目前未有可顯示權限',authority:'config'},
    {path:'/admin/access',title:'登入／工作階段／受信任裝置',primaryAction:'查看登入工作階段',empty:'目前未有登入工作階段或受信任裝置',authority:'workflow'},
  ]},
  {id:'reports',index:'09',label:'報表',destinations:[
    {path:'/admin/reports/sales',title:'銷售',primaryAction:'查看明細',empty:'此期間未有銷售資料',authority:'read-only'},
    {path:'/admin/reports/products',title:'產品',primaryAction:'查看商品',empty:'此期間未有商品表現資料',authority:'read-only'},
    {path:'/admin/reports/channels',title:'渠道',primaryAction:'查看渠道明細',empty:'此期間未有渠道資料',authority:'read-only'},
    {path:'/admin/reports/refunds',title:'退款',primaryAction:'查看退款明細',empty:'此期間未有退款記錄',authority:'read-only'},
    {path:'/admin/reports/operations',title:'營運',primaryAction:'查看相關異常',empty:'此期間未有營運異常資料',authority:'read-only'},
    {path:'/admin/reports/export',title:'匯出',primaryAction:'產生匯出',empty:'目前未有匯出記錄',authority:'workflow'},
  ]},
  {id:'publish',index:'10',label:'發佈與版本',destinations:[
    {path:'/admin/publish/pending',title:'未發佈變更',primaryAction:'檢查並發佈',empty:'目前未有未發佈變更',authority:'workflow'},
    {path:'/admin/publish',title:'發佈中心',primaryAction:'檢查完整性',empty:'目前未有可發佈變更',authority:'workflow'},
    {path:'/admin/publish/versions',title:'版本／回讀確認',primaryAction:'重新確認狀態',empty:'目前未有版本記錄',authority:'read-only'},
    {path:'/admin/publish/rollback',title:'回復版本',primaryAction:'查看影響',empty:'目前未有可回復版本',authority:'workflow'},
  ]},
  {id:'store',index:'11',label:'門店設定',destinations:[
    {path:'/admin/store/settings',title:'門店資料',primaryAction:'編輯門店資料',empty:'暫時無法取得門店資料',authority:'config'},
    {path:'/admin/store/tables',title:'餐桌管理',primaryAction:'新增餐桌',empty:'目前未有餐桌',authority:'config'},
    {path:'/admin/store/hours',title:'營業時間',primaryAction:'編輯營業時間',empty:'目前未有營業時間設定',authority:'config'},
    {path:'/admin/store/business-day',title:'營業日分界',primaryAction:'編輯分界時間',empty:'目前未有營業日分界設定',authority:'config'},
    {path:'/admin/store/operations',title:'營運時間／提醒設定',primaryAction:'編輯設定',empty:'目前未有營運時間／提醒設定',authority:'config'},
    {path:'/admin/store/quick-reasons',title:'快捷原因',primaryAction:'新增快捷原因',empty:'目前未有快捷原因',authority:'config'},
  ]},
  {id:'system',index:'12',label:'系統管理',destinations:[
    {path:'/admin/system/audit',title:'操作記錄',primaryAction:'查看詳情',empty:'目前未有符合條件嘅操作記錄',authority:'read-only'},
    {path:'/admin/system/diagnostics',title:'系統診斷',primaryAction:'重新讀取',empty:'目前未有診斷資料',authority:'read-only'},
    {path:'/admin/system/integrations',title:'系統整合',primaryAction:'查看系統整合',empty:'目前未有系統整合資料',authority:'read-only'},
    {path:'/admin/system/advanced',title:'進階／實際生效設定',primaryAction:'查看詳情',empty:'目前未有實際生效設定資料',authority:'read-only'},
  ]},
];

export const ADMIN_DESTINATIONS=ADMIN_MENU_GROUPS.flatMap(menu=>menu.destinations);

export function destinationForPath(path:string){
  return ADMIN_DESTINATIONS.find(destination=>destination.path===path)??ADMIN_DESTINATIONS[0];
}

export function menuForDestination(destination:AdminDestination){
  return ADMIN_MENU_GROUPS.find(menu=>menu.destinations.includes(destination))??ADMIN_MENU_GROUPS[0];
}
