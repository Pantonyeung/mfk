# MFK SMM Final UI｜Stage 2 商品客製 + Combo Final Handoff｜2026-09-27

STATUS:
STAGE2_COMPLETE
COMBO_CANONICAL_PATH_CONNECTED
READY_FOR_COMMANDER_ACCEPTANCE
NO_CLOUDFLARE_DEPLOY
NO_MAIN_MERGE
NO_STAGE3

BRANCH:
work/MFK/SMM-FINAL-UI-IMPLEMENTATION-R1

SOURCE HEAD BEFORE THIS HANDOFF:
b611301ebdddd7ff7fb5bf5b3a2532c92cb887e1

FRESH MAIN:
4c8db5d4a33d3e242998cd6806bea94e687187aa

BEHIND:
0

==================================================
STAGE 2 FINAL CONTRACT
==================================================

1. ProductConfigSheet
- max-height locked to 88dvh at every breakpoint
- no 90dvh override
- scroll body
- sticky footer
- 24px top radius
- close target >=44px
- option target >=48px
- <=389px options collapse to one column

2. Product presentation order
- Product summary
- Variation
- Required option groups
- Optional option groups
- Combo section
- Validation
- Add

Required grouping:
- requiredGroups = group.required || group.minSelections > 0
- optionalGroups = !group.required && group.minSelections === 0
- source order is preserved inside each bucket

3. Product media
- 1:1
- EMPTY
- no generated food image
- IP / mascot remains deferred by Owner

==================================================
CANONICAL COMBO
==================================================

Current canonical Combo path is now connected.

SMM read projection:
- SmmMenuSnapshot.combos
- SmmMenuSnapshot.comboPools
- SmmProduct.comboId

Canonical source:
- Admin published catalog.combos / catalog.comboPools
- projected through projectSyncedCombos(envelope)

Internet projection:
- v2smm/worker.ts::mapPublishedSnapshot

LAN projection:
- v2local/src/runtime/smm-lan-ingress.ts::readSnapshot

No product-name/category/"套餐" heuristics are used.
Product binding only resolves when canonical Main Pool membership has one exact Combo match.

Stage 2 UI:
- Combo section only renders when resolveSmmProductCombo(product,menu) returns canonical Combo data
- no Combo projection = no fake Combo section
- staff explicitly selects "升級套餐"
- required Combo groups validate before Add
- incomplete required Combo keeps Add disabled
- DRINK follows existing Owner-locked A3c optional semantics

Published price facts:
- combo publishedBasePriceMinor comes from canonical projection
- sub-pool / choice publishedAdjustmentMinor comes from canonical projection
- SMM calculates preview only from these published facts
- SMM does not create an independent Combo price table

Transport:
- SmmCartLine.combo
- SmmLanComboIntent
- Smm LAN adapter preserves Combo ID + child selections + published price facts

Authoritative submit:
- SMT revalidates Combo with current projectSyncedCombos(envelope)
- SMT revalidates actual Product IDs / Pool / Group / SubPool / Choice
- SMT recalculates authoritative Combo price
- mismatch => SMM_PUBLISHED_PRICE_CHANGED
- SMM preview is never final transaction authority

==================================================
ACCEPTANCE MATRIX
==================================================

PASS:
1. Sheet all viewport <=88dvh
2. Required groups before Optional groups
3. Original order inside each bucket preserved
4. Canonical Combo product shows Combo section
5. Non-Combo product shows no fake Combo section
6. Required Combo incomplete => Add disabled
7. Combo price facts only from canonical published projection
8. Product media = 1:1 EMPTY
9. Sticky footer retained
10. Close >=44px
11. Options >=48px
12. <=389px single-column
13. Min/Max/selected count retained
14. Live draft unit total retained
15. Inline validation retained
16. IP production remains deferred
17. No stock/third-party visual added
18. No name/category Combo heuristic
19. SMT authoritative Combo revalidation retained
20. AUTHORITY_CHANGE = NONE

==================================================
PROOF
==================================================

SMM Final UI Smoke:
run 36282253286 = SUCCESS

SMM:
56 PASS / 0 FAIL
Build PASS
Vite 152ms

Protected v2local Combo:
78 test files PASS
347 tests PASS
Build PASS
Vite 287ms

Stage 2 Combo Integration:
run 36282253310 = SUCCESS

SMM:
56 PASS / 0 FAIL
Build PASS
Vite 149ms

SMT authoritative Combo revalidation:
78 test files PASS
347 tests PASS
Build PASS
Vite 228ms

==================================================
AUTHORITY
==================================================

AUTHORITY_CHANGE = NONE

NO-TOUCH:
- Store Kernel authority
- Formal Order authority
- Payment
- Print
- Dining
- Customer
- Admin
- Keeta
- main branch
- production deployment

STOP:
Stage 3 NOT STARTED.

MILESTONE:
MFK_SMM_FINAL_UI_STAGE2_COMBO_COMPLETE_READY_FOR_ACCEPTANCE
