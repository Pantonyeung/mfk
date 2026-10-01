# MFK Customer V3 Long Home｜R3 Hero Background Completion

Date: 2026-10-01
Status: R3 GREEN / REAL BACKGROUND PLATE LANDED
Candidate: Draft PR #619

## Owner feedback addressed

R2 still lacked the environmental world visible in the locked reference:
- cream/white castle and arches;
- green floating leaves;
- soft white cloud/bokeh atmosphere;
- stepped foreground depth.

## R3 correction

The Hero now uses a real generated background image asset created with ChatGPT's built-in image generation, not a third-party generation plugin and not CSS-only fake architecture.

Repository asset:
- `v3customer/public/brand/r3/hero-world-bg-r3.webp`

Source:
- ChatGPT built-in image generation
- generated from the approved visual direction as a background-only scene
- no mascots
- no logo
- no UI
- no button
- no runtime text
- no OS chrome

Runtime composition:
1. real background plate;
2. male transparent Hero asset;
3. female transparent Hero asset;
4. separate decorative doodles;
5. real DOM headline/body;
6. real React CTA.

## Why this is correct

The background can be independently cropped and tuned while:
- characters stay independently positioned;
- CTA remains clickable;
- typography remains real DOM;
- responsive layout remains controllable;
- no full-screen screenshot is used as live UI.

## Verification

R3 code commits:
- background asset commit: `a9f91137be11bac997b27bf9aa364d1ec2f1663a`
- real background wiring: `727b2a4115a9d7294d4ab47ef830dcd5d6accde1`
- CSS composition: `e39223c18bf59a09f3b5f67bcb5e80567fdfe3f0`

CI:
- v3customer-ci run 36840457953 = SUCCESS
- Regression Shadow run 36840458180 = SUCCESS

No:
- v2customer change;
- transaction authority change;
- production route/cutover.

## Next visual gate

1. capture 390px Hero candidate;
2. compare against locked reference;
3. adjust background crop/object-position;
4. adjust male/female scale and overlap;
5. adjust Hero copy width/vertical rhythm;
6. then repeat at 360/412/430.

MILESTONE: MFK_CUSTOMER_V3_LONG_HOME_R3_REAL_BACKGROUND_GREEN
