# MFP V3｜Codex Implementation Handoff｜A1 Store Kernel Seam｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A1-STORE-KERNEL-2026-10-02`

Parent foundation:
- PR #632 — V3 SMT R1｜Fresh POS Client Foundation｜2026-10-02
- Parent head: `49135247900ec7cd1d63018e6fbfb8290fe734b5`

Controlling product plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling V3 authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

## 0. Owner lock

External product name:
`MoreFun POS`

Short name:
`MFP`

Final surfaces:
- MFP Pad
- MFP Mobile

SMM product identity is cancelled.
MFP Mobile absorbs valid SMM handheld UX/workflows.
SMM remains only as `LEGACY_SMM` transitional compatibility until MFP Mobile is physically verified and zero legacy dependency is proven.

Do not create:
- second Order Authority
- second Pricing Authority
- second Payment/Tender Authority
- second Fulfillment Authority
- second Print Authority
- second Store Kernel
- second Cloud Order Engine
- SMM_INTENT_STORE
- SMM HeadSeq
- new SMM canonical state

Internal legacy `SMT` identifiers may remain temporarily in Store Kernel / sync contracts.
Do not mass-rename protocol identifiers during A1.

## 1. First action

Fresh-read:
1. PR #632
2. current parent branch head
3. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
4. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
5. `v3smt/` A0 foundation
6. v2local Store Kernel / submission / readback contracts only as authority donors
7. existing idempotency / UNKNOWN / revision contracts
8. existing tests proving Formal Transaction Authority

Do not copy v2 client-state modules.

If parent branch moved after this handoff:
integrate parent safely before implementation.
If conflict affects runtime authority:
STOP and report.

## 2. A1 objective

Implement one bounded Store Kernel transport/readback seam for MFP V3.

Target flow:

MFP Pad / MFP Mobile
→ MFP Store Kernel Port
→ Formal Command
→ Store Kernel
→ Commit / Reject / Unknown
→ Canonical Readback

The client may submit intent.
The client may not become transaction truth.

## 3. Required A1 contracts

Create/complete a fresh MFP transport layer under `v3smt/` (or rename source root to `v3mfp/` before substantial A1 code if the rename is bounded and tests remain green).

Minimum contracts:

### 3.1 Command envelope

Required fields:
- schema
- storeId
- deviceId
- staffSessionRef or staff identity placeholder compatible with A2
- submissionId
- idempotencyKey
- commandType
- baseRevision / expectedRevision where applicable
- payload
- createdAt

No random retry identity.
Retry of same business action must reuse submission/idempotency identity.

### 3.2 Command result

Required dispositions:
- COMMITTED
- REJECTED
- UNKNOWN

Required readback identity:
- submissionId
- commitId when committed
- canonical revision / order ref where available
- stable rejection code
- readback-required signal for UNKNOWN

### 3.3 Readback

Implement:
`readSubmission(submissionId)`

Rules:
- timeout ≠ failure
- network error after submit ≠ retry as new action
- UNKNOWN → readback-first
- readback COMMITTED → stop retry
- readback REJECTED → surface stable reason
- only retry transport with same idempotency identity when contract permits

## 4. Store Kernel authority reuse

Reuse existing proven authority semantics from repository contracts / v2local Store Kernel source.

Do not rebuild:
- order identity generation semantics
- pricing calculation engine
- payment engine
- print engine
- fulfillment engine
- formal persistence rules

A1 is transport + contract + readback only.

## 5. State rules

TanStack Query:
- server/readback state only
- no periodic business polling
- no `refetchInterval` > 0
- focus must not fan out into unrelated business requests

Zustand:
- UI / draft only

Dexie:
- only durable transport/outbox metadata required for safe retry/recovery
- never persist a second copy of canonical order/pricing truth as client authority

## 6. MFP Pad + Mobile

A1 must expose one shared business port used by both surfaces.

Allowed difference:
- UI layout
- interaction pattern

Forbidden difference:
- command semantics
- pricing semantics
- idempotency
- readback
- authority

## 7. Network behavior lock

Idle:
- 0 periodic business requests

One explicit command:
- bounded number of Store Kernel requests
- no Customer/Keeta/sellability/config/projection fan-out unless the command contract explicitly requires it

Reconnect:
- no automatic business mutation replay without durable identity + readback

## 8. Required tests

At minimum:

1. A1 port compiles with no v2 client-state imports.
2. Same submission sent twice → same business effect / idempotent result.
3. Same submissionId with materially changed payload → rejected.
4. Transport timeout → UNKNOWN.
5. UNKNOWN → readSubmission before any new submit.
6. Readback COMMITTED returns original commit identity.
7. Readback REJECTED returns stable rejection code.
8. Retry reuses same idempotencyKey.
9. No `setInterval` business polling.
10. No unrelated domain requests from command submission.
11. MFP Pad and MFP Mobile import the same Store Kernel port.
12. Client cannot directly manufacture COMMITTED state.
13. Client cannot mutate pricing truth.
14. No SMM_INTENT_STORE.
15. No SMM HeadSeq.
16. No mfk-smm-web dependency.

## 9. CI

Extend dedicated V3 MFP/SMT CI only as required for A1.

Required:
- install
- tests
- typecheck
- build
- authority guard

Do not add production deploy in A1.

## 10. Completion status

Only use:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

A1 completion = SOURCE_VERIFIED only.

A1 is NOT:
- production deploy
- OTA cutover
- public MFP
- physical acceptance
- SMM decommission

## 11. A1 completion report

Return exactly:

1. What A1 implemented
2. Source root used: v3smt or v3mfp
3. Store Kernel authority boundary
4. Command envelope contract
5. Idempotency contract
6. UNKNOWN/readback contract
7. Durable outbox/transport behavior
8. Pad/Mobile shared-port proof
9. No-v2-state-import proof
10. No-SMM-authority proof
11. Changed files
12. Exact SHA
13. Tests
14. CI
15. Remaining blockers
16. Next exact action for A2

MILESTONE:
`MFP_V3_A1_STORE_KERNEL_SEAM_2026_10_02`
