# Customer Stage 1 — Asset Slot Contract R2

WORK_ID: MFK-CUSTOMER-UI1-HOME-R1
STATUS: UI LEAD TAKEOVER / ASSET-SLOT-FIRST
BASELINE: 390 CSS px
RULE: skeleton first → measure slot → generate exact asset → wire as replaceable asset. Never generate a full-page flattened mockup.

## 1. Core rule

Every visual asset must belong to a named slot with:
- CSS slot size
- source pixel size
- aspect ratio
- background / transparency contract
- safe area / anchor
- male/female replacement rule
- fallback
- no embedded runtime copy / price / logo unless the slot explicitly owns it

Stage 1 must not use one flattened Hero JPG containing IP + food + text as the long-term implementation.

## 2. Stage 1 page geometry

Design tokens:
- mobile baseline width: 390 CSS px
- page padding: 16 px
- content width: 358 CSS px
- warm background: #F7F1E9
- surface: #FFFDFC
- navy: #15396B
- orange: #F07F24

Responsive content width:
- 360 viewport → 336 CSS px
- 390 viewport → 358 CSS px
- 412 viewport → 380 CSS px

## 3. Hero skeleton

Target hero aspect: 16:9.

Baseline 390:
- HERO_FRAME: 358 × 202 CSS px
- radius: 24 CSS px
- overflow: hidden

Responsive:
- 360 → 336 × 189 CSS px
- 390 → 358 × 202 CSS px
- 412 → 380 × 214 CSS px

Hero is layered:

### HERO_BG
Purpose: warm paper / lifestyle background only.
- CSS slot: full HERO_FRAME
- source: 1074 × 606 px (@3x baseline)
- aspect: 16:9
- background family: warm rice paper / cream, close to #F7F1E9
- allowed: subtle texture, soft light, very light navy/orange botanical/brush accents
- forbidden: people, IP, food, logo, words, price, fake product facts

### HERO_IP
Purpose: replaceable character layer.
- baseline CSS visual box: 140 × 166 px
- anchor: right 4 px; bottom 0
- source canvas: 420 × 498 px transparent PNG/WebP (@3x)
- transparent background required
- male and female MUST use the exact same canvas, eye-line and baseline
- male accent: #2467B2
- female accent: #8659B5
- no text / logo / food inside this asset
- swap must require source change only; no layout change

Files:
- stage1-hero-ip-male-r2.webp
- stage1-hero-ip-female-r2.webp

### HERO_FOOD
Purpose: replaceable food / bowl layer.
- baseline CSS visual box: 154 × 94 px
- anchor: right 84 px; bottom -4 px
- source canvas: 462 × 282 px transparent WebP (@3x)
- transparent background required
- one bowl / one food composition only
- no logo / words / price / UI
- food layer may overlap IP slightly but must not cover face/eyes

File:
- stage1-hero-food-rice-bowl-r2.webp

### HERO_COPY_SAFE_AREA
Not an image.
- left safe zone: x 18–154 CSS px
- y 20–176 CSS px
- runtime HTML copy only
- generated art must not occupy this zone with high-contrast detail

## 4. Other Stage 1 assets

### Header Logo
Use canonical logo asset only.
- rendered slot: 68 × 42 CSS px at 390
- no generated replacement

### Announcement
No generated image required.
Use CSS/vector mark only.

### Quick Entries
記憶券 / 常購清單 / 期間限定
- no raster generated art required in R2
- use replaceable vector/CSS icon slot: 38 × 38 CSS px
- keeps labels canonical and avoids fake visual content

### Top 6
Product images are runtime/Admin projection.
- do NOT generate fake product images as fallback
- card image slot: dynamic product image
- missing image uses neutral brand placeholder only

### Active Order
No decorative generated asset.
Canonical order information has visual priority.

## 5. State-specific asset behavior

NORMAL / RETURNING / ACTIVE ORDER / CLOSED / CAMPAIGN:
- same hero skeleton
- character variant may swap male/female
- UI state must not require a new flattened hero

LOADING / EMPTY / STALE / OFFLINE / ERROR:
- never generate separate state images
- keep state meaning in UI components
- hero can desaturate / reduce opacity by CSS only when needed

## 6. Replacement API

Stage 1 hero should resolve assets independently:

- background
- ipMale
- ipFemale
- food

The component must be able to swap one asset without regenerating the whole card.

Suggested asset contract:

stage1HeroAssets = {
  background,
  maleIp,
  femaleIp,
  food
}

Variant changes only:
- character source
- decorative accent

Never change:
- dimensions
- layout
- interaction
- store/order truth

## 7. Acceptance

Before Owner visual review:
- exact slot dimensions visible in CSS / asset contract
- male/female assets same canvas and anchor
- no embedded text in generated images
- no fake pricing / product data
- 360 / 390 / 412 screenshots
- replacement test proves male ↔ female requires source swap only
- hero asset can be replaced without touching Stage1Home layout
