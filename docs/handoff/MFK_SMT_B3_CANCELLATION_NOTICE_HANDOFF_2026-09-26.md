# MFK SMT B3 Automatic Cancellation Notice｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / OTA GREEN

## Owner decision
P1 AUTO.

When staff confirms cancellation:
- if a 製作單 had actually printed successfully before, automatically print ONE cancellation notice to the production printer route;
- if no production print success was confirmed, print nothing;
- repeated cancellation never prints a second notice;
- cancellation notice never opens cash drawer;
- no automatic refund;
- no normal receipt / packing / label reprint;
- provider / Keeta cancellation remains separate and does not trigger this local auto notice.

## Runtime certainty
Production issue is recorded only from actual print result:
`role === 製作單 && ok === true`

Persisted fields:
- `productionIssuedAt`
- `cancellationNoticeAttemptedAt`
- `cancellationNoticePrintedAt` only on confirmed success
- `cancellationNoticeState = DONE | FAILED | UNKNOWN`

If the production route is missing at cancellation time:
- Order cancellation still succeeds.
- cancellationNoticeState becomes FAILED.
- repeated cancel does not retry automatically.

If native print throws and outcome cannot be known:
- cancellationNoticeState becomes UNKNOWN.
- UI tells operator to verify kitchen before doing anything else.

## UI
Orders detail shows cancellation notice certainty:
- DONE = 已打印
- FAILED = 打印失敗
- UNKNOWN = 結果未能確認

Cancel confirmation copy explicitly states:
- no auto refund;
- no original-order reprint;
- no drawer;
- no external platform notification;
- but if production was successfully issued, one cancellation notice prints automatically.

## Landed
Product main:
`a43806b1dfe042a945bd6fe4b0085323126314b9`

PR:
`#339`

Bank:
`bank/MFK/SMT-B3-CANCELLATION-NOTICE-2026-09-26`

Changed:
- v2local/src/runtime/local-runtime.ts
- v2local/src/presentation/RuntimeOrdersWorkspace.tsx
- v2local/src/presentation/smt-cancellation-notice-b3.test.ts

## Proof
Bounded proof:
- run `36235323016` SUCCESS
- 40 / 40 test files PASS
- 176 / 176 tests PASS
- build PASS
- protected seams PASS
- diff check PASS

Dynamic B3 tests cover:
- one automatic notice after confirmed production issue;
- no notice without production issue;
- FAILED on missing route with no auto retry;
- provider cancellation remains free of the local print side effect.

First two proof attempts failed only in the new Node native-print simulation harness. Product semantics were unchanged; the harness was corrected, then full proof passed.

Post-merge:
- V2 Local POS Smoke `36235387736` SUCCESS

## OTA
Exact OTA source:
`a43806b1dfe042a945bd6fe4b0085323126314b9`

Builder request commit:
`ace4254697eb14f6bb51027019b0e5e925027d11`

OTA run:
`36235414221` SUCCESS

Release:
`runtime-candidate-mfk-a43806b1dfe0`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-a43806b1dfe0.mfos`

OTA proof:
- exact-source checkout PASS
- V2 Local tests/build PASS
- signed runtime package PASS
- R2 publish PASS
- public manifest/hash/bundle readback PASS
- marker `MFK_RUNTIME_OTA_PUBLISHED`

## Protected
No change to:
- Order identity
- Payment/Tender
- Refund
- Print Router authority
- receipt/packing/label routes
- cash drawer
- Keeta/provider cancellation/refund
- Customer/SMM/Admin/Keeta ingress

## Next
B2 Refund remains the next money-operations subject, but is still blocked on explicit refund-aware cash/reporting semantics.

Standing cadence:
IMPLEMENT → PROOF → MERGE → BANK → CANDIDATE OTA → PUBLIC READBACK GREEN → NEXT.
