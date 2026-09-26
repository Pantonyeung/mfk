# MFK SMM｜Final Implementation UI Spec V1
日期：2026-09-26
狀態：CURRENT / IMPLEMENTATION-READY UI CONTRACT
產品：磨飯 SMM｜SMT 手機型前線輔助軟件
主要裝置：iPhone / Safari PWA
Current source fresh-read：Pantonyeung/mfk main，latest observed head 5a921700c4077f857d60191ae8eb6889d36a8102
主要 source reference：
- v2smm/src/App.tsx
- v2smm/src/styles.css
- v2smm/src/product-types.ts
- v2smm/src/capabilities.json

---

## 0. 絕對產品邊界

SMM = SMT 手機型前線輔助軟件。

核心用途只保留：
1. 堂食管理
2. 外賣／流動點單
3. 訂單／待處理管理
4. 前線營運狀態查看

禁止混入 Customer App 語義：
- 我的最愛
- 我的記憶
- 會員
- 回購統計
- 收藏
- 個人化生活內容

Authority：
- SMM 收集 staff intent + 顯示 canonical projection。
- SMT / Store Kernel 保留 Formal Order / Pricing / Payment / Print / Dining authority。
- UI 不得建立第二套交易、價格、付款、打印、堂食狀態引擎。

Current command reality：
- FORMAL_ORDER_COMMAND = WIRED_TO_SMT。
- FULFILLMENT_COMMAND = NOT_WIRED。
- CANCEL_COMMAND = NOT_WIRED。
- SELLABILITY_CONTROL_COMMAND = NOT_WIRED。
- PRINT_COMMAND = NOT_WIRED。
- DINE_IN_COMMAND = NOT_WIRED。
- RETRY_PRESENTATION command = NOT_WIRED。

因此任何未 wired mutation：
- 不可顯示成可成功執行的 active primary action。
- 只可 read-only、disabled、或顯示「此操作需由 SMT 處理」。
- 絕對不可 fake success。

---

# 1. Device / Canvas / Ratio Lock

## 1.1 Primary reference viewport
iPhone 16 Pro Max：
- Layout reference：440 × 956 CSS px
- Portrait only 為第一期正式設計基準
- 不使用圖片拉伸模擬手機比例

Secondary：
- 430 × 932
- 402 × 874
- 390 × 844
- 375 × 812

Minimum supported：
- 360 × 780

Maximum app content width：
- 520px

## 1.2 Shell
- width: min(100%, 520px)
- min-height: 100dvh
- body 不做固定 aspect-ratio
- UI 隨 viewport 自然延伸
- 禁止 transform scale() 硬縮
- 禁止固定高度造成 iPhone 長屏變形

## 1.3 Safe Area
所有 fixed / sticky bottom 元件必須：
- padding-bottom: env(safe-area-inset-bottom)
- 頂部需要 respect env(safe-area-inset-top)
- Home Indicator 上方最少保留 8px visual breathing space

---

# 2. Brand / Visual Direction

## 2.1 Brand assets
正式使用：
- 使用者提供「磨飯 More Fun」深藍 Logo
- 男 IP：藍髮、眼鏡
- 女 IP：紫髮、眼鏡

IP 角色定位：
- 只用於 Splash、登入、Empty、Recovery、教學／鼓勵情境
- 不放入高密度 Order list / Cart / Table grid 主操作區
- 同一 screen 最多 1 個 IP 主視覺
- IP 不得壓縮主要 CTA 或資料閱讀空間

## 2.2 Slogan
主：
「前線好幫手，令每一張訂單都更順暢」

短版：
「點單更順，店務更穩」

英文字只作輔助：
More Fun in Every Order.

---

# 3. Design Tokens

## 3.1 Color

Brand:
- --brand-navy: #163568
- --brand-blue: #2F73FF
- --brand-blue-pressed: #215BD4
- --brand-purple: #8552D7
- --brand-lavender: #F3F0FF

Surface:
- --bg-app: #F7F9FD
- --surface-1: #FFFFFF
- --surface-2: #F3F6FB
- --surface-3: #EAF1FB
- --border: #DDE4EE

Text:
- --text-primary: #12264A
- --text-secondary: #67738A
- --text-tertiary: #929CB0
- --text-on-primary: #FFFFFF

Semantic:
- --success: #28B66F
- --success-bg: #E8F8EF
- --warning: #F2A323
- --warning-bg: #FFF4D9
- --danger: #EA4B5A
- --danger-bg: #FDEBED
- --info: #377CF6
- --info-bg: #EAF2FF
- --unknown: #8552D7
- --unknown-bg: #F1ECFB
- --disabled: #B9C2D0

規則：
- Status 絕對唔只靠顏色，要 icon + label。
- 深藍主要用於 Brand / title / navigation。
- 亮藍只用 Primary Action、active tab、interactive highlight。
- 紫色只用 UNKNOWN / 特殊輔助，不作一般 primary CTA。

## 3.2 Typography

中文：
PingFang HK → Noto Sans TC → system-ui

英文／數字：
Inter → system-ui

Scale：
- Display：32/40, 700
- H1：28/34, 700
- H2：22/28, 700
- H3：18/24, 600
- Body L：16/24, 400
- Body：15/22, 400
- Secondary：14/20, 400
- Caption：12/16, 500
- Micro：11/14, 600
- Money Large：28/32, 700, tabular-nums
- Display Code：26/30, 800, tabular-nums

禁：
- 主操作文字 < 14px
- 重要金額用超細灰字
- 同一卡超過 3 種字重

## 3.3 Spacing
4px base grid。

Tokens：
4 / 8 / 12 / 16 / 20 / 24 / 32

Screen horizontal padding：
- 16px standard
- 12px compact screen only

Section gap：
- 20px

Card internal padding：
- 12–16px

## 3.4 Radius
- Chip: 999px
- Input / Button: 12px
- Card: 16px
- Large Card: 20px
- Bottom Sheet: 24px top corners
- App Icon: platform standard

## 3.5 Shadow
只用兩級：
- Card: 0 4px 16px rgba(18,38,74,.06)
- Floating / Sheet: 0 -12px 36px rgba(18,38,74,.14)

禁止 heavy glow / neon / glassmorphism 影響前線閱讀。

---

# 4. Interaction Standard

## 4.1 Touch target
- Minimum 44 × 44px
- High-frequency：48 × 48px
- Quantity +/-：最少 40 × 40px，但整個 hit area 44px

## 4.2 Motion
- Tap feedback：80–120ms
- Sheet / modal：180–220ms
- Page transition：180ms
- Status success：<= 300ms
- 禁止 blocking decorative animation > 500ms
- prefers-reduced-motion 必須關閉非必要動畫

## 4.3 Button states
每個 button 必須有：
- default
- pressed
- disabled
- loading
- success feedback（如適用）
- error / rejected（如適用）

Primary Button：
- brand-blue
- 100% width on checkout/submission
- min-height 50px

Destructive：
- danger text / danger surface
- 必須二次確認
- 不得同 Primary action 並排同權重

---

# 5. Global Shell

## 5.1 Top Bar
高度：
- 64px + safe-area top

內容：
左：
- Logo mark / 磨飯

中：
- 頁面標題 / 店員身份

右：
- Connection State pill

Connection pill：
READY / LAN：
綠點 +「已連接」

LOADING：
Spinner +「同步中」

STALE：
橙色 +「資料較舊」

UNKNOWN：
紫色 +「狀態未明」

ERROR：
紅色 +「同步失敗」

## 5.2 Bottom Navigation
固定 5 項，順序鎖死：
1. 點單
2. 待處理
3. 訂單
4. 堂食
5. 更多

對應 current View：
- order
- work
- orders
- dine
- more

規格：
- 高度 64px + safe area
- active item：blue icon + blue label + subtle blue background
- inactive：secondary gray
- badge 只顯真正 count
- badge >99 顯示 99+

禁止：
- 再加「首頁」
- 再加 Customer「我的記憶」
- 將 Cart 變第 6 個 nav item

---

# 6. Core Components

必須建立可重用元件：

- AppTopBar
- BottomNav
- ConnectionPill
- SearchField
- CategoryRail
- ProductCard
- ProductConfigSheet
- SelectionGroup
- QuantityStepper
- CartBar
- CartSheet
- CheckoutSection
- PaymentOption
- DiningTargetPicker
- SubmitOverlay
- SubmissionResult
- WorkCard
- OrderCard
- OrderDetailPanel
- Timeline
- TableTile
- DineSessionCard
- ToolCard
- HealthRow
- StatusChip
- EmptyState
- LoadingState
- OfflineBanner
- StaleBanner
- PartialBanner
- UnknownState
- ErrorState
- ConfirmDialog

所有元件只接 props / canonical projection。
禁止元件內自行產生 transaction truth。

---

# 7. Stage 0｜啟動／登入／連線

## 0.1 Splash
用途：
- App cold start
- 讀本機可信 session
- 讀本機 workspace
- 初始化 runtime port

顯示：
- Logo
- SMM
- slogan
- 一個 IP
- loading indicator

Maximum：
1.2 秒內如果 runtime 未 ready，轉入可操作 shell + connection state。
禁止無限 Splash。

## 0.2 Staff Login
必須：
- Staff selector
- PIN 4–8 digits
- Login
- Error inline
- Remember trusted session

不顯：
- raw token
- staff UUID
- engineering error

## 0.3 Connection Recovery
顯示：
- Internet
- LAN
- Last observed
- Retry / Pair

LAN：
係 optional acceleration path。
LAN failure 不得阻 Internet fallback。

---

# 8. Stage 1｜點單

對應 current：
view = order

## Layout
上：
- Search
- horizontal CategoryRail

中：
- Product Grid

底：
- CartBar（有商品先出）

## Product Grid
> 360px：
- 2 columns

<=360px：
- 1 column

Product Card：
- 圖片 1:1
- 商品名最多 2 行
- 價格
- 可設定 indicator
- + action

Sold out：
- 保留原位置
- 50–60% opacity
- 「已售罄」label
- disabled
- 禁止重新排序到亂晒 muscle memory

Search zero result：
- EmptyState
- CTA「清除搜尋」

---

# 9. Stage 2｜商品客製

重要：
Stage 2 唔做 4 個獨立 route。
實作為一個 ProductConfigSheet 內按資料逐組呈現。

順序：
1. Product summary
2. Variation
3. Required groups
4. Optional groups
5. Combo sections
6. Validation
7. Add

Sheet：
- max-height: 88dvh
- sticky footer
- scroll body
- 24px top radius

Required：
- 清楚顯示「必選」
- 未完成 inline error
- Add button disabled

Min/Max：
- 即時顯示「已選 X / 最多 Y」

Price delta：
- +$ / -$
- 即時更新草稿顯示

Validation fail：
只定位有問題 section。
禁止清空其他已選內容。

---

# 10. Stage 3｜購物草稿

實作：
CartSheet

內容：
- Line list
- option summary
- quantity
- edit
- remove
- subtotal / total
- service mode
- checkout CTA

Cart line：
同一 product / options 唔強制 merge。
每 line 保持獨立 identity。

Menu revision change：
- affected line 顯示 Attention
- 可局部 repair
- 禁止整個 Cart 清空

Empty：
- 「購物草稿係空嘅」
- CTA「去點單」

---

# 11. Stage 4｜Checkout

Stage 4 留喺 CartSheet 內，唔建新 route。

區塊順序：
1. Service Mode
2. Dining Target（堂食先出）
3. Tender
4. Final Summary
5. Submit

Service Mode：
- 外賣
- 堂食

Dine-in：
必須有 TABLE / WAITING target。
無 target：
- Submit disabled
- CTA 導去 DiningTargetPicker

Tender：
- CASH
- ALIPAY
- WECHAT
- FPS
- PAYME

SMM 呢度係 staff intent。
唔代表 Payment Engine。

---

# 12. Stage 5｜提交正式訂單

## 5.1 Submit lock
撳一次：
- synchronous interaction lock
- primary button loading
- 禁止 double tap

## 5.2 PENDING
顯示：
- 「訂單提交中」
- submission short reference
- submittedAt
- source = SMM

唔顯 raw UUID。

## 5.3 CONFIRMED
顯示：
- Display Code
- 金額
- 堂食枱／外賣
- CTA「查看訂單」
- CTA「繼續點單」

成功後：
- 清 current Cart
- refresh snapshot

## 5.4 REJECTED
顯示：
- 人類可理解原因
- 餐單／價格有變 →「更新餐單並返回修改」
- 禁止 generic「失敗」

## 5.5 UNKNOWN
必須獨立畫面／Card。

文字：
「提交結果未確認」

Primary CTA：
「重新確認結果」

Secondary：
「返回」

禁止：
「重新提交」

---

# 13. Stage 6｜待處理

對應：
view = work

用途：
只顯 operational work projection。

排序：
1. ACTION_REQUIRED
2. DELAYED
3. UNKNOWN
4. NORMAL

Work Card：
- Display Code
- Source
- Summary
- ETA
- elapsed
- state chip

Current implementation boundary：
Stage 6 暫時 read-only + refresh。
不得加入 Fulfillment mutation，除非 command capability 正式 wired。

Empty：
「目前冇需要處理嘅事項」

---

# 14. Stage 7｜訂單管理

對應：
view = orders

Tabs：
- 進行中
- 歷史

Filter：
- 全部
- 現場
- SMM
- 自家平台
- Keeta / 第三方

Search：
- Display Code
- Product text
- Source

Order Card：
- Display Code
- Source
- lifecycle
- amount
- item summary
- observedAt
- readback chip

Order Detail：
1. Identity
2. Items
3. Money summary
4. Fulfillment summary
5. Source
6. Timeline

### Authority correction
目前 FULFILLMENT_COMMAND / CANCEL_COMMAND 都係 NOT_WIRED。

因此舊視覺稿中：
- 「更新狀態」
- 「取消訂單」
不可做 active command。

V1 Implementation：
- read-only detail
- timeline
- canonical status
- 如要執行 mutation，提示「請於 SMT 處理」

---

# 15. Stage 8｜堂食管理

對應：
view = dine

## 8.1 Table Overview
來源：
Admin published dining table registry。

Grid status：
- 空枱
- 使用中
- 輪候 target
- orphan / disabled-but-occupied custody

Table Tile：
- display label
- covers
- elapsed
- amount summary
- current state

Disabled + occupied：
必須保持可見直到 canonical clear。

## 8.2 Table Detail
顯示：
- Table label
- Covers
- openedAt
- items
- total
- paid
- remaining

## 8.3 Mobile Add Order
唯一正式做法：
Table selection
→ change serviceMode DINE_IN
→ normal order flow
→ same SMT dining authority

禁止 SMM 直接建立第二堂食 transaction engine。

## 8.4 Waiting
- covers
- waiting target
- normal order intent

## 8.5 Clear / Close correction
目前 DINE_IN_COMMAND = NOT_WIRED。

所以舊視覺稿「清枱確認」不可 active。

V1：
- 顯示 current session
- 加單可經正式 submit path
- 清枱／改人數／關枱需 SMT 處理
- 等 command future wired 先開 active control

---

# 16. Stage 9｜更多／營運工具

Stage 9 必須重新收口，避免變第二 Admin。

正式入口：

## 9.1 員工帳戶
- current staff
- role
- session
- logout / switch

## 9.2 連線
- Internet
- LAN
- Pairing
- last sync

## 9.3 Channel Health
Read-only：
- CONNECTED
- STALE
- DEGRADED
- OFFLINE
- UNKNOWN

## 9.4 Business Day
Read-only / record-only。
絕對不可成 transaction blocker。

## 9.5 Printer / Device Health
Read-only：
- READY
- DEGRADED
- OFFLINE
- UNKNOWN

PRINT_COMMAND 目前 NOT_WIRED：
- 不顯 active「重印」。
- 不顯 active「測試打印」作正式功能。
- 需要時 deep-link / 指示去 SMT。

## 9.6 Capacity
Read-only：
- NORMAL
- BUSY
- PAUSED
- UNKNOWN

## 9.7 Reporting
只顯簡單摘要：
- Business Date
- Order Count
- Sales
- Average Order
- Freshness

## 9.8 Refund Request
Read-only projection。
真正 refund authority 不在 SMM。

## 9.9 Diagnostics
只畀必要時使用：
- layer
- status
- observedAt
- human-safe detail

### Stage 9 明確刪除／降級
舊視覺稿中：
- 「商品管理」完整 toggle
- 「打印工具」直接重印
全部唔可以按圖直接落地。

Sellability：
只有當 setSellability command 正式 wired + authority accepted，先啟用 quick control。
未 wired 時 read-only / disabled。

---

# 17. Stage X｜共用狀態系統

所有主頁共用以下 7 個 state：

## Loading
- Skeleton / spinner
- 保留 layout
- 禁止空白白屏

## Empty
- 正面文案
- 可行動 CTA
- 不當 error

## Offline
- 說明本機可做乜
- 說明正式資料可能不可用
- 重新連線後 auto refresh

## Stale
- 顯示 observedAt
- 「資料可能不是最新」
- CTA「重新整理」

## Partial
- 列出 affected domain
- 已成功部分保持成功
- 禁止整頁總 fail

## Unknown
- 紫色 semantic
- 第一動作永遠 readback / confirm result
- 禁止 blind retry

## Error
- human-readable summary
- safe retry only
- engineering detail 放 Diagnostics

---

# 18. Responsive Rules

## >= 390
- Product Grid 2 columns
- More Tool Grid 2 columns
- Standard 16px margins

## 360–389
- Product Grid 可保留 2 columns，但最小 card 156px
- 如商品文字過長，自動 1 column
- Tool grid 1 column 可接受

## <=360
- Product Grid 1 column
- Order action 1 column
- Field grid 1 column

Keyboard open：
- Bottom Sheet footer 必須保持可見
- 不可被 keyboard 完全遮擋
- Search results 可 scroll

---

# 19. Accessibility

- WCAG text contrast ≥ 4.5:1
- Large text ≥ 3:1
- Touch target ≥ 44px
- focus-visible 必須存在
- status 不靠顏色
- icon button 必須有 aria-label
- Dynamic text 放大至 120% 不應 cut off 主要 CTA
- prefers-reduced-motion 支援
- VoiceOver reading order 跟 visual order

---

# 20. Data / Authority Binding

UI 只 consume：
SmmRuntimePort
→ SmmReadModelSnapshot
→ projection components

Local storage 只保存：
- Cart
- Pending Intent
- Preferences
- Staff trusted session
- LAN config

Local storage 永遠：
LOCAL_NON_AUTHORITATIVE

不得保存：
- Formal Order truth
- Payment final truth
- Pricing authority
- Print final truth
- Dining canonical state

---

# 21. CSS / Frontend Implementation Structure

現有 v2smm/src/styles.css 係 warm beige / brown 舊視覺。
Final visual cut 要改為 blue / white / lavender，但只改 presentation。

建議拆：

v2smm/src/styles/
- tokens.css
- base.css
- shell.css
- components.css
- screens.css
- states.css
- responsive.css

styles.css
只負責 import。

禁止 UI visual cut 修改：
- Store Kernel
- SMM→SMT submit semantics
- idempotency
- UNKNOWN readback
- pricing validation
- staff auth
- LAN protocol
- Customer / Keeta / Admin seams

---

# 22. Implementation Order

Phase UI-1：
Design tokens + Shell + TopBar + BottomNav

Phase UI-2：
Stage 1 / 2 / 3
點單 + Product Sheet + Cart

Phase UI-3：
Stage 4 / 5
Checkout + Submit states

Phase UI-4：
Stage 6 / 7
Work + Orders

Phase UI-5：
Stage 8
Dine projection + target selection

Phase UI-6：
Stage 9 + Stage X
Read-only Ops + Recovery system

Phase UI-7：
Responsive + Accessibility + Regression

每一 Phase：
fresh main
→ presentation-only delta
→ build
→ SMM tests
→ protected five-port regression
→ visual acceptance
→ bank

---

# 23. Final Acceptance Checklist

必須全部成立：

1. 440×956 主基準不變形。
2. 360px width 仍可操作。
3. 5-tab navigation 順序固定。
4. Cart 不長期遮住產品。
5. Product config Required/Min/Max 清楚。
6. 堂食必須有 Table / Waiting target。
7. Submit rapid multi-tap 不會建立第二 intent。
8. UNKNOWN 無「重新提交」。
9. REJECTED 可以局部修復。
10. Confirmed 顯示 Display Code，不顯 UUID。
11. Work Queue 無第二 fulfillment authority。
12. Orders 無 active cancel/status mutation（未 wired 前）。
13. Dine 無 active clear/close command（未 wired 前）。
14. Stage 9 無第二 Admin。
15. Stage 9 無第二 Print Engine。
16. Sellability 未 wired 不假成功。
17. Business Day 不阻交易。
18. Offline / Stale / Partial / Unknown / Error 全部分開。
19. Status 有 icon + text，唔只靠顏色。
20. Mascot 不阻高頻操作。
21. Safe area 正確。
22. Keyboard 不遮主要 CTA。
23. VoiceOver / aria-label 可用。
24. Reduced Motion 可用。
25. Current SMM → SMT Formal Order path 完全不變。
26. Pricing / menu revision validation 完全不變。
27. Staff provenance 完全不變。
28. SMM / Customer / Keeta / Admin protected seams 不受 UI cut 影響。
29. Build / tests GREEN。
30. Owner 真機視覺驗收 GREEN。

---

# 24. Definition of Done

當且只當：
- Stage 0–9 + X 全部套用同一 Design Token
- 全頁 responsive
- 所有 interaction state 有定義
- 未 wired command 無 fake active behavior
- 五個主導航頁功能完整
- iPhone 真機操作無變形／遮擋
- protected E2E regression GREEN
- Owner 視覺／操作驗收通過

先標：
MFK_SMM_FINAL_IMPLEMENTATION_UI_SPEC_V1_ACCEPTED

目前本文件狀態：
SPEC_READY_FOR_IMPLEMENTATION
