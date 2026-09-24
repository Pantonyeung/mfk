# Customer Experience Upgrade R4 — Acceptance

WORK_ID: `MFK-CUSTOMER-EXPERIENCE-UPGRADE-R4`

BASE: `6061a4405d2d5137c63fae1ab8ca324bfa77a46e`

BRANCH: `work/MFK/CUSTOMER-EXPERIENCE-UPGRADE-R4`

## Goal

Push R3 from premium visual quality into a higher-conversion, lower-friction ordering experience through motion, guided ordering and an honest recommendation layer.

## Implemented

### Motion / response
- active Hero image drift + copy reveal
- route View Transition continuity
- product step completion / forward motion
- selected choice settle feedback
- Memory Jar nav pulse / fill settle
- checkout Pending / UNKNOWN confidence motion
- order-stage active pulse
- pickup-code reveal
- seed / badge collectible motion
- reduced-motion functional equivalent

### Guided ordering
Visible journey:
`揀餐 → 設定 → 記憶罐 → 確認`

Product configuration includes a current-step coach and explicit completion feedback.

### Honest recommendations
New presentation-only helper:
`src/recommendation.ts`

Signals are limited to facts already loaded into the Customer read model:
1. formal completed-order history → BUY_AGAIN
2. store-supplied product badge → FEATURED
3. current browsed category → CURRENT_CATEGORY
4. currently available menu → DISCOVERY

Current cart products are excluded.

The layer:
- does not fetch
- does not mutate runtime
- does not price
- does not apply discounts
- does not create orders
- does not claim AI inference
- exposes a visible reason label/detail for each recommendation

### Recommendation surfaces
- Home
- Menu
- Memory Jar / add-on area

## Authority firewall

UNCHANGED:
- Runtime port
- Pricing authority
- Order authority
- Payment authority
- Member/Loyalty authority
- Coupon authority
- Persistence keys
- Submit / Pending / UNKNOWN / readback semantics
- Reorder revalidation

NO second recommendation authority is introduced. R4 recommendation is a deterministic presentation ranking over already-loaded facts.

## Acceptance gates

- all existing tests GREEN
- R4 boundary tests GREEN
- production build GREEN
- public Cloudflare Version Preview GREEN
- HTTP readback 200
- main not merged
- production traffic unchanged

## Stop

STOP at Owner visual / interaction acceptance.
No merge.
No production deploy.
