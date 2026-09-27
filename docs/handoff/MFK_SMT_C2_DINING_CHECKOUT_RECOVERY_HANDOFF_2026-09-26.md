# MFK SMT C2 Dining Checkout Reload Recovery｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / OTA GREEN

## Product
main:
`aaad96531ffc9aa7a500fb46e6e3c32b62d1c9fb`

PR:
`#344`

Bank:
`bank/MFK/SMT-C2-DINING-CHECKOUT-RECOVERY-2026-09-26`

## Closed contracts
- Dining Checkout persists UI intent only; it is never Payment truth.
- App/reload restores the same Dining Checkout request and visible cart.
- Runtime Hold is always re-read before Checkout declares success.
- If the same submissionId is already committed, Checkout reconstructs the original payment result and never resubmits.
- If no payment exists and expectedRevision still matches, unpaid Checkout resumes safely.
- If revision is stale, Checkout fails closed and returns the operator to Dining refresh.
- Local read/storage recovery failure is explicit and never auto-collects.
- UI intent clears only on intentional exit/completion.
- C1 settlement runtime remains final authority and fresh-revalidates every payment.
- Same Hold/payment identity is preserved.
- No new Order / Display / Print / drawer side effects.

## Proof
Bounded proof:
`36240845435` SUCCESS

- 47 / 47 test files PASS
- 213 / 213 tests PASS
- build PASS
- protected seams PASS
- diff check PASS

Post-merge V2 Local POS Smoke:
`36240915716` SUCCESS

## OTA
Exact source:
`aaad96531ffc9aa7a500fb46e6e3c32b62d1c9fb`

Builder request:
`75d8200200baafbfdb1e3a9e9d0cfe220ebcde9d`

OTA run:
`36240949654` SUCCESS

Release:
`runtime-candidate-mfk-aaad96531ffc`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-aaad96531ffc.mfos`

Public manifest/hash/bundle readback PASS.
Marker:
`MFK_RUNTIME_OTA_PUBLISHED`

## Preserved
- C1 Dining settlement authority
- P1-3 Admin Dining table registry
- B1 payment correction
- B2 refund
- B3 cancellation notice
- Customer / SMM / Keeta / Admin
- Formal Dining Order / Dining Print / Drawer remain outside C2

## Next
C1 + C2 complete the P1-4 reliability/recovery scope.

Next must fresh-audit P2 / D1-D7 Dining full-chain semantics before any mutation because Formal Dining Order linkage, Dining print and drawer create protected Order / Payment / Print side effects.
