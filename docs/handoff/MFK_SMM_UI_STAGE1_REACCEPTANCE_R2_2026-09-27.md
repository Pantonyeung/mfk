# MFK SMM Final UI｜Stage 1 點單 UI 修正 R2｜2026-09-27

STATUS:
CHANGES_COMPLETE
READY_FOR_COMMANDER_REACCEPTANCE
NO_CLOUDFLARE_DEPLOY
NO_MAIN_MERGE
NO_STAGE2

BRANCH:
work/MFK/SMM-FINAL-UI-IMPLEMENTATION-R1

FIXES:
1. Product media geometry locked to 1:1 at all breakpoints.
   - removed 4:3
   - removed <=360 16:8 override
2. Available product cards now show visible "＋" affordance.
   - 48x48 visual/touch affordance
   - implemented as span inside the existing card button
   - no nested button
   - sold-out cards do not render active plus
3. Category rail high-frequency touch target raised to 48px.
4. UI acceptance bypass hardened.
   - acceptance only: smm-acceptance-*.yeungyi88.workers.dev
   - localhost / 127.0.0.1 require explicit ?ui-bypass=1
   - production URL + ?ui-bypass=1 does NOT bypass

ACCEPTANCE CONTRACT VERIFIED:
- Product media 1:1
- visible plus for available products
- no active plus for sold-out
- plus = 48x48
- CategoryRail = 48px
- responsive contract 360 / 375 / 390 / 430 / 440 / 520 retained
- zero-result "清除搜尋" retained
- product image slots remain empty
- IP production remains PAUSED
- no stock / third-party icon introduced
- production bypass blocked
- acceptance hostname bypass enabled
- localhost explicit bypass enabled

SOURCE PROOF BEFORE THIS HANDOFF COMMIT:
HEAD:
afdc9e03a8ce110f2245717c6ac2992b7f3e9e69

CI:
36273545933 SUCCESS

TESTS:
41 PASS
0 FAIL

BUILD:
TypeScript PASS
Vite PASS
Vite build 139ms

FRESH MAIN:
46f15641de536c988e496987f6504e8efa6d096c

BEHIND:
0

AUTHORITY_CHANGE:
NONE

NO-TOUCH CONFIRMED:
Store Kernel
SMM→SMT submit
Pricing
Payment
Print
Dining
Customer
Admin
Keeta
main
Production
Stage 2

STOP:
Stage 2 not started.

MILESTONE:
MFK_SMM_STAGE1_R2_READY_FOR_COMMANDER_REACCEPTANCE
