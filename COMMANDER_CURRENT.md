# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 11:04 Asia/Hong_Kong
System: MFK ONLY
Takeover checkpoint: 2026-09-22 10:44 Asia/Hong_Kong｜fresh-read complete｜no material state change

> Every Commander MUST fresh-read this file before acting.
> Every Commander MUST update this file again before returning work / ending the conversation / hitting context limits.

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. Pantonyeung/mfk #22 latest controlling comment
3. Current navigation listed below
4. `HANDOFF_CURRENT.md`
5. Active issue(s)

## 1. Current navigation

`docs/navigation/MFK_航海圖_V1.14_Round015_2026-09-22.txt`

## 2. Current priority override

Owner priority is now:

`SMT OTA PERSISTENCE P0 BEFORE ADMIN A2 WALKTHROUGH`

Active issue:
`#40 P0｜SMT OTA Persistence｜runtime.ready Promotion Missing After MFK Migration`

Admin A1/A2 implementation remain BANKED.
Admin A2 real walkthrough is PAUSED, not cancelled.
A3 automatic Admin→SMT network transport remains NOT AUTHORIZED.

## 3. Owner target correction｜material state change

Owner clarified the intended SMT runtime baseline:

`runtime-candidate-mfk-814043c809bb`

Source:
`814043c809bbc236df1383c320bad906bcd3f1cd`

This is the product/runtime version the Owner wants to preserve.

Current real-device stable runtime:

`runtime-candidate-55fea91e128a`

Physical evidence:
- Current = `runtime-candidate-55fea91e128a`
- Candidate = `—`
- Activation Requested = `false`
- Cold Boot = `BOOT_COMPLETED`
- reboot persistence = GREEN

Interpretation:
`55fea...` proves Carrier persistence/durability behavior can work.
It is NOT the Owner-selected runtime baseline.

## 4. Previous Commander assumption corrected

The previous repair candidate:

`runtime-candidate-mfk-2fd6e10cc7c8`

MUST NOT be treated as "814 + runtime.ready only".

GitHub compare proves:

base:
`814043c809bbc236df1383c320bad906bcd3f1cd`

head:
`2fd6e10cc7c8bf73db854559243dc6c0c4fbe34f`

status:
`diverged`

ahead_by:
`63`

behind_by:
`10`

merge_base:
`3725ead94a2bf31469f054c955d1b46503e15481`

Therefore the prior published `2fd6...` candidate is a different lineage containing unrelated changes.
It is not the locked product baseline.

## 5. Correct problem statement

The P0 is now:

`OWNER_BASELINE_814 + PERSISTENCE_FIX WITHOUT PRODUCT DRIFT`

We must preserve the exact Owner-approved SMT product/runtime behavior from source `814043...`,
and add only the minimum Carrier promotion acknowledgement needed for persistence.

Do NOT reuse the same release ID after changing bytes/source.
A repaired build must have a NEW release ID.

The acceptance invariant is:

`814 PRODUCT BASELINE SEMANTICS + runtime.ready PERSISTENCE FIX`

not:

`releaseId must literally remain 814043c809bb`.

## 6. Exact implementation seam

WORK_ID:
`MFK-SMT-OTA-814-BASELINE-PERSISTENCE-R2`

Issue:
`#40`

Exact base:
`814043c809bbc236df1383c320bad906bcd3f1cd`

Allowed functional delta only:
- add runtime Carrier boundary parser / signal primitive
- add RuntimeReadyActivation mount
- add deterministic tests for exact releaseId + bridgeVersion 1
- minimal App mount change after React commit

No product/UI/workflow/config behavior change is authorized.

No Admin A2/A3 work in this seam.

## 6A. Isolated 814-baseline candidate published

Source branch:
`work/MFK/SMT-OTA-814-BASELINE-PERSISTENCE-R2`

Exact Owner baseline:
`814043c809bbc236df1383c320bad906bcd3f1cd`

Clean isolated source candidate:
`d133043dfe7d84e3f4be11ee49e9102c64f518d1`

Compare against exact 814 baseline:
- status = `ahead`
- behind = `0`
- changed product files = exactly 4
- `v2local/src/App.tsx` = only 3 additions / 2 deletions for mount wiring
- `RuntimeReadyActivation.tsx` = added
- `runtime-carrier-boundary.ts` = added
- `runtime-carrier-boundary.test.ts` = added
- zero other product/runtime file drift

Source verification run:
`35681551414`
SUCCESS

Builder / publisher:
`Pantonyeung/morefunos-v1-builder`

Publish request commit:
`c776e070b7938476e05b82633376ea6311eb4f41`

Publish run:
`35681723140`
SUCCESS

Published release:
`runtime-candidate-mfk-d133043dfe7d`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-d133043dfe7d.mfos`

Archive SHA-256:
`89898b8420b2038cbde0863de21513b9c765c7e2635d2ca244a4a7f7eb1e7111`

Public readback:
GREEN

Carrier contract:
- minCarrierVersionCode = 106
- bridgeVersion = 1

State:
`MFK_SMT_OTA_814_BASELINE_PERSISTENCE_CANDIDATE_PUBLISHED`

Important:
This is an isolated OTA source line from exact 814.
It is NOT a merge of old baseline back into current MFK main.
Do not merge/rebase this branch into current main as a product landing.



Prepare ONE isolated candidate from the exact `814043...` baseline with only the runtime.ready persistence delta.

Acceptance before device publish:
1. exact base identity = `814043...`
2. product/runtime files outside persistence allowlist unchanged
3. runtime.ready test GREEN
4. build GREEN
5. semantic diff proves no unrelated SMT product drift
6. publish new OTA release ID
7. Owner visually/functionally confirms it is the intended 814 baseline
8. Recovery proves Current promotion
9. app restart preserves same Current
10. full power cycle preserves same Current

Only then BANK:

`MFK_SMT_OTA_814_BASELINE_PERSISTENCE_GREEN`

## 9. DO NOT

Until #40 real-device proof is GREEN:

- NO Admin A2 continuation
- NO A3 automatic Admin→SMT network
- NO OTA infrastructure migration
- NO Pricing / Modifier / Combo seam
- NO SMM→SMT
- NO Customer→SMT
- NO Owner remote command
- NO Keeta live wiring

## 10. Permanent system rules

MFK only.
Exactly six roles.
One business authority per fact/action.

`CONNECT ONE PIECE → TEST SAME PIECE → BANK → STOP → OWNER DECIDES NEXT`

`NO TARGET READBACK = NOT GREEN`

MFK Cloud = EVENT-DRIVEN FIRST.

Cloud failure never blocks SMT local Order / Checkout / Payment / Commit.

## 11. Admin / domain state

Admin hosting is BANKED and GREEN:

`https://admin.morefunos.com`

H2 #37 CLOSED.
H3 #38 CLOSED.

## 12. Mandatory return

Before any Commander returns work:
- fresh-read main + #22
- update this file
- post same return to #22
- advance navigation if state changed
- leave one exact NEXT
- include explicit NOT_AUTHORIZED
- include no secrets
