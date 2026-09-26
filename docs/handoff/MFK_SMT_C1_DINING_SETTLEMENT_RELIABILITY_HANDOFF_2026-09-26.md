# MFK SMT C1 Dining Settlement Reliability｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / OTA GREEN

## Product
main:
`83769e2fd7e39947462e4a1236584c94745fbc81`

PR:
`#343`

Bank:
`bank/MFK/SMT-C1-DINING-SETTLEMENT-2026-09-26`

## Closed contracts
- Stable Dining settlement submissionId.
- expectedRevision from authoritative Hold snapshot.
- Same-submission replay creates one payment only.
- Same submission with changed selection/tender rejects.
- Stale revision fails closed.
- Runtime fresh-reads durable storage before settlement.
- Storage write failure cannot publish payment success or release table.
- CASH requires sufficient actual received amount and preserves change.
- Partial payment keeps SAME Hold + table.
- Full payment archives SAME Hold + payment history and releases table in one durable write.
- Paid history survives restart and cannot be erased.
- Ordered waiting Dining Hold can settle without first occupying a table.
- Dining → Checkout carries submissionId + expectedRevision.
- No new Order / Display / Print / drawer side effects.

## Proof
Bounded proof:
`36240081007` SUCCESS

- 45 / 45 test files PASS
- 204 / 204 tests PASS
- build PASS
- protected seams PASS
- diff check PASS

Post-merge V2 Local POS Smoke:
`36240448468` SUCCESS

## OTA
Exact source:
`83769e2fd7e39947462e4a1236584c94745fbc81`

Builder request:
`e06f5a35df2806a030079633891acd474cb348fe`

OTA run:
`36240489285` SUCCESS

Release:
`runtime-candidate-mfk-83769e2fd7e3`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-83769e2fd7e3.mfos`

Public manifest/hash/bundle readback PASS.
Marker:
`MFK_RUNTIME_OTA_PUBLISHED`

## Preserved
- P1-3 Admin Dining table registry
- B1 payment correction
- B2 refund
- B3 cancel notice
- Customer / SMM / Keeta / Admin
- Print / drawer / Formal Dining Order remain untouched

## Next
C2 = Dining actual Checkout reload/recovery convergence from validated R3 lineage:
- persist resumable unpaid Checkout intent;
- reload before payment restores the same Dining Checkout intent;
- reload after committed payment reads the existing result and never resubmits;
- explicit stale/storage/recovery error state;
- runtime remains final authority and fresh-revalidates.

C2 does NOT add Formal Dining Order, print or drawer.
