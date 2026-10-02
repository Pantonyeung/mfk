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

## Frozen authorities

Do NOT rebuild or duplicate:
- Store Kernel / Formal Transaction Authority
- Order Authority
- Pricing Authority
- Payment/Tender / Refund Authority
- Fulfillment
- Print Router / Durable PrintJob
- Admin canonical backend
- P0 sync semantics
- Runtime Availability / Capacity
- Customer app Order authority
- Keeta provider authority / adapter identity contracts

## Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — SOURCE_VERIFIED / OWNER ACCEPTED
A7 — SOURCE_VERIFIED / OWNER ACCEPTED
A8 — CURRENT
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## A8 boundary

A8 may implement:
- external intent read models
- bounded adapter interfaces
- pending/review UI
- Customer evidence/contact workflows
- Customer cutoff/stop command/readback surfaces
- Customer modification confirmation readback
- Keeta inbound identity/mapping/ACK
- Keeta auto/manual/defer/lifecycle
- Keeta after-sale orchestration
- external attention/health
- event-driven reconcile coordinator

A8 may NOT:
- commit Customer/Keeta Orders outside Store Kernel
- treat payment screenshot as payment truth
- create a second refund ledger
- create a second capacity calculation
- create an external print engine
- keep provider secrets in browser
- reintroduce periodic/focus business polling

## External identity rule

Customer:
submissionId + idempotencyKey are stable intent identity.

Keeta:
providerOrderId + providerMessageId + fingerprint are provider identity evidence.

Duplicate external delivery must not create duplicate canonical Orders.

## Current execution

Branch:
`feat/MFP-V3-A8-CUSTOMER-KEETA-EXTERNAL-2026-10-02`

Parent exact SHA:
`806ca51cfd812a968f9208a45e14d8a228fa91e1`

Completion:
SOURCE_VERIFIED

No merge / deploy / OTA / public cutover.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A8_CURRENT_2026_10_02`
