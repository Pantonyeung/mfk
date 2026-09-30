# MFK Admin V3｜產品 Brief / 功能 / UI 鎖定 R1

> Status: CURRENT PRODUCT SPEC CANDIDATE  
> Root Control: #596  
> Product Control: #601  
> Runtime impact: NONE  
> Production routing: FORBIDDEN until full V3 acceptance

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

# 4. Product Map / Functional IA｜鎖定

Admin V3 Product Brief 必須係一張 **產品地圖**，唔係功能迷宮。

## 4.1 Two-step discovery hard rule

任何正式功能／工作區，使用者最多只可以用兩步搵到：

**大 Menu → 細 Menu → 目標內容**

- 第一步：大 Menu = 功能性／業務性分類。
- 第二步：細 Menu = 具體管理頁。
- 第二步完成後，內容區必須已經顯示使用者要搵嘅 List / Workspace。
- 之後撳某個 Order / Product / Staff / Printer 等進 Detail / Settings / Edit，屬物件操作，唔係第三層導航。
- 正常 discovery 禁止第三層 Sidebar / nested accordion chain。
- 禁止「更多 → 平台 → 設定 → 其他」呢類 catch-all path。
- 低頻正式功能仍要有清楚 primary home，唔可以因為低頻而收埋。
- 功能數量唔係設計目標；**清楚易搵 > 導航數量少**。

## 4.2 Primary home + contextual shortcut

每個正式功能只得一個主要歸屬位置。

其他相關頁可以：
- 顯示該 task 所需嘅少量相關設定；
- 提供 direct deep-link 去真正管理頁。

但禁止：
- 複製第二套設定模型；
- 建第二 authority；
- 因方便而令兩個 domain 都可以獨立寫同一份正式 truth。

例：
- 產品詳情可以設定「呢件產品要印乜」，亦可「前往打印管理」。
- 完整 Logical Printer / Template / Route / Device 管理由「打印管理」負責。

## 4.3 大 Menu｜功能性分類

1. **今日**
2. **訂單管理**
3. **菜單管理**
4. **營運管理**
5. **平台／渠道管理**
6. **打印管理**
7. **裝置管理**
8. **人員與權限**
9. **報表**
10. **發佈與版本**
11. **門店設定**
12. **系統管理**

以上數量唔係硬上限。
Owner 可按產品需要新增、合併或改名；禁止為追求「少 Menu」而將功能收埋。

---

# 5. Product Map / Route Map｜鎖定

所有細 Menu 都係第二步；揀完即到目標 List / Workspace。

## 今日
- /admin/overview — 營運總覽
- /admin/action-queue — 待處理事項

## 訂單管理
- /admin/orders/open — 進行中訂單
- /admin/orders/history — 訂單歷史
- /admin/orders/aftersales — 售後／退款／取消／修正
- /admin/orders/exceptions — 訂單異常

## 菜單管理
- /admin/catalog/categories — 分類管理
- /admin/catalog/products — 產品管理
- /admin/catalog/modifiers — 選項／口味管理
- /admin/catalog/combos — 套餐管理
- /admin/catalog/pricing — 價格管理
- /admin/catalog/menu-display — 顯示與排序
- /admin/availability — 售罄／供應

## 營運管理
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
- /admin/access — 登入／Session／Trusted Device

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
- /admin/publish/versions — 版本／Readback
- /admin/publish/rollback — 回復版本

## 門店設定
- /admin/store/settings — 門店資料
- /admin/store/hours — 營業時間
- /admin/store/business-day — Business Day 分界
- /admin/store/operations — 營運時間／提醒設定
- /admin/store/quick-reasons — 快捷原因

## 系統管理
- /admin/system/audit — 操作記錄
- /admin/system/diagnostics — 系統診斷
- /admin/system/integrations — 系統整合
- /admin/system/advanced — 進階／Effective Settings

P1 routes 可以保留，但 R1 navigation 唔曝光 placeholder。

---

# 6. Global Shell UI｜鎖定

## Desktop

核心 navigation 採 **兩步可見模型**：

左側第一欄：大 Menu / Functional Domain。  
左側第二欄：目前大 Menu 對應嘅全部細 Menu。

規則：
- 大 Menu 全部有清楚文字標籤。
- 細 Menu 一次顯示目前 domain 全部正式頁面；禁止再加第三層 Sidebar。
- Active 大 Menu / 細 Menu 必須清楚。
- 兩個 navigation rail 可獨立 scroll，但唔可以靠 hover 先知道名稱。
- 內容區只處理 List / Detail / Create / Edit / Workflow。
- Breadcrumb 只顯示 context，唔用嚟補救隱藏 navigation。
- Topbar sticky 64px。
- Main content 保持合理閱讀寬度；禁止 page-level horizontal scroll。

Topbar：
- Page title
- Store（MF01）
- Cloud freshness
- Session user
- Global status trigger
- Account menu

## Tablet

保留同一 IA：
**大 Menu → 細 Menu → Content**

可以：
- 大 Menu rail 收窄；
- 細 Menu 用固定／overlay panel。

但禁止：
- 將正式功能塞入「更多」；
- 改變 desktop / tablet 功能歸屬。

## Mobile

Mobile 只改呈現，唔改資訊架構。

入口：
- 頂部 Menu button 打開完整功能導航。
- 第一頁顯示全部大 Menu。
- 撳大 Menu 後顯示該 domain 全部細 Menu。
- 撳細 Menu 即進目標內容。
- 可以返回「全部功能」。

禁止：
- 用「更多」做 catch-all；
- 三層 nested menu；
- desktop 有直接入口、mobile 卻收埋去另一條 IA。

內容頁：
- Page title + Store + status
- List 轉 stacked records
- Detail/Edit 保持同 desktop 欄位語義
- 無 page-level horizontal scroll

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

# 11. 訂單管理｜鎖定

訂單管理係獨立功能 domain。
使用者想「搵張單、睇而家做到邊、查歷史、做售後、處理訂單異常」時，第一時間就應該入 **訂單管理**。

Sidebar 細 Menu 直接顯示：
- 進行中訂單
- 訂單歷史
- 售後／退款／取消／修正
- 訂單異常

所有頁面符合：
**訂單管理 → 細 Menu → 已見到目標內容 → 撳 Order / Case 入 Detail / Action**

Admin 唔建立新 Order，唔做第二 POS。

## 11.1 進行中訂單

入口：
**訂單管理 → 進行中訂單**

第二步完成後直接見 Active Order List。

Header：
- Title：進行中訂單
- Search
- Filter
- Refresh / freshness

Search：
- Display Number
- MFK Order ID（detail/search）
- External Order Reference
- Customer name / masked phone（如正式 read model 有）

Filters：
- Source
- Fulfillment
- Payment
- Scheduled / delayed
- Business Day
- Attention only

List / Card 最低顯示：
- Display Number
- Source
- Created / elapsed
- Effective amount
- Payment summary
- Fulfillment summary
- Staff / owner（如有）
- Scheduled / due / promised time（如有）
- Exception badges
- Row action：查看

Primary status 只表達目前主要工作狀態。
其他 truth 分開顯示。

例：
- 履約：未完成 / 可取餐
- 付款：已付款 / 待付款 / 結果未明
- 來源：門市 / 自家平台 / Keeta
- Exception：打印異常 / 平台取消要求 / 對帳注意

禁止建立：
READY_PAID_PRINT_FAILED_CANCEL_PENDING
呢類 global order status。

## 11.2 訂單歷史

入口：
**訂單管理 → 訂單歷史**

第二步完成後直接見 Historical Order List。

Search / Filter：
- Display Number / Order ID
- Source
- Date / Business Day
- Completion state
- Refund / adjustment
- Payment method
- Staff

List：
- Display Number
- Source
- Created
- Completed / Cancelled time
- Original amount
- Adjustment summary
- Current effective amount
- Refund indicator
- Cancel indicator
- Payment summary
- View

歷史 Order 永久保留。
Refund / Cancel / Correction 係 linked record / transition，
唔直接改寫舊 Order 歷史。

## 11.3 Order Detail

撳一張 Order 後進 Detail。
呢個係 object interaction，唔係第三層 Menu。

Header：
- Display Number
- Source
- Created / committed time
- Current primary workflow state
- Effective amount
- Attention badges
- Freshness

內容可用 tabs / section navigation：
- 摘要
- 商品
- 付款
- 履約
- 售後
- 時間線

呢啲係同一張 Order Detail 內嘅 content view，
唔係 Sidebar 第三層。

### 摘要
- Order identity
- Source / external reference
- Created / committed
- Customer / pickup identity（如有）
- Effective amount
- Payment summary
- Fulfillment summary
- Staff / owner
- Scheduled / promised / delayed
- Current exceptions

### 商品
- Product
- Quantity
- ProductSnapshot
- Option / Modifier
- Combo relationship
- Remark
- Line price / adjustment summary
- Print / production exception summary（只在 relevant）

### 付款
- Current effective tender
- Payment entries
- Payment certainty
- Refund summary
- Tender correction history
- Processor / proof reference（detail only）

### 履約
- Current fulfillment state
- State history
- Ready / completed timing
- Delay
- Scheduled / promised time
- Handover facts（如有）

### 售後
- Refund
- Cancel
- Tender Correction
- Other approved correction
- Linked records
- Current effective result

只顯 current state 下真正 allowed action。
唔顯一排永遠存在嘅危險 buttons。

### 時間線
聚合：
- Order created / committed
- Payment
- Fulfillment transitions
- Refund / correction
- Print exception
- Platform event
- Actor / time

每條重要事件可以 deep-link 去原 Audit / Proof。

## 11.4 售後／退款／取消／修正

入口：
**訂單管理 → 售後／退款／取消／修正**

第二步完成後直接見 After-sales / Correction List。

Filters：
- Type
- Current state
- Date
- Staff / actor
- Amount
- Attention / unresolved

List：
- Type
- Display Number
- Original amount
- Requested / corrected amount
- Current effective result
- Actor
- Created
- Current state
- Readback / proof state
- View

支援已正式存在／批准嘅 workflow：
- Refund
- Cancel
- Tender Correction
- Approved amount / content correction（只限 contract 存在）
- Post-day-close correction（backend seam 未完整時只保留產品位置）

新建售後 action 正常入口：
1. 先揀／搜尋原 Order
2. 揀 allowed action
3. Preview current facts
4. Permission / Reason / Version Guard（按 policy）
5. Execute
6. Readback
7. Audit

呢個係真正高風險 workflow，可以有 steps。
但搵到「售後」本身仍然只需要兩步導航。

## 11.5 Refund

Refund UI 必須清楚顯示：
- Original Order
- Original payment / tender summary
- Refundable amount
- Proposed refund amount
- Method / destination（按 contract）
- Reason（optional / required 由 policy）
- Current payment certainty
- Expected result

Execute 後：
- 原 Payment / Order history保留
- 建 linked refund / reversal record
- 未 readback 前 PENDING / UNKNOWN
- 禁止 timeout 後 blind retry

## 11.6 Cancel

Cancel UI 必須清楚：
- 正在取消邊張 Order
- Current Order / Fulfillment / Payment facts
- 已發生 side-effect 有乜
- Reason
- Expected impact

Cancel 唔等於：
- delete Order
- delete Payment
- 自動退款
- 自動重印

真正 dependent actions 按 domain contract 分開處理。

## 11.7 Tender Correction

Primary Home：
**訂單管理 → 售後／退款／取消／修正**

UI：
- Original tender
- Corrected tender
- Amount
- Current effective tender
- Reason / quick reason
- Actor
- Expected reporting effect

規則：
- SAME Order
- zero new Order
- preserve history
- zero auto reprint
- zero auto drawer action

日結後 Admin Tender Correction：
產品位置保留，
但正式 Admin backend mutation seam 未完整證實時標：
**BACKEND_CONTRACT_GAP**

唔可以做假 button 或只改 browser state。

## 11.8 訂單異常

入口：
**訂單管理 → 訂單異常**

第二步完成後直接見真正同 Order 有關嘅 exception workspace。

只收會影響特定 Order / transaction 嘅正式異常，例如：
- Payment UNKNOWN
- Platform cancel request
- Late / delayed external order
- Order / provider reconciliation mismatch
- Order-level print exception
- Mapping issue affecting a concrete order
- Other formal transaction attention

List：
- Severity
- Display Number
- Source
- Issue type
- Business impact
- Current certainty
- First seen
- Last observed
- Current owner domain
- CTA：處理

唔將所有系統 error 倒入訂單異常。
Device / platform-wide / config-wide incident 留返各 Primary Home / Action Queue。

## 11.9 訂單異常 Detail / Recovery

Detail：
- What happened
- Current confirmed facts
- Unknown / partial facts
- Affected domain
- Safe action
- Evidence / readback
- Timeline

如果真正 mutation 屬另一 domain：
- deep-link 去責任頁
- 唔喺 Order Exception 自己重造 command

例如：
- 打印 job 問題 → 打印管理 / 打印狀態
- 平台 mapping → 平台／渠道管理 / 商品映射或匹配失敗
- Device offline → 裝置管理 / 裝置狀態

## 11.10 狀態語義

Order UI 永遠分開：
- Order lifecycle
- Payment
- Fulfillment
- Production / Print side-effect
- Platform / source
- Exception / reconciliation

Ready ≠ Completed。
Paid ≠ Fulfilled。
Connected ≠ Order synced。
Print failed ≠ Order failed。
Platform accepted ≠ MFK formal Order committed（除非 canonical facts 已證實）。

Query failure唔可以顯示成：
- 0 orders
- no history
- empty success

Stale remote data 必須有 freshness。

## 11.11 人類第一直覺歸類

- 「而家有咩單做緊？」→ 訂單管理 / 進行中訂單
- 「搵返昨日某張單」→ 訂單管理 / 訂單歷史
- 「退款／取消／改付款方式」→ 訂單管理 / 售後／退款／取消／修正
- 「邊張單有問題？」→ 訂單管理 / 訂單異常
- 「點解嗰張單冇印？」→ Order Detail 見摘要，再 deep-link 打印管理 / 打印狀態
- 「Keeta mapping 錯」→ 平台／渠道管理 / 商品映射或匹配失敗
- 「部 SMT offline」→ 裝置管理 / 裝置狀態

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 12. 營運管理｜售罄／供應｜鎖定

Primary Home：
**營運管理 → 售罄／供應**

使用者第二步完成後直接見目前商品可售狀態，唔需要再入「菜單 → 商品 → 進階 → 供應」。

產品詳情仍可以顯示目前可售摘要同 contextual shortcut：
**前往售罄／供應**

## 12.1 售罄／供應列表

Header：
- Title：售罄／供應
- Search：商品名稱 / Product Code
- Filter：分類 / 目前狀態 / Channel / Attention only

List 最低欄位：
- Product
- Category
- 目前有效可售狀態
- Runtime 狀態
- Channel summary
- Temporary / reset summary
- Last readback
- Attention
- Row action

正常 UI 優先顯示 business meaning：
- 可售
- 暫停售罄
- 今日售罄
- 指定渠道停售
- 未到供應時間
- 受必要選項／套餐依賴影響
- 結果未明
- 資料過期

唔要求前線使用者理解 Base Eligibility / Runtime Resolver 呢類工程術語。

## 12.2 底層真相仍然分開

UI 雖然簡潔，但資料語義必須分：

A. Admin Base Eligibility / Policy
- active / disabled
- schedule / channel policy
- publish-controlled config

B. SMT Runtime Sellability
- temporary sold out / restore
- runtime operational state
- authoritative readback

C. Channel Projection
- 各平台目前 observed sellability
- propagation / mismatch 狀態

Effective Sellability 只係以上正式 truth 嘅 projection。
禁止 Admin 再造第二 Availability Engine。

Inventory quantity 可以係 signal / reference，
但禁止將 Inventory quantity 直接當 transaction sellability authority。

## 12.3 商品 Detail

撳一件商品後進 Detail。

Header：
- Product
- Current effective sellability
- Last readback
- Attention
- Safe action（只限 contract 支援）

內容分組：
- 目前狀態
- 基礎規則
- 即時狀態
- 依賴
- Readback

Contextual shortcuts：
- 前往產品管理
- 前往選項／口味
- 前往套餐管理
- 前往平台／渠道管理
- 前往待處理事項

## 12.4 即時操作

只喺正式 runtime request contract 存在時顯示：
- 暫停售罄
- 恢復供應
- 指定時間後恢復
- 指定渠道停售／恢復（如 contract 支援）

操作：
**Action → PENDING → authoritative readback → CONFIRMED / UNKNOWN / FAILED**

未 readback 前唔可以畫成已成功。

Availability 只控制新 transaction admission。
已成立 Order 唔可以因為商品之後停售而自動：
- cancel
- remove
- refund
- rollback production

如果已成立 Order 真係做唔到，
要進正式 Order exception / modification workflow。

## 12.5 人類第一直覺歸類

- 「呢件貨而家賣唔賣得？」→ 營運管理 / 售罄／供應
- 「改商品名稱／價錢／分類」→ 菜單管理 / 產品管理
- 「某個口味停售」→ 營運管理 / 售罄／供應
- 「Keeta 有冇同步到停售」→ 平台／渠道管理 / 供應同步
- 「點解停售 request 冇套用」→ 系統管理 / 系統診斷

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 13. 菜單管理｜工作區總規格

菜單管理係一個清楚嘅功能 domain；Sidebar 細 Menu 直接顯示：
- 分類管理
- 產品管理
- 選項／口味管理
- 套餐管理
- 價格管理
- 顯示與排序
- 售罄／供應

正常使用唔需要喺以上頁面之間猜路徑。
每個頁面都遵守成熟後台模式：

**List → Detail → Create / Edit**

共用規則：
- List page：Page title + 主要 Create CTA + Search / Filter + Table / List。
- Detail page：Object header + 核心摘要 + 分組內容 + 清楚 Edit action。
- Create / Edit page：一個直接表單，必填項先出現；相關設定以 section 分組。
- 唔使用長篇 onboarding / wizard 文案去解釋顯而易見嘅下一步。
- Breadcrumb 只顯示位置，例如：菜單管理 / 產品管理 / 紫米飯團。
- 所有 Menu config 仍共用同一 Draft Context；Page save 只更新 Draft，唔等於 Publish。
- Product / Category / Option / Combo 關係必須可以由頁面直接睇到。
- 跨 domain 只提供 contextual shortcut；唔複製第二套 authority。

---

# 14. 產品管理｜鎖定

## 14.1 產品列表

入口：
**菜單管理 → 產品管理**

第二步完成後已經直接見到產品 List。

Header：
- Title：產品管理
- Primary CTA：新增產品

Search / Filter：
- 搜尋：名稱 / Product Code
- 分類
- 狀態
- 套餐關係
- Draft change

Desktop table 最低欄位：
- 圖片
- 商品名稱
- Product Code
- 分類
- Base Price
- Active
- 選項／口味摘要
- 打印摘要
- Draft indicator
- Row action

Mobile：
- stacked record
- 首行：名稱 + 價格 + 狀態
- 次行：分類 + Code
- 再顯示有異常／Draft 時先需要嘅 badge

## 14.2 新增產品

入口：
- 產品管理 → 新增產品
- 或 分類詳情 → 新增產品；由分類 context 進入時，自動預選該分類。

建立產品必填：
- Product Name
- Product Code
- Category
- Base Price
- Active

Category 必填，唔可以建立無歸屬產品。

Create form 分區：

### 基本資料
- Product Name *
- Product Code *
- Category *
- Base Price *
- Active *
- Description
- Image

### 選項／口味
- 套用現有 Option Set
- 顯示 Required / Min / Max 摘要
- 可新增／移除 linkage

### 套餐
- 是否屬於 Combo / Child 關係
- 關係只引用正式 Combo object

### 產品打印設定
- Receipt ON/OFF
- Production ON/OFF
- Packing ON/OFF
- Label ON/OFF
- Dine-in print ON/OFF
- Label destination（Admin logical printer）

產品頁只回答「呢件產品要印乜」。
完整 Printer / Template / Route / Device 管理由「打印管理」負責。
產品頁提供 contextual shortcut：**前往打印管理**。

### 價格相關
- Product takeaway surcharge flag
- 其他已批准 product pricing input

唔喺 UI 顯示工程 authority 教學文案；唯一 Pricing Authority 係 implementation contract，唔係日常操作說明。

## 14.3 產品詳情

Header：
- Product name
- Product Code
- Active state
- Category
- Base Price
- Edit

內容分組：
- 基本資料
- 價格
- 選項／口味
- 套餐關係
- 打印
- 圖片
- 最近變更／Draft 狀態

使用者可以直接由產品詳情改 Category。
改分類 = reassign；唔需要刪除產品再建立。

---

# 15. 分類管理 / 顯示排序｜鎖定

## 15.1 分類管理

入口：
**菜單管理 → 分類管理**

Header：
- Title：分類管理
- Primary CTA：新增分類

列表：
- Category Name
- Product Count
- Active
- Display Order
- Draft indicator
- Row action

支援：
- 新增分類
- 改名
- 啟用／停用
- 排序
- 查看分類內產品

分類 Detail：
- Category summary
- 分類內產品 list
- CTA：新增產品
- CTA：管理產品

由分類 Detail 新增產品時：
- 新產品 Category 自動預選目前分類。

Delete guard：
- 有 product reference 時不可直接 delete。
- UI 顯示受影響 product count。
- 提供「重新分類」入口。
- 完成 reassign 後先可以 delete。

## 15.2 顯示與排序

入口：
**菜單管理 → 顯示與排序**

用途：
- Category order
- Product order within category
- Visibility

Desktop：
- 左：分類順序
- 右：選中分類商品順序

支援 drag & drop；亦要有 keyboard / explicit move control。

Mobile：
- 上移 / 下移
- 直接顯示目前序號

禁止建立 print-only product sort authority。
打印沿用 Admin 已發布 Category / Product 排序。

---

# 16. 選項／口味管理｜鎖定

UI 對人類使用名稱：
**選項／口味管理**

底層 contract 可保留 Modifier / Option Set 命名，但正常 UI 唔要求使用者理解工程術語。

## 16.1 Option Set 列表

入口：
**菜單管理 → 選項／口味管理**

Header：
- Title：選項／口味管理
- Primary CTA：新增選項組

List：
- Name
- Required
- Min
- Max
- Option count
- Active
- Used by product count
- Draft indicator
- Row action

## 16.2 Option Set Detail / Edit

基本資料：
- Name
- Required?
- Min
- Max
- Active

Options table：
- Name
- Code
- Price Adjustment（正 / 0 / 負）
- Active
- Position
- Row action

支援：
- 新增 Option
- 編輯 Option
- 排序
- 停用
- 正價 / 零價 / 負價 adjustment

Usage：
- 顯示被邊啲 Product / Combo 使用
- 可以 deep-link 去該 Product / Combo
- 刪除前要顯示 reference impact

Product linkage：
- Product 只 attach reusable Option Set
- Product-specific default / constraints 只在 contract 支援時顯示

所有 adjustment 只係 canonical pricing input；唔建立第二 pricing engine。

---

# 17. 價格管理｜鎖定

入口：
**菜單管理 → 價格管理**

用途：
提供集中式價格管理／批量檢查，唔取代 Product Detail 入面嘅單件價格編輯。

List：
- Product
- Category
- Base Price
- Takeaway surcharge
- Option price effect summary
- Combo price relation
- Active
- Draft indicator

支援：
- 搜尋
- 分類 filter
- 直接進 Product / Option / Combo detail
- 經正式 Draft 修改已批准 pricing input

UI 可管理：
- Base price
- Option +/- adjustment
- Product takeaway +$1 flag
- Combo base price / adjustment
- future governed promo input

Product 外賣附加費：
- Product ON → 該 Product line takeaway +$1
- Combo ON → whole Combo +$1
- child 不可再重複 +$1

正式交易仍由唯一 Pricing Authority 計算。
呢條係 system contract；正常 UI 唔用技術警告文案阻住使用者。

---

# 18. 套餐管理｜鎖定

## 18.1 套餐列表

入口：
**菜單管理 → 套餐管理**

Header：
- Title：套餐管理
- Primary CTA：新增套餐

List：
- Combo Name
- Product Code
- Category
- Base Price
- Group count
- Child count
- Active
- Draft indicator
- Row action

## 18.2 新增／編輯套餐

Create / Edit 一個清楚表單：

### 基本資料
- Combo Name
- Product Code
- Category
- Base Price
- Active

### 套餐組別
每 Group：
- Name
- Required / Optional
- Min
- Max
- Position

### Child Products
- Child product identity
- Adjustment
- Availability summary
- 自身 Option / Modifier relationship 保留

### 打印
- 顯示 product-level print summary
- contextual shortcut 去打印管理

Combo 必須保留：
- Parent identity
- Main/add-on pools
- Required/optional groups
- Min/max
- Child product identity
- adjustment

打印 / report 不可拆散到失去 Combo relationship。
跨來源 total 只係 read/display，唔改 identity。

---

# 19. 發佈與版本｜鎖定

發佈與版本係獨立功能 domain。
使用者想知道「有咩未發佈、今次會改乜、發佈咗未、SMT 真正套用咗未、要唔要回復」時，第一時間就應該入 **發佈與版本**。

Sidebar 細 Menu 直接顯示：
- 未發佈變更
- 發佈中心
- 版本／Readback
- 回復版本

所有頁面符合：
**發佈與版本 → 細 Menu → 已見到目標內容**

同時，所有 config domain 可以用 Draft Bar / contextual shortcut 直接 deep-link 去以上頁面。
Deep-link 只係捷徑，唔取代 Primary Home。

## 19.1 未發佈變更

入口：
**發佈與版本 → 未發佈變更**

第二步完成後直接見所有 Draft changes。

Header：
- Title：未發佈變更
- Changed count
- Last modified
- Current draft owner / actor summary（如有）
- Primary CTA：檢查並發佈

List / grouped view：
- Domain
- Object
- Change type：新增 / 修改 / 停用 / 刪除候選
- Before / After summary
- Validation state
- Last changed by
- Last changed at
- View

支援：
- Search
- Domain filter
- Validation state filter
- 進入原本 object detail
- 放棄單項變更（只限 contract 支援）
- 放棄整批 draft（有 confirm / impact）

正常 UI 唔用 Git diff / JSON patch 做主要顯示。
Advanced detail 先可以睇 technical diff。

## 19.2 發佈中心

入口：
**發佈與版本 → 發佈中心**

呢頁係真正 publish workflow，
可以用 step-based UI，因為本身係有明確 gate 嘅高風險操作。

Flow：
1. Draft Summary
2. Validate
3. Impact Preview
4. Confirm Publish
5. Publishing
6. Cloud Published
7. Target Readback / Reconcile
8. MATCH / PARTIAL / MISMATCH

### Draft Summary
顯示：
- Changed domains
- Object count
- Added / Updated / Disabled
- Actor
- Base version / identity
- Draft age

### Validate
分：
- Blocker
- Warning

Blocker：
- 禁 publish
- 要顯示受影響 object
- 提供 direct link 去修正位置

Warning：
- 清楚顯示
- policy 容許時可以繼續
- 唔可以用紅色假裝 blocker

### Impact Preview
至少列：
- Changed domains
- Added / Updated / Disabled objects
- Channels affected
- Print / routing affected
- Staff / access affected
- Target systems
- Expected runtime impact
- Any known temporary inconsistency window

Impact Preview 唔需要展示 raw dependency graph，
但要令人知道「今次發佈會影響乜」。

### Confirm Publish
Confirm surface：
- version / release identity
- expected base identity / version guard
- impacted scope
- warning summary
- actor
- reason（只在 policy 要求）

Save Draft ≠ Publish。
Publish request accepted ≠ Runtime applied。

## 19.3 Cloud Published

Cloud publish 成功後，UI 要顯示：
- Release / config version identity
- Published by
- **publishedAt**
- Cloud state
- Target list

人類畫面嘅「最後發佈時間」以 Cloudflare / canonical publish time **publishedAt** 為準，
唔用 browser click time、local save time 或 request start time冒充。

Cloud Published 只代表 canonical cloud version 已建立。
唔代表 SMT / target 已套用。

## 19.4 版本／Readback

入口：
**發佈與版本 → 版本／Readback**

第二步完成後直接見 Version List。

List：
- Version / Release
- publishedAt
- Published by
- Changed domains
- Cloud state
- Target apply summary
- MATCH / PARTIAL / MISMATCH / UNKNOWN
- Last reconcile / readback
- View

Version Detail：
- Release identity
- Base version
- publishedAt
- Changed objects summary
- Target-by-target desired identity
- Target observed identity
- observedAt
- freshness
- result
- evidence reference
- Reconcile state

Target readback 最少顯示：
- desired
- observed
- timestamp
- result
- evidence

禁止將：
- doorbell delivered
- websocket connected
- request sent
- target online

當成 config 已套用。

## 19.5 Doorbell + canonical pull + reconcile

Admin → SMT convergence 正式語義：

1. Cloud canonical config / release 先成立
2. Doorbell / event 只做「有新版本」提示
3. SMT canonical pull
4. Apply
5. Readback
6. Admin compare desired vs observed

Doorbell 係 latency optimization，
唔係 correctness authority。

Acceptance 必須證明：
- doorbell miss → reconcile 後仍 convergence
- duplicate doorbell → 唔重複造成錯誤 side-effect
- reordered doorbell → 最終仍以 canonical latest / version guard 收斂

如果 doorbell 唔到：
- Admin 唔可以直接判 FAILED
- reconcile / pull path 仍要可以自行收斂

## 19.6 PARTIAL / MISMATCH / UNKNOWN

MATCH：
- 所有 required targets observed identity 符合 desired
- freshness 足夠

PARTIAL：
- 部分 target MATCH
- 部分仍 pending / unavailable / mismatch

MISMATCH：
- target 已有可信 observed identity
- 明確同 desired 唔同

UNKNOWN：
- 無足夠 readback
- timeout / offline / stale evidence
- 唔可以當 FAILED

畫面要直接列：
- 邊個 target
- desired
- observed
- 最後確認時間
- 下一個 safe action

## 19.7 回復版本

入口：
**發佈與版本 → 回復版本**

第二步完成後直接見可回復嘅歷史版本。

Rollback 唔修改舊 Release。
永遠建立 **新 Release**，內容指向一個已知良好 config state。

Rollback flow：
1. 揀目標歷史版本
2. Preview difference
3. Validate
4. Impact Preview
5. Confirm
6. Publish new rollback release
7. Target readback / reconcile
8. Confirm restored state

UI 必須清楚顯示：
- Current version
- Target historical version
- New rollback release identity
- Changed domains
- Impact
- Expected target scope

成功條件唔係「Rollback request accepted」。
要有：
- new release cloud identity
- target observed identity
- post-rollback readback
- MATCH / PARTIAL / MISMATCH

## 19.8 歷史版本

Historical Release：
- immutable
- 可以 View
- 可以 Compare
- 可以作 rollback source
- 唔可以 Edit

Compare：
- Version A vs B
- domain / object level human-readable diff
- technical diff 只放 advanced detail

## 19.9 Draft Bar

所有 config edit page 有未發佈變更時，
底部 Draft Bar 固定提供：
- X 項未發佈變更
- 查看
- 檢查並發佈
- 放棄

「查看」→ 未發佈變更
「檢查並發佈」→ 發佈中心

呢啲係 shortcut，
唔代表發佈與版本功能要收埋。

## 19.10 人類第一直覺歸類

- 「我改咗啲乜但未生效？」→ 發佈與版本 / 未發佈變更
- 「我要正式發佈」→ 發佈與版本 / 發佈中心
- 「雲端發佈咗未？」→ 發佈與版本 / 版本／Readback
- 「SMT 真正套用咗未？」→ 發佈與版本 / 版本／Readback
- 「點解一部 SMT 仲係舊版本？」→ 版本／Readback，再 deep-link 系統診斷
- 「我要返去上一個好版本」→ 發佈與版本 / 回復版本

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 20. 營運管理｜營業日 / 現金 / 收舖｜鎖定

營運管理 Sidebar 細 Menu 直接顯示：
- 售罄／供應
- 營業日
- 現金／收舖
- 產能／原料額度

## 20.1 營業日

入口：
**營運管理 → 營業日**

第二步完成後直接見 Current Business Day。

Header：
- Current Business Day
- Current state
- Opened at
- Opened by
- Last readback
- Primary action（按 current state）

內容：
- 今日營業日摘要
- Open orders / unresolved attention summary
- Cash / close readiness summary
- Current channel / device attention summary（只摘要）
- Previous business days

State 用人類語言：
- 未開始
- 營業中
- 準備收舖
- 收舖處理中
- 已完成
- 結果未明

Business Day 分界時間可由門店設定配置。
Business Day 只作 record / reporting classification / day-close history，
**永遠唔可以成為 transaction blocker。**

Business Day stale / rollover failure：
- 顯示 attention
- 提供 safe recovery / diagnostics
- 唔阻正式新交易

## 20.2 開始營業日

Current Business Day 未開始時：
Primary CTA：
**開始今日營業**

Create / Confirm surface 只顯必要資料：
- Business date / display
- Open time
- Staff
- Opening cash（如 current contract 要求）

成功條件：
- canonical current businessDay readback confirmed

唔需要長篇 wizard 文案。

## 20.3 收舖入口

營業中時，營業日頁直接有：
**準備收舖**

撳後進正式 Close Workflow：
1. Close Preview
2. 處理 Blockers
3. 現金點算 / Handover
4. Confirm Close
5. Readback

Close Preview 只顯真正需要處理嘅：
- pending payment
- open cash issue
- money attention
- unresolved blocker
- other formally defined close blockers

## 20.4 現金／收舖

入口：
**營運管理 → 現金／收舖**

第二步完成後直接見今日 Cash Workspace。

Header：
- Current Business Day
- Cash state
- Last readback
- Current difference / attention

核心內容：
- Expected cash
- Actual cash（完成點算後）
- Difference
- Removed
- Retained
- Staff / handover
- Current cash movements summary
- Attention / unresolved issue

Close ≠ Drawer ≠ Shift。
UI wording必須分清：
- 營業日
- 現金點算
- 交更 / Handover
- Drawer action
- Shift

## 20.5 現金點算 / Handover

正常表單：
- Expected（read-only）
- Actual *
- Difference（derived display）
- Removed
- Retained
- Staff
- Reason / approval（只在 policy 真正要求）

高風險操作：
**Permission → Reason / Approval（如需要）→ Execute → Readback → Audit**

完成後返回現金／收舖 workspace。

## 20.6 日結後修正

Primary Home：
- 查原 Order → 訂單管理
- 日結後 Tender Correction → 訂單售後／修正 workflow
- Audit → 系統管理 / 操作記錄

產品規格要求：
- SAME Order
- full audit history
- current effective tender
- zero new Order
- zero auto reprint
- zero auto drawer action

目前正式 Admin backend mutation seam 未完整證實：
**BACKEND_CONTRACT_GAP**

UI 可以鎖 workflow / page position，
但 implementation 唔可以假裝已經有正式 mutation API。

## 20.7 人類第一直覺歸類

- 「今日開咗營業日未？」→ 營運管理 / 營業日
- 「而家可唔可以收舖？」→ 營運管理 / 營業日
- 「現金差幾多？」→ 營運管理 / 現金／收舖
- 「點算／交更」→ 營運管理 / 現金／收舖
- 「營業日幾點切日？」→ 門店設定 / Business Day 分界
- 「邊張 Order 阻住收舖？」→ 訂單管理 / 該 Order
- 「點解 Close command 未確認？」→ 系統管理 / 系統診斷

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 21. 營運管理｜產能／原料額度｜鎖定

入口：
**營運管理 → 產能／原料額度**

第二步完成後直接見 Capacity / Quota List。

呢頁管理營運 policy；
唔建立 Inventory ERP，亦唔建立第二 Sellability Engine。

## 21.1 List

Header：
- Title：產能／原料額度
- Primary CTA：新增額度

Search / Filter：
- Pool name
- Active
- Attention

List：
- Pool name
- Initial qty
- Observed remaining（只限正式 runtime read model 有）
- Linked product count
- First-party stop threshold
- Third-party stop threshold
- Active
- Last readback
- Attention
- Row action

如果正式 runtime remaining 未有：
- 唔顯假 0
- 顯示「未有即時數據」

## 21.2 Create / Edit

直接表單：
- Pool name *
- Initial qty *
- Linked products *
- First-party stop threshold
- Third-party stop threshold
- Active
- Note

Linked products 用搜尋 / multi-select，
並清楚顯示：
- Product name
- Category
- Current sellability summary

Save 只進 Draft。
正式生效仍走 Publish / Readback。

## 21.3 Detail

Header：
- Pool name
- Active
- Policy summary
- Runtime observed summary（如有）
- Last readback
- Edit

內容：
- Initial qty
- Linked products
- Thresholds
- Published config
- Runtime observed facts
- Recent changes / audit shortcut

Contextual shortcuts：
- 前往產品管理
- 前往售罄／供應
- 前往平台供應同步
- 前往操作記錄

## 21.4 Authority boundary

Admin：
- 定義 quota / capacity policy
- 定義 linked products
- 定義 thresholds
- Publish config

Runtime：
- 真正扣減
- 即時剩餘量
- 觸發 runtime sellability action（只按正式 contract）
- readback

Inventory signal：
可以係參考輸入，但唔直接變 transaction blocker。

UI 唔需要向普通使用者展示上述 authority 理論；
呢啲係 implementation / acceptance rule。

## 21.5 人類第一直覺歸類

- 「今日某原料得返幾多額度？」→ 營運管理 / 產能／原料額度
- 「邊啲產品用呢個額度？」→ 營運管理 / 產能／原料額度
- 「商品本身停售未？」→ 營運管理 / 售罄／供應
- 「改商品內容／價錢」→ 菜單管理 / 產品管理
- 「Keeta 有冇同步停售」→ 平台／渠道管理 / 供應同步

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 22. 平台／渠道管理｜鎖定

平台／渠道管理係獨立功能 domain。
使用者唔需要先入「更多」或「連接與設備」再搵平台。

Sidebar 細 Menu 直接顯示：
- 平台總覽
- 接單規則
- 供應同步
- 門店綁定
- 商品映射
- 匹配失敗
- 實收估算
- 平台對帳

所有頁面符合：
**大 Menu → 細 Menu → 已見到目標內容 → 撳 object 入 Detail / Edit**

## 22.1 平台總覽

入口：
**平台／渠道管理 → 平台總覽**

第二步完成後直接見全部已配置／可配置平台。

每個平台一行／一張卡：
- Platform Name
- 配置狀態
- 接單狀態
- 連線／Integration health
- 商品映射狀態
- 供應同步狀態
- Last successful read
- Attention / exception indicator
- CTA：查看

正常 UI 用 business wording：
- 接單中
- 已暫停
- 繁忙
- 平台異常
- 連線異常
- 未完成設定
- 結果未明

禁止將以下概念混成一粒「Online / Offline」：
- Store Open
- Business Hours
- Channel Accepting Orders
- Busy
- Connectivity
- Integration Health
- Platform Suspension

Health ≠ Availability。
Connected ≠ Synced。

## 22.2 平台詳情

撳一個平台（例如 Keeta）後進 Detail。
呢個屬 object detail，唔係第三層 navigation。

Header：
- Platform name
- Current accepting state
- Current health
- Last readback
- Edit / contextual actions

內容分組：
- 接單狀態
- 營業／服務時段摘要
- 門店綁定摘要
- 商品映射摘要
- 供應同步摘要
- 商業／對帳摘要
- 最近異常
- 最近 readback

Contextual shortcuts：
- 前往接單規則
- 前往門店綁定
- 前往商品映射
- 前往平台對帳
- 前往待處理事項

如果正式 contract 支援 bounded remote control，可以顯示：
- 暫停接單
- 恢復接單
- Snooze / 暫停至指定時間
- Busy / 延長準備時間

操作未有 authoritative readback 前：
- 顯示 PENDING / UNKNOWN
- 禁止 optimistic 顯示「已成功」

Pause intake 只影響新單。
禁止自動取消／退款／改動已成立 Order。

## 22.3 接單規則

入口：
**平台／渠道管理 → 接單規則**

直接顯示各平台目前接單設定。

List：
- Platform
- Current mode
- Accepting orders?
- Busy / Snooze
- Schedule summary
- Last readback
- Draft / runtime indicator
- Edit

Edit page：
- 只顯示該平台 contract 真正支援嘅 setting
- Temporary action 同 persistent config 分開
- expiry / until time 清楚
- Save Draft / Execute action 按 authority contract 分開

禁止用一個 bool 同時代表 Pause / Busy / Closed / Provider suspension。

## 22.4 供應同步

入口：
**平台／渠道管理 → 供應同步**

用途：
睇同管理 MFK sellability / availability 點樣投影去各平台。

List：
- Platform
- Sync enabled
- Source scope
- Last successful sync
- Current state
- Pending / mismatch count
- Last error
- View detail

Detail：
- sync policy
- affected product scope
- desired vs observed summary
- last readback
- exceptions
- contextual shortcut：前往「售罄／供應」

唔喺呢頁建立第二 Sellability Authority。

## 22.5 門店綁定

入口：
**平台／渠道管理 → 門店綁定**

List：
- Platform
- External store
- MFK store
- Authorization / binding state
- Last verified
- Attention
- Edit

Create / Edit：
- 選平台
- 選 external store identity
- 對應 MFK store
- contract-supported authorization metadata
- Save / Verify / Readback

完成後直接回到 binding detail/list。
唔要求再進另一層「平台設定」。

## 22.6 商品映射

入口：
**平台／渠道管理 → 商品映射**

第二步完成後直接見 mapping workspace。

Search / Filter：
- Platform
- Mapping state
- MFK Category
- Search external / MFK product name

List：
- Platform
- External Product
- MFK Product
- External Category
- Channel Price / commercial summary
- Option / Combo mapping summary
- State
- Last verified
- Edit

Mapping detail / edit：
- External product identity
- MFK Product
- Channel Name
- Channel Category
- Channel Price
- Bundle / Combo mapping
- Option mapping
- Included item mapping
- Last readback
- Save Draft / Verify

Contextual shortcuts：
- 前往產品管理
- 前往選項／口味
- 前往套餐管理

外部 channel commercial mapping 唔可以污染 MFK Direct Price。

## 22.7 匹配失敗

入口：
**平台／渠道管理 → 匹配失敗**

直接見所有需要人工處理嘅 mapping issue。

List：
- Platform
- External object
- Issue type
- Current state
- First seen
- Last observed
- Suggested MFK target（如正式 resolver 有）
- CTA：處理

處理 Detail：
- External facts
- Candidate / current mapping
- Affected order/menu scope
- 修正 mapping
- Verify
- Readback

完成 mapping 唔等於舊 external side-effect 自動重播。
任何需要 transaction reconcile 嘅 case deep-link 去責任 domain。

## 22.8 實收估算

入口：
**平台／渠道管理 → 實收估算**

用途：
管理／展示已批准嘅 channel commercial inputs 同估算。
只顯示 current channel contract 支援嘅正式 fields，禁止 UI 自己發明平台公式。

必須將以下概念分開：
- Sales
- Commission
- Fee
- Merchant Earnings / estimated payout

Merchant Earnings 不可反寫：
- Order Sales
- Tender
- MFK Direct Price

Create / Edit：
- 只容許已批准 commercial input
- Draft → Publish → Readback
- 未有 provider evidence 嘅 field 唔顯假精準數字

## 22.9 平台對帳

入口：
**平台／渠道管理 → 平台對帳**

Read-only R1。

List：
- Platform
- Period / settlement reference
- Sales
- Commission
- Fee
- Merchant Earnings
- Reconciliation state
- Evidence availability
- View

Detail：
- provider reference
- covered period / orders
- Sales
- deductions
- Commission
- Fee
- Merchant Earnings
- MFK comparison / mismatch where formally available
- Evidence / readback
- linked Action Item

平台對帳唔修改 transaction truth。
如果有 mismatch，需要操作時 deep-link 去正式 reconciliation / action workflow。

## 22.10 Human-first copy

正常操作頁唔顯示：
- raw provider status code
- raw API field name
- engineering error code
- internal UUID
- authority theory教學文案

以上只喺 Detail / Diagnostics 必要位置顯示。

使用者第一眼只需要知道：
- 而家接唔接到單
- 健唔健康
- 有冇要處理
- 我應該去邊一頁處理

---

# 23. 裝置管理｜鎖定

裝置管理係獨立功能 domain。
使用者想知道「邊部機有問題、版本係乜、最近有冇連線、而家跑緊邊個 Runtime」時，第一時間就應該入 **裝置管理**。

Sidebar 細 Menu 直接顯示：
- 裝置狀態
- OTA／版本

所有頁面符合：
**裝置管理 → 細 Menu → 已見到目標內容 → 撳 device / release 入 Detail**

禁止將裝置功能收埋入：
「更多 → 連接與設備 → 裝置 → 其他」。

## 23.1 裝置狀態

入口：
**裝置管理 → 裝置狀態**

第二步完成後直接見 Device List。

Search / Filter：
- Device type
- Current health
- Version
- Trust / registration state（如正式 read model 有）
- Last seen
- Attention only

List 最低欄位：
- Device name / display identity
- Type
- Assigned role / location
- Current runtime / app version
- Last seen
- Freshness
- Current health
- Config drift
- Attention indicator
- Row action

正常 UI 唔顯 raw UUID 作主要 identity。
Technical ID 只放 Detail / Diagnostics。

Device type 可以包括目前正式 read model 支援嘅：
- SMT
- SMM endpoint / client instance（只作 assistive surface identity，如有）
- Payment terminal（如有正式 device read model）
- Printer physical endpoint（只作 observed device health）
- 其他正式註冊 device

唔可以因為同一個「Device」字就將所有 authority 混埋。

## 23.2 裝置健康顯示

禁止一粒總綠燈將所有 layer 壓成「正常」。

每部裝置 Detail 至少分開顯示正式有證據嘅 domain：

- Runtime / App
- Cloud / Canonical reachability
- LAN / local connectivity（如有）
- Platform integration（如 relevant）
- Payment（如 relevant）
- Print endpoint（如 relevant）
- Queue / Reconcile
- Config / Version drift

每一項顯示：
- business meaning state
- last observed time
- freshness
- attention / unknown
- contextual action / deep-link（如適用）

規則：
- Paired ≠ Connected
- Connected ≠ Ready
- Ready ≠ Job Success
- Internet Healthy ≠ Provider Healthy
- Runtime Healthy ≠ Canonical Applied
- No recent data ≠ Failed

## 23.3 裝置詳情

撳一部 Device 後進 Detail。
呢個係 object interaction，唔係第三層 Menu。

Header：
- Display name
- Device type
- Current health
- Current version
- Last seen
- Attention / stale state

內容分組：

### Identity
- Display name
- Device type
- Store / location
- Logical assignment / role
- Technical identity（detail only）

### Version
- Current app / runtime
- Desired / approved version（如 relevant）
- Version drift
- Last verified

### Health
- domain-by-domain health
- freshness
- current first break（如已有 diagnostics projection）
- last error summary

### Binding / Assignment
只顯正式 observed facts，例如：
- logical printer → observed physical device
- terminal assignment
- store / device role

Physical IP / USB binding：
- Admin 可顯示 read-only observed result
- 真正現場 binding 仍由 SMT 做
- 提供文案「現場設定」已足夠；唔喺 Admin 重造 binding engine

### Recent activity
- Last config apply
- Last OTA / activation
- Last reconnect
- Relevant incidents

Contextual shortcuts：
- 前往系統診斷
- 前往打印管理（printer relevant）
- 前往平台／渠道管理（integration relevant）
- 前往 OTA／版本

## 23.4 裝置可操作行為

Admin 只顯正式 contract 已存在嘅 action。

可以包含（只限有 contract）：
- Refresh / Readback
- Revoke / Disable（如果屬 device trust authority 並有正式 backend）
- Request approved OTA
- Rollback approved runtime
- Open Diagnostics

如果 backend / runtime contract 未存在：
- 唔整假 button
- 唔用 browser local state 假裝完成
- 標 BACKEND_CONTRACT_GAP

高風險 device action：
**Permission → Confirm / Reason（如 policy 要求）→ Execute → Readback → Audit**

## 23.5 OTA／版本

入口：
**裝置管理 → OTA／版本**

第二步完成後直接見：
- 已批准 Release / Artifact
- Target
- Current rollout / install state
- Current / Previous / Candidate（如 runtime contract 有）
- Hash / identity
- Last readback
- Rollback availability

Admin 只治理已批准 artifact；
禁止修改 Builder / OTA protocol。

List：
- Release name
- Type
- Version
- Source identity / hash summary
- Target
- State
- Applied device count / attention count（如正式 read model 有）
- Last verified
- View

Release Detail：
- Exact release identity
- Hash
- Approved target
- Min compatible version（如 relevant）
- Current deployment state
- Device readback
- Failed / Unknown devices
- Previous version / rollback record

## 23.6 OTA 操作語義

任何 OTA 操作唔可以只用：
「Published」或「Downloaded」當完成。

必須分：
- Artifact approved
- Offered / published
- Downloaded
- Verified
- Candidate staged
- Activation requested
- Current runtime readback
- Functional acceptance（如需要）

只有 Current / installed identity readback matching 先可以講：
「已套用指定版本」。

如果功能驗收未完成：
唔可以因為 activation success 就顯示「功能完成」。

Rollback：
- 只使用正式 previous / approved rollback path
- 必須有 post-rollback identity readback
- 唔修改歷史 release

## 23.7 人類第一直覺歸類

- 「邊部 SMT 有問題？」→ 裝置管理 / 裝置狀態
- 「部機而家跑緊咩版本？」→ 裝置管理 / 裝置狀態
- 「有冇新版／邊啲機未更新？」→ 裝置管理 / OTA／版本
- 「打印機點 route？」→ 打印管理 / 打印規則
- 「打印機 physical IP / USB 綁邊部？」→ SMT 現場
- 「邊個 Staff / Session 信任呢部裝置？」→ 人員與權限 / 登入／Session／Trusted Device
- 「點解壞？」→ 系統管理 / 系統診斷

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 24. 打印管理｜鎖定

打印管理係獨立功能 domain。
使用者想管理「點樣印、印去邊、用邊個模板、而家邊條打印路線有問題」時，第一時間就應該入 **打印管理**。

Sidebar 細 Menu 直接顯示：
- 打印總覽
- 邏輯打印機
- 打印模板
- 打印規則
- 打印狀態／異常

所有頁面符合：
**打印管理 → 細 Menu → 已見到目標內容 → 撳 object 入 Detail / Edit**

唔需要再經：
「連接與設備 → 打印 → 設定 → 其他」。

## 24.1 打印總覽

入口：
**打印管理 → 打印總覽**

用途：
一眼睇清楚目前打印系統有冇需要處理，但唔用一粒「全部正常」掩蓋個別 route 問題。

畫面分區：

### 邏輯打印機狀態
每個 logical printer 顯示：
- 名稱
- 用途／票種
- Active
- 現場綁定狀態（read-only observed）
- Last seen / freshness
- Current health
- Attention indicator

### 最近打印異常
顯示：
- Order / Display Number
- Ticket type
- Logical printer
- Current certainty
- Last attempt
- Last readback
- CTA：查看

### 快捷入口
- 新增邏輯打印機
- 管理模板
- 管理打印規則
- 查看全部異常

禁止：
- 用 Physical IP / USB 作 Admin logical identity
- 將「Printer Connected」顯示成「Print Job 已成功」
- 將 UNKNOWN 顯示成 FAILED

## 24.2 邏輯打印機

入口：
**打印管理 → 邏輯打印機**

第二步完成後直接見 Logical Printer Registry。

List：
- Name
- Type / Capability
- Supported ticket types
- Routing use
- Active
- 現場綁定狀態（read-only）
- Last readback
- Row action

Primary CTA：
**新增邏輯打印機**

Admin logical printer examples：
- 收據機
- 廚房製作單機
- 打包單機
- 飯糰 Label
- 外賣 Label

Create / Edit：
- Name *
- Type / Capability *
- Supported ticket types *
- Routing use
- Active
- Note（如需要）

Physical IP / USB / physical device：
**唔喺 Admin 呢頁設定。**

Admin 可以顯示：
- 「已於 SMT 綁定」
- 「未綁定」
- observed physical device summary（只讀、如 contract 有）

並提供 contextual shortcut：
**前往裝置狀態**

真正 physical binding 仍由 SMT 現場做。

同一 physical printer 可以承擔多個 logical destination；
但 SMT 不得自行建立第二套 logical printer name。

## 24.3 打印模板

入口：
**打印管理 → 打印模板**

第二步直接見 Template list。

固定模板類型：
- Receipt
- Production
- Packing
- Label

List：
- Template Name
- Type
- Used by
- Active
- Last modified
- Draft indicator
- Row action

Create / Edit：
- Template name
- Template type
- 版面／可用欄位設定（只限正式 contract 支援）
- Active
- Preview

Preview 只係視覺預覽；
唔代表 physical print 已成功。

Output semantics：
- Production：回答「要整乜／點整」
- Packing：回答「全單齊唔齊」
- Combo relationship 必須保留
- Food / Drink total 同附帶用品分開

如果某 template 仍被 rule / product 使用：
- 刪除前顯示 references
- 禁止直接 destructive delete
- 先 reassign / disable

## 24.4 打印規則

入口：
**打印管理 → 打印規則**

用途：
管理「邊種票、喺咩條件、送去邊個 logical printer」。

List：
- Rule name
- Ticket type
- Scope / condition summary
- Logical destination
- Active
- Used by / affected scope
- Draft indicator
- Row action

Create / Edit：
- Rule name
- Ticket type
- Scope
- Condition
- Logical destination
- Active

規則可以引用：
- Product / Category
- Dining / Service Mode
- Source / Channel
- Ticket type
- 其他已批准 routing input

但禁止：
- 在 Print Rule 入面建立第二套 Product Category
- 建立 print-only product sort authority
- 用 physical IP / USB 直接做 canonical routing identity

Product / Category identity 同排序沿用菜單管理正式資料。

## 24.5 產品級打印設定

Primary Home：
**菜單管理 → 產品管理 → Product Detail / Edit**

因為使用者想答嘅問題係：
「呢件產品要印乜？」

Product 可以直接設定：
- Receipt ON/OFF
- Production ON/OFF
- Packing ON/OFF
- Label ON/OFF
- Dine-in print ON/OFF
- Label destinations（logical printers）

產品頁可以：
- 直接揀現有 logical printer
- 顯示目前 template / rule 摘要
- deep-link：**前往打印管理**

但產品頁唔管理：
- Printer IP
- USB
- physical device
- device driver
- global template registry
- global route rules

## 24.6 打印狀態／異常

入口：
**打印管理 → 打印狀態／異常**

第二步直接見 Print Job / Route exception workspace。

Filters：
- Current state
- Ticket type
- Logical printer
- Order / Display Number
- Time range

List：
- Order / Display Number
- Ticket type
- Logical destination
- Job / attempt summary
- Current state
- Certainty
- Last attempt
- Last readback
- View detail

State 必須分：
- PENDING
- PRINTED / CONFIRMED（只限有足夠 proof）
- UNKNOWN
- FAILED
- PARTIAL

Detail：
- Order / Display Number
- Ticket type
- logical route
- attempt timeline
- timing
- observed device
- ACK / readback
- error summary
- linked Audit / Diagnostics

正常管理 UI 唔顯 raw UUID / stack trace；
Engineering detail 只喺 Diagnostics / advanced detail。

R1 Admin 此頁預設係 read / diagnostics surface。
如果未有正式 Admin command contract：
- 唔顯「重印」／「重試」mutation button
- 只 deep-link 去已有正式操作 surface

若將來批准 Admin reprint：
必須建立新 PrintJob + reason + actor + readback；
禁止修改舊 PrintJob 成功歷史。

## 24.7 Human-first cross-domain rule

打印相關功能嘅 Primary Home：

- 「呢件產品要唔要印」→ 菜單管理 / 產品管理
- 「打印機叫咩、負責乜票」→ 打印管理 / 邏輯打印機
- 「張票長咩樣」→ 打印管理 / 打印模板
- 「邊種情況送去邊部 logical printer」→ 打印管理 / 打印規則
- 「點解今張單冇印到」→ 打印管理 / 打印狀態／異常
- 「實體 IP / USB 綁邊部機」→ SMT 現場
- 「部裝置而家健唔健康」→ 裝置管理 / 裝置狀態

任何一項如果要第三層 Menu 先搵到，視為 IA RED。

---

# 25. 人員與權限｜鎖定

人員與權限係獨立功能 domain。
使用者想知道「邊個員工、屬咩角色、有咩權限、可管理邊間店、邊個 session / trusted device 仲有效」時，第一時間就應該入 **人員與權限**。

Sidebar 細 Menu 直接顯示：
- 員工管理
- 角色管理
- 權限管理
- 登入／Session／Trusted Device

所有頁面符合：
**人員與權限 → 細 Menu → 已見到目標內容 → 撳 Staff / Role / Session 入 Detail / Edit**

禁止將：
員工 → 角色 → 權限 → Scope → Session
做成一層層 hidden menu。

Identity、Role、Permission、Scope、Session 係相關，但唔係同一樣嘢。

## 25.1 員工管理

入口：
**人員與權限 → 員工管理**

第二步完成後直接見 Staff List。

Header：
- Title：員工管理
- Primary CTA：新增員工

Search / Filter：
- Name / Staff ID
- Role
- Active
- Scope / Store
- Admin login enabled
- Attention only

List：
- Name
- Staff ID
- Role
- Scope
- Active
- Admin login
- Credential / access attention
- Last relevant access（如正式 read model 有）
- Row action

正常 UI 唔顯：
- PIN
- password
- token
- raw credential secret
- raw internal UUID 作主要 identity

## 25.2 新增／編輯員工

Create / Edit 直接使用一個清楚表單。

### 基本資料
- Name *
- Staff ID *
- Active *

### 角色
- Role *
- 顯示該 Role 嘅權限摘要

### Scope
- Store / Location scope
- 其他正式 scope dimension（如 contract 支援）

### 登入
- Frontline credential status
- Admin login enabled
- Admin Login ID（如正式 contract 支援）

Credential secret：
- 建立／重設流程只顯輸入欄
- 儲存後永遠唔再 reveal 原值
- PIN / password / token 永遠唔落 Audit

### 裝置／Session
Create/Edit 主表單只顯摘要：
- Active sessions count
- Trusted devices count

完整管理 deep-link：
**前往登入／Session／Trusted Device**

## 25.3 員工詳情

Header：
- Name
- Staff ID
- Active
- Role
- Scope
- Edit

內容分組：
- 基本資料
- 角色／權限摘要
- Scope
- Credential / Admin login
- Active sessions / trusted devices 摘要
- 最近敏感操作／Audit shortcut
- 最近 access state

Contextual shortcuts：
- 前往角色管理
- 前往權限管理
- 前往登入／Session／Trusted Device
- 前往操作記錄

## 25.4 角色管理

入口：
**人員與權限 → 角色管理**

第二步完成後直接見 Role List。

Header：
- Title：角色管理
- Primary CTA：新增角色

List：
- Role Name
- Staff Count
- Permission summary
- Scope policy summary
- Active
- Last modified
- Draft indicator
- Row action

Role Detail：
- Role name
- Description
- Assigned staff
- Permission summary
- Scope rules
- Inherited / override summary（如正式 contract 有）
- Edit
- Duplicate（如產品正式批准）

Create / Edit：
- Role name *
- Description
- Permission set
- Scope policy
- Active

Delete guard：
- Role 仍有 Staff reference 時不可直接 delete
- 顯示受影響 staff count
- 先 reassign staff 或停用 role

## 25.5 權限管理

入口：
**人員與權限 → 權限管理**

第二步完成後直接見 Capability / Permission Matrix。

Permission UI 以「人類工作」分組，唔按 API endpoint 分組。

建議 group：
- 訂單
- 售後／退款／取消
- 菜單
- 售罄／供應
- 平台／渠道
- 打印
- 裝置／OTA
- 營業日／現金
- 員工／權限
- 報表／匯出
- 發佈／版本
- 系統治理

每個 capability 顯示：
- Capability name
- View / Manage / Approve（只限正式 permission model 支援）
- Scope
- Inherited / direct override（如正式 contract 有）
- Risk / approval requirement（只在必要時）

操作：
- 選 Role
- 直接修改該 Role 權限
- Save Draft
- Publish / formalize 仍走正式 config workflow（如 permission config 屬 published Admin config）

硬規則：
- Actor 不可授予高過自己 authority 嘅 permission
- Frontend hide 唔係 security
- protected operation 必須 server-side authz
- Role permission change 要 Audit
- Revoke 後下一個 protected request fail-closed

正常 UI 唔展示：
- internal permission code
- route name
- API scope string
除非進 Advanced / Diagnostics。

## 25.6 Scope

Scope 唔另開第三層 Menu。
Scope 直接出現喺：
- Staff Detail / Edit
- Role Detail / Edit
- Permission Matrix context

UI 用人類可理解名稱：
- 全店
- 指定門店
- 指定工作範圍
- 其他正式 scope

禁止只顯 raw scope ID。

如果將來 multi-location：
「可以睇某店」
≠
「可以改某店所有設定」。

## 25.7 登入／Session／Trusted Device

入口：
**人員與權限 → 登入／Session／Trusted Device**

第二步完成後直接見 access workspace。

Top tabs / filters 可以係：
- Admin Accounts
- Active Sessions
- Trusted Devices

呢啲係同一細 Menu 入面嘅 workspace filter / view，
唔係第三層 Sidebar。

### Admin Accounts
List：
- Staff / Login ID
- Admin login enabled
- Credential status
- Active session count
- Trusted device count
- Last login
- Attention
- View

### Active Sessions
List：
- Staff
- Device
- Created
- Last activity
- Scope
- Current state
- Revoke

### Trusted Devices
List：
- Device display name
- Staff / account association
- Trust state
- Last seen
- Created / approved at
- Revoke / review

## 25.8 Session / Device revoke

高風險 revoke：
- 顯示 target
- 顯示影響
- Confirm
- Reason（如 policy 要求）
- Execute
- Authoritative readback
- Audit

Revoke 成功條件：
- server-side state readback confirmed
- 下一個 protected request fail-closed

唔可以：
- 只 frontend hide
- 只清 browser local state就叫 revoke 成功
- 顯示 credential secret

## 25.9 人類第一直覺歸類

- 「新增／停用員工」→ 人員與權限 / 員工管理
- 「呢個職位有咩權限」→ 人員與權限 / 角色管理
- 「退款權限邊個有」→ 人員與權限 / 權限管理
- 「邊個 Admin login 仲有效」→ 人員與權限 / 登入／Session／Trusted Device
- 「要踢走某部已信任裝置」→ 人員與權限 / 登入／Session／Trusted Device
- 「部 SMT 本身健唔健康」→ 裝置管理 / 裝置狀態
- 「邊個做過退款／改價」→ 系統管理 / 操作記錄

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

---

# 26. 報表｜鎖定

報表係獨立功能 domain。
使用者想睇「生意、產品、渠道、退款、營運表現」時，第一時間就應該入 **報表**。

Sidebar 細 Menu 直接顯示：
- 銷售
- 產品
- 渠道
- 退款
- 營運
- 匯出

所有頁面符合：
**報表 → 細 Menu → 已見到目標報表**

報表只讀。
任何需要操作嘅 object 只提供 contextual deep-link 去責任頁，
唔喺 Report 自己直接 mutation。

## 26.1 共用報表框架

所有 Report 共用同一結構：

### Header
- Report title
- Date / Business Day range
- Store / scope
- Freshness
- Completeness / partial state
- Export（有權限先顯示）

### 核心問題
每張報表第一屏只回答一個主要 business question。
禁止將 10–20 個同等大小 KPI card 堆成數字牆。

### Summary
只保留該報表最重要嘅 3–5 個 summary metric。

### Trend / Breakdown
按問題用最簡單視覺：
- 時間趨勢 → line
- 類別比較 → bar / table
- 精準查數 → table
- 佔比 → sorted bar / table；唔預設用 pie
- 細趨勢 → table 內 sparkline（如有需要）

### Drill-down
每個 breakdown 可以：
- filter
- sort
- drill into fixed detail
- deep-link 去責任 object

唔做 arbitrary dashboard builder。

## 26.2 報表可信度

每張 Report payload 至少有：
- metricVersion
- population / scope
- businessDayId / date range
- observedAt / generatedAt
- freshnessState
- completeness
- finality（如 relevant）
- formulaRef / semantic reference（internal contract）

正常 UI 唔需要顯示全部技術欄位，
但遇到 STALE / PARTIAL / UNAVAILABLE 必須清楚顯示。

禁止：
- error 顯 0
- stale 顯「即時」
- partial 當 complete
- platform channel data 冒充全店 truth
- payment collected 冒充 sales
- settlement amount 冒充 net sales

## 26.3 視覺原則

報表唔係裝飾 dashboard。

每個 chart 必須有清楚用途：
- 要比較乜
- 要搵乜變化
- 要睇邊個 category / time period
- 要做咩 decision

視覺排序：
1. 主要結論 / 核心數字
2. 最有用比較
3. 原因拆解
4. 明細表

Color 只做語義輔助。
重要數字、分類、狀態要有文字 label，
唔可以靠 legend / hover 先知道。

Mobile：
- 主視覺先出
- Filter 唔可以霸晒第一屏
- Table 轉 stacked rows / compact scroll container
- 重要數值唔靠 hover

## 26.4 固定 R1 報表

R1 固定可信 5 張：
1. Sales
2. Product
3. Channel
4. Refund
5. Operations

禁止：
- arbitrary metric builder
- free dashboard canvas
- formula editor
- SQL
- user-defined accounting formula

Reports 可以 deep-link：
- Orders
- Product
- Channel
- Action Queue
- Audit

但唔直接 mutation。

---

# 27. 銷售報表｜鎖定

入口：
**報表 → 銷售**

第二步完成後直接見 Sales Report。

## 27.1 第一屏

主要回答：
「呢段時間實際做咗幾多有效生意，同上一個合理基準比點？」

Summary：
- Effective Sales / 有效營業額
- Orders
- Average Order Value
- Adjustments / Refund

如果產品最後採用其他正式命名，
UI 必須跟 metric semantic，而唔係沿用市場容易誤解嘅 Gross / Net 字眼。

## 27.2 趨勢

主視覺：
- Effective Sales over time
- Orders over time

可切：
- hour
- business day
- selected range

Comparison：
預設只顯一個有意義基準，例如：
- 上週同日同期
- prior period
- approved weekday baseline

避免同時塞 3–4 個 comparison 令畫面失焦。

## 27.3 Breakdown

固定 breakdown：
- Original / Gross-like committed value
- Adjustments
- Effective / Net result
- Orders
- AOV
- Cash Sales
- Refund
- Cash Refund
- Business Day
- Opening / close readback where formally available

### Adjustment
必須分開：
- Cancellation
- Refund
- Amount Correction
- Discount（若 metric semantics 需要）

禁止只顯一個含糊 adjustment total 而無法 drill down。

## 27.4 Drill-down

可以由：
- 某 Business Day
- 某時間區間
- 某 adjustment

deep-link 去 filtered 訂單歷史／售後紀錄。

Report 自己唔做 Refund / Cancel。

## 27.5 Error / freshness

Query error：
- 唔顯 $0
- 唔顯 0 Orders

應顯：
- 暫時無法取得
- 上次成功資料（如有）
- last updated
- stale / partial

---

# 28. 產品報表｜鎖定

入口：
**報表 → 產品**

第二步完成後直接見 Product Report。

主要回答：
「邊啲產品真正賣得多、貢獻幾多，同套餐／選項有咩關係？」

## 28.1 Summary

第一屏只保留：
- Total product quantity
- Effective product revenue
- Top product
- Category contribution

## 28.2 Product performance table

主表：
- Product
- Category
- Overall Qty
- Standalone Qty
- Combo Child Qty
- Effective Product Revenue
- Contribution %
- Channel split summary
- Trend / comparison（如有）

Table 預設按最有用 metric 排序，例如 Effective Revenue / Qty。

Product row 可以 deep-link：
**菜單管理 → 產品 Detail**

## 28.3 Category performance

用 sorted bar / table：
- Category
- Qty
- Effective revenue
- Contribution
- Product count

唔需要額外 pie chart。

## 28.4 Combo / Option

固定分析：
- Combo parent sales
- Child mix
- Modifier / Option selection count
- Attach rate
- Option revenue effect（只限正式 read model 可證實）

避免將 Combo child 數量同 standalone sales 混埋。

## 28.5 時段 / 渠道

可切：
- time-of-day
- channel split

但一個畫面只突出一個 comparison，
唔同維度用 tabs / controlled view 切換，
唔係全部 chart 同時平鋪。

## 28.6 Cost / Margin hard rule

未有 verified Cost Authority 前：
禁止顯示：
- 假 Gross Profit
- 假 Margin
- 推算成本當正式成本

如果 cost evidence 不完整：
直接唔顯，
唔用 estimate 冒充正式報表。

---

# 29. 渠道 / 退款 / 營運報表｜鎖定

## 29.1 渠道報表

入口：
**報表 → 渠道**

主要回答：
「每條渠道帶嚟幾多單／營業額，邊條渠道有營運問題？」

Summary：
- Total channel orders
- Effective sales
- Channel mix
- Channels requiring attention

Breakdown table：
- Channel
- Order count
- Effective sales
- AOV（只按正式 metric）
- Mix %
- Availability / read freshness
- Exception count

Channel health 唔直接混入 sales score。
Health 只作 context。

可 deep-link：
- 平台／渠道管理
- filtered orders
- channel exceptions

## 29.2 退款報表

入口：
**報表 → 退款**

主要回答：
「退款發生幾多、涉及幾多錢、邊類原因最多？」

Summary：
- Refund count
- Refund amount
- Refund rate（只限 denominator semantic 已鎖）
- unresolved / unknown count

Breakdown：
- Method
- Reason
- Original Business Day
- Execution Day
- Staff / actor（按 permission）
- Channel
- Addendum / linked reference

Original day 同 execution day 分開，
避免跨日退款造成報表誤解。

可 deep-link：
**訂單管理 → 售後／退款／取消／修正**

## 29.3 營運報表

入口：
**報表 → 營運**

主要回答：
「營運邊度慢、邊度出錯、邊啲問題重複發生？」

固定內容：
- Fulfillment / prep timing（只限正式 available data）
- Delayed orders
- Print exceptions
- Channel exceptions
- Unresolved actions
- Device / config attention（只限正式 read model）

重點以 table / trend 為主，
唔整一堆 equal-weight health cards。

可以 deep-link：
- 訂單異常
- 打印狀態／異常
- 平台／渠道管理
- 裝置狀態
- 待處理事項
- 系統診斷

## 29.4 匯出

入口：
**報表 → 匯出**

第二步完成後直接見 Export Workspace。

可揀：
- Report type
- Date / Business Day range
- Store / scope
- File format（只限正式支援）
- Included fields（只限固定 approved set）

Export before execute：
- permission check
- scope check
- PII / sensitive field guard
- large export guard（如 policy 有）

完成後：
- export status
- generated time
- file identity / hash（如 contract 支援）
- audit reference

禁止：
- 由 Export 頁改 transaction truth
- 任意 SQL
- 任意欄位 expression / formula

## 29.5 人類第一直覺歸類

- 「今日做咗幾多生意？」→ 報表 / 銷售
- 「邊樣產品賣得最好？」→ 報表 / 產品
- 「Keeta 佔幾多單？」→ 報表 / 渠道
- 「退款幾多？」→ 報表 / 退款
- 「邊度經常延誤／打印出錯？」→ 報表 / 營運
- 「我要下載正式資料」→ 報表 / 匯出

任何以上問題如果要第三層 Sidebar 先搵到，視為 IA RED。

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

全產品採成熟後台模式：

**List → Detail → Create / Edit**

唔再強制使用：
**Summary → Task Picker → Focused Editor → Back to Summary**

原因：
- 普通使用者應該直接睇到物件同設定；
- 唔應該為咗「簡化畫面」而將欄位收埋成另一層迷宮；
- 真正長／高風險 workflow 先使用 step-based UI。

## List Page
固定結構：
- PageHeader
- Primary Create CTA
- Search
- Filter
- DataTable / ResponsiveRecordList
- Row actions

## Detail Page
固定結構：
- Object header
- Core summary
- Grouped sections
- Edit action
- Contextual deep-links
- Timeline / Audit link where relevant

## Create / Edit Page
固定結構：
- 清楚單一表單
- Required fields 優先
- Related fields 按 section 分組
- Save Draft / Cancel
- 必要時右側可以有 Overview / Preview
- 唔可以右側再變第二套 navigation

## Workflow Page
只限真正多 gate 操作，例如：
- Publish
- Refund / Correction
- Close Day
- Rollback

先使用：
- Step state
- Validation
- Impact / Preview
- Confirmation
- Readback

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
- ValidationPanel
- ImpactPanel
- ReadbackPanel
- Timeline
- AuditDetailDrawer
- ConfirmDialog

禁止：
- 為咗減少頁面資訊而增加 hidden navigation depth
- 每個 domain invent 第二套基本 List / Detail / Edit pattern
- 用大量教學文案取代清楚 layout

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
- product detail 直接、分組、可編輯；唔靠 hidden task picker 收埋正式設定
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
- 正常功能需要第三層隱藏 Menu／nested accordion 先搵到
- 正式功能被收埋入「更多」或其他 catch-all bucket
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
