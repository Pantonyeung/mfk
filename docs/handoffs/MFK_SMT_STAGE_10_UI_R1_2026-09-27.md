# MFK SMT｜Stage 10 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 10｜報表／歷史／跨日追溯

## 0. Stage 定位
Stage 10 負責將已完成交易、日結、退款、取消、付款方式修正、跨日 Adjustment 同商品表現，整理成可查、可追溯、可重印、可匯出嘅營運歷史。

入口：
更多／工具中心
→「報表與分析」

核心原則：
- Reporting 只讀正式交易事實
- 報表唔可以反過來改 Order／Payment／Refund
- 已完成日結形成正式 Daily Report
- 原日報永久保留，之後跨日修正只 Append Linked Adjustment
- Payment Correction 報表只計 Current Effective Tender
- Sales、Tender、Settlement 係不同真相，不可混埋
- Pending／Draft／未正式接受外部單唔計正式營業額／正式訂單數

## 1. Page 10A｜今日營運

### Header
顯示：
- Business Date
- 報表狀態
- Freshness／最後更新時間
- 日結是否完成

### 核心 KPI
- 原始成交額／銷售總額
- 有效營業額／淨銷售
- 完成訂單數
- 取消訂單數
- 有效訂單數
- 平均訂單金額
- 退款總額
- 商品件數

### 第二層
- 渠道統計
- 付款方式統計
- 商品排行
- Refund／Cancel／Adjustment 摘要

### 原則
第一屏先回答：
今日做到幾多、幾多單、退款幾多、邊個渠道／付款方式佔比。

唔堆太多工程／技術數值。

## 2. Surface 10B｜渠道統計

至少分：
- 現場
- 電話
- WhatsApp
- 自家平台
- Foodpanda
- Keeta

每個渠道顯示：
- 訂單數
- 金額

### 原則
Channel 只係來源維度。
唔等於 Payment Method。

## 3. Surface 10C｜付款方式統計

顯示 Current Effective Tender：
- 現金
- Alipay
- WeChat Pay
- FPS／轉數快
- PayMe
- 電子支付（未細分）
- 其他

### Payment Correction
例如：
CASH → FPS

舊 CASH：
只留 Audit

報表：
只計 FPS

### 重複修正
CASH → FPS → PayMe

報表：
只計 PayMe 一次。

### 禁止
- Double Count
- 舊付款方式繼續計入有效 Tender
- 未知電子支付 Provider 自己猜成 Alipay／FPS 等

## 4. Surface 10D｜商品分析

每個商品顯示：
- 商品名稱
- 今日售出數量
- 銷售金額
- 排名

可查看：
- Top Seller
- 低銷
- 零銷

### 用途
幫助：
- 決定翌日備貨
- 增／減備貨
- 考慮停售

### 原則
報表只提供數據。
唔自動停售／刪 Product。

## 5. Surface 10E｜Refund／Cancel／Adjustment 摘要

分開顯示：
- Refund
- Cancel
- Amount Adjustment
- Payment Correction

### 每類至少顯示
- 次數
- 金額影響（如適用）
- 最近一筆
- Drill-down

### 原則
四種 Adjustment 語義分開。
唔壓成一個「調整總額」之後失去原因。

## 6. Page 10F｜歷史日報

### List
每個 Business Date 一張卡：
- 日期
- 原始成交額
- 有效營業額
- 訂單量
- Refund／Cancel
- 日結狀態
- 有冇後續 Adjustment

### Filter
- 日期
- 已完成日結
- 有後續調整

### 點擊
→ Daily Report Detail

## 7. Page 10G｜Daily Report Detail

顯示正式日報：

### A. 銷售
- 原始成交額
- 有效營業額
- 訂單量
- 平均訂單金額

### B. 調整
- Refund
- Cancel
- Amount Adjustment

### C. 渠道
- 每渠道訂單數
- 每渠道金額

### D. 付款方式
- Current Effective Tender 分佈

### E. Cash
- Opening Cash
- Cash Sales
- Cash In
- Cash Refund／Adjustment
- Cash Out
- Expected Cash
- Actual Cash
- Difference
- Removed Cash
- Retained Cash

### F. 商品
- 商品數量
- 商品銷售額
- Top Seller

### G. 日結
- Close Time
- Actor
- 日結單／重印入口

## 8. Surface 10H｜正式日報不可變

一旦 Stage 9 完成日結：

Original Daily Report
=
Immutable

之後：
- Refund
- Cancel
- Payment Correction
- Amount Adjustment

唔可以覆寫舊日報內容。

### UI
日報 Header 顯示：
「正式日報 · 已鎖定」

如果有後續修正：
顯示：
「有後續調整」

按：
→ Adjustment History

## 9. Page 10I｜Adjustment History

### 每筆顯示
- 發生時間
- 原 Business Date
- 原 Order
- Adjustment Type
- 金額
- Payment／Refund Method（如有）
- Actor
- Reason
- Result

### 類型
- Refund
- Cancel
- Tender Correction
- Amount Adjustment

### 原則
Adjustment 係 Append-only。
原 Order／原報表唔刪唔改。

## 10. Scenario 10J｜跨日退款

例：
9 月 19 日 Order HK$100
9 月 20 日 Refund HK$100

### 9 月 19 日
原日報：
保持原樣。

### 9 月 20 日
新增 Refund Adjustment。

### UI
原日報：
顯示「有後續調整」

Adjustment Detail：
- Refund 發生日
- 原 Order Business Date
- Refund Amount
- Refund Method

### 注意
現有資料支持「原報表 immutable + later adjustment append-only」。
至於跨日 Adjustment 應唔應直接扣落「退款發生日」主 KPI，Brief 未完整鎖定最終 Recognition Date。
Stage 10 R1：
- 必須保留兩個日期
  1. 原交易 Business Date
  2. Adjustment Occurred Date
- 唔自行把兩者合併成單一日期語義

## 11. Page 10K｜Order History

### Search
可用：
- 流水號
- Order No
- External Order No
- Pickup Code
- 客戶姓名／電話（如有）

### Filter
- Business Date
- Source
- Payment
- Fulfillment
- Cancelled
- Refunded

### 每張 Order Card
- 流水號
- 日期
- 來源
- 金額
- Current Effective Tender
- Fulfillment
- Refund／Cancel Badge

### 點擊
→ Order History Detail

## 12. Page 10L｜Order History Detail

顯示：
- Original Order Snapshot
- 商品
- 原金額
- Current Effective Amount
- Payment History
- Current Effective Tender
- Fulfillment History
- Refund History
- Cancel History
- Correction History
- Print／Reprint History（只摘要）
- Provider Reference（如有）

### 原則
History Detail 係追溯。
唔係直接修改入口。

如果要改：
→ 導向 Stage 5 正式售後流程。

## 13. Surface 10M｜Tender History

例：
12:01 CASH
12:05 修正 → FPS
12:10 修正 → PayMe

顯示：
- 原 Tender
- 每次 Correction
- Current Effective Tender

### 報表
只計 Current Effective Tender。

### Audit
舊 Tender 永久保留。

## 14. Surface 10N｜Settlement / Reconciliation Boundary

平台例如：
- Keeta
- Foodpanda

可能有：
- Sales
- Provider Fees
- Refund
- Settlement / Amount Owed

### 原則
Stage 10 主 Sales Report
唔可以將 Settlement 當 Net Sales。

Settlement：
屬 Finance／Reconciliation read model。

可由 Daily Report／Order History Deep-link 去相關 Settlement Detail，
但唔污染 Order Payment truth。

## 15. Surface 10O｜報表打印／重印

Daily Report：
可以打印。

已打印後再次打印：
→ Reprint 同一份 Report Snapshot。

禁止：
- 建第二份 Daily Report truth
- 改原報表

Printer Failure：
→ Stage 11。

## 16. Surface 10P｜Export

支援：
- CSV
- 日後其他正式格式

### 匯出內容
按當前 Filter／正式報表範圍。

### UI
顯示：
- 日期範圍
- 報表類型
- 匯出狀態

### 原則
Export 只係輸出。
唔改資料。

## 17. Freshness / Completeness

所有即時／未日結數據：
至少要有：
- Last Updated
- Fresh／Stale
- Complete／Partial（如可判斷）

### 已完成日結
標示：
「正式／已鎖定」

### 未完成
標示：
「今日營運中」

避免：
用舊數據扮即時。

## 18. Scenario 10Q｜Reload／Restart

Restart 後：
重新讀正式 Reporting / History facts。

保持：
- 日報
- Adjustment
- Order History
- Effective Tender
- Refund／Cancel Link

### Offline
如果本地報表可由本地 facts 建：
照顯示本地結果。

Cloud projection unavailable：
顯示：
「雲端同步待完成」

唔令本地報表變成總 Fail。

## 19. Stage 10 Page States

### 今日營運中
顯示 Live／Local read model + freshness。

### 已日結
顯示正式 Locked Report。

### Empty
「暫無符合條件記錄」

### Stale
顯示最後更新時間＋更新入口。

### Partial
明確顯示：
「部分資料未齊」

唔可以當 Full Complete。

## 20. Stage 10 明確不屬於本 Stage

- 現場點單 → Stage 1
- 初次付款 → Stage 2
- Fulfillment → Stage 4
- Refund／Cancel／Correction 執行 → Stage 5
- Cash In／Out → Stage 8
- Day Close → Stage 9
- Printer Physical Recovery → Stage 11

## 21. Stage 10 UI 優先級

P0：
- 今日營運
- 渠道統計
- Tender 統計
- 商品分析
- 歷史日報
- Immutable Report
- Adjustment History
- Order History
- Effective Tender

P1：
- Export
- Settlement／Reconciliation Deep-link
- Freshness／Completeness
- Report Reprint

P2：
- 圖表
- 趨勢比較
- 額外 BI

## 22. Stage 10 Definition of Done

1. 今日營運有核心 Sales／Order／Refund／商品數據。
2. 渠道與付款方式分開。
3. Payment Correction 只計 Current Effective Tender。
4. 未知電子支付 Provider 唔自行猜。
5. 商品分析只提供數據，不自動改 Product。
6. 每日正式日報可查看／打印／重印。
7. 已完成日報不可覆寫。
8. Cross-day Adjustment append-only。
9. Adjustment 同原 Order／原 Business Date 有 Link。
10. 跨日修正保留原交易日同修正發生日兩個日期。
11. Order History 可按多種識別搜尋。
12. Order History 顯示完整 Payment／Refund／Correction Timeline。
13. Reporting 唔提供直接改交易入口。
14. Settlement 唔混入 Sales truth。
15. Export 唔改資料。
16. 即時數據有 Freshness／Completeness。
17. Reload／Restart 可恢復歷史。
18. Cloud unavailable 唔令本地 Reporting 變成交易 blocker。

## 23. 下一個 Stage
Stage 11｜打印／設備／故障
