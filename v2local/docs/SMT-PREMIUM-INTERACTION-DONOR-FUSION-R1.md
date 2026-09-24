# MFK SMT Premium Interaction Donor Fusion R1

WORK_ID: `MFK-SMT-PREMIUM-INTERACTION-DONOR-FUSION-R1`

BASE: `cfac74eac282fb022eeda556ec8c87c2f639eaf0`

BRANCH: `work/MFK/SMT-PREMIUM-INTERACTION-DONOR-FUSION-R1`

## Authority stack

1. Current MFK `main` / `v2local/**` runtime is the only execution authority.
2. `Pantonyeung/morefunos-smt@d482f9f632044e6370e74a736d7443a0a6f5711b` is a frozen historical donor.
3. `work/MFK/SMT-UI-TWO-IMAGE-PILOT-R1@5aef80888d748b8e3105d1fde8a580e7a8e2abad` is the latest Owner-locked presentation donor.
4. MoreFunOS Premium Interaction Language V1 is the cross-port design constitution.

No donor runtime or historical business authority is restored.

## Port character

`SMT Premium = DECISIVE`

Customer and SMT share the same quality method, not the same decorative style.

Shared method:
- One Focal Action
- Progressive Disclosure
- Immediate Feedback
- State Continuity
- Semantic Colour
- Designed Failure States
- Brand/System Objects
- Restraint

SMT translation:
- faster and denser than Customer
- less decorative motion
- stronger typography and touch targets
- operational status must be glanceable
- failure states must identify what is blocked and what to do next
- every destructive action must be explicit

## Donor extraction

### KEEP

From historical SMT donor:
- 點單｜訂單｜堂食｜售罄｜更多 mental model
- 48px+ frontline touch targets
- Traditional Chinese frontline copy
- required-option blocking only when required
- cart survives save/offline/print/sync failure
- one-action-one-feedback motion
- reduced-motion fallback
- non-blocking pending/provider order queues
- safe checkout
- sold-out management workspace

### ADAPT

- Old warm/orange styling → clean neutral + decisive blue + semantic green/amber/red.
- Old product image cards → Owner-locked text-only large cards.
- Old all-at-once modifiers → one decision group at a time.
- Old multi-section checkout → single decisive source/payment/amount surface.
- Old mixed icon vocabulary → current MFK SVG shell + short, readable payment/channel marks.
- Old generic feedback → status-specific ActionFeedback / DisabledReason / ConfirmDialog.
- Old static cart → immediate line highlight + cart pulse + exact content hierarchy.
- Old fragmented queue strips → compact 6:4 frontline/provider queue deck.

### DROP_AUTHORITY

Never transplant:
- historical local Order engine
- historical pricing rules
- historical payment truth
- historical print engine/router/queue
- historical Firebase/Worker/Sheet authority
- old local order-number allocation rules
- old provider wiring
- old authentication/runtime truth
- any business rule not present in current MFK runtime

## Owner-locked presentation preserved

### Product catalog
- text only
- no product photography
- large product name
- large price
- generous whitespace
- clear quick/standard behavior
- required products visibly marked
- immediate press / add feedback

### Product configuration
- large centered task workspace
- no product imagery
- large uniform option cards
- progressive disclosure
- completed groups collapse into editable readback
- live price remains visible
- final quantity/note/price summary remains visible
- required missing explains why commit is blocked

### Cart
- sequence / 堂外 identity control on the left
- content order:
  1. product name
  2. options
  3. combo
  4. note
- absent layers leave no visual gap
- 原單 / 整理
- 外賣 / 堂食
- exact-similar 組合 開/關
- quantity controls stay local to the line
- total and checkout remain focal

### Checkout
- order remains visible on the left
- source, tender and amount stay on one operational surface
- CASH keypad has large physical hit area
- exact cash and $50 / $100 / $200 / $500 shortcuts
- received/change update immediately
- benefits/discount entries stay visible but truthfully NOT_WIRED until canonical pricing support exists
- one final commit action
- processing / failure / success are distinct states
- no automatic resubmit semantics added

## Cross-workspace design grammar

### Orders
- queue + inspector hierarchy
- selected order is unmistakable
- primary next action is focal
- filter controls stay secondary
- status uses semantic colour, not decoration

### Dining
- table state readable at a glance
- selected / occupied / settled / overdue are visually distinct
- checkout remains the sole payment authority
- queue entry remains separate from 3×3 floor map

### Sold-out
- availability state is the visual focal point
- sold-out products remain in place
- recovery action is explicit
- batch/footer action remains obvious

### More / Diagnostics
- configuration is controlled, not decorative
- diagnostics show truthful local state
- FAIL / DEGRADED / OK have distinct semantics
- printer/device actions use the same feedback grammar

## Interaction timing

- Press: 90–100ms
- Selection: 140–160ms
- Layout/state: 180–210ms
- Dialog/panel: ~220ms
- Longer decorative animation: avoided on SMT
- Reduced Motion: removes non-essential animation without removing state feedback

## Hard preservation

This work must not change:
- current Store Kernel semantics
- order creation semantics
- display-number authority
- tender semantics
- print admission
- print queue/router/device behavior
- Keeta lifecycle
- Admin config sync
- staff auth
- cash opening
- business-day / daily-close truth

No `v2local/src/runtime/**` mutation is allowed in this work.

## Acceptance

Automated:
- all v2local tests GREEN
- production build GREEN
- premium SMT interaction tests GREEN
- no runtime file diff from base
- reduced-motion rule present
- text-only product card proof
- progressive config proof
- checkout single-surface proof
- pending/provider queues preserved

Public preview:
- isolated Cloudflare Version Preview only
- no production traffic change
- no merge to main before Owner acceptance

SUCCESS:
`MFK_SMT_PREMIUM_INTERACTION_DONOR_FUSION_R1_OWNER_ACCEPTANCE_READY`
