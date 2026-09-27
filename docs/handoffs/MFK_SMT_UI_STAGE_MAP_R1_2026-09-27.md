# MFK SMT｜功能 UI Stage Map R1
日期：2026-09-27
狀態：STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1

## 設計原則
Stage ≠ Page。
Stage 代表一段完整前線操作旅程；Page 係承載該旅程嘅主要畫面；Scenario 係同一 Page 入面嘅不同使用情境；Modal / Drawer / Alert 只係操作 Surface。

## Global Shell
- 左側高頻導航：點單／訂單／堂食／售罄・產能
- 上方：漢堡／更多、員工、營業狀態、同步／設備摘要
- 點單頁頂部：待處理訂單／Keeta Incoming Strip
- 右側：Cart / Live Check
- 通用 75% Modal
- 全局 Attention／錯誤提示層
- 不設 Home Page

## Stage 0｜啟動／登入／開更
Pages：
1. Boot / Loading
2. 員工登入
3. 首次登入／必要裝置設定
4. 上一營業日留櫃現金 readback
5. 今日 Opening Cash 核對
6. Opening Confirm

Scenarios：
- 正常啟動
- 第一次登入
- PIN 錯誤
- 上一日有留櫃記錄
- 上一日冇可信留櫃記錄
- 今日開更現金一致／不一致
- 離線啟動
- 完成後直接入 Stage 1 點單

## Stage 1｜現場建單／草稿
Primary Page：點單工作台

區域：
- Incoming Strip
- Category
- Product Grid
- Quick／Normal Mode
- Cart
- 快速組合
- 必選／補選
- 紫米套餐
- 暫存／堂食
- 取回訂單

Scenarios：
- 普通產品直接加入
- 有 Required 產品
- Quick Mode 先入 Cart 後補 Required
- Normal Mode 即時開選項
- 編輯 SAME Cart Line
- 原單／整理
- 堂食／外賣整單切換
- 單行堂／外 Override
- Combine 相同配置
- 飯團＋小食快速配對
- A／B／C／D 套餐
- 暫存
- 取回暫存
- Cart 清除

## Stage 2｜Checkout／付款／成交
Primary Page：Checkout

Sub-surfaces：
- 來源／渠道
- 付款方式
- 金額結算
- 現金鍵盤
- 組合付款
- 學生優惠
- Final Review
- Completion Review

Scenarios：
- 現金
- Alipay／WeChat／FPS／PayMe
- 組合付款
- 剛好付款
- 快捷現金 $20／$50／$100／$200／$500
- 學生優惠人數輸入
- 手動選優惠飲品
- 自動優先最貴合資格飲品
- 返回訂單
- 更改付款方式
- Double Tap
- 付款成功
- 付款 Failure
- 付款 UNKNOWN
- 完成只關閉／導航，不再次成交

## Stage 3｜外部新單接入
主要唔做獨立主頁；用 Incoming Strip + Review Modal。

Surfaces：
- 自家客戶端 Pending Card
- Keeta Pending Card
- Pending Order Review
- Payment Evidence Viewer
- WhatsApp QR

Scenarios：
- 到店支付
- 電子支付截圖待核對
- 截圖日期錯
- 時間錯
- 金額錯
- 圖片唔清
- 接受
- 修改
- 取消
- Keeta 即刻處理
- Keeta 稍後處理 1／2
- Mapping／售罄／Provider Attention
- Accept 後進 Stage 4 正式 Order

## Stage 4｜正式訂單營運／出餐
Primary Page：訂單

版面：
- 左：Order Detail
- 右：三條 Source Lane
  1. 現場／直接來源
  2. 自家平台
  3. 第三方平台

Scenarios：
- 未完成
- 可取餐
- 已取餐
- 可取餐退回未完成
- ETA／倒數
- Customer Name／Pickup Code
- External Order No
- 來源 Filter
- Payment Filter
- Order Drill-down
- Reprint
- Delayed Order
- Provider Attention

## Stage 5｜正式交易修正／取消／退款
入口：Stage 4 Order Detail

Surfaces：
- Order Action Modal
- Payment Correction Modal
- Refund Modal
- Cancel Modal
- Customer Confirmation／Attention

Scenarios：
- 修改正式訂單
- 補款
- 減價
- Payment Method Correction
- Full Refund
- Partial Refund
- 改退款方式
- Cancel 未出製作單
- Cancel 已出製作單 → 取消通知
- SAME Order Audit
- 不自動 reprint
- 不自動 drawer action

## Stage 6｜堂食／輪候
Primary Page：堂食

版面：
- 左：輪候／叫號
- 中：3×3 桌台
- 右：桌台詳情

Scenarios：
- 直接入座
- 建輪候
- 輪候先落單
- 輪候轉入桌台
- 加單
- 轉枱
- 併枱
- 拆枱
- 修改人數
- 用餐時間
- 超時警示
- 商品分項付款
- Partial Payment
- Full Payment
- 自動釋枱
- 堂食重印
- 堂食未結帳枱單
- 堂食取消

## Stage 7｜供應／售罄／產能／接單控制
Primary Page：售罄／產能

區域：
- Search
- Category
- 售罄／暫停 Filter
- 已售罄列表
- Capacity Pool
- Channel Threshold
- Override

Scenarios：
- 單品售罄
- 批量售罄
- 批量恢復
- 紫米一鍵售罄／恢復
- Pool 扣減
- Cancel 回補
- 人工盤點調整
- 第三方先停
- 自家平台再停
- Pool = 0
- 有限 Override
- 即時停止客戶端落單
- 特別截單時間

## Stage 8｜營業中錢箱
Primary Page：更多 → 現金／錢箱

Scenarios：
- Cash In
- Cash Out
- 補找續金
- 攞貨／雜費
- 臨時支出
- 查看系統預計現金
- 操作人／時間／用途／備註
- 不混入 Sales／Refund

## Stage 9｜日結／留櫃
Primary Page：更多 → 收銀與日結

Scenarios：
- Close Preview
- 系統預計現金
- 面額點算
- 直接輸入總額
- 實點 vs 預計
- 差額
- 取走現金
- 留櫃現金
- 日結確認
- 日結單打印／重印
- 已日結再次進入
- 下一日 Opening Cash readback

## Stage 10｜報表／歷史／跨日追溯
Primary Pages：
- 今日營運
- 歷史日報
- Order History
- Adjustment History

Scenarios：
- 銷售總額
- 淨銷售
- 訂單量
- 平均訂單金額
- 渠道統計
- 付款方式統計
- 商品排行
- Refund／Cancel／Adjustment
- Cross-day refund
- Original report immutable
- Later adjustment append-only
- Export

## Stage 11｜打印／設備／故障
Primary Pages：
- 打印與設備
- Pending Action
- Print Diagnostics

Scenarios：
- Logical Printer → Physical IP／Port
- 測試連線
- 測試出紙
- Receipt／Production／Packing／Label
- Whole Ticket Reprint
- Label Partial Reprint
- Printer Offline
- FAILED
- UNKNOWN
- Route Fail
- 並行 Printer
- Same-printer queue
- 人工 reroute／rebind
- Print Trace

## Stage 12｜系統維護／恢復／設定
Primary Pages：
- 顯示設定
- Admin Sync
- Backup
- Restore
- 系統診斷
- Network／Provider Health

Scenarios：
- UI 密度
- 字體
- Product Card 圖片開關
- Category rows／columns
- Sync freshness
- Admin config readback
- Offline
- WAN 恢復
- LAN 故障
- App kill／restart
- Provider failure
- Backup
- Restore
- Diagnostic trace
- UNKNOWN readback

## Reusable Surfaces
- 75% Product Modal
- 75% Final Review Modal
- Pending Review Modal
- Refund / Correction Modal
- Reprint Modal
- Confirm destructive action
- Attention Card
- Toast／Inline Error
- Bottom action bar
- Side detail panel

## Stage 關係
Stage 0
→ Stage 1
→ Stage 2
→ Stage 4

Stage 3
→ 插入 Stage 4

Stage 1
→ Stage 6
→ Stage 2
→ Stage 4

Stage 4
→ Stage 5

Stage 7–12
= 營運支援 Stage
= 可由主流程 contextual 進入
= 不應成為本地交易同步 blocker

## 下一步
先鎖 Page / Scenario / Stage Map。
下一輪先做：
1. 每個 Page 嘅區塊層級
2. 每個 Scenario 嘅進入／退出
3. Modal／Drawer／Alert 規格
4. 最後先畫 Wireframe／UI Mockup
