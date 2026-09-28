# MFK SMT B1 Same-Order Payment Correction｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / OTA GREEN

## Owner-locked semantics
- Payment correction stays on the SAME Order.
- No new Display number.
- Original tender is retained as immutable correction history.
- Current effective tender is updated.
- Repeated correction is append-only, e.g. CASH → FPS → PAYME.
- Reporting reads the latest effective tender only; prior tenders remain audit history.
- No new Order.
- No new Print Admission.
- No automatic reprint.
- No automatic cash drawer action.
- Restart/readback preserves both effective tender and full history.

## Permission boundary
Runtime mutation requires staff permission:
`ORDER_CORRECTION`

Permission is checked inside the runtime mutation boundary, not only in UI.

## Landed
Product main:
`09b08a582b43d82d6b8bcb240e87f6ec3866e024`

Bank:
`bank/MFK/SMT-B1-PAYMENT-CORRECTION-2026-09-26`

Changed:
- v2local/src/runtime/local-runtime.ts
- v2local/src/presentation/RuntimeOrdersWorkspace.tsx
- v2local/src/presentation/orders-workspace.css
- v2local/src/presentation/smt-payment-correction-b1.test.ts

## Proof
Post-merge V2 Local POS Smoke:
- run `36234323426`
- SUCCESS

Product merge summary:
- 39 / 39 test files PASS
- 171 / 171 tests PASS

## OTA
Exact OTA source:
`09b08a582b43d82d6b8bcb240e87f6ec3866e024`

Builder request:
`source_sha=09b08a582b43d82d6b8bcb240e87f6ec3866e024`
`channel=candidate`
`request_id=MFK-SMT-B1-PAYMENT-CORRECTION-R1-OTA-20260926`

OTA run:
`36234347952` SUCCESS

Release:
`runtime-candidate-mfk-09b08a582b43`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-09b08a582b43.mfos`

OTA proof:
- exact-source checkout PASS
- V2 Local tests/build PASS
- signed package PASS
- R2 publish PASS
- public manifest/hash/bundle readback PASS
- marker `MFK_RUNTIME_OTA_PUBLISHED`

## Protected
No change to:
- Order identity authority
- Checkout first commit
- Payment engine
- Print Router / Print Admission
- drawer execution
- Customer payment evidence
- Keeta provider after-sale/refund
- SMM / Customer / Admin / Keeta ingress

## Next
Per existing B1–B3 review order:
B3 Cancellation Notice audit / print-certainty closure is next.

B2 Refund remains deferred until refund-aware cash/reporting semantics are explicitly closed.

Standing cadence:
IMPLEMENT → PROOF → MERGE → BANK → CANDIDATE OTA → PUBLIC READBACK GREEN → NEXT PART
