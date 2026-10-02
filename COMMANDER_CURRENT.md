# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Supersession lock

For the MoreFun POS V3 A0–A9 rebuild program, the declared MFP Stage branch/PR supersedes PR #627 / Unified Surfaces R1 as CURRENT EXECUTION CONTROL.

PR #627 remains legacy v2 rollback / security-critical containment / production-blocker emergency evidence only.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
3. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
4. `docs/control/MFK_CHANGE_CONTROL.md`
5. `HANDOFF_CURRENT.md`
6. current Stage handoff
7. current Stage PR
8. parent Stage PR / exact parent SHA
9. verified repository evidence

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
- may remain as internal legacy Store Kernel / sync port identifier
- not the external product name

## 3. Current Stage

Current Stage:
A4 — Ordering Surfaces

Execution branch:
`feat/MFP-V3-A4-ORDERING-SURFACES-2026-10-02`

Current handoff:
`docs/handoff/MFP_V3_A4_ORDERING_SURFACES_CODEX_HANDOFF_2026-10-02.md`

Parent:
#637 — MFP V3 A3｜Sync + Offline｜2026-10-02

Parent exact SHA:
`adc2cc64573d9d5f7b357a7955ff2b0edc1fd509`

A3:
`SOURCE_VERIFIED`

Carried production blockers:
- A2 production Device/Staff authority binding = BLOCKED
- A3 production sync binding/physical offline acceptance = BLOCKED

These block deployment, not A4 source implementation.

## 4. Stage model

A0 — Foundation — SOURCE_VERIFIED
A1 — Store Kernel Seam — SOURCE_VERIFIED
A2 — Device + Staff Security — SOURCE_VERIFIED
A3 — Sync + Offline — SOURCE_VERIFIED
A4 — Ordering Surfaces — CURRENT / BLOCKED FOR OWNER CROSSWALK CLOSURE
A5 — Checkout + Money
A6 — Order Operations
A7 — Print + Hardware + Recovery
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## 5. A4 product lock

A4 is the first formal MFP product-UI stage.

Implement:
- MFP Pad ordering UI
- MFP Mobile ordering UI
- one shared ordering domain contract
- one shared normalized cart intent
- categories/products/options/combo/cart/service mode
- local price preview from published material facts
- read-only sellability display
- A3 active projection consumption

Hard rules:
- no second Pricing Authority
- no second Order Authority
- no second Sync Authority
- no formal order commit
- no payment/tender
- no print/fulfillment truth
- no SMM mobile engine
- no direct catalog polling/fetch in UI

## 6. First RED

Same active canonical projection + same user selections must produce the same normalized cart intent on MFP Pad and MFP Mobile.

Must prove:
- same product identity
- same service mode
- same options
- same combo choices
- same quantity
- same material facts
- no surface-specific pricing/order authority

## 7. A4 integration locks

A3:
- ordering reads active LKG/projection
- no new WebSocket
- no new sync coordinator
- no periodic business polling

A2:
- use existing security state/gate
- do not reimplement login

A1:
- no formal Store Kernel submit from ordering draft
- A5 owns formal checkout integration

## 8. UI strategy

A4 must build real functional product UI, not only a harness.

Pad:
- high-density, fast ordering workspace

Mobile:
- true touch-first mobile interaction
- not scaled-down Pad

Different presentation is allowed.
Different business semantics are not.

## 9. Owner crosswalk closure

Controlling crosswalk:
`docs/plan/MFP_V3_OWNER_REQUIREMENTS_CROSSWALK_2026-10-02.md`

Current A4 implementation slice at:
`5e4118c003bef84a5e0262d5ac925537c4686ff3`

is SOURCE_VERIFIED for its declared ordering-domain slice.

A4 stage closure is BLOCKED until:
- A4-C1 Display Settings
- A4-C2 Navigation + More shell
- A4-C3 75% major modal geometry
- A4-C4 exact Cart semantics
- A4-C5 Hold/Retrieve/Dining draft entry
- A4-C6 exact Fast Lane
- A4-C7 Owner UI acceptance baseline

are SOURCE_VERIFIED.

Do not start A5 before A4 closure.

## 10. Permission clarification

Owner FINAL product rule:
authorized MFP staff must not be given an invented Manager-only product gate for the Owner-listed MFP operations.

A2 permission plumbing remains mandatory.
Store Kernel/server admission remains mandatory.
Canonical permission policy must express the Owner product rule rather than silently narrowing it.

## 11. Change-control mode

Current mode:
PREPARE

Authorized:
- bounded A4 source
- real ordering UI
- tests
- CI
- Draft PR updates

Not authorized:
- merge
- deploy
- OTA
- public cutover
- SMM decommission
- backend authority widening

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
`MFP_V3_A4_CURRENT_EXECUTION_CONTROL_2026_10_02`
