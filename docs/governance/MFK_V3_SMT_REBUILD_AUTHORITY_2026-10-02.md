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
- Payment/Tender Authority
- Fulfillment Authority
- Print Router / Durable PrintJob Authority
- Admin canonical backend authority
- P0 sync semantics
- Runtime Availability / Capacity authority
- Customer / Keeta external authority contracts
- Android Carrier native Print Gateway

## Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — SOURCE_VERIFIED / OWNER ACCEPTED
A7 — CURRENT
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## A7 authority boundary

A7 may implement:
- canonical PrintJob projection/readback
- injected gateway binding seam
- local printer binding UI
- printer health/test UI
- formal reprint intent UI
- Dining print/reprint UI
- cancel-notice print binding
- cash drawer execution boundary
- print failure attention
- source-level restart/recovery semantics

A7 may NOT:
- author Product → Printer business routing
- author formal Print Templates
- create a browser PrintJob authority
- create a second durable print queue
- auto retry UNKNOWN physical outcomes
- claim physical paper success from transport evidence

## Print uncertainty rule

`TRANSPORT EVIDENCE != PHYSICAL PAPER PROOF`

`UNKNOWN / AMBIGUOUS_AFTER_SEND != FAILED_BEFORE_SEND`

After uncertain physical dispatch:
- no blind retry
- preserve job/evidence
- human explicit reprint if needed

## Admin / local split

Admin:
- product routing
- logical destination
- template publish

MFP local:
- physical printer
- IP/port
- local binding
- published template selection where allowed
- hardware execution

## Current execution

Branch:
`feat/MFP-V3-A7-PRINT-HARDWARE-RECOVERY-2026-10-02`

Parent exact SHA:
`881afbd5fd463b4833e3b5980123fe33679bb260`

Completion:
SOURCE_VERIFIED

No merge / deploy / OTA / public cutover.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A7_CURRENT_2026_10_02`
