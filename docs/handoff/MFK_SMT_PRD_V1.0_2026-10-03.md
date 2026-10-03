# MFK SMT PRD V1.0｜Handoff

日期：2026-10-03  
里程碑：MFK_SMT_PRD_V1_2026-10-03  
狀態：PRODUCT_REQUIREMENTS_CONSOLIDATED

## 已完成
- 將 Owner SMT Working V2.5、Owner FINAL V1.0、Current Implementation UI Brief R1、SMT UI 優化記錄整合成單一 PRD。
- Owner Product Requirements：COMPLETE。
- Blocking Owner Product Decision：NONE。
- PRD 已分離：產品要求、current non-regression、UI_REWORK、FUTURE_WIRING、PHYSICAL_PENDING。
- 已列出 P0 功能、非功能守門、交易邊界、Current Superset、實作缺口快照、畫面集與 Definition of Done。

## 權威順序
1. Owner Working V2.5：最新產品要求。
2. Owner FINAL V1.0：封版基線。
3. Current Implementation UI Brief R1：已接受／已落地能力不得因 UI 重畫倒退。
4. SMT UI 優化記錄：UX 與驗收歷史證據。

## 重要守門
- 禁止重建 Store Kernel / Order / Pricing / Payment / Print / Combo authority。
- Final Payment Confirm 先係正式成交邊界。
- Offline 本地交易不得被 Cloud / Provider failure 拖死。
- Payment / Print / External UNKNOWN 必須 readback / reconcile，禁止 blind retry。
- 跨日日報 immutable；後續 adjustment append-only。
- 真機 printer / LAN / power-cycle 未驗只可標 PHYSICAL_PENDING。

## 下一步
開工前 fresh-read current main，逐項對照 PRD 的 LIVE / UI_REWORK / FUTURE_WIRING / PHYSICAL_PENDING；已完成項跳過，只處理第一個仍未完成缺口。
