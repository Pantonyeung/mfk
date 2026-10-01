# MFK Customer V3 Long Home｜Visual PRD R1

Date: 2026-10-01  
Status: OWNER VISUAL DIRECTION LOCKED / IMPLEMENTATION TARGET  
Capability: CUSTOMER_V3_LONG_HOME_UI_R1  
Execution mode: isolated V3 preview, zero production routing.

## 1. Owner-locked design direction

The selected direction is the long-scroll homepage produced after filtering earlier concepts #2 and #3.

Locked:
- long vertically scrollable homepage; not restricted to one viewport;
- large visual-first dual-IP Hero;
- male IP visually dominant in the foreground, female IP supporting;
- strong primary CTA;
- blue / navy / purple / cream palette;
- premium rounded cards, soft shadows, clear vertical rhythm;
- rich below-the-fold content;
- simple bottom navigation.

## 2. PRD role

A normal prose PRD helps product semantics but is not enough for pixel fidelity.

This Visual PRD locks:
- information architecture;
- component order;
- state/data ownership;
- visual hierarchy;
- asset slots;
- interaction intent;
- responsive rules;
- visual acceptance.

Final fidelity is governed by:
1. this Visual PRD;
2. the locked reference image;
3. the exact asset pack;
4. deterministic screenshot-diff evidence.

## 3. Page structure

1. Status/header
   - official logo
   - location/store context
   - notification
   - search
2. Hero
   - headline / supporting copy / CTA
   - male IP foreground
   - female IP secondary
   - soft background shapes / handwritten accents
3. Four quick-value cards
   - 今日精選
   - 人氣組合
   - 限時優惠
   - 30分鐘內可取
4. Category row
   - 早餐 / 輕食飯餐 / 小食 / 飲品 / 甜點
5. 主廚推薦
   - horizontal product cards
6. Brand / lifestyle banner
7. Member + Invite section
8. Recent order / reorder
9. Pickup / service convenience
10. Lower brand-story block
11. Bottom navigation

## 4. Canonical-data boundary

The homepage is a projection surface only.

Dynamic facts must come from approved Customer read models/runtime adapters:
- store/location/operating state;
- category/product identity;
- product image;
- price;
- availability;
- member/reward state;
- recent order;
- active order/ETA if shown.

UI must not create a second Order, Pricing, Sellability, Payment or Fulfillment authority.

Preview fixtures are permitted only in isolated visual acceptance and must be explicitly non-authoritative.

## 5. Visual tokens

Palette:
- navy #0B2C66
- blue #1767F7
- purple #8B4DF6
- sky #D9ECFF
- cream #FFF8EB
- white #FFFFFF
- muted text #7484A5

Geometry:
- preview page max width 430px;
- horizontal gutter 14-20px;
- card radius 18-26px;
- primary CTA pill;
- minimum touch target 44px;
- section rhythm 12-24px.

## 6. Asset strategy

Do not flatten the complete screen into one image.

Independent assets:
- official logo;
- male Hero transparent asset;
- female Hero transparent asset;
- supporting banner IP variants;
- category/feature icons;
- product imagery;
- decorative marks.

Runtime DOM text:
- title/copy;
- CTA;
- price;
- order state;
- ETA;
- product name.

Current exact-fidelity blocker:
- the selected Hero uses dynamic poses that do not exist in the current repository stage0 male/female assets.
- exact transparent Hero pose assets must be generated and Owner-approved before final pixel acceptance.

## 7. Responsive acceptance

Required widths:
- 360
- 390
- 412
- 430

Rules:
- no horizontal page scroll;
- Hero preserves character identity and copy readability;
- product list may horizontally scroll;
- CTA remains visible and >=44px;
- bottom nav respects safe area;
- reduced-motion remains usable.

## 8. Visual acceptance

Use one deterministic browser environment.

Critical regions:
- header;
- Hero;
- quick cards;
- categories;
- product section;
- member/reorder/services;
- bottom nav.

Final target after exact asset pack:
- critical-region pixel diff ratio <= 3%;
- full-page pixel diff ratio <= 5%;
- major block geometry tolerance <= 4px at baseline viewport;
- no unintended text wrapping;
- no placeholder icon or fake product truth in production candidate.

## 9. Definition of done

Not done:
- screenshot only;
- static HTML only;
- one viewport only;
- flattened full-screen image;
- fixture data mistaken as truth.

Done:
- React implementation renders;
- actions are real callbacks;
- responsive baselines pass;
- screenshot diff evidence exists;
- official logo/IP fidelity passes Owner review;
- canonical data boundaries remain unchanged;
- V3 remains isolated until later explicit promotion/cutover authority.
