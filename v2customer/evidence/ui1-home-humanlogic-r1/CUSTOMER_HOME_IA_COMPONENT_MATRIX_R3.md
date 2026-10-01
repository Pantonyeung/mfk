# MFK Customer Home｜Information Architecture + Component Matrix R3

Date: 2026-10-01  
Scope: Customer UI1 Home only  
Status: RESEARCH-DERIVED PRODUCT / UI SPEC — OWNER REVIEW REQUIRED  
Runtime implementation: HOLD until this document is confirmed

---

# 1. Research Basis

This R3 Home architecture is derived from the reference sources explicitly selected by Owner:

- Component Gallery
- AppShot Gallery
- Minimal Gallery
- Navbar Gallery
- CTA Gallery
- UI2V
- yihui-dev/awesome-opus5-5-videos

Research interpretation:

1. Food ordering is primarily a commerce / transaction surface, not a brand landing page.
2. Brand warmth stays, but does not consume the whole first viewport.
3. Search / category / product discovery must appear early.
4. Product imagery, product name, price and availability carry more weight than decorative cards.
5. Common interaction patterns should use familiar mobile conventions.
6. Motion comes after hierarchy and interaction are stable.
7. "Premium" means disciplined hierarchy, spacing, photography and component consistency — not simply more whitespace.

---

# 2. Source → Product Decision Matrix

| Source | Observed value | MFK decision |
|---|---|---|
| Component Gallery | Search, Navigation, Stepper, Radio, Segmented Control are mature reusable patterns | Use standard mobile interaction conventions; do not invent interaction grammar |
| AppShot Food & Drink | Real mobile products are content / discovery / commerce dense rather than poster-like | Home must expose food discovery and transaction context early |
| Minimal Gallery Food & Drink | Food examples are repeatedly classified as Product / E-commerce / Food & Drink | Premium brand expression must coexist with commerce hierarchy |
| Navbar Gallery | Search Bar / Sticky / Announcement are independent navigation patterns | Compact header + direct Search + slim factual announcement |
| CTA Gallery | Food example Eatkernel is Call-to-Buy / Ecommerce | Primary actions use direct transaction verbs |
| UI2V | Preview/install/remix motion packages after composition exists | Motion is a finishing layer, not a substitute for IA |
| Opus 5.5 prompt corpus | Strong examples specify rendering rules and quality bars explicitly | Every UI stage gets measurable layout / motion / quality constraints |

---

# 3. Home Job

Customer Home has four jobs, in this order:

1. Resume a current order if one exists.
2. Start food discovery immediately.
3. Preserve MFK warmth / personality.
4. Surface useful shortcuts without competing with products.

Home is NOT:
- a poster
- a tutorial
- a full campaign page
- a dashboard with many equal cards

---

# 4. Locked Information Hierarchy

## 4.1 With Active Order

```
A. Compact Header
B. Active Order
C. Welcome + Search
D. Quick Access
E. Category Rail
F. Product Feed
G. Campaign / Brand Story insertion
H. Bottom Navigation
```

## 4.2 Without Active Order

```
A. Compact Header
B. Welcome + Search
C. Quick Access
D. Category Rail
E. Product Feed
F. Campaign / Brand Story insertion
G. Bottom Navigation
```

Important change from R2:

**The large Hero is no longer permanently placed before products.**

Campaign / IP Hero becomes an insertion block after product discovery has already begun, unless a real campaign has an explicit business priority.

---

# 5. First Viewport Budget

Baseline review width: 390px  
Mandatory widths: 360 / 390 / 412

Approximate vertical budget excluding browser chrome:

| Block | Target height |
|---|---:|
| Header | 60–68 |
| Active Order, conditional | 72–84 |
| Welcome | 48–64 |
| Search | 52–56 |
| Quick Access | 72–84 |
| Category Rail | 40–44 |
| Section heading | 36–42 |
| Bottom Nav | 62–68 + safe area |

Target result:

- Without active order: first product imagery should begin around 330–390px from app content top.
- With active order: first product imagery should still begin around 410–480px.
- A large decorative Hero must not push all food products below the first viewport.

---

# 6. Component Matrix

| Component | Priority | 390 spec | State | Data source | Action |
|---|---:|---|---|---|---|
| Compact Header | P0 | 60–68h | READY / CLOSED / UPDATING | snapshot.store | none / store context |
| Active Order | P0 conditional | 72–84h | canonical order stages | activeOrders | Orders |
| Welcome | P1 | 48–64h | NORMAL / RETURNING / CLOSED | local presentation + store state | none |
| Search | P0 | 52–56h | normal / loading | menu readiness | Browse/Search |
| Quick Access | P1 | 3 cards, 72–84h | available / empty | device favorite / member coupon / campaign category | direct route |
| Category Rail | P0 | 40–44h | selected / unselected | menu.categories | filter Browse |
| Product Grid | P0 | 2 columns | available / sold out / loading | menu.products | Product Sheet |
| Campaign Insert | P2 conditional | 136–160h | active only | official campaign / brand content | campaign / browse |
| Announcement | P2 conditional | 34–40h | active only | store.notice | optional link |
| Bottom Nav | P0 | 62–68h | active / badge | app navigation / counts | direct route |

---

# 7. Header

Purpose:
- brand identity
- location/store context
- business status

390 target:
- horizontal padding: 16
- logo visual width: 76–88
- store/context pill: max 150
- no large floating card
- no notification bell unless there is a real notification capability

Visible:
```
[Logo]                         [元朗店 · 營業中]
```

Do not show:
- duplicate "磨飯" title next to official logo
- long status explanation
- decorative dropdown unless store switching really exists

---

# 8. Active Order

Condition:
Only when a real current order exists.

Default:
```
製作中                          12:35
#A123                              >
```

READY:
```
可以取餐
取餐碼 0387                       >
```

Rules:
- one primary state label
- canonical ETA only
- pickup code only when relevant
- entire row is tappable
- no progress essay
- no motivational paragraph here

Visual:
- 16–18 radius
- subtle semantic accent
- not a giant illustration card

---

# 9. Welcome

Brand warmth stays.

Target:
- one greeting
- one short supporting line
- no CTA
- no instructional meaning
- no huge IP composition

Example:
```
早安，今天想食咩？
一碗好飯，讓日常更有味。
```

Typography target:
- H1: 24–28px
- support: 12–14px
- width: 65–75% if a small brand accent is used

IP rule:
- Welcome is text-first.
- IP is not required here.
- Avoid repeating the same mascot in Welcome + Hero + Empty + Product areas.

---

# 10. Search

Research basis:
Search is a mature independent component and should be immediately recognizable.

Target:
- 52–56h
- 16–18 radius
- search icon
- literal placeholder
- full-width
- no helper copy

```
[ 🔍 搜尋餐點 ]
```

Behavior:
- tap opens Browse with search focused
- must remain usable while menu refresh is in progress
- if offline with cached menu, search cached menu

---

# 11. Quick Access

Owner-locked:
- 我的收藏
- 回憶券
- 期間限定

Purpose:
High-frequency shortcuts, not promotional feature cards.

390 layout:
- 3 equal columns
- gap 8
- card width ~108–112
- 72–84h
- icon 24–28
- title 12–13
- secondary line 9–11

Rules:
- compact
- no giant illustration
- no paragraph
- one recognizable icon
- one tap = destination

Semantics:
- 我的收藏: device-persisted Favorites V1; not Member/server truth
- 回憶券: member coupon projection
- 期間限定: official campaign/category source; if no active campaign, show factual empty/availability state, do not invent campaign truth

---

# 12. Category Rail

Position:
Immediately before Product Feed.

Pattern:
horizontal scroll chips.

Target:
- chip height 40–44
- selected = filled / stronger contrast
- unselected = low-emphasis surface
- 8px gap

Default first option:
- `推薦`
- do not use `人氣` unless popularity authority exists

Then official menu categories.

---

# 13. Product Feed

This is the visual centre of the Home.

390 grid:
- content width ~358
- two columns
- gap 10–12
- card width ~173–174

Card:
- radius 18–22
- image ratio ~4:3
- image height ~128–134
- copy zone 64–82

Visible information:
```
[ official food image ]

Badge, only if official
商品名
HK$68
♡
```

Rules:
- product image must come from Admin/runtime imageUrl
- no generic bowl/salad/riceball fallback
- no fake "人氣精選"
- no fake "新上市"
- sold-out remains visible but clearly unavailable
- card body opens Product Sheet
- Favorite is a separate familiar action

Loading:
- preserve exact card geometry with skeleton
- never replace products with a huge empty blank area

---

# 14. Campaign / Brand Insert

Important:
Campaign is no longer the main fixed Home Hero.

Default placement:
after first 2–4 product cards.

Target:
- 136–160h
- one short headline
- one image / IP composition
- optional one action
- no baked-in UI screenshot
- no fake products / prices

Examples of valid use:
- seasonal menu
- limited campaign
- brand story
- member event

If no real campaign:
**do not render the block.**

---

# 15. Announcement

Only for factual store notice / promotion.

Target:
- 34–40h
- one line
- optional icon
- optional one link

Not:
- another card with heading + paragraph
- permanently visible placeholder notice

---

# 16. Bottom Navigation

Locked destinations:
- 首頁
- 點單
- 記憶罐
- 訂單
- 會員

R3 rule:
- flat five-item mobile nav
- no oversized center FAB
- icon 22–24
- label 10–11
- active state obvious by colour / fill
- factual badge only

Height:
62–68 + safe area

---

# 17. Visual System

## Colour
Base:
- warm rice white / cream
- deep MFK navy
- restrained orange accent
- purple used only where brand / member semantics need it

Rule:
Do not make every card a different pastel colour.

## Radius
Use only 3 levels:
- 12: chips / small controls
- 18: cards / search
- 24: campaign / major surface

## Shadow
Use two levels:
- none / border for high-frequency UI
- soft shadow only for major raised surfaces

## Typography
Three primary weights:
- Display / section: bold
- UI label: semibold
- metadata: regular

Avoid oversized display text that pushes food content down.

---

# 18. IP Usage

IP is a brand asset, not a substitute for product photography.

Recommended Home usage:
- zero or one main IP appearance in normal Home
- Active Order can use state IP only if it improves recognition
- Campaign can use one accepted IP composition
- Empty / Recovery states can use corresponding accepted assets

Do not:
- repeat same IP twice above the fold
- crop character sheets into production art
- use a full design-board screenshot as an asset

---

# 19. Motion

Motion only after static Home passes Owner review.

Allowed:
- search / sheet transition
- category chip transition
- favorite feedback
- add-to-cart continuity
- active-order state transition
- campaign carousel only if there are real multiple campaigns

Duration:
- micro: 120–180ms
- surface: 180–240ms
- state emphasis: <=320ms

Respect reduced motion.

No:
- infinite mascot floating
- blinking
- decorative motion that delays ordering

---

# 20. Human Logic Gate

A Home implementation passes only when:

- user immediately sees where to search food
- category selection is obvious
- product cards look tappable
- product price is visually associated with product
- favorites look like favorites
- shortcuts are recognizable without explanatory text
- Active Order communicates state without paragraphs
- bottom navigation is conventional and obvious

Remove all helper paragraphs and repeat the test.

---

# 21. First Viewport Acceptance

## 360
- no horizontal body overflow
- 3 quick entries remain readable
- first Product section starts within practical first viewport
- product columns do not collapse unless required

## 390
Primary acceptance baseline.

Expected sequence:
```
Header
[Active Order if any]
Welcome
Search
Quick Access
Category Rail
今日精選
first product row starts
```

## 412
- hierarchy remains the same
- do not simply enlarge everything
- use extra width to improve breathing room / product image width

---

# 22. Data Truth Matrix

| UI value | Authority |
|---|---|
| Store name / status / hours | snapshot.store |
| Active order state | activeOrders canonical projection |
| ETA | canonical order/store projection only |
| Pickup code | canonical order only |
| Search text | browser UI state |
| Favorites V1 | device-persisted app state |
| Coupon count | member projection |
| Limited campaign | official category / campaign source |
| Categories | menu.categories |
| Product name | menu.products |
| Product price | published runtime menu / quote |
| Product image | Admin/runtime imageUrl |
| Product availability | published runtime menu |
| Announcement | store.notice |
| Cart badge | local cart intent |
| Order badge | canonical current order count |

---

# 23. Explicitly Rejected Patterns

Reject:
- poster-like Home where a large Hero occupies most of the first viewport
- Welcome + Hero both showing the same mascot
- five unrelated pastel card styles
- full-screen mockup image pasted into production UI
- fake food imagery
- fake popularity / featured semantics
- helper copy explaining obvious buttons
- huge empty area while menu is loading
- oversized centre Bottom Nav FAB

---

# 24. Implementation Gate

Current:
**R3 IA / COMPONENT MATRIX READY FOR OWNER REVIEW**

Runtime UI remains:
**PR #609 DRAFT / HOLD**

After Owner confirms this R3 matrix:
1. reset UI1 implementation against this architecture
2. produce 360 / 390 / 412 public-stage screenshots
3. Owner visual review
4. only then consider Stage 1 merge
