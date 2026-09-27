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
