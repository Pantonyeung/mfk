# MoreFun POS V3 Rebuild Authority｜2026-10-02

Legacy filename retained intentionally:
`MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Date: 2026-10-02
Status: CURRENT / CONTROLLING FOR MFP V3 REBUILD
AuthorityScope: MoreFun POS fresh client rebuild A0–A9
Owner Authorization: EXPLICIT

## Product identity

External product:
MoreFun POS

Short name:
MFP

Surfaces:
- MFP Pad
- MFP Mobile

SMM is cancelled as final product identity.
Legacy SMM remains compatibility / UX donor only.
SMT may remain temporarily as internal Store Kernel / sync port identifier.

## Supersession

For MFP V3 A0–A9, this authority supersedes PR #627 / Unified Surfaces R1 as current execution control.

## Frozen authorities

Do NOT rebuild or duplicate:
- Store Kernel / Formal Transaction Authority
- Order Authority
- Pricing Authority
- Payment/Tender Authority
- Fulfillment Authority
- Print Router / Durable PrintJob Authority
- Admin canonical backend authority
- P0 checkpointed-delta sync semantics
- Customer / Keeta external authority contracts

## Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — CURRENT
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## A5 authority boundary

A5 may implement:
- Checkout UI/domain
- formal validation request/readback seam
- channel/tender selection
- cash collection UX
- Student Discount intent
- Final Review
- formal Payment Confirm command path
- Business Day/cash opening client contract
- Cash In/Out ledger client contract
- Day Close/cash count
- Channel/Tender reporting read models
- immutable Daily Report money facts

A5 may NOT:
- create a second Pricing Engine
- create a second Payment/Tender Authority
- create formal Order truth in client state
- manufacture COMMITTED/payment success
- create Print authority
- create Fulfillment authority
- require cloud round trips for unrelated local Store Kernel operations

## Formal transaction rule

Only explicit Payment Confirm may cross the formal transaction boundary.

Before Payment Confirm:
- zero formal order commit
- zero first-print/production effect
- zero formal sale cash ledger effect

After submit:
- result must be COMMITTED / REJECTED / UNKNOWN
- canonical readback is authoritative
- retry reuses the same submission identity

## Owner FINAL permission rule

Authenticated/authorized MFP staff are eligible for FINAL-defined frontline/local operations.
No Manager-only Gate in this Owner version.

This does not remove:
- device authorization
- formal session validation
- expiry/revocation fail-closed
- Store Kernel admission

## Current execution

Stage:
A5 — Checkout + Money

Branch:
`feat/MFP-V3-A5-CHECKOUT-MONEY-2026-10-02`

Parent exact SHA:
`b83321000668d39580a29e2e838aa585d5750fd5`

Completion target:
SOURCE_VERIFIED

No merge / deploy / OTA / public cutover authority.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A5_CURRENT_2026_10_02`
