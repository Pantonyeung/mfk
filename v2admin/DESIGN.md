# MFK Admin — calm focus design system

This interface follows Apple-style product-design foundations: purpose,
familiarity, agency, progressive disclosure, platform typography, responsive
materials, and immediate feedback. It is an MFK interface—not an imitation of
an Apple product.

## Product posture

- Admin is a control plane. It should feel calm even when the underlying system
  is complex.
- The first view answers: where am I, what can I do here, and what is the one
  next action?
- Route purpose and the current working surface stay visible. We never hide the
  whole page behind an extra "open workspace" action.
- Dependent future content stays absent until the current step is complete.
  Completed steps collapse into truthful summaries and remain available for
  correction.
- Large collections use selection before editing. Product search on mobile is
  filter-first; Option Sets, Combos, and Pools open one selected object at a
  time.
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
- Orange identifies MFK. Blue identifies the current step and interactive
  system action. Green identifies a completed/reviewable step, amber identifies
  attention or waiting, and red identifies errors or destructive actions.
  Every colour is paired with text, icon, or status wording; colour is never the
  only signal.

## Information hierarchy

1. Persistent chrome: MFK, primary areas, conservative sync state.
2. Compact route picker: one current secondary destination, not a row of every
   possible tab.
3. Visible workspace: page title, one-sentence purpose, and current task.
4. Guided progress: completed summary, current instruction, future step label.
5. Current editor: only the fields required for this step.

The old card and table placement is not a constraint. Composition follows the
user task, reading order, and action frequency.

## Interaction

- Route changes remount the focused task state.
- `Continue` changes presentation state only. It never saves, publishes,
  creates a revision, claims sync, or fabricates a successful readback.
- Existing validation determines whether a required step can continue. Optional
  contract fields may be explicitly skipped and remain visibly unset.
- Press feedback starts immediately with a small, critically damped scale
  response. No bounce is used for ordinary menus or form controls.
- Open and close use the same spatial origin and remain interruptible.
- Save, destructive confirmation, validation, sync, ACK, and readback behavior
  remain the existing product contract.

## Responsive composition

- Desktop: quiet 220px sidebar, translucent top chrome, centered focus surface.
- Tablet: compact 76px area rail with shortened labels; content remains a real
  two-column composition where useful.
- Mobile: no desktop sidebar. Use a compact top bar, route picker, one current
  editor, and a five-target translucent bottom bar. Product results appear only
  after an explicit filter action. Step actions stay reachable at the bottom of
  the current panel.
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
