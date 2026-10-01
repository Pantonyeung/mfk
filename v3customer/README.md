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

These approved identities should be imported into the V3 asset pack before final pixel acceptance. Do not regenerate identity unless Owner requests a new pose.

## Current limitation

The preview currently references existing repository web assets so the React shell can be reviewed immediately. Final >95% perceived fidelity remains blocked until the approved Master Pack Hero assets and locked long-page baseline are available inside the repository acceptance bundle.

## Promotion

Draft PR only. No merge/deploy/cutover without explicit Owner PROMOTE.
