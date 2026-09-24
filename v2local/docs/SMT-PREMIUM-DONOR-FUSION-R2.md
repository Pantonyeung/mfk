# MFK SMT Premium Donor Fusion R2

WORK_ID: `MFK-SMT-PREMIUM-DONOR-FUSION-R2`

BASE: `cfac74eac282fb022eeda556ec8c87c2f639eaf0`

BRANCH: `work/MFK/SMT-PREMIUM-DONOR-FUSION-R2`

DONOR: `Pantonyeung/morefunos-smt`
DONOR FREEZE: `d482f9f632044e6370e74a736d7443a0a6f5711b`

## Authority

Current MFK `v2local/**` is the only current SMT product/runtime authority.

The donor repository is historical UX/workflow evidence only.

Do not transplant:
- old runtime authority
- direct Firebase / Apps Script assumptions
- old pricing/order/payment truth
- old localStorage business authority
- old timer/print semantics where they conflict with current MFK
- old auth/session implementation
- old sync engine

No `v2local/src/runtime/**` mutation is allowed in this work.

## Donor proof — KEEP / ADAPT / DROP

### KEEP

1. Fixed operational shell and persistent global state
2. One primary work card/panel at a time
3. Right-hand confirmation bias
4. Cart and product areas keep independent scroll
5. Quick mode / direct-add mental model
6. Required / Optional / Link Up progressive decision structure
7. Pending-order queue and high-signal new-order alert
8. Cart line quantity + edit grouping
9. Checkout channel → tender → amount → confirm sequence
10. Offline/local-first visibility
11. Sold-out / paused / device / print states treated as first-class UI
12. Reduced-motion and large touch targets
13. Fast shell continuity; current content should not blank while changing work context

### ADAPT

1. Old orange-heavy visual system → shared MoreFunOS premium tokens
2. Dense cards → stronger hierarchy and larger information contrast
3. Queue strips → high-signal operational rail
4. Product grid → clearer add/configure affordance
5. Cart → dominant current transaction object
6. Checkout → confidence flow rather than flat form
7. Order board → exception-first and status-first
8. Modal/panel motion → semantic, short, restrained
9. System state → Designed states: READY / DEGRADED / OFFLINE / ERROR / BLOCKED / SUCCESS

### DROP_AUTHORITY

1. Donor direct Firebase/catalog assumptions
2. Donor formal-order semantics
3. Donor payment truth
4. Donor printer truth
5. Donor auth/session truth
6. Donor old local storage authority
7. Donor timers/status rules not present in current MFK
8. Any duplicated engine or canonical business rule

## Design Method

Uses the same MoreFunOS Premium Interaction Language as Customer R4, but translated for staff operations.

Customer premium = Delightful.
SMT premium = Decisive.

SMT must optimize:
- scanability
- reaction speed
- certainty
- one focal action
- immediate feedback
- state continuity
- right-hand confirmation
- minimal ambiguity
- operational density without dashboard clutter

## R2 interaction grammar

### 1. Focal action

Every work state has one obvious next action.

Examples:
- empty cart → select product
- configured cart → checkout
- checkout cash → amount / confirm
- pending order → review
- ready order → handover/complete action where current runtime allows

### 2. Progressive disclosure

Do not show all detail at once.

- product configuration: current decision first
- checkout: active decision is visually strongest
- order detail: selected order inspector is primary
- More page: summary → exception → detail

### 3. Immediate feedback

Important tap response <= 110ms perceived.

Required states:
- DEFAULT
- PRESSED
- SELECTED
- DISABLED
- LOADING
- SUCCESS
- ERROR
- BLOCKED
- DEGRADED / OFFLINE

### 4. Motion

Tap: 90–110ms
Selection settle: 140–170ms
Panel/layout: 180–230ms
Sheet/modal: 240–300ms
Alert/attention: max 320ms

Motion must explain:
- selection
- add to cart
- queue change
- payment progress
- order status
- panel continuity

Reduced-motion preserves all state and control.

### 5. Colour roles

- white / near-white: operational canvas
- deep purple-rice: brand / primary structural emphasis
- coral-orange: immediate operational action / selected work focus
- fresh green: ready / success / confirmed
- blue: informational / external-channel context only
- amber: attention / degraded / delayed
- red: destructive / blocked / failure
- cool neutral: secondary structure

Colour is semantic, not decoration.

## Ordering target

Persistent hierarchy:

QUEUE / CURRENT WORK
→ PRODUCT DECISION
→ CURRENT CART
→ NEXT ACTION

The cart is the current transaction object and must remain visually dominant.

Required:
- clearer cart total
- product add/configure distinction
- queue priority
- center panel continuity
- current context + next action
- selected category stable
- add-to-cart motion without moving layout
- no decorative animation during rush operation

## Checkout target

Flow:
1. Source
2. Tender
3. Amount
4. Confirm

The existing business logic remains unchanged.

Presentation must show:
- completed steps
- current step
- blocked reason
- received / change with strong numeric hierarchy
- one dominant confirm action
- payment success / failure / processing states
- no duplicated payment logic

## Orders target

Priority:
1. exceptions / pending
2. selected order
3. current fulfillment state
4. payment / print / after-sale actions
5. history

Do not make the page feel like a generic admin dashboard.

## Acceptance

Automated:
- `npm test` GREEN
- `npm run build` GREEN
- no changed files under `v2local/src/runtime/**`
- presentation tests GREEN
- reduced-motion test GREEN
- `git diff --check` equivalent source validation GREEN where available

Browser:
- 1920×1080
- 1440×900
- 1280×720

Must verify:
- ordering queue
- product add
- product configure
- cart quantity/edit
- center panel
- checkout cash
- checkout non-cash
- processing/success/failure
- orders selected state
- pending/Keeta attention
- soldout
- More
- focus
- reduced motion

STOP at Owner visual acceptance.
NO merge.
NO production deploy.

SUCCESS:
`MFK_SMT_PREMIUM_DONOR_FUSION_R2_OWNER_ACCEPTANCE_READY`
