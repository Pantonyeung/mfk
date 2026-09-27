# MFK SMT｜Stage 7 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 7｜售罄／產能／接單控制

## 0. Stage 定位
Stage 7 負責前線即時控制「而家賣唔賣得、仲有幾多產能、邊個渠道要停、幾時截單」。

核心原則：
- 售罄／暫停／Capacity／Channel Stop 係不同語義
- 只影響之後嘅新單
- 唔取消已成立 Order
- 唔自動退款
- Capacity Pool 係營運供應控制，唔可以變成第二套 Pricing／Order Engine
- 人工 Override 必須可追溯
- UI 唔一次攤晒所有商品

## 1. Page 7A｜售罄／產能主頁

### 頂部
- 搜尋
- Category
- Filter：全部／售罄／暫停
- 紫米快捷控制
- Customer Ordering 狀態
- 今日特別截單時間

### 左側
「目前售罄／暫停」
- Product
- 狀態
- 來源
- 生效時間
- 恢復入口

### 中央
商品列表
- Product
- Category
- 目前狀態
- Capacity 關聯
- Channel 狀態摘要

### 右側
Capacity Pool／Channel Control Detail
- Pool 剩餘
- 初始量
- 今日已用
- 綁定商品
- 渠道門檻
- Override

## 2. Surface 7B｜商品搜尋／分類

### 搜尋
輸入 Product Name／關鍵字。

### Category
沿 Admin 正式 Category。

### Filter
- 全部
- 可售
- 售罄
- 暫停

### 原則
Filter 只改 Projection。
唔改商品 truth。

## 3. Scenario 7C｜單品售罄

點 Product
→「售罄」

結果：
- 商品變不可售
- 正式狀態即時更新
- 後續新單不可再加入

### 已成立 Order
不受影響。

### UI
商品卡：
明確顯示「售罄」

左側：
加入「目前售罄」清單。

## 4. Scenario 7D｜單品暫停

用途：
暫時唔接某商品，
但唔代表永久售罄。

Action：
「暫停」

可顯示：
- 暫停原因
- 暫停時間（如正式設定支援）
- 手動恢復

### 核心
暫停 ≠ 售罄。

## 5. Scenario 7E｜恢復供應

由：
- 商品列
或
- 左側售罄／暫停清單

按：
「恢復」

結果：
→ 回到可售

### 守門
恢復只改 Sellability。
唔補單、唔重建舊 Order。

## 6. Surface 7F｜批量操作

支援多選：
- 多選售罄
- 多選暫停
- 多選恢復

### UI
勾選 Product
→ 底部 Batch Action Bar

顯示：
- 已選幾多件
- 目標狀態

提交前：
→ Confirm

### 禁止
批量操作唔可以略過每件正式狀態守門。

## 7. Surface 7G｜紫米一鍵售罄／恢復

### 入口
主頁頂部快捷。

Actions：
- 紫米售罄
- 紫米恢復

### 範圍
只影響正式綁定紫米供應／Capacity Pool 嘅產品。

### Confirm
顯示：
- 將受影響 Product 數量
- 目前狀態
- 新狀態

### 禁止
唔可以靠 Product 名稱包含「紫米」去猜。
必須用正式綁定關係。

## 8. Page / Surface 7H｜Capacity Pool

### 每個 Pool 顯示
- Pool 名稱
- Business Date
- 初始數量
- 剩餘數量
- 已使用
- 綁定商品數
- Channel Threshold
- 狀態

例：
紫米 Pool
初始：150
剩餘：72

### 點 Pool
右側打開 Detail。

## 9. Capacity Pool Detail

### 基本資料
- Pool Name
- Initial Qty
- Remaining Qty
- Consumption Rule
- Bound Products
- Channel Threshold

### 操作
- 人工調整
- 補貨
- 盤點修正
- Override

### Audit
每次操作記錄：
- 操作員
- 時間
- 原數
- 新數
- 原因／備註

## 10. Scenario 7I｜正式訂單扣 Pool

### 邊界
只有正式成立／正式接受成可執行 Order 後：
→ 扣 Pool

Draft／Pending：
唔扣。

### UI
Stage 7 只顯結果：
- Remaining
- 最近扣減

唔需要將交易明細全部塞入主畫面。

## 11. Scenario 7J｜取消回補

正式 Order 已扣 Pool後，
如果正式 Cancel：

→ 對應 Qty 回補

### 核心
同一次 Cancel：
只可回補一次。

### UI
Pool History 顯示：
- Order
- 回補 Qty
- 時間

禁止：
Reload／Retry 再補一次。

## 12. Scenario 7K｜每日 Reset

按 Business Day 開始時間 Reset。

例：
05:00

→ 新營業日
→ 載入新日 Initial Qty

### 重要
唔按 00:00 calendar date 偷代。

### UI
顯示：
- 今日 Business Date
- Reset 時間
- 今日 Initial Qty

## 13. Scenario 7L｜人工調整數量

入口：
Pool Detail → 調整數量

選擇：
- 盤點修正
- 補貨
- 其他調整

輸入：
- 新 Qty 或 Adjustment Qty
- 原因
- 備註

Final Review：
原數
→ 新數

確認：
→ 保存
→ Audit

## 14. Surface 7M｜渠道門檻

每個 Pool 可以有不同渠道門檻。

例如：
第三方平台門檻：20
自家平台門檻：10
Pool 0：全部遠端停止

### UI
顯示：
- Channel
- Stop Threshold
- Current Remaining
- Status

狀態：
- 正常
- 接近門檻
- 已停止新單

## 15. Scenario 7N｜第三方平台先停

當 Remaining 到第三方門檻：
→ 停第三方新單

例如：
Keeta／Foodpanda

### 已成立第三方 Order
保持正常處理。

### UI
顯示：
「第三方新單已停止」

唔可以：
- 取消舊單
- 自動退款

## 16. Scenario 7O｜自家平台再停

到另一／更低門檻：
→ 停自家平台新單

Customer App：
不可再正式提交受影響商品／訂單。

### UI
顯示：
「自家平台新單已停止」

本地 SMT：
仍可按正式現場規則操作。

## 17. Scenario 7P｜Pool = 0

預設：
所有綁定遠端渠道停止新單。

### 本地前線
如果現場真係仲做到少量：
可用 Override。

唔可以永久硬鎖到連現場人手都冇方法處理。

## 18. Surface 7Q｜Capacity Override

### 入口
Pool = 0／不足
→「臨時 Override」

### 輸入
- 額外份數
- 適用範圍
- 原因／備註

可選範圍：
- 指定 Product
- 指定 Pool
- 指定份數

### Final Review
顯示：
- Current Pool
- 額外開放數
- 影響 Product
- 操作員

### 結果
臨時增加可用額度。
用完：
→ 自動停止。

### Audit
保留：
- 操作人
- 時間
- Pool
- Scope
- Extra Qty

## 19. Surface 7R｜Customer Ordering 開關

### 狀態
- 可在線落單
- 今日指定時間後截單
- 已即時停止

### 操作
A. 即時停止接單
B. 恢復接單
C. 設定今日特別截單時間

### 核心
只影響 Customer 新單。

唔影響：
- SMT 本地交易
- 已成立 Order

## 20. Scenario 7S｜即時停止 Customer 新單

用途：
爆單／臨時情況。

按：
「停止客戶端新單」

Confirm：
顯示影響範圍。

成功後：
Customer App 顯示：
- 目前不可落單
- 原因／狀態
- WhatsApp fallback（如正式配置）

### SMT
仍然可現場落單。

## 21. Scenario 7T｜今日特別截單

設定：
例如 16:30

### UI
今日特別截單：
16:30

狀態：
- 未到時間
- 已生效

到時：
Customer 不能再正式提交。

### Customer 顯示
- 今日已提早截單
- 目前不可落單
- WhatsApp 替代入口

### 重要
呢個係當日營運控制。
唔應默認永久改正常營業時間。

## 22. Surface 7U｜Channel Status Summary

右側／頂部可顯示：
- SMT 本地：可交易
- Customer：可接／已停
- Keeta：可接／已停
- Foodpanda：可接／已停

### 原則
狀態分渠道。

唔做一粒：
「全系統綠燈」

## 23. Error / Recovery

### Sellability Mutation Fail
保持原狀態。
顯示：
- 操作失敗
- 原狀態仍有效

### Pool Update Stale
→ Reject
→ Fresh Read
→ 重新確認

### Provider Stop UNKNOWN
本地 MFK 狀態同 Provider 狀態分開顯示。

例如：
MFK：要求停止
Keeta：Provider Readback UNKNOWN

→ Attention
→ Reconcile

禁止盲目重送。

## 24. Stage 7 Page States

### Empty
Search 無結果：
「搵唔到相關商品」
＋清除 Filter

### Loading
只 Loading Product／Pool 區。
唔阻 Stage 1／2。

### Degraded
Provider 不可達：
仍可修改本地 MFK 狀態，
Provider Projection 顯示 Attention／Pending。

### Offline
本地售罄／Capacity 操作按已批准 Local-first 能力處理；
遠端 Channel 同步延後並明確標示。

## 25. Stage 7 明確不屬於本 Stage

- Draft Cart → Stage 1
- Payment → Stage 2
- External Pending Review → Stage 3
- Fulfillment → Stage 4
- Refund／Cancel → Stage 5
- 堂食桌台 → Stage 6
- Cash Movement → Stage 8
- Day Close → Stage 9
- Printer Physical Recovery → Stage 11

## 26. Stage 7 UI 優先級

P0：
- 單品售罄／恢復
- 搜尋／Category
- 批量操作
- Capacity Pool
- 人工調整
- Channel Threshold
- Customer Ordering Stop
- 特別截單

P1：
- 紫米快捷
- Override
- Provider Readback Attention
- Pool History

P2：
- 動畫
- 額外圖表

## 27. Stage 7 Definition of Done

1. 售罄／暫停／恢復語義分開。
2. 頁面唔一次攤晒所有商品。
3. 支援 Search／Category／Filter。
4. 支援批量售罄／恢復。
5. 紫米快捷只用正式 Pool 綁定。
6. Capacity 顯示 Initial／Remaining／Used。
7. 正式可執行 Order 先扣 Pool。
8. Cancel 回補只執行一次。
9. Reset 按 Business Day boundary。
10. 人工調整有 Audit。
11. 每個 Channel 可有獨立 Stop Threshold。
12. Channel Stop 只影響新單。
13. 已成立 Order 不受影響。
14. Pool = 0 可以有限 Override。
15. Override 有 Scope／Qty／Actor／Time。
16. Customer 可即時停止／恢復新單。
17. 支援今日特別截單。
18. Customer Stop 不阻 SMT 本地交易。
19. Provider UNKNOWN 先 Readback／Reconcile。
20. Stage 7 Failure 唔阻 Stage 1／2 本地交易。

## 28. 下一個 Stage
Stage 8｜營業中錢箱
