# Customer Stage 1 — Skeleton → Asset Workflow R2

WORK_ID: MFK-CUSTOMER-UI1-HOME-R1
STATUS: UI LEAD TAKEOVER / SKELETON-FIRST
OWNER RULE: UI skeleton and visual assets are two separate work phases.

## 0. Hard rule

Do NOT:
- generate a finished Stage 1 effect image first;
- generate Hero/IP/food/icon assets before the real skeleton exists;
- choose source pixel dimensions by guess;
- flatten background + IP + food + text into one final image;
- use generated art to decide the layout.

Correct order:

1. implement Stage 1 skeleton;
2. render at required viewports;
3. measure every real visual slot;
4. freeze slot geometry;
5. produce an Asset Matrix from the measured skeleton;
6. generate / prepare each asset separately;
7. save each asset into the correct asset path;
8. wire assets into their slots;
9. Owner reviews the real implemented UI.

Skeleton approval and Asset production are different gates.

## 1. Phase A — Skeleton implementation

Phase A contains layout only.

Allowed in skeleton:
- structural containers;
- spacing;
- section order;
- typography hierarchy;
- buttons / cards / navigation geometry;
- neutral placeholder blocks for image slots;
- canonical runtime labels where needed to judge layout;
- existing canonical Logo only if required to judge header geometry.

Not allowed in Phase A:
- generated Hero;
- generated male/female IP;
- generated food;
- decorative generated backgrounds;
- final icon artwork;
- fake product photos;
- full-page visual mockup.

The skeleton must first prove the page structure.

## 2. Skeleton sections to implement

Stage 1 must establish these real layout regions before any new art is produced:

- HEADER
  - LOGO_SLOT
  - STORE_CONTEXT
  - STORE_STATUS

- STATE_PANEL_SLOT
  - loading / empty / stale / offline / error

- WELCOME_COPY

- SEARCH_ENTRY

- ACTIVE_ORDER_SLOT
  - visible only when applicable
  - read-only existing handler / truth

- HERO_FRAME
  - HERO_BG_SLOT
  - HERO_IP_SLOT
  - HERO_FOOD_SLOT
  - HERO_COPY_SAFE_AREA

- ANNOUNCEMENT_SLOT

- RETURNING_FREQUENT_SLOT
  - only when applicable
  - existing history / recommendation data only

- CAMPAIGN_SLOT
  - only when applicable

- QUICK_ENTRY_SECTION
  - MEMORY_TICKET_ICON_SLOT
  - FREQUENT_ICON_SLOT
  - LIMITED_ICON_SLOT

- TOP6_SECTION
  - PRODUCT_IMAGE_SLOT
  - PRODUCT_TEXT_SLOT

- MEMORY_STRIP

- FIXED_BOTTOM_NAV
  - Home / Order / Memory Jar / Orders / Member

## 3. Required skeleton viewports

Render and measure skeleton at:

- 360 CSS px
- 390 CSS px baseline
- 412 CSS px

Do not infer dimensions from design art.
Use the implemented DOM/CSS result.

## 4. Phase A output

Before Asset Phase starts, produce:

### A. Skeleton screenshots
- 360
- 390
- 412

Use neutral placeholders with slot names visible where useful.

### B. Geometry report
For every visual slot record:

- SLOT_ID
- parent component
- rendered width CSS px
- rendered height CSS px
- aspect ratio
- x / y position relative to parent
- border radius / clipping
- object-fit expectation
- safe area
- overlap rules
- responsive behavior

### C. Skeleton acceptance status
Owner/UI lead confirms structure before asset work starts.

No image generation starts before this gate.

## 5. Phase B — Asset Matrix

Only after Phase A skeleton is frozen, create the Asset Matrix.

Each visual slot must then define:

- SLOT_ID
- measured CSS size at 360 / 390 / 412
- chosen master source pixel size
- aspect ratio
- file format
- transparent or opaque background
- background colour / texture requirement
- content safe area
- anchor
- replacement semantics
- male / female pairing rule if applicable
- fallback behavior
- final asset path

Source pixel size must be derived from the final measured slot, not guessed before skeleton.

Recommended source scale is decided after measurement based on:
- actual slot size;
- target device density;
- crop behavior;
- performance budget.

## 6. Asset categories

### HERO_BG_SLOT
Separate background asset only.
Must not contain:
- IP;
- food;
- logo;
- runtime text;
- price;
- fake product data.

### HERO_IP_SLOT
Separate character asset.
Male and female must:
- use the same measured slot;
- use the same canvas dimensions;
- share eye-line / baseline / anchor;
- be swappable by source only;
- not force layout changes.

### HERO_FOOD_SLOT
Separate food asset.
Must not contain:
- character;
- text;
- logo;
- UI.

### HERO_COPY_SAFE_AREA
Not an image.
Always runtime HTML/CSS.

### QUICK ENTRY ICON SLOTS
Icons generated/prepared separately after their measured icon boxes are known.
Do not bake label text into icons.

### TOP6 PRODUCT IMAGE SLOT
Uses real runtime/Admin product media.
Do not generate fake product photos as production fallback.

### HEADER LOGO
Uses canonical brand logo only.
Do not regenerate.

## 7. Asset storage rule

Every finished asset gets its own file.

Example naming only after the Asset Matrix is frozen:
- stage1-hero-bg-*.webp
- stage1-hero-ip-male-*.webp
- stage1-hero-ip-female-*.webp
- stage1-hero-food-*.webp
- stage1-icon-memory-ticket-*.svg
- stage1-icon-frequent-*.svg
- stage1-icon-limited-*.svg

No single flattened Stage 1 effect image may become a runtime asset.

## 8. Replacement rule

Every slot must allow asset replacement without changing:
- layout;
- component structure;
- transaction behavior;
- data source;
- route;
- authority.

Male ↔ female replacement must be a source swap only.

Background replacement must be a source swap only.

Food replacement must be a source swap only.

## 9. Current correction

Any dimensions previously written before the real skeleton was frozen are PROVISIONAL ONLY and are not authoritative.

The authoritative Asset Matrix begins only after the Stage 1 skeleton is implemented and measured.

## 10. Acceptance order

GATE A — Skeleton
- real implemented structure;
- 360 / 390 / 412;
- placeholders only;
- geometry report;
- no generated final art.

GATE B — Asset Matrix
- measured slot sizes;
- source dimensions;
- format / transparency / safe areas;
- replacement rules.

GATE C — Asset Production
- generate / prepare one asset at a time;
- save as independent files.

GATE D — Wiring
- place each asset into its own slot;
- verify responsive crop / replacement.

GATE E — Owner Visual Review
- review the real implemented page;
- not a separate effect mockup.

No Merge / Deploy / OTA without explicit Owner CONFIRM / PROMOTE.
