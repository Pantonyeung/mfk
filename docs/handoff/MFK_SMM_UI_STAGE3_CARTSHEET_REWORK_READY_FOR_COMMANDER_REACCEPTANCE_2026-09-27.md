# MFK SMM UI｜Stage 3 CartSheet Rework｜2026-09-27

STATUS:
READY_FOR_COMMANDER_REACCEPTANCE

WORK_ID:
MFK-SMM-UI-STAGE3-CARTSHEET-REWORK-R1

BRANCH:
work/MFK/SMM-UI-STAGE3-CARTSHEET-REWORK-R1

ORIGINAL CURRENT MAIN:
cd91df0ae18798c3d002aec087b564b787a7daa0

SOURCE CANDIDATE:
2ffc54243079c5acb73af049edcdaa235cf0b384

FRESH CURRENT MAIN AT FINAL VALIDATION:
52937ff44d31f488d6e43db8bcd60ce76fab4478

PRE-HANDOFF GREEN HEAD:
6e33ec89ea7c63072d2505745d2d0554edb25771

BEHIND MAIN:
0

PR:
#389

==================================================
FIRST BREAK 1｜LINE TOTAL
==================================================

Fixed.

CartSheet now renders both:
- 單價 = publishedUnitPriceMinor
- 行總額 = publishedUnitPriceMinor × quantity

Implementation:
- production helper: smmLineTotalMinor()
- quantity changes immediately recompute rendered line total
- no stored second price truth
- no second Pricing Engine

==================================================
FIRST BREAK 2｜PASSIVE MENU REFRESH REPAIR
==================================================

Fixed.

Passive menu refresh no longer silently overwrites accepted cart facts.

When current published menu differs from a cart line:
- base price only change => PRICE_CHANGED
- option name / option adjustment / invalid option => CONFIG_CHANGED
- Combo published facts change => CONFIG_CHANGED
- invalid/unavailable current config => CONFIG_CHANGED
- valid published facts change => line-scoped attention

Each affected line stores only a LOCAL_NON_AUTHORITATIVE refresh proposal:
- kind
- menuRevision
- oldPublishedUnitPriceMinor
- proposedPublishedUnitPriceMinor
- proposedSelections
- proposedCombo
- canAccept
- detectedAt

Accepted cart facts remain unchanged until operator action.

UI:
- exact line badge: PRICE_CHANGED / CONFIG_CHANGED
- old price → new price when price changed
- 「接受更新」when proposal is complete and valid
- 「重新編輯」always available
- checkout disabled while any line has unresolved refreshAttention
- unaffected lines are preserved as the same cart objects/facts

Accept update:
- applies proposal only to target line
- preserves stable lineId
- preserves stable createdAt
- preserves quantity
- clears only target line refreshAttention
- does not touch unaffected lines

Re-edit:
- reuses Stage 2 ProductSheet
- restores current line Variation / Modifier / Option / canonical Combo selection state
- preserves line identity

==================================================
EXPLICIT SERVICE MODE REPRICING
==================================================

Preserved as explicit operator action.

堂食 / 外賣 toggle:
- directly reprojects current published facts
- directly updates valid current unit price
- clears stale refresh proposal when successful
- does not require passive-price acceptance

==================================================
AUTHORITY / PRESERVE
==================================================

PRESERVED:
- human loginId
- Stage 0–2
- stable lineId
- stable createdAt
- same product different config stays separate
- canonical Combo path
- SMT authoritative revalidation
- LOCAL_NON_AUTHORITATIVE localStorage
- stable submissionId / idempotency / UNKNOWN backend seam
- Store Kernel / Formal Order authority

AUTHORITY_CHANGE = NONE

NO second:
- Pricing Engine
- Combo Engine
- Order Engine
- Payment Engine

NO Stage 4:
- no Tender UI in CartSheet
- no Dining Target in CartSheet
- no final submit UI in CartSheet
- no UNKNOWN readback CTA in CartSheet

==================================================
TEST COVERAGE
==================================================

Added / locked:
1. qty=2 => line total = unit × 2
2. qty change => line total updates immediately
3. passive price change => PRICE_CHANGED attention
4. Old → New price UI
5. unresolved update => checkout disabled
6. accept update => target line only
7. Combo published fact change => CONFIG_CHANGED
8. unaffected line unchanged
9. explicit service-mode repricing remains direct
10. Stage 0–2 regression
11. loginId regression
12. canonical Combo regression
13. full SMM
14. v2local protected suite
15. SMM + v2local build
16. Wrangler dry-run
17. behind = 0

==================================================
FINAL GREEN EVIDENCE
==================================================

GitHub Actions:
run 36301473074 = SUCCESS

SMM:
- 79 tests PASS
- 0 FAIL
- build PASS
- Vite 156 ms
- Wrangler deploy --dry-run PASS
- NO DEPLOY

Protected v2local:
- 87 test files PASS
- 385 tests PASS
- build PASS
- Vite 235 ms

Additional:
admin-identity-canonical-r1
run 36301473105 = SUCCESS

Final branch relation:
- status = ahead
- behind_by = 0
- main = 52937ff44d31f488d6e43db8bcd60ce76fab4478

==================================================
FILES
==================================================

- v2smm/src/App.tsx
- v2smm/src/persistence.ts
- v2smm/src/product-types.ts
- v2smm/src/stage3-cart.mjs
- v2smm/src/stage3-cart.d.mts
- v2smm/src/stage3.css
- v2smm/test/migration.test.mjs
- v2smm/test/stage3-ui.test.mjs
- v2smm/test/stage3-rework.test.mjs

==================================================
LOCKS
==================================================

NO MAIN MERGE
NO DEPLOY
NO STAGE4

MILESTONE:
MFK_SMM_UI_STAGE3_CARTSHEET_REWORK_R1_READY_FOR_COMMANDER_REACCEPTANCE
