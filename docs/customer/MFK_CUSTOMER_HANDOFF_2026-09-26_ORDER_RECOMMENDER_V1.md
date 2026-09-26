# MFK Customer Handoff｜2026-09-26｜Order Page + Recommender

## Newly Defined
Second tab = 點單。

Flow:
Category
→ Category Hero
→ Product Card
→ Shared-element style Detail
→ Combo Upgrade (if eligible)
→ Required Groups
→ Optional Groups
→ Recommendations
→ Quote
→ Add to 記憶罐

## Locked / Draft-Locked
- Required Choice blocks Add to Cart.
- A/B/C/D must be Catalog metadata, not price inference.
- Single rice ball can upgrade into eligible combo while preserving child identity and selections.
- Recommender is projection/ranking only; no Pricing/Sellability/Order authority.
- Recommender V1 = rules + semantic tags + co-purchase + session + member history.
- Recommendations capped to avoid fatigue.
- Cart repair is line-level, not full-cart reset.

## External Comparison Bank
- Meituan: combo quality requires semantic compatibility, not co-purchase alone.
- Uber Eats: structured modifier rules + suggested combos + sold-out exclusion.
- Keeta: SPU/SKU/ChoiceGroup + required category semantics.
- foodpanda: imagery, combos, limited meaningful add-ons.
- WeChat mini-program pattern: short single-store journey / native-feel interaction.
- Dianping: discovery/recommended-dish inspiration, not transaction authority.

## Recommended V1 Score
35 basket completeness
25 co-purchase
15 member affinity
10 session
10 daypart/limited freshness
5 admin boost
minus fatigue/rejection/removal penalties

## Open
- Category navigation layout
- Hero size/placement
- Exact Product Detail visual
- Cart savings/discount/status semantics
- Recommendation copy tone

## Milestones
CUSTOMER_ORDER_PAGE_PRODUCT_DETAIL_V1_DRAFT_LOCKED
CUSTOMER_RECOMMENDER_HYBRID_V1_DRAFT_LOCKED
CUSTOMER_REQUIRED_GATE_V1_LOCKED
CUSTOMER_RICEBALL_COMBO_UPGRADE_FLOW_V1_DRAFT_LOCKED
