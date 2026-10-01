# CUSTOMER UI1｜MOBILE LARGE-HERO LAYOUT R4

Date: 2026-10-01
Owner direction: IMPLEMENT NOW
Status: CANDIDATE / HOLD

## Owner clarification

Priority is the mobile layout itself.

- The screen must be designed for real phone proportions.
- Large visual impact is required.
- IP accuracy can be corrected later.
- Layout must be implemented as real UI components now.

## R4 mobile structure

1. Header
   - official logo
   - store context
   - Memory Jar action

2. Active Order
   - conditional
   - compact canonical state

3. Search
   - full-width
   - direct Browse entry

4. Large Hero
   - 282–326px by viewport width
   - strong brand statement
   - temporary IP artwork slot
   - real CTA

5. Quick entries
   - 我的收藏
   - 回憶券
   - 期間限定

6. Category rail
   - horizontal mobile chips
   - runtime categories

7. Campaign / store notice
   - conditional

8. Reorder strip
   - conditional

9. Product recommendation rail
   - runtime product images only
   - horizontal scroll
   - favorite action

10. Fixed Bottom Navigation
   - 首頁
   - 點單
   - 記憶罐
   - 訂單
   - 會員

## Mobile acceptance

360:
- hero 282px
- compact header
- no horizontal body overflow

390:
- hero 300px
- primary baseline

412:
- hero 326px
- same hierarchy, more breathing room

## Runtime truth

Product cards:
- product.imageUrl only
- neutral placeholder when missing
- no generic fake food fallback

Hero IP:
- temporary approved pair asset
- layout authority only
- IP fidelity replacement remains a separate follow-up

## Gate

PR #609 remains DRAFT/HOLD.
Public-stage deployment is allowed for Owner visual review.
Main merge still requires explicit Owner confirmation.
