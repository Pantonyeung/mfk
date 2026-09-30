# MFK Customer｜CUST-R1-01 Core Order Friction Audit R1

日期：2026-09-30  
範圍：UI3 Configure / UI4 Cart-Checkout / UI5 Submit-Result  
方法：MFK Port Reassessment Closeout Method V1  
控制 Issue：#603  
Branch：`spec/MFK-CUSTOMER-PORT-REASSESSMENT-R1`  
狀態：PRODUCT / UX AUDIT ONLY — NO RUNTIME CHANGE

---

# 1. 今批唯一目標

將最核心交易段落由：

**教學式介面 → 直接落單介面**

用戶唔應該需要閱讀：
- 「而家做緊第幾步」
- 「呢度有乜用」
- 「完成呢步先可以下一步」
- 「目前設定係乜」
- 「結帳前會再確認乜」

正常流程只保留：
**商品 / 選擇 / 數量 / 備註 / 價錢 / 付款 / 確認落單 / 結果**

---

# 2. Human Logic Gate

每頁都必須通過：

1. SELF_EVIDENT_NAVIGATION
2. SELF_EVIDENT_ACTION
3. SELF_EVIDENT_STATE
4. SELF_EVIDENT_COMPLETION
5. MINIMUM_NECESSARY_COPY

測試方法：

**先刪晒非必要 helper copy。**
如果剩低 controls / values / states / actions 後仍然一眼識用，PASS。
如果唔識用，改 layout / affordance，禁止用說明文補救。

---

# 3. UI3｜Configure

## 3.1 Current Reality

目前 Product Sheet 已有：
- Product image
- Product name
- Description
- Price
- Combo
- Required modifiers
- Optional modifiers
- Quantity
- Note
- Recommendation
- Current summary
- Sticky add action

但存在大量重複教學層：

- 「套餐選擇 / 想加埋小食／飲品？ / 可選」
- 「套餐價會按你揀嘅內容更新」
- 「只要主餐 / 不升級套餐」
- 「必選 / 必選項目 / 完成後先可加入」
- 每個 option 重複「已選」
- 「數量 / 今次要幾多？ / 今次數量 / 最少 1 件」
- 「你的選擇 / 目前設定」
- 「結帳前會再確認餐單、價格同供應狀況」
- Sticky action 再寫「完成必選設定後先可以加入」

結果：
同一件事由 control、section title、small copy、error、sticky copy重複解釋。

## 3.2 Target Interaction Contract

第一屏：

```
[商品圖]

商品名稱                      HK$xx
商品簡短描述（如正式資料有）

規格
( ) A     ( ) B

加配
[ ] X +$x
[ ] Y +$x

數量
[-] 1 [+]

備註（選填）
[________________]

                     HK$xx
               [加入購物車]
```

如果係套餐：
直接顯示：
```
套餐
( ) 主餐
( ) 套餐 +$xx

飲品
( ) 茶
( ) 水
```

唔需要「想加埋小食／飲品？」。

## 3.3 必須保留

- Product name
- Published price / price delta
- Required / optional distinction
- min/max constraint，只在真係有多選限制時顯示
- unavailable
- validation error，只在未符合要求時顯示
- quantity stepper
- note optional label
- total
- add/update action

## 3.4 必須刪／降級

Default remove：
- 「今次要幾多？」
- 「今次數量」
- 「目前設定」
- 「你的選擇」
- 「完成後先可加入」
- 「可以加入記憶罐」
- 「結帳前會再確認餐單、價格同供應狀況」
- 每粒已 selected button 再寫「已選」
- 無 optional option 時「冇其他可選設定」
- 無 required option 時「呢件商品冇額外必選項」

Recommendation：
由 UI3 configuration 主流程移走。
可放：
- Product detail 下方非阻塞區
- Cart
- Browse
但唔應插入必選設定 → Qty → Add CTA 之間。

## 3.5 Button / State Rule

Single choice：
- radio-like card
- selected 由 border / fill / check mark 表達

Multi choice：
- checkbox-like card
- selected 由 visual state 表達

Required missing：
- 到用戶嘗試 Add 或離開 required group 時先顯示短 error
- Example：`請選擇飲品`
- 禁止常駐教學句

Quantity：
- `[-] 1 [+]`

Notes：
- `備註（選填）`

Sticky CTA：
- New：`加入購物車`
- Edit：`更新`
- 左側可直接顯示 total
- 禁止再加 instructional small text

## 3.6 UI3 Gate

PRODUCT DIRECTION：LOCKED  
CURRENT IMPLEMENTATION：RED  
原因：功能齊，但 interaction / copy 未符合 Human Logic Gate。

---

# 4. UI4｜Cart / Checkout

## 4.1 Current Reality

目前 Checkout 被拆成：

```
聯絡與取餐
→ 付款
→ 提交前確認
→ 再撳「確認以上資料」
→ UI5 再撳「確認並送出訂單」
```

同時有：
- Checkout Stepper
- page helper paragraph
- pickup code explanation
- V1 pickup window explanation
- 「下一步：付款」
- 「下一步：提交前確認」
- 「最後睇多次…」
- 「已按目前餐單重新確認」
- 「呢一步只係確認畫面資料，唔會立即建立正式訂單…」

問題：
**交易被拆成太多「確認自己正在確認」的層。**

## 4.2 Target Product Flow

Cart：
```
商品 A
規格 / 加配
[-] 1 [+]            HK$xx
[修改] [刪除]

商品 B ...

------------------
總額               HK$xx
                 [結帳]
```

Checkout：
```
取餐
電話
稱呼（選填）
取餐時間 / ETA（如果有正式資料）

付款
( ) 到店付款
( ) 電子支付

[電子支付選中時才展開 QR / 上傳]

訂單
商品 A ×1           HK$xx
商品 B ×2           HK$xx

總額                HK$xx

               [確認落單]
```

Default：
- 不需要 Checkout Stepper。
- 不需要獨立「提交前確認」step。
- 不需要一個「確認以上資料」按鈕再去下一頁撳 Submit。

## 4.3 交易安全點樣保留

安全唔靠多一頁文案。

提交前程式仍然必須做：
- cart non-empty
- current quote
- material change check
- phone requirement
- payment selection
- payment evidence requirement（如適用）
- availability / published price check

如果有 material change：
**阻擋 Confirm Order**
並將受影響 line 直接標紅 / attention：
`價格已更新`
`暫停供應`
`需要重新選擇`

Action：
`修改`

唔需要一個大段落解釋「只修受影響項目」。

## 4.4 Pickup Code

取餐碼係結果／取餐 identity。
Checkout 期間如果規則係 phone last-4，可以顯示，但唔應搶 main hierarchy。

Preferred：
- checkout phone field 下唔需要獨立大卡
- final order / ready / pickup surface 再強化 pickup code

## 4.5 Payment

到店付款：
```
● 到店付款
○ 電子支付
```

電子支付：
選中後只展開：
- channel
- QR
- upload evidence
- evidence state

必要 copy：
`付款截圖`
`已上傳`
`上載失敗`

可以保留一次 factual boundary：
`付款以店舖核對為準`
但禁止同一頁多處重複。

## 4.6 UI4 Gate

PRODUCT DIRECTION：LOCKED  
CURRENT IMPLEMENTATION：RED

Owner decision candidate：
**將 Checkout 由 3-step + review-confirm，收斂成單一 Checkout surface + one Confirm Order CTA。**

此項涉及 route / flow change。
Implementation 前需要 Owner 對 final first viewport 明確確認。

---

# 5. UI5｜Submit / Result

## 5.1 Current Reality

目前 Submit surface 同時顯示：

- Safe Submit hero
- state explanation
- pickup code / fallback reference explanation
- full order summary
- submit progress
- connection attempt explanation
- payment evidence explanation
- UNKNOWN warning
- WhatsApp fallback explanation
- rejected explanation
- submit button
- back review
- delivered / waiting explanation
- readback panel
- identity panel
- another order summary
- waiting explanation
- refresh explanation

Safety semantics 多數正確，
但 presentation 太多層。

## 5.2 Target Flow

用戶喺 Checkout 撳：

`確認落單`

即刻進入：

### PROCESSING
```
送出中…
[spinner / progress]
```

唔需要長文。

然後只出現一個結果 surface。

### A. Request delivered，但店舖未 accept

```
✓ 已送出
等店舖確認

[查看訂單]
```

呢個唔可以寫「已接單」。

### B. Store Accepted

```
✓ 已接單

預計取餐 12:35   （如有）
[查看訂單]
```

### C. Unknown

```
確認中
請勿重複落單

[更新狀態]
```

此處「請勿重複落單」係必要 safety copy，可以保留。

唔提供 blind retry。

### D. Known failed / NOT_CONNECTED before canonical delivery

```
未能送出

[再試一次]
[人工協助]  （如果正式 fallback available）
```

只有系統證明未成功送達，先可以叫「未能送出」。

### E. Store Rejected

```
未能接單

{正式 rejection reason，如有}
[修改訂單]
```

## 5.3 Submit Identity / Pickup Code

Processing 階段唔需要突出 pickup code。
Request delivered 後，如果 canonical identity 已有：
- display/order number
- pickup code

可以放 result secondary information。

## 5.4 Progress Attempts

「1 / 3 次連線檢查」屬 internal recovery implementation detail。
Default consumer UI 不顯示。

可以保留：
- spinner
- `送出中…`
- 超過合理時間後轉 UNKNOWN

## 5.5 Readback

UNKNOWN：
Action 可以叫：
`更新狀態`

背後執行 readback。
唔需要將 internal term「重新確認原本提交」暴露畀 Customer。

## 5.6 UI5 Gate

PRODUCT DIRECTION：LOCKED  
CURRENT IMPLEMENTATION：RED

核心 State Truth：LOCKED
- Unknown ≠ Failed
- Request Delivered ≠ Store Accepted
- Store Accepted ≠ Completed

---

# 6. CUST-R1-01 Final Minimum Copy Dictionary

| Function | Default Customer Copy |
|---|---|
| Quantity | no heading required；stepper only |
| Note | 備註（選填） |
| Add | 加入購物車 |
| Update line | 更新 |
| Cart | 購物車 |
| Checkout | 結帳 |
| Place order | 確認落單 |
| Processing | 送出中… |
| Request delivered | 已送出 |
| Waiting store | 等店舖確認 |
| Store accepted | 已接單 |
| Unknown | 確認中 |
| Unknown safety | 請勿重複落單 |
| Known send failure | 未能送出 |
| Store rejected | 未能接單 |
| Retry known failure | 再試一次 |
| Readback unknown | 更新狀態 |
| Repair | 修改 |
| Payment evidence | 付款截圖 |
| Evidence uploaded | 已上傳 |
| Optional | 選填 |
| Unavailable | 暫停供應 |

禁止 default copy：
- 今日要幾多
- 今次數量
- 目前設定
- 你的選擇
- 完成後先可加入
- 下一步：付款
- 下一步：提交前確認
- 最後睇多次餐點、取餐同付款資料
- 一步一步完成
- 呢一步只係確認畫面資料
- 結帳前會再確認餐單、價格同供應狀況
- 只會更新…唔會…
- 第 1 / 3 次連線檢查
- internal readback / published / canonical vocabulary

除非該句係 exception / safety 必要資訊。

---

# 7. First Viewport Candidate

## UI3
第一屏至少見：
- Product image
- name
- price
- 第一個 required selection

Sticky bottom：
- total
- Add

## UI4
第一屏至少見：
- Checkout
- contact / pickup essentials
- payment choice

Sticky bottom：
- total
- Confirm Order

## UI5
第一屏只見：
- processing / result
- one state
- one relevant action

唔應該第一屏再放完整 order summary + code guide + progress explanation + safety paragraph。

---

# 8. Batch Status

UI3 Configure：PRODUCT LOCKED / IMPLEMENTATION RED  
UI4 Checkout：PRODUCT LOCKED / IMPLEMENTATION RED  
UI5 Submit Result：PRODUCT LOCKED / IMPLEMENTATION RED

CUST-R1-01：
**PRODUCT RULES READY FOR OWNER REVIEW**

Implementation：
**BLOCKED**

---

# 9. Next Batch

CUST-R1-02：
- UI6 Store Fulfilment
- UI7 Pickup / Complete
- UI8 Orders / History / Reorder

目標：
將「訂單狀態」由多層說明，
收斂成：

**State → ETA / Pickup Code / Exception → Relevant Action**

並保留 canonical state boundary，不用文案重複教。
