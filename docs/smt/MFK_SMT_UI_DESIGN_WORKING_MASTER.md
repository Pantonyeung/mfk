# MFK SMT UI Design Working Master

Date: 2026-09-27
Status: WORKING
Purpose: Running handoff for SMT UI redesign. Each subsequent functional/UI design conversation appends a dated record. Current implementation is preserved; Owner requirements are used to identify gaps. Final deliverable will be exported as one FINAL TXT when the UI design cycle is complete.

## Locked recording rules
- Preserve current implementation and accepted runtime semantics.
- Owner requirements identify gaps; they do not automatically override implemented behavior.
- Superseded UI decisions remain in history and are marked SUPERSEDED.
- Use status tags: LIVE, LIVE_SUPERSET, UI_REWORK, FUTURE_WIRING, PHYSICAL_PENDING.
- Final TXT will consolidate the final product visual system, all stages/pages/scenarios/states, wiring status, superseded decisions, and acceptance rules.

## Record 001 — Product Visual System
Established the SMT visual system: 1920×1080 primary target; Japanese minimal / professional restaurant POS / operational soft glass; Primary Blue #1F5FBF; evidence-based status; UNKNOWN distinct from FAILED; 48px minimum touch targets; major operational modals ~75%; fixed muscle-memory layout; no raw UUID; no fake health badge; no visual change may alter transaction authority.

## Record 002 — Functional UI Stage Architecture
Stage 0: SMT Shell + Global System Layer
Stage 1: Ordering Main
Stage 2: Product Configuration + Fast Lane
Stage 3: Cart Workflow + Hold/Dining Entry
Stage 4: Customer / Keeta Pending
Stage 5: Checkout + Payment
Stage 6: Orders + After-sales
Stage 7: Dining
Stage 8: Sold-out / Capacity
Stage 9: More / Tools
Stage 10: Printing / Device / Diagnostics
Stage 11: Backup / Sync / Recovery
Stage 12: System States / Acceptance Screens

Execution order:
Batch 1: Stage 0 → 1 → 2 → 3
Batch 2: Stage 4 → 5 → 6
Batch 3: Stage 7
Batch 4: Stage 8 → 9 → 10 → 11
Final: Stage 12

## Current next step
Stage 0 — SMT Shell / Navigation / Global Alert
Text wireframe only first. No final mockup yet.

MILESTONE:
MFK_SMT_UI_DESIGN_WORKING_MASTER_STARTED
FINAL_TXT_PENDING


==================================================
RECORD 003｜Stage 0–12 詳細功能 UI 定義
日期：2026-09-27
用途：作為後續逐 Stage 文字 Wireframe、UI Mockup、Figma Component、工程接線與驗收的正式頁面清單。
==================================================

總規則：
- 每個 Stage 先定義「目的 → 頁面 → 使用場景 → 主要資訊 → 主要操作 → 狀態 → 不可破壞規則」。
- 未進入該 Stage 正式設計前，不提前製作高保真畫面。
- LIVE / LIVE_SUPERSET：現有實作必須保留。
- UI_REWORK：只改資訊架構／視覺／操作位置，不改 runtime semantics。
- FUTURE_WIRING：可以設計完整 UI，但必須標示尚未接線。
- PHYSICAL_PENDING：software seam 已有，但真機／打印／電源循環仍需實證。

--------------------------------------------------
STAGE 0｜SMT SHELL＋GLOBAL SYSTEM LAYER
--------------------------------------------------

目的：
建立所有 SMT 頁面共用的固定操作骨架。Stage 0 決定員工每日最常見的導航位置、全局新單提示、系統異常、Staff 身份與低頻工具入口。之後所有 Stage 都必須放入同一個 Shell，不可各自重新發明 Header／Navigation。

頁面 0.1｜SMT Main Shell
主要區域：
- 左側高頻導航：點單／訂單／堂食／售罄／產能
- 頂部 Utility Bar
- 當前 Staff
- Local / Network 狀態
- Printer Attention
- Admin Sync 狀態
- Hamburger「更多」
- 中央 Route Stage

使用場景：
- 正常營業
- Local 正常但 Cloud 斷線
- Admin Config 暫時不可達
- Printer 有一條 Route 異常
- Customer / Keeta 新單到達
- 多項 Attention 同時存在
- Staff Session 過期／失效
- 由任何頁面返回主工作區

主要操作：
- 切換高頻主頁
- 打開 More / Tools
- 查看全局 Attention
- 查看 Staff
- 快速跳去待處理新單

不可破壞：
- 主導航位置固定
- 高頻頁唔因不同功能而搬位
- Offline 唔等於 SMT 不可交易
- 不顯 raw UUID
- 健康狀態必須有真 evidence，不做裝飾綠燈

狀態：
UI_REWORK

頁面 0.2｜Global New Order Alert
來源：
- Customer
- Keeta

內容：
- Source
- Display / Pickup identity
- 到達時間
- 立即處理
- 30 秒後
- 1 分鐘後

使用場景：
- 第一張新單
- 連續多張新單
- 正在 Checkout 時收到新單
- 正在 Dining 時收到新單
- 新單已被另一流程處理
- Snooze 後重新提示

不可破壞：
- Alert 不自動 Accept
- Snooze 不等於 Reject
- 聲音只係 attention，不代表交易狀態

狀態：
LIVE + UI_REWORK

頁面 0.3｜Global Exception / Attention Center
內容：
- Payment Evidence Pending
- Print FAILED
- Print UNKNOWN
- Printer Offline / Unreachable
- Keeta Attention
- Customer intake error
- Admin Sync stale / pending
- Recovery required

分級：
- Critical
- Action Required
- Information

使用場景：
- 單一異常
- 多個同時
- 已處理但等待 readback
- UNKNOWN
- Failed
- Recovered

主要操作：
- 查看詳情
- 跳去來源頁
- 人工確認／處理
- Readback / Reconcile（如已存在）
- 關閉已解決 attention

狀態：
PARTIAL_UI

Stage 0 完成條件：
- 所有 Stage 都可掛入同一 Shell
- 高頻導航固定
- Alert / Attention pattern 統一
- More 入口位置鎖定
- Offline / Unknown / Failed 有不同視覺語義

--------------------------------------------------
STAGE 1｜ORDERING MAIN
--------------------------------------------------

目的：
建立最快速的前線點餐主工作台。員工應該在最少頁面切換下完成選商品、看待處理單、看 Keeta、查看 Cart、切堂／外、進快捷工作區與結帳。

頁面 1.1｜Ordering Main — Empty Cart
主要區域：
- Pending Customer strip
- Keeta strip
- Quick / Normal
- Category
- Product Grid
- Fast Lane
- Empty Cart
- 取回訂單

使用場景：
- 開機第一單
- 無 Pending
- Customer 有 Pending
- Keeta 有 Pending
- Product 有圖／無圖
- 部分 Sold-out
- 全部可售
- Admin menu 正在用 LKG

主要操作：
- 揀 Category
- Quick Add
- 打開 Product Config
- 開 Required / Riceball / Combo
- 打開 Pending Order
- 取回 Hold

狀態：
LIVE + UI_REWORK

頁面 1.2｜Ordering Main — Active Cart
Cart Header：
- Display Preview
- 原單／整理
- Combine
- 堂食／外賣

Cart Body：
- 序號
- 堂／外
- Product Name
- Config
- Qty
- Line Total

Cart Footer：
- Subtotal
- Packaging
- Discount
- Total
- 暫存／堂食
- Trash
- Checkout

使用場景：
- 一件
- 多件
- 同商品不同配置
- 混合堂食／外賣
- Required 未完成
- Combo 已建立
- 飯團 Pairing 已建立
- Combine ON / OFF

不可破壞：
- line identity
- SAME line edit
- Required Gate
- Display Preview 非正式號碼

狀態：
LIVE + UI_REWORK

頁面 1.3｜Ordering Main — Menu / Availability Change
使用場景：
- Product Sold-out
- Product Pause
- Admin revision changed
- Cart 中 product unavailable
- Option stale
- Combo stale
- Price material change

UI 必須：
- 只標受影響 line
- 清楚指出需要重新確認／編輯
- 不清空全 Cart
- 不靜默接受重要價錢／配置變化

狀態：
LIVE / UI_REWORK

Stage 1 完成條件：
- 1920×1080 一頁完成主要點餐
- Cart 永遠清楚可見
- Pending / Keeta 唔遮主交易
- Product Grid、Category、Cart 形成固定肌肉記憶

--------------------------------------------------
STAGE 2｜PRODUCT CONFIGURATION＋FAST LANE
--------------------------------------------------

目的：
處理所有「商品配置」及「高頻加速」行為，避免每種商品有不同 UI 邏輯。

頁面 2.1｜Product Detail — Add
內容：
- Product Image / Name
- Base Price
- Variation
- Required
- Optional
- Modifier
- Combo-related selection（如適用）
- Free Note
- Qty
- Current Total
- 加入購物車

使用場景：
- 無 Option
- 一個 Required
- 多 Required
- Optional
- Multi-select
- 價差
- Note
- Sold-out option
- stale option

狀態：
LIVE + UI_REWORK

頁面 2.2｜Product Detail — Edit Existing Line
內容同 2.1，但：
- 載入原 line config
- CTA = 完成修改
- 保持 SAME lineId

不可破壞：
- Edit ≠ Add
- 不建立 duplicate line

狀態：
LIVE + UI_REWORK

頁面 2.3｜Required Fast Lane
目的：
集中處理 Quick Mode 先入 Cart 的未完成 Required。

使用場景：
- 1 件未完成
- 多件未完成
- 不同 Required group
- 完成一半
- 全部完成
- 返回 Cart

狀態：
LIVE + UI_REWORK

頁面 2.4｜Quick Drink / Drink Supplement
內容：
- Target line
- 飲品 choices
- 價差
- Qty
- Configure / Add

使用場景：
- 一件主餐加飲品
- 多個 target
- 飲品有 option
- skip drink
- unavailable drink

狀態：
LIVE + UI_REWORK

頁面 2.5｜Riceball Pairing
核心：
- A/B/C/D… positional slot
- 飯團／主餐
- 小食
- Default pairing
- Swap
- Unpaired leftovers
- 拆回單點
- Drink supplement

使用場景：
- 1+1
- 2+2
- 3+2
- 多主餐少小食
- 已配後 Swap
- 不兼容 item
- 已配 Pairing restore
- Combo price adjustment

不可破壞：
- 不做推薦引擎
- 不靠 product name 猜 Combo
- 剩餘 item 保持單點

狀態：
LIVE + UI_REWORK

頁面 2.6｜Canonical Combo
內容：
- Combo tier
- Main Pool
- Add-on Pool
- Required Group
- Optional
- Drink
- Price adjustment
- Summary
- Total

使用場景：
- 不同套餐級別
- Required 未完成
- Optional skip
- add-on surcharge
- Admin 無可用 Combo

不可破壞：
- 全部由 Admin canonical Combo/Pool 讀取
- UI 不硬寫第二套餐規則

狀態：
LIVE + UI_REWORK

Stage 2 完成條件：
- Product / Required / Drink / Pairing / Combo 使用同一視覺系統
- Modal geometry、Footer CTA、Dirty Close pattern 統一
- 所有配置都可回到 SAME Cart truth

--------------------------------------------------
STAGE 3｜CART WORKFLOW＋HOLD / DINING ENTRY
--------------------------------------------------

目的：
完成 Cart 的整理、暫存、取回與堂食入口，令員工唔需要離開 Ordering 主流程就可決定下一步。

頁面 3.1｜Original Cart
用途：
按原輸入次序顯示。

狀態：
LIVE

頁面 3.2｜Organized Cart
Owner 目標：
按 Admin Product Category 排序。

Current：
目前 Organized / Organize Workspace semantics 未完全等同純 Category sort。

使用場景：
- 多 category
- Combo
- Drink
- Required
- Pairing

狀態：
PARTIAL_LOGIC / FUTURE_WIRING

頁面 3.3｜Combine
目的：
將完全一致配置作視覺合併。

必須考慮：
- Product
- Service Mode
- Unit Price
- Option
- Modifier
- Note
- Pairing
- Combo identity

Current：
equality guard 未完整涵蓋全部 structured identity。

狀態：
PARTIAL_LOGIC

頁面 3.4｜Hold / Dining Entry
同一入口內兩個 concept：
- 暫存
- 堂食

預設：
- All Takeaway → 暫存
- Any Dine-in → 堂食

使用者可 Override。

狀態：
LIVE + UI_REWORK

頁面 3.5｜Hold
內容：
- Party / Note（如適用）
- Cart Summary
- 暫存確認
- Hold List
- 取回
- 刪除

狀態：
LIVE

頁面 3.6｜Dining Placement
內容：
- Waiting
- Table selection
- Party size
- Note
- Dynamic Table Registry

使用場景：
- 直接掛枱
- 加 Waiting
- 無可用枱
- Admin table changed

狀態：
LIVE + UI_REWORK

Stage 3 完成條件：
- 暫存／堂食入口單一且直覺
- Empty Cart 可取單
- current hold/dining semantics 不被 UI 拆碎

--------------------------------------------------
STAGE 4｜CUSTOMER / KEETA PENDING
--------------------------------------------------

目的：
統一處理所有「外部／自家平台 Intent 尚未正式接受」的前線 review。

頁面 4.1｜Customer Pending Review
內容：
- Customer Name
- Phone
- Pickup info
- Items
- Amount
- Payment Type
- Evidence state
- Accept
- Modify
- Cancel / Reject

使用場景：
- 到店付款
- 電子付款
- Screenshot pending
- Evidence rejected
- Menu stale
- Capacity rejected

狀態：
LIVE + UI_REWORK

頁面 4.2｜Payment Evidence Review
內容：
- Screenshot
- Tender
- Amount
- Evidence time
- PENDING / VERIFIED / REJECTED
- 確認付款
- 不接受付款

原則：
Screenshot ≠ Payment Truth。

狀態：
LIVE + UI_REWORK

頁面 4.3｜WhatsApp Follow-up
內容：
- Customer phone
- QR
- 預填訊息
- 重傳付款圖要求

使用場景：
- 圖片模糊
- 金額不符
- 日期時間不合理
- 無電話 → 不可生成 QR

狀態：
LIVE + UI_REWORK

頁面 4.4｜Keeta Pending
內容：
- Provider ref
- Items
- Total
- Accept
- Later
- defer 1/2
- defer 2/2
- Attention

使用場景：
- Auto Accept
- Manual
- 第一次 defer
- 第二次 defer
- 第三次 blocked
- Provider confirm attention

狀態：
LIVE + UI_REWORK

Stage 4 完成條件：
- Customer / Keeta clearly distinct
- Evidence 未確認不得誤寫 paid
- defer / reject / cancel 視覺語義分開

--------------------------------------------------
STAGE 5｜CHECKOUT＋PAYMENT
--------------------------------------------------

目的：
建立高峰期都不會按錯的固定付款工作台，並守住 Formal Commit 邊界。

頁面 5.1｜Checkout Main
固定區域：
- Order Summary
- Source
- Tender
- Settlement
- Keypad
- Notes
- Confirm

使用場景：
- Walk-in
- Phone / WhatsApp
- Own App
- Foodpanda
- Keeta

狀態：
LIVE + UI_REWORK

頁面 5.2｜Cash
內容：
- Due
- Received
- Change
- Exact
- $20
- $50
- $100
- $200
- $500

Current：
缺 $20。

狀態：
PARTIAL_UI

頁面 5.3｜Split Tender
內容：
- CASH
- FPS
- PayMe
- Alipay
- WeChat
- Amount per tender
- Match validation

使用場景：
- 2 tenders
- 3+ tenders
- 未 match
- exact match

狀態：
LIVE + UI_REWORK

頁面 5.4｜Student Discount
內容：
- Student Count
- Eligible Drinks
- Manual selection
- Auto selection
- Most expensive first
- Discount Summary

狀態：
FUTURE_WIRING

頁面 5.5｜Final Payment Review
內容：
- Source
- Tender
- Amount
- Cash received/change
- Pickup code / external ref
- 返回修改
- 確認付款

目的：
最後一次明確人手確認，確認後先正式 commit。

狀態：
FUTURE_WIRING / UI GAP

頁面 5.6｜Payment Processing
狀態：
- Processing
- Success
- Failure
- Unknown
- Duplicate tap/retry guard

狀態：
LIVE + UI_REWORK

頁面 5.7｜Completion Review
內容：
- Display Number
- Tender
- Total
- Print State
- 完成

規則：
Done 只離開，不再 commit。

狀態：
LIVE + UI_REWORK

Stage 5 完成條件：
- Keypad 固定
- Payment Confirm boundary 清楚
- UNKNOWN 與 FAILED 分開
- Success 之後不再產生第二 transaction

--------------------------------------------------
STAGE 6｜ORDERS＋AFTER-SALES
--------------------------------------------------

目的：
將已成立 Order 的履約、修改、退款、付款修正、取消、重印與 Provider after-sale 集中在同一工作台。

頁面 6.1｜Orders Main
三 Source Lane：
- 現場
- 自家平台
- 第三方

Filter：
- Active
- History
- Tender / Source（視 UI 最終收斂）

狀態：
LIVE + UI_REWORK

頁面 6.2｜Order Detail
內容：
- Display
- Source
- Time
- Items
- Config
- Amount
- Current Tender
- Fulfillment
- Customer / Pickup
- Payment Evidence
- Audit
- Print exception

狀態：
LIVE + UI_REWORK

頁面 6.3｜Fulfillment
目標：
- 進行中 → 可取餐
- 可取餐 → 未完成
- 可取餐 → 已取餐

Current：
- mark ready 已做
- revert 未做
- pickup complete UI 未完整

狀態：
PARTIAL_LOGIC

頁面 6.4｜Modify Order
內容：
- Qty
- Remove item
- revised amount
- same Order

Current：
本地 edit 已做；Customer confirm handshake 未完整。

狀態：
PARTIAL

頁面 6.5｜Payment Correction
內容：
- Original Tender
- New Tender
- SAME Order
- Audit
- Actor

狀態：
LIVE + UI_REWORK

頁面 6.6｜Refund
內容：
- Item
- Qty
- Amount
- Actual Refund Method
- Note
- Full / Partial
- Same-day boundary
- Admin required for closed day

狀態：
LIVE + UI_REWORK

頁面 6.7｜Cancel
內容：
- Reason
- Cancel confirmation
- Refund separation
- Cancellation Notice state

使用場景：
- 未出 production
- 已出 production
- Notice DONE
- FAILED
- UNKNOWN

狀態：
LIVE + UI_REWORK

頁面 6.8｜Reprint
內容：
- Receipt
- Production
- Packing
- Labels
- All / Partial
- Reason
- Selected jobs

規則：
Reprint ≠ Recommit
Reprint 不開 drawer。

狀態：
LIVE + UI_REWORK

Stage 6 完成條件：
- Cancel / Refund / Correction 清楚分開
- Money history 可追溯
- Provider after-sale 不被本地退款偽造

--------------------------------------------------
STAGE 7｜DINING
--------------------------------------------------

目的：
完成堂食從 Waiting、入座、Formal Order、加單、修改、打印、分項付款到結清的完整前線工作台。

頁面 7.1｜Dining Floor
三區：
- Waiting
- Dynamic Table Board
- Selected Table Detail

使用場景：
- Empty
- Available
- Occupied
- Settled
- Overdue
- Table registry dynamic changes

狀態：
LIVE + UI_REWORK

頁面 7.2｜Waiting
內容：
- Party Size
- Note
- Created Time
- Formal order state
- Assign Table

使用場景：
- 新增
- 更新人數
- remove empty waiting
- 有 Order
- 無 Order

狀態：
LIVE

頁面 7.3｜Table Detail
內容：
- Table
- Party
- SeatedAt
- Elapsed
- Items
- Paid / Unpaid
- Total
- Outstanding
- Payment history

狀態：
LIVE

頁面 7.4｜Table Operations
操作：
- Transfer
- Join
- Unjoin
- Add Order
- Cancel
- Clear after fully settled

狀態：
LIVE_SUPERSET

頁面 7.5｜Dining Add Order
內容：
- SAME Formal Order
- New items
- Addition print state

狀態：
LIVE + PHYSICAL_PENDING

頁面 7.6｜Dining Line Correction
使用場景：
- Pre-production
- Post-production
- Correction Notice
- UNKNOWN

Current：
Post-production correction notice 已實作。

狀態：
LIVE_SUPERSET

頁面 7.7｜Dining Price Override
內容：
- Current Price
- New Effective Price
- Reason
- Permission
- Audit

狀態：
LIVE_SUPERSET

頁面 7.8｜Dining Split Settlement
內容：
- line selection
- qty selection
- paid / unpaid
- amount
- tender

狀態：
LIVE

頁面 7.9｜Dining Combo Tender
內容：
- multiple tender breakdown
- exact total match

狀態：
LIVE

頁面 7.10｜Dining Payment Receipt
狀態：
- DONE
- FAILED
- UNKNOWN

Cash：
drawer only initial payment action.

狀態：
LIVE + PHYSICAL_PENDING

頁面 7.11｜Dining Reprint
內容：
- selectable jobs
- selected tickets
- reason
- drawer suppressed

狀態：
LIVE + PHYSICAL_PENDING

Stage 7 完成條件：
- Dynamic Table Registry，不硬寫死 9 枱
- SAME Order
- seatedAt 真實
- partial payment 可恢復
- UNKNOWN 不 blind retry
- Paid history protected

--------------------------------------------------
STAGE 8｜SOLD-OUT / CAPACITY
--------------------------------------------------

目的：
讓前線快速控制商品 Availability 與查看 Capacity，但不把 Inventory 統計誤變交易 Authority。

頁面 8.1｜Availability Main
內容：
- Search
- Product
- Current Status
- Sold-out
- Pause
- Restore

狀態：
LIVE + UI_REWORK

頁面 8.2｜Category / Status Filters
內容：
- Category
- All
- Sold-out
- Paused

Current：
filter controls未完整。

狀態：
FUTURE_WIRING / UI GAP

頁面 8.3｜Bulk Actions
內容：
- Multi-select
- Bulk Sold-out
- Bulk Pause
- Bulk Restore

狀態：
FUTURE_WIRING

頁面 8.4｜Purple Rice Quick Action
內容：
- 紫米售罄
- 紫米恢復
- affected product count

狀態：
FUTURE_WIRING

頁面 8.5｜Capacity Pool
內容：
- Pool Name
- Initial
- Remaining
- Bound Products
- First-party threshold
- Third-party threshold
- channel accepting state

狀態：
LIVE + UI_REWORK

頁面 8.6｜Manual Capacity Adjustment
內容：
- Current
- New Qty
- Note
- Actor
- Business Day

狀態：
LIVE

頁面 8.7｜Bounded Override
內容：
- Extra Qty
- Scope
- Channel
- Expiry / one-use rule
- Actor
- Audit

Current：
獨立 override model 未完成。

狀態：
FUTURE_WIRING

Stage 8 完成條件：
- Availability / Capacity / Inventory / Visibility 視覺概念分開
- Manual Correction ≠ Override
- Existing Orders 不因後來停售被改寫

--------------------------------------------------
STAGE 9｜MORE / TOOLS / DAY CLOSE / REPORTS
--------------------------------------------------

目的：
集中所有低頻營運工具，不阻塞點單主流程。

頁面 9.1｜Tools Home
Cards：
- Day Close
- Reports
- Printing
- Diagnostics
- Backup / Restore
- Admin Sync
- Cash Movement（future）

狀態：
LIVE + UI_REWORK

頁面 9.2｜Day Close
內容：
- Opening Cash
- Cash Sales
- Cash Refund
- Expected
- Counted
- Variance
- Withdrawal
- Retained
- Denomination / Direct Total
- Confirm
- Print

使用場景：
- 未開始
- counting
- difference
- completed
- reprint

狀態：
LIVE + UI_REWORK

頁面 9.3｜Cash In / Cash Out
內容：
- Type
- Amount
- Reason
- Actor
- Time
- Note
- History

狀態：
FUTURE_WIRING

頁面 9.4｜Reports Main
Current metrics：
- Gross / Effective Sales
- Refund
- Net
- Cash
- Average Order
- Item Units
- Product Ranking
- Refund rows
- CSV

狀態：
PARTIAL + UI_REWORK

頁面 9.5｜Channel Report
目標：
- Order Count
- Amount
- Walk-in / Phone / WhatsApp / Own / Foodpanda / Keeta

狀態：
FUTURE_WIRING

頁面 9.6｜Tender Report
目標：
- Cash
- Alipay
- WeChat
- FPS
- PayMe
- Electronic Unclassified
- Other

狀態：
PARTIAL / FUTURE_WIRING

頁面 9.7｜Low / Zero Seller
目標：
- Top
- Low
- Zero

狀態：
FUTURE_WIRING

頁面 9.8｜Daily Report History / Adjustment
目標：
- sealed daily snapshot
- history
- linked later adjustment
- cross-day correction reference

狀態：
PARTIAL / FUTURE_WIRING

Stage 9 完成條件：
- More 全部低頻
- Day Close 不同於 ordinary Report
- Reports 只投影交易 truth，不成第二 ledger
- Future metrics 不用 fake data

--------------------------------------------------
STAGE 10｜PRINTING / DEVICE / DIAGNOSTICS
--------------------------------------------------

目的：
提供前線可理解的實體設備治理，同時保留工程級 trace，但兩層不能混在同一層 UI。

頁面 10.1｜Printer List
內容：
- Logical Role
- Physical Device
- IP
- Port
- Last Result
- Route Status

狀態：
LIVE + UI_REWORK

頁面 10.2｜Printer Binding
內容：
- Logical Destination
- Physical Printer
- IP
- Port
- Model / Capability
- Connect Test
- Test Print
- Save Binding

狀態：
LIVE

頁面 10.3｜Print Trace
內容：
- Order / Display
- Job
- Route
- Printer
- Started
- Elapsed
- Result
- Code

狀態：
LIVE + UI_REWORK

頁面 10.4｜Printer Attention
狀態：
- Offline
- Failed
- Unknown
- Partial
- Human Check Required

Current：
global persistent attention 未完全收口。

狀態：
PARTIAL_UI

頁面 10.5｜Diagnostics
Level 1：
人類可理解摘要。

Level 2：
- Step
- Timing
- Code
- Endpoint
- Revision
- Technical detail

狀態：
LIVE + UI_REWORK

Stage 10 完成條件：
- 前線第一眼知道「邊部機／邊張票／要做乜」
- 工程 detail 唔搶前線 hierarchy
- UNKNOWN 不提供 blind retry

--------------------------------------------------
STAGE 11｜BACKUP / SYNC / OFFLINE / RECOVERY
--------------------------------------------------

目的：
處理低頻但高風險的資料持續性與復原，並確保任何 Cloud 問題都不阻本地正式交易。

頁面 11.1｜Backup
內容：
- Last Backup
- Create Backup
- Size / checksum summary
- local data scope

狀態：
LIVE

頁面 11.2｜Restore
內容：
- Select Backup
- Validate
- Impact warning
- Restore
- Result

狀態：
LIVE

頁面 11.3｜Admin Sync
內容：
- Current Revision
- LKG
- Last Sync
- Pending
- Failure
- Readback

狀態：
LIVE + UI_REWORK

頁面 11.4｜Offline Mode
使用場景：
- Cloud offline
- Admin unreachable
- Customer unavailable
- Keeta unavailable
- Owner unavailable
- Local POS / payment record / print continues

狀態：
LIVE

頁面 11.5｜Recovery
內容：
- App restart
- unfinished action
- Readback
- Reconcile
- Unknown
- Resolved

狀態：
LIVE / PHYSICAL_PENDING

Stage 11 完成條件：
- Recovery action 不造成 duplicate
- Offline status 不阻正常 local transaction
- Reconnect 先 reconcile，再顯健康

--------------------------------------------------
STAGE 12｜SYSTEM STATES / ACCEPTANCE STATES
--------------------------------------------------

目的：
將所有 Stage 共用的非正常／過渡／空白情況收斂成統一 pattern，避免每個頁面自己設計一套錯誤提示。

State 12.1｜Loading
要求：
- 清楚講目前讀緊乜
- 超過 2 秒顯示 step / reason

State 12.2｜Empty
例：
- 無待處理單
- 無輪候
- 無售罄
- 無 report

State 12.3｜Error
結構：
- 發生咩事
- 影響
- 下一步

State 12.4｜Unknown
要求：
- 黃色 Attention
- 不等於 failed
- 顯示 readback / human check next step

State 12.5｜Offline
要求：
- 明確指出邊個 domain offline
- Local transaction 是否仍可用

State 12.6｜Permission Denied
要求：
- 說明操作不可用
- 不暴露 security primitive

State 12.7｜Stale Revision
要求：
- 顯示內容已更新
- 要求 refresh / reselect
- 不靜默覆寫

State 12.8｜Print Partial Failure
要求：
- 成功 route
- failed route
- unknown route
- 不全單盲重印

State 12.9｜Payment Conflict
要求：
- SAME transaction identity
- 明確阻止第二 payment
- 提供 readback / recovery

State 12.10｜Admin Config Missing
要求：
- LKG 是否可用
- 如果無 LKG，明確 fail closed 的範圍

State 12.11｜Physical Device Missing
要求：
- Device / printer
- 影響 route
- human action

State 12.12｜Recovery / Reconcile
要求：
- original identity
- current state
- readback result
- safe next action

Stage 12 完成條件：
- 所有全系統狀態使用同一語言／色彩／按鈕層級
- UNKNOWN / FAILED / OFFLINE / PERMISSION / STALE 完全分開
- 無 raw engineering code 作主要訊息

==================================================
Stage 0–12 設計流程
==================================================

每一個 Stage 正式開始時，再建立：
1. Stage Goal
2. Page Inventory
3. Scenario Matrix
4. Text Wireframe
5. Component Inventory
6. State Matrix
7. Current-vs-Future Wiring Map
8. Visual Mockup
9. Owner Review
10. Final Stage Acceptance Record

現時：
Stage 0–12 頁面架構與使用場景已詳細定義。
下一步先由 Stage 0 開始 Text Wireframe，不提前畫 Stage 1–12 高保真圖。

MILESTONE：
MFK_SMT_STAGE_00_12_DETAILED_UI_ARCHITECTURE_RECORDED


==================================================
RECORD 004｜STAGE 0 詳細設計｜SMT SHELL＋GLOBAL SYSTEM LAYER
日期：2026-09-27
狀態：TEXT WIREFRAME / FUNCTIONAL UI SPEC
目標：鎖定全 SMT 共用 Shell、Navigation、Global Alert、Global Attention；未進入高保真 Mockup。
==================================================

STAGE 0 核心目的
--------------------------------------------------

Stage 0 係全 SMT 嘅共同骨架。

之後 Stage 1–12 所有頁面，都必須放入同一套 Shell。
呢個 Stage 唔處理商品、付款、堂食等業務內容本身，而係處理：

1. 員工永遠知道自己喺邊一頁。
2. 高頻入口位置固定。
3. 新單無論喺邊一頁都睇得到。
4. Printer / Payment / Provider / Sync 異常無論喺邊一頁都可以被發現。
5. Local Offline 唔會被誤解成「SMT 停機」。
6. More / Tools 退到低頻位置。
7. Staff identity 只作身份與權限提示，不搶前線空間。
8. 全局狀態唔靠假綠燈。

--------------------------------------------------
0A｜1920×1080 MASTER SHELL
--------------------------------------------------

Primary Target：
1920 × 1080

建議固定結構：

┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP UTILITY BAR                                                             │
│ Store / Local / Sync / Attention / Staff / More                            │
├──────┬───────────────────────────────────────────────────────────────────────┤
│      │                                                                       │
│ NAV  │                         ROUTE STAGE                                   │
│      │                                                                       │
│ 點單 │                                                                       │
│ 訂單 │                                                                       │
│ 堂食 │                                                                       │
│ 售罄 │                                                                       │
│      │                                                                       │
│      │                                                                       │
└──────┴───────────────────────────────────────────────────────────────────────┘

尺寸建議：

Left Rail：
72–80 px

Top Utility Bar：
56–64 px

Route Stage：
其餘全部

Outer Gap：
12–16 px

注意：
Stage 0 不固定 Stage 1–12 內部欄位比例；
只固定 Shell 本身。

--------------------------------------------------
PAGE 0.1｜SMT MAIN SHELL
--------------------------------------------------

【狀態】
UI_REWORK

【目的】
提供所有頁面共用框架。

【左側 Navigation】

只保留四個高頻入口：

1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

「更多」唔再做第五個高頻 Rail Item。
More 進入 Top Utility Bar Hamburger。

【Navigation Component】

每項：
- Icon
- Label
- Active State
- Optional Count Badge

Active：
- Primary Blue Soft Background
- Primary Blue Icon / Text

Inactive：
- Neutral

Badge 只用：
- Orders 有 active / pending count 時

禁止：
- 每個 Nav 不同顏色
- Icon-only 無文字
- 把 More 同高頻操作同級

【Navigation 使用場景】

Scenario 0.1-A｜正常營業
- 點單 active
- 其他 neutral
- 無 alert

Scenario 0.1-B｜Orders 有進行中單
- Orders 顯示 count badge
- 唔強迫跳頁

Scenario 0.1-C｜收到新 Customer / Keeta
- Global Alert 出現
- Nav 本身可加 attention dot / count
- 不自動跳 Orders

Scenario 0.1-D｜當前正 Checkout
- 左 Nav 可以保持，但 Checkout transaction 未完成時不應因誤觸 Nav 而無提示離開
- 若離開會丟失 draft，需要 confirm guard

Scenario 0.1-E｜Dining Payment Processing
- Shell 保持
- Global Alert 仍可見
- Transaction area 不被新單 overlay 遮死

【Top Utility Bar】

由左至右建議：

A. Store Identity
- 磨飯
- Store Code（如真係需要）
- Business Day

B. Local Runtime Status
- LOCAL READY
- OFFLINE / ONLINE domain status

C. Attention Summary
- 例如「3 項待處理」
- 點擊開 Global Attention Center

D. Staff
- 員工名稱／登入識別
- 只顯必要資料

E. Hamburger
- More / Tools

【Top Utility Status 規則】

Local Ready：
只代表本地 runtime 可工作。
唔代表：
- Cloud 正常
- Printer 正常
- Keeta 正常
- Customer 正常

Cloud / Provider status：
獨立顯示。

禁止：
單一「系統正常」綠燈代表全部 domain。

【Staff 區】

顯示：
- Display Name / loginId（以現行身份模型）
- Staff Session 狀態

可操作：
- 查看身份
- Logout
- 如需要進 Staff info

唔應：
- 在主 Shell 顯示 permissions JSON
- 顯示 raw staffId / UUID

【Hamburger / More】

打開後：
- 收銀與日結
- 報表
- 打印與設備
- 診斷
- 備份／恢復
- Admin Sync

Future：
- Cash In / Out

規則：
More 係低頻入口。
打開 More 不應令當前 Draft Transaction 自動消失。

--------------------------------------------------
PAGE 0.2｜GLOBAL NEW ORDER ALERT
--------------------------------------------------

【狀態】
LIVE + UI_REWORK

【觸發來源】

- Customer
- Keeta

【不應由以下來源觸發同一種 Global New Order Alert】
- 本機 Walk-in
- 已經由 staff accept 完成的 order
- 純 Provider status callback
- Reprint / Refund / Correction

【Alert 位置】

建議：
Top Utility Bar 下方，偏右上／中央上方。

不能：
- 全屏遮罩
- 完全遮住 Checkout Keypad
- 遮住 Dining payment action
- 阻止本機交易繼續

【Alert 結構】

第一行：
新訂單到達，要處理

第二行：
#Display / Pickup Identity
Source

第三行可選：
到達時間
Item Count

Actions：
- 立即處理
- 30 秒後
- 1 分鐘後

【視覺層級】

Alert Background：
Surface Raised

Attention：
Warning / Info Accent

Primary：
立即處理

Secondary：
30 秒後
1 分鐘後

【聲音】

第一次：
一個短提示聲

Snooze 回來：
可再提示一次

禁止：
- 不停循環響
- 每秒震動
- 聲音本身代表已接單

【場景矩陣】

Scenario 0.2-A｜Customer 新單
顯示：
- Source = 自家平台
- Display / customer identity
- 立即處理

按「立即處理」：
→ Orders / Pending Review

不會：
→ 自動 Accept

Scenario 0.2-B｜Keeta 新單
顯示：
- Source = Keeta
- Provider order identity / local display

按「立即處理」：
→ Keeta Pending Review

Scenario 0.2-C｜按 30 秒後
- Alert 暫時消失
- Order 保持 pending
- 30 秒後重新浮出
- defer / snooze 唔等於 provider defer business action

Scenario 0.2-D｜按 1 分鐘後
同上。

Scenario 0.2-E｜Alert 期間另一張新單到達
設計要求：
- 不應覆蓋第一張而令佢消失
- Global Alert 可顯示：
  「2 張新單待處理」
- 首張／最舊 pending 可作 Primary
- 提供「查看全部」

Scenario 0.2-F｜當前 Checkout processing
- Alert 可見但降低侵入性
- 不可以蓋住 Confirm / Result
- 點立即處理前，如離開會破壞未完成 transaction，必須先完成/安全離開

Scenario 0.2-G｜Order 已被另一流程處理
當 Alert 仲存在：
- 點擊時先 read current state
- 若已處理：
  顯示「此訂單已處理」
  不再進行第二次 Accept

【不可破壞】
- Alert ≠ Accept
- Snooze ≠ Reject
- Sound ≠ Order State
- 多張新單不可互相覆蓋遺失

--------------------------------------------------
PAGE 0.3｜GLOBAL EXCEPTION / ATTENTION CENTER
--------------------------------------------------

【狀態】
PARTIAL_UI

【目的】
將跨頁面、需要人處理的異常集中，但唔把工程 Log 倒落前線。

【入口】

Top Utility：
「待處理 3」

顏色按最高 severity：
- Critical → Red
- Action Required → Warning
- Information → Blue / Neutral

【Attention 類型】

A. PRINT
- Printer Offline
- Print Failed
- Print Unknown
- Partial Route Failure

B. PAYMENT
- Payment Evidence Pending
- Payment Conflict
- Payment Unknown

C. PROVIDER
- Keeta Confirm Attention
- Keeta Intake Error
- Provider After-sale pending

D. CUSTOMER
- Customer Evidence pending
- Customer Intake problem

E. ADMIN / CONFIG
- Admin Sync stale
- No valid config
- LKG in use

F. RECOVERY
- Unfinished action
- Readback required
- Reconcile required

【Attention Card 結構】

Header：
- Domain
- Severity
- Timestamp

Main：
- 人類可理解標題

Example：
「廚房製作單打印結果未能確認」

Description：
「訂單已成立，但系統無法確認廚房打印機有冇出紙。」

Impact：
「請先檢查廚房打印機，避免重複打印。」

CTA：
- 查看訂單
- 查看打印狀態
- 核對付款
- 重新同步
- 查看詳情

Engineering Detail：
收起
點開先見：
- Code
- Route
- Endpoint
- Revision
- Elapsed
- Timestamp

【Attention Lifecycle】

NEW
→ ACKNOWLEDGED
→ RESOLVED

如果 current runtime 冇正式 ACK state：
UI 只做「已查看」local affordance，
不得偽造 backend resolved state。

【場景】

Scenario 0.3-A｜Print FAILED
顯示：
- 哪張 Order
- 哪條 Route
- 哪部 Printer
- Failed
- 可選人工 Reprint（如果 runtime 允許）

Scenario 0.3-B｜Print UNKNOWN
顯示：
- UNKNOWN
- 禁止 Primary CTA 寫「再打印」
- Primary 建議：「檢查打印狀態」
- Secondary：「查看訂單」

Scenario 0.3-C｜Payment Evidence Pending
顯示：
- Customer Order
- Tender
- 「付款待核對」
- CTA：核對付款

Scenario 0.3-D｜Keeta Attention
顯示：
- Local 已接單 / Provider confirm 未確認（如果係呢種情況）
- Provider code 在 Engineering detail
- 前線只見「Keeta 同步需要處理」

Scenario 0.3-E｜Admin Sync Stale
如果 LKG 可用：
- 顯示「目前使用最後有效設定」
- 本地交易繼續
- CTA：查看同步

如果冇 LKG：
- 顯示受影響範圍
- Fail closed 嗰部分

Scenario 0.3-F｜多項異常
排序：
1. Payment / Transaction Critical
2. Print Unknown / Failed
3. Provider Attention
4. Config / Sync
5. Information

【不可破壞】
- UNKNOWN 不變 FAILED
- Offline 不等於全部功能失效
- Provider failure 只影響 provider seam
- Engineering code 不做第一層訊息

--------------------------------------------------
0B｜STAGE 0 COMPONENT INVENTORY
--------------------------------------------------

必須建立：

01. AppShell
02. PrimaryRail
03. PrimaryNavItem
04. TopUtilityBar
05. LocalRuntimeStatus
06. DomainStatusChip
07. AttentionSummaryButton
08. StaffIdentityButton
09. MoreMenuButton
10. GlobalOrderAlert
11. GlobalOrderAlertQueue
12. AttentionDrawer / Center
13. AttentionCard
14. SeverityBadge
15. DomainBadge
16. EngineeringDetailDisclosure
17. OfflineIndicator
18. SyncIndicator
19. PrinterAttentionIndicator
20. ConfirmLeaveGuard（如 transaction draft 需要）

--------------------------------------------------
0C｜STAGE 0 STATE MATRIX
--------------------------------------------------

SHELL：
- READY
- LOCAL_ONLY
- DEGRADED
- ATTENTION
- SESSION_EXPIRED

NEW ORDER ALERT：
- NONE
- SINGLE_CUSTOMER
- SINGLE_KEETA
- MULTIPLE
- SNOOZED
- ALREADY_HANDLED

ATTENTION CENTER：
- EMPTY
- INFO_ONLY
- ACTION_REQUIRED
- CRITICAL
- MIXED
- RESOLVED_HISTORY（如保留）

DOMAIN：
- ONLINE
- OFFLINE
- DEGRADED
- UNKNOWN

注意：
DOMAIN state 唔可以 collapse 成一個 global boolean。

--------------------------------------------------
0D｜CURRENT vs FUTURE WIRING
--------------------------------------------------

LIVE / 可直接接：
- Current left navigation routes
- Orders active count
- Customer new-order event
- Keeta new-order event
- Audio alert
- 30s / 60s snooze
- Staff session badge
- Local runtime
- More route
- Printer / Diagnostics source
- Admin sync source

UI_REWORK：
- More 由 left rail 移去 top hamburger
- Top Utility Bar
- Domain status presentation
- Multi-alert aggregation
- Attention visual hierarchy

PARTIAL / FUTURE：
- 統一 persistent Attention Center
- 真正跨 domain resolved / acknowledged model（如 runtime 未有）
- 更完整 Printer global alert queue

--------------------------------------------------
0E｜TEXT WIREFRAME — NORMAL STATE
--------------------------------------------------

[TOP BAR]
磨飯 | Business Day 2026-09-27
LOCAL READY
Admin Sync：已同步
待處理：0
Staff：1111
[☰]

[LEFT RAIL]
點單  ← Active
訂單  3
堂食
售罄／產能

[ROUTE STAGE]
Stage 1 Ordering content

--------------------------------------------------
0F｜TEXT WIREFRAME — NEW ORDER
--------------------------------------------------

[TOP BAR]
磨飯 | LOCAL READY | 待處理 1 | Staff 1111 | [☰]

[GLOBAL ALERT]
新訂單到達，要處理
#P034 · Keeta
剛剛到達

[立即處理] [30 秒後] [1 分鐘後]

[ROUTE STAGE]
原本頁面保持可操作

--------------------------------------------------
0G｜TEXT WIREFRAME — MULTIPLE ATTENTION
--------------------------------------------------

[TOP BAR]
磨飯
LOCAL READY
Cloud：離線
待處理 3 ⚠
Staff 1111
[☰]

點擊「待處理 3」

[ATTENTION DRAWER]

1.
⚠ 打印結果未能確認
#P032 · 廚房製作
請先檢查打印機，避免重複打印
[查看打印狀態]

2.
⚠ Customer 付款待核對
#P033 · FPS
[核對付款]

3.
i Admin 暫時未能同步
目前使用最後有效設定
[查看同步]

--------------------------------------------------
0H｜STAGE 0 INTERACTION RULES
--------------------------------------------------

1. Nav 切頁：
普通頁面可直接切。
有未完成高風險 Transaction 時，要按 runtime reality 決定是否需 leave guard。

2. New Order Alert：
永遠不直接 commit / accept。

3. Attention：
第一層必須人類可理解。
Technical detail 第二層先顯示。

4. More：
打開 overlay / menu，不改當前 business state。

5. Staff：
身份操作不可遮蓋主要交易長時間。

6. Domain Status：
只顯示可以證明的 domain state。

7. Error：
不要用 Toast 一閃就消失處理需要人手 follow-up 的異常。
需要 follow-up 的一定進 Attention。

--------------------------------------------------
0I｜STAGE 0 VISUAL PRIORITY
--------------------------------------------------

最高：
- Current Page / Primary Nav
- Active Transaction
- Critical Attention

第二：
- New Order Alert
- Action Required
- Staff / Local State

第三：
- Sync detail
- Info
- More

最低：
- Engineering detail
- Version / diagnostics codes

--------------------------------------------------
0J｜STAGE 0 ACCEPTANCE CHECKLIST
--------------------------------------------------

01. 1920×1080 完整顯示。
02. 四個高頻入口位置固定。
03. More 不再佔第五個高頻 Rail。
04. Customer / Keeta 新單任何頁都可見。
05. Alert 不自動 Accept。
06. Snooze 不改 Order semantics。
07. 多張新單不會互相覆蓋遺失。
08. Checkout / Dining transaction 不被 Alert 阻死。
09. Offline 不顯示成「整個系統不可用」。
10. Printer / Payment / Provider / Admin Sync 分 domain 表達。
11. UNKNOWN 與 FAILED 不同。
12. 所有需要跟進異常可以留喺 Attention Center。
13. 第一層不顯 raw code。
14. Staff 不顯 raw internal ID。
15. UI 不顯 raw UUID。
16. More / Tools 不修改 current business state。
17. Shell 可以承載 Stage 1–12。
18. 1366×768 可以縮密度但主要位置不搬。
19. Touch target ≥48px。
20. 所有 status 都有文字，不靠顏色。

--------------------------------------------------
STAGE 0 OUTPUT
--------------------------------------------------

STATUS：
TEXT WIREFRAME DEFINED

READY FOR：
Stage 0 Visual Layout Draft

NOT YET：
- High-fidelity Mockup
- Final visual approval
- Stage 1 visual production

MILESTONE：
MFK_SMT_UI_STAGE0_TEXT_WIREFRAME_READY


==================================================
RECORD 005｜STAGE 0 VISUAL LAYOUT DRAFT
日期：2026-09-27
狀態：LAYOUT SPEC / NO HIGH-FIDELITY ART YET
目標：鎖定 SMT Shell 的實際 1920×1080 幾何、區域尺寸、層級、Alert / Attention 展開方式，作為 Stage 1–12 共用母版。
==================================================

STAGE 0 VISUAL LAYOUT 核心原則
--------------------------------------------------

1. 先鎖「位置」，後鎖「美術」。
2. 所有 Stage 共用同一 Shell，唔准之後每頁自行改導航／頂欄位置。
3. 主工作區優先，Shell 只佔必要空間。
4. Alert 可以跨頁出現，但不可遮住主要付款／堂食操作。
5. Attention Center 係 persistent operational layer，不係 Toast。
6. More 係低頻工具入口，唔再佔左 Rail 高頻位置。
7. 所有尺寸以 1920×1080 為 Primary；1366×768 只做壓縮，不改主區域順序。
8. 右手操作優先：Primary CTA、Attention CTA、More、Staff 均避免放到左上角深位。

--------------------------------------------------
0V.1｜1920×1080 MASTER GRID
--------------------------------------------------

畫布：
1920 × 1080

Safe Area：
四邊 12px

主要區：

A. Left Rail
X = 12
Y = 12
W = 76
H = 1056

B. Top Utility Bar
X = 100
Y = 12
W = 1808
H = 60

C. Route Stage
X = 100
Y = 84
W = 1808
H = 984

D. Global Floating Layer
覆蓋 Route Stage 上方
只用於：
- New Order Alert
- Attention Drawer
- Confirm Leave
- Critical System Modal

Shell Gap：
12px

--------------------------------------------------
0V.2｜LEFT RAIL
--------------------------------------------------

整體：
W = 76
Background = Surface
Radius = 16
Border = 1px Border
Padding Top / Bottom = 10
Padding X = 8

區域結構：

[Brand]
高度 64

[Primary Nav]
4 × 76 高度單元
中間 gap 8

[Flexible Spacer]

[Optional Offline / Local Mark]
高度 56

注意：
More 唔放 Rail。

--------------------------------------------------
0V.3｜BRAND AREA
--------------------------------------------------

Brand Box：
W 60
H 60
置中

內容：
正式「磨飯」品牌簡化標記／正式 Logo 符號版本。

如果正式 Logo 在 60×60 太細：
只使用批准過的簡化 Brand Mark。
不可自行重畫 Logo。

Brand 區唔做：
- Home button
- Hidden shortcut
- Easter egg

純品牌識別。

--------------------------------------------------
0V.4｜PRIMARY NAV ITEM
--------------------------------------------------

每個 Nav Item：

W = 60
Min H = 72
Radius = 12

內容垂直排列：

Icon
8px gap
Label

Icon：
24–26px

Label：
14–15px
Semi-bold

四項固定：

01 點單
02 訂單
03 堂食
04 售罄／產能

「售罄／產能」如果兩行：
售罄
產能

Active：
- Primary Soft
- Primary Blue text/icon
- 2px left or inner indicator（只可選一種，不兩種同時）

Inactive：
- Transparent
- Text Secondary

Hover：
- Neutral Soft

Pressed：
- Primary Soft darker

--------------------------------------------------
0V.5｜NAV BADGE
--------------------------------------------------

只在有實際 count 時顯示。

位置：
Nav Item 右上角

Badge：
min 22×22
Padding X 6

用於：
- Orders active/pending count

顯示：
1–99
99+

禁止：
- 永遠顯 0
- 純裝飾紅點
- 未有實際 count source 時顯 badge

--------------------------------------------------
0V.6｜TOP UTILITY BAR
--------------------------------------------------

整體：
H = 60
Background = Surface
Radius = 14
Border = 1px Border

Grid 建議：

[Store / Business Day]
260 px

[Local Runtime]
180 px

[Domain / Sync]
220 px

[Flexible Spacer]

[Attention]
180 px

[Staff]
190 px

[More]
56 px

總體原則：
左邊顯示「系統位置與狀態」
右邊顯示「人與操作」

--------------------------------------------------
0V.7｜STORE / BUSINESS DAY BLOCK
--------------------------------------------------

第一行：
磨飯

第二行：
Business Day 2026-09-27

字級：
Store = 16–17 / 700
Business Day = 12–13 / 500

如果 Business Day 同 Calendar Date 不同：
要顯示 Business Day，唔用「今日」代替。

可選：
Store Code MF01
只在必要時顯示。

--------------------------------------------------
0V.8｜LOCAL RUNTIME BLOCK
--------------------------------------------------

正常：
● LOCAL READY

Local-only：
● LOCAL ONLY

Degraded：
⚠ LOCAL READY · 部分外部服務不可用

規則：
Local Runtime Status 只代表本機交易工作面是否可用。

禁止文字：
「系統正常」
除非所有 domain 真有 aggregate health contract。

--------------------------------------------------
0V.9｜DOMAIN / SYNC BLOCK
--------------------------------------------------

預設只顯示一個摘要：

Admin Sync
已同步

或者：

Admin Sync
使用最後有效設定

如果需要查看更多 domain：
點擊後開輕量 popover：

Admin
Customer
Keeta
Cloud Projection

每項：
Status + Last Readback

唔在 Top Bar 同時塞 6 粒 badge。

--------------------------------------------------
0V.10｜ATTENTION SUMMARY
--------------------------------------------------

Default：
待處理 0

有 Attention：
⚠ 待處理 3

Critical：
! 待處理 3

W = 160–180
H = 44

點擊：
打開右側 Attention Drawer。

狀態：
0 時可以 Neutral。
>0 按最高 severity 顯示 accent。

禁止：
用純紅色數字但無「待處理」文字。

--------------------------------------------------
0V.11｜STAFF BLOCK
--------------------------------------------------

W = 180–190
H = 44

內容：

Avatar / Initial
員工顯示名稱
loginId 或短識別

例如：

CY
陳小姐
1111

點擊：
Staff Popover

可有：
- Login identity
- Session state
- Logout

不顯：
- internal staffId
- UUID
- Permission JSON

--------------------------------------------------
0V.12｜MORE / HAMBURGER
--------------------------------------------------

56×44

Icon：
Hamburger / 3-line

ARIA / Label：
更多工具

點擊：
打開 More Menu / Drawer

不直接 navigate。

--------------------------------------------------
0V.13｜MORE MENU GEOMETRY
--------------------------------------------------

桌面建議：
右上角 Popover / Drawer

Option A｜Popover
W = 360
Max H = 720

Option B｜Right Drawer
W = 420
H = calc(100vh - 24px)

本輪推薦：
Right Drawer

原因：
More 內功能唔止 3–4 個；
之後會有 Day Close、Reports、Print、Diagnostics、Backup、Admin Sync，
Drawer 比小 Popover 穩定。

結構：

Header
「更多工具」

Body Cards：
1. 收銀與日結
2. 報表
3. 打印與設備
4. 診斷
5. 備份／恢復
6. Admin Sync
7. Cash In / Out（Future）

Footer：
版本／Build info（低層級，可展開）

重要：
More Drawer 開啟時，
Route Stage 背景仍保留；
如果當前 transaction 高風險，
關 Drawer 返回原位置。

--------------------------------------------------
0V.14｜ROUTE STAGE
--------------------------------------------------

X = 100
Y = 84
W = 1808
H = 984

Stage 1–12 所有頁面只可以使用呢個區。

Route Stage 自己：
唔再加第二個全局 Header。

每個 Stage 內可有：
- Page Header
- Local Toolbar
- Local Filter

但：
不得重複 Staff / More / Global Attention。

--------------------------------------------------
0V.15｜GLOBAL NEW ORDER ALERT GEOMETRY
--------------------------------------------------

Default Position：
右上，Top Utility Bar 下方 12px

X 約：
1920 - 24 - 440 = 1456

Y：
84

W：
440

Min H：
132

Max H：
220

Radius：
16

Shadow：
Modal-light

Alert Card 結構：

[Source / 新訂單]
[Display Number] [到達時間]

[簡要資訊]
- Source
- Item Count

[Actions]
立即處理
30 秒後
1 分鐘後

Primary：
立即處理

Secondary：
30秒 / 1分鐘

如果多張：
Header：
「3 張新訂單待處理」

Body：
顯示最舊 1 張
＋
「查看全部 3 張」

--------------------------------------------------
0V.16｜ALERT INTRUSION RULE
--------------------------------------------------

Alert 唔可以遮：

- Checkout Confirm
- Checkout Keypad
- Dining Settlement CTA
- Refund Confirm
- Payment Correction Confirm

如果 Route Stage 右上本身係高風險操作：

Alert 自動向左移 460px，
或者縮成 Compact Alert Bar。

Compact Alert：

W 360
H 72

內容：
「新訂單：Keeta #P034」
[處理] [稍後]

--------------------------------------------------
0V.17｜MULTIPLE NEW ORDER QUEUE
--------------------------------------------------

當 2 張以上：

Global Alert Header：
「3 張新訂單待處理」

顯示：
最舊一張優先

Secondary：
查看全部

查看全部後：
開 Mini Queue Drawer

W = 480
Max H = 720

每張：
- Source
- Display
- Age
- Item Count
- Processing State

排序：
Oldest Pending First

不可：
Newest 覆蓋 Oldest。

--------------------------------------------------
0V.18｜ATTENTION DRAWER GEOMETRY
--------------------------------------------------

位置：
右側

W = 480

Top：
84

Bottom：
12

H：
984

Background：
Surface

左邊：
1px Border
Shadow

Header：
64px

Body：
scroll

Footer：
可選 Filter

Attention Drawer 唔取代 Route Stage；
Overlay route 但唔改 route。

--------------------------------------------------
0V.19｜ATTENTION DRAWER HEADER
--------------------------------------------------

左：
待處理事項

右：
X Close

Sub-row：
全部
Critical
需處理
資訊

如果 filter 未真正接線：
唔畫 active interactive filter；
先用 grouping。

--------------------------------------------------
0V.20｜ATTENTION CARD
--------------------------------------------------

Min H：
124

Padding：
16

結構：

[Severity Icon] [Domain] [Time]

Title
Description

Impact / Next Action

[Primary CTA] [Secondary]

例如：

⚠ 打印
2 分鐘前

廚房製作單打印結果未能確認

訂單 #P032 已成立，
但系統未能確認廚房打印機有冇出紙。

請先檢查廚房打印機，
避免重複打印。

[檢查打印狀態] [查看訂單]

--------------------------------------------------
0V.21｜ATTENTION SEVERITY VISUAL
--------------------------------------------------

INFO：
Blue line / icon
Neutral background

ACTION REQUIRED：
Warning line / icon
Warning soft background

CRITICAL：
Danger line / icon
Danger soft background

RESOLVED：
Neutral muted

唔用整張深紅／深黃卡。
保持高可讀。

--------------------------------------------------
0V.22｜DOMAIN STATUS POPOVER
--------------------------------------------------

位置：
Top Utility Domain Block

W：
360

Row：

Admin
已同步
Last 17:03

Customer
在線
Last 17:04

Keeta
需要留意
2 pending

Cloud Projection
離線
本地交易不受影響

重要：
每個 domain 自己一行。

唔做：
一粒「ONLINE」統一代表全部。

--------------------------------------------------
0V.23｜STAFF POPOVER
--------------------------------------------------

W：
280

內容：

登入員工
陳小姐
登入編號 1111

Session：
有效

Actions：
[登出]

如有 switch staff 功能：
另按 current runtime 決定，
未證實就唔畫。

--------------------------------------------------
0V.24｜CONFIRM LEAVE GUARD
--------------------------------------------------

只在真係會丟失／中斷高風險 draft 時出。

例如：
- Checkout 有未提交狀態
- Refund modal 有輸入
- Price Override 未確認

Modal：
W = 520
Auto height

Title：
尚有未完成操作

Body：
「離開後，今次輸入將不會提交。」

Buttons：
繼續操作
放棄並離開

注意：
如果 current page state本身 persistence 可安全恢復，
就唔應濫用 Leave Guard。

--------------------------------------------------
0V.25｜NORMAL STATE TEXT LAYOUT
--------------------------------------------------

┌────────────────────────────────────────────────────────────────────────────┐
│ 磨飯      LOCAL READY       Admin Sync 已同步      待處理 0    陳小姐  ☰ │
├──────┬─────────────────────────────────────────────────────────────────────┤
│  磨  │                                                                     │
│      │                                                                     │
│ 點單 │                                                                     │
│      │                                                                     │
│ 訂單 │                         ROUTE STAGE                                 │
│  3   │                                                                     │
│ 堂食 │                                                                     │
│      │                                                                     │
│ 售罄 │                                                                     │
│ 產能 │                                                                     │
│      │                                                                     │
└──────┴─────────────────────────────────────────────────────────────────────┘

--------------------------------------------------
0V.26｜NEW ORDER STATE TEXT LAYOUT
--------------------------------------------------

┌────────────────────────────────────────────────────────────────────────────┐
│ 磨飯   LOCAL READY      Admin Sync 已同步      ⚠ 待處理 1   陳小姐  ☰  │
├──────┬──────────────────────────────────────────────────────┬──────────────┤
│      │                                                      │ 新訂單到達  │
│ 點單 │                                                      │ Keeta       │
│      │                                                      │ #P034       │
│ 訂單 │                   CURRENT ROUTE                      │ 2 件         │
│  4   │                                                      │              │
│ 堂食 │                                                      │ [立即處理]  │
│      │                                                      │ [30秒][1分] │
│ 售罄 │                                                      │              │
│ 產能 │                                                      │              │
└──────┴──────────────────────────────────────────────────────┴──────────────┘

--------------------------------------------------
0V.27｜ATTENTION OPEN TEXT LAYOUT
--------------------------------------------------

┌────────────────────────────────────────────────────────────────────────────┐
│ 磨飯   LOCAL READY      Cloud 離線      ⚠ 待處理 3        陳小姐  ☰     │
├──────┬──────────────────────────────────────────────────────┬──────────────┤
│      │                                                      │ 待處理事項 ×│
│ 點單 │                                                      ├──────────────┤
│      │                                                      │ ⚠ PRINT     │
│ 訂單 │                   CURRENT ROUTE                      │ #P032       │
│      │                                                      │ 結果未確認  │
│ 堂食 │                                                      │ [檢查狀態]  │
│      │                                                      ├──────────────┤
│ 售罄 │                                                      │ ⚠ PAYMENT   │
│ 產能 │                                                      │ #P033       │
│      │                                                      │ 待核對      │
│      │                                                      │ [核對付款]  │
│      │                                                      ├──────────────┤
│      │                                                      │ i SYNC      │
│      │                                                      │ 使用 LKG    │
└──────┴──────────────────────────────────────────────────────┴──────────────┘

--------------------------------------------------
0V.28｜1366×768 COMPACT RULE
--------------------------------------------------

Left Rail：
68px

Top Bar：
54px

Route Stage：
其餘

Top Bar 簡化：
- Store / Business Date → 可收成一個 block
- Domain summary → icon + short label
- Staff → avatar + short name
- Attention 不可消失
- Hamburger 不可消失

Alert：
W 360
Max H 180

Attention Drawer：
W 400

Nav：
Icon 22
Label 13

禁止：
- 轉成 bottom nav
- 將 Cart / Checkout CTA 移位
- 把 primary nav 收成 hamburger

--------------------------------------------------
0V.29｜RESPONSIVE PRIORITY
--------------------------------------------------

如果空間不足，依次縮：

1. Outer padding
2. Gap
3. Secondary copy
4. Store secondary metadata
5. Domain detail

最後先縮：
- Nav label
- Primary action

不可隱藏：
- Attention
- Staff identity
- Primary Nav
- More
- Current page

--------------------------------------------------
0V.30｜VISUAL STYLE APPLICATION
--------------------------------------------------

Canvas：
#F5F4F0

Shell Surfaces：
#FFFFFF

Primary：
#1F5FBF

Rail Active：
#EEF4FF

Text：
#20242B

Secondary：
#646B75

Attention Warning：
#B87416
配 #FFF6E8

Danger：
#C93D3D
配 #FFF0F0

Success：
#248A5A
配 #EDF8F2

Shadow：
非常輕

不可：
- 大面積 Gradient
- Neumorphism
- 彩虹 domain 色
- Glass blur 遮低文字 contrast

--------------------------------------------------
0V.31｜COMPONENT SIZING TABLE
--------------------------------------------------

Primary Nav Item：
60 × 72+

Top Utility Control：
44–48 high

Attention Summary：
160–180 × 44

Staff：
180–190 × 44

More：
56 × 44

Global Alert：
440 × 132–220

Compact Alert：
360 × 72

Attention Drawer：
480 × 984

Attention Card：
min 124 high

Popover：
280–360 wide

Confirm Leave：
520 wide

所有 touch target：
≥48 × 48

--------------------------------------------------
0V.32｜STAGE 0 FINAL DECISIONS TO CARRY FORWARD
--------------------------------------------------

DECISION 0-01
四個高頻 Rail：
點單／訂單／堂食／售罄產能。

DECISION 0-02
More 移去 Top Hamburger。

DECISION 0-03
Top Bar 唔顯一粒「System Green」；
Local / Domain / Attention 分開。

DECISION 0-04
New Order Alert 係 non-blocking floating operational alert。

DECISION 0-05
多張新單用 queue，唔互相覆蓋。

DECISION 0-06
Attention Center 用右 Drawer。

DECISION 0-07
UNKNOWN 一律 Warning semantics，
唔等於 FAILED。

DECISION 0-08
Technical code 收入 second-level detail。

DECISION 0-09
所有 Stage 共用同一 Shell。

DECISION 0-10
1920×1080 為 Primary；
1366×768 只做 compact，不改主操作位置。

--------------------------------------------------
STAGE 0 CURRENT RESULT
--------------------------------------------------

PAGE INVENTORY：
LOCKED FOR DRAFT

TEXT WIREFRAME：
COMPLETE

VISUAL LAYOUT GEOMETRY：
DRAFTED

COMPONENT INVENTORY：
COMPLETE FOR STAGE 0

STATE MATRIX：
COMPLETE FOR STAGE 0

HIGH-FIDELITY MOCKUP：
NOT STARTED

OWNER VISUAL APPROVAL：
PENDING

NEXT：
進入 Stage 0 Low-Fidelity Visual Mockup / Wireframe 圖，
或者先進 Stage 1 Text Wireframe。

MILESTONE：
MFK_SMT_UI_STAGE0_VISUAL_LAYOUT_DRAFT_READY


==================================================
RECORD 005｜命名鎖定＋UI-STAGE-00 視覺佈局規格
日期：2026-09-27
狀態：UI SPEC IN PROGRESS
==================================================

命名正式鎖定：

UI-STAGE-00 ～ UI-STAGE-12
= 呢份「MFK SMT FULL UI SPEC」嘅設計章節。

佢哋唔代表系統 Runtime 執行順序。

系統真正執行流程之後統一叫：
SYSTEM FLOW / RUNTIME FLOW

例如：
Boot → Login → Ordering → Checkout → Formal Commit → Print
呢啲唔會再叫 Stage 0 / Stage 1。

==================================================
UI-STAGE-00｜SHELL / NAVIGATION / GLOBAL LAYER
==================================================

定位：
整套 SMT UI Spec 第一章。
負責所有 UI-STAGE 共用嘅 Shell、Navigation、Top Utility、Global Alert、Global Attention。
唔處理 Ordering / Checkout / Dining 內部業務畫面。

--------------------------------------------------
00.1｜1920×1080 MASTER FRAME
--------------------------------------------------

Canvas：
1920 × 1080

固定區域：

A. Left Navigation Rail
寬：80 px
位置：x=0 → 80
高度：1080

B. Top Utility Bar
位置：x=80 → 1920
高度：64 px

C. Route Stage
位置：x=80 → 1920
y=64 → 1080

Route Stage 內部 Padding：
16 px

Shell 背景：
Canvas #F5F4F0

Navigation Rail：
Surface #FFFFFF
右邊 1 px Border #DDE1E6

Top Utility：
Surface #FFFFFF
底部 1 px Border #DDE1E6

原則：
- Rail 不隨 Route 消失
- Top Utility 不隨 Route 改位置
- Route Stage 先由各 UI-STAGE 自己定義內部 layout
- Shell 唔將任何 Cloud status 變成交易阻斷

--------------------------------------------------
00.2｜LEFT NAVIGATION RAIL
--------------------------------------------------

Nav Items：

1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

Bottom：
不放 More。

More 改由 Top Utility Hamburger 進入。

每個 Nav Item：

寬：64 px
最小高：64 px
外距：8 px
Radius：12 px

內容：
Icon
Label

Active：
- Primary Soft #EEF4FF
- Primary Blue #1F5FBF

Inactive：
- Transparent
- Text Secondary

Orders Badge：
只顯示：
- Pending / Active count

Badge：
最小 22 × 22
超過 99 顯示 99+

禁止：
- 每個 Nav 自己一隻主色
- 純 Icon 無文字
- UUID / engineering identifier

--------------------------------------------------
00.3｜TOP UTILITY BAR
--------------------------------------------------

建議由左至右：

[Store / Business Day]
[Local Runtime]
[Domain Status]
[Attention]
---------------- flexible spacer ----------------
[Staff]
[Hamburger]

A. Store Block
顯示：
磨飯
Business Day：YYYY-MM-DD

B. Local Runtime
顯示：
LOCAL READY
或
LOCAL DEGRADED

注意：
LOCAL READY 只代表本地 POS runtime 可用。
唔代表：
- Cloud
- Printer
- Customer
- Keeta
- Admin
全部正常。

C. Domain Status
預設只顯示真正需要前線知道的異常。
正常時不需要排一串綠燈。

例如：
Cloud 離線
Keeta 注意
Printer 1 異常

D. Attention Button
正常：
待處理 0

有異常：
待處理 3

按：
開 Attention Drawer。

E. Staff
顯示：
Display Name / Login ID
不顯 internal staffId。

F. Hamburger
開 More / Tools Menu。

--------------------------------------------------
00.4｜TOP UTILITY NORMAL STATE
--------------------------------------------------

文字 Wireframe：

┌─────────────────────────────────────────────────────────────┐
│ 磨飯 · 2026-09-27   LOCAL READY              待處理 0  1111  ☰ │
└─────────────────────────────────────────────────────────────┘

原則：
正常時保持安靜。
唔需要：
「Customer 正常」
「Keeta 正常」
「Printer 正常」
「Cloud 正常」
四粒綠燈長期佔位。

只有異常／重要狀態先升上第一層。

--------------------------------------------------
00.5｜TOP UTILITY DEGRADED STATE
--------------------------------------------------

例：

┌──────────────────────────────────────────────────────────────────────┐
│ 磨飯 · 2026-09-27  LOCAL READY  Cloud 離線  ⚠ 待處理 3      1111  ☰ │
└──────────────────────────────────────────────────────────────────────┘

意思：
- 本地仍可交易
- Cloud domain 有問題
- 有 3 項需跟進

禁止：
顯示一個紅色「SYSTEM OFFLINE」令員工以為唔可以落單。

--------------------------------------------------
00.6｜GLOBAL NEW ORDER ALERT
--------------------------------------------------

位置：
Top Utility 下方
Route Stage 上層
建議右上至中上

尺寸：
寬 520–620 px
高度按內容約 120–160 px

不使用全屏遮罩。

結構：

[新訂單到達，要處理]
#P034 · Keeta
剛剛到達 · 5 件

[立即處理] [30 秒後] [1 分鐘後]

Primary：
立即處理

Secondary：
30 秒後
1 分鐘後

場景：

A. Customer
Source 顯示「自家平台」

B. Keeta
Source 顯示「Keeta」

C. 多張新單
Header：
3 張新訂單待處理

顯示最舊一張：
#P034 · Keeta

Secondary：
查看全部 3 張

D. Snoozed
Alert 暫時收起。
Order 本身保持 pending。

E. Already handled
如果打開時 order 已處理：
顯示：
此訂單已經處理
[返回]

不再 Accept 第二次。

--------------------------------------------------
00.7｜GLOBAL ALERT Z-ORDER
--------------------------------------------------

由高至低：

1. Critical transaction modal
2. Payment / Formal Commit confirmation
3. Global New Order Alert
4. Attention Drawer
5. Route page
6. Shell

規則：
新單 Alert 不可以蓋住：
- Payment Confirm
- Cash keypad critical action
- Dining payment final confirmation

如果 Critical Modal 開啟：
Alert 可以縮成 Top Badge：
「1 張新單」

完成 critical action 後再展開。

--------------------------------------------------
00.8｜GLOBAL ATTENTION CENTER
--------------------------------------------------

形式：
右側 Drawer

建議：
寬 520 px
高度 100%
由右側滑入

不取代 Route Page。

Header：
待處理事項
3

Filter：
全部
交易
打印
平台
同步

每張 Attention Card：

[Severity] [Domain]
Title
Description
Impact / Next Step
Time

CTA：
查看
核對
處理

Technical Detail：
collapsed by default

--------------------------------------------------
00.9｜ATTENTION CARD EXAMPLES
--------------------------------------------------

Example A｜Print UNKNOWN

⚠ 打印 · 結果未能確認
#P032 · 廚房製作

訂單已成立，但系統無法確認廚房打印機有冇出紙。

請先檢查廚房打印機，避免重複打印。

[查看打印狀態]

Technical Detail ▾


Example B｜Payment Evidence

⚠ 付款 · 待核對
#P033 · FPS

客人已提交付款截圖，
仍未經店員確認。

[核對付款]


Example C｜Cloud Offline

i 同步 · Cloud 離線

本機交易仍可繼續。
目前使用最後有效設定。

[查看同步]

--------------------------------------------------
00.10｜ATTENTION PRIORITY
--------------------------------------------------

P0 Critical：
- Payment conflict
- duplicate-risk transaction ambiguity
- security/session invalid where action must stop

P1 Action Required：
- Print UNKNOWN
- Print FAILED
- Customer Payment Evidence
- Keeta Attention
- Config missing affecting action

P2 Information：
- Cloud Offline but LKG available
- Admin Sync pending
- non-blocking provider issue

排序：
P0 → P1 → P2
同級按 oldest unresolved first。

--------------------------------------------------
00.11｜STAFF MENU
--------------------------------------------------

Click Staff：

顯示：
- Staff Display Name
- Login ID
- Session status
- Logout

如果 current permission model需要：
可以顯示簡化角色名稱。

唔顯：
- permission raw codes
- internal staffId
- auth token
- UUID

--------------------------------------------------
00.12｜MORE / TOOLS MENU
--------------------------------------------------

由 Hamburger 開。

第一層：

營運工具

01 收銀與日結
02 報表
03 打印與設備
04 診斷
05 備份／恢復
06 Admin Sync

Future：
07 Cash In / Out

形式：
可用 Drawer / Large Menu。
唔需要 full-screen Dashboard。

關閉 More：
返回原本 Route，
原本 draft 保持。

--------------------------------------------------
00.13｜RESPONSIVE RULE｜1366×768
--------------------------------------------------

Left Rail：
72 px

Top Utility：
56 px

Route padding：
12 px

可縮：
- Gap
- Label spacing
- utility metadata
- icon spacing

不可：
- 將 Nav 搬去底部
- 將 Top Utility 搬位
- 將主要入口重新排序
- 隱藏 transaction Attention

--------------------------------------------------
00.14｜COMPONENT STATES
--------------------------------------------------

PrimaryNavItem：
- Default
- Hover
- Active
- Badge
- Disabled（只在真不可用時）

LocalRuntimeStatus：
- Ready
- Degraded
- Unknown

DomainStatus：
- Offline
- Degraded
- Unknown
- Hidden when normal

AttentionButton：
- Empty
- Info
- Action Required
- Critical

GlobalOrderAlert：
- Single
- Multiple
- Snoozed
- Already handled

AttentionDrawer：
- Empty
- Mixed
- Filtered
- Loading
- Error

--------------------------------------------------
00.15｜UI COPY RULES
--------------------------------------------------

前線第一層：

用：
「打印結果未能確認」
「付款待核對」
「Keeta 同步需要處理」
「目前使用最後有效設定」

不用：
PRINT_UNKNOWN
PAYMENT_EVIDENCE_PENDING
KEETA_CONFIRM_ATTENTION
ADMIN_LKG_ACTIVE

工程 code：
只入 Technical Detail。

--------------------------------------------------
00.16｜UI-STAGE-00 LOCKED DECISIONS
--------------------------------------------------

LOCK 00-01
Stage 名正式叫 UI-STAGE，不代表 Runtime Flow。

LOCK 00-02
主導航只有四個高頻入口：
點單／訂單／堂食／售罄產能。

LOCK 00-03
More 搬到 Top Hamburger。

LOCK 00-04
正常狀態唔排一列假綠燈。

LOCK 00-05
Global New Order Alert 不 auto accept。

LOCK 00-06
多張新單不可互相覆蓋。

LOCK 00-07
Critical transaction confirmation 比 New Order Alert 更高 z-index。

LOCK 00-08
需要跟進的異常進 Attention Center，不用短暫 Toast 代替。

LOCK 00-09
UNKNOWN 同 FAILED 永遠分開。

LOCK 00-10
LOCAL READY 不代表所有 Cloud / Provider / Printer 都正常。

LOCK 00-11
Staff 第一層不顯 internal identity。

LOCK 00-12
Shell 必須可承載 UI-STAGE-01～12，而唔需要重新改骨架。

--------------------------------------------------
UI-STAGE-00 CURRENT STATUS
--------------------------------------------------

INFORMATION ARCHITECTURE：
LOCKED FOR DRAFT

TEXT WIREFRAME：
DEFINED

VISUAL LAYOUT SPEC：
DEFINED

HIGH-FIDELITY MOCKUP：
NOT STARTED

OWNER VISUAL ACCEPTANCE：
PENDING

NEXT：
UI-STAGE-00 Visual Draft / Mockup
（仍然只畫 Shell、Nav、Global Alert、Attention；不提前畫 Ordering 細節）

MILESTONE：
MFK_SMT_UI_STAGE00_VISUAL_LAYOUT_SPEC_READY


==================================================
RECORD 006｜GOOGLE DRIVE STAGE LINK-UP 架構建立
日期：2026-09-27
狀態：ACTIVE
==================================================

目的：
將 MFK SMT FULL UI SPEC 由單一長文件，升級成「Master + Stage Folder + Stage SPEC + Stage Visual」可逐階段接手的 Google Drive 結構。

ROOT FOLDER：
MFK SMT FULL UI SPEC｜STAGE 00-12｜2026-09-27
https://drive.google.com/drive/folders/1DrIrcgBZ4iCOcZFmfHEVK7_yIKubtoMX

ROOT 內：
00_MASTER｜MFK SMT UI 設計實作總記錄｜WORKING MASTER
https://docs.google.com/document/d/1rIdaKX0HSsCoJZJ9vBF68Amh1ZTpljMs0bjXzysEzu4/edit?usp=drivesdk

01_INDEX｜MFK SMT FULL UI SPEC｜Stage Link Map
https://docs.google.com/document/d/1vuRCP1gWBH2aj41enK-l8kUsf8bJylv1-xTTH2mc4Kg/edit?usp=drivesdk

每個 Stage Folder 固定結構：
1. Stage SPEC Google Doc
2. Stage Visual / Mockup 效果圖
3. 如需要：狀態圖、Modal 圖、補充 Flow 圖
4. Stage Acceptance / 最終確認記錄可繼續放同一 Folder

Stage Link：
UI-STAGE-00：
Folder https://drive.google.com/drive/folders/1v7-mhZiQ8B8N4dO7WoK70l0nb2wYyNGW
SPEC https://docs.google.com/document/d/1R3Hfv6fm1ade0cZmkBg6W7CgjFx0WGDrgMcBOrtmCZc/edit?usp=drivesdk

UI-STAGE-01：
Folder https://drive.google.com/drive/folders/1MzN50qW3oeyws-a4yO04KGi0bbmfsvjt
SPEC https://docs.google.com/document/d/1NIdjB5DJfrWbU--rt_Je6qSU3AAwisg86PNpussPodc/edit?usp=drivesdk

UI-STAGE-02：
Folder https://drive.google.com/drive/folders/1SSJIN54nytQ4l8e5bXitnp0zXvSqJOj7
SPEC https://docs.google.com/document/d/1fOOxFbDOyVUdZ85efZp1tBmLSAyqC61u9npE-wjF1gY/edit?usp=drivesdk

UI-STAGE-03：
Folder https://drive.google.com/drive/folders/1DkaR1T1iuztTor7o4S1O2B0UDOnN9DZr
SPEC https://docs.google.com/document/d/12hrXhTGAoC7v-ujVv4NFzbzjLLPCoEUKPKHMOD2wqGA/edit?usp=drivesdk

UI-STAGE-04：
Folder https://drive.google.com/drive/folders/1tbfI-e0NxCYxQEK_l3SCmxKlNOSEXqxO
SPEC https://docs.google.com/document/d/1uDRfilJ6pnAKvwV-lW7NveGxAzYw4STw7BE5apynu3E/edit?usp=drivesdk

UI-STAGE-05：
Folder https://drive.google.com/drive/folders/12huwUGpxjFPTURsbl4XTC0-l81kPVVCk
SPEC https://docs.google.com/document/d/11z5Udov4P95KgqmjtKteBNlcqd7Apqr6_MjzEi653xU/edit?usp=drivesdk

UI-STAGE-06：
Folder https://drive.google.com/drive/folders/16JFH7mUBeNcFnloLrrnqI1G-Cz9jjNCn
SPEC https://docs.google.com/document/d/1QfAdqZsXky8xQAtOYM3N9KgQ3ifFB8lh-D8dwB9EWhI/edit?usp=drivesdk

UI-STAGE-07：
Folder https://drive.google.com/drive/folders/1ohm_2FEBg-AWxbsYW6GH9GnyAYIckY9-
SPEC https://docs.google.com/document/d/1mQTPFwUgJW28aPXbDIr19o5jzV0XQlm-ev860WcY8C0/edit?usp=drivesdk

UI-STAGE-08：
Folder https://drive.google.com/drive/folders/1jWdGZr4zKipss1gnaZHtCl_5Xc8l8RCf
SPEC https://docs.google.com/document/d/140BUQzEOzJMO2onYGT4g-uFYVsEjIQdOyo-QRnbB9OQ/edit?usp=drivesdk

UI-STAGE-09：
Folder https://drive.google.com/drive/folders/16aIrXOTuY9ejiN_ZdUIJjkv9WD5DMMDo
SPEC https://docs.google.com/document/d/1wmkc3LDQpWZrj4wZUNURHrCUIFcsbEPiVc5MwGt_8Ec/edit?usp=drivesdk

UI-STAGE-10：
Folder https://drive.google.com/drive/folders/1QBUC-Tt3VX5gg9C0Vmg4yAeOEb9qu3GU
SPEC https://docs.google.com/document/d/1WoomFTlHI3lPoJbQQb8LqPJKWMt3WJQm9J0S01HfF3w/edit?usp=drivesdk

UI-STAGE-11：
Folder https://drive.google.com/drive/folders/14uep_6C4Rylw73y5Htj2jpj0fMek9jkX
SPEC https://docs.google.com/document/d/15GX-3zxevRdKOIbtJZT8L65y1M71lcHVk6808Q09Stk/edit?usp=drivesdk

UI-STAGE-12：
Folder https://drive.google.com/drive/folders/1AipY2YZD-1Lymtdsglh1xL3vasn6hkAR
SPEC https://docs.google.com/document/d/10us9YNTR0i4wm7oU_I6fmmV35WJtnmM2K86LFhPsmPQ/edit?usp=drivesdk

LINK-UP RULE：
Working Master
→ Stage Folder
→ Stage SPEC
→ Stage Visual(s)
→ Stage Acceptance

每完成一個 Stage：
- 設計圖上載到該 Stage Folder
- Stage SPEC 補 Visual Link
- 01_INDEX 補 Visual Link
- Working Master 記錄設計決定與 Acceptance
- 再進下一 Stage

CURRENT：
UI-STAGE-00 SPEC 已存在。
UI-STAGE-00 Visual = PENDING。

NEXT：
生成 UI-STAGE-00 第一張 Visual Draft，完成後放入 UI-STAGE-00 Folder，並回填 Stage SPEC + 01_INDEX。

MILESTONE：
MFK_SMT_GOOGLE_DRIVE_STAGE_LINKUP_STRUCTURE_READY


RECORD 007｜UI-STAGE-00 VISUAL DRAFT LINK-UP


==================================================
VISUAL UPDATE｜UI-STAGE-00
日期：2026-09-27
==================================================

第一張自動生成 Visual Draft 因違反已鎖定 Stage 0 規格，已正式標記：
REJECTED-VISUAL-DRAFT-01

拒絕原因：
- 左 Rail 出現 More／更多
- 正常狀態排出多個綠燈／domain health
- 主色偏離 Primary Blue system
- 提前畫入 Ordering / Hero / Product content
- Stage 0 應只驗證 Shell / Navigation / Global Layer

合規 Visual Draft 02 已拆成三張：

02A｜DEFAULT SHELL
https://drive.google.com/file/d/1d0ZXacfW2TpKgQnVKtsFny4nnX16XN-p/view?usp=drivesdk

02B｜NEW ORDER ALERT
https://drive.google.com/file/d/1xPKlgx4_ldBvLJosjiLYFDBRLRFoqC_d/view?usp=drivesdk

02C｜ATTENTION CENTER
https://drive.google.com/file/d/1gtjiOLga4NSgMHgpBr2-JLJdc9kYs81I/view?usp=drivesdk

REJECTED DRAFT 01：
https://drive.google.com/file/d/1WaqDfbBn5o2fArVouaBg3CLhyqHnFfT9/view?usp=drivesdk

Visual Draft 02 狀態：
CANDIDATE FOR OWNER REVIEW
NOT ACCEPTED YET

Visual Link-up：
UI-STAGE-00 SPEC
→ 02A Default
→ 02B New Order Alert
→ 02C Attention Center
→ Owner Review
→ Acceptance / Rework


==================================================
RECORD 007｜OWNER CORRECTION｜UI-STAGE-00 = 首頁 / SHELL，不是點單頁
日期：2026-09-27
狀態：LOCKED
==================================================

Owner 明確要求：

如果目前 UI-STAGE-00 畫面被定義成「首頁」，方向可以接受。
如果被定義成「點單頁」，方向不接受。

原因：
前線點單係最高頻操作。
如果員工已經按「點單」進入點單頁，之後仲要再按一次「開始點單」，等於每張單都多一次無價值 click，會直接拖慢高峰期操作。

正式鎖定：

LOCK 00-13
UI-STAGE-00 定義為：
「首頁 / Shell / Global Layer」

佢可以包含：
- 系統首頁
- 四個高頻導航入口
- Top Utility
- Global New Order Alert
- Global Attention
- Staff
- More / Tools
- 營業／Local 狀態

但唔係正式 Ordering Workspace。

LOCK 00-14
UI-STAGE-01 才係真正「點單頁 / Ordering Main」。

由任何地方按左側「點單」：
→ 直接進 UI-STAGE-01 Ordering Main
→ 即時看到 Category + Product Grid + Cart + Fast Lane
→ 可以即刻選商品

禁止：
點單
→ 開始點單
→ 再進商品頁

即：
NO SECONDARY START-ORDER GATE

LOCK 00-15
UI-STAGE-01 不設「開始點單」大卡作為必要前置操作。
只要進入點單頁，就已經係可直接落單狀態。

LOCK 00-16
UI-STAGE-00 首頁上的「開始點單」可以存在，因為佢係由首頁進入 Ordering 的捷徑。
但一旦進入 UI-STAGE-01，就唔再出現第二個「開始點單」。

LOCK 00-17
UI-STAGE-00 Visual Draft 中，如果左側「點單」已被標示 Active，而中央又出現「開始點單」大卡，語義會令人誤會目前已經身處 Ordering Page。
呢個視覺語義正式判定為：
REJECTED AS ORDERING PAGE
ACCEPTABLE ONLY AS HOME PAGE CONCEPT

後續 Visual Draft 修正：
- UI-STAGE-00 畫面標題要清楚寫「首頁」
- 左側點單不可同時用「已進入點單頁」語義
- 首頁可有「開始點單」快捷卡
- 點擊後直接去 UI-STAGE-01
- UI-STAGE-01 第一幀即係完整 POS 點單工作台

==================================================
ROUTE RULE
==================================================

HOME：
UI-STAGE-00

按「點單」
↓
UI-STAGE-01 Ordering Main

UI-STAGE-01 第一幀：
- Pending Customer / Keeta
- Quick / Normal
- Category
- Product Grid
- Fast Lane
- Right Cart
- 暫存／堂食
- Checkout

不再有：
「開始點單」

==================================================
VISUAL STATUS
==================================================

UI-STAGE-00 Visual Draft v1：
REJECTED if interpreted as Ordering Page
CONDITIONALLY ACCEPTED as Home Page direction

下一版要求：
UI-STAGE-00 HOME Visual Draft v2
+
UI-STAGE-01 Ordering Main Visual Draft v1
必須清楚分開。

MILESTONE：
MFK_SMT_UI_STAGE00_HOME_STAGE01_DIRECT_ORDERING_LOCKED


==================================================
RECORD 008｜OWNER STAGE DEFINITION CORRECTION
日期：2026-09-27
狀態：LOCKED
==================================================

Owner 對「UI-STAGE」嘅真正定義正式修正：

Stage 係一段完整、可被員工實際經歷的操作旅程，
唔只係一個頁面分類／文件章節。

因此：

UI-STAGE-00
正式由原本「Home / Shell / Global Layer」
擴充為：

STARTUP / LOGIN / OPENING CASH / HOME

即：
品牌啟動
→ Login
→ First Login / 首次登入分支（如適用）
→ 前一營業日留底現金 Readback
→ 今日開更現金確認
→ 補錢 / 拎走 / 修改
→ Opening Cash Confirm
→ Home / Shell

原本已畫／已定義嘅 Home Shell 唔作廢，
而係變成 UI-STAGE-00 最後一個畫面：
「00.7 Home / Shell」。

==================================================
UI-STAGE-00｜STARTUP / LOGIN / OPENING CASH / HOME
==================================================

Stage Goal：
員工由「未進入 SMT」
一路完成身份確認、開更現金確認，
最後進入可正式營業的 Home / Shell。

呢個 Stage 必須做到：
1. 開機第一眼有品牌身份。
2. Login 快。
3. 首次登入／普通登入分支清楚。
4. 今日開更唔要求員工重新猜 opening cash。
5. 自動顯示上一營業日有冇留底現金。
6. 顯示上一日留低幾多。
7. 顯示上一日有冇拎走現金。
8. 顯示今日有冇補入現金。
9. 員工可以核對、修改。
10. 任何補入／拎走要有清楚記錄。
11. Confirm Opening 後先進 Home。
12. Home 再直接一按進 Ordering，唔再有第二個「開始點單」Gate。

--------------------------------------------------
00.0｜BRAND SPLASH / BOOT
--------------------------------------------------

用途：
SMT 啟動第一幀。

畫面：
- 磨飯正式 Logo
- 品牌背景色／暖米白
- 可使用品牌 IP
- 簡短品牌識別
- Loading / Local Runtime Boot 狀態

唔應：
- 一開機就顯示工程 Log
- 顯示 UUID
- 長時間停在品牌動畫

狀態：
UI_REWORK / BRAND VISUAL

--------------------------------------------------
00.1｜LOGIN
--------------------------------------------------

內容：
- Logo / Brand
- 員工編號
- PIN
- Login
- 錯誤提示
- Offline login availability（按 current auth reality）

使用場景：
- 正常登入
- PIN 錯
- Staff disabled
- Session expired
- Local available / Cloud unavailable

原則：
Login 要快。
唔做 Consumer App 式 Welcome tour。

--------------------------------------------------
00.2｜FIRST LOGIN / FIRST DEVICE BRANCH
--------------------------------------------------

只在需要時出現。

用途：
處理第一次正式使用此 SMT／可信裝置／首次 staff setup 相關流程。

如果 current runtime 無需額外 first-login step：
直接跳去 Opening Cash。

禁止：
每次登入都重播 First Login。

--------------------------------------------------
00.3｜PREVIOUS BUSINESS DAY CASH READBACK
--------------------------------------------------

用途：
員工唔需要靠記憶填今日 opening float。

畫面必須清楚顯示：

上一營業日：
YYYY-MM-DD

昨日 Day Close：
- Closing Cash / Counted
- 昨日拎走現金
- 昨日留底現金
- 是否已完成 Day Close
- 資料來源／時間

核心問題：
「琴日有冇留低錢？」
「留低幾多？」

如果有：
顯示：
昨日留底 HK$____

如果無：
顯示：
昨日沒有留底現金

如果上一營業日資料未完整：
顯示 Exception，
唔好自動當 $0。

--------------------------------------------------
00.4｜OPENING CASH REVIEW
--------------------------------------------------

今日建議 Opening Cash：

上一營業日留底
+ 今日開舖前補入
- 今日開舖前拎走
= 建議開櫃金

畫面例：

昨日留底              HK$1,000
今日補入              HK$0
今日拎走              HK$0
--------------------------------
建議開櫃金            HK$1,000

實際開櫃金            HK$1,000

差異                  HK$0

主要操作：
[確認開更]

Secondary：
[修改]

--------------------------------------------------
00.5｜OPENING CASH ADJUSTMENT
--------------------------------------------------

按「修改」後先進。

可以處理：

A. 補入現金
例：
今日補入 HK$500

B. 拎走現金
例：
開舖前拎走 HK$200

C. 實際點算不同
例：
系統預期 $1,000
實際只有 $980

每個 Adjustment：
- Type
- Amount
- Reason
- Actor
- Time

唔可以：
直接改總數而完全冇 audit meaning。

--------------------------------------------------
00.6｜OPENING CONFIRMATION
--------------------------------------------------

Final Review：

上一日留底          HK$____
今日補入            HK$____
今日拎走            HK$____
實際 Opening Cash   HK$____
差異                HK$____

CTA：
確認開更

Confirm 後：
建立／確認今日 Cash Shift Opening State。

完成後：
→ 00.7 Home / Shell

--------------------------------------------------
00.7｜HOME / SHELL
--------------------------------------------------

呢個就係之前接受的「首頁」方向。

首頁可以有：
- Logo / 品牌
- 簡潔背景
- 少量 IP
- 點單快捷入口
- 訂單
- 堂食
- 售罄／產能
- Top Utility
- Global Alert
- Global Attention
- Staff
- More

但：

按「點單」
→ 直接入 UI-STAGE-01 Ordering Main。

禁止：
點單 → 開始點單 → 再入商品頁。

--------------------------------------------------
UI-STAGE-00 核心資料模型（UI 層）
--------------------------------------------------

UI 至少要識表達：

previousBusinessDate
previousCloseStatus
previousCountedCash
previousCashRemoved
previousRetainedCash

todayCashIn
todayCashOut
expectedOpeningCash
actualOpeningCash
openingVariance

actor
confirmedAt
provenance / source summary

注意：
UI 命名可以人類化，
唔需要直接顯示 raw field name。

--------------------------------------------------
UI-STAGE-00 SCENARIOS
--------------------------------------------------

S00-A｜正常 carry-forward
昨日留底 $1,000
今日無補無拎
實際 $1,000
→ 一按確認開更

S00-B｜今日補錢
昨日留底 $1,000
今日補 $500
Opening = $1,500

S00-C｜開舖前拎走
昨日留底 $1,000
今日拎走 $200
Opening = $800

S00-D｜有補又有拎
昨日留底 $1,000
補 $500
拎 $200
Opening = $1,300

S00-E｜實際點算有差異
Expected $1,000
Actual $980
Variance -$20
→ 要求 reason / audit

S00-F｜昨日無留底
Previous retained = $0
今日人工輸入 opening float

S00-G｜昨日 Day Close 未完整
不可假設 retained = 0
顯示 exception / review required

S00-H｜First ever business day
無 previous business day
顯示：
「沒有上一營業日記錄」
→ 手動設定 Opening Cash

--------------------------------------------------
UI-STAGE-00 LOCKED ROUTE
--------------------------------------------------

BOOT / SPLASH
↓
LOGIN
↓
FIRST LOGIN（conditional）
↓
PREVIOUS CASH READBACK
↓
OPENING CASH REVIEW
↓
ADJUSTMENT（optional）
↓
OPENING CONFIRM
↓
HOME / SHELL
↓
點單
↓
UI-STAGE-01 ORDERING MAIN

MILESTONE：
MFK_SMT_UI_STAGE00_STARTUP_OPENING_CASH_OWNER_DEFINITION_LOCKED


==================================================
RECORD 009｜OWNER CORRECTION｜取消 Home Page
日期：2026-09-27
狀態：LOCKED / SUPERSEDES PRIOR HOME CONCEPT
==================================================

Owner 最新定義：

MFK SMT 係前線 Operation System。
核心目標係速度。
因此不需要一個獨立「首頁／Home Page」作為 Opening Cash 完成後的中轉頁。

之前提出：
Opening Cash
→ Home
→ 點單
→ Ordering

正式取消。

新流程：

BOOT / LOADING VISUAL
↓
LOGIN
↓
FIRST LOGIN（conditional）
↓
PREVIOUS BUSINESS DAY CASH READBACK
↓
OPENING CASH REVIEW
↓
OPENING CASH ADJUSTMENT（optional）
↓
OPENING CONFIRM
↓
DIRECT TO UI-STAGE-01 ORDERING MAIN

==================================================
BOOT / LOADING VISUAL 的真正用途
==================================================

呢個畫面唔係「首頁」。

佢係：
系統開機／載入期間的品牌視覺承載層。

當 SMT 正在：
- 啟動 Local Runtime
- 讀取 Menu / Admin LKG
- 讀取 Business Day
- 讀取上一營業日 Cash State
- 讀取 Printer / Device 基礎狀態
- 做必要 Startup Readback

與其畀員工見到空白畫面，
使用：
- 磨飯 Logo
- 品牌背景色
- 可選品牌 IP
- 短動畫
- 必要 Loading 狀態

但：
一完成必要資料讀取，
就進下一個真正操作畫面。
唔停留喺品牌頁。

==================================================
GLOBAL SHELL 的重新定位
==================================================

Shell / Navigation / Global Alert / Attention
仍然係全 SMT 共用 UI 基礎。

但佢唔再係一個獨立「Home Page」。

即：

Shell = Persistent UI Frame
Home = REMOVED

完成 Opening Confirm 後：
直接載入 Shell + UI-STAGE-01 Ordering Main。

員工第一個正式營業工作畫面：
就係點單頁。

==================================================
UI-STAGE-00 正式範圍
==================================================

00.0 Boot / Loading Brand Visual
00.1 Login
00.2 First Login / First Device（conditional）
00.3 Previous Business Day Cash Readback
00.4 Opening Cash Review
00.5 Opening Cash Adjustment
00.6 Opening Confirmation

Stage 0 到此結束。

之後：
UI-STAGE-01 Ordering Main

==================================================
REMOVED
==================================================

REMOVED：
- 獨立 Home Page
- 「開始點單」快捷卡
- Opening Confirm 後再多一次「點單」導航
- 任何純中轉頁
- 空白等待頁

SUPERSEDED：
之前 Stage 0 Home / Shell 視覺概念。

Shell 本身保留，
但變成所有正式工作頁共用 Frame，
唔係一個 Route。

==================================================
PERFORMANCE PRINCIPLE
==================================================

每一次固定多出一個 Click，
如果每日做 100 單，
就係每日多 100 次無價值操作。

所以：
只要一個畫面唔提供必要 decision / information / action，
就唔應該獨立存在。

Boot Visual 有存在價值：
因為本身需要等待系統讀資料。

Opening Cash 有存在價值：
因為每日開更要核對現金。

Home Page 無存在價值：
因為唔提供必要營運決策，
只增加一次跳轉。

==================================================
FINAL ROUTE
==================================================

App Start
→ Boot Animation / Startup Read
→ Login
→ First Login（conditional）
→ Previous Cash
→ Opening Cash Review
→ Adjustment（optional）
→ Confirm Opening
→ Ordering Main

MILESTONE：
MFK_SMT_NO_HOME_DIRECT_OPERATION_FLOW_LOCKED


==================================================
RECORD 010｜UI-STAGE-00 VISUAL PACK R1 GENERATED
日期：2026-09-27
狀態：OWNER REVIEW PENDING
==================================================

已產生並放入 Stage 00 Folder：
- Boot / Loading
- Login
- Opening Cash Review
- Opening Confirm
- Visual Overview

Visual Links：
Boot https://drive.google.com/file/d/1Lk1H9LVgJF26AKK8C0N_XzFp3pzt4Dyt/view?usp=drivesdk
Login https://drive.google.com/file/d/1eDQelCxwnyWB_8TXD7h3DR-tp6R63_zr/view?usp=drivesdk
Opening Cash Review https://drive.google.com/file/d/1Gyi3bsLSYUSF3hxfqBB4SEkYMSrhwXcP/view?usp=drivesdk
Opening Confirm https://drive.google.com/file/d/12l_C7Vlw1d81sMJ1PVtt3byKKLYmQje1/view?usp=drivesdk
Overview https://drive.google.com/file/d/1SYZpn-V92zBunM2men2yh9Gey9SFlHcz/view?usp=drivesdk

舊 Home/Shell Visual：
已標 SUPERSEDED / REJECTED，不再作 Stage 00 current visual authority。

NEXT：
Owner review Stage 00 visuals。
