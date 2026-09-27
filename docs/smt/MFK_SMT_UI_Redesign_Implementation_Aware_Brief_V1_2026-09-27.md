# MFK SMT UI Redesign Brief｜Owner Requirements × Current Implementation

版本：V1  
日期：2026-09-27  
用途：重新繪製 SMT UI  
Repo：Pantonyeung/mfk  
Current main：c2d5b016fe3dd08d276e915ae0f0fb2301e964cf  
產品要求來源：
- Owner_對_SMT_端口要求_FINAL_V1.0
- Owner_SMT_Requirements_Working_V2.5
- smt優化ui 2026-09-25
實作來源：
- current mfk main / v2local/**
- current runtime / presentation / checkout / dining / soldout / print / day-close source

---

## 0. 呢份 Brief 解決咩問題

呢份文件唔係用 Owner 要求去推翻現有 SMT。

規則係：

1. Current main 已實作而且已形成正式 transaction semantics 的能力，全部保留。
2. Owner FINAL 用來檢查「原本個人要求有冇做晒」。
3. 如果 Owner 要求同現有實作不同：
   - 標記「已做但不同」
   - UI 重畫以 current implementation 為準
   - 唔因重畫 UI 而偷偷修改 runtime / money / order / print semantics。
4. 未做的 Owner requirement：
   - 明確列為 Gap
   - 唔可以畫成好似已經可操作
   - 可以在新 UI 規劃中預留位置／狀態。
5. 軟件有實作但未做真機驗收：
   - 標記「軟件完成／實機待驗」
   - UI 可以設計，但不可宣稱 physical acceptance 完成。

狀態分類：

- 【已做｜鎖定】Current main 已有，UI 必須保留。
- 【已做但不同｜現行優先】Owner 原要求與 current main 不一致；重畫 UI 跟現行能力。
- 【部分完成】已有一部分，但未完整覆蓋 Owner 要求。
- 【未做】Current main 未見可用實作。
- 【軟件完成／實機待驗】程式已有，但真機／物理證據未完整關閉。

---

# 1. 產品核心｜已做，禁止推翻

## 1.1 SMT 定位
狀態：【已做｜鎖定】

Current：
- 1920×1080 Local-First POS
- 點單
- Checkout
- Formal Order
- Payment
- Orders
- Dining
- Availability / Capacity
- Print
- Day Close
- Reports
- Backup / Restore
- Staff Session
- Customer / Keeta Intake

UI 重畫規則：
- 不建立第二 Order / Pricing / Payment / Print / Store Kernel。
- 不將 Cloud 變成本地交易必要條件。
- 不因畫面重構改 transaction boundary。

---

# 2. 主導航／整體 UI

## 2.1 高頻導航
Owner Target：
- 點單
- 訂單
- 堂食
- 售罄／產能
- 更多移到上方漢堡

Current：
- 左 Rail 仍然係：
  - 點餐
  - 訂單
  - 堂食
  - 售罄
  - 更多

狀態：【部分完成】

UI Redesign：
- 可以將「更多」入口搬去頂部漢堡，仍然進現有 /more route。
- 不改 More 內部 runtime。
- 主導航保留四個高頻區。

## 2.2 介面設定
Owner Target：
- Category rows / columns
- Product rows / columns
- 圖片顯示
- Font Scale
- UI Density / Size
- 即時 Preview
- Restart 保留

Current：
已存在：
- showImages
- showDescriptions
- tabletColumns / mobileColumns
- Admin frontline presentation projection

未完整見到：
- Category rows / columns 自由設定
- Font Scale
- 全介面 continuous density control
- 完整本地 UI 設定面板

狀態：【部分完成】

UI Redesign：
- Product Grid 要接受動態 columns。
- 圖片／描述要可隱藏。
- 未接上的 Font / Density controls 不可畫成已可用正式功能。

## 2.3 75% Modal
Owner Target：
主要操作 Modal 約 75%，底部 CTA 固定。

Current：
- Dining Price Override / Dining Reprint 已有 75vw × 75vh。
- Ordering 多個 Workspace 已有 sticky bottom action。
- 但唔係全部主要操作都統一成同一套 75% modal contract。

狀態：【部分完成】

UI Redesign：
- 視覺可以統一 75% modal shell。
- 不改 modal 入面原有 business action。

---

# 3. 點單頁｜待處理與外部訂單

## 3.1 Customer Pending
Owner Target：
Customer order 先進待處理；人工核對；接受後先正式處理。

Current：
- Customer Pending 已接入 SMT。
- Pending Order Review 已存在。
- Customer 新單有 global arrival alert。
- acceptOrder 會保持正式本地流程。

狀態：【已做｜鎖定】

UI 必須保留：
- Customer source identity
- Pending state
- Accept action
- global arrival attention

## 3.2 Customer Payment Evidence
Owner Target：
Screenshot = Evidence，不等於 Paid；可放大；人工 VERIFIED / REJECTED。

Current：
- paymentEvidenceRef
- PENDING / VERIFIED / REJECTED
- 圖片讀取／放大
- 未 VERIFIED 時 Accept disabled

狀態：【已做｜鎖定】

UI 必須清楚分：
- 有付款圖
- 已人工確認付款
兩件事。

## 3.3 WhatsApp Payment Follow-up QR
Owner Target：
錯日期／時間／金額／模糊時，可 QR 聯絡客戶。

Current：
- WhatsApp follow-up template
- QR generation
- 對應 customerPhone
- 預填訊息
- 店員最後自行 Send

狀態：【已做｜鎖定】

## 3.4 Keeta Auto / Manual
Owner Target：
Admin 或 SMT 可設自動／手動接單。

Current：
- Keeta autoAccept policy 已存在。
- autoAccept=true 時可以自動 accept。
- 手動 accept 已存在。
- SMT UI 有手動「接 Keeta 新單」與 Pending 處理。
- 但 current SMT 未見一個完整「Auto / Manual Mode」本機設定開關。

狀態：【部分完成】

UI Redesign：
- 可以顯示目前 mode。
- 如果未有 mutation seam，唔好畫成可以切換的 active toggle。

## 3.5 Keeta 稍後處理
Owner Target：
最多 2 次；保持 attention。

Current：
- deferKeetaOrder
- deferCount
- 第 3 次 fail closed
- Pending banner
- arrival alert / sound

狀態：【已做｜鎖定】

---

# 4. ETA／截單／客戶端接單控制

## 4.1 ETA 負荷
Owner Target：
以「未去到可取餐」活躍單量 → Admin threshold → ETA minutes。

Current：
- Admin storeSettings 有 fulfillmentMinutes。
- Orders UI 顯示 Admin 出餐計時。
- active order count 有計。
- 未見完整「多段負荷 threshold → ETA 分鐘」模型。
- 未見正式自動 countdown 到點即 Ready。

狀態：【部分完成】

UI Redesign：
- 可顯示 current fulfillmentMinutes。
- 唔好假裝已有多段 ETA engine／自動倒數。

## 4.2 Customer 特別截單／即時停止
Owner Target：
SMT 可設今日截單時間／立即暫停 Customer 新單。

Current：
- Current SMT source 未見完整本機 cutoff / pause Customer order control surface。

狀態：【未做】

UI Redesign：
- 可預留「Customer 接單狀態」位置。
- 未落 runtime 前唔可以畫成 active control。

---

# 5. Cart／點單操作

## 5.1 獨立 Cart Unit
Owner Target：
每件保持獨立，Combine 預設 OFF。

Current：
- 每條 line 有獨立 identity。
- combineSimilar default=false。
- Combine 只係 presentation grouping。

狀態：【已做｜鎖定】

## 5.2 SAME Line Edit
Owner Target：
Edit ≠ Add。

Current：
- Cart line edit 會帶 lineId。
- 修改原 line。
- 唔新增第二行。

狀態：【已做｜鎖定】

## 5.3 整單堂／外＋逐行堂／外
Current：
- 整單 setServiceMode。
- 每 line 可獨立改 serviceMode。

狀態：【已做｜鎖定】

## 5.4 原單／整理
Owner Target：
整理 = 按 Product Category 排序。

Current：
- 有 original / organized mode。
- 但「整理」目前會開 OrganizeWorkspace，內容包含必選／配對／補選工作流。
- 唔等於單純 Category Sort。

狀態：【已做但不同｜現行優先】

UI Redesign：
- 不可將 current「整理」畫成純排序掣，否則 UI 會欺騙實際行為。
- 若之後要補 Category Sort，另開 product gap。
- 目前要保留「整理工作台」的真實能力。

## 5.5 Cart 流水號 Preview
Current：
- 未正式成交前顯示 next display preview。
- Formal Order 仍在正式提交時建立。

狀態：【已做｜鎖定】

---

# 6. 快捷模式／Required／套餐

## 6.1 Quick / Normal
Current：
- Quick
- Normal
- Quick mode 可以先收未完成 Required item。
- Required 未完成時 Checkout disabled。

狀態：【已做｜鎖定】

## 6.2 Required Fast Lane
Current：
- RequiredFastLaneWorkspace 已存在。
- Consume current Option / Required semantics。

狀態：【已做｜鎖定】

## 6.3 Quick Drink
Current：
- Drink supplement flow 已存在。
- 可針對 target line 補飲品。

狀態：【已做｜鎖定】

## 6.4 飯團快速配對
Current：
- Riceball Pairing Workspace
- Pairing identity
- restore pairing
- drink supplement integration

狀態：【已做｜鎖定】

## 6.5 紫米套餐／Combo
Current：
- Admin canonical combo / pool / child
- required group
- price adjustment
- Add to Cart
- no second Combo Engine

狀態：【已做｜鎖定】

---

# 7. 暫存／堂食入口

Owner Target：
All Takeaway → 預設暫存  
Any Dine-in → 預設堂食  
人可以 Override。

Current：
- initialHoldModeForLines()
- Hold / Dining 兩個 concept 同一 workspace
- waiting / queue / table
- cart 可取回
- 清除訂單降低權重

狀態：【已做｜鎖定】

UI Redesign：
呢個 mindset 唔可以再拆返多一層「暫存 → 掛堂食」。

---

# 8. Product Detail / Config

Owner Target：
75% modal、左 option、右 summary、底固定 CTA。

Current：
- Product config flow 已存在。
- Required / option / note / qty / price 都有。
- SAME-line edit 已成立。
- Bottom action sticky。
- 但全系統 geometry 未完全統一 75%。

狀態：【部分完成】

UI Redesign：
可以重畫成統一 modal shell，但所有 field / selection identity 保留。

---

# 9. Checkout

## 9.1 Checkout Base
Current：
- Source
- Payment
- Settlement
- Fixed keypad
- Cash received / change
- COMBO split tender
- Completion Review
- Formal order creation only on confirm

狀態：【已做｜鎖定】

## 9.2 Channel
Owner Target：
現場、電話、WhatsApp、自家平台、Foodpanda、Keeta。

Current：
- walk-in
- 電話／WhatsApp 合併
- MoreFun App
- Foodpanda
- Keeta

狀態：【已做但不同｜現行優先】

UI Redesign：
電話／WhatsApp 暫時視為一個 current channel。
唔可以為咗配 Owner 舊文字拆成兩個 runtime channel。

## 9.3 Payment Methods
Owner Target：
由 Admin 統一增減 payment methods。

Current：
Checkout methods 目前 code 直接列：
- CASH
- FPS
- PAYME
- ALIPAY
- WECHAT
- COMBO

Store settings 雖有 paymentRefs，但 Checkout 呢段未完全改成 dynamic source。

狀態：【部分完成】

UI Redesign：
畫現有 6 種。
Future dynamic method 用設計預留，不當已完成。

## 9.4 Quick Cash
Owner Target：
$20 / $50 / $100 / $200 / $500 / Exact

Current：
- $50
- $100
- $200
- $500
- Exact
- 未見 $20 quick button

狀態：【部分完成】

## 9.5 Student Discount
Owner Target：
Student Count、eligible special drink half price、manual / auto、auto most expensive first。

Current：
- Checkout 有「學生優惠」按鈕
- 目前 disabled
- 未見正式 discount runtime

狀態：【未做】

UI Redesign：
- 可以預留位置
- 必須標 Future / Disabled
- 唔可以當可操作功能。

## 9.6 Pre-payment Final Review
Owner Target：
付款前 75% Final Review，最後 Confirm 先成交。

Current：
- Confirm button 直接進正式 commit。
- 成交後有 Completion Review。
- 未見獨立「付款前 75% Final Review」一步。

狀態：【未做／核心 Commit 已做】

UI Redesign：
- Current transaction boundary 必須保留。
- 如果只重畫 UI 而唔改 runtime，就唔可以多畫一個會改 commit semantics 的 active step。
- 可先畫作 future state / pending wiring。

---

# 10. Orders

## 10.1 三來源 Lane
Current：
- 現場
- 自家平台
- 第三方

狀態：【已做｜鎖定】

## 10.2 Payment Evidence / Keeta Attention / After-sale
Current：
- Payment Evidence
- Keeta pending
- Keeta manual reconcile
- Keeta after-sale preview / decision

狀態：【已做｜鎖定】

## 10.3 Reprint
Current：
- Order detail 入 Reprint
- selected jobs
- Label grouped route
- manual reason
- reprint drawer suppressed

狀態：【已做｜鎖定】

## 10.4 Fulfillment
Owner Target：
未完成 → 可取餐 → 已取餐  
可取餐可退回未完成。

Current：
- markOrderReady() 有。
- Orders UI 有「提前完成／可取餐」。
- 未見「可取餐 → 未完成」本機操作。
- 未見一般本地單獨立「已取餐」按鈕。
- ETA auto-ready 未完整實作。

狀態：【部分完成】

## 10.5 修改正式 Order
Owner Target：
修改 → 通知 Customer → Customer 確認 → 金額差做補／退款。

Current：
- updateOrderItems() 可修改 SAME Order。
- 不自動 reprint。
- 未見完整 Customer confirmation handshake。
- Capacity-linked Order 會 fail closed，要求 correction path。

狀態：【部分完成】

## 10.6 Payment Correction
Current：
- SAME Order
- append paymentCorrections
- old → new audit
- current paymentLabel 更新
- no new Order

但：
- current implementation 要 ORDER_CORRECTION permission。
- Owner FINAL 後來寫「登入 SMT 即可操作」。

狀態：【已做但不同｜現行優先】

UI Redesign：
- 以 current permission model 顯示／隱藏。
- 唔因 UI 重畫取消 permission gate。

## 10.7 Refund
Current：
- Full / Partial
- exact line / qty / amount
- actual refund method
- linked refund record
- local same Business Day only
- cross-day / closed day → Admin
- Provider refund → Provider after-sale
- Cash refund會反映 reporting cash refund

未完整：
- 未見獨立 Cash In / Cash Out ledger 把 cash refund 寫成 Cash Movement record。
- Owner 跨日 append-only adjustment 在 SMT 本地未完整呈現。

狀態：【部分完成】

## 10.8 Cancel Notice
Current：
- Production 已出先取消 → cancellation notice
- DONE / FAILED / UNKNOWN
- 不盲目當成功
- Capacity restore 只做未回補的 deduction event

狀態：【已做｜鎖定】

注意：
Dining line correction 在 current implementation 有 post-production correction notice。
呢點同 Owner FINAL「修改唔自動印通知」唔完全一致。

分類：【已做但不同｜現行優先】

UI Redesign：
只反映 current action；唔用 UI 取消 runtime 已有 notice semantics。

---

# 11. Dining

## 11.1 Waiting / Table / Formal Order
Current：
- createDiningWait
- assign table
- admitDiningHold → Formal Order
- SAME local Order link
- Waiting 可先落單
- add-order
- history

狀態：【已做｜鎖定】

## 11.2 Table Registry
Owner Target：
固定 3×3，1–8 + 戶外。

Current：
- 優先讀 Admin Dining Table Registry。
- 無 Registry 時先 fallback 9 張。
- occupied orphan table 都保留顯示。
- 支援 join / unjoin / transfer。

狀態：【已做但不同｜現行優先，而且 current 更完整】

UI Redesign：
- 唔可以將 9 格寫死做長期產品限制。
- 應設計成 Dynamic Table Board。
- 9-grid 可以係 MF01 當前 layout preset，而唔係 engine 限制。

## 11.3 Real SeatedAt
Current：
- assign table 時建立 seatedAt。
- table elapsed 用 seatedAt。
- Dining warning 讀 Admin diningOverdueMinutes。

狀態：【已做｜鎖定】

## 11.4 Partial Payment / Split Tender
Current：
- stable submissionId
- expectedRevision
- partial item selection
- CASH / ALIPAY / WECHAT / FPS / PAYME / COMBO
- exact splitTenders persistence
- stale reject
- duplicate submission idempotency
- payment history

狀態：【已做｜鎖定】

## 11.5 Dining Price Override
Current：
- current runtime 有 Price Override
- stale guard
- append audit
- payment 後禁止
- no-op same price
- PRICE_OVERRIDE permission gate

Owner FINAL：
登入 SMT 即有操作權。

狀態：【已做但不同｜現行優先】

UI Redesign：
跟 current permission model。

## 11.6 Dining Initial Print
Current：
- Formal Dining Order
- ensureDiningInitialPrint
- firstPrint DONE / FAILED / UNKNOWN
- production / packing / dining table / labels plan
- 不重播已 attempted set

狀態：【軟件完成／實機待驗】

## 11.7 Dining Add-order Print
Current：
- appendDiningItems
- stable submission
- ensureDiningAdditionPrint
- DONE / FAILED / UNKNOWN
- UNKNOWN 不自動重印

狀態：【軟件完成／實機待驗】

## 11.8 Dining Payment Receipt + Cash Drawer
Current：
- Payment 保存後生成 receipt flow
- receiptAttemptedAt
- DONE / FAILED / UNKNOWN
- Cash payment route kickDrawer=true
- Reprint 強制 kickDrawer=false

狀態：【軟件完成／實機待驗】

## 11.9 Dining Reprint
Current：
- Dining 專用入口
- selected job
- manual reprint
- invalid/stale job fail closed

狀態：【軟件完成／實機待驗】

## 11.10 Cross-device Concurrency
Current：
- navigator.locks
- local fallback queue
- stable expectedRevision / submissionId

但：
- 呢啲主要係同 browser/origin concurrency protection。
- 未證明兩部獨立裝置真正 cross-device serialization。

狀態：【部分完成】

---

# 12. Sold-out / Capacity

## 12.1 Availability
Current：
- Search
- available / soldout / paused
- per-item Sold-out / Pause / Restore
- revision parameter
- current capacity state

未完整：
- Toolbar「全部／售罄／暫停」目前未見真正切 filter state。
- 未見 Category filter。
- 未見 multi-select bulk soldout / restore。
- 未見「一鍵紫米售罄／恢復」。

狀態：【部分完成】

## 12.2 Capacity Pool
Current：
- Business Day capacity state
- initialQty
- remainingQty
- product binding
- deduction event
- cancel restore event
- manual quantity correction
- actor / note
- first-party threshold
- third-party threshold
- Customer / Keeta admission uses channel capacity guard

狀態：【已做｜鎖定】

## 12.3 Capacity Override
Owner Target：
Pool=0 後 bounded override，指定 scope / extra qty / actor / time。

Current：
- 可以 manual adjust remaining quantity。
- 有 adjustment history。
- 但未見獨立「Override」domain，亦未見指定 channel / product scope 的 bounded extra allowance model。

狀態：【部分完成】

UI Redesign：
- 現有「調整數量」係真功能。
- 「Override X 份／指定渠道」唔好畫成已接線。

---

# 13. More / Tools

## 13.1 功能內容
Current 已有：
- Overview
- Printing
- Diagnostics
- Day Close
- Reports
- Backup / Restore
- Admin Menu / Sync

狀態：【已做｜鎖定】

## 13.2 入口
Current：
More 仍係左 Rail 第五項。

Owner：
More 應移去 top hamburger。

狀態：【部分完成】

UI Redesign：
入口可以搬，但 route / 功能不變。

---

# 14. Day Close / Cash

## 14.1 Cash Counting
Current：
- Opening cash
- Cash sales
- Cash refund
- Expected
- Counted
- Difference
- Cash removed
- Retained
- Denomination mode
- Direct total mode
- $1 / $2 / $5 / $10 / $20 / $50 / $100 / $500 / $1000
- Day Close print

狀態：【已做｜鎖定】

## 14.2 Cash In / Cash Out
Owner Target：
獨立 Cash In / Out ledger，amount / reason / actor / time。

Current：
- 未見完整一般 Cash In / Cash Out ledger surface。
- Current day close expected cash 主要係 Opening + Cash Sales - Cash Refund。
- cash removed / retained 有，但唔等於日內 Cash In / Out ledger。

狀態：【未做／只得部分 close cash movement】

## 14.3 Channel Summary / Tender Summary
Owner Target：
日結分 Channel + Tender，current effective tender only。

Current：
- local report 有 gross / refund / net / cash / average / items / top products。
- Dining split tender cash recognition 有處理。
- 未見完整 channel summary。
- 未見完整 tender provider summary。
- Payment correction history存在，但日報全維度 closure未完整。

狀態：【部分完成】

## 14.4 Immutable Daily Report + Later Adjustment
Current：
- Day Close 有 record / version / print。
- SMT same-day refund。
- Cross-day / sealed day refund轉 Admin。

Owner Target：
舊 report immutable + append-only linked adjustment 1.1。

狀態：【部分完成】

---

# 15. Reports / Analytics

Current：
- completed orders
- gross sales
- refunds
- net sales
- cash sales
- cash refunds
- cash net
- item units
- average order
- refund rows
- product quantity / sales
- CSV
- day-close print

未完整：
- full Channel Summary
- full Tender Summary
- Electronic Unclassified inference
- explicit Top / Low / Zero Seller surfaces
- linked later-adjustment report view

狀態：【部分完成】

UI Redesign：
先畫 current metrics。
Future analytics 要用 disabled / planned annotation，唔偽裝成已有資料源。

---

# 16. Printing

## 16.1 Admin vs SMT Responsibility
Current：
- Admin logical printers / print config
- SMT physical host / port binding
- published logical printer mapping
- actual print execution

狀態：【已做｜鎖定】

## 16.2 Parallel Print Routing
Current：
- 按 physicalKey grouping
- 不同 physical groups Promise.all 並行
- 同一 physical group job 順序執行
- per-job result / code
- elapsed diagnostic

狀態：【已做｜鎖定】

## 16.3 Reprint
Current：
- Order Detail → reprint
- Whole ticket / selectable label jobs
- selected jobs only
- reason audit
- drawer suppressed

狀態：【已做｜鎖定】

## 16.4 Printer Failure Attention
Current：
- checkout / dining 顯示 print fail / partial / unknown
- Diagnostics 有 Last Print Trace
- Native OUTCOME_UNKNOWN 有正式處理
- 人工 reprint path

未完整：
- 全系統 persistent Printer Attention Queue / global red light 未完全證明。

狀態：【部分完成】

## 16.5 Physical Acceptance
Current #22：
- Software seams source-backed
- P5 Print / Recovery 仍 physical pending
- Full cold-boot evidence亦未完全關閉

狀態：【軟件完成／實機待驗】

---

# 17. Diagnostics / Backup / Admin Sync

## Diagnostics
Current：
- Print trace
- route / code / elapsed
- local health / bridge info
- Customer cloud diagnostic

狀態：【已做，但仍可 UI 收斂】

## Backup / Restore
Current：
- local backup
- validate
- restore
- MFK storage snapshot

狀態：【已做｜鎖定】

## Admin Sync
Current：
- LKG
- sync status
- published config projection

狀態：【已做｜鎖定】

---

# 18. Offline / Restart / Recovery

Current：
- Local runtime
- Local order persistence
- Dining persistence
- UI recovery session for dining checkout / add-order
- UNKNOWN readback logic
- no blind auto retry for print uncertainty

但 Physical：
- P3 fresh BOOT_COMPLETED acceptance deferred / waived daytime
- P4 / P5 physical evidence未完全完成

狀態：【軟件完成／實機待驗】

---

# 19. Permission｜重要差異

Owner FINAL 個人要求：
「有權登入 SMT → 可以操作 SMT 設定／功能」。

Current implementation：
- Staff Session
- granular permissions
- ORDER_CORRECTION
- PRICE_OVERRIDE
- fail-closed permission checks

狀態：【已做但不同｜現行優先】

UI Redesign 絕對規則：
- 跟 current permission model。
- 冇 permission 就 hidden / disabled / blocked。
- 唔可以因 Owner 舊要求而將所有敏感操作開畀所有登入者。

---

# 20. UI 重畫時嘅最終 Feature Map

## Screen 01｜點單
必須畫入【已做】：
- Customer Pending
- Keeta Pending
- Global new-order attention
- Quick / Normal
- Categories
- Dynamic Product Grid
- Product Image / Description projection
- Required
- Quick Drink
- Riceball Pairing
- Combo
- Cart
- SAME Line Edit
- 堂／外
- Combine OFF default
- 暫存／堂食
- 取單
- Checkout

Gap / 唔可以假裝已完成：
- full continuous UI settings
- Customer cutoff / pause
- full dynamic ETA threshold engine

## Screen 02｜Checkout
必須畫入【已做】：
- 5 current channels（電話／WhatsApp合併）
- CASH / FPS / PayMe / Alipay / WeChat / COMBO
- split tender
- fixed keypad
- exact cash
- $50 / $100 / $200 / $500
- cash received / change
- Confirm → Formal Commit
- Completion Review

Gap：
- $20 quick cash
- Student Discount
- pre-payment 75% Final Review
- dynamic Admin payment method list

## Screen 03｜Orders
必須畫入【已做】：
- 3 source lanes
- Pending Customer / Keeta
- Evidence review
- WhatsApp QR
- Accept
- Keeta defer
- Ready
- Payment Correction
- Refund
- Cancel
- Cancel Notice state
- Reprint
- Keeta after-sale

Gap：
- Ready → 未完成
- 本地「已取餐」完整 action
- Customer modify-confirm handshake
- complete cross-day adjustment display

## Screen 04｜Dining
必須畫入【已做】：
- Waiting
- Dynamic Admin Table Registry
- formal order link
- seatedAt
- dining warning
- transfer
- join / unjoin
- add order
- line correction
- price override
- partial item payment
- exact split tender
- payment history
- first-print certainty
- dining reprint
- payment receipt state
- UNKNOWN attention

Gap：
- real multi-device serialization proof
- physical print / drawer acceptance remaining

重要：
唔好畫死固定 9 張枱做 engine 限制。

## Screen 05｜Sold-out / Capacity
必須畫入【已做】：
- Search
- Product availability state
- Sold-out
- Pause
- Restore
- Capacity Pool
- Remaining
- First-party threshold
- Third-party threshold
- Manual adjust

Gap：
- real status filters
- category filter
- bulk action
- one-click purple-rice soldout/restore
- bounded override by scope / extra qty

## Screen 06｜More
必須畫入【已做】：
- Today summary
- Day Close
- Reports
- Printing
- Backup
- Diagnostics
- Admin Sync

Gap：
- top hamburger IA change
- general Cash In / Cash Out
- full channel/tender report
- later-adjustment view

---

# 21. 重畫 UI 的不可破壞清單

以下 current implementation 一律視為 LOCKED：

1. Local-First。
2. Formal Order 只一次。
3. Payment Confirm transaction boundary。
4. Customer Screenshot = Evidence。
5. Keeta defer max 2。
6. Independent Cart Unit。
7. Combine default OFF。
8. SAME Line Edit。
9. Required checkout gate。
10. Admin canonical Combo。
11. 暫存／堂食 contextual default + human override。
12. Dining SAME Formal Order。
13. Dining stable submissionId / expectedRevision。
14. Dining exact split tender。
15. Dining SeatedAt。
16. Dynamic Admin Table Registry。
17. Dining Price Override current permission rule。
18. Payment Correction current permission rule。
19. Refund current same-day / Admin cross-day boundary。
20. Cancellation notice current certainty states。
21. Capacity deduction / restore events。
22. Capacity Business Day reset。
23. Print per-physical grouping / parallel routes。
24. Reprint no drawer。
25. UNKNOWN ≠ FAILED。
26. Backup / Restore。
27. Admin LKG / Sync。
28. Current Staff permission model。

---

# 22. 結論

Owner Product Requirements：
COMPLETE。

Current SMT implementation：
唔係「未開始」，而係大部分核心交易／點單／Orders／Dining／Print 已經存在。

真正仲未做晒的 Owner UI / Product Gap，集中喺：

1. 主導航 More → Hamburger。
2. 完整 UI continuous settings。
3. Customer cutoff / instant pause。
4. 多段 ETA load rule + auto-ready。
5. Owner 定義的純 Category「整理」行為與 current Organize Workspace 不一致。
6. Dynamic Admin payment method list。
7. $20 Quick Cash。
8. Student Discount。
9. Pre-payment 75% Final Review。
10. Fulfillment Ready → 未完成 / 已取餐完整操作。
11. Customer order modification confirmation handshake。
12. Cash In / Cash Out ledger。
13. Full Channel / Tender Daily Report。
14. Immutable Daily Report + Later Adjustment UI。
15. Sold-out Category / real status filter / bulk / Purple-rice shortcut。
16. Bounded Capacity Override。
17. Persistent Printer Failure Attention。
18. Cross-device Dining concurrency。
19. Physical print / drawer / power-cycle acceptance。

而以下唔係 Gap，而係「現行實作已經同 Owner 原文字不同」：
- More 仲喺 rail。
- 電話／WhatsApp目前係同一 channel。
- Organize Workspace 唔等於純 Category Sort。
- Dining Table 已升級為 Admin dynamic registry，唔再應硬寫 9 枱。
- Payment Correction / Price Override 有 granular permission。
- Dining post-production line correction 有 correction notice。
- Cross-day refund 由 SMT 轉 Admin。

重新畫 UI 時：
【現行實作優先，Owner Requirement 用來補 Gap，不用來倒退已存在功能。】

MILESTONE：
MFK_SMT_UI_REDESIGN_IMPLEMENTATION_AWARE_BRIEF_V1_READY
