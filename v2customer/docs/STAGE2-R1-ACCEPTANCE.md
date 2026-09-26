# MFK Customer UI｜Stage 2 R1 Acceptance Packet

WORK_ID: `MFK-CUSTOMER-UI-STAGE2-R1`

STATUS: `READY_FOR_COMMANDER_REVIEW_AFTER_CHANGES_REQUIRED`

BASE MAIN: `6d37d3c2a4e778657627da79660b9e1314845b4a`

WORK BRANCH: `work/MFK/CUSTOMER-UI-STAGE2-R1`

MERGE: `FORBIDDEN UNTIL OWNER EXPLICITLY AUTHORIZES`

DEPLOY: `FORBIDDEN`

NEXT STAGE: `FORBIDDEN UNTIL OWNER AUTHORIZES`

## Primary UI authority

Stage 2 is NOT based on the legacy `MenuView` or previous menu UI.

Primary visual reference is the approved effect board:

`磨飯_more_fun_點單探索介面.png`

Stable visual reference:
https://cdn.creativeclaw.co/u/6ad84d58/images/54252ae0-960b-4ba2-b45f-2e32cde0b221.png

The effect board controls:
- visual hierarchy
- header composition
- category chip rhythm
- one Featured Large Card + Small Cards structure
- search result structure
- zero-result repair structure
- sold-out state
- favorite affordance
- fixed five-item navigation
- warm cream / navy / orange visual direction

Current Owner locks override literal imagery in the effect board:
- product photography stays EMPTY
- no fake product photo
- no AI fake food
- no stock photo
- no first-character avatar substitute

## Stage 2 implemented surfaces

### 2.1 點單主頁

- Stage 2 owned header
  - official 磨飯 logo
  - Search entry
  - Memory Jar entry + count
- Category rail
  - synthetic `人氣推薦`
  - live published categories
- Secondary filters
  - 全部
  - 人氣
  - 已收藏
- Exactly one Featured Large Card
- Remaining products in Small Card grid
- product media slots remain neutral empty placeholders

### 2.2 分類切換

- same Stage 2 visual system
- no layout reset / second layout engine
- selected category controls current display products
- category without data renders Empty state

### 2.3 搜尋結果

- local presentation search over current loaded product projection
- search checks:
  - name
  - description
  - badge
- results use compact Small Card grid
- search does not create or change commerce authority

### 2.4 零結果修復

When search returns zero:
- human-readable no-result state
- category repair buttons
- available recommendation projection up to 2
- failure never blocks continuing to browse/order

### 2.5 售罄 / 收藏

Sold out:
- remains visible
- explicit `已售罄`
- product detail open action disabled
- no hidden sellability mutation

Favorite:
- UI-local session state only
- no member write
- no cloud write
- no second customer preference authority
- `已收藏` filter supported

## Product Card contract

Every card can contain:
- neutral empty media slot
- product name
- published display price label when supplied
- badge when supplied
- sold-out state
- favorite UI

It does NOT render:
- `product.imageUrl`
- product-name first-character avatar
- emoji / icon as fake product media
- AI fake food
- stock food image

## Featured contract

For a normal category / current browse set:

`featuredProduct = first available product, otherwise first product`

Then:
- exactly one Featured card
- all remaining products become Small cards

This is presentation ordering only. It does not change sellability, price, catalog authority, or product identity.

## Navigation contract

Exact:
- 首頁
- 點單
- 記憶罐
- 訂單
- 會員

Memory Jar:
- fixed center
- cart count badge
- Stage 2 owned presentation

## State contract

Stage 2 owns presentation for:
- LOADING
- READY
- OFFLINE
- ERROR
- STALE / PARTIAL
- NOT_CONNECTED
- EMPTY
- SEARCH_ZERO_RESULT

ERROR customer copy is human-safe:
`暫時未能同步菜單，請稍後再試。`

Stage 2 never renders raw engineering errors.

## Visual system

- Brand Navy: `#15396B`
- Brand Orange: `#F07F24`
- Warm Background: `#F7F1E9`
- Surface: `#FFFDFA`
- max content width: `480px`
- minimum primary touch target: `44px`
- safe-area bottom navigation
- Reduced Motion supported
- no legacy grid/list layout toggle

## Source isolation

Added:
- `.github/workflows/customer-ui-stage2-r1-smoke.yml`
- `v2customer/src/stage2/Stage2Menu.tsx`
- `v2customer/src/stage2/Stage2BottomNavigation.tsx`
- `v2customer/src/stage2/stage2.css`
- `v2customer/test/stage2-menu-r1.test.mjs`
- `v2customer/docs/STAGE2-R1-ACCEPTANCE.md`

Modified:
- `v2customer/src/App.tsx`

App change is limited to:
- route `view==='menu'` to `Stage2Menu`
- hide legacy CustomerHeader/global-status only on Stage 2 menu surface
- use Stage2BottomNavigation only on Stage 2 menu surface
- menu recommendations raised to 8 for Stage 2 browse/repair projection
- all other current views remain untouched

## Explicitly not reused

NOT used as Stage 2 UI:
- legacy `MenuView`
- legacy `CollapsingHeader`
- legacy `ExpandingSearch`
- legacy menu `layout-toggle`
- old product card presentation
- old grid/list selector
- previous Stage 2 exploration implementation

## Commerce authority boundary

Stage 2 reads current projections only.

Stage 2 does NOT:
- create Formal Order
- quote or override canonical price
- mutate sellability
- redeem coupon
- upload payment evidence
- allocate display number
- submit checkout
- write member preferences
- persist favorite as authority
- introduce a second Order Engine / Pricing Engine / Queue

AUTHORITY CHANGE = NONE.

## TDD evidence

RED:
- Run `36275849653`
- Job `108498328665`
- Expected failure: `Stage2Menu.tsx` did not exist.

Implementation:
- source files added
- App routing moved only for Stage 2 menu surface

GREEN:
- Run `36276049245`
- Job `108498897505`
- Tests: `41 / 41 PASS`
- Build: `SUCCESS`
- Vite build complete

## Branch relation

Against fresh main used to cut Stage 2:
- Base: `6d37d3c2a4e778657627da79660b9e1314845b4a`
- behind: `0`
- ahead: `7` before this acceptance document

At acceptance preparation time repository main remains:
`6d37d3c2a4e778657627da79660b9e1314845b4a`

## Commander acceptance checklist

1. Primary UI visual spec is the approved effect board, not legacy menu UI.
2. Stage2Menu replaces MenuView only for the menu surface.
3. Header, category chips, Featured + Small Cards match the effect-board hierarchy.
4. Search results have their own compact result state.
5. Zero-result has repair path and does not block ordering.
6. Sold-out stays visible and cannot open product detail.
7. Favorite remains local UI state only.
8. Product media slots are truly EMPTY.
9. Five navigation labels are exact.
10. Memory Jar is fixed center.
11. Loading / Error / Offline / Stale / Empty states exist.
12. max-width 480px.
13. touch target >= 44px.
14. Reduced Motion exists.
15. No commerce authority moved.
16. No Stage 1 mutation exists on this branch.
17. No Stage 3 mutation exists on this branch.
18. Tests and Build are GREEN.

## Owner gate

STOP after Stage 2.

No merge.
No Cloudflare deploy.
No Stage 3.
No mutation of the original/current branch.

MILESTONE TARGET:

`MFK_CUSTOMER_UI_STAGE2_R1_COMMANDER_ACCEPTED`


## CHANGES_REQUIRED touch-target correction

Commander result:
`CHANGES_REQUIRED`

Only blocker:
- high-frequency touch targets below the locked `>=44px` minimum.

Corrected without changing the accepted visual hierarchy:

- Category Rail: `40px -> 44px`
- Filter `全部 / 人氣 / 已收藏`: `36px -> 44px`
- Favorite `♥ / ♡`: `38 x 38px -> 44 x 44px`
- Zero-result category CTA: `40px -> 44px`

Visual density remains restrained:
- existing typography retained
- existing chip/card hierarchy retained
- only hit-area / minimum control dimensions increased
- no new UI feature
- no layout redesign
- no authority change

### Correction TDD

RED:
- Run `36278680945`
- Job `108506235201`
- New touch-target contract failed as expected.

GREEN:
- Run `36278709025`
- Job `108506313432`
- touch-target contract PASS
- existing tests PASS
- build PASS

### Fresh-main sync

Repository main advanced during the correction to:

`dedd986ca9eca5d4f7f324ea9ae88bcf35233def`

The new main delta is unrelated to Customer Stage 2 and affects:
- `contracts/capacity-pool-v1.ts`
- `v2admin/**`

Stage 2 branch was brought forward to that main with merge commit:

`ee41f5f956f9eb6eb56d84f0bb85d44994f7619a`

This updates the Stage 2 branch only. Main was not mutated.

Post-sync verification:
- Run `36278766332`
- Job `108506474250`
- Tests: `42 / 42 PASS`
- Build: `SUCCESS`
- Fresh main behind: `0`

AUTHORITY CHANGE = NONE.

STOP:
- CLOUDFLARE = NOT_DEPLOYED
- NO MERGE TO MAIN
- STAGE 3 = HOLD
