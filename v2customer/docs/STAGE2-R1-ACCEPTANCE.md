# MFK Customer UI｜Stage 2 R1 Fresh Integration Reacceptance

WORK_ID: `MFK-CUSTOMER-UI-STAGE2-R1-FRESH-INTEGRATION`

STATUS: `READY_FOR_COMMANDER_REACCEPTANCE`

FRESH MAIN: `4c8db5d4a33d3e242998cd6806bea94e687187aa`

CLEAN BRANCH: `work/MFK/CUSTOMER-UI-STAGE2-R1-FRESH-INTEGRATION`

SOURCE PRESENTATION CANDIDATE:
`work/MFK/CUSTOMER-UI-STAGE2-R1` @ `6b9d4213907ed4d83757a89bfdf6c4f5492de7a0`

MERGE: `FORBIDDEN`

DEPLOY: `FORBIDDEN`

STAGE 3: `HOLD`

## Purpose

Rebuild the already accepted Stage 2 presentation on top of fresh main without bringing the old branch's stale Customer contract / schema forward.

The canonical Customer business/type truth comes from fresh main.

## Canonical contract preservation

Fresh main `v2customer/src/product-types.ts` is preserved unchanged.

Required canonical fields remain present:

- `CustomerProduct.comboId`
- `CustomerMenuSnapshot.combos`
- `CustomerMenuSnapshot.comboPools`

No Stage 2 code owns or implements a Combo Engine, Pricing Engine, Order Engine, Payment authority, Fulfillment authority, or Member authority.

AUTHORITY CHANGE = NONE.

## Presentation transplanted

From the already accepted Stage 2 candidate:

- `v2customer/src/stage2/Stage2Menu.tsx`
- `v2customer/src/stage2/Stage2BottomNavigation.tsx`
- `v2customer/src/stage2/stage2.css`
- `v2customer/test/stage2-menu-r1.test.mjs`
- minimal Stage 2 wiring in `v2customer/src/App.tsx`

Fresh integration guard added:

- `v2customer/test/stage2-fresh-integration-r1.test.mjs`

Acceptance workflow:

- `.github/workflows/customer-ui-stage2-r1-fresh-integration.yml`

## Preserved Stage 2 behavior

- effect-board Stage 2 hierarchy
- Stage2Menu; legacy MenuView not restored
- Stage2BottomNavigation
- exact navigation:
  - 首頁
  - 點單
  - 記憶罐
  - 訂單
  - 會員
- Memory Jar centered
- Category Rail
- 全部 / 人氣 / 已收藏
- Featured Large + Small Cards
- Search Results
- Zero Result Repair
- Sold Out visible + product-open disabled
- Favorite session-local only
- TRUE EMPTY product media
- 480px shell
- Reduced Motion
- high-frequency touch targets >=44px

## Touch target preservation

- Category Rail >=44px
- 全部 / 人氣 / 已收藏 >=44px
- Favorite = 44 x 44px
- Zero-result category CTA >=44px
- Header / Search / Bottom Nav >=44px

## Product media

TRUE EMPTY remains locked.

Forbidden and absent:

- `product.imageUrl`
- product-name first-character substitute
- emoji / icon substitute
- AI fake food
- stock product photo

## Fresh-main integration TDD

RED:

- Run `36285407631`
- Stage 2 contract failed because `src/stage2/Stage2Menu.tsx` was intentionally not yet present on the clean branch.

GREEN implementation:

- Stage 2 presentation files transplanted.
- `App.tsx` receives presentation-only Stage 2 wiring.
- `product-types.ts` remains fresh-main canonical.

First complete GREEN run:

- Run `36285459590`
- Job `108525263441`
- Stage 2 contract: `13 / 13 PASS`
- Combo / Drink regression: `5 / 5 PASS`
- Full Customer suite: `49 / 49 PASS`
- Build: `SUCCESS`

The current 49-test suite contains the previously green Stage 2-era suite plus current-main Combo/Drink coverage and the fresh integration guards.

## Reacceptance gates

Required:

1. Stage 2 accepted presentation remains intact.
2. `admin-combo-drink-projection-r1.test.mjs` PASS.
3. Full Customer `npm test` PASS.
4. `npm run build` PASS.
5. `CustomerProduct.comboId` exists.
6. `CustomerMenuSnapshot.combos` exists.
7. `CustomerMenuSnapshot.comboPools` exists.
8. TRUE EMPTY product media unchanged.
9. Touch target >=44px unchanged.
10. exact five-nav unchanged.
11. AUTHORITY CHANGE = NONE.
12. fresh-main compare behind = 0.

## Hard boundaries

NO STAGE 3.

NO CLOUDFLARE DEPLOY.

NO MAIN MERGE.

NO PRICING CHANGE.

NO ORDER AUTHORITY CHANGE.

NO PAYMENT CHANGE.

NO FULFILLMENT CHANGE.

NO MEMBER AUTHORITY CHANGE.

NO COMBO ENGINE.

NO SECOND PRICING ENGINE.

NO PRODUCT IMAGE GENERATION.

## Final state

`READY_FOR_COMMANDER_REACCEPTANCE`

Stop after reacceptance packet preparation.
