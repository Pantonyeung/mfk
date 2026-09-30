# MFK Admin V3｜UI Shell / Design System Implementation Packet R1

日期：2026-10-01
狀態：PLANNING ONLY / DO NOT TOUCH PR #605 HEAD
用途：Codex Gate 1 review 完成後，作下一個 implementation slice。
Product authority：#601 / merged Product Brief R1
Repo：https://github.com/Pantonyeung/mfk
Current implementation PR：https://github.com/Pantonyeung/mfk/pull/605

---

# 0. Parallel-work rule

PR #605 正在做 Gate 1 review 時：
**禁止改動 feat/MFK-V3ADMIN-ONE-SHOT-R1 head。**

本文件喺獨立 planning branch 準備下一刀，
避免令 Codex review 失效。

---

# 1. 下一刀目標

Gate 1 GREEN 後，先做：
**UI Shell + Design System foundation**

唔一次做晒 53 頁業務內容。

目標只係建立：
- 12 大 Menu
- 53 route registry
- Desktop / Tablet / Mobile navigation
- 共用 Page / List / Detail / Form / State component grammar
- Copy Dictionary 接口
- Permission-aware navigation hook
- Store / Scope context placement
- Client / Serving / Canonical / Target identity diagnostics入口

---

# 2. 12 大 Menu

1. 今日
2. 訂單監察
3. 菜單管理
4. 營運管理
5. 平台／渠道管理
6. 打印管理
7. 裝置管理
8. 人員與權限
9. 報表
10. 發佈與版本
11. 門店設定
12. 系統管理

---

# 3. 53 Routes

## 今日
- /admin/overview — 營運總覽
- /admin/action-queue — 待處理事項

## 訂單監察
- /admin/orders/open — 進行中訂單
- /admin/orders/history — 訂單歷史
- /admin/orders/exceptions — 訂單異常

## 菜單管理
- /admin/catalog/categories — 分類管理
- /admin/catalog/products — 產品管理
- /admin/catalog/modifiers — 選項／口味管理
- /admin/catalog/combos — 套餐管理
- /admin/catalog/pricing — 價格管理
- /admin/catalog/menu-display — 顯示與排序

## 營運管理
- /admin/availability — 售罄／供應
- /admin/business-day — 營業日
- /admin/cash-close — 現金／收舖
- /admin/operations/capacity — 產能／原料額度

## 平台／渠道管理
- /admin/channels — 平台總覽
- /admin/channels/accept-policy — 接單規則
- /admin/channels/sync-policy — 供應同步
- /admin/channels/store-binding — 門店綁定
- /admin/channels/product-mapping — 商品映射
- /admin/channels/mapping-failure — 匹配失敗
- /admin/channels/net-estimate — 實收估算
- /admin/channels/settlement — 平台對帳

## 打印管理
- /admin/print — 打印總覽
- /admin/print/printers — 邏輯打印機
- /admin/print/templates — 打印模板
- /admin/print/rules — 打印規則
- /admin/print/exceptions — 打印狀態／異常

## 裝置管理
- /admin/devices — 裝置狀態
- /admin/ota — OTA／版本

## 人員與權限
- /admin/staff — 員工管理
- /admin/roles — 角色管理
- /admin/permissions — 權限管理
- /admin/access — 登入／工作階段／受信任裝置

## 報表
- /admin/reports/sales — 銷售
- /admin/reports/products — 產品
- /admin/reports/channels — 渠道
- /admin/reports/refunds — 退款
- /admin/reports/operations — 營運
- /admin/reports/export — 匯出

## 發佈與版本
- /admin/publish/pending — 未發佈變更
- /admin/publish — 發佈中心
- /admin/publish/versions — 版本／回讀確認
- /admin/publish/rollback — 回復版本

## 門店設定
- /admin/store/settings — 門店資料
- /admin/store/hours — 營業時間
- /admin/store/business-day — 營業日分界
- /admin/store/operations — 營運時間／提醒設定
- /admin/store/quick-reasons — 快捷原因

## 系統管理
- /admin/system/audit — 操作記錄
- /admin/system/diagnostics — 系統診斷
- /admin/system/integrations — 系統整合
- /admin/system/advanced — 進階／實際生效設定

---

# 4. Shell contract

Desktop：
- persistent primary sidebar
- second-level menu visible without nested third-level discovery
- content workspace starts immediately
- one primary CTA per page

Tablet：
- compact primary rail
- second-level contextual panel / overlay
- same route and page title semantics

Mobile：
- drawer navigation
- no hidden formal function behind an unbounded generic “More” chain
- tables become labeled records/cards
- no essential horizontal page scroll
- one highest-priority sticky action area

---

# 5. Shared UI components

Mandatory foundation：
- AppShell
- PrimaryNav
- SecondaryNav
- PageHeader
- StoreScopeIndicator
- ClientReleaseIndicator
- SearchField
- FilterBar
- DataTable
- ResponsiveRecordList
- StatusBadge
- EmptyState
- ErrorState
- StaleBanner
- DraftBar
- ConfirmDialog
- ReadbackPanel
- Timeline
- FormField / FormSection
- Tabs
- Toast / InlineFeedback
- LoadingSkeleton

Domain page只可組合，
唔自行發明第二套 interaction grammar。

---

# 6. State grammar

UI 必須支援：
- INITIAL_LOADING
- EMPTY
- READY
- REFRESHING
- STALE
- OFFLINE_WITH_DATA
- OFFLINE_EMPTY
- PENDING
- UNKNOWN
- PARTIAL
- CONFLICT
- FAILED
- UNAUTHORIZED
- FATAL

硬規則：
- Error ≠ Empty
- Error ≠ 0
- Unknown ≠ Failed
- Published ≠ Applied
- Transport connected ≠ Business Ready

---

# 7. Navigation + context rules

- 每個正式功能唯一 Primary Home
- Deep-link 可以跨 domain，但唔建立第二 authority
- List → Detail → Back 保留 search/filter/sort/scroll
- Store / Scope change 必須清理 invalid selection/context
- route transition唔可以 blank whole shell
- mobile drawer關閉後保留工作 context

---

# 8. Product safety rules

UI Shell 本身唔可以：
- 讀 v2 localStorage
-  import v2 client-state
- persist server truth
- 將 Doorbell payload畫成正式資料
- 顯示 Admin Refund / Cancel / Payment Correction mutation CTA
- 以 revision number作 freshness authority

---

# 9. Implementation order after Gate 1

1. route registry
2. shell layout
3. responsive navigation
4. page header + state system
5. list/table/mobile record grammar
6. form grammar
7. draft / confirm / readback components
8. copy dictionary integration
9. permission-aware nav
10. client/serving identity diagnostics placement

完成後先進第一條 vertical slice：
Category → Product → Price → Draft → Publish → Readback。

---

# 10. Shell acceptance

PASS 必須：
- 53 routes 全部可 resolve
- 12 大 Menu 兩步內找到所有第二步 workspace
- Desktop / Tablet / Mobile route identity相同
- Page title = Sidebar sub-menu name
- 無第三層 sidebar
- 無 placeholder fake function
- no horizontal page scroll on mobile
- shared loading/error/stale/unknown semantics
- no v2 browser-state import
- no production routing
- tests/typecheck/build GREEN

MILESTONE:
MFK_ADMIN_V3_UI_SHELL_IMPLEMENTATION_PACKET_R1_READY
