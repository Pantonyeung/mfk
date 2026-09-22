# MFK CURRENT HANDOFF｜2026-09-22

Mandatory entry:
`COMMANDER_CURRENT.md`

Current navigation:
`docs/navigation/MFK_航海圖_V1.12_Round013_2026-09-22.txt`

Control:
#22

Commander protocol:
#39

## CURRENT PRIORITY

SMT OTA persistence P0 has Owner priority over Admin A2 real walkthrough.

Active issue:
#40

## ROOT CAUSE

The failing candidate `runtime-candidate-mfk-814043c809bb` came from MFK commit `814043c809bbc236df1383c320bad906bcd3f1cd`, which did not contain the native Carrier `runtime.ready` promotion acknowledgement.

Carrier 1.0.6 intentionally treats a candidate boot as provisional until exact `runtime.ready` is received. If the process restarts before confirmation, it falls back to the persisted old Current.

## FIX

Current MFK clean landing:
`2fd6e10cc7c8bf73db854559243dc6c0c4fbe34f`

Landing run:
`35679476262` SUCCESS

Fixed runtime source now emits exact `runtime.ready` after app mount.

## PUBLISHED CANDIDATE

Release:
`runtime-candidate-mfk-2fd6e10cc7c8`

Publisher run:
`35679889303` SUCCESS

Public manifest / bundle hash:
GREEN

## NEXT

Real device acceptance only:

1. install/activate `runtime-candidate-mfk-2fd6e10cc7c8`
2. Recovery must show new Current + Candidate cleared
3. close/reopen app → same Current
4. full power off/on → same Current
5. Previous remains rollback target

Only then BANK:
`MFK_SMT_OTA_PERSISTENCE_RUNTIME_READY_GREEN`

## PAUSED

Admin A2 real cross-device walkthrough is paused until #40 is physically GREEN.

A3 remains NOT AUTHORIZED.

## ADMIN HOSTING

Canonical Admin is already live and BANKED:
`https://admin.morefunos.com`

## DO NOT

No OTA infra migration.
No Keeta live wiring.
No SMM/Customer/Owner live seams.
No next Admin seam until P0 proof.
