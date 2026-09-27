# MFK SMT｜Stage 3 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 3｜外部新單接入

## 0. Stage 定位
Stage 3 負責「外部來源新單由收到 → 人工／規則核對 → 正式接受或處理」。
佢唔應成為另一個主導航頁，而係嵌入 Stage 1 點單頁頂部 Incoming Strip，再用 Review Modal 完成處理。

來源分開：
- 自家客戶端
- Keeta

兩者 UI 可以相鄰，但身份、規則、證據、Provider 狀態必須分開。

核心邊界：
- Received ≠ Accepted
- 有付款截圖 ≠ 已付款
- Defer ≠ Reject / Cancel / Accept
- Accept 成功後先正式進 Stage 4 Order
- 禁止因 Retry 重複建單／重複付款／重複首次打印

## 1. Surface 3A｜Incoming Strip

### 位置
Stage 1 點單頁頂部。

### 區域
A. 自家客戶端待處理
B. Keeta

每邊顯示：
- 待處理數量
- 最優先 1–2 張摘要卡
- 「更多」入口
- Attention 狀態

### 卡片最少顯示
自家客戶端：
- 客戶稱呼／姓名
- 件數
- 總額
- 付款方式
- 等候時間／收到時間

Keeta：
- Keeta
- 外部單號
- 件數
- 總額
- 等候時間／收到時間
- Defer 次數（如有）

### 行為
點卡：
→ 打開 Stage 3 Review Modal

唔可以：
直接喺 Strip 內一鍵靜默 Accept（除非 Keeta 已啟用正式 Auto Accept 規則）。

## 2. Surface 3B｜自家客戶端 Pending Review 75% Modal

### Header
- CUSTOMER ORDER
- 顯示號碼／Pending identity
- 客戶姓名
- 收到時間
- 付款方式
- 狀態：待處理

### 左側：Order Summary
- 商品
- 數量
- Option／Combo
- 備註
- 總件數
- 總額

### 右側：處理區
按付款類型分：
A. 到店支付
B. 電子支付

底部固定 Action：
- 修改
- 取消
- 接受

接受只喺守門通過先 Enable。

## 3. Scenario 3C｜自家客戶端：到店支付

### UI
顯示：
- 到店支付
- 訂單內容
- 商品可供應狀態
- 客戶資料

### 員工動作
A. 可以供應
→ 接受

B. 部分商品有問題
→ 修改

C. 無法處理
→ 取消

### 接受成功
→ 進正式 Order
→ Stage 4
→ 正常 Print／Production
→ 客戶端收到已接受／處理中

### 守門
Accept 必須防重。
同一 Pending Source 只能 formalize 一次。

## 4. Scenario 3D｜自家客戶端：電子支付

目前支援：
- Alipay
- WeChat Pay
- FPS／轉數快
- PayMe

### Header 額外顯示
- 客戶選擇付款方式
- 應付總額
- Evidence 狀態

### 核心
付款截圖只係 Payment Evidence。
唔係 Payment Truth。

## 5. Surface 3E｜Payment Evidence Viewer

### 預設區
右側顯示縮圖。

### 點擊
→ 放大 Evidence Viewer

### 放大後
清楚睇：
- 日期
- 時間
- 金額
- 圖片清晰度
- 圖片是否似今次交易

### Evidence Review 狀態
- 未核對
- 已核對／通過
- 有問題

### 未核對
Accept Disabled。

### 通過
Accept 可進下一步。

### 有問題
顯示 WhatsApp 快速聯絡。

## 6. Surface 3F｜WhatsApp QR

### 位置
Pending Review 右側 Evidence 區。

### 用途
店員用手機掃描，
直接打開該客戶 WhatsApp，
並預填指定訊息。

### 預設情境
- 日期唔啱
- 時間唔啱
- 金額唔啱
- 截圖唔清
- 請重新上傳付款證明

### UI
上：
QR Code

下：
訊息模板 Quick Select

選擇後：
QR／Deep Link 對應指定模板。

### 原則
- 必須對應該張 Order 客戶
- 店員唔需要再搵電話
- 唔自動 Send
- WhatsApp 只係溝通／Fallback
- 唔成為第二 Order Writer

## 7. Surface 3G｜修改 Pending Order

### 目的
處理商品無法提供／內容需修改。

### 入口
Pending Review → 修改

### 顯示
- 原訂單
- 要改嘅 Line
- 目前可供應選項
- 修改後總額（如系統已可正式 Quote）

### Action
- 保存修改
- 返回

### 成功後
- Pending Order 保持同一來源身份
- 客戶端收到修改結果
- 返回 Review

### 重要限制
來源文件只明確鎖定「修改結果要同步客戶端」。
「修改後是否必須由客戶再次確認先可正式接受」喺現有 Brief 未有足夠 UI 規則支持。
Stage 3 R1 唔自行加呢個 Gate；留作後續 Addendum／明確產品決定。

## 8. Surface 3H｜取消 Pending Order

### 入口
Pending Review → 取消

### Confirm
顯示：
- 客戶
- 件數
- 總額
- 取消影響

Actions：
- 返回
- 確認取消

### 成功
- Pending 狀態結束
- 客戶端收到取消
- 不建立正式 Order
- 不打印首次正式票
- 不進 Production

## 9. Surface 3I｜Keeta Pending Review

### Header
- KEETA ORDER
- 外部 Order No
- 件數
- 總額
- 收到時間
- Defer 0 / 2、1 / 2、2 / 2

### Summary
- 商品
- Mapping 結果
- Option Mapping
- Remark
- Payment / Provider metadata
- 售罄／可供應狀態
- Provider Attention（如有）

### Actions
手動模式：
- 稍後處理
- 即刻處理

如果正式核對流程打開後：
- 接受
- 拒絕／無法處理（按 Provider 支援）
- 返回

## 10. Scenario 3J｜Keeta 手動接單

### 第一次收到
Incoming Strip 置頂＋亮燈。

點入：
→ Review

Actions：
A. 即刻處理
B. 稍後處理

### 即刻處理
→ 核對 mapping／sellability／內容
→ 通過後正式 Accept
→ Stage 4

### 稍後處理
第一次：
0 / 2 → 1 / 2

第二次：
1 / 2 → 2 / 2

之後：
唔再提供無限 Defer。

### Defer 後
- Order 保持 Pending
- Incoming Strip 保持可見
- 重新置頂／亮燈
- 不 Reject
- 不 Cancel
- 不 Accept

## 11. Scenario 3K｜Keeta Auto Accept

### 設定來源
Admin／SMT 正式設定。

### Happy Path
Keeta Order
→ Mapping valid
→ 無售罄／內容問題
→ 自動正式 Accept
→ Formal Order
→ Print
→ Production
→ Stage 4

### UI
唔需要每張彈 Review Modal。

Incoming Strip：
可短暫顯示「已自動接單」或直接移入 Stage 4 Order。

### Exception
任何：
- Mapping Error
- Sellability 問題
- Identity Conflict
- Provider 異常
- 內容不完整

→ 唔自動猜
→ 進 Pending / Attention
→ 置頂
→ Stage 3 Review

## 12. Scenario 3L｜Keeta Provider Failure

### 類型
- Provider callback UNKNOWN
- Provider command failure
- Provider unavailable
- Mapping mismatch
- Duplicate event
- Identity conflict

### UI 原則
Provider 問題只影響呢張 Provider Order／Provider action。

唔可以：
- 阻 Stage 1 現場點單
- 阻 Stage 2 現場付款
- 阻已成立本地 Order

### UNKNOWN
顯示：
「本地處理狀態已保存；Keeta 回覆結果待確認。」

先：
Provider Readback／Reconcile

禁止：
Blind Retry。

## 13. Accept 成功後嘅 Handoff

### 自家客戶端
Pending
→ Accept
→ SAME source identity linked to Formal Order
→ Print / Production
→ Stage 4

### Keeta
Provider Order
→ Accept / canonical intake
→ ONE Formal Order
→ Provider identity linked
→ Print / Production
→ Stage 4

### 必須保持
- Source identity
- External Order No
- Customer identity（如有）
- Provider reference
- Payment evidence lineage（如有）

## 14. Stage 3 Attention / Priority

### Priority 0
Payment Evidence 未核對
Mapping Error
Identity Conflict
Provider command UNKNOWN

### Priority 1
普通 Pending Order
Keeta 第 2 次 Defer

### Priority 2
Keeta 第 1 次 Defer
普通新單等待處理

### 顯示方式
- 置頂
- Badge
- Border／亮燈
- 等候時間

避免：
全畫面阻塞式 Alarm。

## 15. Stage 3 Empty / Loading / Error

### Empty
Incoming Strip：
「暫無待處理單」

### Loading
只 Loading 該張卡／該份 Evidence。
唔遮住 Stage 1 點單。

### Evidence Load Fail
顯示：
「未能載入付款截圖」
→ Retry Evidence Load
→ Accept 保持 disabled

### Provider Load Fail
保留已知資料；
明確標示 stale／unknown。

## 16. Stage 3 明確不屬於本 Stage

唔喺 Stage 3 做：
- 正式現場 Checkout → Stage 2
- Fulfillment 推進 → Stage 4
- 正式 Order Payment Correction → Stage 5
- Refund → Stage 5
- 堂食 → Stage 6
- 全店 Sellability 管理 → Stage 7

## 17. Stage 3 Definition of Done

1. Customer／Keeta Incoming 明確分開。
2. Incoming Strip 唔阻 Stage 1 點單。
3. Received 不等於 Accepted。
4. 到店支付可接受／修改／取消。
5. 電子支付 Evidence 可放大。
6. Evidence 未核對不可 Accept。
7. WhatsApp QR 對應正確客戶＋模板。
8. Payment Evidence 唔當 Payment Truth。
9. Pending 修改／取消結果同步客戶端。
10. Keeta 手動模式支援即刻／稍後。
11. Defer 最多 2 次。
12. Defer 唔等於 Reject／Cancel／Accept。
13. Keeta Auto Accept 只喺所有守門通過。
14. Mapping／Provider 異常進 Attention，唔自動猜。
15. Accept 防重，不建第二 Formal Order。
16. Accept 成功先 Print／Production。
17. Provider Failure 不阻本地交易。
18. 成功後交 Stage 4 正式訂單營運。

## 18. 下一個 Stage
Stage 4｜正式訂單營運／出餐
