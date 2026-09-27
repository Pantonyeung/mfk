# MFK SMT｜Stage 2 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 2｜Checkout／付款／正式成交

## 0. Stage 定位
Stage 2 係由「已準備好嘅 Cart」收斂成「正式交易」嘅唯一前線付款旅程。

核心邊界：
- 入 Stage 2 前仍然只係 Cart／Intent
- 最後付款確認前，全部操作都可返回／修改
- 只有最後「付款確認」先可以正式 Commit
- 正式 Commit 只可以成功一次
- 成功後先建立正式 Order／正式流水號／Payment facts／Fulfillment／Print Admission
- Completion Review 只係結果確認，唔係第二次成交

## 1. Page 2A｜Checkout 主畫面

### 建議固定版面
左側：Order Summary
右側：Checkout Flow

左側固定顯示：
- 商品
- 數量
- Option／Modifier／Combo
- 備註
- 每行金額
- 總件數
- 小計
- 包裝／附加費
- 優惠
- 總額
- 返回訂單

右側分區：
01 來源／渠道
02 付款方式
03 金額結算
04 現金／組合付款
05 優惠／備註（如適用）
06 Final Review

原則：
切換付款方式／渠道時，主要操作幾何位置唔應跳動。

## 2. Section 2B｜來源／渠道

可選來源：
- 現場
- 電話／WhatsApp
- 自家平台
- Keeta
- Foodpanda

### 現場
唔需要額外外部識別資料。

### 電話／WhatsApp
可輸入：
- 客戶電話
- WhatsApp 聯絡資料

### 自家平台／Keeta／Foodpanda
按來源顯示：
- 平台取餐碼
- 外部訂單號碼
- 客戶資料（如有）

### 使用場景
1. 現場單
2. 電話單
3. WhatsApp 單
4. 自家平台單
5. Keeta 單
6. Foodpanda 單
7. 來源資料缺失
8. 來源切換

### 守門
來源切換只改 transaction metadata。
唔可以因換來源而：
- 建新 Cart
- 重算另一套價錢
- 派正式流水號

## 3. Section 2C｜付款方式

現場可用：
- 現金
- Alipay
- WeChat Pay
- FPS／轉數快
- PayMe
- 日後 Admin 發布嘅其他付款方式

另有：
- 組合付款

### 顯示原則
所有付款方式固定格位。
不可因選中不同付款方式令 Keypad／主要按鈕跳位。

### Admin 關係
付款方式清單由正式設定提供。
SMT 唔自己硬寫第二套支付方式 authority。

## 4. Section 2D｜現金付款

### 顯示
- 應收
- 實收
- 找續

### 快捷鍵
- $20
- $50
- $100
- $200
- $500
- 剛剛好

### 鍵盤
固定數字 Keypad。

### 使用場景
1. 剛好付款
2. 客人畀 $20
3. $50
4. $100
5. $200
6. $500
7. 手動輸入其他金額
8. 實收不足
9. 刪除輸入
10. 超額付款／找續

### 守門
實收 < 應收：
→ 不可付款確認。

找續：
只作現金 Tender result。

## 5. Section 2E｜電子付款

選中：
- Alipay
- WeChat Pay
- FPS
- PayMe

### 行為
- 不需要顯示現金 Keypad
- 保留同一 Checkout 幾何
- 顯示應付總額
- 顯示付款方式

### 使用場景
1. 正常電子付款
2. 店員揀錯方式後更改
3. 返回訂單再返 Checkout
4. 正式確認前再次切換付款方式

### 原則
付款方式被選中 ≠ 已付款。
只有 Final Confirm 成功先形成正式 Payment fact。

## 6. Section 2F｜組合付款

### 目的
同一張交易可用多種 Tender 分配付款。

### 顯示
每個 Tender 一行：
- 付款方式
- 金額

底部：
- 應付總額
- 已分配
- 尚餘／超出

### 使用場景
1. 現金 + FPS
2. 現金 + PayMe
3. FPS + Alipay
4. 多個 Tender
5. 合計不足
6. 合計超出
7. 完全等於應付

### 守門
組合付款總和必須精確等於應付總額。

### 核心語義
Split Tender ≠ Split Order。
仍然係 SAME Order。

## 7. Section 2G｜學生優惠

### 產品要求
只由現場店員確認學生人數。

合資格：
指定特飲半價。

例：
- $6 → $3
- $8 → $4
- $10 → $5

### 介面
A. 學生人數
- 直接輸入
- 快捷人數

B. 優惠模式
- 手動選
- 自動選

### 手動模式
店員最多揀 N 杯合資格飲品。

### 自動模式
系統最多揀 N 杯，
並優先優惠價格最高嘅合資格特飲。

### 場景
1. 1 位學生
2. 多位學生
3. 飲品數少過學生數
4. 飲品數多過學生數
5. 手動揀
6. 自動揀
7. 更改學生人數
8. 取消學生優惠

### 守門
優惠杯數 ≤ 已確認學生人數。

## 8. Surface 2H｜Final Review 75% Modal

### 開啟時機
當所有 Checkout 條件完成，
店員按「確認結帳／下一步確認」。

### 顯示
- 來源
- 付款方式
- 組合付款明細（如有）
- 總件數
- 總額
- 現金實收
- 找續
- 學生優惠（如有）
- 取餐碼／平台單號（如有）
- 重要備註

### Actions
主要：
「付款確認」

次要：
「返回修改」

### 最重要邊界
呢個「付款確認」先係 FORMAL COMMIT。

之前任何：
- 返回
- 改付款
- 改來源
- 改現金
- 重開 Checkout
都不可正式成交。

## 9. Transaction Commit

付款確認成功後一次建立／確定：
- Formal Order
- Display Number
- Payment facts
- Current effective tender
- Fulfillment initial state
- Print Admission
- Outbox／projection facts（如適用）

### 必須原子／防重
同一 submission：
只可以成功一次。

### Double Tap
第二次：
→ 返回原本成功結果
→ 不建立第二張 Order
→ 不派第二個流水號
→ 不建立第二輪首次打印

## 10. Payment Result States

### SUCCESS
已確認正式成交。

### KNOWN FAILURE
已知未成交。
例如：
- 驗證失敗
- 現金不足
- 組合付款不等
- local commit 明確 reject

UI：
顯示可修正原因。

### UNKNOWN
無法確認正式結果。

UI 必須：
- 顯示「正在確認交易結果」
- 禁止再建立新 submission
- 先 readback
- 找到原 Order → 回原成功結果
- 確認未建立 → 才可安全重試

禁止：
UNKNOWN → 直接當 FAILED → 新建第二單。

## 11. Surface 2I｜Completion Review

付款成功後顯示。

### 顯示
- 正式流水號／取餐號
- 付款方式
- 應付
- 實收／找續（現金）
- 交易成功
- 打印狀態摘要
- Provider 狀態摘要（如適用）

### Actions
主要：
「完成」

可選：
- 查看訂單
- 重印（如之後產品決定要放此入口）

### 核心
「完成」只係：
關閉 Completion Review
→ 返回 Stage 1 新 Cart
或
→ 導航 Stage 4 訂單

禁止：
- 再 Commit
- 再收款
- 再開 Drawer
- 再建立 Print Admission

## 12. Print／Drawer UI 狀態

成功 Commit 後先處理。

### 正常
- 交易成功
- 打印已送出／已完成

### Print Failure
交易已成功：
Print Failure 只係 Print domain Attention。
唔可以把 Order 回滾成未成交。

### Print UNKNOWN
顯示：
「交易已完成；打印結果未知，請先檢查打印狀態。」

禁止 blind reprint。

### Cash Drawer
只可以按正式現金付款政策執行一次。
Completion Review／Retry 唔可以再次開 Drawer。

## 13. Stage 2 返回／修改規則

### Final Confirm 前
允許：
- 返回 Stage 1
- 改商品
- 改來源
- 改付款方式
- 改學生優惠
- 改現金輸入

### Final Confirm 後
不可再回 Stage 1 當普通 Cart 修改。

如正式成交後需要改：
→ Stage 5 正式交易修正。

## 14. Error／Recovery

### Required 漏選
正常應該喺 Stage 1 已被擋。
如仍然發現：
→ 返回對應 Cart Line 修正
→ 不成交

### Pricing／Availability Material Change
如果正式 Commit 前發現：
- 價格變
- 商品停售
- 必要配置失效

→ 顯示變更
→ 返回 Stage 1 修正／重新確認
→ 不靜默成交

### App Kill／Restart
如果 Confirm 前：
→ 恢復 Checkout Intent／Cart

如果 Confirm 中：
→ readback transaction result

如果已成功：
→ 直接恢復 Completion Review／正式 Order
→ 不再收第二次

## 15. Stage 2 UI 優先級

P0：
- Final transaction boundary
- Cash keypad
- Tender selection
- Combo tender validation
- Final Review
- SUCCESS／FAILURE／UNKNOWN
- Double Tap safety
- Restart readback

P1：
- 學生優惠
- 來源 metadata
- Completion Review polish
- Print／Provider status summary

P2：
- 動畫
- 非必要微互動

## 16. Stage 2 明確不屬於本 Stage

以下唔喺 Stage 2 處理：
- Customer Payment Evidence 核對 → Stage 3
- Keeta 接／拒單 → Stage 3
- Fulfillment 推進 → Stage 4
- Payment Correction → Stage 5
- Refund → Stage 5
- 堂食桌台管理 → Stage 6
- 日結 → Stage 9

## 17. Stage 2 Definition of Done

1. Checkout 來源／付款／金額資訊清楚。
2. Payment Method 切換唔令主要幾何跳位。
3. Cash 有 $20／$50／$100／$200／$500／剛剛好。
4. 實收不足不能確認。
5. 組合付款總額必須精確對上。
6. 學生優惠杯數不超學生人數。
7. Final Review 之前完全未正式成交。
8. Final「付款確認」係唯一 Formal Commit 邊界。
9. Double Tap 不產生第二交易。
10. UNKNOWN 先 readback，唔 blind retry。
11. 成功後一次建立正式 Order／Display／Payment／Print Admission。
12. Completion Review「完成」只導航，不再次成交。
13. Print Failure 不回滾 Order。
14. Restart 可恢復正確交易結果。
15. 正式成交後修改全部交 Stage 5。

## 18. 下一個 Stage
Stage 3｜外部新單接入
