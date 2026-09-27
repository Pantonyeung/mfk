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
