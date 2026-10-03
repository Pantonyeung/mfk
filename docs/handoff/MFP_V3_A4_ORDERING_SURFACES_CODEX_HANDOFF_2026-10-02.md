# MFP V3｜Codex Implementation Handoff｜A4 Ordering Surfaces｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A4-ORDERING-SURFACES-2026-10-02`

Parent:
- PR #637 — MFP V3 A3｜Sync + Offline｜2026-10-02
- Parent exact head: `adc2cc64573d9d5f7b357a7955ff2b0edc1fd509`
- A3 source status: SOURCE_VERIFIED

Carried production blockers:
- A2 formal device/staff production binding = BLOCKED
- A3 production sync adapter / physical offline acceptance = BLOCKED
These block deployment, not A4 source implementation.

Controlling plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Ordering donor references:
- `v2local/src/runtime/admin-config-projection.ts`
- `v2local/src/features/ordering/ordering-workspace-model.ts`
- `v2local/src/features/ordering/OrderingWorkspace.tsx`
- `v2local/src/features/ordering/OrderingCenterWorkspaces.tsx`
- `v2local/src/runtime/admin-operational-config.ts`

Donor rule:
Use legacy code only as behavior/UX/contract evidence.
Do NOT import v2 client-state modules into MFP V3.

## 0. Owner lock

A4 is the first formal product-UI stage.

A4 must implement actual MFP ordering surfaces for:
- MFP Pad
- MFP Mobile

They are one product and one ordering contract.
They may use different layouts and interaction patterns.
They may NOT use different:
- catalog truth
- pricing facts
- option/combo semantics
- cart intent semantics
- service-mode semantics
- sync authority
- Store Kernel authority

SMM remains cancelled as a product identity.
Do not create an SMM-flavored mobile ordering engine.

No production deploy / merge / OTA / public cutover in A4.

## 1. First RED

Before implementation, prove:

Given the same active canonical ordering projection and the same user selections,
MFP Pad and MFP Mobile produce the same normalized cart intent.

The RED must cover at minimum:
- same productId
- same serviceMode
- same quantity
- same option selections
- same combo selections
- same line material facts required for later A5 formal checkout

Different UI events/layouts may lead to the same normalized intent.

The test must also prove neither surface creates:
- a second pricing authority
- a second order authority
- a second sync client
- SMM-specific state

## 2. A4 scope

Implement:

1. Canonical ordering projection selector
2. Categories
3. Products
4. Product media/presentation
5. Sellability read-only display
6. Option / modifier configuration
7. Combo configuration
8. Cart draft model
9. Service mode
10. Quick / normal ordering interaction where useful
11. Pad ordering workspace
12. Mobile ordering workspace
13. Shared normalized ordering intent
14. Shared UI/domain contract tests

A4 stops before:
- formal checkout commit
- payment/tender
- Business Day money flow
- formal order creation
- print
- order manager lifecycle
- refunds/cancel
- external Customer/Keeta execution

Those belong to A5+.

## 3. Ordering projection source

A4 must consume the active A3 Last Valid canonical projection.

Flow:

A3 Active Projection
→ MFP Ordering Selector
→ normalized catalog/product/options/combo model
→ MFP Pad / MFP Mobile

UI components must not independently fetch Admin/catalog business data.

No:
- direct Admin menu polling
- focus-triggered catalog fetch
- per-screen canonical fetch
- separate mobile projection
- v2local runtime state import

If the active projection is missing:
- show bounded UNAVAILABLE / LOCAL_LKG unavailable state
- do not invent sample products as production truth

Test fixtures may use explicit fixture projections.

## 4. Shared ordering domain contract

Create fresh neutral MFP types under `v3smt/` such as:

### Category
- id
- label
- position
- active/visible if needed

### Product
- productId
- categoryId
- name
- description
- imageUrl
- published unit price material fact
- priceReady
- sellable
- optionSets
- presentation metadata where canonically available

### OptionSet
- id
- name
- required
- selection: SINGLE | MULTI
- min
- max
- allowQuantities if supported
- options

### Option
- id
- name
- priceAdjustment material fact
- defaultSelected
- enabled/sellable
- position

### Combo
Reuse current canonical combo/pool/choice semantics where available.
Do not invent a new combo model if the active projection already contains the required material facts.

## 5. Pricing boundary

A4 may display and arithmetically preview published material price facts.

A4 MUST NOT become Pricing Authority.

Allowed:
- display published base price
- display published option/combo adjustments
- compute local cart preview from published material facts
- show price-not-ready state

Not allowed:
- invent fallback price
- mutate canonical price
- claim local preview is formal final quote
- bypass A5 formal price/revision validation
- create an independent mobile price engine

Every cart preview should be clearly modeled as:
`LOCAL_PREVIEW_FROM_PUBLISHED_FACTS`

A5 remains responsible for formal checkout/price validation.

## 6. Sellability boundary

A4 reads effective sellability facts from the active canonical/local runtime projection available to MFP.

Allowed:
- disable unsellable item
- show sold-out / paused label
- prevent adding a disabled option/product

Not in A4:
- perform sold-out/restore mutations
- create availability authority

Operational sellability mutation belongs to A6.

## 7. Cart draft contract

Cart is a client-side ordering draft, not a Formal Order.

Required line facts:
- cartLineId
- productId
- quantity
- serviceMode
- selected option identities
- combo/choice identities where applicable
- free note if included in current contract
- published material price facts used for preview
- source projection identity / revision reference needed by later A5 validation

Rules:
- no formal orderId before Store Kernel commit
- no display number allocation
- no payment state
- no fulfillment truth
- no print jobs
- no fake committed state

Zustand is allowed for ordering draft/UI state.

Dexie persistence of cart is NOT required in A4.
If implemented, it must be explicitly draft-only and must not be confused with Formal Order durability.

Default A4 preference:
memory/UI-state draft only unless existing product requirement proves durable draft is necessary.

## 8. Service mode

Support the canonical MFP service modes currently required by source facts:
- takeaway
- dine-in

Reuse repository terminology/semantics where current contracts already define them.

Pad and Mobile must serialize the same service-mode intent.

Do not duplicate pricing logic by surface.
If takeaway adjustments exist as published facts, both surfaces consume the same selector/result.

## 9. Options / modifiers

A4 must correctly handle:
- required sets
- optional sets
- single selection
- multiple selection
- min/max
- default selections
- positive/negative price adjustments if present
- disabled/unavailable choices

Required options must block the local draft from becoming checkout-ready.

A4 does not formally authorize the selection.
A5/Store Kernel later revalidates material facts.

## 10. Combo ordering

A4 must consume existing canonical combo/pool structure.

Support at minimum:
- active combos
- base price material fact
- required pools/groups
- optional pools/groups
- product/label/none choices where canonical contract supports them
- price adjustments
- disabled choices
- normalized combo intent

Do not flatten combo identity into a fake standalone product if that would lose material selection facts required by checkout/readback.

## 11. Quick vs normal interaction

MFP Pad may use higher-density quick-add interactions.
MFP Mobile may use focused step-by-step configuration.

But both must produce the same normalized intent.

Quick mode may only skip UI steps when:
- all required material selections are deterministically resolved from allowed defaults, or
- the draft remains explicitly INCOMPLETE and cannot proceed to checkout-ready.

No hidden auto-selection that changes business meaning.

## 12. MFP Pad formal UI

Implement real Pad ordering workspace.

Target characteristics:
- large-screen category navigation
- product grid
- cart visible concurrently where ergonomically appropriate
- fast product add
- option/combo configuration panel/sheet
- service mode
- cart quantity/edit/remove
- local price preview
- clear unavailable/sold-out feedback

Do not clone legacy UI blindly.
Use legacy v2local only as UX donor.

## 13. MFP Mobile formal UI

Implement real Mobile ordering workspace.

Required:
- true mobile interaction model
- not a scaled-down Pad layout
- touch-first navigation
- product browsing
- product configuration sheet/page
- cart access
- service mode
- cart edit
- local preview
- checkout-ready/incomplete indication

Mobile uses the same shared domain model and normalized cart intent.

No SMM identity in the user-facing UI.

## 14. Responsive surface selection

Use current MFP surface abstraction:
- MFP_PAD
- MFP_MOBILE

A4 must not rely only on viewport width for authority or business behavior.

Viewport/device class may select presentation.
Business contract remains shared.

Tests should render both surface variants explicitly.

## 15. A3 sync integration

A4 reads from A3 active projection.

Rules:
- no new WebSocket
- no new HEAD/Delta client
- no additional polling
- ordering UI re-renders from active projection change notification/state
- projection update must not reset unrelated cart draft without explicit reconciliation rule

If an item becomes unsellable or materially changes while in cart:
A4 must mark the affected draft line as needing revalidation / unavailable.
Do not silently rewrite a committed/final price.
A5 will own formal collision validation.

## 16. A2 security integration

Ordering UI may require an authenticated staff session to access protected actions.

A4 must:
- consume A2 security state
- show login/security gate where required
- preserve fail-closed behavior

Do not reimplement login inside ordering domain code.

A2 production binding remains BLOCKED separately.

## 17. Empty / stale / offline states

A4 must provide usable states for:

### No projection
- no fabricated menu
- clear unavailable/recovering state

### LOCAL_LKG / Offline
- allow browsing last valid menu
- label stale/offline state truthfully
- do not claim live cloud freshness

### Sync recovering
- keep previous valid menu visible when safe
- surface recovering status
- do not replace LKG with partial candidate

### Product price not ready
- disable add/checkout readiness for that item
- do not substitute zero/fallback price

## 18. Required tests

At minimum:

1. same projection + same selections → identical normalized Pad/Mobile cart intent
2. Pad and Mobile import/use the same ordering domain contract
3. ordering selector reads A3 active projection only
4. UI contains no direct Admin/catalog fetch
5. no new WebSocket / sync coordinator in A4
6. no periodic polling
7. no v2 client-state import
8. no SMM authority/state/head/session dependency
9. categories ordered deterministically
10. inactive/missing category products excluded according to canonical contract
11. price-not-ready item cannot be added as valid checkout-ready line
12. unsellable product cannot be added
13. unavailable option cannot be selected
14. required option blocks checkout-ready draft until satisfied
15. min/max selection enforced
16. positive and negative adjustment preview arithmetic correct from published material facts
17. same takeaway/dine-in facts produce same result on both surfaces
18. combo required selections enforced
19. combo normalized intent preserves choice identities
20. quick mode does not hide unresolved required selection
21. cart quantity/edit/remove behavior deterministic
22. cart remains draft-only; no formal order identity allocated
23. no payment/fulfillment/print state introduced
24. projection update can mark affected cart line stale/revalidation-required
25. offline/LKG view remains usable
26. missing projection shows no fake products
27. A1 tests remain green
28. A2 security tests remain green
29. A3 sync tests remain green

## 19. CI

Extend existing dedicated MFP workflow.

Required:
- install
- tests
- typecheck
- build
- authority/security/sync/ordering guard

Static guards should reject:
- v2 client-state imports
- new direct production API fetch from ordering UI/domain
- new WebSocket creation in A4 ordering files
- `setInterval` business polling
- SMM identifiers in production ordering source where they imply authority
- formal order/payment/print state in A4 cart domain
- production deploy config

No production deploy.

## 20. Change control

Current mode:
PREPARE

Candidate manifest must declare A4 paths.

Preferred A4 path scope:
- current control docs
- A4 handoff
- `.github/mfk-change-manifest.json`
- dedicated MFP CI
- `v3smt/src/**`
- `v3smt/index.html` / styles if needed

Do not modify v2local donor files.

If a missing neutral contract is required from `contracts/**`:
STOP and justify the exact shared contract need before widening blast radius.

## 21. Formal UI quality gate

A4 is not a wireframe-only stage.

Pad and Mobile ordering surfaces should be:
- functional
- responsive
- internally coherent
- suitable for subsequent A5 checkout integration

But A4 is not final visual polish.
Final production hardening remains A7–A9.

No placeholder products or fake production data are allowed in the runtime path.

## 22. Completion target

A4 completion:
`SOURCE_VERIFIED`

A4 does NOT mean:
- formal order checkout complete
- payment complete
- production deploy
- physical POS acceptance
- SMM decommission

Production binding blockers from A2/A3 remain separately BLOCKED until resolved.

## 23. Completion report

Return exactly:

1. A4 implemented
2. Shared ordering domain contract
3. Projection/catalog selector
4. Pricing-boundary proof
5. Sellability-boundary proof
6. Options/modifiers contract
7. Combo contract
8. Cart draft contract
9. Service-mode contract
10. Pad formal ordering UI
11. Mobile formal ordering UI
12. Pad/Mobile normalized-intent parity proof
13. A3 sync integration proof
14. A2 security integration proof
15. Offline/LKG behavior
16. No-second-authority proof
17. Changed files
18. Exact SHA
19. Tests/results
20. CI
21. Production binding status
22. Remaining blockers
23. A5 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A4_ORDERING_SURFACES_2026_10_02`


---

# A4 Owner Crosswalk Closure Addendum｜2026-10-02

Status:
`BLOCKED` for A4 stage closure, while the current implementation slice remains `SOURCE_VERIFIED`.

Controlling crosswalk:
`docs/plan/MFP_V3_OWNER_REQUIREMENTS_CROSSWALK_2026-10-02.md`

Do not advance to A5 yet.

The current A4 candidate at:
`5e4118c003bef84a5e0262d5ac925537c4686ff3`

is accepted as SOURCE_VERIFIED for the ordering-domain slice already implemented, but it does not yet satisfy the complete Owner FINAL ordering/UI requirements.

Codex must now close A4-C1 through A4-C7 in this same A4 lane:

## A4-C1 Display Settings
Implement continuous/persisted visual controls:
- category rows/density
- category count/columns as applicable
- product rows/columns
- image show/hide
- font scale
- overall density/scale
- immediate preview
- restart persistence
- visual-only effect; no business truth mutation

## A4-C2 Navigation + More shell
Carry:
- Ordering
- Orders
- Dining
- Sold-out/Capacity
as high-frequency navigation structure.

Carry:
- top hamburger More/Tools entry

Later-stage pages may remain clearly marked staged placeholders.
Do not fake completed later-stage functionality.

## A4-C3 75% major modal geometry
Pad major operation modal:
- approx 75% of usable interface
- internal scroll area
- fixed bottom primary action
- stable geometry
- edit existing line => modification semantics, not duplicate add

Mobile:
- mobile-appropriate sheet allowed
- stable primary action placement
- same business semantics

## A4-C4 Exact Cart semantics
Add:
- sequence-number preview only; no formal allocation
- ORIGINAL view = original input order
- ORGANIZED view = Product Category order
- ORGANIZED != COMBINE
- COMBINE only exact-equivalent lines
- line-level dine-in/takeaway state
- whole-cart dine-in/takeaway switch
- combined quantity stepper
- uncombined independent lines
- delete/clear protection
- no formal Order identity in draft

## A4-C5 Hold / Retrieve / Dining draft entry
Implement draft interaction shell:
- all takeaway => default Hold
- any dine-in => default Dining
- Hold <-> Dining manual override
- Hold retains full draft content
- empty cart => Retrieve
- held draft can be restored
- Dining entry may show waiting/table target selection shell
- formal Dining Order admission remains A6

## A4-C6 Exact Fast Lane
Implement Owner-defined behavior:
- Quick Pair
- Required area
- rice/combo shortcut area
- positional auto-pair only
- no recommendation
- swap assignment, not duplicate
- unequal counts => complete pairs + residual singles
- explicit combo action required to create combo relation
- required choices from canonical product configuration
- quick mode may defer required, but unresolved state must remain explicit

## A4-C7 UI acceptance baseline
Carry historical Owner UI acceptance constraints:
- professional restaurant POS
- blue primary visual baseline
- red reserved for destructive/error/true warning
- large touch targets for high-frequency actions
- stable geometry / muscle memory
- Silent Guided Flow rather than Next/Previous wizard
- preserve human override where Owner locked it

## A4 Closure tests

At minimum add tests proving:

1. Display settings affect presentation only, never normalized intent.
2. Display settings survive local restart/restore.
3. Pad high-frequency navigation contains Ordering / Orders / Dining / Sold-out-Capacity and top More entry.
4. Major Pad config modal geometry contract is stable and bottom action fixed.
5. ORIGINAL preserves input sequence.
6. ORGANIZED sorts by canonical Product Category order.
7. ORGANIZED does not combine lines.
8. COMBINE only merges exact-equivalent configuration/service-mode lines.
9. Line service mode and whole-cart service mode remain deterministic.
10. Hold/Retrieve preserves draft identity and material facts.
11. Any dine-in defaults Hold/Dining shell to Dining; all-takeaway defaults Hold.
12. User can manually override Hold <-> Dining.
13. Positional pairing produces 1-to-1 pairs only.
14. Reassigning an already-used partner swaps rather than duplicates.
15. Unequal pairing leaves residual singles.
16. Single product is not auto-upgraded into combo.
17. Required Fast Lane reads canonical required choices only.
18. Quick mode unresolved required remains INCOMPLETE.
19. Visual baseline guard contains approved blue primary token and red destructive token.
20. No A5 formal checkout/money authority is introduced.
21. Existing A1/A2/A3/A4 tests remain green.

## Permission clarification carried from Owner FINAL

A2 permission infrastructure remains.

However, for this Owner product version:
- successfully authorized MFP staff must not be silently blocked from the Owner-listed MFP/legacy-SMT operational capabilities by a newly invented Manager-only product rule;
- action-time permission checks and Store Kernel admission remain mandatory security controls;
- canonical policy should grant the Owner-listed operational capabilities to authorized MFP staff unless Owner later changes this product rule.

Do not remove security checks.
Do not invent Manager-only UX policy.

## Completion gate

A4 stage may move from:
`BLOCKED`

to:
`SOURCE_VERIFIED`

only when A4-C1..A4-C7 are implemented, exact-head CI is green, and the completion report includes Owner crosswalk closure evidence.

MILESTONE:
`MFP_V3_A4_OWNER_CROSSWALK_CLOSURE_2026_10_02`


---

# A4 OWNER FINAL CLOSURE ADDENDUM｜2026-10-02

Status:
`BLOCKED — OWNER_REQUIREMENTS_CARRY_FORWARD_INCOMPLETE`

The A4 implementation at exact SHA `5e4118c003bef84a5e0262d5ac925537c4686ff3` is SOURCE_VERIFIED against the original A4 handoff, but it is NOT yet accepted as complete against the Owner FINAL product requirements.

Controlling crosswalk:
`docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`

Before A5 starts, continue PR #639 and close all items below.

## A4-OF-01 Display Settings

Implement presentation-only settings:
- category density / rows
- product columns / density
- image show/hide
- font scale
- overall density/size continuous adjustment
- instant preview
- persistence after restart

Must not change business truth.

## A4-OF-02 Blue Visual Baseline

Historical Owner UI acceptance requires:
- blue primary visual language, baseline around `#1f5fbf`
- red only for destructive / error / true warning

Current A4 orange primary accent is not Owner-aligned.

## A4-OF-03 Major Modal Geometry

Pad major operation modal:
- approximately 75% of usable operation area
- content scrolls internally
- primary bottom action remains fixed/stable
- existing line edit loads same line and saves same line

Mobile may use a touch sheet, but primary action geometry must remain stable.

## A4-OF-04 Exact Cart Semantics

Implement:
- sequence preview display-only; must not allocate formal Order identity
- ORIGINAL = original input order
- SORT = Product Category order from canonical category position
- whole-cart DINE_IN / TAKEAWAY
- per-line DINE_IN / TAKEAWAY
- COMBINE only exact same configuration
- combined display gets quantity stepper
- non-combined display keeps independent lines
- same-line edit preserves cartLineId
- destructive clear action has lower visual weight and confirmation

## A4-OF-05 Hold / Dining Mindset

One high-frequency entry:
`Hold / Dining`

Default:
- all takeaway → Hold
- any dine-in line → Dining

Staff can always switch manually both directions.

Empty draft:
- show Retrieve entry

A4 may keep this draft/local-only.
Formal durable Hold / Waiting / Table behavior belongs to A6.

## A4-OF-06 Fast Lane Exact Owner Semantics

Implement three focused entrances:
1. Fast Pair
2. Required
3. Rice Combo

Fast Pair:
- positional pairing only
- dynamic slots A/B/C/D…
- reassignment swaps occupied pairing
- no duplication
- unequal residual items remain single items
- no auto-added item

Required:
- canonical required facts only

Rice Combo:
- canonical combo facts only
- single product remains single unless staff explicitly creates combo

## A4-OF-07 Silent Guided Flow

Do not build a wizard.

Use visual focus/hierarchy only.

Guidance priority from Owner UI lineage:
Required
→ Quick Drink / optional high-frequency completion where applicable
→ Combo blocker
→ Fast Pair
→ Checkout
→ Product

No automatic business commit.

## A4-OF-08 Muscle-memory / Right-hand Stability

High-frequency controls must not jump between states.

Keep stable:
- modal primary action
- service-mode control
- cart primary action
- product configuration action
- destructive clear at lower visual priority

## A4-OF-09 A2 Permission Owner Alignment

Owner FINAL product rule:
authenticated MFP staff are eligible to operate MFP FINAL-defined frontline/local operations.
No Manager-only Gate in this Owner version.

Preserve:
- formal device authorization
- formal session authentication
- Store Kernel admission
- fail-closed revoked/expired/unknown session/device

But do not make MFP ordering read-only solely because a manager-style granular permission is absent unless a later Owner Addendum explicitly changes the product rule.

Add regression proof before A5.

## Required closure tests

At minimum:

1. Display settings change presentation only.
2. Display settings persist across restart/storage restore.
3. Blue primary baseline applied; destructive/error/warning remain red semantics.
4. Pad major modal is approximately 75% operation area with fixed action footer.
5. ORIGINAL restores input order.
6. SORT follows canonical Product Category order.
7. Combine rejects lines with different option/combo/note/service-mode material facts.
8. Whole-cart service-mode switch updates all draft lines.
9. Per-line service-mode switch preserves other lines.
10. Sequence preview does not allocate formal Order identity.
11. All-takeaway Hold/Dining entry defaults Hold.
12. Any-dine-in Hold/Dining entry defaults Dining.
13. Manual Hold ↔ Dining override always available.
14. Empty draft exposes Retrieve.
15. Fast Pair positional pairing is deterministic.
16. Fast Pair reassignment swaps; never duplicates.
17. Unequal Fast Pair leaves residual singles.
18. Rice Combo never auto-upgrades singles.
19. Silent guidance changes visual focus only; no auto-submit.
20. Same-line edit preserves cartLineId.
21. Authenticated valid MFP staff is not blocked by manager-only capability assumptions for Owner FINAL ordering operations.
22. A1/A2/A3/A4 existing regressions remain GREEN.

## Completion

A4 can be called complete only after:
- original A4 tests remain green
- A4-OF-01..09 are green
- exact-head CI is green
- exact SHA is reported
- PR #639 remains Draft unless separately promoted

Then:
`A4 = SOURCE_VERIFIED`

Until then:
`A4 OWNER FINAL ACCEPTANCE = BLOCKED`

MILESTONE:
`MFP_V3_A4_OWNER_FINAL_CLOSURE_2026_10_02`
