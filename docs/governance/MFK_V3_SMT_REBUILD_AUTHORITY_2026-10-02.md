# MoreFun POS V3 Rebuild Authority｜2026-10-02

Legacy filename retained intentionally:
`MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Date: 2026-10-02
Status: CURRENT / CONTROLLING FOR MFP V3 REBUILD
AuthorityScope: MoreFun POS fresh client rebuild A0–A9
Owner Authorization: EXPLICIT

## Product identity

MoreFun POS
- MFP Pad
- MFP Mobile

SMM is cancelled as final product identity.
Legacy SMM remains compatibility / UX donor only.

## Frozen authorities

Do NOT rebuild or duplicate:
- Store Kernel / Formal Transaction Authority
- Order Authority
- Pricing Authority
- Payment/Tender Authority
- Fulfillment Authority
- Print Router / Durable PrintJob Authority
- Admin canonical backend authority
- P0 sync semantics
- Customer / Keeta external authority contracts
- Runtime Availability / Capacity formal authority

## Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — CURRENT
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## A6 boundary

A6 may implement:
- canonical order operation read models
- formal order operation command adapters
- Orders / Fulfillment UI
- ETA
- Dining operational UI/orchestration
- sold-out/restore UI
- Capacity Pool UI
- channel thresholds
- bounded override
- More/Tools shell

A6 may NOT:
- allocate a second formal Order
- create client-only canonical fulfillment
- create a Dining-specific Order engine
- create a Dining-specific Payment engine
- create a new Availability/Capacity authority
- create physical Print authority
- bind external Customer/Keeta provider transport

## Same-order lock

All formal operations:
- fulfillment
- correction
- refund
- cancel
- dining assignment/transfer/addition

must preserve canonical Order identity unless the formal authority explicitly defines a different record type such as linked refund/adjustment.

## Current execution

Branch:
`feat/MFP-V3-A6-ORDER-OPERATIONS-2026-10-02`

Parent exact SHA:
`830fd2f033f2246c1a4f30da71a0a8f9160da751`

Completion:
SOURCE_VERIFIED

No merge / deploy / OTA / public cutover.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A6_CURRENT_2026_10_02`
