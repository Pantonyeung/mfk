# MFK Customer V3｜High-Fidelity AI Implementation Protocol R1

Date: 2026-10-01  
Status: EXECUTION PACKET / PREVIEW ONLY  
Exact base: a41378d7106362b6fb13c66549c6c6556c909025

## 1. External pattern that works

Across screenshot-to-code projects, pixel-perfect agent workflows, Figma design-to-code tooling and visual-regression systems, the repeatable pattern is:

inspect → decompose → implement → render → compare → correct → repeat

High fidelity is not a one-prompt task.

## 2. Pass A — Visual decomposition

Before coding, AI must identify:
- page regions;
- z-order;
- grid/flow;
- spacing;
- typography;
- gradients/colors;
- radius/shadow;
- asset boundaries;
- runtime text;
- responsive behavior.

This becomes a component map.

## 3. Pass B — Implement one region at a time

Order:
1. shell/header;
2. hero;
3. quick cards;
4. categories;
5. product strip;
6. promotional/brand banner;
7. member/invite;
8. reorder/services;
9. lower story;
10. bottom nav.

Do not regenerate the entire page blindly on every correction.

## 4. Pass C — Deterministic render

At every region:
- run the real app;
- capture the exact same viewport;
- compare against locked target;
- identify the largest mismatch.

Recommended local acceptance:
- Playwright full-page screenshot;
- region screenshots for hero/header/product;
- same browser/platform for baseline and candidate.

## 5. Pass D — Smallest visual fix

Correct only the biggest remaining deltas:
- x/y/width/height;
- padding/gap;
- font size/weight/line-height;
- crop/object-position;
- border radius;
- shadow;
- color/gradient;
- z-index.

Then recapture.

## 6. Pass E — Responsive/state verification

Widths:
- 360
- 390
- 412
- 430

States:
- normal;
- loading;
- stale/offline;
- closed;
- returning;
- active order;
- campaign/member.

## 7. AI guardrails

AI SHOULD:
- preserve repository framework;
- use official assets;
- render real DOM/CSS;
- use reusable tokens;
- collect visual-diff evidence;
- keep fixtures separate from production truth.

AI MUST NOT:
- create a second business engine;
- bake the complete UI into one image;
- call the page high-fidelity without screenshot evidence;
- modify production routing in this candidate.

## 8. Why PRD + screenshot is better than screenshot alone

Screenshot alone gives visual intent but not:
- data authority;
- what text is runtime;
- which cards are interactive;
- responsive behavior;
- error states;
- business-state semantics;
- acceptance threshold.

PRD alone gives behavior but not geometry.

The reliable package is:
Visual PRD + locked screenshot + exact assets + component map + screenshot-diff loop.

## 9. Exact fidelity blocker

Current repository has official logo and baseline male/female IP assets, but not the exact dynamic poses from the selected long homepage.

Therefore:
- layout work can start now;
- structural fidelity can be driven high now;
- final >95% perceived fidelity requires exact transparent pose assets;
- after asset approval, rerun visual-diff loop until thresholds pass.

## 10. Repository execution target

Isolated new path:
- v3customer/

No change:
- v2customer;
- SMT;
- Admin;
- pricing;
- order;
- payment;
- fulfillment;
- provider contracts.

## 11. Release boundary

Default delivery is Draft PR only.

No merge, deploy, production hostname route or OTA without separate Owner PROMOTE.
