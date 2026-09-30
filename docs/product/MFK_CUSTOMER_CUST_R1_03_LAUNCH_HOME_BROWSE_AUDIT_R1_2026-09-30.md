# MFK Customer｜CUST-R1-03 Launch / Home / Browse First Viewport Audit R1

日期：2026-09-30  
範圍：UI0 Launch / UI1 Home / UI2 Browse  
控制 Issue：#603  
Branch：`spec/MFK-CUSTOMER-PORT-REASSESSMENT-R1`  
狀態：PRODUCT / UX AUDIT ONLY — NO RUNTIME CHANGE

---

# 1. 今批目標

Customer 門面只問三件事：

1. 我而家喺邊？
2. 我可以食乜／我張單去到邊？
3. 我最直接可以做乜？

首頁同餐牌唔應該先要求 Customer 閱讀品牌句子，
亦唔應該出現假商品圖、假收藏、或 UI 自己推斷出嚟嘅 business truth。

---

# 2. UI0｜Launch

## Current Reality

現時 Launch：
- opening video
- Logo
- 男／女 IP
- food decorative assets
- slogan / story copy
- first / returning / reduced-motion modes
- animation完成後仍要求 Customer 選：
  - 進入主頁
  - 進入會員頁

## Human Logic Finding

Launch 係品牌入口，
唔應該變成導航決策頁。

對大部分 Customer：
**開 App → 入主頁**
係最自然結果。

「進入會員頁」屬正常 app navigation，
唔應該搶 Launch primary fork。

## Target Contract Candidate

First visit：
```
Brand animation
→ Home
```

可以：
- tap to skip
- reduced motion direct shortened transition

Returning：
```
short brand flash
→ Home
```

Launch 不需要：
- 進入主頁
- 進入會員頁
兩個同級 CTA。

會員由 Bottom Navigation 入。

## Gate

Existing Stage 0 visual asset：KEEP  
Navigation behaviour：READY FOR OWNER REVIEW  
Implementation：BLOCKED

---

# 3. UI1｜Home

## Current Reality

目前 Home 同時有：

- Store header / status / hours
- State panel
- Welcome headline
- Welcome subline
- Search
- Returning frequent strip
- Active order
- Closed panel
- Hero
- Announcement
- Coupon campaign
- 3 quick entries
- Top 6
- Memory strip
- Bottom nav

資訊來源多，
而且多個入口指向相同 destination。

## Critical Product Truth Issue

Current `mediaFor(product)`：
當 product 無正式 imageUrl 時，
會按商品名稱自行塞：
- riceball fallback
- salad fallback
- bowl fallback

呢啲係 generic food artwork，
唔係正式商品圖。

**Customer Product Card 禁止用 generic food image 冒充實際 Product。**

Handling：
- 有正式 Admin/runtime image → show image
- 無 image → neutral product placeholder / image-less card
- 禁止按名稱猜商品相

Status：RED / PRODUCT_TRUTH_GAP

## First Viewport Priority

### A. 有 Active Order

```
[Store name]       營業中

[ Active Order ]
製作中             12:35
#A123              >

[ Search ]

[ categories / products begin ]
```

Active Order 高過品牌 Hero。

因為用戶返 App 最大可能係睇張單。

### B. 無 Active Order

```
[Store name]       營業中

[ Search ]

[ Brand Hero / Campaign ]

[ category / quick discovery ]

[ Products ]
```

## Remove / Collapse

Default remove：
- Welcome headline + subline 大段 greeting
- “辛苦了！美味正在為你準備中”
- “好好吃飯，補充生活的能量”
- “歡迎回來，今天也要好好吃飯”
- 其他同功能無關嘅 dynamic motivational copy

Brand personality 可以留喺：
- Hero visual
- campaign
- very short brand line
唔好阻住 order/discovery。

## Active Order

Target：
```
製作中               12:35
#A123                >
```

可配已驗收 IP。

唔需要：
- “訂單進行中” + “製作中”雙 state
- fixed 4-step labels 如果 current state 已清楚
- “查看最新進度” fallback 教學語氣

## Closed Store

Current：
大 Closed panel + IP + “今日已打烊 / 明日再見 / 查看餐牌”。

Target：
Header / compact strip：
```
休息中 · 11:00 再開
```

如果 menu 可 browse：
Menu 保持正常可看。

唔需要大型 closed teaching card。

## Announcement

有正式 notice 才顯示。
One compact strip。
不加 generic notice。

## Quick Entry Collision

Current quick entries：
- 我的收藏
- 回憶券
- 期間限定

同時 Bottom Nav 已有：
- 點單
- 記憶罐
- 訂單
- 會員

原則：
Quick Entry 只留真正「跨步快速完成高頻任務」的入口。

Candidate：
- 再來一單（有 history 時）
- 回憶券（有 available coupon 時）
- 期間限定（真有 campaign/category 時）

無內容唔顯示。
唔需要永遠固定 3 張 card。

“我的收藏”暫停，原因見 UI2 Favorite authority gap。

## Top 6

Product Card：
- official product image OR neutral placeholder
- product name
- price
- official badge only

Remove：
- 自行推導 popularity label
- generic fallback food photo
- explanatory recommendation reason by default

## Memory Strip

Current：
- 記憶罐
- 上次食過 / 我的回憶

同 Bottom Nav / quick entry / history collision。

Candidate：
Remove as permanent section。
Cart count 由 Bottom Nav badge。
Reorder 由 conditional quick entry / History。

## UI1 Gate

Product direction：READY FOR OWNER REVIEW  
Current implementation：RED

---

# 4. UI2｜Browse / Menu

## Current Reality

目前：
- Logo header
- cart icon
- search icon
- visible search field
- category rail
- secondary filter All / Popular / Favorites
- featured card
- product grid
- Favorite hearts
- Zero result recovery
- Bottom navigation

## Critical Authority Gap｜Favorites

Stage2 local：
`useState<ReadonlySet<string>>(new Set())`

即係「收藏」只係畫面 local memory，
reload / session 後可消失，
亦唔係正式 Member truth。

但 UI 呈現：
- heart button
- 已收藏 filter
- Home “我的收藏”

Customer 會自然理解為持久收藏。

呢個屬：
**AUTHORITY_GAP + UX_TRUTH_GAP**

Handling：
- 未有正式 Favorite persistence / member contract 前，hide Favorite controls。
- 禁止 browser local Set 冒充正式收藏功能。

Status：RED。

## Search

Search field 已經 visible。
Header 再放一個 Search icon 只係 focus 同一個 field，重複。

Candidate：
- 保留 visible search field
- 移除 header Search icon
- Header 只保留必要 navigation / cart

## Category

Horizontal category rail：KEEP。

但 default label：
`人氣推薦`
只有當 recommendation source 真係 popularity authority 才可用。

否則用：
`推薦`
或直接第一個正式 category。

禁用「人氣」做無證據 marketing truth。

## Secondary Filter

Current：
`全部 / 人氣 / 已收藏`

問題：
- “已收藏”目前無 authority
- “人氣”同 category recommendation semantic 可能重複
- category + filter two rails 增加 mobile density

V1 candidate：
- Category rail only
- Search
- Products

有正式 filter need 先加入。

## Product Card

Target：
```
[official image]
商品名
HK$xx
```

Optional：
- official badge
- unavailable overlay

Card 本身 tappable。
無需要教「查看」。

“+” icon 如果只係 open product configure，而唔係直接 add：
唔應該用 Plus 誤導為即時加入。
可以：
- whole card tap
- chevron / no extra glyph

## Featured Product

大 Featured Card 只喺真係有 campaign / featured authority 時使用。

唔應該因為「第一個 available product」就自動變 Featured。

如果無正式 featured truth：
統一 product grid / list。

## Zero Result

Target：
```
找不到結果

[推薦] [飯類] [飲品]
```

可以有已驗收 Zero Result IP。

Remove：
- “不如試下其他分類？”
- “返回點單”如果 clear search / category chip 已經足夠
- repeated recommendation section

## State Panel

Compact：
- 離線 · 顯示已載入餐牌
- 更新中
- 暫時未能更新 [重試]

唔需要每個 state 一個 paragraph。

## UI2 Gate

Product direction：READY FOR OWNER REVIEW  
Current implementation：RED

---

# 5. Bottom Navigation

Current fixed five：
- 首頁
- 點單
- 記憶罐
- 訂單
- 會員

此前 Owner 已鎖呢套 IA。
本輪不擅自改名稱。

Human Logic requirement：
- icon 必須 familiar
- tap target ≥ mobile accessible target
- active state 一眼清楚
- Cart / Orders badge 只顯示 factual count

注意：
「記憶罐」係品牌詞，較「購物車」抽象。
因 Owner 已鎖，V1 保留。
UI 必須用明確 shopping-bag/cart visual 去補足 affordance，
但唔加 onboarding paragraph。

---

# 6. First Viewport Summary

UI0：
Brand → Home，不要求入口決策。

UI1 Active Order：
Store → Active Order → Search → Discovery。

UI1 No Order：
Store → Search → Hero → Discovery。

UI2：
Header → Search → Categories → Product。

核心：
**真正可做的事要比品牌句子更早出現。**

---

# 7. CUST-R1-03 Status

UI0 Launch：
Visual KEEP / navigation behaviour READY FOR OWNER REVIEW

UI1 Home：
PRODUCT READY FOR OWNER REVIEW / CURRENT RED

UI2 Browse：
PRODUCT READY FOR OWNER REVIEW / CURRENT RED

Critical RED：
1. Generic food image fallback pretending to be product imagery.
2. Local-only favorites presented as durable “收藏”.
3. Featured / popularity language without guaranteed authority.
4. First viewport density and duplicated navigation.

---

# 8. Next Batch

CUST-R1-04：
- UI9 Member / Memory
- UI10 Account / Support

重點：
- 將未連接能力從 Customer UI 移走
- Member truth / Reward / Memory primary home
- Account / recovery boundary
- PWA / notification placement
- 刪 implementation explanation
- 只保留真正可用 action
