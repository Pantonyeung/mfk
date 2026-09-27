# MFK SMT｜Stage 5 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 5｜正式交易修正／取消／退款

## 0. Stage 定位
Stage 5 專門處理「正式 Order 已成立之後」嘅逆向／修正操作。

入口主要由 Stage 4 Order Detail 進入。

核心原則：
- SAME Order 優先
- 原交易歷史永久保留
- 修正以 linked record / correction history 追加
- 唔可以用「重新落一張單」代替修正
- 唔可以因修正而重複付款、重複首次打印、重送 Production
- 修改、付款方式修正、退款、取消係四種不同語義，唔可以混成一個「編輯訂單」

## 1. Page / Surface 架構

Stage 5 唔建議做獨立主導航頁。

由：
Stage 4 → Order Detail →「更多操作／售後」

打開 Action Sheet / 75% Modal，分四個入口：

1. 修改訂單
2. 更正付款方式
3. 退款
4. 取消訂單

每個入口進入自己獨立流程。

## 2. Surface 5A｜售後操作選單

### Header
顯示：
- 流水號
- Order No
- 來源
- 當前狀態
- 付款方式
- 總額

### Actions
- 修改訂單
- 更正付款方式
- 退款
- 取消訂單
- 返回

### 視覺
高風險 Action：
- 退款
- 取消

使用 destructive 樣式。

修改／付款方式修正：
不應用同等危險紅色。

## 3. Flow 5B｜修改正式訂單

### 目的
正式成交後，因客戶要求／商品問題，修改已存在 Order 內容。

### 入口
Order Detail
→ 修改訂單

### 畫面
左：
原 Order Snapshot

右：
可修改內容

最少包括：
- 商品
- 數量
- Option／Modifier
- Combo 內容
- 備註
- 堂／外（如仍適用）

### 修改後 Summary
顯示：
- 原總額
- 新總額
- 差額
- 增加／減少

### 結果分三類
A. 金額不變
B. 加價
C. 減價

## 4. Scenario 5C｜修改後金額不變

### Flow
修改內容
→ Review
→ 保存修正
→ SAME Order

### 結果
- Order identity 不變
- Original Snapshot 保留
- Append correction history
- Fulfillment 按修正後內容繼續

### Print
如果已經出過 Production：
唔自動打印「修改通知單」。

產品要求：
店員直接同廚房溝通。

## 5. Scenario 5D｜修改後加價

### UI
明確顯示：
原總額
→ 新總額
→ 需補款金額

### Flow
修改
→ 客戶確認
→ 補款
→ SAME Order 更新 effective amount
→ correction history

### 補款
應回到正式付款能力處理，
唔喺 Stage 5 自建第二套 Payment Engine。

### 守門
補款完成前：
唔應假裝新總額已完全收妥。

## 6. Scenario 5E｜修改後減價

### UI
顯示：
原總額
→ 新總額
→ 應退款金額

### Flow
修改
→ 客戶確認
→ 退款流程
→ linked refund / adjustment
→ SAME Order effective amount 更新

### 退款方式
可：
- 原路退款
- 同客戶協議用另一方式退款

## 7. Customer Confirmation｜正式修改確認

Owner Requirement 已鎖：
SMT 修改
→ 通知客戶
→ 客戶確認

### UI 狀態
至少需要：
- 待客戶確認
- 客戶已確認
- 客戶拒絕／未確認

### 注意
現有 Brief 未完整定義：
- 客戶端確認 UI 長相
- Confirmation timeout
- 客戶無回覆時可唔可以由店員 Override

Stage 5 R1 只保留狀態位，
唔自行發明 Override 規則。

## 8. Flow 5F｜Payment Method Correction

### 目的
正式成交後發現付款方式記錯。

例如：
CASH
→ FPS

### 核心
SAME Order

原付款：
永久留 Audit

新付款方式：
成為 Current Effective Tender

### UI
Header：
- Order
- 原付款方式
- 當前有效付款方式

選擇：
- CASH
- Alipay
- WeChat Pay
- FPS
- PayMe
- 其他 Admin 有效 Tender

可選：
- 快捷原因
- 自填原因
- 不填原因

原因：
OPTIONAL / NON-BLOCKING

### Final Review
顯示：
原付款方式
→ 新付款方式

主要 Action：
「確認更正」

## 9. Payment Correction 結果

確認後：
- SAME Order
- 新 Tender 成為 current effective tender
- 舊 Tender 留 history
- Reporting 只計 current effective tender

禁止：
- 建新 Order
- 新 Display Number
- 重送廚房
- 重新成交
- 自動重印
- 自動開 Cash Drawer
- 新 First Print Admission

### Repeated Correction
例如：
CASH → FPS → PayMe

History：
CASH
→ FPS
→ PayMe

Current Effective Tender：
PayMe

Reporting：
只計 PayMe 一次。

## 10. Flow 5G｜Refund

### 入口
Order Detail
→ 退款

### 第一層
選：
- Full Refund
- Partial Refund

## 11. Scenario 5H｜Full Refund

### 顯示
- 原 Order 總額
- 已退款金額（如有）
- 今次可退金額
- 退款方式

### 退款方式
- 原付款方式
- 其他退款方式

### Final Review
顯示：
- Order
- Refund Amount
- Refund Method
- Reason（如有）

Action：
「確認退款」

### 成功
- 原 Order 保留
- 建 linked Refund Record
- 記錄實際 Refund Method
- 更新 effective financial result

## 12. Scenario 5I｜Partial Refund

### 選擇方式
以商品為主：
- 選 Line
- 可選部分數量（如正式 refund primitive 支援）
- 顯示該部分退款金額

### UI
左：
原 Order Lines

右：
Refund Selection

底：
- Selected Amount
- Remaining Refundable
- Refund Method
- Confirm

### 結果
建立 linked Partial Refund。

原 Order：
唔刪除。

## 13. Cash Refund

如果實際退款方式係 CASH：

成功後：
→ 建 Cash Movement OUT

### UI
Refund Result 顯示：
- Refund Amount
- CASH
- Cash Movement 已記錄

### 禁止
退款唔可以靜默改 Sales Cash 數字而冇 Cash Movement 記錄。

## 14. Refund Result State

### SUCCESS
linked refund 已建立。

### KNOWN FAILURE
確定冇退款 side-effect。

### UNKNOWN
外部退款／Provider 結果未知。

### UNKNOWN UI
顯示：
「退款結果待確認」

先：
readback / reconcile

禁止：
未知時再按一次造成 double refund。

## 15. Flow 5J｜取消訂單

### 入口
Order Detail
→ 取消訂單

### Confirm Modal
顯示：
- 流水號
- 商品件數
- 總額
- 付款狀態
- Production／Print 狀態
- 取消原因

### Action
- 返回
- 確認取消

### 核心
Cancel
≠ Refund

如果已付款：
取消同退款係兩件事。
UI 必須分開顯示。

## 16. Scenario 5K｜未出 Production 前取消

### 成功
- SAME Order → Canceled
- 保留原歷史
- 停止未發生 Production side-effect
- 如 Capacity 已扣，按正式規則回補一次

### Print
唔需要取消通知單，
因為 Production 未真正出過。

## 17. Scenario 5L｜已出 Production 後取消

Owner Requirement：
如果製作單已經真正出過
→ 必須打印「取消通知單」

### Cancel Notice
內容最少：
- 流水號
- 「取消」
- 必要識別資料

例：
P00029 取消

### 注意
取消通知：
係新 Print Side-effect。

唔係：
- 重印舊製作單
- 刪舊 Print History

## 18. 修改 vs 取消 Print 規則

正式取消：
如果 Production 已出
→ 自動產生取消通知單

正式修改：
→ 不自動產生修改通知單
→ 店員直接同廚房溝通

呢兩個行為要明確分開。

## 19. Surface 5M｜售後 Timeline

Stage 5 完成任何操作後，
Order Detail 應可查看 Timeline：

例如：
12:01 正式成交
12:05 Payment Correction：CASH → FPS
12:08 修改商品
12:10 Partial Refund $10
12:15 Cancel

每項顯示：
- Action
- 時間
- 操作員
- 原值
- 新值
- Reason（如有）
- Result

前線顯示人類可理解內容，
技術 ID 收入詳細層。

## 20. Surface 5N｜Customer / Provider Sync Attention

如果正式修改／取消／退款需要通知 Customer／Provider：

UI 可顯示：
- 已同步
- 待同步
- 失敗
- UNKNOWN

### 原則
本地 canonical correction 成功
≠ Provider callback 一定成功。

Provider Sync Failure：
進 Attention／Reconcile。

唔可以把已成功本地修正重新 Rollback。

## 21. Restart / Recovery

### Payment Correction
Restart 後：
讀到
- SAME Order
- correction history
- current effective tender

### Refund
讀到：
- 原 Order
- linked refund
- 已退款金額
- remaining refundable

### Cancel
讀到：
- Canceled Order
- Cancel reason
- Cancel Notice Print status（如適用）

### UNKNOWN
保持 UNKNOWN，
直到 readback/reconcile 有答案。

## 22. 權限呈現

Owner FINAL 已鎖：
有權登入 SMT
→ 就有權操作本文件所述 SMT 功能。

所以 Stage 5 R1：
唔另外設 Manager-only Gate。

但 UI 仍要：
- 顯示操作人
- 保留 Audit
- 高風險 Action 二次確認

## 23. Stage 5 Page States

### Empty
由有效正式 Order 先可以進 Stage 5。
冇 Order：
唔顯示售後 Action。

### Loading
只 Loading 當前售後資料。
唔遮 Stage 4 全頁。

### Stale
如果 Order revision 已變：
→ 阻止舊畫面提交
→ Fresh Read
→ 要求重新核對

### Conflict
顯示：
「訂單已被更新，請重新查看最新內容。」

禁止 last-write-wins。

## 24. Stage 5 明確不屬於本 Stage

- Draft Cart 修改 → Stage 1
- 初次付款 → Stage 2
- Pending Customer／Keeta 未正式接單 → Stage 3
- Fulfillment → Stage 4
- 堂食桌台操作 → Stage 6
- Capacity 日常管理 → Stage 7
- 日結 → Stage 9
- Printer physical recovery → Stage 11

## 25. Stage 5 UI 優先級

P0：
- SAME Order correction
- Payment Method Correction
- Full Refund
- Partial Refund
- Cancel
- Cancel Notice
- Audit History
- UNKNOWN 防重

P1：
- Customer confirmation state
- Provider sync Attention
- Quick Reasons
- Timeline polish

P2：
- 動畫
- 深層統計

## 26. Stage 5 Definition of Done

1. 售後入口由正式 Order Detail 進入。
2. 修改／付款方式修正／退款／取消四種語義分開。
3. 正式修改保持 SAME Order。
4. 修改前後金額差異清楚。
5. 加價導向補款。
6. 減價導向退款。
7. 正式修改保留客戶確認狀態。
8. Payment Correction 保留原 Tender History。
9. Reporting 只計 Current Effective Tender。
10. Payment Correction 唔重印／唔開 Drawer／唔重送 Production。
11. Full／Partial Refund 保留原 Order。
12. Refund 建 linked record。
13. Cash Refund 建 Cash Movement OUT。
14. Refund UNKNOWN 唔 blind retry。
15. Cancel 同 Refund 分開。
16. 已出 Production 後 Cancel 會產生取消通知單。
17. 修改訂單唔自動打印修改通知。
18. 所有售後操作有 Audit Timeline。
19. Restart 後可重建 current effective state。
20. Stale revision 會 fail-closed。
21. 完成後返回 Stage 4 Order Detail。

## 27. 下一個 Stage
Stage 6｜堂食／輪候
