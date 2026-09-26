# MFK SMM Final UI｜Stage 2 Combo Projection Block｜2026-09-27

STATUS:
CANONICAL_COMBO_PROJECTION_MISSING
STAGE2_BLOCKED
NO_STAGE3
NO_CLOUDFLARE_DEPLOY
NO_MAIN_MERGE

Branch HEAD:
1e1ee41d345bdb8c42bc5f224e5adc46e61847e3

Fresh main:
6d37d3c2a4e778657627da79660b9e1314845b4a
behind = 0

Blocker 1 and 2 were corrected before the stop:
- Stage 2 sheet is capped at 88dvh at every breakpoint.
- Required option groups render before optional groups while preserving original order inside each bucket.

CI:
36276179142 SUCCESS
50 PASS / 0 FAIL
Build PASS

CANONICAL_COMBO_PROJECTION_MISSING

EXACT MISSING FIELD:
- Current SMM `SmmMenuSnapshot` has no `combos` / `comboPools` projection.
- Current `SmmProduct` has no canonical combo binding/reference identifying that a selected product belongs to a Combo Main Pool.
- Current `SmmCartLine` and `SmmLanLineIntent` have no combo identity / combo child selection fields, so SMM cannot safely carry required Combo configuration into SMT for authoritative revalidation.

EXACT ADAPTER SEAM:
- Canonical upstream projection already exists at:
  `v2local/src/runtime/admin-config-projection.ts::projectSyncedCombos(envelope)`
  reading Admin `catalog.combos` + `catalog.comboPools`.
- Internet SMM snapshot currently drops this data at:
  `v2smm/worker.ts::mapPublishedSnapshot(raw)`
- LAN SMM snapshot currently drops this data at:
  `v2local/src/runtime/smm-lan-ingress.ts::createSmmLanIngress().readSnapshot()`
- Both adapters only project categories/products/options into SMM menu today.

SOURCE OWNER:
- Combo definition / pool / published price facts: Admin canonical published config.
- Runtime execution / revalidation authority: SMT / Store Kernel.
- SMM remains read projection + staff intent only.

SMALLEST FUTURE ALLOWLIST:
1. `v2smm/src/product-types.ts`
   - add read-only SMM combo projection types + menu fields, preserving Admin IDs/prices exactly.
2. `v2smm/worker.ts`
   - project `projectSyncedCombos(envelope)` into Internet snapshot.
3. `v2local/src/runtime/smm-lan-ingress.ts`
   - project the same canonical Combo facts into LAN snapshot.
4. `v2smm/src/App.tsx` + `v2smm/src/selection.ts`
   - render Combo section + required validation only from projected IDs/facts.
5. If Combo choices must be submitted from SMM:
   - `v2smm/src/product-types.ts` / `persistence.ts`
   - `contracts/smm-lan-v1.ts`
   - `v2smm/src/smt-lan-adapter.ts` / cloud bridge
   - SMT receive/revalidate seam
   must receive an explicit canonical Combo identity/child-selection contract before activation.

No product/category/name heuristic is allowed.
No Combo pricing engine is to be created in SMM.

AUTHORITY_CHANGE:
NONE

MILESTONE:
MFK_SMM_STAGE2_CANONICAL_COMBO_PROJECTION_MISSING
