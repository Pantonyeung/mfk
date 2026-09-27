# MFK SMT Product Brief｜FINAL

版本：FINAL V1.0  
日期：2026-09-27  
產品：MFK SMT  
狀態：OWNER PRODUCT REQUIREMENTS COMPLETE  
實作狀態：PARTIAL / ACCEPTANCE IN PROGRESS

## 1. 產品定位

SMT 係磨飯店內前線主 POS。

主要負責：
- 點單
- 收銀
- 接單
- 堂食
- 打印
- 售罄／產能
- 本地離線執行

產品核心：
快、清楚、大按鈕、固定肌肉記憶、右手操作、本地優先。

SMT UI 只係正式 Order／Pricing／Payment／Print truth 的操作投影，不建立第二套交易引擎。

## 2. 使用者

主要使用者：
- 前線店員
- 店舖 SMT 登入使用者

Owner 最終要求：
有權登入 SMT，即有權操作 SMT 內本 Brief 所述本機設定／功能。
本輪不另外設 Manager-only Gate。

## 3. 主導航

高頻主導航：
1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

低頻工具：
由畫面上方漢堡按鈕進入「更多／工具中心」。

## 4. UI / UX 原則

- 日系極簡
- 專業餐飲 POS
- 藍色為主
- 紅色只用於 destructive / error / 真警示
- 避免兒童化
- 主要彈窗約 75%
- 內容可滾動，但底部主要操作固定
- Checkout Keypad 固定位置
- 高頻主要動作用大按鈕
- 低風險次要操作降低視覺權重
- 系統可以預設最合理下一步，但店員可以手動 Override

介面可調：
- Category 行／列
- Product 行／列
- Product Image 顯示
- Font Scale
- UI Density / Size
- 即時 Preview
- Restart 後保留設定

## 5. 點單頁

### 頂部待處理

自家客戶端 Order：
先進「待處理訂單」。

到店支付：
- 店員檢查內容
- 接受／修改／取消
- 修改／取消同步客戶

電子支付：
- Alipay
- WeChat Pay
- 轉數快
- PayMe
- 日後由 Admin 增減

付款截圖：
只係 Evidence，不等於已付款。
店員人工核對：
- 日期
- 時間
- 金額
- 清晰度
- 是否屬於本次交易

付款證據有問題：
使用該客戶專屬 WhatsApp QR 快速聯絡。

接受後先：
- 正式入 SMT Order Flow
- 記錄付款方式
- 正常打印
- 進製作
- 客戶端收到最新狀態

### Keeta

Keeta 與自家平台分開顯示。

模式：
- 自動接單
- 手動接單

手動接單：
- 即刻處理
- 稍後處理

稍後處理：
- 最多 2 次
- 每次仍保持置頂／亮燈
- 唔等於 Reject／Cancel

Keeta 出錯：
→ 待處理
→ 置頂
→ 亮燈
→ 人工處理

## 6. ETA / 客戶端截單

ETA 負荷只計：
當刻仍未去到「可取餐」的活躍正式訂單。

Admin 可設定：
- 負荷門檻
- ETA 分鐘

正式 Order 成立後：
→ 取得當刻 ETA
→ 開始倒數
→ 到時間可進「可取餐」

SMT 可：
- 設今日特別截單時間
- 即時停止 Customer 新單

只影響 Customer 新單：
- 不停止 SMT 現場交易
- 不取消已成立 Order

## 7. Cart

Cart 頂部：
- 流水號 Preview
- 原單／整理
- 堂食／外賣
- 組合

流水號 Preview：
只作參考，未正式成交不可佔正式號碼。

原單：
保留輸入次序。

整理：
按 Product Category 排序。
只改顯示順序，不改內容／數量。

堂／外：
- 可整單一鍵切換
- 每行仍可獨立切換

組合：
只合併完全相同配置。
不同 Option／Combo／Remark／堂外狀態不得合併。

Cart Line：
- 序號
- 堂／外
- 大字 Product Name
- Option / Combo / Remark
- Qty（組合時）
- Delete

## 8. 暫存／堂食

「暫存」同「堂食」係同一主要入口的兩種 Concept。

預設：
- All Takeaway → 暫存
- Any Dine-in → 堂食

但店員可以隨時切換：
Dining ↔ Hold

普通暫存：
保存完整 Cart，之後用「取單」取回。

堂食：
可以：
- 加入輪候
- 選桌台

清除訂單：
使用低視覺權重 Trash，並需要二次確認。

## 9. 快捷操作

三個核心入口：
1. 快速組合
2. 必選區
3. 紫米套餐區

快速組合：
- 飯團＋小食
- Auto Pair 只按位置順序
- 不做智能推薦
- 不自動補商品
- A / B / C / D… 動態槽位
- 已使用 item 改配對時用 Swap
- 數量不相等時，只組完整 pair
- 剩餘商品保持單點

必選區：
直接讀正式 Required Choice。

紫米套餐：
- A / B / C / D
- 選飯團
- 選小食
- 選飲品

單一飯團／小食／飲品不會自動變套餐。
套餐必須由店員明確建立。

## 10. Product Detail

主要 Product Modal 約 75%。

上：
- Product Name
- Price

左：
- Variation
- Required
- Optional
- Modifier
- Combo
- Remark

右：
- Selected Summary
- Qty
- Current Total

底：
- Qty
- Price Result
- Primary CTA

新增：
「加入購物車」

編輯既有 Cart Line：
「完成修改」

Edit 只更新 SAME Cart Line，不新增第二行。

## 11. 快捷模式

Quick Mode：
有 Required 亦可以先入 Cart。

Normal Mode：
有 Required → 即時開配置。
無 Required → 直接 Add。

但正式 Checkout 前：
所有 Required 必須完成。

未完成：
→ 不可進 Checkout。

## 12. Checkout

Checkout 固定三區：

01｜Source / Channel  
02｜Payment / Source Information  
03｜Keypad / Collection

Keypad 不因切來源／付款方式而移位。

Cash Quick Amount：
- $20
- $50
- $100
- $200
- $500
- Exact

現金顯示：
- 應收
- 實收
- 找續

左側顯示完整訂單摘要。

Checkout 有「返回訂單」。
返回不代表成交。

## 13. 學生優惠

由店員確認 Student Count。

優惠：
合資格特飲半價。

優惠數量：
≤ Student Count

支援：

手動：
店員自己揀最多 N 杯。

一鍵自動：
系統自動揀最多 N 杯，
優先優惠最貴的合資格特飲。

支援：
- 直接輸入人數
- 快捷人數鍵
- 一鍵套用

## 14. Final Payment Confirm

付款前：
出約 75% Final Review。

顯示：
- Channel
- Tender
- Total
- Cash Received / Change
- Pickup Code / External Ref

確認前仍可改 Payment Method。

最後「付款確認」先係正式交易邊界：
- 收款確認
- Formal Submit
- Production
- First Print

之前：
- 開 Checkout
- 返回
- 改 Payment

都不可提前成交。

Payment Confirm 只可以成功一次。

## 15. 訂單頁

版面：
左側＝選中 Order Detail  
右側＝3 Source Lanes

三 Lane：
1. 現場／電話／WhatsApp
2. 自家平台
3. 第三方平台

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
- Customer Name
- Pickup Code

Pickup Code：
只作人工核對，不係 Hard Gate。

Order Detail：
- Items
- Qty
- Line Amount
- Total
- Tender
- Source
- Order No.
- Status
- Reprint
- Modify / Cancel
- Fulfillment

## 16. Fulfillment

核心狀態：

未完成
→ 可取餐
→ 已取餐

「可取餐」可以退返「未完成」。

全程 SAME Order。

## 17. Order Modification / Payment Correction / Refund

Order 修改：
SMT 修改
→ 通知 Customer
→ Customer 確認

金額增加：
→ 補款

金額減少：
→ 退款

Cash Refund：
→ Cash Movement

Payment Method Correction：
- SAME Order
- 原 Tender 留 Audit
- 新 Tender 成為 Current Effective Tender
- Reporting 只計 Current Effective Tender
- 不重新成交
- 不重新送 Production

Refund：
- Full
- Partial
- 原路
- Alternative Refund Method

要求：
- Original Order 保留
- 新建 linked Refund / Adjustment
- 記 Actual Refund Method
- Cash Refund → Cash Movement

## 18. Cancel after Production

已出 Production Ticket 後 Cancel：
→ 必須 Print Cancel Notice

例如：
P00029 取消

Modify：
- 不自動印修改通知
- 店員直接同 Kitchen 溝通

## 19. 堂食

版面：

左：
Waiting / Call

中：
3×3 Tables
- 1–8 室內
- 第 9 格戶外

右：
Selected Table Detail

顯示：
- Table
- Party Size
- Seated Time
- Elapsed
- Items
- Amount
- Payment State

Dining Warning：
Admin 可設定分鐘數。
超時整張 Table Card 變紅。
只作營運提醒。

有位：
Select Table
→ Ordering
→ Production
→ Payment

唔需要：
- 已上餐
- 額外清枱狀態
- 多餘中間流程

付款完成即可收口。

未有位：
Waiting
→ 可先 Formal Order
→ 可先 Production
→ SAME Order 掛 Waiting

有位：
→ SAME Order Assign Table

## 20. 堂食分結帳

按商品拆。

10 件 Product：
最多可拆 10 個 Payment Parts，
不受 Party Size 限制。

每 Part：
- Items
- Amount
- Tender
- Paid / Unpaid

Payment 必須重用同一 Checkout。

## 21. 堂食打印

Dining Page 可直接 Print / Reprint：
- Production
- Packing
- Table Ticket / Unpaid Receipt
- Label

Table Ticket：
- 未付款都可印
- 用作 Table / Serving / Check
- 不代表 Paid
- 不代表 Completed

堂食不建立第二 Print Engine。

## 22. 售罄／恢復

支援：
- Category
- Search
- Sold-out / Paused Filter
- Bulk Sold-out
- Bulk Pause
- Bulk Restore

左側：
Current Sold-out / Paused List

紫米快捷：
- 一鍵紫米售罄
- 一鍵紫米恢復

只影響正式綁定紫米 Pool 的商品。

## 23. Capacity Pool

例：
紫米 Pool = 150

設定：
- Name
- Initial Qty
- Bound Products
- Per-item Consumption
- Channel Thresholds

正式 Order / Accepted Item：
→ 即時扣 Pool

Formal Cancel：
→ 回補 Pool
→ 同一取消只回補一次

Reset：
按 Business Day Start，例如 05:00。

唔按 00:00 Calendar Date。

人工改數：
登入 SMT 即可修正／補貨／調整。
必須保留操作記錄。

## 24. Channel Priority / Override

每條 Channel 有獨立 Threshold。

一般方向：
Capacity 足
→ 全渠道開

到 Third-party Threshold
→ 先停第三方

到 Own Platform Threshold
→ 再停自家平台

Pool = 0
→ 所有綁定遠端渠道停止新單

Existing Orders：
不受影響。

Override：
Pool = 0 仍可以有限量 Override。

記錄：
- Actor
- Time
- Pool
- Scope
- Extra Qty

用完再停止。

## 25. 更多／工具中心

上：
今日即時營運摘要
- Sales
- Orders
- Refund

下：
- Day Close
- Reports
- Devices
- Printing
- Check Center
- Backup
- Restore
- Diagnostics
- Admin Sync

## 26. Day Close / Cash

顯示：
- Opening Cash
- Today Sales
- Expected Cash
- Counted Cash
- Variance
- Withdrawal
- Retained Cash

Cash Count：
$1 / $2 / $5 / $10 / $20 / $50 / $100 / $500

兩種模式：
- Denomination Count
- Direct Total

Variance：
Counted - Expected

必須顯示：
- 數字
- 正／負方向

## 27. Cash In / Cash Out

每筆：
- Amount
- Reason
- Time
- Actor
- Note

Cash In / Out：
≠ Sales
≠ Refund
≠ Payment Correction

Expected Cash：
Opening
+ Cash Sales
+ Cash In
- Cash Refund / Adjustment
- Cash Out

留櫃：
可作下一 Business Day Opening Cash。

所有變化必須有 Ledger Record，
不可靜默改 Balance。

## 28. Day Close Reporting

Channel Summary：
每個 Channel 顯示：
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

無法可靠知道 Electronic Provider：
→ Electronic Unclassified
→ 不自行猜 Provider

由 Cash 對數反推：
只作 Reporting Classification，
不改 Order Truth。

## 29. Daily Report

Day Close 完成後形成正式 Daily Report。

可：
- View
- History
- Print
- Reprint

內容：
- Sales
- Effective Sales
- Order Count
- Refund / Cancel / Adjustment
- Channel Summary
- Tender Summary
- Cash In / Out
- Expected / Actual / Variance
- Withdrawal / Retained

Product Analysis：
- Product
- Qty
- Sales Amount
- Ranking
- Top Seller
- Low Seller
- Zero Seller

Owner 只讀同一 Reporting Truth。

跨日 Refund / Correction：
- Original Daily Report Immutable
- 新增 Append-only Linked Adjustment
- Link Original Order / Report

## 30. Print Responsibility

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
「實際邊部機係嗰個目的地」

SMT 不做 Template Authoring，
亦不建立第二 Product Routing。

## 31. Reprint

入口：
Order Detail → Reprint

80mm：
- Receipt
- Production
- Packing

Whole Ticket Reprint。

Label：
- 每張獨立
- 先選 Route
- All / Multi / Partial

Reprint：
- 不改 Order
- 不重新付款
- 不重新成交

## 32. Printer Failure / Diagnostics

Printer Failure：
- 亮燈
- 通知
- 進 Attention
- 人手檢查 Printer / Connection
- 必要時修改 Physical IP

系統不自行猜 Physical Print Result。

Admin Sync：
顯示：
- Sync State
- Last Sync
- Pending
- Failure

Diagnostics：
前線先顯示可理解摘要，
工程 Detail 再深入。

Backup / Restore：
低頻工具，
不得阻日常交易。

## 33. Offline / WhatsApp Fallback

SMT Offline：

除真正 Online 能力外，
本地全部照常：
- Ordering
- Cart
- Checkout
- Local Payment Record
- Orders
- Dining
- Hold / Retrieve
- Local Print
- Day Close

Online Failure：
只影響該 Online Domain。

Customer Submit Fail：
→ WhatsApp Fallback
→ Store Human Handling
→ SMT 正式處理

WhatsApp 不成為第二 Order Writer。

## 34. 工程驗收守門

必須證明：

- Payment Confirm 只成功一次
- Double Tap 不 duplicate Order
- Double Tap 不 duplicate first print
- Double Tap 不 duplicate production
- Restart 後正式 transaction / hold / pending print 不無故消失
- Cancel Capacity Restore 只一次
- Payment Correction 不 double count
- Refund 不刪 Original Order
- Print UNKNOWN 不 blind retry 造成 duplicate paper
- Cloud / Admin / Owner / Provider failure 不阻本地交易
- UI 不建立第二 Pricing / Order / Payment / Print Authority

## 35. Definition of Done

店員可以完整完成：

Login
→ Ordering
→ Customer / Keeta Pending
→ Product / Required / Combo
→ Cart
→ Hold / Dining
→ Checkout
→ Student Discount（如適用）
→ Final Payment Confirm
→ Formal Order
→ Production
→ First Print
→ Order Management
→ Ready
→ Pickup
→ Correction / Refund / Reprint
→ Day Close
→ Daily Report

## 36. 當前狀態

OWNER PRODUCT REQUIREMENTS：
COMPLETE

BLOCKING OWNER PRODUCT DECISION：
NONE

但 Implementation：
PARTIAL / ACCEPTANCE IN PROGRESS

未完成部分不代表產品要求未定義；
只代表仍需要工程落地／測試／實機驗收。
