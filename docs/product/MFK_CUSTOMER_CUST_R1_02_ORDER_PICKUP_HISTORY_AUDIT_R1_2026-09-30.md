# MFK Customer｜CUST-R1-02 Order State / Pickup / History Audit R1

日期：2026-09-30  
範圍：UI6 Fulfilment / UI7 Pickup-Complete / UI8 Orders-History-Reorder  
控制 Issue：#603  
Branch：`spec/MFK-CUSTOMER-PORT-REASSESSMENT-R1`  
狀態：PRODUCT / UX AUDIT ONLY — NO RUNTIME CHANGE

---

# 1. 今批目標

將訂單後半段由：

**狀態 + 標題 + 詳情 + 說明 + progress + readback + 再說明**

收斂成：

**State → ETA / Pickup Code / Exception → Relevant Action**

State truth 保持嚴格，但唔再用大量文案教用戶 state machine。

---

# 2. UI6｜Store Fulfilment

## Current Reality

目前同一個 state 會重複出現：
- eyebrow
- title
- detail
- progress rail
- readback state
- freshness paragraph
- elapsed
- observed time
- timeline
- refresh explanation

例如 READY 同時出現：
- 可取餐
- 餐點已準備好
- 可以到店取餐
- 可取餐只代表…
- 到店請出示取餐碼
- 可取餐唔代表已交收…
- progress rail 再顯示可取餐
- readback 再顯示目前狀態

功能 truth 正確，但 presentation 過量。

## Target Contract

正常 first viewport：

### RECEIVED
```
等待店舖確認
#A123
```

### ACCEPTED
```
已接單
預計取餐 12:35    （有正式 ETA 才顯示）
```

### PREPARING
```
製作中
預計取餐 12:35
```

### DELAYED
```
稍有延誤
最新預計 12:45
```

### READY
```
可以取餐
取餐碼 0387
```

### REJECTED
```
未能接單
{正式原因}
[修改訂單]
```

### CANCELED
```
已取消
```

## Keep

- canonical state
- ETA if provided
- display code / pickup code when relevant
- order summary below first viewport
- timeline as secondary detail
- rejection reason
- freshness / offline truth

## Remove / Collapse

Default remove:
- eyebrow + title + detail triplication
- Identity explanation paragraph
- readback panel duplicating current state
- “以上係店舖最新訂單進度”
- “只會更新…唔會重新落單”
- elapsed timer unless it has user value
- observed timestamp from first viewport

Freshness:
- CURRENT: no banner
- OFFLINE: `離線 · 顯示最近狀態`
- STALE: `更新中 · 顯示最近狀態`
- ERROR: `暫時未能更新` + refresh icon/action
- UNKNOWN: `確認中`

No explanatory paragraph by default.

## UI6 Gate

Product direction：LOCKED  
Current implementation：RED

---

# 3. UI7｜Pickup / Complete

## Current Reality

READY / ARRIVED / VERIFIED / HANDED_OVER / COMPLETED / EXCEPTION 分得正確，
但每一層仍有重複說明。

另外 current main 明確存在：
`CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN`

但 UI 仍顯示 disabled：
`我到了`
再用兩段文案解釋功能未連接。

呢個違反 Human Logic：
**未有能力，就唔應該擺一個似可用但 disabled 嘅主要 customer action。**

## Target Contract

### READY

第一屏：
```
可以取餐

0387
取餐碼

#A123
```

如果需要：
`預計取餐 12:35`

唔需要：
- “餐點準備好”再講一次
- “真正交畀你之後先會完成”
- Disabled “我到了”
- “到店通知暫未連接”

Arrival seam 未存在時：
**完全隱藏「我到了」功能。**

### ARRIVED

```
已到店
0387
取餐碼

等待核對
```

Customer 唔需要睇：
- 店員 checklist
- “必要時其他資料”
除非真係要 Customer 做 action。

### VERIFIED

```
已核對
```

如 bag / meal count 係 customer 有用：
```
2 袋 · 3 件
```

唔需要：
- “真正交付完成後先…”
- 重複解釋核對 ≠ completed

### HANDED_OVER

```
已交收
```

如果 canonical Completed 未到：
可保留細 state：
`完成狀態更新中`

唔需要一整段教 state boundary。

### COMPLETED

```
已完成
20:42

[再來一單]   （eligible 時）
[返回首頁]
```

### PICKUP_EXCEPTION

```
需要協助

取餐碼不符
[請店員協助]
```

或：
```
少 1 袋
[請店員協助]
```

Exception 先顯示 detail。

## Identity

Pickup first viewport：
Pickup Code 大。
Display Code 小。

禁用 explanatory paragraph：
“取餐碼同流水號用途不同…”

Visual hierarchy 自己講清楚用途。

## UI7 Gate

Product direction：LOCKED  
Backend：YELLOW — Arrival Notification seam missing  
Current implementation：RED

Handling：
- V1 hide Arrival action until backend seam exists.
- UI cannot simulate or locally mark ARRIVED.

---

# 4. UI8｜Orders / History / Reorder

## Current Reality

Order list 本身功能完整，但：
- page hero 有說明 paragraph
- 3 filters：進行中 / 已完成 / 全部
- card 內再放 explicit “訂單詳情” button
- detail identity pair有 explanation
- History reorder 流程：
  DETAIL
  → COPY
  → REPAIR
  → REVIEW
  → CART

Reorder 其實係一個簡單意圖：
**我要再食上次呢張單。**

系統內部需要 current revalidation，
但唔需要將 revalidation 變成幾個 Customer 教學頁。

## Target Order List

Header：
`訂單`

Tabs：
`進行中 | 已完成`

“全部”唔係必要 primary tab。
如未來數量大，可由 filter 提供。

Current Card：
```
製作中              12:18
雞胸飯 ×1
HK$68

#A123            >
```

READY：
Pickup Code 可直接提升：
```
可以取餐
0387
```

整張 card 為單一 tappable surface。
唔需要另外一個「訂單詳情」button。

Completed Card：
```
9/30
雞胸飯 ×1
HK$68              >
```

## Target History Detail

```
已完成 · 9/30 13:10
#A123

雞胸飯 ×1
少飯 · 加蛋
HK$68

[再來一單]
```

唔需要：
- “歷史快照”
- 取餐碼 / 流水號用途教學
- “舊訂單唔會被改動”常駐 paragraph
- disabled “設為常用訂單” + “功能尚未開放”

未有 saved-template mutation seam：
**hide the feature**。

## Target Reorder

User taps：
`再來一單`

System internally：
1. Copy intent
2. Current menu revalidation
3. Current pricing
4. Availability check

### If everything valid

直接：
```
再來一單
→ Cart
```

唔需要：
COPY screen
REVIEW screen

### If only some lines invalid

直接去 Repair：
```
2 項需要修改

雞胸飯
價格 HK$68 → HK$72
[接受] [修改] [移除]

飲品
暫停供應
[修改] [移除]
```

全部修好：
`[返回購物車]`

唔需要：
- “正在建立新購物車”
- 4-step copy checklist
- “只會帶返餐點選擇…”
- “繼續驗證”
- Final Review page 再確認一次

真正 final order confirmation 已由正常 Checkout 負責。

## Reorder State Truth

必須保留：
- historical order immutable
- reorder = new cart intent
- current price / availability revalidation
- only affected lines repaired

以上係 system contract，
唔需要全部變成 Customer prose。

## UI8 Gate

Product direction：LOCKED  
Current implementation：RED

Saved template seam：YELLOW
Handling：hide until supported。

---

# 5. Canonical Order Presentation Dictionary

Customer default visible state：

| Canonical | Customer |
|---|---|
| RECEIVED | 等店舖確認 |
| ACCEPTED | 已接單 |
| PREPARING | 製作中 |
| DELAYED | 稍有延誤 |
| READY | 可以取餐 |
| ARRIVED | 已到店 |
| VERIFIED / PICKUP_VERIFICATION | 核對中 / 已核對（按 canonical truth） |
| PICKUP_EXCEPTION | 需要協助 |
| HANDED_OVER | 已交收 |
| COMPLETED | 已完成 |
| REJECTED | 未能接單 |
| CANCELED | 已取消 |
| UNKNOWN | 確認中 |

規則：
- 一個 canonical state，first viewport 只需要一個主要 state label。
- 同一 state 唔再用 eyebrow + title + detail 重複講三次。
- Exception 先顯示 reason。
- Safety boundary 留喺 system contract / test；Customer 只在有誤解風險時顯示最短必要 copy。

---

# 6. Remove-Nonessential-Copy Test

UI6：
刪 helper copy 後，State / ETA / code / progress 應仍清楚。
→ Target PASS。

UI7：
刪 helper copy 後，Pickup Code / State / Help action 應仍清楚。
→ Target PASS。

UI8：
刪 helper copy 後，Current / Completed / Reorder / Repair 應仍清楚。
→ Target PASS。

Current implementation：
三頁均 FAIL MINIMUM_NECESSARY_COPY。

---

# 7. CUST-R1-02 Status

UI6 Fulfilment：
PRODUCT LOCKED / IMPLEMENTATION RED

UI7 Pickup / Complete：
PRODUCT LOCKED / IMPLEMENTATION RED / BACKEND YELLOW

UI8 Orders / History / Reorder：
PRODUCT LOCKED / IMPLEMENTATION RED / SAVED-TEMPLATE YELLOW

CUST-R1-02：
**PRODUCT RULES READY FOR OWNER REVIEW**

Implementation：
**BLOCKED**

---

# 8. Next Batch

CUST-R1-03：
- UI0 Launch
- UI1 Home
- UI2 Browse

目標：
Customer 門面 first viewport。

重點：
- 首頁第一眼
- 搜尋
- 店舖狀態
- Active Order
- Hero
- Categories
- Product discovery
- Bottom Navigation

同一硬規則：
**唔用文案教 UI；靠 hierarchy / affordance / product image / state / action。**
