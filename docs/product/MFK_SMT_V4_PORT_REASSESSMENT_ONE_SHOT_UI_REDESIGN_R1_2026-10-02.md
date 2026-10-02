# MFK SMT V4｜端口重新盤點＋一次過 UI 重設計 Master Pack R1

日期：2026-10-02  
狀態：PRODUCT REDESIGN READY / IMPLEMENTATION NOT AUTHORIZED  
Repo：Pantonyeung/mfk  
Branch：design/smt-v4-reassessment-20261002  
Parent Authority：#596 System Authority  
本文件只重整產品、資訊架構、互動與視覺；不得重建 Order / Pricing / Payment / Print / Store Kernel。

---

## 0. 本輪判斷

Owner 最後一句寫「SMB」，但上游四份來源全部係 SMT，因此本文件按 SMT 重設計。

今次要做的不是再「逐頁執靚」，而是：
1. 先鎖 Authority。
2. 用 Owner FINAL + Working Record + Current Implementation Brief + UI evolution 記錄重建一份 Current Reality。
3. 將整個 SMT 由「功能堆積」重整為「前線下一秒最自然的操作」。
4. 一次過完成全產品 UI product map、screen contract、component contract、state/copy contract、interaction contract。
5. 設計一次過；實作分刀，不一次過大爆改。

---

## 1. Authority Lock

### 不可動
- Local-first SMT transaction execution
- SAME Order / SAME Payment / SAME Pricing / SAME Print truth
- Required Gate
- Same-line edit
- Canonical Combo / Riceball pairing
- 暫存／堂食 contextual default
- Formal Checkout commit boundary
- Payment Evidence 只係 Evidence
- UNKNOWN ≠ FAILED
- Dining current superset：dynamic table registry / join / unjoin / split settlement / selective reprint / price override
- Current permission guard
- Print routing / transaction authority

### UI 只可做
- IA
- hierarchy
- layout
- spacing
- typography
- visual states
- interaction path
- progressive disclosure
- copy
- responsive density
- component reuse

---

## 2. SMT V4 產品定位

SMT 不是 Admin，不是報表後台，不是「縮細版 ERP」。

正式定位：
**固定工作台式 Frontline Operating Cockpit**

核心：
- 快
- 清楚
- 少一步
- 固定手位
- 高頻操作永遠在第一層
- 低頻治理退出主導航
- 本地交易不被 Cloud failure 拖死
- 系統只預設最合理下一步，不替前線做死決定

---

## 3. 全局資訊架構

### 左 Rail：只保留四個高頻入口
1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

左 Rail 額外只容許：
- 快捷模式
- Quick Drink
- Display Settings

禁止再放「更多」。

### Top Bar
固定：
- 店舖／工作站
- 營業狀態
- 客戶端接單狀態
- ETA / 負荷摘要
- Sync / Printer / Channel health 摘要
- 全局 Attention
- 漢堡「更多」

### More / Tools Center
漢堡進：
- 今日摘要
- 日結
- Cash In / Out
- 報表
- Print / Device
- Diagnostics
- Backup / Restore
- Admin Sync
- 低頻治理入口

---

## 4. 1920×1080 First Viewport Contract

Baseline：1920×1080。

### Shell
- Top Bar：約 56px
- Left Rail：約 80px
- Right Live Cart：約 460–480px
- 中央為 Category + Product / Workspace
- 固定 4-column Product Grid 為預設
- 所有重要 CTA 固定位置，不因內容跳位

### 色彩
- 主色：#1f5fbf
- 背景：暖白／冷灰中性底
- Secondary：中性灰階
- Red：只用 destructive / error / true warning
- Green / Orange：不得作裝飾主色，只在有明確 semantic 時使用

### 視覺語言
- 日系極簡
- 專業餐飲
- 清楚層級
- 低裝飾
- 高可讀
- 不兒童化
- 不做 SaaS dashboard 風格的卡片海

---

## 5. Component System

必須先做共用元件，再落頁：

1. AppShell
2. TopStatusBar
3. PrimaryRail
4. AttentionStrip
5. CategoryTabs
6. ProductCard
7. CartLine
8. StatusChip
9. FixedActionFooter
10. 75PercentModal
11. ModalHeader / ScrollBody / SummaryPanel / FixedFooter
12. ConfirmationDialog
13. EvidenceViewer
14. OrderCard
15. TableCard
16. CapacityCard
17. BulkActionBar
18. FilterBar
19. HealthBadge
20. Empty / Loading / Unknown / Failed / Partial State
21. Toast / Inline Result
22. Global Attention Drawer

所有 Screen 禁止自行再發明第二套 spacing / button / modal / badge。

---

## 6. 點單頁重設計

### 第一層
上：
- Customer Pending
- Keeta Pending / Attention
- 無待處理時收斂，不長期佔高空間

中：
- Horizontal Category
- 4-column Product Grid
- Product card：名稱、價格、狀態、可選圖片、三點配置

右：
- Live Cart

底：
- 暫存／堂食
- Checkout
- 清單只用細 Trash icon

### Cart
保留：
- 流水號 Preview
- 原單 / 整理
- 整單堂／外
- Combine
- Line-level 堂／外
- Same-line edit

「整理」只改排序，不改 truth。

### Silent Guided Flow
Required
→ Quick Drink
→ Combo blocker
→ 快速組合
→ Checkout
→ Product

只用 visual focus，不做 Wizard，不自動成交。

---

## 7. 75% Modal System

以下全部共用同一 Geometry：
- Product Detail
- Required
- Combo
- Riceball Pairing
- Hold / Dining
- Pending Customer
- Pending Keeta
- Payment Evidence
- Final Payment Review
- Refund / Payment Correction
- Reprint

結構固定：
- Header：名稱 / 狀態 / 關閉
- Left/Main：可滾內容
- Right：固定摘要（如適用）
- Footer：固定主要 CTA
- Dirty close 只有真修改先確認

目的：固定眼睛位置、手指位置、肌肉記憶。

---

## 8. Checkout V4

固定三區幾何：

01 Source / Channel  
02 Payment / Channel Information  
03 Keypad / Collection

規則：
- 03 Keypad 永遠同一位置
- $20 / $50 / $100 / $200 / $500 / 剛剛好
- 非現金時 keypad 保持位置但 Disabled
- Payment method 由 Admin-driven projection 呈現，不再寫死 UI
- Student Discount 有正式 UI slot，但未有 runtime 時標 FUTURE_WIRING
- 返回訂單不成交

### Final Payment Review
正式新增獨立 75% Review：
- Source
- Tender
- Total
- Cash received / Change
- Pickup / External code
- 最後「付款確認」

**只有這一粒付款確認先係 Formal Commit boundary。**

Completion Review 只係交易後確認與離開。

---

## 9. Orders V4

保留 3 Lane：
1. 現場／直接
2. 自家平台
3. 第三方平台

Top Filter：
Source → Tender

Order Card：
- Display Order No.
- Source
- Customer / External ID
- Items
- Amount
- Payment
- Fulfillment
- Exception / Attention
- ETA

Detail Workspace：
- Items
- Payment
- Timeline
- Fulfillment
- Print
- Customer / Provider evidence
- Correction / Refund / Cancel

補齊 UI：
- 可取餐 → 未完成
- 已取餐人工 action
- Customer modification confirmation
- Global exception emphasis

禁止用一個「總狀態」包 Order / Payment / Print / Fulfillment。

---

## 10. Dining V4

**禁止退回固定九宮格產品定義。**

Current runtime 已經係 dynamic Admin Table Registry，V4 必須按 current superset 畫。

Layout：
- 左：Waiting / Queue
- 中：Dynamic Table Workspace
- 右：Selected Table Detail

Table Card：
- Table name
- Party size
- seatedAt
- elapsed
- amount
- payment progress
- overdue / attention

Detail Actions：
- Assign / Transfer
- Join / Unjoin
- Add Order
- Price Override
- Split Settlement
- Payment History
- Reprint

Overdue 只係營運警示，不代表 transaction failure。

---

## 11. Sold-out / Capacity V4

同一 Workspace，兩個清楚 domain：

### Sold-out
- Search
- Category filter
- Available / Paused / Sold-out filter
- Multi-select
- Bulk Pause / Sold-out / Restore
- 紫米一鍵售罄 / 恢復

### Capacity
- Pool
- Remaining
- Consumption
- First-party threshold
- Third-party threshold
- Manual correction
- Audit
- Dedicated bounded Override

**Manual quantity correction ≠ Override。**
Override 必須顯示額外份數、scope、operator、expiry/use-up result。

---

## 12. More / Tools V4

首頁不是卡片墳場。

第一層：
- 今日營業摘要
- Cash / Day Close attention
- Printer / Device attention
- Sync attention

工具卡：
- 日結
- Cash In / Out
- Reports
- Printing / Device
- Diagnostics
- Backup / Restore
- Admin Sync

新增/補：
- Channel Summary
- Tender Summary
- Electronic Unclassified
- Low / Zero Seller
- Immutable Daily Report + linked later adjustment
- Printer Failure global attention

---

## 13. 全局 State / Copy Contract

永久硬規則：
- Unknown ≠ Failed
- Request Accepted ≠ Completed
- Published ≠ Applied
- Connected ≠ Business Ready
- Review Ready ≠ Approved

UI 必須分：
- LIVE
- UI_REWORK
- FUTURE_WIRING
- PHYSICAL_PENDING

Design preview 可以畫 FUTURE_WIRING，但必須有非正式標記；不得令工程／Owner 以為已接線。

---

## 14. External Inspiration 使用方法

### component.gallery
用途：元件 anatomy、state、accessibility、usage guideline。
用來建立：
- Modal
- Tabs
- Status
- Table/List
- Button
- Popover
- Alert
- Empty/Error states

不直接抄 style。

### appshot.gallery
用途：真實 App screenshot。
只研究：
- Food & Drink
- Functional
- Professional
- Minimalist
- Mobile information hierarchy

用來校驗「前線第一眼見乜」。

### minimal.gallery
用途：spacing、typography、視覺節制、品牌質感。
只借 visual rhythm，不照搬 marketing website layout。

### navbar.gallery
用途：Top bar / rail / overflow / active state。
直接服務 SMT Shell redesign。

### cta.gallery
用途：Primary / Secondary / Destructive action hierarchy。
用來校準：
- Checkout
- Payment Confirm
- Accept / Defer
- Refund / Cancel
- Hold / Dining

### footer.design
對 SMT 低相關。
只可參考低頻資訊分組，不應為了「用齊網站」硬塞 footer。

### ui2v.com
用途：Prototype motion / interaction demo。
可用於：
- Pending attention
- Status transition
- modal focus
- order arrival
- success confirmation

Production motion 保持克制，不以動畫取代狀態。

### awesome-opus5-5-videos
用途：學 prompt 結構、HTML/Canvas/SVG/Three.js 快速互動原型。
不得用來定義 POS business rule。
只作「把 interaction idea 快速做成可看片段」的 prompt corpus。

---

## 15. 端口重新盤點 Skill 套入 SMT 的正式流程

Phase 0 Authority  
→ Phase 1 Symptoms / Current Reality  
→ Phase 2 Evidence Matrix  
→ Phase 3 Port Type  
→ Phase 4 Product Map  
→ Phase 5 Gap / Collision Audit  
→ Phase 6 First Viewport  
→ Phase 7 Cross-page Flow  
→ Phase 8 High-risk Operations  
→ Phase 9 Bulk / Expert Efficiency  
→ Phase 10 Component System  
→ Phase 11 Responsive / Density  
→ Phase 12 Interaction Feel  
→ Phase 13 Copy Dictionary  
→ Phase 14 Owner Review  
→ Phase 15 Implementation Gate  
→ Phase 16 Build Acceptance  
→ Phase 17 Physical Acceptance / Cutover

---

## 16. 今次 Product Map

A. Shell
1. SMT Shell / Navigation
2. Global Alert / Exception
3. Display Settings

B. Ordering
4. Ordering Main
5. Pending Customer
6. Pending Keeta
7. Product Detail
8. Required
9. Riceball Pairing
10. Combo
11. Hold / Dining Entry

C. Checkout
12. Checkout
13. Student Discount
14. Final Payment Review
15. Completion Review

D. Orders
16. Orders
17. Order Detail
18. Payment Evidence
19. Payment Correction
20. Refund
21. Reprint

E. Dining
22. Dining Floor
23. Dining Detail
24. Dining Split Settlement
25. Dining Price Override
26. Dining Reprint

F. Sold-out / Capacity
27. Sold-out
28. Capacity
29. Capacity Override

G. More / Tools
30. More / Tools
31. Day Close
32. Cash In / Out
33. Reports
34. Printing / Device
35. Diagnostics
36. Backup / Restore
37. Admin Sync

---

## 17. Gap Map｜V4 必須分開處理

### UI_REWORK
- More → top hamburger
- continuous Display Settings
- universal 75% modal geometry
- $20 quick cash
- stronger global attention
- sold-out category filter
- component/copy consistency

### FUTURE_WIRING
- Dynamic ETA load threshold
- ETA auto-ready
- special cutoff / instant Customer stop
- category-based cart organize
- full structured Combine equality
- Student Discount
- final payment review wiring
- Admin-driven payment method expansion
- Ready → Not Ready
- Pickup action
- Customer modification confirmation
- Sold-out bulk / purple quick action
- bounded capacity override
- Cash In / Out ledger
- full reporting projection
- immutable report adjustments

### PHYSICAL_PENDING
- real printer
- restart / power-cycle
- offline
- Safari / device acceptance
- print failure / recovery evidence

---

## 18. 實作方式

**一次過完成設計，絕不一次過大爆改實作。**

實作切 6 個 Packet：

P1 Shell + Component System + Ordering  
P2 Checkout + Final Review  
P3 Orders + Attention + Evidence  
P4 Dining  
P5 Sold-out + Capacity  
P6 More / Tools + Reports / Diagnostics

每個 Packet：
- Base screenshot
- New first viewport
- Component mapping
- LIVE / UI_REWORK / FUTURE_WIRING / PHYSICAL_PENDING 標記
- Browser acceptance
- Existing transaction regression
- Owner screenshot review

未經 Owner acceptance：
- 不 Merge main
- 不 Deploy production
- 不 OTA

---

## 19. Owner Review Gate

Owner 只需要逐域判：
- First viewport 是否清楚
- 最常用 action 是否最突出
- 是否少一步
- 是否固定手位
- 危險 action 是否降權
- FUTURE_WIRING 有冇假裝 LIVE
- Current superset 有冇倒退
- Copy 是否前線可理解

產品定義可在 Owner Review 後 LOCKED。

Runtime / backend / physical dependency 未全收口前，整體實作狀態維持 YELLOW。

---

## 20. Milestone

MILESTONE：
**MFK_SMT_V4_PORT_REASSESSMENT_AND_ONE_SHOT_UI_REDESIGN_R1**

目前：
- Product direction：READY
- Authority：LOCKED
- IA：READY
- Component architecture：READY
- Screen map：READY
- Gap classification：READY
- External inspiration method：READY
- Implementation：NOT STARTED
- Owner visual acceptance：PENDING

下一步：
由 P1「Shell + Ordering First Viewport」開始做真實設計稿／prototype，再逐 Packet 打綠；不得重新由零討論整套 SMT。
