# MFK CURRENT HANDOFF｜2026-09-22

Mandatory entry:
`COMMANDER_CURRENT.md`

Current navigation:
`docs/navigation/MFK_航海圖_V1.14_Round015_2026-09-22.txt`

Control:
#22

Commander protocol:
#39

## CURRENT PRIORITY

SMT OTA 814-baseline persistence P0 remains above Admin A2.

Active issue:
#40

## OWNER TARGET

Desired SMT product/runtime baseline:
`runtime-candidate-mfk-814043c809bb`

Exact source baseline:
`814043c809bbc236df1383c320bad906bcd3f1cd`

Current installed physical runtime `55fea...` only proved reboot persistence; it is not the desired product baseline.

## ISOLATED REPAIR SOURCE

Branch:
`work/MFK/SMT-OTA-814-BASELINE-PERSISTENCE-R2`

Candidate source:
`d133043dfe7d84e3f4be11ee49e9102c64f518d1`

Exact compare to 814:
- behind = 0
- changed product/runtime files = 4 only
- App diff only mounts RuntimeReadyActivation
- zero unrelated product drift

Source verification:
`35681551414` SUCCESS

## PUBLISHED OTA

Release:
`runtime-candidate-mfk-d133043dfe7d`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-d133043dfe7d.mfos`

SHA-256:
`89898b8420b2038cbde0863de21513b9c765c7e2635d2ca244a4a7f7eb1e7111`

Builder run:
`35681723140` SUCCESS

Public manifest + bundle hash + Carrier 106 + Bridge 1:
GREEN

## EXACT NEXT

Owner real-device acceptance only:

1. Recovery → 檢查 Runtime OTA
2. offered release must be `runtime-candidate-mfk-d133043dfe7d`
3. install / activate
4. verify UI/function matches intended 814 baseline
5. Recovery: Current = d133..., Candidate cleared, Activation Requested false
6. close/reopen app → same Current
7. full power off/on → same Current
8. Previous remains rollback target

Only then BANK:
`MFK_SMT_OTA_814_BASELINE_PERSISTENCE_GREEN`

## IMPORTANT

Do NOT merge/rebase the isolated 814 source branch into current MFK main.
It exists only to produce the no-drift repaired OTA candidate.

## PAUSED / NOT AUTHORIZED

Admin A2 remains PAUSED.
A3 remains NOT AUTHORIZED.
No OTA infrastructure migration.
No Keeta live wiring.
No SMM/Customer/Owner live seams.
