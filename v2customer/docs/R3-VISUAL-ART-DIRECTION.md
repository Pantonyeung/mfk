# MFK Customer Visual Art Direction R3

WORK_ID: `MFK-CUSTOMER-VISUAL-ART-DIRECTION-R3`

BASE: `26ba0eccbcca648b9d640f96e235d0d893cc45c9`

BRANCH: `work/MFK/CUSTOMER-VISUAL-ART-DIRECTION-R3`

MODE:
- CUSTOMER_ONLY
- VISUAL_ART_DIRECTION + MICRO_INTERACTION
- NO BUSINESS SEMANTIC CHANGE
- NO LIVE WIRING
- NO AUTHORITY CHANGE
- NO MERGE
- NO DEPLOY UNTIL OWNER PREVIEW

## Current assessment

R2 is functionally complete and clear. Remaining gap is not transaction architecture. Remaining gap is premium visual identity, emotional brand impact and collectible interaction quality.

Current customer-view score baseline: 87/100.

Target: 93–95+ visual/product-quality bar without changing transaction semantics.

## R3 focus — only four major areas

### A. Home Hero / first impression

Current seam:
- `v2customer/src/components/customer-views.tsx`
  - `HeroCarousel`
  - `HomeView`
- `v2customer/src/styles.css`
  - `.hero-carousel`
  - `.hero-slide`
  - `.home-primary-action`
  - `.featured-section`
  - `.memory-ecosystem`

Goal:
- first 1–2 seconds must feel unmistakably More Fun
- stronger editorial food photography
- larger confident typography
- sharper white-space rhythm
- vivid purple-rice + fresh green + controlled coral
- no beige / cream / retro café direction
- CTA remains immediately obvious
- active order remains above brand content when present

Do not add more copy. Improve composition, hierarchy and motion.

### B. Memory Jar signature transformation

Current seam:
- `JarVisual`
- `CartView`
- `.memory-jar-visual`
- `.jar-live-summary`
- `.cart-lines`

Current problem:
The jar is understandable but still schematic.

Target states:
- EMPTY
- FIRST_ITEM
- BUILDING
- READY_TO_CHECKOUT

Interaction:
- item add triggers restrained jar-fill / particle / count transformation
- remove reverses the visual state
- quantity change updates count smoothly
- no cartoon aesthetic
- no fake 3D
- premium abstract glass / purple-rice memory language
- reduced-motion keeps semantic state without animation

The jar must become a recognizable More Fun brand object.

### C. My Memory / collectible system

Current seam:
- `MemberView`
- seed dashboard
- coupon collection
- badge collection
- remembered tastes / recent memory / Care

Goal:
Make Seeds / Coupons / Badges feel collectible and emotionally valuable, not just cards in a dashboard.

Seeds:
- premium growth/progress motif
- clear official-data state
- no fake values

Coupons:
- distinctive ticket/pass visual language
- available / locked / used / expired visually distinct
- still no frontend pricing authority

Badges:
- each badge should read as an object/collectible
- earned / locked / progress / detail / date
- no generic square with one character
- no frontend award logic

My Memory page should feel like a relationship space, not settings/profile.

### D. Checkout + Order Status premium confidence

Current seam:
- `CheckoutView`
- `OrdersView`
- order card / timeline styles
- global pending / unknown presentation

Current problem:
Semantics are correct, but visual language is more transactional/system-like than fashion-forward.

Target:
- safer, calmer, cleaner final confirmation
- less "form" feeling
- stronger section completion hierarchy
- one dominant submit/readback action
- Pending / UNKNOWN should feel reassuring and deliberate, not like an error console
- Ready state should make pickup code the visual focal point
- timeline should be elegant and glanceable
- never blur READY / VERIFIED / HANDED_OVER / COMPLETED semantics

## Hard visual lock

Use:
- white / near-white base
- deep purple-rice brand
- fresh green
- controlled appetite coral
- cool neutrals
- large food imagery
- strong black type
- generous spacing
- crisp 1px borders only when needed
- restrained soft shadow

Reject:
- beige / cream dominant backgrounds
- sepia
- retro café look
- childish illustration
- generic SaaS dashboard
- excessive glassmorphism
- decorative gradients everywhere
- tiny text
- dense card stacks

## Motion

Press: 90–120ms
Selection: immediate + 120–180ms settle
Layout: 180–240ms
Sheet: 260–320ms
Hero/collectible transitions: max 360ms

Use motion to explain state change, not decorate.

All important controls need:
DEFAULT / PRESSED / SELECTED / DISABLED / LOADING / SUCCESS / ERROR

Reduced motion:
- near-zero transitions
- same functional state
- no loss of feedback

## Must preserve exactly

- 58 / 58 capability registry
- 5 / 5 command shapes NOT_WIRED
- runtime injection-only
- current submit / pending / UNKNOWN / readback semantics
- current cart / checkout / pending-intent persistence contract
- current reorder revalidation
- current member/loyalty honest not-connected states
- no direct network path
- no donor runtime import
- no second Order/Pricing/Payment/Auth/Sync/Member/Loyalty engine

## No product-scope expansion

Do not add:
- new loyalty earning rules
- new coupon rules
- new membership tier rules
- payment execution
- online payment
- new provider integration
- new order state
- new pricing command
- new backend contract

R3 is art direction + interaction only.

## Acceptance proof

Required screenshots:
1. Home hero / no active order
2. Home / active order
3. Menu
4. Product step
5. Memory Jar empty
6. Memory Jar first item
7. Memory Jar multi-item
8. Checkout
9. Pending
10. UNKNOWN
11. Preparing
12. Ready / pickup code
13. Member
14. Seeds
15. Coupons
16. Badge collection
17. Member disconnected
18. iPhone 390×844
19. Android 412×915
20. Reduced motion

Required browser proof:
- press feedback
- add-to-jar transition
- remove reverse state
- search focus
- progressive config step transition
- sheet open / dismiss
- checkout section completion
- UNKNOWN readback
- order stage change
- badge/coupon detail open
- focus return
- keyboard Escape
- reduced motion

Required automated proof:
- npm test GREEN
- npm run build GREEN
- capability count unchanged
- command-shape count unchanged
- no runtime authority drift
- git diff --check GREEN

## Stop condition

STOP at Owner visual acceptance.
Do not merge.
Do not production deploy.

Return:
- exact candidate SHA
- changed files
- screenshots
- browser proof
- tests/build proof
- authority diff
- short BEFORE → AFTER summary

SUCCESS:
`MFK_CUSTOMER_VISUAL_ART_DIRECTION_R3_OWNER_ACCEPTANCE_READY`
