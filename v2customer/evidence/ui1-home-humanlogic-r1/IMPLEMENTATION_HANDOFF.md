# CUSTOMER-UI1｜Home Human-Logic R1｜Implementation Handoff

Date: 2026-10-01
Issue: #608
PR: #609
Branch: `candidate/MFK/CUSTOMER-UI1-HOME-HUMANLOGIC-R1`
Base: `ac0ee83b16d4d6f1bc1285a743f89b03d6390f2e`

## Owner-Locked Product Rules

- Customer Home is an ordering surface, not a tutorial.
- Active Order comes first when present.
- Otherwise: Store → Search → Hero → Discovery.
- No motivational/helper copy as layout glue.
- Product imagery must be official runtime/Admin truth.
- No generic food artwork as product fallback.
- No local-only Favorite affordance.
- Unsupported controls stay hidden.
- Keep locked five-item Bottom Navigation.

## Candidate Changes

- Removed dynamic welcome headline/subline.
- Removed unsupported notification bell and store chevron.
- Active Order now shows one state + ETA/code + order number.
- Search is direct and literal.
- Existing approved Stage 1 brand Hero remains.
- Store notice remains only when factual notice exists.
- Fixed three-card quick entry removed.
- Reorder appears only when order history exists.
- Coupon shortcut appears only when an available coupon exists.
- Product cards show official image or neutral placeholder.
- Memory-strip duplication removed.

## Acceptance

Required:
- 360 / 390 / 412 layout has no horizontal overflow.
- Active-order state is first content block after compact connection state.
- Search remains immediately visible.
- Hero remains branded but does not block order state.
- No fake product image fallback.
- No Favorite / fake campaign shortcut.
- Touch targets remain at least 44px where actionable.
- Owner visual confirmation required.

Status: CANDIDATE / HOLD
