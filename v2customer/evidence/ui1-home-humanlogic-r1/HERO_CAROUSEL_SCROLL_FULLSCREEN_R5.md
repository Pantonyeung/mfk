# CUSTOMER UI1｜Hero Carousel + Scroll Collapse + Fullscreen Detail R5

Date: 2026-10-01
Status: IMPLEMENTED IN CANDIDATE / HOLD

## Owner-confirmed behaviour

### Initial Home
- Large Hero is visible at full height.
- No secondary banner is shown below it at initial top-of-page state.
- Hero is a carousel, not a fixed image.
- It auto-rotates and supports manual swipe / dot selection.

### Scroll
- As the user scrolls down and the Hero moves upward, the Hero progressively shrinks.
- The Hero never abruptly disappears.
- After the collapse passes the threshold, a secondary banner appears below the normal Home controls.
- Scrolling back to the top hides that secondary banner again.
- Home remains vertically scrollable until the end marker.

### Hero tap
Tapping the large Hero opens a full-screen Hero detail state.

The full-screen state contains:
- enlarged Hero visual
- Hero theme / title / explanatory information
- immediate CTA
- related runtime product recommendations
- close control
- slide position indicator

The related recommendations come from runtime products only.
No fake price / fake product / fake availability is invented.

### Hero detail semantics
The detail view answers:
- What is this Hero talking about?
- What should I do next?
- Which current menu items are relevant?

## Current thresholds

Scroll collapse:
- starts after ~18px scroll
- completes over ~190px
- Hero desktop/mobile width stays responsive

Secondary banner:
- hidden at top
- shown when Hero collapse progress >= 0.52

Auto rotation:
- every 5.2 seconds
- suspended while full-screen Hero detail is open
- disabled for reduced-motion users

## Scroll order

Header
→ Active Order if any
→ Large Hero carousel
→ Search
→ Quick Entry
→ Categories
→ Secondary Banner only after scroll threshold
→ Reorder if available
→ Product Recommendations
→ End marker

## Responsive

360 / 390 / 412 mobile-first.
No fixed one-screen constraint.
Vertical page scroll is intentional.

## Governance

Public Stage may be updated for Owner review.
PR #609 remains DRAFT/HOLD.
No main merge until Owner confirms Stage 1.
