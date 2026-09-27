# MFK SMT｜FINAL IMPLEMENTATION UI SPEC R1
日期：2026-09-27
狀態：IMPLEMENTATION READY / TEXT UI SPEC FINAL
產品：MFK / MoreFunOS SMT
Target：Desktop POS，1920×1080 為主驗收尺寸
Current Main Fresh-read：3cab695ef736a75c7fcc0bb3690df39cc01e587d
主要實作 Surface：v2local/**

---

# 0. Authority / Scope

本 Spec 將以下資料收斂成一份 Implementation-ready UI 規格：

1. OWNER 對 SMT 端口要求｜FINAL V1.0
2. SMT Stage 0–12 功能 UI 設計 R1
3. MFK SMT Product Brief R1
4. MFK SMT UI Stage Map R1
5. current `Pantonyeung/mfk` main 嘅 `v2local/**` 實作

Authority 順序：

OWNER FINAL
→ 本 FINAL IMPLEMENTATION UI SPEC
→ Stage 0–12 詳細稿
→ current UI implementation

如 current code 同本 Spec 衝突：
以本 Spec UI 行為為目標；
但不得因此重建第二套 Order / Pricing / Payment / Print authority。

---

# 1. Product UI Principle

SMT = FRONTLINE LOCAL-FIRST POS / OPERATIONS TERMINAL。

設計目標：

- 快
- 清楚
- 大字
- 大按鈕
- 固定肌肉記憶
- 右手操作友善
- 本地優先
- Online Domain 故障不拖死本地交易
- UI 只投影同一份正式 truth
- 人工 Override 要清楚、可追溯
- UNKNOWN 永遠同 FAILURE 分開

禁止：

- Home Page
- 第二套 Order Engine
- 第二套 Pricing Engine
- 第二套 Payment Engine
- 第二套 Print Routing Authority
- 用 UI Cache 猜正式狀態
- 以 UUID／工程碼作前線主要識別
- 全畫面 Loading 阻塞日常營運
- 用顏色作唯一狀態提示

---

# 2. Baseline Canvas / Responsive Contract

## 2.1 Primary Acceptance
- 1920×1080
- Landscape
- 100% browser / native WebView scale
- Safe operating region = 全畫面減 Global Top Bar + Left Rail

## 2.2 Secondary
- 1366×768 至 1600×900：可用，但唔作第一視覺標準
- < 1200px：只要求功能可達，不要求同 1920 幾何完全一致
- 不為手機重做 SMT

## 2.3 Global Geometry
- Top Bar：64px
- Left Rail：92px
- Page Padding：12px
- Major Gap：12px
- Minor Gap：8px
- Hairline Border：1px

## 2.4 UI Scale
新增一個 presentation-only CSS variable：
`--smt-ui-scale`

建議實作範圍：
0.85–1.20
連續 slider，不用 Small / Medium / Large。

Scale 只影響：
- typography
- card density
- category/product grid
- padding / control size

不得改：
- Product / Price / Order / Payment / Print truth

---

# 3. Visual System

## 3.1 Style
- 日系極簡
- 專業餐飲 POS
- 高資訊密度但唔擁擠
- 白／灰為底
- 藍色做主要操作
- 紅色只做 destructive / error / 真警示
- 橙色只做 warning / dine-in semantic
- 綠色只做 verified success

## 3.2 Color Tokens
```css
--smt-bg: #F4F5F7;
--smt-surface: #FFFFFF;
--smt-text: #22252A;
--smt-muted: #737985;
--smt-border: #D9DCE2;

--smt-primary: #2D7FE3;
--smt-primary-strong: #225F9F;
--smt-primary-soft: #EEF5FF;

--smt-success: #2D7A44;
--smt-success-soft: #F5FFF7;

--smt-warning: #9B6A00;
--smt-warning-soft: #FFF9E9;

--smt-danger: #D43A52;
--smt-danger-soft: #FFF0F2;

--smt-unknown: #626979;
--smt-unknown-soft: #F1F2F4;

--smt-dinein: #A55A00;
--smt-dinein-soft: #FFF1DF;
```

## 3.3 Radius
- Input / button：10px
- Product / small card：12–13px
- Panel：16px
- Primary container / cart：18px
- Modal：18–20px

## 3.4 Shadow
只用輕陰影：
`0 5px 18px rgba(25,25,30,.05)`

禁止 heavy floating UI。

---

# 4. Typography

System stack：
`PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif`

Baseline：

- Meta / helper：12–13px
- Body：15–16px
- Control label：17–18px
- Section title：20–22px
- Page title：28–32px
- Cart Product Name：28–30px
- Display Number：30–34px
- Money Total：32–36px

Font Weight：
- body 500–600
- control 800–900
- primary number / product 900–950

禁止將所有字都做粗體。

---

# 5. Interaction Size

- 最低 touch target：44×44
- 高頻 button：48–56px height
- Checkout / primary bottom action：64px
- Keypad：>= 56px
- Icon-only destructive：48×48
- Left Rail item：>= 72px height

Pressed feedback：
<100ms 出現。

Animation：
120–180ms，
不得因動畫延遲 transaction action。

---

# 6. Global Shell

## 6.1 Top Bar
左：
- Hamburger / More

中：
- Store / Business Date
- Current Stage / Page（簡短）

右：
- Staff Session
- Local / Online 狀態摘要
- Attention count

Top Bar 唔應塞完整 diagnostics。

## 6.2 Left Rail
只保留四個高頻入口：

1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

「更多」移出 Left Rail。

## 6.3 Route Mapping
- `/` → 點單
- `/orders` → 訂單
- `/dining` → 堂食
- `/soldout` → 售罄／產能
- `/more` → 只由 Hamburger 進入
- Checkout 可保留 current route / nested flow，但不得變左側 permanent nav

## 6.4 Current Main Mandatory Delta
current `App.tsx` 仍見：
- 「點餐」
- 「售罄」
- 左 Rail「更多」

Target 必須改：
- 點餐 → 點單
- 售罄 → 售罄／產能
- 移除左 Rail「更多」
- Top Bar 加 Hamburger → /more

---

# 7. Global Modal Contract

所有主要操作 Modal：

- 約佔可操作介面 75%
- 尺寸固定
- Header 固定
- Body 可 scroll
- Footer 固定
- Primary action 位置固定

1920×1080 baseline 建議：
- Width：1360–1440px
- Height：720–760px

結構：

```
Modal
├─ Header 64px
├─ Body 1fr / overflow:auto
└─ Footer 72px
```

Close：
- 無 dirty state → 即時關閉
- 有 dirty state → 「放棄修改？」確認

Destructive confirm：
永遠獨立二次確認。

---

# 8. Global State Vocabulary

只用以下主要狀態：

- NORMAL
- SELECTED
- PENDING
- PROCESSING
- SUCCESS
- ATTENTION
- WARNING
- FAILURE
- UNKNOWN
- STALE
- DISABLED
- OFFLINE / DEGRADED

UNKNOWN：
絕不等於 FAILURE。

STALE：
絕不自動 last-write-wins。

---

# 9. Stage 0｜Boot / Login / Opening

實作 Surface：
- `presentation/StaffAuthGate.tsx`
- `presentation/CashOpeningGate.tsx`
- app startup runtime

Flow：

Boot
→ Staff Login
→ 必要 First Login Setup
→ Previous Retained Cash Readback
→ Today Opening Cash
→ Opening Confirm
→ 點單

無 Home Page。

## UI
Boot：
- Logo
- Local Runtime
- Device
- Config LKG
- Network
- Print Bridge status

Login：
- Staff selector
- PIN keypad
- error / disabled state

Opening：
- 上一日 counted / removed / retained
- suggested opening
- actual opening
- difference
- note
- final confirm

Opening success：
直接進 `/` 點單。

---

# 10. Stage 1｜Ordering Workspace

Current reusable surface：
- `features/ordering/OrderingWorkspace.tsx`
- `features/ordering/OrderingCenterWorkspaces.tsx`
- `features/ordering/PendingOrderReviewWorkspace.tsx`
- `features/ordering/RiceballPairingWorkspace.tsx`
- `features/ordering/ordering-workspace.css`

## 10.1 Main Grid
沿用 current geometry 作 baseline：

```css
grid-template-columns: minmax(0,1fr) 470px;
grid-template-rows: 108px minmax(0,1fr) 82px;
gap: 12px;
padding: 12px;
```

Areas：
- top = Incoming
- center = Catalog
- bottom = Fast Lane
- right = Cart

## 10.2 Incoming Strip
Target ratio：
Customer Pending : Keeta = 60 : 40

```css
grid-template-columns: 3fr 2fr;
```

新單：
- non-blocking
- 置頂
- short attention
- 唔搶走員工當前 editing context

## 10.3 Category
1920 baseline：
6 columns

<=1400：
4 columns

Height：
54–58px

## 10.4 Product Grid
1920：
4 columns

Row baseline：
220px

Card：
- image optional
- name
- price
- badge
- three-dot config

Quick Mode：
可直接入 Cart；
Required 未完成就建立 Required task。

Normal：
有 Required 就開 Product Config。

## 10.5 Fast Lanes
底部三等分：

1. 快速組合
2. 必選／補選
3. 紫米套餐

高度：
82px

## 10.6 Cart
Width：
470px

Header：
- Display Number Preview
- 原單／整理
- 堂食／外賣

Line：
- sequence
- 堂／外 badge
- 30px Product name
- details
- total

Combine：
Default OFF。
只有完全相同 config 先可合。

Bottom：
- 暫存／堂食：1fr
- 清除：48px icon
- Checkout：64px

Empty Cart：
顯示「取回訂單」。

## 10.7 Product Config Modal
75% modal。

Header：
- Product
- price

Body：
- left scroll options
- right fixed summary

Footer：
- quantity
- total
- Add / 完成修改

Edit existing line：
SAME line。
不可新增 duplicate line。

---

# 11. Stage 2｜Checkout

Current seam：
`features/checkout/CheckoutWorkspace.tsx`

## 11.1 Layout
左 Summary：
520px baseline

右 Checkout Flow：
1fr

## 11.2 Flow
1. Source
2. Payment Method
3. Split Tender（需要時）
4. Amount Entry
5. Note / Review

## 11.3 Cash
Quick keys 必須：
- $20
- $50
- $100
- $200
- $500
- 剛好

Current main 只有 50/100/200/500：
必須補 $20。

## 11.4 Student Discount
Current main UI 仍 disabled：
Target 要正式接入 Stage 2 規則。

UI：
- 學生人數
- Manual / Auto
- 最多優惠 N 杯
- Auto 優先最高價 eligible drink

其他未鎖優惠：
唔因今 Spec 自行啟用。

## 11.5 Formal Commit Boundary
Current direct「確認結帳」要改成：

Checkout data ready
→ 75% Final Review
→ 「付款確認」
→ ONE Formal Commit

Final Review 顯示：
- source
- tender
- split details
- total
- received/change
- discount
- pickup/platform info

「付款確認」先可建立：
- Formal Order
- Display Number
- Payment facts
- Fulfillment
- First Print Admission

## 11.6 Result
SUCCESS / KNOWN FAILURE / UNKNOWN 分開。

UNKNOWN：
先 Readback。
禁止 blind retry。

Completion Review「完成」：
只導航，
不得再 commit。

---

# 12. Stage 3｜External Intake

入口：
Ordering Incoming Strip。

Customer / Keeta 清楚分開。

Customer Review：
- Order Summary
- Payment Evidence
- WhatsApp QR
- 修改
- 取消
- 接受

Evidence：
可放大；
未人工核對不可 Accept。

Keeta：
- 即刻處理
- 稍後處理
- Defer max 2
- Auto Accept 只在守門通過

Accept success：
正式 Order → Stage 4。

Received ≠ Accepted。

---

# 13. Stage 4｜Orders / Fulfillment

Current seam：
`presentation/RuntimeOrdersWorkspace.tsx`

## 13.1 Layout
左：
Order Detail 520px

右：
3 Source Lanes

1. 現場／電話／WhatsApp
2. 自家平台
3. 第三方

## 13.2 Card
優先顯示：
- Display Number
- State
- ETA / wait
- Source
- item count
- pickup code（有先顯示）

## 13.3 State
未完成
→ 可取餐
→ 已取餐

可取餐
→ 可退回未完成

SAME Order。

## 13.4 Attention
Print / Provider / Delay / Customer Sync：
只作 Badge / projection，
唔污染 Order truth。

## 13.5 Reprint
由 Order Detail 進入，
唔由 Printer Settings 進入。

---

# 14. Stage 5｜Formal Correction / Cancel / Refund

Current seam：
`RuntimeOrdersWorkspace.tsx`

售後 Action Sheet：
- 修改正式訂單
- 更正付款方式
- 退款
- 取消

四種語義必須分開。

Payment Correction：
SAME Order；
old tender audit；
current effective tender 唯一計入 reporting。

Refund：
Full / Partial；
linked record；
Cash Refund 對應 Cash Movement OUT。

Cancel：
≠ Refund。

已出 Production：
Cancel → Cancel Notice。

正式修改：
唔自動印修改通知。

Timeline：
人類可理解 before / after / actor / time / result。

---

# 15. Stage 6｜Dining

Current seam：
`presentation/RuntimeDiningWorkspace.tsx`

## Layout
左 Waitlist：
300px

中 Table Grid：
minmax(680px,1fr)

右 Detail：
560px

## Table Grid
3×3：
1–8 號枱 + 戶外桌。

每格：
- table
- availability
- party size
- seated duration
- payment state
- overdue warning

Flow：
Waitlist / direct seat
→ SAME Dining Order
→ add order
→ transfer / join / split table assignment
→ item-based partial payment
→ full payment
→ release table

Partial payment：
唔釋枱。

Full payment：
同一保存結果釋枱。

---

# 16. Stage 7｜Sellability / Capacity

Current seam：
`presentation/RuntimeSoldoutWorkspace.tsx`

Target page：
- Top toolbar
- Left current soldout/paused list
- Center Product list/grid
- Right Capacity / Channel Detail

Product states：
Available / Soldout / Paused。

Capacity：
- Initial
- Remaining
- Used
- threshold
- channel accepting state

Channel stop：
只影響新單。

Pool = 0：
可以有限 Override。

紫米快捷：
只按正式 Pool binding，
唔按名稱猜。

---

# 17. Stage 8｜Cash During Business

Target in More / cash operations。

Summary：
- Opening
- Cash Sales
- Cash Refund/Adjustment
- Cash In
- Cash Out
- Expected Drawer Cash

Actions：
- Cash In
- Cash Out
- History

Cash Movement：
獨立記錄。
不可直接改 Balance。

UNKNOWN：
readback before retry。

---

# 18. Stage 9｜Day Close

Target in More / Day Close。

Four regions：
1. Expected Cash
2. Actual Count
3. Difference / Removed / Retained
4. Final Review

Count modes：
- denomination
- direct total

Retained =
Actual - Removed

Final Confirm：
one Day Close per Business Date。

完成後：
Locked result + print/reprint。

Later adjustment：
append-only，
不得覆寫 original report。

---

# 19. Stage 10｜Reporting / History

Target in More / Reports。

Primary tabs：
- 今日營運
- 歷史日報
- Order History
- Adjustment History

Reporting：
- channel ≠ tender
- only current effective tender
- immutable closed daily report
- cross-day adjustment append-only
- original business date + adjustment occurred date 都保留

Export：
read-only。

Freshness：
Live / Stale / Partial / Locked。

---

# 20. Stage 11｜Print / Device / Failure

Current seam：
`presentation/LocalMoreWorkspace.tsx`
+ native print runtime。

Settings：
Logical Destination
→ Physical Printer / IP / Binding
→ Published Template

Admin：
Product → Logical Destination。

SMT：
Physical Printer / IP / Binding。

Reprint：
Order / Dining Detail 發起。

80mm：
Whole Ticket。

Label：
Route + per-label selection。

Failure：
Attention。

UNKNOWN：
唔猜；
唔 blind retry。

Current `Test Print` capability：
如果保留，只定位為 Diagnostics；
不得當作 Owner Final 新 product requirement。

---

# 21. Stage 12｜More / Settings / Recovery

Current seam：
`presentation/LocalMoreWorkspace.tsx`

## 21.1 More Landing
上：
今日營運摘要

下：
Tool Cards

- 日結
- 報表
- 設備
- 打印設備
- 檢查中心
- Backup
- Restore
- 操作診斷
- Admin Sync
- UI 設定

## 21.2 UI Settings
- density
- columns
- image visibility
- font size
- live preview
- persist after restart

## 21.3 Admin Sync
按 Domain：
- Normal
- Pending
- Failure
- Stale

不得一粒綠燈代表全部。

## 21.4 Diagnostics
先前線摘要，
再 Advanced Detail。

## 21.5 Backup / Restore
保留 current capability入口，
但今 Spec 唔擴大／重新定義：
- retention
- restore granularity
- overwrite semantics
- OTA
- factory reset

任何 destructive new behavior：
要 Addendum。

---

# 22. Common Component Contracts

## 22.1 Button
Primary：
藍底白字。

Secondary：
白底／灰底。

Destructive：
紅色 soft background + red text；
只有 final confirm 可以 solid red。

Disabled：
opacity / neutral，
但文字仍可讀。

## 22.2 Badge
Badge 必須同時有文字：
- 可取餐
- 延誤
- Pending
- Unknown
- Offline

唔靠 color only。

## 22.3 Alert
Inline first。
只有 user 必須即時決策先用 modal。

## 22.4 Empty State
一句原因
+ 一個 next action。

禁止大插圖佔位。

## 22.5 Error
格式：

發生咩事
→ 影響邊度
→ 已成功到邊
→ 下一步

禁止只顯示 error code。

## 22.6 Engineering IDs
UUID / submissionId / revision：
只放 Advanced Detail / Diagnostics。

前線主要顯示：
- Display Number
- Pickup Code
- External Order No
- Table
- Customer

---

# 23. Loading / Async Rules

禁止：
- 全頁 spinner
- Background sync 遮住 Cart
- 一個 Provider timeout 鎖整頁

使用：
- local skeleton
- per-card busy
- per-action progress
- persistent current content

所有 async mutation：
立即出 pressed / processing feedback，
但唔假裝 success。

---

# 24. Focus / Keyboard / Accessibility

- 所有 icon button 有 aria-label
- Modal 開啟 focus trap
- ESC 只在非 destructive / 可安全退出情況關閉
- Enter 不可意外觸發 destructive final commit
- Focus outline 必須可見
- contrast 達到實際 POS 可讀標準
- 高頻工作不要求 hover 才可發現 action

---

# 25. Notification Contract

新單：
- 非 blocking
- 2–3 秒視覺提示
- 可配 sound
- 卡片置頂

Error：
只對受影響 Domain 出 Attention。

Success：
短暫 confirmation，
唔長期佔畫面。

---

# 26. Current Main → Final Spec Delta Map

## P0 必改

### App Shell
File：
`v2local/src/App.tsx`

- 點餐 → 點單
- 售罄 → 售罄／產能
- More 移出 Left Rail
- Top Bar Hamburger → More
- 保持 4 個高頻 nav

### Ordering
Files：
`OrderingWorkspace.tsx`
`ordering-workspace.css`
`OrderingCenterWorkspaces.tsx`

- Incoming ratio 60/40
- 保持 4-column product grid
- 保持 470px Cart baseline
- Required Guard 不可 bypass
- Cart SAME-line edit
- Empty Cart → 取回訂單

### Checkout
File：
`CheckoutWorkspace.tsx`

- 加 $20 Cash quick key
- Student Discount 由 disabled → 正式 UI
- 加 Final Review 75% Modal
- Final「付款確認」先做 formal commit
- UNKNOWN readback UX 明確

### Orders / After-sales
File：
`RuntimeOrdersWorkspace.tsx`

- 3 source lane hierarchy
- Fulfillment 狀態突出
- After-sale 四語義分開
- technical id 降到 detail

### Dining
File：
`RuntimeDiningWorkspace.tsx`

- 固定左 Waitlist / 中 3×3 / 右 Detail
- Payment selection 保持 across non-conflicting refresh
- Full payment 後 release table
- stale revision fail-closed

### Soldout / Capacity
File：
`RuntimeSoldoutWorkspace.tsx`

- Page title / nav label → 售罄／產能
- 增左 current soldout/paused list
- Pool / channel control 放右 Detail
- 不重做 capacity authority

### More / Tools
File：
`LocalMoreWorkspace.tsx`

- More Landing 優先 Summary + Tool Cards
- Print / Diagnostics / Dayclose / Report / Backup reuse current code
- UI Settings 補入 More
- Backup / Restore 唔擴大未鎖 semantics

## P1
- visual token 統一
- status language 統一
- modal footer geometry 統一
- consistent empty/error/unknown
- audit timeline polish

## P2
- micro animation
- BI charts
- decorative enhancement

---

# 27. Implementation Guardrails

1. 優先改 `v2local/src/**` presentation / feature layer。
2. 已有 runtime primitive 必須 reuse。
3. 唔因 UI Spec 起新 canonical DB。
4. 唔起第二 Order / Pricing / Payment / Print Engine。
5. UI-only gap 只改 UI。
6. 真缺 primitive 先開 smallest adapter seam。
7. 唔 broad rewrite `local-runtime.ts`。
8. 唔以 mock 成功冒充 physical / provider success。
9. UNKNOWN 必須有 readback path。
10. 任何 destructive action 必須 idempotent / revision-aware。

---

# 28. Suggested Implementation Order

Wave A｜Shell / Tokens
- Global Top Bar
- 4-nav rail
- More hamburger
- global modal / state tokens

Wave B｜Stage 0–1
- Login / Opening
- Ordering / Cart / Fast Lane

Wave C｜Stage 2–3
- Checkout Final Review
- Student Discount
- $20
- Customer / Keeta intake

Wave D｜Stage 4–5
- Orders lanes
- Fulfillment
- After-sales

Wave E｜Stage 6–7
- Dining
- Sellability / Capacity

Wave F｜Stage 8–10
- Cash
- Day Close
- Reporting

Wave G｜Stage 11–12
- Print / Diagnostics
- More / UI Settings / Recovery

Wave H｜Full Regression
- 1920×1080
- restart
- offline
- provider fail
- printer fail
- stale revision
- double tap
- unknown outcome

---

# 29. P0 Acceptance Matrix

## Global
- [ ] 1920×1080 無重要內容被裁切
- [ ] Left Rail 只有 4 個高頻入口
- [ ] More 由 Hamburger 入
- [ ] 主要 Modal 約 75%
- [ ] Footer action 固定
- [ ] 技術 ID 不作主 UI

## Stage 0
- [ ] Login → Opening → 點單
- [ ] 無 Home Page
- [ ] Opening confirm idempotent

## Stage 1
- [ ] Product → Cart < one primary action
- [ ] Required 不可 bypass
- [ ] SAME-line edit
- [ ] 暫存可完整取回

## Stage 2
- [ ] $20 quick cash
- [ ] Student Discount active
- [ ] Final Review
- [ ] Formal Commit once
- [ ] UNKNOWN readback

## Stage 3
- [ ] Evidence ≠ paid
- [ ] Customer / Keeta 分開
- [ ] Defer max 2
- [ ] Accept 防重

## Stage 4
- [ ] 3 source lanes
- [ ] 未完成 / 可取餐 / 已取餐
- [ ] 可取餐可退回
- [ ] Attention 不污染 Order

## Stage 5
- [ ] Modify / Tender Correction / Refund / Cancel 分開
- [ ] current effective tender only
- [ ] cancel notice rules
- [ ] append-only audit

## Stage 6
- [ ] Waitlist + 3×3 + Detail
- [ ] SAME Dining Order
- [ ] Partial payment 不釋枱
- [ ] Full payment 釋枱

## Stage 7
- [ ] Soldout / Paused / Restore
- [ ] Capacity Pool
- [ ] Channel threshold
- [ ] Override audit

## Stage 8
- [ ] Cash In / Out independent
- [ ] Expected Cash
- [ ] Movement history
- [ ] offline durable

## Stage 9
- [ ] denomination / total count
- [ ] difference
- [ ] removed / retained
- [ ] one Day Close

## Stage 10
- [ ] live reporting freshness
- [ ] immutable daily report
- [ ] adjustment history
- [ ] order history

## Stage 11
- [ ] logical vs physical print separation
- [ ] UNKNOWN no blind retry
- [ ] pending print restart recovery
- [ ] whole ticket / per-label reprint

## Stage 12
- [ ] More summary + cards
- [ ] UI setting live preview
- [ ] Admin Sync domain state
- [ ] Diagnostics readable
- [ ] Backup / Restore no invented destructive flow

---

# 30. Final Definition of Done

本 FINAL Implementation UI Spec 完成後，SMT UI implementation 可以進入實際 coding / visual convergence，條件係：

- Stage 0–12 每一 Stage 都有唯一 UI journey
- 每個高頻 action 有固定位置／明確狀態
- Transaction boundary 唔再由 UI 猜
- Formal Commit、Refund、Cancel、Print 都有清楚責任邊界
- Local-first degradation 可理解
- Restart / UNKNOWN / stale revision 有 recovery
- current `v2local` 架構被 reuse，而唔係重建
- 1920×1080 可以開始逐頁 implementation acceptance

STATUS：
FINAL IMPLEMENTATION UI SPEC R1 = COMPLETE

NEXT:
IMPLEMENTATION / VISUAL CONVERGENCE AGAINST CURRENT MAIN
