# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner stage authorization

Owner explicitly accepted A6 at exact SHA:
`881afbd5fd463b4833e3b5980123fe33679bb260`

Owner explicitly authorizes advancement to:
A7 — Print + Hardware + Recovery

Current Stage:
A7 — Print + Hardware + Recovery

PR #627 remains legacy v2 rollback / security-critical containment / production-blocker evidence only.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
3. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
4. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
5. `docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`
6. `docs/control/MFK_CHANGE_CONTROL.md`
7. `HANDOFF_CURRENT.md`
8. `docs/handoff/MFP_V3_A7_PRINT_HARDWARE_RECOVERY_CODEX_HANDOFF_2026-10-02.md`
9. current A7 Draft PR / Issue
10. parent PR #643 / exact parent SHA
11. existing Carrier Print Gateway / Print evidence source

If source/runtime/authority conflicts:
`GOVERNANCE_DRIFT`

## 2. Product structure

MFP:
- MFP Pad
- MFP Mobile

SMM:
- cancelled as final product identity
- no new SMM authority/state/head/session

SMT:
- may remain as internal legacy Store Kernel / Carrier identifier only

## 3. Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — SOURCE_VERIFIED / OWNER ACCEPTED
A7 — CURRENT
A8 — Customer + Keeta + External
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## 4. A7 authority lock

Do NOT rebuild:
- Print Router
- Durable PrintJob authority
- Store Kernel
- Order/Pricing/Payment/Fulfillment
- Carrier native print gateway

A7 connects MFP source/UI to:
- canonical PrintJob/readback
- existing Carrier durable gateway
- local physical printer bindings
- hardware/recovery evidence

## 5. P0 print rule

`UNKNOWN PRINT OUTCOME != SAFE TO RETRY`

If a physical dispatch was already in progress and process/device restarts before definitive evidence:
- preserve canonical job identity
- mark/retain UNKNOWN / AMBIGUOUS_AFTER_SEND
- do not auto-reprint
- require explicit human reprint decision

No blind duplicate physical output.

## 6. Owner print responsibility lock

Admin:
- Product printing rules
- logical destinations
- template authoring/publish

MFP local:
- physical printer/IP
- local binding
- published template selection where allowed
- actual hardware dispatch

MFP must not create a second Product → Printer routing authority.

## 7. Visual lock

A7 Pad UI extends:
`MFP_PAD_ORDERING_VISUAL_LOCK_R1`

No new visual system.

Print/Hardware surfaces live under More/Tools using:
- blue visual language
- high-density cards
- stable action geometry
- explicit attention states

## 8. Change control

Mode:
`PREPARE`

Authorized:
- A7 bounded source
- tests
- CI
- Draft PR
- source evidence

Carrier source:
READ ONLY by default.

Not authorized:
- merge
- deploy
- OTA
- public cutover
- SMM decommission

Completion:
`SOURCE_VERIFIED`

## 9. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A7_CURRENT_EXECUTION_CONTROL_2026_10_02`
