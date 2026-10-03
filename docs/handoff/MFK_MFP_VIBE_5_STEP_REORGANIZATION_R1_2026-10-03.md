# MFK MFP｜Vibe Coding 五步重整｜2026-10-03

> 命名更新：原「SMT」正式改名為「MFP（MoreFun POS）」。歷史文件／舊路徑保留原名只作追溯。

## 目的
將現有 MFP PRD 由「功能清單」重整成可直接設計、開發、驗收的五步流程。

## Step 1｜目標
- 一句話：MFP 係店員前線 POS，用最少步驟完成點單 → 收款 → 打印 → 出餐，同時保持 Local First。
- 使用者：店員為主；Owner／Manager 只做必要設定與例外處理。
- 場景：現場外賣／堂食、自家 Customer 待處理、Keeta、繁忙時段、斷網／重啟。
- 核心價值：快、固定肌肉記憶、單一交易真相、Offline 可繼續。
- 第一版不做：第二 Order/Pricing/Payment/Print Engine、完整 Owner App、Marketing/CRM 深功能。

## Step 2｜PRD／資訊架構
主介面：
1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

獨立工作區：
5. Checkout
6. 更多／工具中心

更多內：
- 日結
- Cash In / Out
- 報表
- 打印／設備
- 診斷
- Backup / Restore
- Admin Sync

共用大型 Modal：
- Customer Pending
- Keeta Pending
- Product Detail
- Required
- 快速組合
- 紫米套餐
- 暫存／堂食
- Payment Evidence
- Payment Correction
- Refund
- Reprint
- Final Payment Review
- Capacity Override

## Step 3｜設計
- 1920×1080 桌面 POS
- 日系極簡、專業餐飲、藍色主視覺
- 高頻操作固定位置
- 主要 Modal 約 75%
- 紅色只作取消／錯誤／警示
- 先做可點 HTML Prototype，再鎖 Design System：字體、間距、圓角、按鈕、狀態、卡片、Modal。
- Prototype 可用假資料，但正式 Runtime 不可假裝 FUTURE_WIRING 已完成。

## Step 4｜AI 開發
唔照搬 iOS / SwiftUI 做法；沿現有 MFK Runtime + Android Carrier + Web UI。

開發次序以「完整操作旅程」為單位，而唔係孤立逐頁：
Shell → Ordering → Product Detail / Required → Cart → Checkout → Final Review → Formal Commit → Completion Review → Orders → Dining → Sold-out / Capacity → More / Tools。

每完成一段：
- 真 Runtime 跑一次
- Screenshot / Browser acceptance
- Automated test
- 回歸舊流程
- 禁止重建 Store Kernel、Pricing、Payment、Print、Fulfillment authority

## Step 5｜驗收
人工 Golden Path：
- 現場外賣
- 堂食
- Customer Pending
- Keeta Auto / Manual
- Payment Correction
- Refund / Cancel
- Reprint
- Sold-out / Capacity
- Day Close

必測失敗場景：
- Double Tap
- App Restart
- Offline / Reconnect
- Duplicate submission
- Payment UNKNOWN
- Printer UNKNOWN / Offline
- Keeta duplicate / late arrival
- Cash / Business Day restart
- Power-cycle

最後分兩級：
- SOFTWARE_GREEN
- PHYSICAL_ACCEPTED

未真機／真 Printer 驗證，不可宣稱完成。

## 里程碑
MFK_MFP_VIBE_5_STEP_REORGANIZATION_R1
