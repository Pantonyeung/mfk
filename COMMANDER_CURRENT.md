# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner stage authorization

Owner explicitly accepted A8 at exact SHA:
`83adb14c21170bc3a34a0022c62b1a2bea2f68c4`

Owner explicitly authorizes advancement to:
A9 — Public + Diagnostics + Physical Acceptance + Cutover

Current Stage:
A9

Important:
A9 is gated. A9 SOURCE implementation does NOT itself authorize deploy, OTA activation, public cutover, promotion or SMM decommission.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
3. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
4. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
5. `docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`
6. `HANDOFF_CURRENT.md`
7. `docs/handoff/MFP_V3_A9_PUBLIC_DIAGNOSTICS_PHYSICAL_CUTOVER_CODEX_HANDOFF_2026-10-02.md`
8. current A9 Draft PR / Issue
9. parent PR #647 / exact parent SHA
10. Builder A9 PR #174 / Issue #175
11. Android Carrier runtime/update/recovery source
12. current V3 A0–A8 source

Conflict:
`GOVERNANCE_DRIFT`

## 2. Product structure

MFP:
- MFP Pad
- MFP Mobile

SMM:
- cancelled as final product identity
- no new SMM authority/state/head/session
- remains legacy compatibility/rollback evidence until explicit final decommission gate

## 3. Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — SOURCE_VERIFIED / OWNER ACCEPTED
A7 — SOURCE_VERIFIED / OWNER ACCEPTED
A8 — SOURCE_VERIFIED / OWNER ACCEPTED
A9 — CURRENT

## 4. A9 sub-gates

A9-S — Source / Production Binding
Target: SOURCE_VERIFIED

A9-B — Builder V3 Runtime Packaging
Target: SOURCE_VERIFIED

A9-C — Candidate Publish
Requires explicit Owner/Commander authorization

A9-P — Physical Acceptance
Requires published candidate + real device

A9-X — Cutover / Promote / SMM Decommission
Requires explicit Owner authorization after physical verification

No automatic progression.

## 5. Current Builder blocker

Fresh Builder audit:

Repository:
`Pantonyeung/morefunos-v1-builder`

Builder main:
`fe2692ac8e979e7d9e1d211758b9f9dfa9846190`

Current `mfk-runtime-ota.yml` still builds:
`source/v2local`

Current publish request still points to:
`9e713380f860bc33cf4b859e5b51451d1abf9df3`

Therefore current Builder cannot publish MFP V3 safely as-is.

Builder A9 lane:
- branch `feat/MFP-V3-A9-BUILDER-RUNTIME-OTA-2026-10-02`
- Draft PR #174
- Issue #175
- opening head `4ab3820382a34f4d46306eb329d31090aa8ffa4c`

Do NOT edit Builder publish request until V3 migration is SOURCE_VERIFIED and Owner explicitly authorizes candidate publish.

## 6. A9 first RED

Exact production identity is mandatory.

If expected MFK source SHA, runtime releaseId, build identity, Carrier current runtime or critical production adapter binding cannot be proved:
- BLOCKED
- no promotion
- no PHYSICAL_VERIFIED
- no cutover
- no SMM decommission

P0:
`NO EXACT IDENTITY = NO CUTOVER`

## 7. Production binding audit

A9 must audit all A1–A8 fail-closed placeholders.

Critical formal router rule:
Current V3 high-level `mfp.store-kernel.command.v1` must not be translated into low-level aggregate mutations by React/browser business logic.

If no existing formal production business-command router exists:
`BLOCKED — FORMAL_COMMAND_ROUTER_BINDING_MISSING`

Do not rebuild Order/Pricing/Payment authority in client.

## 8. Visual lock

A9 diagnostics / Check Center extends:
`MFP_PAD_ORDERING_VISUAL_LOCK_R1`

Technical detail belongs under More / Tools, not high-frequency Ordering UI.

## 9. Change control

Mode:
PREPARE

Authorized now:
- A9 source/binding scaffolding
- diagnostics
- build identity
- runtime.ready compatibility
- tests/CI
- physical acceptance runbook
- Builder source migration PR #174

Not authorized now:
- Builder publish request
- Runtime candidate publish
- deploy
- OTA activation
- public domain cutover
- SMM decommission

First-pass completion:
`SOURCE_VERIFIED`

## 10. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A9_CURRENT_EXECUTION_CONTROL_2026_10_02`
