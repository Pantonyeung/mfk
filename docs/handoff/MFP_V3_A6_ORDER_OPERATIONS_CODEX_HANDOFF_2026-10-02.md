# MFP V3｜Codex Implementation Handoff｜A6 Order Operations｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A6-ORDER-OPERATIONS-2026-10-02`

Parent:
- PR #641 — MFP V3 A5｜Checkout + Money｜2026-10-02
- Parent exact head: `830fd2f033f2246c1a4f30da71a0a8f9160da751`
- A5 status: SOURCE_VERIFIED
- Owner acceptance: EXPLICIT
- A5 visual polish: explicitly deferred by Owner; not an A6 blocker

Controlling plan:
- `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
- `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Legacy donor references — READ ONLY:
- Dining D1 / D4 / D5 / D7 / D8 / D9 / D11 / D13 tests
- `v2local/src/runtime/capacity-pool-state.ts`
- CAP2 / CAP3 / CAP4 tests
- legacy Orders / Dining / Sold-out UI only as behavior donor

Do not import v2 runtime/client state into V3.

---

## 0. A6 objective

A6 builds one shared MFP operational layer over canonical Formal Orders.

Scope:
1. Orders page / canonical order read model
2. Fulfillment
3. Formal order modification orchestration
4. Cancellation
5. Refund / payment-correction operational entry over A5 money contracts
6. Dining / waiting / tables / same-order transfer
7. Split checkout orchestration back into A5 Checkout
8. ETA / auto-ready semantics
9. Sold-out / Restore
10. Capacity Pool
11. Channel thresholds
12. Bounded Capacity Override
13. More / Tools shell
14. Pad + Mobile operational UI

A6 must NOT rebuild:
- Order Authority
- Pricing
- Payment/Tender
- Print Engine
- Customer/Keeta provider engine
- Sync
- Staff/device authority

A6 uses injected formal Store Kernel order-operation ports.

---

## 1. First RED — SAME ORDER operational continuity

Write this first:

Given one canonical committed Formal Order from A5 readback:

`ORDER_ID = O1`

Perform:
- mark READY
- revert READY back to IN_PROGRESS
- modify allowed operational metadata / order-content correction request
- payment-correction/refund entry where applicable
- cancel where applicable

Expected:
- every operation targets SAME `O1`
- no second formal Order is created
- every mutation carries expected revision / stable operation identity
- canonical readback decides final state
- stale revision fails closed
- definitive REJECTED remains rejected
- timeout/network -> UNKNOWN -> readback first
- duplicate click/retry is idempotent

Critical first assertion:
`READY -> IN_PROGRESS` keeps the same Order identity and cannot create a second Order.

---

## 2. Order read model

Create one canonical MFP Order Operations read model.

Required order facts:
- orderId
- display/order number
- source/channel
- external order number when applicable
- customer display name when available
- pickup code when applicable
- createdAt
- current revision
- fulfillment state
- current effective tender
- recognized amount / outstanding where relevant
- items
- options/combo/note
- service mode
- dining/waiting/table link where applicable
- refund/correction/cancel references
- ETA facts

UI state must not become Order truth.

---

## 3. Orders page

Pad must implement Owner three-lane model:

1. Direct / On-site
   - WALK_IN
   - PHONE
   - WHATSAPP

2. Own Platform
   - MORE_FUN_APP

3. Third Party
   - KEETA
   - FOODPANDA
   - future external channels

Order cards:
- source
- order number
- status
- customer name if available
- current effective tender
- item count
- amount
- external number if applicable
- own-platform pickup code first-layer visible

Filters:
`SOURCE / CHANNEL -> PAYMENT METHOD -> ORDER LIST`

Filtering never mutates Order truth.

Mobile may use tabs/stacked lists instead of three columns.
Same read model.

---

## 4. Fulfillment

Canonical UI states:

- IN_PROGRESS / 未完成
- READY / 可取餐
- PICKED_UP / 已取餐

Owner rule:
`READY -> IN_PROGRESS` is allowed.

Use cases:
- mistaken Ready
- missing product discovered
- order needs correction

Rules:
- same Order
- expected revision
- formal Store Kernel admission
- no local-only fulfillment truth
- no automatic PICKED_UP solely from pickup-code display
- pickup code is human verification aid, not hard transaction gate

ETA auto-ready may issue/prepare the same formal READY action only under canonical policy.

---

## 5. ETA

Owner rule:
ETA workload counts active orders that have been formally admitted and have not reached READY.

Admin/canonical policy supplies:
- workload thresholds
- ETA minutes
- business rules

A6 client:
- reads policy
- displays ETA / ready-at
- does not invent thresholds
- does not count historical completed/cancelled orders
- no periodic cloud polling

Timer/display behavior may be local, but canonical operational transition must not be manufactured silently by UI state.

If automatic READY exists, it must pass through formal Store Kernel admission / canonical readback.

---

## 6. Formal modification flow

For a formal Order content modification:

MFP
→ submit modification intent/command
→ canonical validation
→ customer-confirmation requirement where applicable
→ updated canonical Order readback

Owner rule:
- Customer must be notified and confirm modification for own-platform formal-order changes.
- If amount increases: payment top-up follows formal money path.
- If amount decreases: refund follows formal money path.
- cash refund affects A5 Cash Movement/reporting.

A6 source may model `CUSTOMER_CONFIRMATION_REQUIRED` as an external pending state.
A8 performs actual Customer external delivery/confirmation.

Do not fake customer confirmation in A6.

If production external confirmation binding is absent:
source contract may be SOURCE_VERIFIED while external binding remains BLOCKED.

---

## 7. Payment Method Correction operational UI

A6 exposes Order Detail action over A5 money authority.

Rules:
- SAME Order
- previous tender kept in audit
- new tender becomes current effective tender only after formal money admission/readback
- no resend to kitchen
- no first-print replay
- no new Order
- daily report counts current effective tender only

Do not implement a second payment ledger.

---

## 8. Refund

A6 Order Detail must support:
- FULL REFUND
- PARTIAL REFUND

Refund method:
- original method
- alternate method selected by staff

Required:
- original Order remains
- linked refund/adjustment record
- actual refund method recorded
- cash refund links into A5 money reporting/Cash Movement semantics
- no refund above paid/eligible amount
- idempotent submission
- UNKNOWN readback-first
- no delete/rewrite of original Order
- later cross-day refund appends to immutable report chain

A6 does not create Provider-specific Keeta after-sale mechanics; A8 binds external provider after-sale.

---

## 9. Cancellation

Cancellation:
- same Order
- explicit reason/input where required by canonical contract
- expected revision
- formal command/readback
- recognized confirmed money is not silently erased
- outstanding becomes non-collectible according to formal authority
- Capacity restoration occurs once where the Store Kernel says the cancelled order consumed capacity

If production/kitchen was already dispatched:
A6 must expose a `CANCEL_NOTICE_REQUIRED` print intent/evidence.
A7 owns actual physical cancel-notice print execution.

Modification after kitchen dispatch:
- do not auto-create correction print
- surface human-communication requirement

---

## 10. Dining core model

Owner dining target:
- waiting queue
- 3×3 table grid
- T01–T08 indoor
- ninth slot outdoor
- selected-table detail

Detail:
- table
- party size
- seatedAt
- elapsed minutes
- items
- amounts
- payment state

Dining uses SAME Formal Order authority.

No separate Dining Order engine.

---

## 11. Dining direct-seat flow

When table available:

select table
→ order
→ formal admission
→ production admission
→ payment when desired

Do NOT require:
- served state before payment
- extra clear-table state before payment
- unnecessary workflow stages

Payment completion may close the transaction according to canonical order lifecycle.

Physical production/print belongs to existing Store Kernel/Print authority and A7 hardware acceptance.

---

## 12. Waiting flow

When no table:

create waiting operational record
→ customer may order before seating
→ formal Order may be admitted while waiting
→ production may proceed
→ waiting record retains SAME formalOrderId

When table becomes available:

WAITING ORDER
→ assign table
→ SAME ORDER
→ preserve Order/display identity
→ no duplicate first formal admission
→ no duplicate first-print intent

Empty wait with no ordered items:
- must not manufacture a formal Order merely to hold a waiting number.

---

## 13. Table transfer

Active Dining Order:
T01 → T03

Requirements:
- destination must be available
- SAME formal Order
- SAME display identity
- preserve payments
- preserve items
- no re-payment
- no duplicate initial production/print side effect
- stale table revision fails closed
- restart/readback preserves assignment

---

## 14. Dining additions

Adding items to an active Dining Order:
- SAME Order
- formal correction/addition command
- fresh expected revision
- new amount facts canonical
- new capacity consumption according to existing authority
- additional production admission only for new material items
- no duplicate base Order

A7 owns actual print execution/recovery.

---

## 15. Split checkout orchestration

Dining can split by item units.

Example:
10 separable product units
→ up to 10 checkout parts
regardless of party size.

Each split:
- selected order item units
- amount derived from formal A5 validation
- own tender
- paid/unpaid readback

True payment:
must route into SAME A5 Checkout/Payment Confirm contract.

Do not create Dining-specific Payment Engine.

Partial paid:
- remaining items/order stays active

All required amount paid:
- canonical readback determines close/release behavior

---

## 16. Dining warning

Canonical/Admin policy supplies dining warning minutes.

At/over threshold:
- table card turns warning/red
- visual reminder only

It must NOT:
- auto-complete
- auto-charge
- auto-remove customer
- auto-clear table

Real `seatedAt` must be preserved from canonical operational state, not component-mount time.

---

## 17. Sold-out / Restore

A6 creates formal MFP operational UI over existing runtime availability/sellability authority.

Features:
- category filter
- search
- sold-out/paused filter
- current unavailable list
- multi-select
- batch sold-out/pause/restore
- rice/purple-rice quick action only over formally bound group/products

No second Availability Authority.
Do not mutate catalog truth in UI.

Action-time formal admission + readback required.

---

## 18. Capacity Pool

A6 UI/read model must support:
- pool name
- initial quantity
- used
- remaining
- bound product count
- per-product consumption facts
- channel thresholds
- currently stopped channels

Owner rules:
- formal admitted/accepted executable item consumes capacity immediately
- cancellation replenishes consumed capacity once
- refund alone does NOT automatically imply capacity replenish
- Business Day reset follows configured business-day start, not 00:00
- manual quantity correction is allowed to authenticated MFP staff
- manual correction must be audited
- no second Inventory Authority

Capacity accounting itself remains Store Kernel/formal operational authority.

---

## 19. Channel thresholds

At least:

### Third-party threshold
When remaining reaches configured third-party threshold:
- future third-party admissions blocked

### Own-platform threshold
At configured own-platform threshold:
- future own-platform admissions blocked

### Pool = 0
- all bound remote channels blocked by default

Rules:
- thresholds independently configurable
- do not cancel existing Orders
- do not refund existing Orders
- local store operation is not automatically disabled merely because remote channels stop
- UI shows why/channel/pool

A8 integrates actual external channel stop transport.
A6 owns canonical local operational read model / command surface.

---

## 20. Capacity Override

Pool at zero is not permanent hard lock.

Authenticated MFP staff may submit bounded override:
- pool
- scope/product/channel
- added quantity
- reason/note if supported
- actor
- time

Rules:
- finite quantity
- audit
- exhausted override re-stops
- no permanent disable of capacity protection
- Owner FINAL has no Manager-only gate for this local MFP operation

Formal authority/readback still required.

---

## 21. More / Tools shell

A6 adds the formal low-frequency shell accessible from hamburger.

Cards/entries:
- Day Close → A5
- Reports → A5 facts
- Devices → later A7/A9
- Print Devices → A7
- Check Center → A9
- Backup / Restore → A9
- Diagnostics → A9
- Admin Sync → A9

A6 requirement:
- navigation shell exists
- Today summary may use existing A5 canonical read models
- no second reporting truth
- deferred cards clearly marked, not fake-success

Do not bury high-frequency Orders/Dining/Sold-out inside More.

---

## 22. Operational UI quality

A6 is a formal product-UI stage.

Pad:
- Orders three-lane view
- order detail side panel
- Dining 3×3 visual grid
- waiting narrow lane
- Sold-out/Capacity operational workspace
- large high-frequency actions
- stable geometry
- Owner blue baseline

Mobile:
- operationally focused list/tab flows
- not a shrunk Pad
- same read/command contract
- touch targets usable
- no horizontal overflow

Final pixel polish may continue later per Owner direction.
Functional semantics must be correct now.

---

## 23. State / persistence rules

TanStack Query:
- canonical order/readback
- operational state readback
- no periodic business polling

Zustand:
- selected order
- filters
- modal/form state
- temporary split-selection UI

Dexie:
- bounded readback/recovery metadata only if required
- no second Order truth
- no second Capacity truth
- no second Fulfillment truth

Formal Store Kernel readback wins.

---

## 24. Required tests

At minimum:

### Orders / same identity
1. committed A5 Order appears in canonical A6 order read model
2. operations never allocate a second Order
3. stale order revision fails closed
4. operation retry preserves idempotency identity
5. timeout -> UNKNOWN -> readback first

### Fulfillment
6. IN_PROGRESS -> READY same Order
7. READY -> IN_PROGRESS same Order
8. READY -> PICKED_UP same Order
9. pickup code display is not hard gate

### Modification/correction/refund
10. modification requires canonical readback
11. own-platform modification can enter CUSTOMER_CONFIRMATION_REQUIRED without faking confirmation
12. payment correction preserves same Order/audit
13. payment correction no kitchen/first-print replay
14. full refund linked, original Order retained
15. partial refund bounded by paid/eligible amount
16. alternate refund method recorded
17. cash refund connects to A5 money adjustment semantics
18. cross-day refund appends, never rewrites report

### Cancellation
19. cancel same Order
20. capacity restore once
21. duplicate cancel does not double-restore
22. kitchen-dispatched cancel exposes CANCEL_NOTICE_REQUIRED
23. modification after dispatch does not auto-print correction

### Dining
24. direct seating creates/uses one Formal Order only
25. waiting order may be admitted before seating
26. later seat assignment preserves same Order/display
27. empty wait does not create formal Order
28. table transfer preserves same Order
29. occupied target fails closed
30. real seatedAt persists
31. partial split payment keeps order/table active
32. full split settlement uses A5 contract and canonical result
33. 10 separable item units permit up to 10 splits
34. split count is not limited by party size
35. Dining warning is visual only

### ETA
36. only active not-ready orders count toward workload
37. completed/cancelled/ready excluded as defined by Owner
38. Admin ETA policy is consumed, not hard-coded
39. auto-ready cannot bypass formal admission/readback

### Sold-out / capacity
40. search/filter does not mutate truth
41. batch sold-out uses one formal availability authority
42. batch restore uses same authority
43. quick rice-group action only affects formally bound products
44. formal accepted item consumes capacity
45. cancellation replenishes once
46. refund alone does not automatically replenish
47. Business Day reset uses configured boundary
48. manual quantity correction audited
49. third-party threshold blocks future third-party only
50. own-platform threshold independent
51. pool zero blocks bound remote channels
52. existing orders unchanged after threshold crossing
53. bounded override permits finite added quantity
54. exhausted override re-stops

### More / UI / regressions
55. More shell routes A5 money/report tools without duplicating truth
56. high-frequency Orders/Dining/Sold-out remain primary nav
57. Pad/Mobile share order-operation contracts
58. no v2 client-state import
59. no SMM order/state/head/session authority
60. no new Order/Pricing/Payment/Print/Availability/Capacity authority
61. no periodic business polling
62. A1 regression green
63. A2 regression green
64. A3 regression green
65. A4 regression green
66. A5 regression green

---

## 25. CI

Extend MFP workflow:

- install
- test
- typecheck
- build
- authority/security/sync/ordering/checkout-money/order-operations guard

Static guard rejects:
- v2 client-state imports
- SMM formal authority
- new Order/Pricing/Payment/Print/Availability/Capacity engine/authority
- periodic business polling
- client-created formal Order
- client-created canonical fulfillment
- production deploy config

No deploy.

---

## 26. Change control

Mode:
`PREPARE`

Candidate manifest must declare A6 bounded paths.

Preferred:
- current control docs
- A6 handoff
- manifest/workflow
- `v3smt/src/**`
- styles/index if needed

Do not edit v2 donor files.

If `contracts/**` widening is necessary:
STOP and report exact need first.

---

## 27. Production binding

Can remain BLOCKED while source is SOURCE_VERIFIED.

Carried blockers:
- formal production device/staff authority
- production Store Kernel binding
- production sync binding
- hardware/print binding
- external Customer/Keeta binding
- physical acceptance/deploy/OTA

Do not claim DEPLOYED / PHYSICAL_VERIFIED.

---

## 28. A6 completion target

`SOURCE_VERIFIED`

A6 does NOT mean:
- Print/hardware complete
- Customer/Keeta external complete
- public cutover
- physical acceptance
- SMM decommission

---

## 29. Completion report

Return exactly:

1. A6 implemented
2. Canonical Order Operations read model
3. SAME-order identity proof
4. Orders page / source lanes
5. Fulfillment proof
6. ETA contract
7. Formal modification contract
8. Customer-confirmation pending contract
9. Payment Correction operational proof
10. Full/Partial Refund proof
11. Cancellation proof
12. Cancel-notice intent proof
13. Dining direct-seat proof
14. Waiting-order continuity proof
15. Table transfer proof
16. Dining addition proof
17. Split checkout orchestration proof
18. Dining warning/seatedAt proof
19. Sold-out/Restore proof
20. Capacity Pool proof
21. Channel threshold proof
22. Capacity Override proof
23. More/Tools shell
24. Pad operational UI
25. Mobile operational UI
26. No-second-authority proof
27. Changed files
28. Exact SHA
29. Tests/results
30. CI
31. Production binding status
32. Remaining blockers
33. A7 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A6_ORDER_OPERATIONS_2026_10_02`
