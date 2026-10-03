# MFK Customer V3 Long Home｜R2 Implementation Lock

Date: 2026-10-01
Status: R2 ACTIVE
Candidate: Draft PR #619
Branch: feat/MFK-CUSTOMER-V3-LONG-HOME-R1

## Owner correction incorporated

R1 mistake class:
- full effect image looked like a Hero implementation;
- OS chrome appeared in the effect image;
- CTA inside the bitmap was not interactive.

R2 correction:
- effect image = reference only;
- app renders no fake time / Wi-Fi / signal / battery;
- Header = real React;
- male/female Hero = standalone transparent assets;
- side doodles = standalone assets;
- headline/body/CTA = DOM;
- CTA/search/nav = real controls.

## Asset lock

R2 asset IDs, URLs and SHA256 are recorded in:
v3customer/src/assets.ts

Assets:
- maleHeroR2
- femaleHeroR2
- moreFunDoodleR2
- goodTasteDoodleR2
- lockedLongHomeReferenceR2

The locked long-home reference is comparison-only and must never be used as a flattened live screen.

## Interaction lock

- Logo -> top
- Search -> menu discovery
- Hero CTA -> menu discovery
- Quick cards -> menu discovery
- Reorder -> menu discovery
- Bottom nav Home/Menu/Orders -> real actions

Production routing may replace preview scroll actions later through approved Customer routes.

## Hard rules

- no fake OS chrome;
- no bitmap button;
- no price/status/ETA baked into images;
- no full-screen screenshot as live component;
- no second Order/Pricing/Sellability/Payment/Fulfillment authority;
- no v2customer mutation;
- no production cutover in this Candidate.

## Visual acceptance order

HEADER -> HERO -> QUICK_VALUE -> CATEGORY -> PRODUCTS -> BRAND_BANNER -> MEMBER_INVITE -> RECENT_ORDER -> SERVICES -> BRAND_STORY -> BOTTOM_NAV

HERO is first perceived-fidelity gate.

MILESTONE: MFK_CUSTOMER_V3_LONG_HOME_R2_ACTIVE
