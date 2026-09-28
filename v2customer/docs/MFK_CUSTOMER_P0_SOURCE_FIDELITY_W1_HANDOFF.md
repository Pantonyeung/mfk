# MFK Customer P0 Source Fidelity W1 Handoff

WORK_ID: MFK-CUSTOMER-P0-SOURCE-FIDELITY-W1
ISSUE: #422
BASE: 3cab695ef736a75c7fcc0bb3690df39cc01e587d
SCOPE: UI0 / UI1 / UI2 presentation only
NO MAIN MERGE
NO DEPLOY

## Implemented
- UI0 no longer references Stage7 pickup assets.
- Dedicated Stage0 male/female assets are selected 50:50.
- First Visit / Returning / Reduced Motion paths retained.
- UI1 Top 6 now consumes canonical product imageUrl/imageAlt instead of blank media.
- UI1 touched copy is customer-facing.
- UI2 product cards now consume canonical product imageUrl/imageAlt; sold-out/favorite/search/cart semantics unchanged.
- UI2 bottom nav has five icons and raised center Memory Jar.
- 360px responsive treatment retained; normal shell supports 390px baseline.

## Authority lock
No Menu/Pricing/Cart/Quote/Checkout/Submit/Order/Fulfillment authority was changed.
UI3-UI9 transaction semantics untouched.
UI10 untouched.

## Source evidence
UI0: stage0_launch_animation_storyboard_v1.png
UI1: 磨飯_stage_1_首頁品牌展示.png
UI2: stage2_order_discovery_female_v1.png + 磨飯_more_fun_點單探索介面.png

## Acceptance
Draft PR #425 opened only to run PR CI. It must not be merged before Commander GREEN.
