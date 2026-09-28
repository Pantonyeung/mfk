# MFK Customer Experience Upgrade R4

WORK_ID: `MFK-CUSTOMER-EXPERIENCE-UPGRADE-R4`

BASE: `6061a4405d2d5137c63fae1ab8ca324bfa77a46e`

BRANCH: `work/MFK/CUSTOMER-EXPERIENCE-UPGRADE-R4`

## Goal

Push the R3 customer experience higher through:
- richer motion and transition quality
- clearer step-by-step ordering guidance
- stronger add-to-Memory-Jar feedback
- an honest recommendation view-model derived only from already-loaded projections
- faster repeat-order discovery
- more continuous Checkout / Pending / UNKNOWN / Order Status interaction

## Recommendation boundary

R4 does not create a second recommendation authority.

`buildCustomerRecommendations` is an assistive presentation ranker only.

Allowed inputs:
- current available menu products
- completed order history already present in the Customer read model
- current local non-authoritative cart
- current category
- store-provided product badge / featured marker

Reasons:
- `BUY_AGAIN`: exact product name appears in loaded completed-order summary
- `FEATURED`: current menu product carries a store-provided badge
- `CURRENT_CATEGORY`: available product is inside current browsing category
- `DISCOVERY`: available product from current menu

Ranking:
- history match > store badge > current category > discovery
- product with image receives small presentation-quality tie-break weight
- unavailable products excluded
- products already in the current cart excluded
- stable name sort resolves equal scores

This ranking:
- does not change product availability
- does not change price
- does not apply coupon or promotion
- does not submit or create an Order
- does not write Member / Loyalty truth
- does not call network directly
- does not persist recommendation truth

UI must disclose the reason for each recommendation.

## Guided ordering

Journey:
1. 揀餐
2. 設定
3. 記憶罐
4. 確認

The active step is visible on:
- Menu
- Product Sheet
- Memory Jar
- Checkout

Product configuration shows:
- current step
- completion state
- what happens next
- auto-advance only where existing single-choice behavior already allows it
- no bypass of required/min/max validation

## Motion system

- tap response: 100ms
- selection settle: 160ms
- journey/layout: 220ms
- reveal: 320ms
- product shared-element / origin morph remains
- Memory Jar navigation feedback on add
- Memory Jar state fill / particle response
- Checkout Pending / UNKNOWN motion remains semantic and calm
- order active stage pulse
- pickup-code reveal
- collectible badge / seed motion

Reduced-motion:
- all decorative motion disabled
- no loss of state or control
- no motion-dependent completion

## Hard preservation

- current MFK Customer runtime is authority
- 58 capability registry entries preserved
- 5 command shapes remain NOT_WIRED
- no direct fetch / XHR / WebSocket
- no second Order / Pricing / Payment / Auth / Sync / Member / Loyalty engine
- no fake recommendation AI claim
- no fake reward / coupon / price
- no donor runtime import
- no live wiring
- no merge / production deploy before Owner acceptance

## Acceptance

Automated:
- npm test GREEN
- npm run build GREEN
- R4 recommendation source/boundary test GREEN
- R4 motion/reduced-motion test GREEN
- execution-lock tests GREEN
- capability count unchanged
- command-shape count unchanged

Browser/public preview:
- Home recommendation reasons visible
- Menu recommendation rail visible
- Product Journey Coach / step feedback
- Add-to-Memory-Jar nav response
- Memory Jar recommendation rail excludes current cart products
- Checkout step continuity
- Pending / UNKNOWN same-intent semantics preserved
- Ready pickup focal treatment preserved
- Member collectible surfaces preserved
- iPhone / Android layouts remain usable
- reduced-motion functional equivalent

STOP at Owner acceptance.

SUCCESS:
`MFK_CUSTOMER_EXPERIENCE_UPGRADE_R4_OWNER_ACCEPTANCE_READY`
