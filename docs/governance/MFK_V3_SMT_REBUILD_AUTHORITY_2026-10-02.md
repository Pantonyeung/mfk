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

SMM product identity is cancelled.
Legacy SMM remains transitional compatibility / UX donor only.

SMT is not the user-facing target name.
Existing SMT identifiers may remain temporarily as internal Store Kernel / sync port identifiers.

## Supersession

For MFP V3 A0–A9 implementation, this authority supersedes PR #627 / Unified Surfaces R1 as current execution control.

PR #627 remains legacy containment / rollback evidence only.

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

## Core client rules

1. No import of v2 client-state modules.
2. No periodic business polling.
3. No periodic auth polling.
4. Doorbell is invalidation only, never truth.
5. Reconnect uses bounded single-flight catch-up.
6. Cloud/server-derived state is not a second authority.
7. UI state is local-only.
8. MFP Pad and Mobile share the same business/security/sync contracts.
9. SMM authority/state/head/session paths may not be reintroduced.
10. Browser/public surface never becomes a second transaction engine.

## P0 sync lock

Canonical identities:
- HeadSeq = server Store Port head
- AppliedSeq = client last fully atomically applied sequence

Connected != Applied.
Doorbell received != Applied.

Warm path:
AppliedSeq == HeadSeq
→ READY
→ no delta/checkpoint pull
→ no periodic business polling

Short catch-up:
HEAD
→ missing delta only
→ verify/stage
→ atomic apply
→ AppliedSeq last
→ ACK

Long-offline/new client:
HEAD
→ checkpoint
→ verify/install
→ short tail
→ atomic apply
→ AppliedSeq
→ ACK

Failure:
keep previous LKG
AppliedSeq unchanged
no fake READY

## Stage model

A0 — Foundation — SOURCE_VERIFIED
A1 — Store Kernel Seam — SOURCE_VERIFIED
A2 — Device + Staff Security — SOURCE_VERIFIED
A3 — Sync + Offline — CURRENT
A4 — Ordering Surfaces
A5 — Checkout + Money
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## Current execution

Stage:
A3 — Sync + Offline

Branch:
`feat/MFP-V3-A3-SYNC-OFFLINE-2026-10-02`

Parent exact SHA:
`7d895e0eae3ba7678e4d23416b453912559887ad`

A2 production binding:
BLOCKED separately.
It does not block source-level A3 implementation.

A3 completion target:
SOURCE_VERIFIED

No merge / deploy / OTA / public cutover authority.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_A3_CURRENT_2026_10_02`
