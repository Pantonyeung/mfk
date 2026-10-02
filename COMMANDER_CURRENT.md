# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner stage authorization

Owner explicitly accepted A4 Owner Final Closure at exact SHA:
`b83321000668d39580a29e2e838aa585d5750fd5`

Owner explicitly authorizes advancement to:

A5 — Checkout + Money

For the MoreFun POS V3 A0–A9 rebuild program, the declared MFP Stage branch/PR supersedes PR #627 / Unified Surfaces R1 as CURRENT EXECUTION CONTROL.

PR #627 remains legacy v2 rollback / security-critical containment / production-blocker emergency evidence only.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
3. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
4. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
5. `docs/control/MFK_CHANGE_CONTROL.md`
6. `HANDOFF_CURRENT.md`
7. `docs/handoff/MFP_V3_A5_CHECKOUT_MONEY_CODEX_HANDOFF_2026-10-02.md`
8. current A5 Draft PR / Issue
9. parent PR #639 and exact accepted parent SHA
10. verified repository evidence

If current control conflicts with verified source/runtime evidence:
`GOVERNANCE_DRIFT`

## 2. Product structure

MFP
- MFP Pad
- MFP Mobile

SMM:
- cancelled as final product identity
- legacy compatibility / UX donor only
- no new authority/state/head/session/order engine

SMT:
- may remain temporarily as internal Store Kernel / sync port identifier
- not the external product name

## 3. Current Stage

Current Stage:
A5 — Checkout + Money

Execution branch:
`feat/MFP-V3-A5-CHECKOUT-MONEY-2026-10-02`

Current handoff:
`docs/handoff/MFP_V3_A5_CHECKOUT_MONEY_CODEX_HANDOFF_2026-10-02.md`

Parent:
#639 — MFP V3 A4｜Ordering Surfaces｜2026-10-02

Parent exact SHA:
`b83321000668d39580a29e2e838aa585d5750fd5`

A4:
`SOURCE_VERIFIED`
Owner accepted.

Carried production blockers:
- A2 production Device/Staff authority binding = BLOCKED
- production Store Kernel binding = BLOCKED
- A3 production sync binding / physical offline acceptance = BLOCKED

These block deploy/physical acceptance, not A5 source implementation.

## 4. Stage model

A0 — Foundation — SOURCE_VERIFIED
A1 — Store Kernel Seam — SOURCE_VERIFIED
A2 — Device + Staff Security — SOURCE_VERIFIED
A3 — Sync + Offline — SOURCE_VERIFIED
A4 — Ordering Surfaces — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — Checkout + Money — CURRENT
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## 5. A5 formal boundary lock

A5 first crosses from local ordering draft into formal transaction submission.

Required chain:

A4 Normalized Draft
→ Formal Price / Revision Validation
→ Final Review
→ explicit PAYMENT CONFIRM
→ Store Kernel formal command
→ COMMITTED / REJECTED / UNKNOWN
→ canonical readback

Hard rules:

- opening Checkout != formal transaction
- changing channel != formal transaction
- changing tender != formal transaction
- returning to Order != formal transaction
- Final Review != formal transaction
- only explicit Payment Confirm may submit
- client never manufactures COMMITTED / payment success / Order identity

## 6. First RED

Before implementation:

A4 normalized draft enters Checkout and receives formal validation.

Before Payment Confirm:
formal Store Kernel commit count MUST remain 0.

After one Payment Confirm:
exactly one formal submission may occur.

Double tap / retry:
same submissionId + idempotencyKey
→ no duplicate formal effect.

Stale formal price/revision:
→ REJECT before commit
→ no client shortcut.

## 7. Owner FINAL money locks

A5 must include:
- Pad + Mobile Checkout
- source/channel separate from tender
- Cash keypad $20/$50/$100/$200/$500/Exact
- Student Discount exact Owner rule
- 75% Final Review
- Payment Confirm = formal transaction boundary
- Business Day / opening cash
- Cash In / Cash Out ledger
- Day Close cash count
- retained cash / next opening
- Channel Summary
- Tender Summary
- ELECTRONIC_UNCLASSIFIED reporting
- immutable Daily Report money facts
- append-only later adjustment contract

## 8. Student Discount exact rule

Staff-confirmed Student Count = N.

Manual:
staff selects up to N eligible special drinks.

Auto:
system chooses up to N eligible special drinks,
most expensive first.

Equal-price tie:
deterministic stable line identity.

Client emits discount intent only.
Formal Pricing Authority validates final amount.

## 9. Permission Owner alignment

Owner FINAL:
valid authenticated MFP login
→ eligible for FINAL-defined frontline/local MFP operations.

No Manager-only gate in this Owner version.

Preserve:
- device authorization
- formal staff session
- expiry/revocation
- Store Kernel admission

But A5 formal checkout must not be denied solely by a Manager-style granular permission assumption not present in Owner FINAL.

## 10. Offline/local lock

A5 source architecture must not require unrelated Cloud/Admin/Owner/Provider round trips for local Store Kernel checkout/money operations.

No periodic business/money polling.

Production offline readiness remains separately BLOCKED until physical binding/acceptance.

## 11. Change-control mode

Current mode:
PREPARE

Authorized:
- bounded A5 source
- tests
- CI
- Draft PR
- source evidence

Not authorized:
- merge
- deploy
- OTA
- public cutover
- SMM decommission
- backend authority widening without explicit new authority

Completion target:
`SOURCE_VERIFIED`

## 12. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A5_CURRENT_EXECUTION_CONTROL_2026_10_02`
