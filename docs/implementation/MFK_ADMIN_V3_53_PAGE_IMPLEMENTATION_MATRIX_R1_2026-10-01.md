# MFK Admin V3｜53-Page Implementation Matrix R1

日期：2026-10-01
狀態：PLANNING COMPLETE / NO PR #605 CODE CHANGE
Product Authority：#601 / merged Product Brief R1
Planning branch：plan/MFK-V3ADMIN-UI-SHELL-R1
Implementation PR：https://github.com/Pantonyeung/mfk/pull/605

## 0. 判定標準

- VERIFIED：current source 已證實正式 seam。
- PARTIAL：已有部分 read/config data，但未覆蓋完整頁面 contract。
- GAP：current source 未證實正式 seam；frontend 不可自行補 authority。
- OUT：明確不屬 Admin mutation scope。

## 1. 53-Page Matrix

| # | Page / Route | Mode | Primary source | Mutation / Write | Readback | Seam | Gate |
|---:|---|---|---|---|---|---|---|
| 1 | 營運總覽 /admin/overview | Read + deep-link | reports + ACK + readiness facts | 無 homepage mutation | canonical/query freshness | PARTIAL | Core Read |
| 2 | 待處理事項 /admin/action-queue | Read / orchestration | action/incident aggregation | 只 deep-link 責任頁 | domain recovery proof | GAP | Core Read |
| 3 | 進行中訂單 /admin/orders/open | Read-only | /api/projection/orders | OUT | projection freshness | VERIFIED | Core Read |
| 4 | 訂單歷史 /admin/orders/history | Read-only | /api/projection/orders | OUT | immutable facts | VERIFIED | Core Read |
| 5 | 訂單異常 /admin/orders/exceptions | Read-only + deep-link | orders + domain evidence | OUT | reconcile/evidence | PARTIAL | Core Read |
| 6 | 分類管理 /admin/catalog/categories | Draft write | canonical catalog.categories | draft → publish | canonical readback | PARTIAL | Vertical Slice |
| 7 | 產品管理 /admin/catalog/products | Draft write | canonical catalog.products | draft → publish | canonical readback | PARTIAL | Vertical Slice |
| 8 | 選項／口味管理 /admin/catalog/modifiers | Draft write | canonical option data | draft → publish | canonical readback | PARTIAL | Config |
| 9 | 套餐管理 /admin/catalog/combos | Draft write | canonical combo data | draft → publish | canonical readback | PARTIAL | Config |
| 10 | 價格管理 /admin/catalog/pricing | Draft write | canonical pricing inputs | draft → publish | canonical + transaction-time authority | PARTIAL | Vertical Slice |
| 11 | 顯示與排序 /admin/catalog/menu-display | Draft write | canonical display order | draft → publish | canonical readback | PARTIAL | Config |
| 12 | 售罄／供應 /admin/availability | Mixed | Admin base policy + runtime sellability readback | base policy publish；runtime action需正式 contract | runtime readback | PARTIAL | Ops |
| 13 | 營業日 /admin/business-day | Mixed | day-close/report facts + policy | bounded workflow seam | runtime readback | GAP/PARTIAL | Ops |
| 14 | 現金／收舖 /admin/cash-close | Mixed | cash/day-close projection | bounded workflow seam | day-close readback | GAP/PARTIAL | Ops |
| 15 | 產能／原料額度 /admin/operations/capacity | Draft policy | canonical policy | draft → publish | runtime observed effect | PARTIAL | Ops |
| 16 | 平台總覽 /admin/channels | Read + deep-link | config + provider/channel health | 無第二 mutation center | provider freshness | PARTIAL | Core Read |
| 17 | 接單規則 /admin/channels/accept-policy | Draft policy | canonical channel policy | draft → publish | provider readback | PARTIAL | Config |
| 18 | 供應同步 /admin/channels/sync-policy | Draft policy | canonical sync policy | draft → publish | provider readback | PARTIAL | Config |
| 19 | 門店綁定 /admin/channels/store-binding | Draft / verify | external↔MFK binding facts | bounded binding contract | binding readback | GAP/PARTIAL | Config |
| 20 | 商品映射 /admin/channels/product-mapping | Draft / verify | product + provider mapping | formal mapping seam | provider readback | PARTIAL | Config |
| 21 | 匹配失敗 /admin/channels/mapping-failure | Read + repair deep-link | mapping failures | 修正去 mapping Primary Home | provider readback | PARTIAL | Core Read |
| 22 | 實收估算 /admin/channels/net-estimate | Read / policy | provider commercial facts + config | draft → publish | provider readback | PARTIAL | Reports/Config |
| 23 | 平台對帳 /admin/channels/settlement | Read-only | settlement facts | OUT | provider evidence | GAP | Reports |
| 24 | 打印總覽 /admin/print | Read + deep-link | logical config + print evidence | 無 queue authority | Store Kernel proof | PARTIAL | Core Read |
| 25 | 邏輯打印機 /admin/print/printers | Draft config | canonical logical printer registry | draft → publish | config + SMT observed binding | PARTIAL | Config |
| 26 | 打印模板 /admin/print/templates | Draft config | canonical templates | draft → publish | canonical readback | PARTIAL | Config |
| 27 | 打印規則 /admin/print/rules | Draft config | canonical rules | draft → publish | canonical + route readback | PARTIAL | Config |
| 28 | 打印狀態／異常 /admin/print/exceptions | Read / bounded recovery | print evidence | recovery only with contract | attempt/readback | GAP/PARTIAL | Core Read |
| 29 | 裝置狀態 /admin/devices | Read | device/runtime facts | bounded governance only | version/lastSeen/health | GAP/PARTIAL | Core Read |
| 30 | OTA／版本 /admin/ota | Governance | approved artifact + device runtime | existing OTA protocol only | install/readback | PARTIAL | Governance |
| 31 | 員工管理 /admin/staff | Draft governance | canonical staffAuth.staff | draft → publish | session/permission freshness | PARTIAL | Config |
| 32 | 角色管理 /admin/roles | Draft governance | canonical role model | draft → publish | canonical readback | PARTIAL | Config |
| 33 | 權限管理 /admin/permissions | Draft governance | canonical permissions | draft → publish | authz readback | PARTIAL | Config |
| 34 | 登入／工作階段／受信任裝置 /admin/access | Mixed governance | admin session + trust data | formal revoke only | session readback | PARTIAL | Governance |
| 35 | 銷售 /admin/reports/sales | Read-only | /api/projection/reports | OUT | report freshness | VERIFIED base | Reports |
| 36 | 產品 /admin/reports/products | Read-only | trusted product metrics | OUT | metric completeness | GAP | Reports |
| 37 | 渠道 /admin/reports/channels | Read-only | provider/channel + sales facts | OUT | report freshness | PARTIAL | Reports |
| 38 | 退款 /admin/reports/refunds | Read-only | /api/admin-sync/refunds GET | OUT | refund/addendum evidence | VERIFIED read | Reports |
| 39 | 營運 /admin/reports/operations | Read-only | order/day-close/print/channel facts | OUT | completeness | GAP/PARTIAL | Reports |
| 40 | 匯出 /admin/reports/export | High-risk read | trusted report sources | export permission/job | export evidence | GAP | Reports |
| 41 | 未發佈變更 /admin/publish/pending | Draft governance | formal draft / changed objects | draft management | draft identity | GAP | Vertical Slice |
| 42 | 發佈中心 /admin/publish | High-risk config mutation | canonical base + draft | /api/admin-browser/publish | canonical + target ACK | VERIFIED publish | Vertical Slice |
| 43 | 版本／回讀確認 /admin/publish/versions | Read / governance | active + ACK | 無 transaction mutation | /api/admin-sync/acks | VERIFIED current ACK / PARTIAL history | Vertical Slice |
| 44 | 回復版本 /admin/publish/rollback | High-risk config mutation | release history | 建立新 release | canonical + target readback | GAP | Governance |
| 45 | 門店資料 /admin/store/settings | Draft config | canonical store settings | draft → publish | canonical readback | PARTIAL | Config |
| 46 | 營業時間 /admin/store/hours | Draft config | canonical hours | draft → publish | canonical readback | PARTIAL | Config |
| 47 | 營業日分界 /admin/store/business-day | Draft config | canonical business-day policy | draft → publish | canonical readback | PARTIAL | Config |
| 48 | 營運時間／提醒設定 /admin/store/operations | Draft config | canonical timing/reminder policy | draft → publish | canonical readback | PARTIAL | Config |
| 49 | 快捷原因 /admin/store/quick-reasons | Draft config | canonical quick reasons | draft → publish | canonical readback | PARTIAL | Config |
| 50 | 操作記錄 /admin/system/audit | Read-only | immutable audit facts | OUT | immutable evidence | GAP | Governance |
| 51 | 系統診斷 /admin/system/diagnostics | Read / recovery deep-link | health + canonical + ACK + projection/provider facts | safe recovery only | first-break/readback | PARTIAL | Core Read |
| 52 | 系統整合 /admin/system/integrations | Mixed governance | integration config/auth/health | bounded config/credential seam | provider auth/health | GAP/PARTIAL | Governance |
| 53 | 進階／實際生效設定 /admin/system/advanced | Read-mostly | effective values/source/override | 正常修改返回 Primary Home | observed version | GAP/PARTIAL | Governance |

## 2. Current Verified Core Seams

Current source fresh-read 已證實：

- POST /api/admin-browser/auth/challenge
- POST /api/admin-browser/auth/verify
- GET /api/admin-browser/auth/session
- POST /api/admin-browser/auth/session
- GET /api/admin-browser/active
- POST /api/admin-browser/publish
- POST /api/admin-sync/ack
- GET /api/admin-sync/acks
- GET /api/admin-sync/events
- GET /api/admin-sync/runtime-sellability-readback
- POST /api/projection/events
- GET /api/projection/orders
- GET /api/projection/reports
- GET /api/admin-sync/refunds
- GET /api/health

## 3. First Engineering Priority

Priority 1：
Client/Serving Release Identity → Auth/Scope → Canonical → Category → Product → Pricing → Pending Changes → Publish → ACK/Readback → Safari reopen。

Priority 2：
Today / Orders / Channels / Print / Devices / Diagnostics read surfaces。

Priority 3：
remaining Config / Governance。

Priority 4：
Reports / Export / Search / Bulk。

MILESTONE:
MFK_ADMIN_V3_53_PAGE_IMPLEMENTATION_MATRIX_R1_READY
