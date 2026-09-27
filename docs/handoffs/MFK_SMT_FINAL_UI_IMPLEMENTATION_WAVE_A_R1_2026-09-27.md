# MFK SMT｜FINAL UI Implementation｜Wave A Checkpoint R1
日期：2026-09-27
狀態：IMPLEMENTATION IN PROGRESS
Branch：work/MFK/SMT-FINAL-UI-IMPLEMENTATION-R1
Base main：3cab695ef736a75c7fcc0bb3690df39cc01e587d
Current head：150ca57b69829b4e4d177edf5064e8c1d846b3af

## 本輪已落 Code

### 1. Global Shell
`v2local/src/App.tsx`
- 主導航「點餐」→「點單」
- 「售罄」→「售罄／產能」
- Left Rail 移除「更多」
- 新增 Top Bar Hamburger「更多」
- Top Bar 顯示 Business Date
- Top Bar 顯示當前 Page / Stage
- Top Bar 顯示 Active Order count / LOCAL FIRST / Staff Session
- `/more` route 保留，但只由 Hamburger 進

### 2. Shell / Design Tokens
`v2local/src/styles.css`
- 1920×1080 shell 改為 92px rail + 64px top bar
- 新增 FINAL UI token set
- Rail 轉日系專業 neutral / blue primary
- Active nav 改 blue semantic
- Staff session 收入 top bar
- Route stage 改 neutral surface
- 新增 `--smt-ui-scale` baseline

### 3. Ordering Incoming Ratio
`v2local/src/features/ordering/ordering-workspace.css`
- Customer Pending / Keeta strip → 60 / 40

### 4. Checkout Quick Cash
`v2local/src/features/checkout/CheckoutWorkspace.tsx`
- Cash quick key 加入 $20
- 現為 20 / 50 / 100 / 200 / 500 + 剛好

## Diff
Branch ahead of base：4 commits
Changed files：4
- App.tsx
- styles.css
- ordering-workspace.css
- CheckoutWorkspace.tsx

## Validation
- compare base/head：ahead 4 / behind 0
- GitHub combined commit status：目前無 status checks 回報
- 未 Merge main
- 未改 runtime authority
- 未改 Order / Pricing / Payment / Print canonical engine

## 下一刀
P0 Checkout Convergence：
1. Student Discount 正式 UI / model seam
2. 75% Final Review
3. 「付款確認」成為 UI 最終確認 surface
4. SUCCESS / KNOWN FAILURE / UNKNOWN 文案與 Recovery 收斂

之後：
Orders / Dining / Capacity visual convergence。
