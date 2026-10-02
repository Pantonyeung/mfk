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

SMT may remain temporarily as an internal Store Kernel / sync port identifier.

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

## Client rules

- no v2 client-state imports
- no periodic business polling
- no periodic auth polling
- Doorbell is invalidation only
- A3 active projection is the ordering source
- no surface-specific canonical truth
- Pad/Mobile share business/security/sync contracts
- no SMM authority/state/head/session path

## Ordering authority boundary

A4 may:
- select/project active canonical ordering facts
- render categories/products/options/combo
- maintain local cart draft
- compute local preview arithmetic from published price material facts
- display sellability
- produce normalized ordering intent

A4 may NOT:
- create Formal Order
- allocate formal order/display identity
- become Pricing Authority
- bypass later checkout/revision validation
- create payment/fulfillment/print truth
- mutate canonical sellability
- directly fetch/poll Admin catalog from UI

Formal checkout/price validation begins A5.

## UI strategy

A1–A3:
architecture seams + verification harnesses.

A4–A6:
formal MFP Pad + Mobile product UI with business capability.

A7–A9:
hardware/external/public/physical hardening and final polish.

## Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — CURRENT
A5 — Checkout + Money
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## Current execution

Stage:
A4 — Ordering Surfaces

Branch:
`feat/MFP-V3-A4-ORDERING-SURFACES-2026-10-02`

Parent exact SHA:
`adc2cc64573d9d5f7b357a7955ff2b0edc1fd509`

Completion target:
SOURCE_VERIFIED

Carried production binding blockers from A2/A3 remain BLOCKED separately.

No merge / deploy / OTA / public cutover authority.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A4_CURRENT_2026_10_02`
