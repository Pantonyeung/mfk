# MFK Admin — calm focus design system

This interface follows Apple-style product-design foundations: purpose,
familiarity, agency, progressive disclosure, platform typography, responsive
materials, and immediate feedback. It is an MFK interface—not an imitation of
an Apple product.

## Product posture

- Admin is a control plane. It should feel calm even when the underlying system
  is complex.
- The first view answers only: where am I, what is this for, and what do I open
  next?
- Every route starts collapsed. Opening a route is an explicit act; navigating
  to another route collapses the previous workspace again.
- Nested editors and advanced settings also start collapsed. A user opens only
  the product, pool, section, or configuration they are working on.
- Unknown, offline, stale, failed, queued, and readback-waiting states remain
  explicit. Visual calm must never manufacture success.

## Visual language

| Role | Value |
| --- | --- |
| Canvas | `#f5f5f7` |
| Surface | `#ffffff` |
| Primary ink | `#1d1d1f` |
| Secondary ink | `#6e6e73` |
| Divider | `rgba(0,0,0,.08)` |
| System action | `#0071e3` |
| System action hover | `#0077ed` |
| MFK brand mark | `#f05a28` |
| Success | `#248a3d` |
| Warning | `#9a6700` |
| Error | `#d70015` |

- Use the platform system-font stack. Large headings use tighter tracking;
  body copy keeps natural tracking and comfortable leading.
- Major surfaces use 18–24px radii. Controls use 10–12px radii. Status chips
  may use a capsule only when they represent a compact state.
- Use broad whitespace and grouping instead of borders around every element.
- Shadows are quiet and local. Translucency is reserved for persistent chrome,
  never stacked across multiple content layers.
- Orange identifies MFK. Blue identifies an interactive system action. Do not
  use multiple decorative accent colours.

## Information hierarchy

1. Persistent chrome: MFK, primary areas, conservative sync state.
2. Compact route picker: one current secondary destination, not a row of every
   possible tab.
3. Focus card: page title, one-sentence purpose, and one Open action.
4. Revealed workspace: primary action toolbar, then operational content.
5. Nested disclosure: detailed editors and advanced settings closed by default.

The old card and table placement is not a constraint. Composition follows the
user task, reading order, and action frequency.

## Interaction

- Route changes remount the focus card in its collapsed state.
- Native `details` / `summary` semantics provide keyboard and assistive-
  technology support without creating a parallel interaction model.
- Press feedback starts immediately with a small, critically damped scale
  response. No bounce is used for ordinary menus or form controls.
- Open and close use the same spatial origin and remain interruptible.
- Save, destructive confirmation, validation, sync, ACK, and readback behavior
  remain the existing product contract.

## Responsive composition

- Desktop: quiet 220px sidebar, translucent top chrome, centered focus surface.
- Tablet: compact 76px area rail with shortened labels; content remains a real
  two-column composition where useful.
- Mobile: no desktop sidebar. Use a compact top bar, route picker, single focus
  surface, and a five-target translucent bottom bar. Data tables become
  labelled records after the workspace is opened.
- Touch targets are at least 44px; primary mobile navigation is at least 50px.

## Accessibility

- Focus rings are always visible and meet contrast requirements.
- Summary controls expose native expanded/collapsed semantics.
- Dynamic status surfaces retain live-region behavior.
- Reduced motion uses short opacity changes without scale or spatial travel.
- Reduced transparency replaces glass materials with opaque white.
- High-contrast mode restores solid borders around translucent chrome.

## Frozen contracts

This system must not change Product, Category, Option Set, Combo/Pool, Pricing,
Save, Active Revision, Admin-to-SMT sync, fingerprint, ACK/readback, persistence
keys, endpoints, payloads, auth, Store Kernel, Order, Payment, Print authority,
idempotency, offline, or LKG semantics.
