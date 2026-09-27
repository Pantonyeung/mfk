# MFK SMT｜Stage 4 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 4｜正式訂單營運／出餐

## 0. Stage 定位
Stage 4 係正式 Order 建立之後，前線用嚟追蹤、處理、出餐、交付嘅主要營運頁。

核心目標：
- 清楚知道每張正式 Order 由邊度嚟
- 清楚知道而家做到邊
- 快速將 Order 由「未完成」推進到「可取餐」再到「已取餐」
- 支援誤按回退
- 顯示 ETA／延誤／客戶／平台識別
- 保持 SAME Order
- 唔將售後修正、退款、付款方式更正混入主 Fulfillment 流程

核心狀態：
未完成 → 可取餐 → 已取餐

補充：
- 可取餐可以退返未完成
- 已取餐代表實際交餐／Handover 完成
- Ready／可取餐唔等於已交餐

## 1. Page 4A｜訂單工作台

### 整體版面
左側：
Order Detail

右側：
三條 Source Lane

Lane 1：
現場／直接來源
- 店內
- 電話
- WhatsApp

Lane 2：
自家平台
- 磨飯 App／網站

Lane 3：
第三方平台
- Keeta
- Foodpanda
- 日後其他平台

### 頂部 Filter
第一層：
來源／渠道

第二層：
付款方式

可加：
- 未完成
- 可取餐
- 已取餐
- Attention
- 延誤

但唔應一次放太多 Filter 搶畫面。

## 2. Surface 4B｜Order Card

每張卡最少顯示：
- 來源
- 正式訂單號／流水號
- 狀態
- 客戶名稱（有資料時）
- 付款方式
- 件數
- 總額
- ETA／預計取餐時間
- 已等待時間

外部來源額外：
- External Order No
- Pickup Code

自家平台額外：
- 客戶姓名／稱呼
- 取餐號／取餐碼

### 視覺優先級
P0：
- 流水號
- 狀態
- 等待時間／ETA

P1：
- 來源
- 客戶／Pickup Code
- 件數

P2：
- 付款方式
- 金額
- External No

### 卡片行為
點卡：
→ 左側 Order Detail 更新

雙擊／重複點：
唔應造成任何 mutation。

## 3. Surface 4C｜Order Detail

### Header
- 正式流水號
- 來源
- Order 狀態
- 客戶／平台識別
- 建立時間
- ETA

### 商品區
每行：
- Product Name
- Qty
- Option／Modifier
- Combo Detail
- 備註
- Line 金額

### Summary
- 總件數
- 總額
- 付款方式
- Order No
- External No（如有）
- Pickup Code（如有）

### Action 區
高頻：
- 標記可取餐
- 標記已取餐
- 退回未完成（只在可取餐狀態）
- 重印

次級：
- 修改／取消
- 付款方式修正
- 退款

其中：
修改／取消／付款方式修正／退款
→ 交 Stage 5
唔喺 Stage 4 直接完成。

## 4. Scenario 4D｜未完成

### 狀態
正式 Order 已成立，
但尚未去到可取餐。

### UI
Order Card：
- 狀態「未完成」
- ETA
- 已等待分鐘
- 延誤 Badge（如適用）

Order Detail 主 Action：
「可取餐」

### 行為
按「可取餐」
→ SAME Order
→ Fulfillment 進可取餐
→ Customer／Provider projection 跟正式狀態更新

### 守門
按鈕只改 Fulfillment。
唔重收款。
唔重建 Order。
唔重新 First Print。

## 5. Scenario 4E｜ETA／倒數

### 來源
正式 Order 成立後，
按當刻有效 ETA 規則開始。

### UI 顯示
- 預計取餐時間
- 剩餘分鐘
- 已超時分鐘（如已過 ETA）

### 正常
例如：
ETA 15 分鐘
→ 顯示「約 12 分鐘」

### 到時
按目前 Owner Brief：
到設定時間後，系統可自動標示／進入「可取餐」。

### UI 必須清楚
如果係自動進入：
- 顯示「系統按 ETA 自動標示」
- 保留可退回未完成

如果係人手：
- 顯示操作者／操作時間於詳細紀錄

### 注意
Stage 4 R1 唔額外增加「廚房實際完成證明」新 Gate；
若日後 Owner 要將 ETA 與實際製作完成分開，應以 Addendum 追加。

## 6. Scenario 4F｜延誤訂單

### 觸發
已超出 ETA／Late Cutoff／營運規則。

### Order Card
- 置頂或提高 Priority
- 明顯「延誤」Badge
- 顯示超時分鐘

### Detail
顯示：
- 原 ETA
- 目前已超時
- Updated ETA（如有）
- Provider／Customer 通知狀態（如有）

### 操作
- 更新 ETA
- 保持處理中
- 進 Attention（如需要）

### 禁止
唔可以因延誤自動取消。

## 7. Scenario 4G｜可取餐

### Card
狀態：
「可取餐」

視覺：
比一般未完成更突出，
但唔用 Error 紅色。

### Detail Actions
- 已取餐
- 退回未完成
- 重印

### 退回未完成
用途：
- 誤按
- 發現漏咗商品
- 仲要補做

結果：
可取餐 → 未完成

保持：
SAME Order
同一付款
同一歷史

### 退回後
如果之前有 Customer／Provider Ready projection：
後續 Notification／Provider correction 行為由相關 domain 處理。
Stage 4 只投影真實結果。

## 8. Scenario 4H｜已取餐

### 觸發
店員確認實物已交畀客人／司機。

### UI
狀態：
「已取餐」

顯示：
- Handover 時間
- 操作員
- Pickup Code／客戶識別（如有）

### Pickup Code
Owner Brief 鎖定：
只作人工核對顯示。

唔要求：
- 強制輸入
- 強制掃碼
- 強制 QR Verify

前線：
對得上即可交餐。

### 完成後
Order 由主 Active Lane 降低優先級，
之後可進 History／Archive。

## 9. Surface 4I｜Pickup Verification

### 自家平台
顯示：
- 客戶姓名
- Pickup Code
- 電話尾碼（如 projection 有）

### 第三方平台
顯示：
- Platform
- External Order No
- Pickup Code

### 原則
目的：
防止拎錯袋。

但目前產品要求仍係低摩擦人工核對，
唔新增強制掃碼流程。

## 10. Surface 4J｜來源 Filter

### 第一層
- 全部
- 現場／直接
- 自家平台
- 第三方平台

### 第二層
按 Payment：
- 全部
- 現金
- Alipay
- WeChat Pay
- FPS／PayMe
- 其他

### 原則
先 Source，
再 Payment。

Filter 只改 Projection。
唔改 Order truth。

## 11. Surface 4K｜Reprint 入口

### 位置
Order Detail。

按：
「重印」
→ 開 Reprint Modal

### Modal 內容
80mm 類：
- 收據
- 製作單
- 打包單

Label 類：
- 外賣 Label
- 飯團 Label
- 其他已配置 Label

### 行為
Whole Ticket：
- Receipt／Production／Packing 整張重印

Label：
- 全選
- 多選
- 部分重印

### 核心
Reprint：
- 唔改 Order
- 唔收款
- 唔重新成交

實際 Printer Failure／UNKNOWN 詳細處理：
→ Stage 11

## 12. Surface 4L｜Provider / Customer Attention

Order Card 可有細 Badge：
- Customer Sync Attention
- Keeta Attention
- Print Attention
- Delayed
- Payment／After-sale Attention

### 原則
Badge 只係投影。

點 Badge：
→ 導向對應責任 Surface

唔可以：
因一個 Provider Fail 將成張 Order 標做 Failed。

## 13. Scenario 4M｜App Restart／Reload

### Reload
Stage 4 重新讀正式 Order Projection。

必須恢復：
- SAME Order
- Fulfillment State
- ETA
- Payment Summary
- Customer／Provider identity
- Attention
- Reprint capability

### 禁止
用 UI Cache 自己猜 Order 狀態。

如果讀到 stale：
→ 顯示 stale／更新中
→ 保留最後已確認狀態
→ Fresh Read

## 14. Scenario 4N｜多張新單同時到達

### UI 原則
新正式 Order：
- 放入正確 Source Lane
- 新單置頂
- 短暫視覺提示
- 聲音提示（如設定開啟）

### 不可以
- 將三個來源混成一個無身份 Queue
- 新單出現時搶走員工正在操作嘅 Order Detail
- 用全畫面 Modal 每次阻塞

### 建議
新單 Attention：
非阻塞式 2–3 秒提示＋卡片置頂。

## 15. Stage 4 Page States

### Loading
- Lane Skeleton／局部 Loading
- 不遮全頁

### Empty
每條 Lane 可以獨立：
「目前冇進行中訂單」

### Error
只標出受影響 Lane／Order。

例如：
Keeta Readback 失敗
→ Keeta Lane Attention

其他 Lane：
照常可用。

## 16. Stage 4 明確不屬於本 Stage

正式交易修改：
→ Stage 5

Payment Correction：
→ Stage 5

Refund：
→ Stage 5

正式 Cancel：
→ Stage 5

堂食桌台 lifecycle：
→ Stage 6

售罄／產能：
→ Stage 7

Printer Physical Failure 深處理：
→ Stage 11

## 17. Stage 4 UI 優先級

P0：
- 3 Source Lanes
- Order Detail
- 未完成／可取餐／已取餐
- 可取餐退回
- ETA
- Pickup Code
- Filters
- Restart readback

P1：
- Delayed Order
- Attention
- Reprint Modal
- Updated ETA
- Customer／Provider badges

P2：
- 動畫
- 額外統計
- 非必要裝飾

## 18. Stage 4 Definition of Done

1. 正式 Order 按來源分三 Lane。
2. 每張 Card 清楚顯示流水號、狀態、來源、件數、ETA。
3. Order Detail 顯示完整商品／付款／客戶／平台資料。
4. 未完成可進可取餐。
5. 可取餐可退回未完成。
6. 可取餐可進已取餐。
7. 全程 SAME Order。
8. ETA 正式 Order 成立後先開始。
9. 延誤有獨立 Attention，不自動取消。
10. Pickup Code 只作人工核對，不強制掃碼。
11. Reprint 由 Order Detail 進入。
12. Reprint 唔改 Order／Payment。
13. Provider／Print Attention 唔污染整張 Order 狀態。
14. Reload／Restart 後讀正式 Order truth。
15. 新單提示唔搶走當前操作。
16. 正式售後操作交 Stage 5。
17. 堂食管理交 Stage 6。
18. Printer 深層故障交 Stage 11。

## 19. 下一個 Stage
Stage 5｜正式交易修正／取消／退款
