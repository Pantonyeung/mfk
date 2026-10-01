# MFK Customer V3｜Long Home R1

Status: isolated preview only. Zero production routing.

## Owner-locked target

Long-scroll homepage selected on 2026-10-01 after filtering the previous #2 and #3 directions.

## Commands

```bash
npm install
npm run typecheck
npm run build
npx playwright install chromium
npm run test:visual
```

## Authority boundary

This package is presentation only.

It must not create:
- Order authority;
- Pricing authority;
- Sellability authority;
- Payment authority;
- Fulfillment authority.

Preview data in `src/preview-fixture.ts` is explicitly non-authoritative and must be replaced by approved Customer read-model adapters before any production proposal.

## Visual acceptance loop

1. Render exact viewport.
2. Compare with baseline screenshot.
3. Fix the largest visual delta only.
4. Repeat until region/full-page thresholds pass.
5. Repeat at 360 / 390 / 412 / 430 widths.

## Asset audit

Uploaded Master Packs contain Owner-confirmed:
- HERO-M-DEFAULT / stage1-hero-male-v1.png
- HERO-F-DEFAULT / stage1-hero-female-v1.png

The original five Hero assets remain in private R2. The approved rotating Q-art scenes use four transparent WebP slots under `asset-sources/hero-carousel/`; their stable R2 names and checksums are recorded in the local manifest.

## Updating Hero artwork

Replace a WebP while keeping its `home-hero-01.webp` to `home-hero-04.webp` slot name, update the media manifest checksum, then run the Customer V3 workflow. No React path change is required.

## Promotion

Draft PR only. No merge/deploy/cutover without explicit Owner PROMOTE.
