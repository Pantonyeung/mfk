# MFK SMT P1-3 Admin Dining Table Registry｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / OTA GREEN

## Scope closed
- Admin-published Dining table registry remains the only table authority.
- SMT assignment accepts only active published table IDs.
- Disabled / unknown table IDs fail closed.
- Occupied table assignment fails closed at runtime boundary.
- T01–T09 fallback exists only when no Admin registry is published.
- Dining operator UI uses published table display names for assignment confirmation, detail header and Checkout handoff.
- Existing occupied disabled/orphan table custody in readDining remains preserved.

## Product
main:
`f0dd8b5059bdeb488c0e92c859941735bb4ded7f`

PR:
`#342`

Bank:
`bank/MFK/SMT-P1-3-TABLE-REGISTRY-2026-09-26`

## Proof
Bounded proof:
`36239079044` SUCCESS

- 43 / 43 test files PASS
- 190 / 190 tests PASS
- build PASS
- protected seams PASS
- diff check PASS

Post-merge V2 Local POS Smoke:
`36239231355` SUCCESS

The first proof exposed only the known timestamp-based Hold-ID collision inside the test setup. The product table-registry code was unchanged; the test was isolated from that separate known allocator gap and the full proof passed.

## OTA
Exact source:
`f0dd8b5059bdeb488c0e92c859941735bb4ded7f`

Builder request:
`b964e8d59e05671edcc8253941c959b5a47fa346`

OTA run:
`36239483124` SUCCESS

Release:
`runtime-candidate-mfk-f0dd8b5059bd`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-f0dd8b5059bd.mfos`

OTA proof:
- exact source checkout PASS
- V2 Local tests/build PASS
- signed package PASS
- R2 publish PASS
- public manifest/hash/bundle readback PASS
- marker `MFK_RUNTIME_OTA_PUBLISHED`

## Protected
No change to:
- Payment / Refund
- Print
- Order identity
- Customer / SMM / Keeta
- Admin table authority

## Next
P1-1 / P1-2 / P1-3 operational residuals are now closed on current main.

Next code-complete SMT optimization:
C1 Dining settlement reliability:
stable submission identity + expected revision + replay/stale/storage safety.

Still not system-wide complete:
- C1/C2 Dining reliability
- D1–D7 Dining full chain
- physical printer/drawer acceptance
- Keeta real-provider acceptance where test environment exposes it
- Owner port remains deferred/not connected

Standing cadence:
IMPLEMENT → PROOF → MERGE → BANK → OTA → PUBLIC READBACK GREEN → NEXT.
