# MFK SMT｜Stage 11 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1 + OWNER 對 SMT 端口要求 FINAL V1.0
範圍：Stage 11｜打印／設備／故障

## 0. Stage 定位
Stage 11 負責 SMT 本機「打印設備配置、實體打印機綁定、打印狀態、故障 Attention、診斷、Pending Print Recovery」。

佢唔係訂單重印主頁。

兩條入口必須分開：
A. 更多／工具中心 → 打印／設備
   用於設備、IP、Binding、Template Selection、Health／Attention、Diagnostics
B. 正式 Order Detail／堂食 Detail → 重印
   用於某張 Order 嘅 Receipt／Production／Packing／Label Reprint

核心原則：
- Admin 決定「應該印去邊」
- SMT 決定「實際邊部機係嗰個目的地」
- SMT 不建立第二套 Product → Printer Routing
- SMT 不做 Template Authoring
- SMT 只可選 Admin 已發佈 Template
- 打印失敗唔可以改 Order Truth
- 系統唔自行猜「實體已經成功出紙」
- UNKNOWN 唔可以 Blind Retry
- App Restart 後 Pending Print Data 不可消失
- Offline 時本地打印仍屬本地可運作能力

## 1. Page 11A｜打印／設備中心

### Header
顯示：
- 本機名稱／工作站
- 整體 Printing 狀態摘要
- Attention 數量
- 最近狀態更新時間

### 主內容分三區
A. Logical Destination
B. Physical Printer
C. Attention／Pending Print

### 次級入口
- 打印診斷
- Admin Sync 狀態
- 返回工具中心

### 注意
唔做一粒「全部綠燈」掩蓋細節。
每條打印用途／每部實體機分開顯示狀態。

## 2. Surface 11B｜Logical Print Destination

來源：
Admin 正式配置。

例：
- 收據
- 廚房製作
- 打包
- 外賣 Label
- 飯團 Label
- 日後其他正式 Destination

每個 Destination 顯示：
- Logical Name
- 已綁 Physical Printer
- 已選 Published Template
- Binding 狀態
- Attention

### 核心
SMT 唔可以喺呢度改 Product → Logical Destination 規則。

如果產品應該印去邊錯：
→ 屬 Admin Configuration 問題
→ 顯示來源／同步狀態
→ 唔喺 SMT 建一套替代 Routing。

## 3. Surface 11C｜Physical Printer List

每部實體打印機 Card：
- 自訂名稱
- Printer Type
- Connection Type
- IP／Port（如適用）
- 綁定用途
- 最近已知狀態
- Attention

例：
- 小票 A
- 廚房製作
- 打包
- 飯團 Label
- 外賣 Label

### 狀態語義
只顯示 SMT 真正知道嘅狀態，例如：
- 已配置
- 未配置
- 可連接／最近可連接
- 連接失敗
- 有 Pending Print
- 狀態未知

禁止：
冇可靠證據時顯示「已實體打印成功」。

## 4. Surface 11D｜Physical Printer Binding

入口：
Physical Printer Card
→ 設定

可編輯：
- 顯示名稱
- Connection／IP／Port（正式能力有提供時）
- 綁定到邊個 Logical Destination
- 選擇已發佈 Template

### Save Review
顯示：
原 Binding
→ 新 Binding

主要 Action：
「保存」

### 成功
只改本機 Physical Binding。

禁止：
- 改 Admin Product Printing Rule
- 自建 Product Routing
- 自建 Template

## 5. Surface 11E｜Published Template Selection

每個 Logical Destination：
可選 Admin 已發佈 Template。

顯示：
- Template Name
- Version／Published status（如正式資料有）
- Current Selection

### 原則
SMT 只做：
Select Published Template

SMT 唔做：
- Template Editor
- 字段設計
- QR／Logo Layout Authoring
- 發佈 Template

如果冇可用 Published Template：
→ Attention
→ 指向 Admin 配置問題。

## 6. Surface 11F｜打印 Attention Queue

集中顯示：
- 哪張 Order／哪個 Business Record
- Ticket Type
- Logical Destination
- Physical Printer
- Known State
- 發生時間
- 下一步

### 可能狀態
- Pending
- Dispatching／處理中
- Known Failure
- UNKNOWN
- 已完成（只限有可靠確認來源時）

### 排序
P0：
UNKNOWN／Known Failure

P1：
Pending 過久

P2：
一般 Pending

### 原則
唔可以只顯示：
「Print Failed」

要顯示：
邊張單、邊種票、邊條 Route、邊部 Printer。

## 7. Scenario 11G｜Known Printer Failure

例：
- IP 不可達
- 連線失敗
- 本機打印 Gateway 明確 Reject

UI：
- 亮燈
- Printer Card Attention
- 對應 Print Job Attention
- 前線可理解原因
- 下一步建議

可做：
- 檢查實體打印機
- 檢查網絡／線路
- 修正 Physical IP／Binding
- 再查看該 Pending Job

### 核心
Order：
仍然係成功 Order（如果原交易已成功）。

Printer Failure：
係 Print Domain Failure。

禁止：
因打印失敗將 Order 變成未成交。

## 8. Scenario 11H｜Print UNKNOWN

### 定義
系統無法可靠知道：
實體紙張究竟有冇出過。

UI 必須顯示：
「打印結果未知」

附：
- Order
- Ticket
- Printer
- 最後已知步驟
- 時間

### 前線操作
先：
1. 人手檢查打印機／紙張
2. 查看 Print Trace／已知狀態
3. 再決定是否重印

### 禁止
- 系統自動猜成功
- 系統自動猜失敗
- Blind Auto Retry
- 一 Reload 就重打一張

## 9. Surface 11I｜Print Job Detail

顯示：
- Order／Record
- Ticket Type
- Logical Destination
- Physical Printer
- Template
- Created At
- Last Known State
- Retry／Reprint History
- Attention

### Trace
以人類可理解步驟顯示，例如：
1. 已建立打印要求
2. 已完成 Route Resolution
3. 已交本機打印執行
4. 最後回覆／狀態

只顯示真正有證據嘅 Step。

工程細節：
可由「進階診斷」再睇。

## 10. Page 11J｜打印診斷

### 第一層：前線摘要
每個項目：
- 正常
- Attention
- Unknown

至少分：
- Printer Binding
- Printer Connection
- Pending Print
- Admin Print Config Sync
- Local Print Runtime

### 第二層：進階
可顯示：
- Route
- Printer
- Known Step
- Timestamp
- Error Summary
- 必要 Technical Detail

### 原則
先俾前線知道：
發生咩事、影響邊度、下一步做咩。

唔需要首頁直接堆滿工程碼。

## 11. Order Reprint Boundary

Order 重印唔喺 Stage 11 Settings 主頁發起。

入口：
Stage 4 Order Detail
→ 重印

Stage 11 提供底層打印／故障能力。

### 80mm
- 收據
- 製作單
- 打包單

語義：
Whole Ticket Reprint

### Label
先揀 Label Route：
- 外賣 Label
- 飯團 Label
- 其他正式 Route

每張 Label：
獨立 selectable identity。

支援：
- 全選
- 多選
- 部分重印

## 12. Scenario 11K｜80mm Reprint

Order Detail
→ 重印
→ 收據／製作單／打包單
→ Confirm

結果：
只新增 Reprint Action。

保持：
- SAME Order
- SAME Payment
- SAME Fulfillment

禁止：
- 重新成交
- 再收款
- 再做 First Print Admission

## 13. Scenario 11L｜Label Partial Reprint

Order Detail
→ 重印
→ Label
→ 選 Route
→ 顯示該 Route 全部 Label

例：
外賣 Label ×5

可選：
- 全部 5 張
- 第 2、4 張
- 任意多選

飯團 Label：
獨立處理。

### 原則
重印外賣 Label：
唔可以順便重印飯團 Label。

## 14. Dining Print Boundary

堂食唔需要離開 Stage 6 先打印。

入口：
Stage 6 Table Detail
→ 打印／重印

可包括：
- 廚房製作單
- 打包單
- 堂食枱單／未結帳即時小票
- 堂食相關 Label

### 堂食枱單
未結帳都可打印。

但：
- 不代表已付款
- 不代表 Completed

故障／Pending／UNKNOWN：
底層交 Stage 11 管理。

## 15. Cancel Notice Boundary

Stage 5 正式取消，
如果 Production Ticket 已真正出過：

→ 產生 Cancel Notice Print Action

Stage 11 顯示：
- Cancel Notice
- 對應 Order
- Printer
- State

### 注意
Cancel Notice：
係新嘅正式 Print Side-effect。

唔係：
Reprint 原 Production Ticket。

## 16. Pending Print Recovery

App Restart 後：
Pending Print／Attention 必須仍在。

重新開 Stage 11：
讀返：
- Job Identity
- Order Link
- Ticket Type
- Route
- Printer
- Last Known State

### 禁止
Restart 後：
- 清空 Pending
- 當全部成功
- 自動重打一輪

## 17. Offline

WAN Offline：
本地打印照常。

Admin／Cloud 不可達：
- 用本地已有有效 Published Config／Binding
- 新同步狀態顯示 Degraded
- 唔拖死本地 Print Execution

### 注意
如果真正需要新 Admin Config 而本地冇有效資料：
只影響該 Config-dependent 行為，
唔將整個 SMT 鎖死。

## 18. Admin Sync 對 Print 嘅顯示

顯示：
- 最近同步時間
- 正常
- 待同步
- 失敗

如果 Admin 更新 Product Routing／Template：
SMT 顯示：
- Current Applied Version／狀態（如正式資料提供）
- Pending Update（如有）

### 原則
Admin Sync Failure：
唔可以令舊有本地有效 Print Config 突然消失。

## 19. Printer IP／Binding 修改後

保存成功：
新打印要求使用新 Binding。

已有 UNKNOWN Job：
唔可以因改 IP 就自動重送。

員工要逐張檢查／決定。

### 原因
Physical Result 可能已經發生。
避免 duplicate physical print。

## 20. Permission

Owner FINAL 已鎖：
有權登入 SMT
→ 有權修改 SMT 本機 Printer IP／相關設定。

Stage 11 R1：
唔加 Manager-only Gate。

但：
- 保存設定要有明確 Review
- 保留 Actor／Time
- 高影響 Binding 改動有 Audit

## 21. 未被 FINAL 鎖定嘅項目

以下行為喺 Owner FINAL 冇足夠產品規則支持，
Stage 11 R1 唔自行定為正式 Required Feature：

- 獨立「Test Print」按鈕嘅正式語義
- 自動 Fallback 去第二部 Printer
- 系統自動 Retry 次數
- 多部 Printer 自動 Load Balance
- 同一 Printer Queue 嘅具體排程策略
- Hardware SNMP／廠商專屬 Health Protocol

如日後需要：
→ 以 Addendum 鎖定。

## 22. Stage 11 Page States

### Normal
所有 Destination／Printer 顯示已知正常狀態。

### Attention
只標受影響 Route／Printer／Job。

### UNKNOWN
明確寫未知，
唔假裝 Success／Failure。

### Empty
冇 Printer：
顯示「尚未設定實體打印機」
＋ Binding 入口。

### Loading
局部 Loading。
唔遮 Order／Checkout。

## 23. Stage 11 明確不屬於本 Stage

- Product → Logical Printer Rule Authoring → Admin
- Template Authoring／Publish → Admin
- 正式交易建立 → Stage 2
- Order Reprint 發起 → Stage 4 Order Detail
- Dining Print 發起 → Stage 6 Table Detail
- Cancel 決定 → Stage 5
- Backup／Restore → Stage 12
- 全系統維護 → Stage 12

## 24. Stage 11 UI 優先級

P0：
- Logical Destination
- Physical Printer
- IP／Binding
- Published Template Selection
- Print Attention
- UNKNOWN 防重
- Pending Print Recovery
- Printer Diagnostics

P1：
- Route Trace
- Admin Sync for Print
- Audit
- Order／Dining Deep-link

P2：
- 動畫
- 額外 Hardware Telemetry

## 25. Stage 11 Definition of Done

1. Printer Settings 同 Order Reprint 分開。
2. Admin 負責 Product → Logical Destination。
3. SMT 只負責 Physical Printer／IP／Binding。
4. SMT 唔做 Template Authoring。
5. SMT 只揀 Published Template。
6. 每個 Logical Destination 顯示自己 Binding／Attention。
7. 每部 Physical Printer 狀態獨立。
8. Printer Failure 唔改 Order Truth。
9. UNKNOWN 唔自動猜結果。
10. UNKNOWN 唔 Blind Retry。
11. Pending Print Restart 後仍存在。
12. Offline 本地打印仍可工作。
13. 80mm Reprint 係 Whole Ticket。
14. Label 支援 Route／全選／多選／部分重印。
15. Reprint 唔重新成交／收款。
16. 堂食可由 Stage 6 直接打印／重印。
17. 堂食枱單唔代表已付款。
18. Cancel Notice 同 Reprint 語義分開。
19. 修改 Printer IP 不自動重送 UNKNOWN Job。
20. 有權登入 SMT 就可操作本機 Printer Setting。
21. FINAL 未鎖嘅 Auto Retry／Fallback／Test Print 唔自行加入正式產品要求。
22. Printer／Cloud 故障唔阻 Stage 1／2 本地交易。

## 26. 下一個 Stage
Stage 12｜系統維護／恢復／設定
