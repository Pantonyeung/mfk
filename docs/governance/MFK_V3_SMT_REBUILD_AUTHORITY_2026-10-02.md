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
A4 — CURRENT / BLOCKED FOR OWNER CROSSWALK CLOSURE
A5 — Checkout + Money
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## Owner product precedence

Canonical product behavior:
1. Owner FINAL V1.0
2. Owner Working V2.5 as detailed decision evidence
3. historical UI optimization document as implementation/acceptance donor only

Controlling MFP crosswalk:
`docs/plan/MFP_V3_OWNER_REQUIREMENTS_CROSSWALK_2026-10-02.md`

A4 may not close until A4-C1..A4-C7 are SOURCE_VERIFIED.

## Permission product rule

A2 action-time permission infrastructure remains part of security architecture.

For this Owner product version, any successfully authorized MFP staff session must be granted the Owner-listed MFP/legacy-SMT operational capabilities by canonical policy; the client must not invent a Manager-only product gate.

This does not remove formal server/Store Kernel permission admission.

## Current execution

Stage:
A4 — Ordering Surfaces

Branch:
`feat/MFP-V3-A4-ORDERING-SURFACES-2026-10-02`

Parent exact SHA:
`adc2cc64573d9d5f7b357a7955ff2b0edc1fd509`

Current implementation slice:
SOURCE_VERIFIED

A4 stage closure:
BLOCKED

Completion target after Owner crosswalk closure:
SOURCE_VERIFIED

Carried production binding blockers from A2/A3 remain BLOCKED separately.

No merge / deploy / OTA / public cutover authority.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A4_CURRENT_2026_10_02`
