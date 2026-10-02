# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner supersession lock

For the MoreFun POS V3 A0–A9 rebuild program, the declared MFP Stage branch/PR supersedes PR #627 / Unified Surfaces R1 as CURRENT EXECUTION CONTROL.

PR #627 remains legacy v2 rollback / security-critical containment / production-blocker emergency evidence only.

For the current Stage, branch-local current Commander/Handoff plus the Owner-directed MFP plan control execution until governance landing completes.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
3. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
4. `docs/control/MFK_CHANGE_CONTROL.md`
5. `HANDOFF_CURRENT.md`
6. current Stage handoff
7. current Stage PR
8. parent Stage PR / exact parent SHA
9. live repository evidence

Conflict with verified source/runtime evidence:
`GOVERNANCE_DRIFT`

## 2. Product structure

MFP
- MFP Pad
- MFP Mobile

SMM:
- cancelled as final product identity
- compatibility/UX donor only
- no new authority/state/head/session engine

SMT:
- internal legacy Store Kernel / sync port identifier may remain temporarily
- not the user-facing target product name

## 3. Current Stage

Current Stage:
A3 — Sync + Offline

Execution branch:
`feat/MFP-V3-A3-SYNC-OFFLINE-2026-10-02`

Current Stage handoff:
`docs/handoff/MFP_V3_A3_SYNC_OFFLINE_CODEX_HANDOFF_2026-10-02.md`

Parent:
#635 — MFP V3 A2｜Device + Staff Security｜2026-10-02

Parent exact SHA:
`7d895e0eae3ba7678e4d23416b453912559887ad`

A2 source status:
`SOURCE_VERIFIED`

A2 production binding:
`BLOCKED`
Formal production device/staff authority + Store Kernel admission binding remain unavailable.
This blocks production binding/deploy, not A3 source implementation.

## 4. Stage model

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

## 5. A3 authority lock

A3 implements one shared event-driven sync client for MFP Pad + MFP Mobile.

Preserve:
- Admin canonical configuration authority
- Store Kernel formal transaction authority
- P0 HeadSeq / AppliedSeq / Delta / Checkpoint semantics

Hard rules:
- Connected != Applied
- Doorbell != Truth
- AppliedSeq advances only after atomic local apply succeeds
- idle = 0 periodic business polling
- missed doorbell recovered by reconnect HEAD catch-up
- checkpoint is recovery object, not routine delivery
- MFP Pad/Mobile do not create separate canonical heads

## 6. First RED

Reconnect must coalesce concurrent:
- WebSocket open
- initial doorbell
- online transition
- resume/foreground trigger if retained

into exactly one bounded single-flight catch-up chain for the current observed head.

No duplicate parallel HEAD/delta/checkpoint pulls.
No periodic polling.
No infinite trailing re-request loop.

## 7. Frozen authorities

Do not rebuild or duplicate:
- Store Kernel
- Order
- Pricing
- Payment/Tender
- Fulfillment
- Print
- Admin canonical backend
- Customer/Keeta engines
- Staff/Device authority from A2

## 8. UI strategy

A3 may add only minimal sync/offline verification UI:
- connection state
- HeadSeq
- AppliedSeq
- READY/BEHIND/RECOVERING/OFFLINE
- LKG status
- last apply time

Final product UI begins at A4.

## 9. Change-control mode

Current mode:
PREPARE

Authorized:
- bounded A3 source
- tests
- CI
- Draft PR updates
- source evidence

Not authorized:
- merge
- deploy
- OTA
- public cutover
- SMM decommission
- production backend widening without explicit new authority

A3 completion target:
`SOURCE_VERIFIED`

## 10. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A3_CURRENT_EXECUTION_CONTROL_2026_10_02`
