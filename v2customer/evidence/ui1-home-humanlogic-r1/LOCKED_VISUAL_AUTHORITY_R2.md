# CUSTOMER UI1｜LOCKED VISUAL AUTHORITY R2

Date: 2026-10-01
Owner status: CONFIRMED FOR IMPLEMENTATION
Reference image: `磨飯暖心美食_app_首頁.png`
Reference generation id: `45532bce-dc07-426e-81c6-9b7148ba7059`

## Interpretation

This image is NOT a raster screen to be pasted into the app.

It is the visual authority for implementing the real UI structure, spacing, hierarchy and component composition.

All text, state, product media, prices, favorites, coupons, categories and order status remain runtime UI / data.

## Locked Structure

1. Premium brand header
   - official MFK logo
   - store context pill
   - no fake notification action

2. Warm welcome / brand personality
   - large short greeting
   - one short supporting line
   - MFK characters as brand art
   - this copy is brand warmth, not tutorial copy

3. Search
   - large direct search entry
   - one-tap route to Browse

4. Brand campaign / visual Hero
   - real component, not a crop of the old design board
   - separate art + runtime interaction
   - no baked-in search UI / fake product data

5. Fixed quick entries
   - 我的收藏
   - 回憶券
   - 期間限定
   - all are real tappable routes

6. 今日精選
   - two-column premium product grid
   - only official Admin/runtime product images
   - no generic food-image substitution
   - neutral placeholder / loading skeleton allowed
   - device favorites are actionable and persisted locally for current Customer V1

7. Bottom Navigation
   - fixed five destinations
   - flat premium mobile navigation
   - no oversized center FAB treatment

## Active Order Override

When an active order exists, it appears before the welcome section.

Visible default:
- one state
- ETA if canonical
- pickup code if READY
- display/order identity
- tap to order status

## Human Logic Rule

Human Logic means:
- no prose explaining obvious controls
- no repeated state paragraphs
- direct labels and direct actions
- visual hierarchy carries meaning

Human Logic does NOT mean:
- remove brand warmth
- remove welcome copy
- remove shortcut entry cards
- flatten the visual system into a skeleton

## Forbidden

- using `磨飯_stage_1_首頁品牌展示.png` as an in-app cropped Hero asset
- generic bowl/salad/riceball imagery as fake product photos
- fake price / fake menu / fake availability
- unsupported controls presented as active actions
- tutorial/helper paragraphs for obvious UI

## Acceptance

Review at 360 / 390 / 412:
- header hierarchy
- welcome and characters
- search
- Hero
- three fixed shortcuts
- product cards / skeletons
- flat bottom navigation
- no horizontal overflow
- no duplicated UI baked into artwork
- no fake business truth

Status: LOCKED VISUAL AUTHORITY / IMPLEMENTATION ACTIVE
