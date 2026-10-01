# MFK Admin V3｜Print Transport Evidence Seam R1｜Handoff

日期：2026-10-01
狀態：BACKEND LANDED / V3 UI IMPLEMENTED ON PREVIEW BRANCH / NO PRODUCTION CUTOVER

## Backend Landing

- PR：#618
- Main merge SHA：`182fc7069067823e0326c59919d56a7a7451ab90`
- Scope：只擴現有 SMT `ORDER_UPSERT` projection，加入已存在嘅堂食首次打印 transport evidence。
- Production route / hostname / deploy / OTA：NO TOUCH

## Canonical Evidence Semantics

新投影欄位：`printEvidence`

- `scope = DINING_INITIAL`
- `certainty = TRANSPORT_ONLY`
- `attemptedAt`
- `completedAt`（如有）
- `state = DONE | FAILED | UNKNOWN`
- `planned / sent / failed`
- per-job：
  - `jobId`
  - `role`
  - `ok`
  - `code`

硬邊界：
- `DONE/SENT` 只係 transport evidence。
- 絕對唔等於實體紙張已成功出紙。
- `UNKNOWN` 保留 `UNKNOWN`。
- 本 seam 無 retry / reprint mutation。
- 無第二 Print engine。

## SMT Evidence

- `projection-outbox.test.ts` 新增 print transport evidence case。
- v2local full：91 files / 408 tests PASS。
- 原有 `smt-owner-print-recovery-a2`、`dining-first-print-d2` 等相關測試繼續 PASS。
- SMT Consolidation A3 / A3B：SUCCESS。
- Regression Shadow：SUCCESS。
- admin identity / customer / SMM landing gates：SUCCESS。

## V3 Admin UI

Branch：`feat/MFK-V3ADMIN-ONE-SHOT-R1`

已實作：
1. `V3ProjectedOrder.printEvidence` 正式 type。
2. Print「打印狀態／異常」由 Gap Page 改成 verified evidence surface。
3. 只讀 SMT projection：
   - 有證據訂單數
   - FAILED / UNKNOWN attention
   - per-job code
4. UI 明確顯示：
   - Transport ≠ Physical paper
   - UNKNOWN 禁止 blind retry
5. 無 safe retry command 前唔出「重印／重試」按鈕。
6. 新增 `formal-print-evidence.test.ts`。

## 仍未完成

- Generic 全單 PrintJob ledger 尚未存在。
- Payment receipt / addition print / non-dining print 未全部投影成同一正式 job ledger。
- Physical paper proof 仍屬 E3。
- Admin safe retry / reroute command 尚未接。

所以目前狀態係「PARTIAL VERIFIED」，唔係假裝完整。

MILESTONE: MFK_ADMIN_V3_PRINT_TRANSPORT_EVIDENCE_R1_PARTIAL_VERIFIED
