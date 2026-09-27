# MFK SMT Product Brief｜Owner Canonical V2

版本：V2  
日期：2026-09-27  
產品：MFK SMT  
狀態：OWNER-CANONICAL PRODUCT BRIEF  
產品要求：COMPLETE  
實作狀態：PARTIAL / ACCEPTANCE IN PROGRESS

## 0. 文件定位

本 Brief 以以下三份 Owner 文件收斂：
1. Owner_對_SMT_端口要求_FINAL_V1.0 — 產品行為最高依據。
2. Owner_SMT_Requirements_Working_V2.5 — 決策演變、補充語義與最終收口紀錄。
3. smt優化ui — UI/UX 實作演進、已成熟區域與仍待驗收項目。

本 Brief 定義產品，不宣稱所有功能已完成實作。工程驗收仍以 current repo、實機 evidence、accepted test / physical acceptance 為準。

## 1. 產品一句話

SMT 係磨飯店內前線主 POS：用最快、最清楚、最少多餘步驟的方式完成點單、收銀、接單、堂食、打印、售罄／產能與本地離線營運，同時所有 UI 只投影同一份正式 Order / Pricing / Payment / Print truth。

## 2. 產品目標

1. 前線速度
- 高頻操作固定位置。
- 大按鈕只留給高頻主要動作。
- 減少多餘頁面與重複確認。
- 操作要形成固定肌肉記憶。

2. 清楚
- 訂單來源、付款、履約、打印、待處理要一眼分得開。
- 失敗、待核對、UNKNOWN 不可假裝成功。
- Raw engineering identity 不應成為前線主資訊。

3. 本地可運作
- 除真正依賴網絡的能力外，本地點單、購物車、Checkout、付款記錄、訂單、堂食、暫存、打印、日結照常。
- Cloud / Admin / Owner / Provider failure 不得拖死本地交易。

4. 單一交易真相
- 不建立第二 Order Engine。
- 不建立第二 Pricing Engine。
- 不建立第二 Payment Engine。
- 不建立第二 Print Engine。
- UI 快捷操作只加速操作，不另造商業規則。

## 3. 主要使用者

### 店員
- 點單
- 客製
- 暫存／取單
- Checkout
- 接單
- 可取餐／已取餐
- 堂食／輪候
- 售罄／恢復
- 產能調整
- 打印／重印
- 日結／Cash In／Cash Out

### SMT 登入使用者
Owner 最終要求：
有權登入 SMT，就有權使用 SMT 內本 Brief 所述本機設定／操作。
本輪不另外設 Manager-only Gate。

## 4. 資訊架構

高頻主導航：
1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

「更多」：
放畫面上方漢堡按鈕，進入低頻工具中心。

## 5. 視覺／操作原則

- 日系極簡。
- 專業餐飲 POS。
- 主色以藍色系統為基線。
- 紅色只用於 destructive / error / 真警示。
- 避免兒童化。
- 主要 Modal 約 75% 操作區域。
- 內容可滾動，但主要確認按鈕固定。
- 右手操作優先。
- 固定 Checkout Keypad、Modal Action、Rail 位置。
- 系統可以預設最合理下一步，但人永遠可以 Override。
- Silent Guided Flow 只提高下一個合理操作的視覺層級，不做 Wizard、不自動成交。

介面密度可連續細調：
- Category rows / columns
- Product rows / columns
- Product image show / hide
- Font scale
- UI density / size
- 即時 Preview
- Restart 後保留

4-column Product Grid 可作成熟 baseline，但最終產品要求係可調密度，不可鎖死單一格數。

## 6. 點單頁｜頂部待處理

### 自家客戶端
所有自家客戶端 Order 先進「待處理訂單」。

到店支付：
- 店員核對內容。
- 可接受、修改、取消。
- 修改／取消要同步客戶。

電子支付：
- Alipay
- WeChat Pay
- 轉數快
- PayMe
- 日後由 Admin 增減

付款截圖只係 Evidence：
- 可放大。
- 人工核對日期、時間、金額、清晰度。
- 有圖 ≠ 已付款。

付款證據有問題：
- 待處理卡右側提供該客戶 WhatsApp QR。
- 掃描後直接開該客戶對話。
- 帶指定訊息模板。

接受後先：
- 正式進 SMT Order flow。
- 記錄付款方式。
- 正常打印。
- 進製作。
- 客戶端收到已接受／處理狀態。

## 7. Keeta

Keeta 與自家客戶端相鄰，但來源身份分開。

模式：
- 自動接單
- 手動接單

自動：
無售罄／mapping／內容問題 → 正式入單 → 打印 → 製作。

手動：
顯示摘要卡：
- Keeta 單號
- 件數
- 總額
- 即刻處理
- 稍後處理

稍後處理：
- 唔係拒單。
- 唔係取消。
- 最多 2 次。
- 每次延後後仍置頂／亮燈。
- 第 2 次後不可再無限延後。

Keeta 出錯：
→ 待處理
→ 置頂
→ 亮燈
→ 人手處理

## 8. ETA／客戶端接單狀態

ETA 負荷：
只計當刻仍未到「可取餐」的活躍正式訂單。

Admin 設：
- 負荷門檻
- 對應 ETA 分鐘
- 可日後調整

正式 Order 成立後：
→ 取得當刻 ETA
→ 倒數
→ 到指定時間可進「可取餐」

SMT 可控制客戶端：
- 今日特別截單時間
- 即時停止新單

呢個控制：
- 只影響 Customer 新單。
- 不停止 SMT 現場交易。
- 不取消已成立 Order。
- Customer 要顯示原因與 WhatsApp fallback。

## 9. 點單／Cart

Cart 頂部：
- 流水號 Preview，只作參考，未成交不可佔正式號碼。
- 原單／整理。
- 堂食／外賣。
- 組合。

原單：
保留原輸入次序。

整理：
按 Product Category 排序，沿 Admin Category order。
只改排列，不改內容／數量。

堂／外：
- 可整單切。
- 每行仍可獨立切。

Combine：
- 只合併完全相同配置。
- 不同 Option / Combo / Remark / Service Mode 不得盲目合併。
- Combine 後先顯示 Qty stepper。
- 預設保持商品 unit 獨立。

Cart line：
- 序號
- 堂／外
- 大字商品名
- Option / Combo / Remark
- Qty（適用）
- Delete

## 10. 暫存／取單／堂食 Mindset

Owner 最終 UX mindset：
「暫存」與「堂食」係同一個主要入口的兩個 concept。

大按鈕：
暫存／堂食

系統只揀合理第一頁：
- All Takeaway → 預設「暫存」
- Any Dine-in → 預設「堂食」

但員工可以隨時手動切換：
Dining ↔ Hold

普通暫存：
- 保存完整 Cart。
- 立即處理下一單。
- 空 Cart 時由「取單」取回。

堂食／輪候：
- 可加入輪候。
- 可直接選桌台。
- 同一 Cart 不建立第二交易 engine。

清除訂單：
- 降低視覺權重。
- 使用小型 Trash。
- 必須二次確認。

## 11. 快捷模式／Fast Lane

### Quick Mode
開啟：
有 Required 都可以先入 Cart。

關閉：
有 Required → 即時開 Product Config。
無 Required → 直接 Add。

但：
Required 未完成 → 不可正式進 Checkout。

### 三個核心快捷入口
1. 快速組合
2. 必選區
3. 紫米套餐區

快速組合：
- 飯團＋小食。
- Auto Pair 只按位置順序。
- 不推薦。
- 不自動補商品。
- A / B / C / D…動態延伸。
- 已使用 item 改配對時做 Swap，不 Duplicate。
- 數量不相等，只組完整 pair；剩餘保持單點。

必選區：
- 直接 consume 正式 Required Choice。
- 不建立另一套 Required rule。

紫米套餐：
- A / B / C / D。
- 選飯團／小食／飲品。
- 套餐成立必須由店員明確執行套餐操作。
- 單一飯團／小食／飲品保持單點。
- Combo rule、加減價、禁配、售罄仍由正式設定提供。

## 12. Product Detail Modal

主要 Product Modal 約 75%。

上：
- Product Name
- Current Price

左：
- Variation
- Required
- Optional
- Modifier
- Combo
- Remark
- 可滾動

右：
- 固定 Selected Summary
- Qty
- Current Total

底：
- Qty
- Price result
- Primary CTA

新增：
「加入購物車」

編輯 Cart line：
「完成修改」

Edit 必須：
- 載入原 line 設定。
- 更新 SAME line identity。
- 不新增第二行。

## 13. Checkout

左側：
- 商品
- Qty
- Option / Combo / Remark
- 各行金額
- 總件數
- Total
- Source
- Tender
- Pickup Code / External Ref

右側上方：
01 Source / Channel
02 Payment / Source Info

右側下方：
03 固定 Keypad / Collection

幾何必須固定，切來源／Tender 不可令 Keypad 跳位。

Cash quick amount：
- $20
- $50
- $100
- $200
- $500
- Exact

Cash 顯示：
- 應收
- 實收
- 找續

Checkout 有「返回訂單」。
返回不可成交。

## 14. 學生優惠

資格：
只由現場店員確認 Student Count。

優惠：
合資格特飲半價。

上限：
優惠杯數 ≤ Student Count。

操作：
A. 手動選最多 N 杯
B. 一鍵自動最多 N 杯

一鍵自動：
優先套用到最貴的合資格特飲。

支援：
- 直接輸入 Student Count
- 快捷人數鍵
- 一鍵按 N 人套用

不可因學生人數多而憑空新增優惠商品。

## 15. Final Payment Confirm

付款前：
開約 75% Final Review。

顯示：
- Channel
- Tender
- Total
- Cash received / change
- Pickup Code / External Ref

Confirm 前仍可改 Payment Method。

最後「付款確認」先係正式交易邊界：
- 收款確認
- Formal Submit
- Production
- First Print side-effects

之前：
- 開 Checkout
- 返回
- 改 Tender
都唔可以提前正式成交。

付款確認只可成功一次。
Double Tap 不可造成 duplicate Order / duplicate first print / duplicate production。

## 16. 訂單頁

版面：
左＝目前選中 Order Detail
右＝三個大型 Source Lane

三 Lane：
1. 現場／直接來源
   - 店內
   - 電話
   - WhatsApp
2. 自家平台
3. 第三方平台
   - Keeta
   - Foodpanda
   - Future providers

Filter：
Source / Channel
→ Tender
→ Order List

Order Card：
- Source
- Order Number
- Status
- Customer Name（如有）
- Tender
- Item Count
- Total
- External Ref（適用）

自家平台額外：
- Customer name
- Pickup Code

Pickup Code：
Human Verification Aid。
唔係 Hard Transaction Gate。

Order Detail：
- Items
- Qty
- Line Amount
- Total items
- Total
- Tender
- Source
- Order No.
- Status
- Reprint
- Modify / Cancel
- Fulfillment

## 17. Fulfillment

正式狀態：
未完成
→ 可取餐
→ 已取餐

「可取餐」可以退返「未完成」。

用途：
- 誤按
- 發現未齊
- 需要修改

全程 SAME Order。

## 18. Order Modification / Payment Correction / Refund

### Order Modification
SMT 修改
→ 通知 Customer
→ Customer 確認

金額改：
- 加價 → 補款
- 減價 → 退款
- 可協議其他退款方式

Cash refund：
必須進 Cash Movement。

### Payment Method Correction
成交後由 Order Detail 修改。

要求：
- SAME Order
- 原 Tender 永久留 Audit
- 新 Tender = Current Effective Tender
- Reporting 只計 Current Effective Tender
- 不重新成交
- 不重新送 Production

### Refund
- Full
- Partial
- 原路
- Alternative refund method

要求：
- 原 Order 永久保留
- 建 linked Refund / Adjustment record
- 記 actual refund method
- Cash refund → Cash Movement

## 19. Cancel after Production

如果已出 Production ticket 後正式 Cancel：
→ Print Cancel Notice

例：
P00029 取消

如果只係 Modify：
- 不自動印 Correction ticket
- 店員直接同 Kitchen 溝通

## 20. 堂食

版面：
左：Waiting / Call
中：3×3 Tables
右：Selected Table Detail

Table：
- 1–8 室內
- 第 9 格戶外桌

Detail：
- Table
- Party Size
- Seated Time
- Elapsed
- Items
- Money
- Payment state

Admin 可設 Dining Warning Minutes。
超時：
整張 Table card 變紅。
只作提醒，不自動完成。

### 有位
Select Table
→ Order
→ Production
→ 可直接 Checkout

不需要：
- 已上餐
- 額外清枱狀態
- 等其他中間 state 先付款

付款完成即可收口。

### 無位／Waiting
建立 Waiting
→ 已點餐可先 Formal Order
→ 可先 Production
→ SAME Order 掛在 Waiting

有位：
→ SAME Order Assign Table
→ 繼續 Dining / Payment

## 21. 堂食分結帳

按商品拆。

10 件商品：
→ 最多 10 個 Payment Part
→ 不受 Party Size 限制

每 Part：
- Item set
- Amount
- Tender
- Paid / Unpaid

真正 Payment：
必須回到同一 Checkout。

Partial Payment：
桌台與未付項目保留。

Full Payment：
保留 payment history，再完成／釋放。

## 22. 堂食 Print

Dining page 可直接打印／重印：
- Production Ticket
- Packing Ticket
- Table Ticket / Unpaid instant receipt
- Dining Labels

Table Ticket：
- 未付款都可印
- 用作 Table / Serving / Check
- 不代表 Paid
- 不代表 Completed

堂食仍使用同一 Print Engine / Admin Routing / Template。

## 23. 售罄／恢復

頁面唔一次過攤晒全部商品。

支援：
- Category
- Search
- Sold-out / Paused filter
- Bulk sold-out
- Bulk pause
- Bulk restore

左側：
Current Sold-out / Paused List

紫米：
- 一鍵紫米售罄
- 一鍵紫米恢復

只作用於正式綁定紫米供應／Capacity Pool 的商品。

## 24. Capacity Pool

例：
紫米 Pool = 150

可設定：
- Name
- Initial Qty
- Bound Products
- Per-item consumption
- Channel stop thresholds

商品正式成立／Accepted 成可執行 Order：
→ 即時扣 Pool

正式 Cancel：
→ 補返已扣 Pool
→ 同一 Cancel 只可回補一次

Reset：
按 Business Day Start。
例：05:00。
唔按 00:00 calendar date。

人工改數：
有權登入 SMT 即可修正／補貨／調整目前 Pool。
必須保留操作記錄。

## 25. Channel Priority / Override

第三方有獨立 threshold。
自家平台有獨立 threshold。

一般方向：
Capacity 足
→ 全渠道正常

到 Third-party Threshold
→ 先停 Third-party

到 Own Platform Threshold
→ 再停 Own Platform

Pool = 0
→ 所有綁定遠端渠道停止新單

只影響新單：
- 不取消 existing orders
- 不自動 refund

Pool = 0 仍可人工 Override：
- 有權登入 SMT 的人可批准
- 指定 Qty / Scope
- 用完再停

記錄：
- Actor
- Time
- Pool
- Scope
- Extra Qty

## 26. 更多／工具中心

上方：
Today Operational Summary
- Sales / Revenue
- Orders
- Refund info

下方卡片：
- Day Close
- Reports / Analytics
- Devices
- Printing
- Check Center
- Backup
- Restore
- Diagnostics
- Admin Sync

低頻工具不可搶高頻主導航。

## 27. Day Close / Cash

顯示：
- Opening Cash
- Today Sales
- Expected Cash
- Counted Cash
- Variance
- Withdrawal
- Retained Cash

Cash counting：
支援 denominations：
$1 / $2 / $5 / $10 / $20 / $50 / $100 / $500

兩種模式：
- Count by denomination
- Direct total amount

Variance：
Counted - Expected
必須顯示數值與正負方向。

## 28. Cash In / Cash Out

每筆記錄：
- Amount
- Reason
- Time
- Actor
- Note（optional）

Cash In / Out：
≠ Sales
≠ Refund
≠ Payment Correction

Expected Cash：
Opening
+ Cash Sales
+ Cash In
- Cash Refund / adjustment
- Cash Out / expenses

Retention：
最後留櫃可作下一 Business Day 開櫃基礎。
之後任何加減都記 Cash In / Out，不靜默改 balance。

## 29. Day Close Reporting

Channel Summary：
每個 Channel：
- Order Count
- Amount

至少：
- Walk-in
- Phone
- WhatsApp
- Own Platform
- Foodpanda
- Keeta

Tender Summary：
只計 Current Effective Tender：
- Cash
- Alipay
- WeChat Pay
- FPS
- PayMe
- Electronic Unclassified
- Other

如果無法可靠知道 electronic provider：
→ Electronic Unclassified
→ 不自行猜 provider

由 Cash reconciliation 反推：
只可用於 Reporting classification。
不得改寫逐張 Order truth。

## 30. Daily Report / Analytics

Day Close 完成後形成正式 Daily Report。

可：
- View
- History
- Physical Print
- Reprint

Reprint 只輸出同一份 report truth。

Daily Report：
- Sales
- Effective Sales
- Order Count
- Refund / Cancel / Adjustments
- Channel Summary
- Tender Summary
- Cash In / Out
- Expected / Actual / Variance
- Withdrawal / Retained

Product Analysis：
- Product
- Qty
- Sales amount
- Ranking
- Top Seller
- Low Seller
- Zero Seller

用途：
幫 Owner 判斷補貨／備貨／產品調整。
Report 不自動刪 Product。

Owner 端只讀同一份 Reporting truth。

## 31. Cross-day Adjustment

已完成 Daily Report：
- Immutable
- 不改寫
- 不覆蓋

之後 Refund / Correction：
→ Append-only linked Refund / Adjustment
→ Link Original Order / Original Report

語義：
1.0 保留
1.1 追加

## 32. Print Authority

Admin：
- Product Printing Rule
- Product → Logical Print Destination
- Publish Template

SMT：
- Physical Printer
- IP
- Local Binding
- Select Published Template
- Actual Print Execution

Admin 決定：
「應該印去邊」

SMT 決定：
「實際邊部機係嗰個 destination」

SMT 不做 Template Authoring。
SMT 不建立第二 Product Routing。

## 33. Reprint

入口：
Order Detail → Reprint

80mm：
- Receipt
- Production
- Packing

用 Whole Ticket Reprint。

Labels：
- 每張獨立
- 先選 Route
- 可 All / Multi / Partial

Reprint：
- 不改 Order
- 不重新付款
- 不重新成交

## 34. Printer Failure / Diagnostics

Printer failure：
- 亮燈
- 通知前線
- 進 Attention
- 人手檢查 printer / connection
- 必要時修改 physical IP

系統唔自行猜 physical print result。

Admin Sync 顯示：
- 有冇 sync
- Last Sync
- Current State
- Pending
- Failure

不能只顯一粒綠燈。

Diagnostics：
前線先見人類可理解摘要；
工程 detail 再深入。

Backup / Restore：
低頻工具，不阻 daily transaction。

## 35. Offline / WhatsApp Fallback

SMT offline：
除真正 online 能力外，本地工作照常：
- Ordering
- Cart
- Checkout
- Local Payment record
- Orders
- Dining
- Hold / Retrieve
- Local Print
- Local Day Close

Online failure：
只影響該 Online domain。

Customer 無法正常提交：
→ WhatsApp fallback
→ Send intent/content to store WhatsApp
→ Human handling
→ SMT 後續正式建立 Order

WhatsApp 不成為第二 Order Writer。

## 36. 工程安全驗收

產品行為不變的前提下，工程必須證明：

- Final Payment Confirm 只成功一次。
- Double Tap 不重單。
- Double Tap 不 duplicate first print。
- Double Tap 不 duplicate production。
- Restart 後正式 transaction / hold / pending print 不無故消失。
- Cancel capacity restoration 只一次。
- Payment Correction 不 double count。
- Refund 不刪 Original Order。
- Print UNKNOWN 不 blind retry 造成 duplicate paper。
- Local transaction 不被 Cloud / Admin / Owner / Provider failure 阻塞。
- 所有 UI 只投影同一正式 business truth。

## 37. 實作狀態

Owner Product Requirements：
COMPLETE。

Blocking Owner Product Decision：
NONE。

但 UI 優化實作記錄明確指出：
OWNER FINAL V1 IMPLEMENTATION
= PARTIAL / ACCEPTANCE IN PROGRESS。

仍需完成／完整驗收的主要範圍包括：
- Formal Dining Order Link
- Dining Production Admission
- Dining Print / Receipt / Label / Cash Drawer
- Cross-device Concurrency
- Native Power-loss Recovery
- Exact Combo Tender Detail
- Real SeatedAt
- Admin Dining Warning
- Safari / Real Device Dining Acceptance
- Sold-out / Capacity / Threshold / Override 完整 UI
- More / Tools Center 收斂
- Day Close
- Cash In / Cash Out
- Reporting
- Immutable Daily Report + Later Adjustment
- Printer Failure Attention
- Diagnostics
- Backup / Restore
- Offline / WhatsApp Fallback full acceptance

## 38. 產品 Definition of Done

一名店員可以在 SMT 由頭完成：

Login
→ Ordering
→ Customer / Keeta Pending Handling
→ Product / Required / Combo
→ Cart
→ Hold / Dining
→ Checkout
→ Student Discount（如適用）
→ Final Payment Confirm
→ Formal Order
→ Production / First Print
→ Order Management
→ Ready
→ Pickup
→ Correction / Refund / Reprint（如需要）
→ Day Close
→ Daily Report

並且：
- 本地可持續交易。
- 所有來源最終只落一份正式交易 truth。
- 唔因 UI 快捷而偷改規則。
- 唔因網絡／外部系統故障停止現場營運。
- 唔因 retry / double tap / restart 製造 duplicate money / order / print。
- 所有 correction / refund / reprint / later adjustment 保留完整歷史。
