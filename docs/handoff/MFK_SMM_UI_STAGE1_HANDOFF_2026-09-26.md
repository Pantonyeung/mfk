# MFK SMM Final UI｜Stage 1 點單 UI Handoff｜2026-09-26

## OWNER LOCK APPLIED

1. Stage 0 acceptance / local UI review can bypass Internet / LAN authorisation.
2. Bypass is constrained to:
   - `smm-acceptance-*` hostname
   - localhost / 127.0.0.1
   - explicit `?ui-bypass=1`
3. Production-default auth / Store Kernel authority was not removed.
4. All IP / mascot production work is PAUSED.
5. Previously generated Stage 0 IP illustration assets were removed from active production assets.
6. Future graphics / icons / banners must be discrete asset files placed into defined slots; no fake branded imagery from CSS-circle assembly or reference-IP crop.
7. Product images stay empty until official product photography exists.

## STAGE 1 IMPLEMENTED

Stage 1 = 點單。

Implemented:
- official More Fun logo in top bar;
- blue / white Stage 1 order visual layer;
- search;
- category rail;
- 2-column product grid;
- 1-column fallback at <=360px;
- blank product-media slot instead of fake product artwork;
- sold-out presentation;
- service-mode label;
- cart summary bar;
- text-only bottom navigation while icon assets are pending;
- no IP / mascot on Stage 1;
- no fake product / price / menu truth.

## ASSET POLICY

`v2smm/public/brand/stage1/asset-slots.json`

Locked:
- IP production = PAUSED
- generated characters = DO_NOT_CREATE
- product photography = OFFICIAL_ONLY
- future banner / empty-state / nav icon assets = PENDING_FUTURE_AI_ASSET
- each future visual = discrete asset file

## CHANGED / ADDED

- `v2smm/src/StageZero.tsx`
- `v2smm/src/stage0.css`
- `v2smm/src/App.tsx`
- `v2smm/src/stage1.css`
- `v2smm/public/brand/stage1/asset-slots.json`
- `v2smm/test/stage0-ui.test.mjs`
- `v2smm/test/stage1-ui.test.mjs`

Removed:
- `v2smm/public/brand/stage0/splash-male.svg`
- `v2smm/public/brand/stage0/login-female.svg`
- `v2smm/public/brand/stage0/connecting-male.svg`
- `v2smm/public/brand/stage0/recovery-female.svg`
- Stage 0 IP provenance file tied to those paused assets.

## PROOF BEFORE HANDOFF DOC COMMIT

Candidate:
`a344fc783aa8238dc5744d7d0a502e889e5d8ad7`

Fresh main:
`46f15641de536c988e496987f6504e8efa6d096c`

Compare:
- behind = 0

Smoke:
`36249725903` SUCCESS

Tests:
- 38 PASS
- 0 FAIL

Build:
- TypeScript PASS
- Vite PASS
- Vite build 116ms

## AUTHORITY

AUTHORITY_CHANGE = NONE

Untouched:
- Store Kernel
- SMM → SMT formal submit authority
- Pricing
- Payment
- Print
- Dining authority
- Customer / Admin / Keeta seams

## STOP

Stage 1 implementation complete.
Do not start Stage 2 before Commander / Owner acceptance.
No main merge.
No production deployment.

MILESTONE:
`MFK_SMM_FINAL_UI_STAGE1_ORDER_UI_READY_FOR_ACCEPTANCE`
