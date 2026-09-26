# MFK SMM Final UI｜Stage 0 Handoff｜2026-09-26

## STATUS
STAGE0_IMPLEMENTED
TEST_GREEN
BUILD_GREEN
READY_FOR_COMMANDER_ACCEPTANCE
STOP_BEFORE_STAGE1

## BRANCH
`work/MFK/SMM-FINAL-UI-IMPLEMENTATION-R1`

## PR
#345｜SMM UI Stage 0｜Launch / Login / Connection｜Final UI R1

Main 未被修改、未 merge、未 deploy。

## Stage 0 scope completed
1. Splash
   - 磨飯／SMM brand lockup
   - AI-generated mascot artwork
   - bounded 650ms splash presentation
   - no infinite loading

2. Runtime connection check
   - reuse existing `SmmRuntimePort.readSnapshot()`
   - 3.5s bounded probe
   - clear CHECKING / READY / ERROR presentation

3. Staff login
   - reuse existing `listSmmStaff()`
   - reuse existing `verifySmmStaff()`
   - PIN 4–8 digits
   - no second auth engine
   - LAN path remains compatible

4. Recovery
   - reconnect action
   - safe offline-workspace entry
   - no fake menu/order/business truth when disconnected

5. Mobile implementation
   - max width 520px
   - 100dvh
   - top / bottom safe-area
   - <=360px compact rules
   - prefers-reduced-motion support

## AI asset rule
Stage 0 mascot visual is AI-generated and embedded in presentation CSS as WebP data URI.
No real product photography was added.

## Changed product files
- `v2smm/src/StageZero.tsx`
- `v2smm/src/stage0.css`
- `v2smm/src/main.tsx`
- `v2smm/test/stage0-ui.test.mjs`
- `.github/workflows/smm-final-ui-smoke.yml`

## Authority proof
StageZero contains no:
- submitOrder mutation
- setSellability mutation
- createDineSession mutation
- Pricing authority
- Payment authority
- Print authority
- Store Kernel writer

Existing `App.tsx` transaction flow was not rewritten.
Existing `FORMAL_ORDER_COMMAND = WIRED_TO_SMT` remains unchanged.

## Executable proof
Workflow:
`smm-final-ui-smoke`

Run:
`36242641891`

Result:
- Install PASS
- npm test: 29 PASS / 0 FAIL
- TypeScript build PASS
- Vite production build PASS
- Vite build completed in 144ms

## Fresh main alignment
Latest verified compare at handoff:
- branch behind main: 0
- Stage 0 delta isolated to SMM UI + test + branch-only smoke workflow

## Commander acceptance checklist
- [ ] Stage 0 visual direction matches approved SMM brand
- [ ] Splash proportion / iPhone safe area acceptable
- [ ] Staff login flow acceptable
- [ ] Connection check / recovery wording acceptable
- [ ] Offline entry acceptable
- [ ] No authority regression
- [ ] No Customer-App feature leakage
- [ ] Main remains untouched

## NEXT
Do not start Stage 1 until Commander accepts Stage 0.

MILESTONE:
`MFK_SMM_FINAL_UI_STAGE0_READY_FOR_COMMANDER_ACCEPTANCE`
