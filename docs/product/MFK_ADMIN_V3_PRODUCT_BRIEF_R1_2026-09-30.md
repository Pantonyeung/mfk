# MFK Admin V3｜產品 Brief / 功能 / UI 鎖定 R1

狀態：PRODUCT SPEC / IMPLEMENTATION BLOCKED  
日期：2026-09-30  
Root Control：#596  
產品：MFK Admin V3  
目的：先鎖死 Admin 產品定義、功能邊界、IA、UI、狀態語義、驗收，再一次過重生；停止 A1/A2 式逐頁擴張。

---

# 0. 一句產品定義

MFK Admin V3 係餐飲門店嘅 **Web Control Plane**：

- 管理商品、價格、套餐、渠道、打印、人員、門店設定；
- 監察訂單、Business Day、Cash、SMT/Channel/Device/Print 健康；
- 用固定可信報表睇正式 read model；
- 所有正式 mutation 都經唯一 domain authority、權限、版本、防衝突、Audit、Readback；
- Admin 唔係第二 POS、唔係第二 Order Engine、唔係第二 Pricing Engine、唔係第二 SMT Runtime、唔係 BI Builder。

核心 UX：
**今日 → 發現問題／Pending Change → 去責任工作區 → 操作 → Readback → 回今日。**

---

# 1. Product Principles｜全產品硬規則

1. **「今日」係唯一每日入口。**
2. 功能完整 ≠ 全部放主導航；低頻治理 contextual 出現。
3. Config workflow 統一：
   **Draft → Validate → Impact → Publish → Readback**。
4. 高風險 mutation：
   **Permission → Reason（如 policy 要求）→ Version Guard → Execute → Readback → Audit**。
5. Unknown ≠ Failed。
6. Connected ≠ Healthy。
7. Saved ≠ Published。
8. Published ≠ SMT Applied。
9. Cloud/Canonical readback 先係正式確認。
10. Browser state 唔可以做第二 authority。
11. Reports 只讀，不直接修改 transaction truth。
12. Action Queue 只分流，不擁有 mutation。
13. WebSocket / doorbell 只通知重新讀 canonical。
14. Revision 只係診斷 metadata；人類 freshness 以正式 timestamp/readback 為準。
15. V3 唔讀 v2 localStorage，不做 v2 compatibility state machine。

---

# 2. User Personas / Permission Intent

產品 persona：
- OWNER：全部 oversight + governance 預設能力。
- MANAGER：營運管理 + 指定敏感操作。
- CONFIG ADMIN：菜單、渠道、打印、門店設定。
- VIEWER / ACCOUNTING：指定 read-only reports / settlement / audit。

真正 authorization 唔硬編 persona；由：
**Identity + Credential + Role + Permission + Scope + Context Guard + Approval Policy** 決定。

Frontend hide 不是 security。
所有 protected operation 必須 server-side authz。

---

# 3. R1 Launch Scope｜一次過重生要完成嘅產品範圍

R1 一次過重生包含所有目前 P0 / READY / READ_ONLY / GOVERNANCE Admin 能力。

## 3.1 必做
- Login / Session / Scope
- 今日 / Readiness
- Unified Action Queue
- Pending Changes
- Orders：進行中、歷史、售後／異常
- Sellability / Availability quick control + readback
- Menu：Product / Category / Sort / Modifier / Pricing / Combo
- Product Operational：圖片、打印規則、外賣附加費、Option delta
- Business Day / Cash / Close
- Capacity / 原料額度 policy
- Channel：Overview / Accept Policy / Supply Sync / Store Binding / Product Mapping / Mapping Failure / Net Estimate / Settlement read-only
- Device Health
- Logical Printer Registry
- Print Template
- Print Rule
- OTA read/governance surface
- Staff / Role / Permission / Admin login
- Fixed trusted reports：Sales / Product / Channel / Refund / Operations
- Store Settings
- Quick Reasons
- Publish / Versions / Readback / Rollback
- Audit
- Diagnostics
- Integrations
- Effective Settings / Advanced

## 3.2 Product contract 鎖定，但 R1 不出現在主導航
- Inventory Lite
- CRM / Customer 360
- RFM
- Loyalty
- Coupons
- Announcements
- Customer / Owner / Frontline Presentation

以上保留 route/產品規格位置，但標記 P1；R1 唔用 placeholder 卡混入正式導航。

## 3.3 明確不做
- arbitrary dashboard builder
- SQL / formula editor
- ERP / procurement
- full CRM automation
- AI 自動停售 / 採購 / 自動優惠
- 第二套 pricing/order/payment/print/sellability engine
- physical printer IP/USB binding（屬 SMT 現場）
- POS transaction execution

---

# 4. Final Information Architecture｜鎖定

R1 Desktop 主導航固定 8 組：

1. **今日**
2. **訂單**
3. **菜單**
4. **營運**
5. **連接與設備**
6. **人員**
7. **報表**
8. **設定**

禁止再新增第 9 個第一層導航，除非 Owner 修改 Product Brief。

---

# 5. Route Map｜鎖定

## 今日
- /admin/overview — 營運總覽
- /admin/action-queue — 待處理／異常

## 訂單
- /admin/orders/open — 進行中訂單
- /admin/orders/history — 訂單歷史
- /admin/orders/exceptions — 退款／異常
- /admin/availability — 售罄／供應

## 菜單
- /admin/catalog/products — 商品資料
- /admin/catalog/categories — 分類與結構
- /admin/catalog/menu-display — 顯示排序
- /admin/catalog/modifiers — 選項中心
- /admin/catalog/pricing — 價格管理
- /admin/catalog/combos — 套餐

## 營運
- /admin/business-day — 營業日／交更
- /admin/cash-close — 現金／收舖
- /admin/operations/capacity — 每日產能／原料額度

## 連接與設備
- /admin/channels — 平台管理
- /admin/channels/accept-policy — 接單規則
- /admin/channels/sync-policy — 供應同步
- /admin/channels/net-estimate — 實收估算設定
- /admin/channels/store-binding — 門店授權映射
- /admin/channels/product-mapping — 商品映射
- /admin/channels/mapping-failure — 匹配失敗
- /admin/channels/settlement — 平台對帳
- /admin/print — 打印中心
- /admin/print/templates — 打印模板
- /admin/print/rules — 打印規則
- /admin/devices — 裝置管理
- /admin/ota — 裝置版本

## 人員
- /admin/staff — 員工／權限
- /admin/access — Login / Session / Scope / Trusted Device

## 報表
- /admin/reports/sales
- /admin/reports/products
- /admin/reports/channels
- /admin/reports/refunds
- /admin/reports/operations
- /admin/reports/export — 匯出治理

## 設定
- /admin/store/settings
- /admin/store/quick-reasons
- /admin/publish
- /admin/system/diagnostics
- /admin/system/integrations
- /admin/system/audit
- /admin/system/advanced

P1 routes保留但 R1 nav 不曝光。

---

# 6. Global Shell UI｜鎖定

## Desktop ≥1180px
- 左 rail：232px，固定。
- Topbar：64px，sticky。
- 主內容：max-width 1440px。
- Rail 顯示 8 個 group；active group 明顯。
- Topbar 左：Group / Page title。
- Topbar 右：
  - Store（MF01）
  - Cloud freshness
  - Session user
  - Global status trigger
  - Account menu

## Tablet 768–1179px
- Rail 收成 72px icon/number rail。
- 點 group 打開 context panel。
- 內容保持同 Desktop component hierarchy。

## Mobile <768px
- 頂部：Page title + Store + status。
- 底部固定 5 格：
  - 今日
  - 訂單
  - 菜單
  - 營運
  - 更多
- 「更多」sheet 收：連接與設備 / 人員 / 報表 / 設定。
- 禁止整頁水平 scroll。
- Table 要轉 stacked row 或局部 scroll container。

---

# 7. Visual System｜鎖定

Design character：
暖米白、克制、專業餐飲 control plane；唔做 SaaS dashboard 花巧裝飾。

Tokens：
- Background：#F7F4ED
- Surface：#FFFDF8
- Text：#1B1B18
- Muted：#716A5E
- Border：#DDD6CA
- Success：#287A55
- Info：#356A9A
- Warning：#A56700
- Danger：#B33A32

Spacing：8px grid。  
Card radius：16px。  
Input radius：12px。  
Pill：999px。  
Minimum touch target：44px。  
主要正文 15–16px；Page title 28–36px desktop / 26–32px mobile。

Color 永遠唔可以係唯一狀態訊號；一定有文字。

---

# 8. Global Status Semantics｜全頁共用

所有 Query / operation 必須分清：

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

規則：
- Loading 唔顯 0。
- Empty success 唔係 error。
- Background refresh 保留舊成功資料。
- Offline 有舊資料 →「離線 · 顯示上次成功資料」。
- Timeout / no ACK → UNKNOWN / WAITING，唔係 FAILED。
- Error 不可轉做 0 sales / empty orders。

---

# 9. 今日 / Command Center｜鎖定

首頁回答四件事：

1. 今日可唔可以正常營業？
2. 有冇異常要處理？
3. 有冇未發佈改動？
4. 今日核心營運數據係乜？

## Above the fold
A. Readiness strip
- Business Day
- Channel
- SMT / Device
- Printer
- Menu / Config
- Sellability
每項：Ready / Attention / Unknown + freshness。

B. KPI
- Effective Sales
- Orders
- AOV
- Refund / Adjustment
只用正式 read model。

C. Unified Action Queue
- blocker
- refund reconcile
- channel sync
- printer fail
- publish mismatch
- device/config drift
同一 incident dedupe；點入責任 Domain。

D. Pending Changes
- 幾多 draft changes
- 影響 Domain
- 最後修改時間
- CTA：檢查並發佈

E. Daily actions
- Open/Close Business Day
- Cash handover
- Quick sellability
但 mutation 由責任 Domain page 執行，首頁只 deep-link。

---

# 10. Unified Action Queue｜鎖定

Queue row：
- Severity
- Domain
- Title
- Object
- First seen
- Last observed
- Current state
- Freshness
- CTA「處理」

Queue 不可有直接 mutation button。

Resolve 條件：
- targeted readback 已證明 recovered。
- 冇 proof 不可標 Resolved。

---

# 11. Orders Workspace｜鎖定

## 進行中
Row/card：
- Order ID / display
- Source
- Created
- Amount
- Payment
- Fulfillment
- Staff
- Exception indicator

Filters：
- search
- source
- fulfillment
- payment
- business date

## 歷史
同一 read model，增加：
- completed/cancelled time
- refund/adjustment indicators

## Order Detail
Tabs：
- 摘要
- Items
- Payment
- Fulfillment
- Refund/Correction
- Timeline / Proof

Order Timeline 聚合 domain events，但每條 deep-link 去原 Audit/Proof。

## 售後／異常
只顯正式 Refund / Cancel / Tender Correction / Print exception。
任何 write workflow 都要去正式 domain action surface。

---

# 12. Sellability / Availability｜鎖定

UI 必須分兩件事：

A. **Base Eligibility / Policy**
- Admin config
- 隨 publish 發佈

B. **Runtime Sellability**
- SMT Runtime authority / readback
- temporary sold out / restore

禁止將 Inventory quantity 直接等同停售。
禁止 Admin 再造第二 Availability Engine。

Surface：
- Product
- Base policy
- Runtime observed state
- Channel projection
- Last readback
- bounded request action（只有 authority contract 支援先顯示）

任何 runtime request 未 readback 前顯示 PENDING/UNKNOWN。

---

# 13. Menu Workspace｜總規格

所有 Menu 編輯共用同一 Draft Context。

Global editor header：
- Draft state
- Changed count
- Validation count
-「放棄未保存」
-「檢查完整性」
-「查看變更」

唔喺每個 page 即時正式 publish。

---

# 14. Product｜鎖定

必填：
- Product Name
- Product Code
- Base Price
- Category
- Active

選填：
- Description
- Image
- Display order
- Option links
- Combo relation
- Print rules
- takeaway surcharge flag
- operational metadata

Product detail UI 採 **task picker**：
- 基本資料
- 價格
- 選項
- 打印
- 圖片
- 進階

一次只展開一個 edit task；其他摘要仍可見。

---

# 15. Category / Sort｜鎖定

Category：
- name
- order
- active
- product count

Delete guard：
有 product reference 不可直接 delete；要先 reassign。

Menu Display：
- category order
- product order
- visibility
- 禁止另外建立 print-only sort authority。

---

# 16. Modifier / Option Center｜鎖定

Option Set：
- Name
- Required?
- Min
- Max
- Active
- Options

Option：
- Name
- Code
- Price adjustment（可正、0、負）
- Active
- Position

Product linkage：
- attach reusable Option Set
- product-specific default / constraints where contract supports

所有 adjustment 只係 canonical pricing input；唔建立第二 pricing engine。

---

# 17. Pricing｜鎖定

UI 可以管理：
- Base price
- Option +/- adjustment
- Product takeaway +$1 flag
- Combo base price / adjustment
- future governed promo input

Product 外賣附加費：
- Product ON → 該 Product line takeaway +$1
- Combo ON → whole Combo +$1
- child 不可再重複 +$1

Price page 必須明示：
「正式交易計價由唯一 Pricing Authority 執行；Admin 只發布規則。」

---

# 18. Combo｜鎖定

保留：
- Parent identity
- Main/add-on pools
- Required/optional groups
- Min/max
- Child product identity
- adjustment

打印 / report 不可拆散到失去 Combo relationship。

跨來源 total 只係 read/display，唔改 identity。

---

# 19. Publish Workflow｜最重要鎖定

Publish Center 不做第一層 nav；主要由 Pending Changes 進入。

Flow：
1. **Draft Summary**
2. **Validate**
3. **Impact Preview**
4. **Confirm Publish**
5. **Publishing**
6. **Cloud Published**
7. **Target Readback**
8. **MATCH / PARTIAL / MISMATCH**

## Validate
分：
- Blocker
- Warning

Blocker 禁 publish。
Warning 要明示，但按 policy 可繼續。

## Impact Preview
至少列：
- Changed domains
- Added/Updated/Disabled objects
- Channels affected
- Print/routing affected
- Staff/access affected
- target systems

## Publish
帶 expected base identity/version guard。

## Readback
逐 target：
- desired
- observed
- timestamp
- result
- evidence

## Rollback
永遠建立 **新 release**；
禁止 edit historical release。

UI 禁止將「Save Draft」寫成「已發佈」。

---

# 20. Business Day / Cash｜鎖定

每日 workflow 由「今日」進入。

Flow：
- Open Day
- Operating
- Close Preview
- Count / Handover
- Close Day

Business Day 分界可設定任意時間。
Business Day classification 永遠唔可以做 transaction blocker。

Close Preview：
- pending payment
- open cash issue
- money attention
- unresolved blockers

Cash：
- expected
- actual
- difference
- removed
- retained
- staff
- approval/reason where required

Close ≠ Drawer ≠ Shift；UI wording唔混。

日結後 Tender Correction：
由有權限 Admin 正式 workflow 做；
SAME order、full audit、zero new order、zero auto reprint、zero auto drawer action。

---

# 21. Capacity / 原料額度｜鎖定

Admin 設 policy：
- Pool name
- Initial qty
- linked products
- first-party stop threshold
- third-party stop threshold
- active
- note

UI 必須標：
「設定資料 / policy；真正 runtime 扣減及停售只由正式 runtime authority 執行。」

唔用呢頁偷偷建立第二 inventory/sellability engine。

---

# 22. Channel Workspace｜鎖定

Platform Overview：
每平台一張 status card：
- configured?
- auth/readback state
- order intake state
- mapping health
- sellability sync state
- last successful read
- last error
- CTA 去責任頁

Sub pages：
- Accept Policy
- Supply Sync Policy
- Net Estimate
- Store Binding
- Product Mapping
- Mapping Failure
- Settlement read-only

Keeta / external commercial fields：
Sales、Commission、Fee、Merchant Earnings 分開。
Merchant Earnings 不可反寫 Order Sales / Tender。

Mapping：
Channel Name / Product / Price / Category / Bundle / Option / Combo。
外部 mapping 不可污染 MFK Direct Price。

---

# 23. Connected & Device｜鎖定

## Device Health
每 device：
- type
- identity
- trust
- current version
- desired version
- last seen
- freshness
- config drift
- current health
- safe recovery action

禁止一粒「全部正常」總綠燈。

至少分：
- Cloud
- Runtime
- Platform
- Payment
- Print
- Queue/Reconcile

## OTA
- approved artifact
- hash
- target
- current runtime
- install state
- readback
- rollback record

Admin 只治理已批准 artifact；唔改 Builder/OTA protocol。

---

# 24. Printer / Print｜鎖定

Admin 唯一 logical printer registry：
例如：
- 收據機
- 廚房製作單機
- 打包單機
- 飯糰 Label
- 外賣 Label

Logical printer fields：
- Name
- Type/capability
- Supported ticket types
- routing use
- active

Physical IP / USB binding：
**SMT 現場做，Admin 不做。**

Product Print flags：
- Receipt ON/OFF
- Production ON/OFF
- Packing ON/OFF
- Label ON/OFF
- Dine-in print ON/OFF
- Label destinations（logical printers）

Templates：
- Receipt
- Production
- Packing
- Label

Output semantics：
- Production：要整乜／點整
- Packing：全單齊唔齊
- Combo relationship 保留
- food/drink total 同 accessory 分開

Print diagnostics read-only 可以顯 job/attempt/readback，但唔改 Store Kernel print queue authority。

---

# 25. Staff / RBAC｜鎖定

Staff list：
- Name
- Staff ID
- Role
- Scope
- Active
- Admin login enabled
- last relevant access status

Staff detail：
- Identity
- Role
- Permission
- Scope
- Credential status
- Device/session detail（advanced）
- revoke actions

Permission editor：
- grouped capability matrix
- scope
- inherited vs override
- cannot grant above actor authority

Protected revoke：
下一個 protected request fail-closed。

PIN/password/token 永遠唔顯示。

---

# 26. Reports｜鎖定

R1 固定可信 5 張：

1. Sales
2. Product
3. Channel
4. Refund
5. Operations

每張 report：
- date range
- freshness
- metricVersion
- completeness
- fixed drill-down
- export permission check

禁止：
- arbitrary metric builder
- free dashboard canvas
- formula editor
- SQL

Reports 只 read model。
Report 可以 deep-link Orders/Product/Channel/Action Queue，但唔直接 mutation。

---

# 27. Sales Report｜最低內容

- Gross
- Adjustments
- Net
- Orders
- AOV
- Cash Sales
- Refund
- Cash Refund
- Business Day
- opening/close readback where applicable

Error 不可變成 zero。

---

# 28. Product Report｜最低內容

P0：
- Overall Qty
- Standalone Qty
- Combo Child Qty
- Effective Product Revenue
- Contribution %
- Category performance
- Modifier selection count / attach rate
- Combo parent sales / child mix
- Channel split
- time-of-day

未有 verified cost authority前：
禁止顯示假精準 Gross Profit / Margin。

---

# 29. Channel / Refund / Operations Reports

Channel：
- order count
- effective sales
- channel mix
- channel health/read availability

Refund：
- count
- amount
- method
- original day
- execution day
- addendum/ref

Operations：
- fulfillment/prep where formally available
- delayed orders
- print exceptions
- channel exceptions
- unresolved actions

---

# 30. Audit｜鎖定

主畫面叫「操作記錄」，唔叫 raw Log。

每列：
- Time
- Actor
- Action
- Target
- Result

Detail：
- reason
- permission/policy
- device
- before
- after
- linked proof
- correlation ID
- engineering audit ID（detail only）

Sensitive redaction 必須存在。
PIN/password/token/payment secret 永不落 Audit。

Resource timeline：
Order / Product / Staff / Channel 等 detail page 可 contextual 顯 timeline。

---

# 31. Diagnostics｜鎖定

Diagnostics 至少回答：
- component / route
- current state
- freshness
- pending count
- last error
- FIRST BREAK
- safe recovery action
- readback result

Level A：Frontline 能唔能夠繼續營業  
Level B：Manager/Owner 影響邊啲 device/order/staff  
Level C：Engineering trace / operation ID / timestamps / proof

Diagnostics ≠ Audit。
Health ≠ Queue。
Queue ≠ Failure。
Event history ≠ Proof。

---

# 32. Store / System Settings｜鎖定

Store settings唔做「巨型 settings 宇宙」。

按 domain 分組：
- Store identity / contact
- Business Day
- Ordering / operational timing
- Quick Reasons
- Channel
- Print
- Presentation（P1）
- Advanced effective values

Advanced page只讀／受控：
- effective value
- source
- override
- security floor
- observed version

---

# 33. Quick Reasons｜鎖定

可設定：
- Tender Correction
- Reprint
- future approved correction workflows

規則：
Reason OPTIONAL / NON-BLOCKING，除非特定安全 policy 明確要求。
員工可以自填。
Quick reason 唔可以變交易 blocker。

---

# 34. Authentication UI｜R1

Current R1 Auth：
- Login ID
- PIN challenge/proof
- session

UI：
- 單一卡片
- Login ID
- PIN
- error
- submit

Raw PIN 不離開 browser。
Session 不放 localStorage/sessionStorage。
Logout 清 authenticated Query cache。

日後 Password/Passkey/MFA 可升級，但唔改 Admin IA。

---

# 35. Config Editing UI Pattern｜全域鎖定

所有 editor page 採：
**Summary → Task Picker → Focused Editor → Back to Summary**

避免同一頁幾十個 field 全開。

共用 components：
- PageHeader
- StatusBadge
- KpiCard
- DataTable / ResponsiveRecordList
- SearchField
- FilterBar
- EmptyState
- ErrorState
- StaleBanner
- DraftBar
- GuidedPanel
- TaskPicker
- ValidationPanel
- ImpactPanel
- ReadbackPanel
- Timeline
- AuditDetailDrawer
- ConfirmDialog

禁止每個 domain 自己 invent 第二套 pattern。

---

# 36. Draft / Pending Changes UI｜鎖定

當有 config change：
底部 sticky Draft Bar：
-「X 項未發佈變更」
-「查看」
-「檢查」
-「放棄」

禁止 page-level「保存 = 正式生效」。

離開有 unsaved in-memory draft：
- browser beforeunload guard
- in-app route confirmation

Reload 後 draft 若無 server draft support：
明確會消失；唔暗中 localStorage persist。

---

# 37. Loading / Error Copy｜鎖定

統一文字：

Initial：
「正在讀取…」

Empty：
「目前未有資料」

Refresh：
「更新中」

Offline with data：
「離線 · 顯示上次成功資料」

Offline no data：
「離線 · 未有可顯示資料」

Pending：
「已送出 · 等待確認」

Unknown：
「結果未明 · 正在重新確認」

Partial：
「部分完成 · 需要處理」

Failed：
「操作失敗」

Conflict：
「資料已更新 · 請重新讀取後再套用」

Unauthorized：
「你目前冇權限做呢個操作」

禁止：
「timeout = failed」
「connected = synced」
「saved = published」

---

# 38. Mutation Feedback｜鎖定

任何正式 mutation UI 都用五段：

1. READY
2. SUBMITTING
3. PENDING / UNKNOWN
4. CONFIRMED
5. FAILED / CONFLICT

CONFIRMED 必須有 readback/evidence。
Optimistic UI 唔可以直接變正式成功。

重試前要知道：
- operation identity
- idempotency
- side effect risk

Unknown 狀態禁止 blind retry。

---

# 39. Accessibility｜硬要求

- semantic heading
- nav accessible label
- real button
- visible labels
- focus ring
- aria-live for status
- role=alert for blocking error
- 44px touch
- keyboard reachable
- status 唔靠 color
- tables mobile 要保留 field label
- modal focus trap / restore

---

# 40. Performance / UX Requirements

- Shell 可互動目標 <1.5s on normal broadband after cached assets。
- Page switch 不可整頁 blank。
- Query background refresh 不清舊資料。
- Search/filter local interaction即時。
- 大 list 要 pagination / bounded render。
- 圖片 lazy load。
- 禁止首頁一次 fetch 全 Admin 世界。
- Query 按 workspace ownership載入。

---

# 41. Server State / Client State Architecture｜鎖定

Server state：
**TanStack Query**

Explicit durable unsent command：
**Dexie / IndexedDB only where product explicitly approves offline command**

Local draft/UI：
**React / Zustand**

Auth：
**Separate memory/security layer**

禁止：
- localStorage server truth
- persisted PUBLISHED/QUEUED/PUBLISHING
- v2 sync-status
- canonical-hydrated marker
- duplicated manual cache
- custom server-state event bus
- WebSocket data authority

---

# 42. WebSocket / Realtime｜鎖定

WebSocket = doorbell。

Flow：
EVENT
→ invalidate exact query keys
→ HTTP canonical/read model refetch
→ render result

不得：
- event payload直接入正式 UI
- event payload write local persistence
- setQueryData as formal truth

Socket down：
只影響 realtime signal；
唔刪已成功 HTTP data。

---

# 43. One-shot Rebirth Engineering Rule

Admin V3 從呢份 Brief 開始改為 **一次過重生**：

- 一個主 implementation branch / program
- 可有多個內部 commit，但唔做 A1/A2/A3 partial production promotion
- 全部 R1 Product Scope + Shell + IA + common UI patterns + state semantics 一次完成
- 只喺獨立 V3 Preview 驗收
- v2 Production 全程照常
- V3 全產品驗收 GREEN 先做 cutover proposal

舊 A1/A2 incremental plan 停止作 implementation roadmap；只可保留已寫 code 作參考，必須服從本 Brief。

---

# 44. Implementation No-touch

One-shot Admin V3 rebuild default只准：
- v3admin/**
- V3-specific tests
- V3 preview deployment config（要 Commander 明確批准先可加入）

不得改：
- v2admin/**
- v2smm/**
- v2customer/**
- v2owner/**
- v2local/**
- SMT Store Kernel
- Order / Pricing / Payment / Fulfillment engine
- Provider core
- existing production deploy workflow
- admin.morefunos.com routing

若產品需要 backend seam：
先列 `BACKEND_CONTRACT_GAP`，由 Commander另批。
唔可以 Codex自行擴 scope。

---

# 45. Product Acceptance｜必須一次過過

## Functional
- 所有 R1 nav/routes存在
- 所有 workspace實作，唔係 placeholder
- Read-only / mutation邊界符合 Brief
- Draft/Publish/Readback workflow完整
- Reports固定可信
- Audit/Diagnostics完整

## UI
- Desktop / Tablet / Mobile IA一致
- 無 page-level horizontal overflow
- loading/empty/error/offline/unknown/partial/conflict都有真 UI
- component pattern一致
- product detail task picker
- pending changes/draft bar
- publish impact/readback panel

## Authority
- 冇第二 Order/Pricing/Sellability/Print/Payment authority
- 冇 browser server truth
- WebSocket only invalidates
- revision唔做 freshness oracle

## Security
- server-side authz
- auth token唔持久化
- sensitive data redaction
- export permission獨立
- no secret in audit

## Reliability
- background refresh保留舊成功資料
- reconnect refetch/reconcile
- timeout = unknown
- mutation confirmed靠 readback
- duplicate retry唔做第二 business effect

---

# 46. Automatic RED / 必須返工

以下任何一項 = 整個 Admin V3 不可 GREEN：

- 需要清 cache 先正常
- 同一 canonical喺兩個 browser顯示不同正式狀態
- localStorage 成為 authority
- Save 被當 Publish
- Publish 無 readback就顯成功
- SMT Applied 無 exact readback
- WebSocket payload直接成 truth
- Query failure顯 0 / empty
- Unknown顯 Failed
- mobile 爆版
- placeholder page充數
- P1 偷入 R1主導航
- backend/v2 scope 被偷偷改
- tests 被刪／弱化先過 CI
- UI同 Brief唔一致但聲稱「功能等價」
- Codex 自己 redesign IA
- 同一 domain出現第二套 component/state pattern

返工流程：
1. 指出 Brief section
2. FIRST BREAK
3. 修單一 seam
4. 補 regression
5. 全 Admin V3 suite重跑
6. 冇全綠不可 promote

---

# 47. Cutover Gate

V3 完成後先開 Preview Physical Acceptance：

Browser：
- normal iPhone Safari
- ChatGPT/in-app browser
- iOS Chrome
- desktop Chrome/Safari
- same-origin second tab
- reload
- reconnect
- offline/online transition

必驗：
- canonical parity
- draft behavior
- publish/readback
- exact statuses
- responsive UI
- no cache clear requirement

最後先提出：
`V3 → admin.morefunos.com`

未 physical accepted：
v2 仍係 Production。

---

# 48. Source / Decision Basis

本 Brief 收斂自現有 MFK project evidence：
- MoreFunOS Admin 全流程、分支、確認與 Handoff 審核報告 V1
- Admin Print / Product / Pricing 後續工序包
- POS Chapter 01–24 authority / diagnostics / error UX principles
- MFK Final System Investigation
- current v2 Admin capability inventory

如果舊文件同本 Brief衝突：
對 **Admin V3 Product / IA / UI**，本 Brief經 Owner批准後成為 controlling product spec；
Domain authority仍服從 COMMANDER_CURRENT / #22 / #596 / live canonical contracts。

---

# 49. Owner Approval Gate

未經 Owner 批准本 Brief：
- 不准叫 Codex開始 one-shot Admin V3 implementation
- 不准 merge A1/A2 incremental implementation
- 不准新增 V3 production routing

批准後執行模型：

**PRODUCT BRIEF LOCK → CODEX ONE-SHOT BUILD → CI/REVIEW → V3 PREVIEW → FULL PHYSICAL ACCEPTANCE → CUTOVER DECISION**

MILESTONE:
`MFK_ADMIN_V3_PRODUCT_BRIEF_FUNCTION_UI_LOCK_R1_READY`
