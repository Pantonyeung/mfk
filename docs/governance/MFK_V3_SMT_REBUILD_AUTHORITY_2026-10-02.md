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

SMM is cancelled as final product identity but is not yet authorized for deletion/decommission.

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
- Keeta provider authority
- Android Carrier runtime/OTA protocol

## Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — SOURCE_VERIFIED / OWNER ACCEPTED
A7 — SOURCE_VERIFIED / OWNER ACCEPTED
A8 — SOURCE_VERIFIED / OWNER ACCEPTED
A9 — CURRENT

## A9 source authority boundary

A9 may implement:
- exact source/build identity
- V3 runtime.ready compatibility
- bounded native bridge adapter
- production adapter binding where a real authority already exists
- Check Center / diagnostics
- fault journal read/write seam
- runtime/OTA status
- safe backup/restore boundary
- public acceptance safe mode
- readiness verdict
- physical acceptance/runbook evidence structures
- cutover/decommission gate enforcement

A9 may NOT:
- fabricate missing formal business authority
- put Store Kernel aggregate mutation logic in browser to replace a missing formal command router
- publish a candidate without explicit gate authorization
- infer physical success from source tests
- decommission SMM before PHYSICAL_VERIFIED + Owner approval

## Builder exact-source rule

Current Builder workflow still builds `v2local`.

MFP V3 candidate publish is BLOCKED until Builder A9 PR #174 becomes SOURCE_VERIFIED for `v3smt` packaging.

Preserve:
- exact MFK SHA
- signed .mfos
- SHA-256
- runtime manifest
- public readback
- Candidate/Current/Previous
- runtime.ready
- rollback

No second OTA protocol.

## Identity rule

`NO EXACT IDENTITY = NO CUTOVER`

Repository HEAD is not deployment proof.

## Production binding rule

Every A1–A8 fail-closed placeholder must either:
- bind to a proven production authority, or
- remain explicitly BLOCKED.

No fixture fallback in production.

## Physical rule

Only real-device evidence can produce:
`PHYSICAL_VERIFIED`

CI/build/published candidate are insufficient.

## Cutover rule

Final cutover and SMM decommission require:
- accepted exact MFK SHA
- accepted exact Builder SHA
- published runtime identity/hash
- PHYSICAL_VERIFIED
- public/domain readiness
- explicit Owner authorization

## Current execution

Branch:
`feat/MFP-V3-A9-PUBLIC-DIAGNOSTICS-PHYSICAL-CUTOVER-2026-10-02`

Parent exact SHA:
`83adb14c21170bc3a34a0022c62b1a2bea2f68c4`

Current pass completion:
SOURCE_VERIFIED

No deploy / OTA / public cutover.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A9_CURRENT_2026_10_02`
