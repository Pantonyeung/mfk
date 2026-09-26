# MFK SMT P1-3｜Admin Dining Table Registry Lineage Audit

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION / NO MERGE
CONTROL: #321

## Owner-locked authority
Dining table definitions belong to Admin-published Store Settings:
stable id / display name / active / sortOrder.
SMT and SMM consume the SAME registry.
No second table registry in SMT.

## Exact validated donor
R5 Dining Control Reconcile:
- candidate 5fc6581431df15927a613b06a6e41090b621a88b
- run 36147577726 SUCCESS
- 40/40 test files, 196/196 tests PASS, build PASS
- PR #305 DRAFT / OPEN / UNMERGED

## Current main reality
Current main already contains:
- readSmtDiningTableRegistry()
- active filtering + sortOrder
- readSmtStoreSettings().diningTables
- Runtime readDining() using Admin registry
- orphan occupied disabled-table custody/readback
- current SMM/direct, Customer/owned, Keeta/platform source lanes

These are BANKED_NO_TOUCH.

Remaining gaps:
1. OrderingPage hold/dining selector still hard-codes T01–T09.
2. assignDiningTable() accepts tableId without validating current published active registry.
3. RuntimeDiningWorkspace success copy derives label from raw table id instead of published display name.

Later R6 donor identified the assign-validation residual, but the cumulative R6 branch is RED. Reuse only the exact bounded delta after clean replay.

Classification:
BANKED_LINEAGE_GAP / PARTIAL CURRENT MAIN.

## Future smallest allowlist
- v2local/src/App.tsx
- v2local/src/runtime/local-runtime.ts
- v2local/src/presentation/RuntimeDiningWorkspace.tsx
- tests

NO Admin worker mutation.
NO SMM mutation.
NO new table authority.

## Required contracts
TABLE-01 Admin rename propagates to hold selector + Dining board.
TABLE-02 disabled table absent for new assignment.
TABLE-03 occupied disabled/orphan table stays visible until settled/cleared.
TABLE-04 sortOrder respected.
TABLE-05 unknown/stale table id rejects.
TABLE-06 assignment/transfer in this slice causes no new payment/print side effect.
TABLE-07 fallback 1–9 only when no published registry.
TABLE-08 SMM shared registry regression remains GREEN.

STATUS:
P1_3_EXACT_REMAINING_GAP_MAPPED
ADMIN_AUTHORITY_UNCHANGED
