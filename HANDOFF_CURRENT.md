# MFK CURRENT HANDOFF｜2026-09-22

Mandatory entry:
`COMMANDER_CURRENT.md`

Current navigation:
`docs/navigation/MFK_航海圖_V1.13_Round014_2026-09-22.txt`

Control:
#22

Commander protocol:
#39

## CURRENT PRIORITY

SMT OTA baseline-lock persistence P0 remains above Admin A2.

Active issue:
#40

## OWNER TARGET

Owner explicitly locks the desired SMT runtime/product baseline to:

`runtime-candidate-mfk-814043c809bb`

Source:
`814043c809bbc236df1383c320bad906bcd3f1cd`

Current stable physical runtime:
`runtime-candidate-55fea91e128a`

This current runtime survives reboot and proves Carrier persistence can work, but it is not the desired product baseline.

## CORRECTION

Previous candidate:
`runtime-candidate-mfk-2fd6e10cc7c8`

must not be treated as a minimal repair of 814.

GitHub compare:
- status = diverged
- ahead = 63
- behind = 10
- merge base = `3725ead94a2bf31469f054c955d1b46503e15481`

So the correct target is:

`814 BASELINE + MINIMAL runtime.ready FIX`

with zero unrelated product drift.

The repaired artifact must use a new release ID. Reusing 814 release identity with changed bytes is forbidden.

## EXACT NEXT

Prepare one isolated candidate from exact base `814043...` with only the runtime.ready persistence seam.

Before publish:
- verify exact base
- verify allowlist-only SMT delta
- tests/build GREEN
- prove semantic/product equivalence to 814 except persistence seam

Then publish and perform real-device:
- visual/function baseline match
- Current promotion
- app restart persistence
- full power-cycle persistence

## PAUSED / NOT AUTHORIZED

Admin A2 remains PAUSED.
A3 remains NOT AUTHORIZED.
No OTA infrastructure migration.
No Keeta live wiring.
No SMM/Customer/Owner live seams.
