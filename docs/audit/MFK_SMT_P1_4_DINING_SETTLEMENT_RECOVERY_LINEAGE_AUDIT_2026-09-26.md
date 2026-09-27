# MFK SMT P1-4｜Dining R2/R3 Settlement Identity + Recovery Lineage Audit

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION / NO MERGE
CONTROL: #321

## Owner requirement
Dining partial/full settlement preserves one existing Dining transaction identity, is replay-safe, rejects stale snapshots, persists before UI success, retains history after full payment, and reloads without double collection.

This slice does NOT add Formal Dining Order linkage or Dining print/drawer.

## Exact validated donor R2
- product commit 5b109349e12b219be542222dede850ecbe74aabb
- exact tested candidate e4bee0a1fe8c9ec6e0eca866a1f4955d0bed802b
- run 36134100635 SUCCESS
- 38/38 test files, 187/187 tests PASS
- R1 browser 12/12 PASS
- payment/offline browser 5/5 PASS
- PR #293 DRAFT / OPEN / UNMERGED

R2 locks stable submissionId, expectedRevision, receivedMinor, replay dedupe/conflict, stale reject, quantity/money guards, durable-write-before-UI, storage-failure fail-closed, partial retention, full-payment archive/release/history.

## Exact validated donor R3
- product c5975e01d5a5501c6aaddb6d24186846fe9e45ae
- exact tested candidate d329e6ac47cc4e81407fe64277cf36ea4242137a
- handoff 30144ca2e4d074b9d6b53cca6035db26d71618bb
- run 36138890959 SUCCESS
- 38 test files / 187 unit tests PASS
- actual Checkout 10/10
- R1 browser 12/12
- R2 browser 5/5
- packaged offline tablet+desktop 2/2
- build PASS
- PR #297 DRAFT / OPEN / UNMERGED

R3 locks actual Dining→Checkout flow, Dining source as local payment, resumable UI intent only, unpaid reload restore, paid reload readback without resubmit, and explicit stale/storage errors.

## Current main reality
Current main basic settleDiningHold has:
- no stable submissionId
- no expectedRevision
- no receivedMinor
- no replay identity
- no stale-version gate
- payment id generated from Date.now
- no archived history/reload-safe checkout intent
- clearDiningHold deletes the Hold after balance reaches zero

Classification:
OWNER_REQUIREMENT_LOCKED + VALIDATED_UNMERGED.
This is reliability convergence, not a second Payment engine.

## Integration risks
1. Do not import demo/synthetic acceptance harness into production.
2. Reuse one local durable envelope; no second Dining Payment store.
3. R2 did not prove cross-tab/cross-device serialization.
4. R3 UI session is intent only; runtime always fresh-read/revalidates.
5. Replay against fresh current main to retain newer Admin/Customer/SMM/Keeta work.
6. Formal Dining Order/print/drawer stay P2.

## Future smallest allowlist
- v2local/src/runtime/local-runtime.ts
- v2local/src/App.tsx
- CheckoutWorkspace/model only as required
- dining-checkout UI-session helper
- RuntimeDiningWorkspace
- tests

NO Customer/SMM/Keeta/Admin mutation.
NO Formal Order admission.
NO print/drawer.

## Required contracts
DIN-01 same submission retry => one payment.
DIN-02 same submission changed payload => reject.
DIN-03 stale revision => reject.
DIN-04 illegal duplicate lines/qty/amount/cash insufficient => reject.
DIN-05 persistence failure => zero paid/release UI effect.
DIN-06 partial payment retains table/history.
DIN-07 full payment archives items/payments/last table and releases current table atomically.
DIN-08 reload before commit restores same intent only.
DIN-09 reload after commit reads original result, never resubmits.
DIN-10 waiting settlement supported where locked.
DIN-11 five-port E2E unchanged.
DIN-12 zero print/drawer/Formal Order side effects.

STATUS:
P1_4_EXACT_R2_R3_DONORS_MAPPED
NO_SECOND_PAYMENT_ENGINE
