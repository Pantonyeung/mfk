# MFK SMT Stage 0｜FORMAL ASSET LANDING｜Commander Re-review

STATUS: MFK_SMT_STAGE0_FORMAL_ASSET_LANDING_READY_FOR_COMMANDER_REVIEW

## Scope
Only Stage 0 asset landing RED is addressed.
No Stage 1 mutation.
No Order / Pricing / Payment / Print mutation.
No main merge.

## Git
Branch: work/MFK/SMT-STAGE0-UI-FINAL-R2
Base: a02ab8e9256806c9c5611a469ecda4fee97e21ef

Previous implementation head: e0d949718250ed3c13a6fc420ea41cd5f02d5f47
Previous implementation head vs Base: ahead 3.

Previous handoff commit: 47b2117d81e603bfd9f0c901da75fa4b1257dbd5
Previous handoff commit vs Base: ahead 4.

Formal asset landing candidate before this handoff: 249d6364d4659ddff138e8c306977fa3330ef9cd
Candidate vs Base at verification: ahead 10 / behind 0.

## Formal binary assets
Required and verified non-empty:
- v2local/public/assets/smt/stage0/stage0-logo.jpg
  blob 7d1ce9b95a30f48fe9674cd5f63744391121603e
- v2local/public/assets/smt/stage0/stage0-ip-boy.png
  blob 533544441b350767ff41c83234862740c481ae0f
- v2local/public/assets/smt/stage0/stage0-bg-cafe-main.jpg
  blob 5da90d6348f3e692e3d8d997630943ddb3031e73

Supporting assets uploaded by Owner are also present in the same directory.

## Runtime references
- StaffAuthGate.tsx renders /assets/smt/stage0/stage0-logo.jpg
- StaffAuthGate.tsx renders /assets/smt/stage0/stage0-ip-boy.png
- CashOpeningGate.tsx renders the same formal Logo/IP
- Stage 0 brand surface uses stage0-bg-cafe-main.jpg
- Old text-logo + MF programmatic mascot references removed from Stage 0 gate render paths

## Fallback
Both formal img elements attach onError -> asset-failed.
CSS hides failed binary image instead of substituting/reinventing a fake Logo/IP.
No regenerated or distorted fallback brand is introduced.

## Authority
Existing loginStaff / staffAuthRequired / readActiveStaffSession remain.
Existing cashOpeningRequired / readCurrentCashOpeningState / confirmCashOpening remain.
No canonical authority change.

## Test
Added:
v2local/src/presentation/stage0-formal-assets.test.ts

Assertions:
1. Required formal binary files exist.
2. Required binary files are non-empty.
3. Both Stage 0 gates reference formal Logo/IP paths.
4. Both gates have render-failure fallback hook.
5. Old s0-mascot placeholder is absent from gate source.

Note: connector can add the test and verify Git tree/content, but no CI status check is currently reported by GitHub for this candidate. Commander should run repository-native test command during re-review if required.

## Exact changed files relevant to RED fix
- v2local/public/assets/smt/stage0/stage0-logo.jpg
- v2local/public/assets/smt/stage0/stage0-ip-boy.png
- v2local/public/assets/smt/stage0/stage0-bg-cafe-main.jpg
- v2local/src/presentation/StaffAuthGate.tsx
- v2local/src/presentation/CashOpeningGate.tsx
- v2local/src/styles.css
- v2local/src/presentation/stage0-formal-assets.test.ts

STOP after handoff. Commander decides GREEN/RED.
