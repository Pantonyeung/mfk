# MFK POS｜SMT 統一雙介面架構提案｜2026-10-02

狀態：SUPERSEDED / HISTORICAL DESIGN INPUT
SupersededAt: 2026-10-02 Asia/Hong_Kong
SupersededBy: `docs/governance/MFK_UNIFIED_SURFACES_R1_AUTHORITY_2026-10-02.md`

本文件原本係提案。Owner 已於 2026-10-02 正式鎖定 Unified Surfaces R1，所以本文件不再係執行 authority；以下內容只保留作設計背景及風險參考。

## 已鎖產品決策

正式產品結構：
- SMT Desktop
- SMT Mobile / Handheld

獨立 SMM 不再係最終產品身份；Legacy SMM 只作 transitional compatibility，直到新 Handheld `PHYSICAL_VERIFIED` 並獲 Owner 另行批准 decommission。

## 不變的核心原則

- 同一 Store Kernel / Formal Transaction Authority。
- 同一 Pricing、Order、Fulfillment、Revision、Idempotency、Readback。
- Handheld 只係操作 Surface，不建立第二 Order / Pricing / Print authority。
- Desktop 與 Handheld 不做等比例縮放；共用 business logic，但各自有適合裝置的 interaction layout。

## 打印架構

任何 Surface 觸發需要打印的正式業務操作：

UI → Store Kernel → Durable PrintJob → Print Router → Hardware Host / Print Edge → Physical Printer

手機不直接持有實體 printer authority。
實體 IP / USB / driver 綁定留在座機／硬件 Host。

## 仍需在實作／驗收處理的風險

如果唯一座機同時係唯一 Print Host，座機死機時手機仍可操作但無法保證打印。

正式 acceptance 必須證明實際 Print Host / fallback 行為；未有證據不可將物理打印標成 `PHYSICAL_VERIFIED`。

## 原提案待決項的目前狀態

1. 產品命名是否取消 SMM/SMN：
   - RESOLVED：最終產品只保留 SMT Desktop / SMT Mobile-Handheld。
2. 同一 App Package 或同一 Codebase 分開 native shell/package：
   - IMPLEMENTATION DETAIL；不得改變單一 SMT Authority。
3. Print Host failover：
   - ACCEPTANCE / IMPLEMENTATION GATE；未驗證前保持 BLOCKED，不得自行建立第二 Print Authority。
