# MFK Customer V3 Long Home｜Visual PRD R1

Date: 2026-10-01  
Status: OWNER VISUAL DIRECTION LOCKED / IMPLEMENTATION TARGET  
Capability: CUSTOMER_V3_LONG_HOME_UI_R1  
Execution mode: isolated V3 preview, zero production routing.

## 0. Source lineage

This V3 Visual PRD is based on:
- Owner-locked 2026-10-01 long-scroll homepage image;
- earlier selected concept directions #2 and #3;
- MFK Customer UI Component Spec V1 (2026-09-26);
- MFK Customer UI Frontend Handoff V1 (2026-09-26);
- MFK Customer Design Tokens V1 (2026-09-26);
- Owner-confirmed Male/Female IP Master Packs (2026-09-30).

Where the new Owner-locked visual direction conflicts with the older UI spec, this document records the visual override explicitly instead of silently mixing the two.

## 1. Owner-locked design direction

Locked:
- long vertically scrollable homepage; not restricted to one viewport;
- large visual-first dual-IP Hero;
- male IP visually dominant in the foreground, female IP supporting;
- strong primary CTA;
- blue / navy / purple / cream visual family;
- premium rounded cards, soft shadows, clear vertical rhythm;
- rich below-the-fold content;
- simple bottom navigation.

### Explicit visual overrides versus 2026-09-26 UI spec

1. Older Component Spec fixed 5 bottom-nav items:
   首頁｜點單｜記憶罐｜訂單｜會員

   New Owner-locked visual target shows 4:
   首頁｜菜單｜訂單｜我的

   V3 preview follows the new four-item visual target.
   This does NOT delete Memory Jar / member capabilities; they must remain reachable through the approved route/interaction model before production cutover.

2. Older Design Tokens used Brand Orange as the primary CTA emphasis.
   New Owner-locked homepage uses a blue-purple Hero CTA.
   V3 homepage may use the blue-purple Hero CTA as an explicit homepage visual override.
   Transactional/semantic colors remain separate.

## 2. Why a PRD helps — and why PRD alone is not enough

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
3. exact approved assets;
4. component map;
5. deterministic screenshot-diff evidence.

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
- current price;
- availability;
- member/reward state;
- recent order;
- active order/ETA if shown.

UI must not create a second Order, Pricing, Sellability, Payment or Fulfillment authority.

Preview fixtures are permitted only in isolated visual acceptance and must be explicitly non-authoritative.

## 5. Visual tokens

### Canonical base tokens from MFK Customer Design Tokens V1
- brand navy #15396B
- brand orange #F07F24
- warm background #F7F1E9
- surface #FFFDFC
- male IP accent #2467B2
- female IP accent #8659B5
- text primary #253346
- text muted #7B8490
- border #E6DED5
- touch minimum 44px
- content max width 480px
- mobile baseline width 390px
- radius md 18px / lg 24px / xl 32px
- card shadow 0 6px 18px rgba(37,51,70,0.08)

### Owner-locked homepage visual override
- Hero/marketing blue may extend brighter than canonical maleBlue;
- Hero CTA may use blue-purple gradient;
- purple remains decorative/IP accent, not semantic state;
- body/transaction text must continue using readable system UI typography.

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

### Fresh asset audit

The uploaded 2026-09-30 Master Packs already contain Owner-confirmed transparent Hero assets:

Male:
- ASSET_ID: HERO-M-DEFAULT
- FILE: stage1-hero-male-v1.png
- 1086 × 1448 RGBA
- STATUS: OWNER_CONFIRMED
- SHA256: 6b9e3b1da901645e6b34936fef3da2716073f6fd7840042917fd32e2d286a481

Female:
- ASSET_ID: HERO-F-DEFAULT
- FILE: stage1-hero-female-v1.png
- 1086 × 1448 RGBA
- STATUS: OWNER_CONFIRMED
- SHA256: 03996829f96438f800a69b35285b90fcc98d614762e22df3167f68b2c2b7e0f9

Therefore identity regeneration is NOT the default next step.
Implementation should import these Owner-confirmed assets first and only generate a new pose if Owner later requests it.

Current repository gap:
- the approved Master Pack assets are available in the supplied asset packs but are not yet stored inside the V3 repository acceptance bundle.

## 7. Component/interaction rules inherited from source UI spec

- Product price is projection only.
- Sold-out truth is read only.
- Recommendation failure must not block ordering.
- Touch targets >= 44px.
- Status must not rely on color alone.
- Reduced Motion supported.
- Generic spinner must not replace LOADING / EMPTY / ERROR / OFFLINE / STALE / UNKNOWN distinctions.
- AI mockup text/prices/addresses must never become canonical data.

## 8. Responsive acceptance

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

## 9. Visual acceptance

Use one deterministic browser environment.

Critical regions:
- header;
- Hero;
- quick cards;
- categories;
- product section;
- member/reorder/services;
- bottom nav.

Final target after approved assets are inside the repo:
- critical-region pixel diff ratio <= 3%;
- full-page pixel diff ratio <= 5%;
- major block geometry tolerance <= 4px at baseline viewport;
- no unintended text wrapping;
- no placeholder icon or fake product truth in production candidate.

Playwright acceptance has been scaffolded at:
- 360×800
- 390×844
- 412×915
- 430×932

## 10. Definition of done

Not done:
- screenshot only;
- static HTML only;
- one viewport only;
- flattened full-screen image;
- fixture data mistaken as truth.

Done:
- React implementation renders;
- actions are real callbacks;
- typecheck/build GREEN;
- responsive visual baselines pass;
- screenshot diff evidence exists;
- official logo/IP fidelity passes Owner review;
- canonical data boundaries remain unchanged;
- V3 remains isolated until later explicit promotion/cutover authority.
