# MFK Customer V3｜Mobile Home Layout R4

Date: 2026-10-01
Status: IMPLEMENTED / VISUAL ACCEPTANCE GREEN
Candidate: Draft PR #619

## Owner-locked direction

This iteration changes the mobile layout only.

The approved Hero visual assets remain unchanged:
- hero-background-main.png
- hero-male-main.png
- hero-female-main.png
- hero-doodle-morefun-main.png
- hero-doodle-goodtaste-main.png

No new Hero art direction was introduced.

## Product layout

Homepage is intentionally short and mobile-native:

1. Header
2. Large Hero
3. Four large quick-action cards in a 2×2 grid
4. One primary featured-content section with two large product image cards
5. One recent-order section
6. Four-item fixed bottom navigation

Removed from Home:
- category rail
- member/invite section
- service shortcuts
- extra brand-story section
- additional promotional bands

Those capabilities are not deleted from the product; they are simply not competing for Home attention.

## Mobile design rules

- Hero occupies at least 60% of the first viewport.
- Total Home length targets approximately 1.5 viewports.
- Whole quick-action cards are tappable.
- Primary CTA is at least 48px tall.
- Bottom navigation has large touch zones.
- No hidden gesture dependency.
- No nested menu.
- No instruction-heavy copy.
- No horizontal page overflow.
- Large imagery and large icons carry the hierarchy.

## 390×890 measured evidence

Current evidence:
- Hero height: 569.59px
- Hero viewport share: 0.64
- Full document height: 1368px
- Home length: 1.537 screens
- CTA: 148×54px
- Quick cards: 163×112px each
- Bottom-nav buttons: 88.5×59px each
- Horizontal overflow: none
- Layout acceptance failures: none

Evidence branch:
temp/MFK-CUSTOMER-V3-VISUAL-EVIDENCE

Current evidence files:
- v3customer/evidence/current/long-home-390.png
- v3customer/evidence/current/hero-390.png
- v3customer/evidence/current/metrics-390.json

## Current implementation

Main files:
- v3customer/src/App.tsx
- v3customer/src/styles.css
- v3customer/test/visual-home.spec.ts
- .github/workflows/v3customer-ci.yml

Current homepage composition:
Hero → 4 Quick Actions → 2 Large Featured Cards → Recent Order

## Acceptance

GREEN:
- v3customer typecheck/build
- deterministic 390px visual capture
- hero share >= 60%
- page length within 1.40–1.62 viewport band
- CTA touch target
- four quick cards
- two featured cards
- four bottom-nav items
- Regression Shadow

Production cutover remains outside this Candidate.

MILESTONE: MFK_CUSTOMER_V3_MOBILE_HOME_LAYOUT_R4_GREEN
