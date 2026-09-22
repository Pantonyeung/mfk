# MFK Admin control-plane design system

Source influence: [`VoltAgent/awesome-design-md`](https://github.com/VoltAgent/awesome-design-md),
`design-md/ibm/DESIGN.md` at commit
`f6961238d5cddcf8042a74a70fc400ec67181abb`.

This is a Carbon-derived product UI system, adapted for a restaurant operations
control plane. It borrows the upstream system's density, 4px grid, flat
geometry, hairline hierarchy, restrained typography, and responsive 16/8/4
column logic. It does not copy IBM branding. MFK orange is the sole product
accent.

## Product posture

- Admin is a control plane, not a POS and not a marketing site.
- Operational truth outranks decoration. Unknown, stale, pending, and failed
  states must remain explicit.
- High-frequency actions stay visible; low-frequency configuration is grouped
  contextually.
- Hierarchy comes from alignment, surface changes, rules, and type scale—not
  shadows, gradients, or collections of floating cards.

## Tokens

| Role | Value |
| --- | --- |
| Ink | `#161616` |
| Muted ink | `#525252` |
| Subtle ink | `#6f6f6f` |
| Canvas | `#ffffff` |
| Workspace | `#f4f4f4` |
| Raised/disabled surface | `#e0e0e0` |
| Hairline | `#d6d6d6` |
| Strong rule | `#8d8d8d` |
| MFK action accent | `#b54708` |
| Accent hover | `#8a3608` |
| Focus | `#b54708` |
| Success | `#198038` |
| Warning | `#8e6a00` |
| Error | `#da1e28` |
| Information | `#0f62fe` |

- Spacing uses a 4px base: `4, 8, 12, 16, 24, 32, 48`.
- Corners are square by default. A 2px radius is reserved for compact status
  tags only.
- No drop shadows in normal application surfaces.
- Body type is 14–16px with `0.16px` tracking. Display headings are light or
  regular weight, never decorative bold.
- Runtime fonts are local/system fonts: `IBM Plex Sans` when available, then
  `Noto Sans TC`, `PingFang HK`, `Segoe UI`, and `sans-serif`. No remote font
  request is introduced.

## Composition

- Desktop: 248px navigation rail + a 48px global header + 48–64px contextual
  navigation + 16-column-aligned workspace.
- Tablet: 80px task rail, abbreviated labels, two-column work surfaces.
- Mobile: no shrunken desktop rail. Use a 48px global header, a native page
  selector, single-column task surfaces, card-transformed data rows, and a
  fixed five-target bottom navigation.
- KPI tiles form a continuous bordered strip, not a collection of floating
  cards.
- Tables retain column rhythm on desktop and transform into labelled records
  on mobile.

## Component rules

- Primary buttons: solid MFK accent, square, minimum 40px desktop / 48px touch.
- Secondary buttons: dark ink or white with a strong hairline according to
  hierarchy.
- Inputs: gray fill, no rounded border, 1px bottom rule; focus uses a 2px MFK
  underline plus visible outline.
- Tabs: white/gray surface, selected state uses a 3px MFK left or bottom rule.
- Cards: white canvas with 1px hairline. Use gray alternate bands instead of
  elevation.
- Status tags: compact rectangles. Semantic colors communicate actual state
  only and never manufacture success.
- Destructive actions retain explicit confirmation and the error color.

## Accessibility and interaction

- Keyboard focus must remain visible on every interactive element.
- Touch targets are at least 44px, and 48px on primary mobile navigation.
- Form errors remain programmatically associated with their fields.
- Dialogs keep native dialog semantics and labelled headings.
- Reduced-motion and forced-colors preferences remain supported.
- Save, sync, ACK/readback, stale, and offline wording stays conservative and
  is derived from existing runtime truth.

## Prohibited drift

- No new product, pricing, option, combo, auth, sync, print, order, or payment
  model.
- No gradients, glass cards, ornamental shadows, pill-button systems, or fake
  dashboard data.
- No use of presentation state to claim save, sync, or readback success.
