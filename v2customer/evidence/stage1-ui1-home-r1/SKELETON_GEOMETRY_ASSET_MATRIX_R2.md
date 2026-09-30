# Customer Stage 1 — Geometry Report + Asset Matrix R2

WORK_ID: MFK-CUSTOMER-UI1-HOME-R1  
PHASE: Skeleton measured → Asset Matrix  
AUTHORITY: UI Lead takeover  
RULE: dimensions below are derived from the implemented Phase-A CSS skeleton. No full-page effect image is an asset.

## A. Page geometry

| Viewport | Content padding | Content width |
|---:|---:|---:|
| 360 | 12px × 2 | 336px |
| 390 | 16px × 2 | 358px |
| 412 | 16px × 2 | 380px |

Global `box-sizing:border-box` is confirmed in `v2customer/src/styles.css`.

## B. Measured visual slots

### Header

| Slot | 360 | 390 | 412 | Asset rule |
|---|---:|---:|---:|---|
| LOGO_SLOT | 60×38 | 64×38 | 64×38 | canonical Logo only; no generation |

### Hero frame

The implemented frame is `width:100%; aspect-ratio:16/9; border:1px`.

| Slot | 360 | 390 | 412 | Notes |
|---|---:|---:|---:|---|
| HERO_FRAME border-box | 336×189 | 358×201.38 | 380×213.75 | layout only |
| HERO_BG_SLOT inner | 334×187 | 356×199.38 | 378×211.75 | background layer |
| HERO_IP_SLOT | 113.56×134.64 | 121.04×143.55 | 128.52×152.46 | 34% width / 72% height of hero inner box |
| HERO_FOOD_SLOT | 113.56×71.06 | 121.04×75.76 | 128.52×80.47 | 34% width / 38% height |
| HERO_COPY_SAFE_AREA width | 143.62 | 149.52 | 158.76 | HTML text only; no raster text |

Anchor rules currently implemented:
- IP: right 4%, bottom 7%.
- Food: right 31%, bottom 7%.
- Copy: left 14px @360, 16px otherwise; top 14px @360, 16px otherwise.

### Other image / icon slots

| Slot | 360 | 390 | 412 | Production source |
|---|---:|---:|---:|---|
| ANNOUNCEMENT_ICON_SLOT | 38×38 | 38×38 | 38×38 | SVG/icon asset |
| MEMORY_TICKET_ICON_SLOT | 36×36 | 36×36 | 36×36 | SVG/icon asset |
| FREQUENT_ICON_SLOT | 36×36 | 36×36 | 36×36 | SVG/icon asset |
| LIMITED_ICON_SLOT | 36×36 | 36×36 | 36×36 | SVG/icon asset |
| CAMPAIGN_ICON_SLOT | 48×48 | 48×48 | 48×48 | SVG/icon asset |
| CLOSED_STATE_ICON_SLOT | 44×44 | 44×44 | 44×44 | SVG/icon asset |
| FREQUENT_PRODUCT_IMAGE_SLOT | 79.5×79.5 | 83.5×83.5 | 89×89 | runtime/Admin product media; do not generate fake product |
| TOP6_PRODUCT_IMAGE_SLOT | 162×96 | 172×104 | 183×110 | runtime/Admin product media; do not generate fake product |

## C. Asset Matrix — source dimensions

The source dimensions below are chosen only after the skeleton geometry above was frozen.

### 1. HERO_BG

- Runtime max slot: 378×211.75 CSS px.
- Master source: **1200×675 px**, opaque WebP.
- Ratio: 16:9.
- Background: warm rice-paper / cream, visually close to `#F7F1E9`.
- Composition: subtle natural paper texture; very light navy botanical/leaf accents and restrained orange brush accents around outer/right edges.
- Left 45% must remain low-contrast because runtime HTML copy sits there.
- Forbidden: IP, person, food, Logo, wording, price, product facts, UI controls.
- Proposed path: `v2customer/public/brand/stage1/stage1-hero-bg-r2.webp`.

### 2. HERO_IP_MALE / HERO_IP_FEMALE

- Runtime max slot: 128.52×152.46 CSS px.
- Shared master canvas: **432×512 px**, transparent WebP.
- Canvas ratio: 0.84375, matching the implemented IP slot closely.
- Male and female MUST share:
  - same canvas;
  - same scale;
  - same eye-line;
  - same baseline;
  - same anchor;
  - same transparent margins.
- Only character source / decorative accent may differ.
- No food, Logo, text or background baked into either file.
- Proposed paths:
  - `v2customer/public/brand/stage1/stage1-hero-ip-male-r2.webp`
  - `v2customer/public/brand/stage1/stage1-hero-ip-female-r2.webp`

### 3. HERO_FOOD

- Runtime max slot: 128.52×80.47 CSS px.
- Master source: **480×300 px**, transparent WebP.
- Ratio: 1.6.
- One bowl / one food grouping only.
- No character, Logo, wording, price, table/background.
- Proposed path: `v2customer/public/brand/stage1/stage1-hero-food-r2.webp`.

### 4. UI icon assets

Preferred format: SVG, one file per icon. No label text inside the SVG.

| Asset | Runtime slot | Proposed path |
|---|---:|---|
| Announcement | 38×38 | `stage1-icon-announcement-r2.svg` |
| 記憶券 | 36×36 | `stage1-icon-memory-ticket-r2.svg` |
| 常購清單 | 36×36 | `stage1-icon-frequent-r2.svg` |
| 期間限定 | 36×36 | `stage1-icon-limited-r2.svg` |
| Campaign | 48×48 | `stage1-icon-campaign-r2.svg` |
| Closed state | 44×44 | `stage1-icon-closed-r2.svg` |

Suggested directory:
`v2customer/public/brand/stage1/`

## D. Not generated

These remain data-driven and are NOT image-generation tasks:
- Header Logo.
- Top 6 product photos.
- Frequent product photos.
- Runtime copy.
- Price.
- Store status.
- Active-order facts.
- Announcement copy.

## E. Production order

Do not generate everything together.

1. HERO_BG only.
2. HERO_IP_MALE only.
3. HERO_IP_FEMALE only, on exact same 432×512 canvas.
4. HERO_FOOD only.
5. Announcement icon.
6. 記憶券 icon.
7. 常購清單 icon.
8. 期間限定 icon.
9. Campaign icon.
10. Closed-state icon.

After each file:
- save as independent asset;
- verify its own slot;
- do not change skeleton geometry;
- do not generate a new full-page mockup.

## F. Gate

Skeleton geometry: MEASURED / READY FOR ASSET PRODUCTION.  
Product behavior: NO CHANGE.  
Authority: NO CHANGE.  
Merge / Deploy / OTA: NOT AUTHORIZED.
