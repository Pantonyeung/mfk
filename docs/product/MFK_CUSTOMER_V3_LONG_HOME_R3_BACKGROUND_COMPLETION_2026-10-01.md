# MFK Customer V3 Long Home｜R3 Hero Background Completion

Date: 2026-10-01
Status: R3 ACTIVE
Candidate: Draft PR #619

## Owner feedback addressed

R2 still lacked the environmental world visible in the locked reference:
- cream/white castle and arches;
- green floating leaves;
- soft white bokeh/cloud shapes;
- stepped foreground depth.

R3 adds these as real app layers rather than flattening the whole hero into one screenshot.

## Implementation

Files:
- v3customer/src/App.tsx
- v3customer/src/styles.css

New Hero world layers:
- castle-left
- castle-mid
- castle-right
- arch-back
- arch-front
- step-a / step-b / step-c
- glow-a / glow-b / glow-c
- leaf-1 ... leaf-6

Characters and handwritten decorative copy remain separate assets.
Main headline/body/CTA remain DOM.
No fake OS chrome is rendered.

## Why CSS/world layers

This keeps:
- responsive control;
- z-order control;
- independent character motion/placement;
- real clickable controls;
- no baked UI;
- no bitmap dependency for runtime text.

## Acceptance

R3 first visual gate:
1. background world depth visible at 390px;
2. castle architecture remains behind characters;
3. leaves appear at both side/upper positions;
4. foreground steps create depth without covering CTA;
5. no horizontal overflow at 360/390/412/430;
6. typecheck/build GREEN.

MILESTONE: MFK_CUSTOMER_V3_LONG_HOME_R3_BACKGROUND_ACTIVE
