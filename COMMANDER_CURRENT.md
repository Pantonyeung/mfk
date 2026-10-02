# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner stage authorization

Owner explicitly accepted A5 at exact SHA:
`830fd2f033f2246c1a4f30da71a0a8f9160da751`

Owner direction:
- Pass A5 now.
- UI visual refinement is deferred to a later stage.
- Advance to A6.

Current Stage:
A6 — Order Operations

PR #627 remains legacy v2 rollback / security-critical containment / production-blocker emergency evidence only.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
3. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
4. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
5. `docs/control/MFK_CHANGE_CONTROL.md`
6. `HANDOFF_CURRENT.md`
7. `docs/handoff/MFP_V3_A6_ORDER_OPERATIONS_CODEX_HANDOFF_2026-10-02.md`
8. current A6 Draft PR / Issue
9. parent PR #641 / exact parent SHA
10. verified repository evidence

Conflict:
`GOVERNANCE_DRIFT`

## 2. Product

MFP
- MFP Pad
- MFP Mobile

SMM:
cancelled as final product identity.
No new SMM order/state/head/session authority.

## 3. Current Stage

A6 — Order Operations

Execution branch:
`feat/MFP-V3-A6-ORDER-OPERATIONS-2026-10-02`

Parent:
#641 — MFP V3 A5｜Checkout + Money｜2026-10-02

Parent exact SHA:
`830fd2f033f2246c1a4f30da71a0a8f9160da751`

A5:
`SOURCE_VERIFIED / OWNER ACCEPTED`

A5 visual polish:
DEFERRED BY OWNER
Not an A6 blocker.

## 4. Stage model

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — CURRENT
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## 5. A6 lock

A6 scope:
- canonical Orders read model
- Orders page
- fulfillment
- ETA
- formal modification
- payment correction/refund operational entry
- cancellation
- Dining
- waiting/table transfer
- split checkout orchestration into A5
- sold-out/restore
- capacity pool
- channel thresholds
- bounded override
- More/Tools shell

Do not rebuild:
- Store Kernel
- Order Authority
- Pricing
- Payment
- Print
- Availability/Capacity authority
- Customer/Keeta provider engine

## 6. First RED

Given canonical formal Order O1:

IN_PROGRESS
→ READY
→ IN_PROGRESS

must preserve:
- same orderId O1
- same Formal Order authority
- no second Order
- expected revision
- stable operation identity
- stale fail-closed
- UNKNOWN readback-first

## 7. Change control

Mode:
PREPARE

No:
- merge
- deploy
- OTA
- public cutover
- SMM decommission

Completion:
`SOURCE_VERIFIED`

## 8. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A6_CURRENT_EXECUTION_CONTROL_2026_10_02`
