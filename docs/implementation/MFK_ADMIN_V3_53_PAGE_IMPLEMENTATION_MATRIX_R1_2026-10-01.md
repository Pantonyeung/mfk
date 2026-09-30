# MFK Admin V3｜53-Page Implementation Matrix R1

日期：2026-10-01
狀態：PLANNING COMPLETE / NO PR #605 CODE CHANGE
Product Authority：#601 / merged Product Brief R1
Planning branch：plan/MFK-V3ADMIN-UI-SHELL-R1
Implementation PR：#605（review head 保持不動）

# 0. 目的

將 53 個 Product Brief destination 由「產品頁面已鎖」轉成「工程可以逐頁落地」嘅 implementation matrix。

狀態用語：
- VERIFIED：current source 已證實正式 seam。
- PARTIAL：有部分 read/config data，但未覆蓋完整頁面 contract。
- GAP：current source 未證實正式 seam；frontend 唔可以自行補 authority。
- OUT：明確不屬 Admin mutation scope。

# 1. 53-Page Matrix

| # | Page / Route | Mode | Primary data source | Mutation / Write | Readback / Freshness | Seam | Gate |
|---:|---|---|---|---|---|---|---|
| 1 | 營運總覽 /admin/overview | Read + deep-link | Trusted reports + ACK + device/channel summaries | 無 homepage mutation | canonical publishedAt + query freshness | PARTIAL | Core Read |
| 2 | 待處理事項 /admin/action-queue | Read / orchestration | incident/action aggregation | 無直接 mutation；只 deep-link 責任頁 | domain readback / recovery proof | GAP：未證實 canonical ActionItem seam | Core Read |
| 3 | 進行中訂單 /admin/orders/open | Read-only | /api/projection/orders | OUT | projection occurredAt / query freshness | VERIFIED read | Core Read |
| 4 | 訂單歷史 /admin/orders/history | Read-only | /api/projection/orders | OUT | projection + immutable transaction facts | VERIFIED read | Core Read |
| 5 | 訂單異常 /admin/orders/exceptions | Read-only + deep-link | orders projection + domain evidence | OUT | domain evidence / reconcile | PARTIAL：無 dedicated exception endpoint | Core Read |
| 6 | 分類管理 /admin/catalog/categories | Draft write | canonical catalog categories | Admin config draft → publish | canonical readback | VERIFIED canonical/publish；server-draft seam未證實 | Vertical Slice |
| 7 | 產品管理 /admin/catalog/products | Draft write | canonical catalog products | Admin config draft → publish | canonical readback | VERIFIED canonical/publish；server-draft seam未證實 | Vertical Slice |
| 8 | 選項／口味管理 /admin/catalog/modifiers | Draft write | canonical option data | Admin config draft → publish | canonical readback | PARTIAL | Config |
| 9 | 套餐管理 /admin/catalog/combos | Draft write | canonical combo data | Admin config draft → publish | canonical readback | PARTIAL | Config |
| 10 | 價格管理 /admin/catalog/pricing | Draft write | canonical pricing inputs | Admin config draft → publish | canonical + transaction-time pricing authority | PARTIAL | Vertical Slice |
| 11 | 顯示與排序 /admin/catalog/menu-display | Draft write | canonical display order | Admin config draft → publish | canonical readback | PARTIAL | Config |
| 12 | 售罄／供應 /admin/availability | Mixed | Admin base policy + /api/admin-sync/runtime-sellability-readback | Base policy via publish；runtime action只在正式 contract存在時顯示 | runtime readback | VERIFIED runtime read；Admin runtime command PARTIAL | Ops |
| 13 | 營業日 /admin/business-day | Mixed workflow | projection reports/day-close facts + policy | command seam需正式 domain contract | runtime/canonical readback | GAP/PARTIAL | Ops |
| 14 | 現金／收舖 /admin/cash-close | Mixed workflow | report/day-close projection | command seam需正式 domain contract | day-close readback | GAP/PARTIAL | Ops |
| 15 | 產能／原料額度 /admin/operations/capacity | Draft policy | canonical policy snapshot | Admin config draft → publish | canonical + runtime observed effect | PARTIAL | Ops |
| 16 | 平台總覽 /admin/channels | Read + deep-link | canonical config + provider/channel health | 無第二 mutation center | provider/readback freshness | PARTIAL | Core Read |
| 17 | 接單規則 /admin/channels/accept-policy | Draft policy | canonical channel policy | Admin config draft → publish | provider/channel readback | PARTIAL | Config |
| 18 | 供應同步 /admin/channels/sync-policy | Draft policy | canonical sync policy | Admin config draft → publish | provider/readback | PARTIAL | Config |
| 19 | 門店綁定 /admin/channels/store-binding | Draft / verify | external↔MFK binding facts | bounded binding contract | binding readback | GAP/PARTIAL | Config |
| 20 | 商品映射 /admin/channels/product-mapping | Draft / verify | MFK product + provider mapping | formal mapping seam | provider readback | PARTIAL | Config |
| 21 | 匹配失敗 /admin/channels/mapping-failure | Read + repair deep-link | provider mapping failures | 修正去 mapping Primary Home | provider readback | PARTIAL | Core Read |
| 22 | 實收估算 /admin/channels/net-estimate | Draft policy / read | provider commercial facts + config | Admin policy publish | provider readback | PARTIAL | Reports/Config |
| 23 | 平台對帳 /admin/channels/settlement | Read-only | settlement facts | OUT for transaction truth | provider settlement evidence | GAP：dedicated trusted settlement seam未證實 | Reports |
| 24 | 打印總覽 /admin/print | Read + deep-link | logical config + print evidence | 無 queue authority | Store Kernel print readback | PARTIAL | Core Read |
| 25 | 邏輯打印機 /admin/print/printers | Draft config | canonical logical printer registry | Admin config draft → publish | config + SMT observed binding summary | PARTIAL | Config |
| 26 | 打印模板 /admin/print/templates | Draft config | canonical print templates | Admin config draft → publish | canonical readback | PARTIAL | Config |
| 27 | 打印規則 /admin/print/rules | Draft config | canonical print rules | Admin config draft → publish | canonical + print route readback | PARTIAL | Config |
| 28 | 打印狀態／異常 /admin/print/exceptions | Read / bounded recovery | Store Kernel print evidence | recovery only if formal contract | print attempt/readback | GAP/PARTIAL | Core Read |
| 29 | 裝置狀態 /admin/devices | Read | device/runtime facts | bounded governance only | lastSeen/version/health | GAP：dedicated Admin device read seam未證實 | Core Read |
| 30 | OTA／版本 /admin/ota | Governance | approved artifact + device runtime | existing OTA protocol only | install/readback | GAP/PARTIAL | Governance |
| 31 | 員工管理 /admin/staff | Draft governance | canonical staffAuth staff facts | Admin config draft → publish | session/permission freshness | PARTIAL | Config |
| 32 | 角色管理 /admin/roles | Draft governance | canonical role model | Admin config draft → publish | canonical readback | PARTIAL | Config |
| 33 | 權限管理 /admin/permissions | Draft governance | canonical permissions | Admin config draft → publish | authz readback | PARTIAL | Config |
| 34 | 登入／工作階段／受信任裝置 /admin/access | Mixed governance | /api/admin-browser/auth/session + trust data | logout/revoke only via formal auth contract | session readback | VERIFIED own session；cross-session/trusted-device PARTIAL | Governance |
| 35 | 銷售 /admin/reports/sales | Read-only | /api/projection/reports | OUT | report completeness/freshness | VERIFIED base daily report | Reports |
| 36 | 產品 /admin/reports/products | Read-only | trusted product metrics | OUT | metricVersion/completeness | GAP：dedicated trusted product report seam未證實 | Reports |
| 37 | 渠道 /admin/reports/channels | Read-only | provider/channel + sales facts | OUT | provider/report freshness | PARTIAL | Reports |
| 38 | 退款 /admin/reports/refunds | Read-only | /api/admin-sync/refunds GET | OUT | refund/addendum evidence | VERIFIED read；legacy POST存在但 V3禁止使用 | Reports |
| 39 | 營運 /admin/reports/operations | Read-only | order/day-close/print/channel metrics | OUT | completeness/freshness | GAP/PARTIAL | Reports |
| 40 | 匯出 /admin/reports/export | High-risk read | trusted report sources | export command需獨立 permission | export job/result evidence | GAP | Reports |
| 41 | 未發佈變更 /admin/publish/pending | Draft governance | formal draft / changed objects | draft management | draft identity/freshness | GAP：dedicated server draft seam未證實 | Vertical Slice |
| 42 | 發佈中心 /admin/publish | High-risk config mutation | canonical base + draft | /api/admin-browser/publish POST | canonical refetch + target ACK | VERIFIED publish | Vertical Slice |
| 43 | 版本／回讀確認 /admin/publish/versions | Read / governance | active + ACK | 無直接 truth mutation | /api/admin-sync/acks + canonical identity | VERIFIED current ACK；history read PARTIAL | Vertical Slice |
| 44 | 回復版本 /admin/publish/rollback | High-risk config mutation | release history | 建立新 release | canonical + target readback | GAP：formal release-history/rollback seam未證實 | Governance |
| 45 | 門店資料 /admin/store/settings | Draft config | canonical store settings | Admin config draft → publish | canonical readback | PARTIAL | Config |
| 46 | 營業時間 /admin/store/hours | Draft config | canonical store hours | Admin config draft → publish | canonical/readback | PARTIAL | Config |
| 47 | 營業日分界 /admin/store/business-day | Draft config | canonical business-day policy | Admin config draft → publish | canonical/readback | PARTIAL | Config |
| 48 | 營運時間／提醒設定 /admin/store/operations | Draft config | canonical timing/reminder policy | Admin config draft → publish | canonical/readback | PARTIAL | Config |
| 49 | 快捷原因 /admin/store/quick-reasons | Draft config | canonical quick reasons | Admin config draft → publish | canonical/readback | PARTIAL | Config |
| 50 | 操作記錄 /admin/system/audit | Read-only | immutable audit facts | OUT | immutable evidence | GAP：dedicated Admin audit GET未證實 | Governance |
| 51 | 系統診斷 /admin/system/diagnostics | Read / recovery deep-link | /api/health + canonical + ACK + projection/provider facts | safe recovery only through owner domain | first-break/readback | PARTIAL | Core Read |
| 52 | 系統整合 /admin/system/integrations | Mixed governance | integration configured/auth/health facts | credentials/config only through bounded seam | provider auth/health readback | GAP/PARTIAL | Governance |
| 53 | 進階／實際生效設定 /admin/system/advanced | Read-mostly | effective config + source/override | normal mutation返回 Primary Home | observed version/readback | GAP/PARTIAL | Governance |

# 2. Current Verified Backend Seams

Current source已直接證實：

Auth / Canonical
- POST /api/admin-browser/auth/challenge
- POST /api/admin-browser/auth/verify
- GET /api/admin-browser/auth/session
- POST /api/admin-browser/auth/session
- GET /api/admin-browser/active
- POST /api/admin-browser/publish

Config Delivery / Readback
- POST /api/admin-sync/ack
- GET /api/admin-sync/acks
- GET /api/admin-sync/events (WebSocket doorbell)
- GET /api/admin-sync/runtime-sellability-readback

SMT Projection
- POST /api/projection/events
- GET /api/projection/orders
- GET /api/projection/reports

Refund observation
- GET /api/admin-sync/refunds

Current worker仍存在 refunds POST，但 Current Product Brief 已明確：Refund / Cancel / Payment Method Correction mutation = OUT OF ADMIN SCOPE。V3禁止接呢類 action。

# 3. First Engineering Priority

Priority 1：Client/Serving Release Identity → Auth/Scope → Canonical → Category → Product → Price → Pending Changes → Publish → ACK/Target Readback → Safari reopen convergence。

Priority 2：Today / Orders / Channels / Print / Devices / Diagnostics read surfaces。

Priority 3：remaining Config / Governance。

Priority 4：Reports / Export / Search / Bulk。

# 4. Matrix Gate Rule

- VERIFIED seam → 可以接。
- PARTIAL → 只做 source 已支持部分；缺口留 GAP。
- GAP → 唔自行加 browser workaround；先交 Backend Seam Register。
- OUT → 唔可以出現 execution CTA。

MILESTONE:
MFK_ADMIN_V3_53_PAGE_IMPLEMENTATION_MATRIX_R1_READY
