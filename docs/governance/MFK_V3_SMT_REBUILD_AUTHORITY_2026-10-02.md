# MoreFun POS V3 Rebuild Authority｜2026-10-02

Legacy filename retained intentionally:
`MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Date: 2026-10-02
EffectiveAt: 2026-10-02 Asia/Hong_Kong
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
Valid handheld UX may be donated into MFP Mobile.
Legacy SMM remains transitional compatibility only until decommission gates pass.

SMT is no longer the user-facing target name.
Existing SMT identifiers may remain temporarily as internal Store Kernel / sync port identifiers.

## Supersession

For MFP V3 A0–A9 implementation, this authority supersedes PR #627 / Unified Surfaces R1 as current execution control.

PR #627 remains legacy containment / rollback evidence only.

This supersession does not authorize a rebuild of frozen transaction/domain authorities.

## Trigger

Legacy v2 physical acceptance exposed:
- deterministic periodic request storms;
- interaction-driven request fan-out;
- multiple generations of polling/lifecycle/sync-status coupling.

Owner direction:
- freeze broad v2local feature work;
- retain v2local only for rollback/security-critical containment;
- freeze v2smm feature work;
- rebuild the POS client as MFP V3.

## Frozen authorities

MFP V3 MUST NOT rebuild or duplicate:
- Store Kernel / Formal Transaction Authority
- Order Authority
- Pricing Authority
- Payment/Tender Authority
- Fulfillment Authority
- Print Router / Durable PrintJob Authority
- Idempotency / submission identity semantics
- Admin canonical backend authority
- P0 checkpointed-delta sync contracts
- Customer / Keeta external authority contracts

## Client rules

1. Fresh V3 client remains isolated from v2 client-state modules.
2. No periodic business polling.
3. No periodic auth polling.
4. Doorbell is invalidation only, never truth.
5. Reconnect performs bounded single-flight catch-up.
6. Cloud/server-derived state is not persisted as second truth.
7. UI state is local-only.
8. Durable transport/outbox metadata may exist only to preserve formal authority/idempotency.
9. MFP Pad and MFP Mobile share the same business and security contracts.
10. Browser/public surface never becomes a second transaction engine.
11. SMM authority/state/head/session paths may not be reintroduced.

## State model

- Server/readback state: TanStack Query
- UI/draft state: Zustand
- Bounded durable transport/device metadata: Dexie where required
- Formal business truth: Store Kernel / canonical backend

## Stage model

A0 — Foundation
A1 — Store Kernel Seam
A2 — Device + Staff Security
A3 — Sync + Offline
A4 — Ordering Surfaces
A5 — Checkout + Money
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

A0: SOURCE_VERIFIED
A1: SOURCE_VERIFIED
A2: CURRENT

## Network contract

Idle:
- 0 periodic business requests

Auth idle:
- 0 periodic auth requests

Event:
- explicit action or invalidation
- bounded query/command/readback only

Reconnect:
- one bounded single-flight catch-up

UI tap:
- local feedback first
- no unrelated Customer / Keeta / sellability / config / projection fan-out

## UI strategy

A1–A3:
- architecture/core seams
- minimal verification UI

A4–A6:
- formal MFP Pad + MFP Mobile UI in parallel with business capability

A7–A9:
- hardware/external/public/physical hardening and final UI polish

## Legacy transition

`v2local`:
- feature frozen
- rollback/security-critical/production-blocker fixes only

`v2smm`:
- feature frozen
- UX donor + legacy compatibility only

Do not delete legacy services until MFP physical acceptance and explicit Owner decommission authority.

## Current execution

Current Stage:
A2 — Device + Staff Security

PR:
#635

Branch:
`feat/MFP-V3-A2-DEVICE-STAFF-SECURITY-2026-10-02`

Parent:
#633

Parent exact SHA:
`256e130ae4f7292beadbcbbe847433c769066a7e`

Completion target:
`SOURCE_VERIFIED`

No deploy/merge/OTA/cutover is authorized by A2 preparation.

MILESTONE:
`MFP_V3_REBUILD_AUTHORITY_CURRENT_2026_10_02`
