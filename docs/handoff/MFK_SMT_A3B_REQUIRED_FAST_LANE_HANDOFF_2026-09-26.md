# MFK SMT A3b Required Fast Lane｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / MAIN SMOKE GREEN

## Owner Decision
Owner explicitly resolved the A3a/A3b collision:

### Quick mode
- Required product may enter Cart immediately.
- Required selections are completed later in 「必選區」.
- Required alone must not force Product Editor.

### Normal mode
- Product body opens Product Editor first.
- Required selection is completed before add.

### Product card three-dot
- Always opens Product Editor/options in both Quick and Normal modes.

### forceShow-only
- This decision did not expand forceShow-only behavior.
- Existing editor-first behavior remains until separately decided.

## Implementation
Main landed SHA:
8f0b0fc636c99838d7e116d61cea6ca3bf4a6469

PR:
#332

Bank:
bank/MFK/SMT-A3B-REQUIRED-FAST-LANE-2026-09-26

Changed product files:
- v2local/src/App.tsx
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
- v2local/src/features/ordering/OrderingWorkspace.tsx
- v2local/src/features/ordering/ordering-center-workspaces.css
- v2local/src/presentation/smt-quick-normal-a3a.test.ts
- v2local/src/presentation/smt-required-fast-lane-a3b.test.ts

## Behavior
- Quick Required product enters Cart unresolved.
- 「必選區」 derives tasks only from Admin-published required/min/max/options.
- Applying a Required selection updates the SAME cart line identity.
- Published option price adjustment is applied through the existing pricing facts.
- Checkout is disabled while unresolved Required tasks remain.
- No hard-coded Required choices.
- No FastLaneWorkspaces / fast-lane-model import.
- No second Pricing Engine.
- No Order / Payment / Print authority change.

## Proof
A3b bounded PR proof:
- run 36224550590 SUCCESS
- 34/34 test files PASS
- 142/142 tests PASS
- build PASS
- diff check PASS
- integrated-main E2E lock PASS

Post-merge main:
- V2 Local POS Smoke run 36224648232 SUCCESS

Initial proof run 36224472086 failed only because the temporary workflow used fetch-depth=1 and could not resolve origin/main for diff check.
- Unit tests PASS
- Build PASS
The workflow was corrected to fetch-depth=0 and the next proof was GREEN.

## Protected
Admin / SMT / SMM / Customer / Keeta accepted E2E baseline remains frozen.
Owner port remains deferred.
Second SMT donor work remains donor-only / no wholesale merge.

## Next
A3c Quick Drink is the next bounded slice.

Rule:
- fresh latest main
- audit A3c
- if no real semantic collision: implement immediately
- if A3c conflicts with Owner product meaning / pricing / order / payment / print authority or creates two materially different operator outcomes: STOP and ask Owner to decide.
