# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Control: MFP V3 A0–A9
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner supersession lock

Owner explicitly supersedes PR #627 / Unified Surfaces R1 as the CURRENT EXECUTION CONTROL for the MFP V3 rebuild program.

PR #627 is no longer the active implementation lane for MoreFun POS V3.

PR #627 / legacy v2 surfaces remain only for:
- rollback
- security-critical containment
- production-blocker emergency fixes
- transitional legacy readback until MFP cutover gates are satisfied

This supersession is bounded to the MFP V3 A0–A9 program.
It does not authorize broad changes to Customer, Keeta, Store Kernel, Pricing, Payment, Fulfillment, Print, Builder or OTA authorities.

If live `main` still contains the older #627 entrypoint while working on an explicitly declared MFP V3 execution branch, that stale main entrypoint is historical governance lag, not a reason to reopen #627.
The current branch-local Commander/Handoff plus the Owner-directed MFP plan are the controlling execution evidence for the declared MFP V3 branch until governance landing completes.

## 1. Controlling documents

Read in this order:

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
3. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
4. `docs/control/MFK_CHANGE_CONTROL.md`
5. `HANDOFF_CURRENT.md`
6. current Stage handoff
7. current Stage PR
8. parent Stage PR / exact parent SHA
9. live repository evidence relevant to the task

If these CURRENT branch documents conflict with verified live source/runtime evidence:
`GOVERNANCE_DRIFT`

Do not guess.

## 2. Product structure

External product:

MORE FUN POS
- MFP Pad
- MFP Mobile

Admin remains:
- Admin Desktop
- Admin Mobile

SMM:
- cancelled as a final product identity
- legacy compatibility / UX donor only
- no new SMM authority/state/head/session engine

SMT:
- not a user-facing product name for the new system
- may remain temporarily as an internal Store Kernel / sync port identifier
- do not mass-rename protocol identifiers during active rebuild stages

## 3. Current Stage

Current Stage:
A2 — Device + Staff Security

Execution PR:
#635 — MFP V3 A2｜Device + Staff Security｜2026-10-02

Execution branch:
`feat/MFP-V3-A2-DEVICE-STAFF-SECURITY-2026-10-02`

A2 handoff:
`docs/handoff/MFP_V3_A2_DEVICE_STAFF_SECURITY_CODEX_HANDOFF_2026-10-02.md`

Parent:
#633 — MFP V3 A1｜Store Kernel Seam｜2026-10-02

Parent exact SHA:
`256e130ae4f7292beadbcbbe847433c769066a7e`

A1 status:
`SOURCE_VERIFIED`

## 4. MFP V3 Stage Model

A0 — Foundation — SOURCE_VERIFIED
A1 — Store Kernel Seam — SOURCE_VERIFIED
A2 — Device + Staff Security — CURRENT
A3 — Sync + Offline
A4 — Ordering Surfaces
A5 — Checkout + Money
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

No later Stage begins automatically.

## 5. Frozen authorities

Do NOT rebuild or duplicate:
- Store Kernel / Formal Transaction Authority
- Order Authority
- Pricing Authority
- Payment / Tender Authority
- Fulfillment Authority
- Print Router / Durable PrintJob Authority
- Admin canonical configuration authority
- P0 sync contracts
- Customer / Keeta external authority contracts

MFP Pad and MFP Mobile are surfaces over the same authorities.

## 6. A2 authority lock

A2 builds one shared security seam:

Device Identity
→ Device Authorization
→ Staff Authentication
→ Opaque Staff Session
→ Action-time Permission
→ Store Kernel Admission
→ Session Readback / Revocation

A2 must NOT create:
- independent Pad auth
- independent Mobile auth
- SMM session authority
- browser PIN verifier authority
- second staff/permission truth
- second device registry
- anonymous business mutation capability

First RED:
expired / revoked `staffSessionRef` must fail closed before Store Kernel submit.

## 7. UI strategy

A1–A3:
- architecture/core seams
- minimal visible verification UI only

A4–A6:
- formal product UI in parallel with business capability

A7–A9:
- hardware/external/public/physical hardening and final UI polish

A2 may implement only the minimum security verification harness required by its handoff.

## 8. Network / security locks

- 0 periodic business polling
- 0 periodic auth polling
- no UI focus fan-out
- no client-manufactured authenticated session
- no PIN persistence
- no PIN/hash/verifier in public/browser state
- no session token in URL
- no SMM session dependency
- Store Kernel performs formal command admission

## 9. Change-control mode

Current A2 mode:
PREPARE

Authorized:
- bounded source changes on declared A2 branch
- tests
- CI
- Draft PR updates
- source evidence

Not authorized:
- merge to main
- production deploy
- OTA
- public cutover
- SMM decommission

A2 completion target:
`SOURCE_VERIFIED`

## 10. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

## 11. First action

Fresh-read the A2 handoff and current A1 source.

Write the first RED:
expired / revoked `staffSessionRef` must fail closed before Store Kernel submit.

Then implement only A2.

MILESTONE:
`MFP_V3_A2_CURRENT_EXECUTION_CONTROL_2026_10_02`
