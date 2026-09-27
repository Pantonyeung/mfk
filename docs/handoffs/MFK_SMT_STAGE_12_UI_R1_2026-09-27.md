# MFK SMT｜Stage 12 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1 + OWNER 對 SMT 端口要求 FINAL V1.0
範圍：Stage 12｜系統維護／恢復／設定

## 0. Stage 定位
Stage 12 係 SMT 嘅低頻治理層，負責：
- 更多／工具中心
- 介面設定
- Admin Sync 狀態
- 檢查中心
- 操作診斷
- Backup／Restore 入口與狀態
- Offline／Degraded 狀態理解
- Restart 後恢復既有正式資料／未完成工作

核心原則：
- Stage 12 唔係 Home Page
- 唔佔左側高頻主導航
- 由頂部漢堡按鈕進入
- 維護／同步／Backup 問題不得拖死 Stage 1／2 本地交易
- 所有設定只改自己有權改嘅範圍
- 唔建立第二套 Order／Pricing／Payment／Print truth
- Owner FINAL 未鎖嘅 Recovery 粒度／Retention／OTA 流程，R1 唔自行發明

## 1. Page 12A｜更多／工具中心

### 入口
任何高頻頁：
頂部 Hamburger
→ 更多／工具中心

### 上方：今日即時營運摘要
最少：
- 今日營業額／營收摘要
- 今日訂單量
- 退款資訊
- 必要 Attention 數

呢度只做摘要。
深入分析：
→ Stage 10

### 下方：工具卡片
最少：
- 日結 → Stage 9
- 報表分析 → Stage 10
- 設備 → Stage 11 / Device Detail
- 打印設備 → Stage 11
- 檢查中心 → Stage 12
- Backup → Stage 12
- 恢復 → Stage 12
- 操作診斷 → Stage 12
- Admin Sync → Stage 12
- 介面設定 → Stage 12

### 原則
低頻工具集中，
唔同點單／訂單／堂食／售罄爭主導航位置。

## 2. Surface 12B｜介面設定

Owner 已鎖可調項目：
- 分類欄行／列密度
- 產品卡行／列密度
- 產品卡圖片顯示／隱藏
- 字體大小
- 整體 UI 尺寸／密度

### UI
左：
設定項

中：
連續 Slider／Stepper

右：
即時 Preview

### 要求
唔只：
Small / Medium / Large

而係：
可以連續微調到實際操作滿意。

### Actions
- 恢復目前已保存值
- 保存

### 保存後
重開 SMT：
保持設定。

### 核心
只改 Presentation。

禁止改：
- Product
- Price
- Order
- Payment
- Routing truth

## 3. Surface 12C｜介面 Preview

Preview 至少覆蓋：
- Category
- Product Card
- Cart 字體
- 通用 Button
- 75% Modal 比例感

### 原則
Preview：
只係顯示預覽。

唔建立測試 Order。
唔改正式交易資料。

## 4. Surface 12D｜Admin Sync

### Card 摘要
顯示：
- 是否已同步
- 最近同步時間
- 正常
- 待同步
- 失敗

唔只係一粒綠燈。

### Detail
按 Domain 分開顯示可理解狀態，例如：
- Menu / Product Config
- Payment Method
- Print Config
- 其他 SMT 正式使用嘅 Admin Published Config

### 每項
- Last Known Applied State
- Last Sync Time
- Current Status
- Attention（如有）

### 原則
Admin Sync Failure：
只影響真正依賴新 Admin 資料嘅功能。

已有有效本地資料：
繼續使用。

## 5. Scenario 12E｜Admin Sync Pending

狀態：
「待同步」

UI 顯示：
- 最近成功同步時間
- 本機目前使用嘅已知有效版本／狀態（如果正式資料提供）
- 哪個 Domain Pending

### 禁止
Pending：
→ 將整個 SMT 鎖住

### 操作
可提供：
「重新檢查狀態」

但唔應將同一個 mutation 盲目重做。

## 6. Scenario 12F｜Admin Sync Failure

顯示：
- 哪個 Domain
- 最近成功同步時間
- 本地目前仍使用咩已知有效資料
- Failure 摘要
- 下一步

### 核心
Failure ≠ 清空 Local Config。

如果本地已有有效資料：
- 點單照做
- Checkout 照做
- 本地打印照做

如果某項真係缺必要配置：
只阻該項，
唔拖死其他 Domain。

## 7. Page 12G｜檢查中心

集中檢查：
- 打印
- 網絡
- 同步
- 設備
- 訂單流
- 其他運行問題

### 第一層
每個 Domain 一張 Card：
- 正常
- Attention
- Unknown
- 最近檢查時間

### Card 顯示
- 發生咩事
- 影響咩
- 是否仍然可操作
- 下一步

### 原則
先俾前線理解。
唔喺第一層堆：
UUID／Stack Trace／工程碼。

## 8. Surface 12H｜操作診斷

由檢查中心／工具中心進入。

### List
每個事件：
- 時間
- 功能
- 發生咩事
- Current State
- 是否已恢復
- 下一步

### 點擊
→ Diagnostic Detail

### Detail
可再顯示：
- Domain
- Step
- Last Known Result
- Retry／Readback 狀態
- Technical Detail（深層）

### 原則
「總 Fail」唔夠。

要知道：
- 邊條流程
- 邊一步
- 已成功到邊
- 而家安全下一步係咩

## 9. Scenario 12I｜Offline / Degraded Status

WAN 斷線：
Stage 12 顯示：
「本地模式」

### 本地照常能力
- 點單
- Cart
- Checkout
- 本地 Payment Record
- Order Processing
- 堂食
- 暫存／取單
- 本地打印
- 本機日結資料

### Online-only Domain
各自顯示：
- Offline
- Pending Sync
- Degraded

### 原則
唔出一個全畫面：
「系統離線，禁止使用」

## 10. Surface 12J｜Recovery Overview

用途：
俾前線知道 Restart／斷線後，
系統已恢復到邊。

### 可顯示
- 本地正式 Order：已恢復／Attention
- 暫存 Cart：已恢復／Attention
- Pending Print：已恢復／Attention
- 堂食：已恢復／Attention
- Cash／Day Close local data：已恢復／Attention
- Pending Sync：數量／狀態

### 核心
呢頁係 Readback / Recovery Summary。

唔係：
「重建所有資料」按鈕。

## 11. Scenario 12K｜App Restart

Restart 後：

系統應讀返正式本地資料，
而唔係靠上一個畫面 Cache 猜。

至少唔可以無故失去：
- Formal Order
- Held Cart／暫存
- Pending Print
- Dining State
- Local Payment Facts
- Local Day Close Data

### UI
如果全部可讀：
→ 正常進入對應 Stage

如果部分有 Attention：
→ 顯示 Recovery Summary
→ 只標受影響 Domain

### 禁止
因一個 Online Domain 未恢復：
阻全部本地操作。

## 12. Surface 12L｜Backup

Owner FINAL 已鎖：
Backup 係低頻工具卡片。

### R1 可以顯示
- Backup 功能入口
- 最近已知 Backup 狀態（如果正式 runtime 有提供）
- 最近時間（如果正式資料有）
- 正常／Attention／Unknown

### 重要
Owner FINAL 未鎖：
- 備份邊啲資料
- Retention
- 自動／手動頻率
- Storage Destination
- Encryption 行為
- Restore Compatibility

所以 Stage 12 R1：
唔自行設計一套 Backup Policy。

## 13. Surface 12M｜Restore

Owner FINAL 已鎖：
Restore 係低頻工具入口。

### R1
可以有：
「恢復」卡片
→ 顯示 Restore Status／說明
→ 進正式 Recovery Surface（當工程／Addendum 定義後）

### 目前唔鎖
- 恢復全機／單 Domain
- 恢復到邊個時間點
- 可唔可以覆蓋現有交易
- Recovery Package 格式
- Rollback Window

呢啲全部需要後續工程／治理定義。

### 安全原則
未鎖 Restore Semantics 前：
唔設一粒「一按即覆蓋正式資料」嘅 destructive Action。

## 14. Surface 12N｜設備摘要

更多／工具中心嘅「設備」卡：
顯示本機相關設備摘要。

例如正式已接入嘅：
- Printer
- Network / Local Connectivity
- 其他外接設備

### 點擊
Printer：
→ Stage 11

其他設備：
→ 對應 Device Detail／Diagnostics

### 原則
Stage 12 做聚合入口。
唔同 Stage 11 重複建立第二套 Printer Settings。

## 15. Surface 12O｜權限

Owner FINAL 已鎖：
有權登入 SMT
→ 就有權操作 SMT 文件內嘅本機設定／功能。

Stage 12 R1：
唔再加 Manager-only Gate。

### 仍需
- 顯示目前登入 Staff
- 設定改動保留 Actor／Time（正式資料支援時）
- 高影響操作要清楚 Confirm

## 16. 通用錯誤狀態

每個維護 Domain 最少分：

### NORMAL
目前已知正常。

### ATTENTION
有明確問題需要處理。

### UNKNOWN
資料不足／未能確認。

### STALE
資料已舊。

### OFFLINE / DEGRADED
Online Domain 不可用，但 Local Domain 可運作。

### 原則
唔將所有問題統一顯示：
「系統錯誤」。

## 17. Stage 12 與其他 Stage 嘅邊界

### Stage 0
Login／Opening Cash

### Stage 1
點單／Cart

### Stage 2
Checkout／正式 Commit

### Stage 3
External Pending Intake

### Stage 4
正式 Order／Fulfillment

### Stage 5
Correction／Refund／Cancel

### Stage 6
Dining

### Stage 7
Sellability／Capacity

### Stage 8
Cash Movement

### Stage 9
Day Close

### Stage 10
Reporting／History

### Stage 11
Print Device／Print Failure

### Stage 12
低頻設定／Sync／Diagnostics／Backup／Restore／Recovery Overview

## 18. 明確唔自行加入嘅產品要求

OWNER FINAL 未鎖以下產品流程：

- OTA Update UI
- Auto Update Policy
- App Rollback
- Factory Reset
- Clear Local Database
- Clear Cache as Recovery
- Backup Retention
- Backup Storage Destination
- Restore Granularity
- Restore overwrite semantics
- Automatic full-system repair
- One-click reset all settings
- Remote owner takeover

R1 全部唔當正式 Requirement。

日後需要：
→ 新 Addendum。

## 19. Stage 12 UI 優先級

P0：
- 更多／工具中心
- 介面設定
- 即時 Preview／保存
- Admin Sync
- 檢查中心
- 操作診斷
- Offline／Degraded 理解
- Restart Recovery Summary

P1：
- Backup Status
- Restore Entry
- Device Summary
- Audit display

P2：
- 深層 Technical Diagnostics
- 動畫／非必要視覺效果

## 20. Stage 12 Definition of Done

1. 更多由頂部 Hamburger 進入，不佔高頻左側導航。
2. 上方先顯示今日營運摘要。
3. 低頻工具以卡片分區。
4. UI Density／Font／Product Image 等可連續調整。
5. UI 設定有即時 Preview。
6. 保存後 Restart 保留。
7. UI 設定只改 Presentation。
8. Admin Sync 顯示最近時間／正常／Pending／Failure，而唔只一粒燈。
9. Admin Sync Failure 唔清空有效 Local Config。
10. 檢查中心按 Domain 分問題。
11. 前線先睇可理解摘要，工程 Detail 再深入。
12. Offline 只影響真正 Online Domain。
13. Local 點單／Checkout／Payment Record／Order／Dining／Print／Day Close 繼續可用。
14. Restart 後正式 Order／暫存／Pending Print 等不可無故消失。
15. Recovery Overview 只做 Readback／狀態，不建立第二套 truth。
16. Backup／Restore 作低頻工具存在。
17. 未鎖 Backup／Restore semantics 不自行發明 destructive workflow。
18. Stage 12 唔重做 Stage 11 Printer Settings。
19. 有權登入 SMT 就可使用 Owner 已鎖 SMT 本機設定。
20. Cloud／Admin／Owner／Provider failure 唔阻本地交易。

## 21. SMT Stage UI Text Design R1 完成狀態

Stage 0｜啟動／登入／開更
Stage 1｜現場建單／草稿
Stage 2｜Checkout／付款／正式成交
Stage 3｜外部新單接入
Stage 4｜正式訂單營運／出餐
Stage 5｜正式交易修正／取消／退款
Stage 6｜堂食／輪候
Stage 7｜售罄／產能／接單控制
Stage 8｜營業中錢箱
Stage 9｜日結／留櫃
Stage 10｜報表／歷史／跨日追溯
Stage 11｜打印／設備／故障
Stage 12｜系統維護／恢復／設定

狀態：
STAGE 0–12 TEXT FUNCTION / UI STRUCTURE COMPLETE

下一工序：
Stage-by-Stage Wireframe / Visual UI Production
