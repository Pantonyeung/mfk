# MFK SMT｜Stage 0 UI Implementation Handoff R1
日期：2026-09-28
狀態：READY FOR COMMANDER REVIEW
範圍：Stage 0｜啟動／登入／開更
Branch：work/MFK/SMT-STAGE0-UI-FINAL-R1
Base main：29901b86d18b06d4a19371fe3f3a6b91d8682a57
Current head：108706f0ce85a36242786bd72515b1f85e166938

## Visual Authority
Owner 已確認嘅 1920×1080 Stage 0 效果圖：
- 左側磨飯品牌／IP 區
- 中央「歡迎回來」員工登入
- 數字鍵盤
- 右側早晨／開更狀態／今日小目標／品牌卡／工具卡
- 底部版本／連線狀態
- 登入完成後進 Opening Cash
- Opening 完成後直接進點單
- 不設 Home Page

## 本輪實作
1. StaffAuthGate
- 改成 Stage 0 全屏 1920×1080 視覺
- 員工選擇 + PIN
- 數字 Keypad
- 掃碼登入只顯示 disabled，不虛構未有 runtime 能力
- 即時日期／時間
- Admin Sync / Local 可用狀態
- 登入成功仍沿用原 loginStaff authority

2. CashOpeningGate
- 同一 Stage 0 Design System
- 上一營業日 counted / removed / retained readback
- 今日 Opening Cash
- optional note
- Confirm 後沿用原 confirmCashOpening
- 同一 Business Date exactly-once 語義不變
- 成功後由現有 Gate composition 直接顯示 OperationalApp index，即點單頁

3. styles.css
- 新增 Stage 0 專用視覺層
- Pastel blue / warm cream
- Rounded cards / soft glass
- 1920×1080 三欄 + 64px footer
- 不改其他 Stage runtime semantics

## Source Diff
- v2local/src/presentation/StaffAuthGate.tsx
- v2local/src/presentation/CashOpeningGate.tsx
- v2local/src/styles.css

Branch vs base：
- ahead 5
- behind 0
- 3 files changed

## Authority Guard
未改：
- staff-auth runtime
- cash-opening runtime
- Order Engine
- Pricing
- Payment
- Print
- Business Day authority

## Commander Acceptance
A. 視覺
- 1920×1080 full-screen
- 無 Home Page
- 品牌區 / Login / Opening status hierarchy 對齊效果圖
- 大字、大按鍵、可站立操作

B. 功能
- 未登入不可操作 SMT
- PIN invalid 顯示 error
- Login success → Opening Gate
- Previous retained readback 正確
- Opening confirm → 直接點單
- Restart 同 Business Date 不重複 Opening
- Admin Sync 非 SYNCED 時仍顯示本地可用，而唔假裝 online

C. 安全
- 掃碼登入未有 runtime authority，所以 fail-closed disabled
- 冇第二 auth / cash engine
- 冇 main merge

## Known Validation Limit
本輪冇自行 trigger GitHub Workflow／Builder，避免未經 Commander 批准消耗 deployment/builder budget。
Commander 可按 repo 標準執行 build/test/visual acceptance。

RESULT：
READY_FOR_COMMANDER_REVIEW
