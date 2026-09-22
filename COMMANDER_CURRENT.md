# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 10:44 Asia/Hong_Kong
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

`docs/navigation/MFK_航海圖_V1.12_Round013_2026-09-22.txt`

## 2. Current priority override

Owner priority is now:

`SMT OTA PERSISTENCE P0 BEFORE ADMIN A2 WALKTHROUGH`

Active issue:
`#40 P0｜SMT OTA Persistence｜runtime.ready Promotion Missing After MFK Migration`

Admin A1/A2 implementation remain BANKED.
Admin A2 real walkthrough is PAUSED, not cancelled.
A3 automatic Admin→SMT network transport remains NOT AUTHORIZED.

## 3. Physical failure

Carrier:
`1.0.6 (106)`

Observed:
- OTA can download / activate
- new Runtime runs immediately
- app process restart falls back to old Runtime
- full power-cycle falls back to old Runtime

## 4. Root cause

Failing OTA:
`runtime-candidate-mfk-814043c809bb`

Source:
`814043c809bbc236df1383c320bad906bcd3f1cd`

That source did not contain the Carrier promotion acknowledgement:
`runtime.ready`.

Carrier 1.0.6 activation is intentionally two-phase:
candidate boots provisionally and is not persisted as Current until exact `runtime.ready` with bridgeVersion 1 + exact releaseId arrives.

Without it, the next process start deliberately rejects the unconfirmed candidate and falls back.

## 5. Source repair

WORK_ID:
`MFK-SMT-OTA-PERSISTENCE-RUNTIME-READY-R1`

Issue:
`#40`

Source candidate:
`c7397b77430e145d0b0f8bb6ba34115754263f6f`

Source run:
`35679373673` SUCCESS

Clean landing:
`2fd6e10cc7c8bf73db854559243dc6c0c4fbe34f`

Landing run:
`35679476262` SUCCESS

Files:
- `v2local/src/runtime/runtime-carrier-boundary.ts`
- `v2local/src/runtime/RuntimeReadyActivation.tsx`
- `v2local/src/runtime/runtime-carrier-boundary.test.ts`
- `v2local/src/App.tsx`

State:
`MFK_SMT_OTA_PERSISTENCE_RUNTIME_READY_SOURCE_GREEN`

## 6. Published fixed candidate

Existing OTA compatibility publisher:
`Pantonyeung/morefunos-v1-builder`

Publish run:
`35679889303` SUCCESS

Release:
`runtime-candidate-mfk-2fd6e10cc7c8`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-2fd6e10cc7c8.mfos`

Public manifest + bundle hash readback:
GREEN.

This temporary compatibility publisher does not become MFK authority.

## 6A. Owner real-device evidence｜current screen

Owner screenshot now proves the Carrier itself has a persisted cold-boot-stable Current, but it is NOT the fixed #40 acceptance release.

Observed on device:
- Carrier = `1.0.6 (106)`
- Boot Runtime = `runtime-candidate-55fea91e128a`
- Current = `runtime-candidate-55fea91e128a`
- Candidate = `—`
- Previous = `runtime-candidate-842870976ec1`
- Activation Requested = `false`
- Cold Boot event = `BOOT_COMPLETED`
- visible OTA metadata block still shows releaseId = `runtime-candidate-mfk-814043c809bb`
- visible fixed target `runtime-candidate-mfk-2fd6e10cc7c8` is NOT yet read back on this device

Interpretation:
- `runtime-candidate-55fea91e128a` persistence across reboot is GREEN for that installed release.
- This does NOT close #40 because the repaired candidate `runtime-candidate-mfk-2fd6e10cc7c8` is not Current.
- The metadata block may be stale until `檢查 Runtime OTA` is pressed.
- Do NOT classify OTA MANIFEST / ENDPOINT as confirmed until a fresh OTA check still fails to offer `2fd6e10cc7c8`.

## 7. Exact NEXT

Owner performs ONE real device acceptance:

1. Recovery → press `檢查 Runtime OTA` once to force a fresh metadata fetch
2. confirm freshly offered release = `runtime-candidate-mfk-2fd6e10cc7c8`
3. download / install / activate
4. after MFK UI loads, return Recovery
5. prove:
   - Current = `runtime-candidate-mfk-2fd6e10cc7c8`
   - Candidate = —
   - Activation Requested = false
   - Previous = prior Current
6. close/reopen app
7. prove same Current remains
8. full power off/on
9. prove same Current remains

Only then BANK:
`MFK_SMT_OTA_PERSISTENCE_RUNTIME_READY_GREEN`

## 8. Failure classifier

- after a fresh OTA check, target candidate not offered → OTA MANIFEST / ENDPOINT
- download fails → DELIVERY / SIGNATURE
- candidate launches but Current stays old → runtime.ready PROMOTION
- new Current then app restart reverts → PERSISTED ACTIVATION STATE
- app restart survives but power-cycle reverts → COLD BOOT / DURABILITY

Fix only the first observed break.

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
