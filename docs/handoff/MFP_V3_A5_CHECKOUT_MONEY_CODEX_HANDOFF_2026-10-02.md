# MFP V3｜Codex Implementation Handoff｜A5 Checkout + Money｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A5-CHECKOUT-MONEY-2026-10-02`

Parent:
- PR #639 — MFP V3 A4｜Ordering Surfaces｜2026-10-02
- Parent exact head: `b83321000668d39580a29e2e838aa585d5750fd5`
- A4 status: SOURCE_VERIFIED
- Owner acceptance: EXPLICIT

Controlling plan:
- `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
- `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Owner product authority:
- FINAL V1.0 behavior as encoded in the Owner Final crosswalk
- Working V2.5 as detailed decision history
- historical SMT UI as UX/acceptance donor only

Legacy donor references — READ ONLY:
- `v2local/src/features/checkout/checkout-workspace-model.ts`
- `v2local/src/features/checkout/CheckoutWorkspace.tsx`
- `v2local/src/runtime/local-operations.ts`
- `v2local/src/runtime/cash-opening.ts`
- `v2local/src/runtime/daily-close-ticket.ts`
- `v2local/src/runtime/dining-settlement-c1.test.ts`
- existing Store Kernel / pricing / payment / idempotency contracts and tests

Do not import v2 client-state/runtime modules into MFP V3.
Use them only as behavior/contract evidence.

---

## 0. Owner lock

A5 is the formal Checkout + Money stage.

A5 is where MFP first crosses from:
`A4 ORDERING DRAFT`

into:
`FORMAL PRICE / REVISION VALIDATION`
→ `FINAL PAYMENT REVIEW`
→ `STORE KERNEL FORMAL COMMIT`
→ `CANONICAL READBACK`

Hard rule:

`OPEN CHECKOUT != FORMAL ORDER`

`CHANGE PAYMENT METHOD != FORMAL ORDER`

`RETURN TO ORDER != FORMAL ORDER`

Only the final explicit:
`PAYMENT CONFIRM`

may cross the formal transaction boundary.

No production deploy / merge / OTA / cutover in A5.

---

## 1. First RED — formal boundary

Write this test before implementation:

Given one A4 normalized draft intent:

1. open Checkout
2. obtain formal price/revision validation/readback from the Store Kernel/Pricing authority
3. select source/channel
4. select tender
5. optionally enter cash received / Student Discount intent
6. open Final Review

Expected before `PAYMENT CONFIRM`:
- Store Kernel formal commit count = 0
- no formal Order identity
- no first-print side effect
- no production/fulfillment side effect
- no cash ledger sale entry

Then:
- press `PAYMENT CONFIRM`
- exactly one formal submission is sent
- the submission preserves one stable submissionId/idempotencyKey
- COMMITTED is shown only from Store Kernel/canonical readback
- double tap / retry cannot create a second formal effect

Additional first-RED mismatch case:
If formal price/revision validation rejects the A4 material facts as stale:
- checkout must fail closed
- no Store Kernel commit
- draft returns to REVALIDATION_REQUIRED / refresh path
- no client-side “accept old price” shortcut

---

## 2. Formal authority boundary

Do NOT rebuild:
- Pricing Engine
- Order Authority
- Payment/Tender Authority
- Business Day Authority where already canonical
- idempotency/submission semantics
- Store Kernel
- Print authority
- Fulfillment

A5 creates:
- client checkout domain
- injected formal validation/commit seam
- UI state
- money entry UX
- read models / local durable operational money records only where the existing authority contract permits

Formal final truth must come from:
`Store Kernel / canonical money authority`

Never from:
- React state
- Zustand
- Dexie
- local preview
- button state

---

## 3. A4 input contract

A5 must consume A4 normalized ordering intent.

Required input:
- schema = `mfp.ordering.intent.draft.v1`
- source projection identity
- cart line identities
- product/combo identities
- quantities
- service mode
- options/combo choices
- material price facts used for preview
- checkoutReady=true

A5 must reject entry when:
- any required selection unresolved
- any line is REVALIDATION_REQUIRED
- any line has priceReady=false
- any item is unsellable/unavailable
- no valid authenticated/authorized device/session

A5 must not mutate the A4 draft to make invalid data pass.

---

## 4. Formal validation / quote contract

Create one injected formal checkout validation port, or a bounded extension over the A1 Store Kernel port.

It must support formal validation of:
- product identity
- option/combo identity
- quantity
- service mode
- current canonical revision / projection identity
- current price
- discount eligibility
- tender eligibility where formal policy requires it

Formal validation result must be one of:
- VALID
- REJECTED
- UNKNOWN

If VALID, return a formal quote/readback object containing enough facts for Final Review, for example:
- quoteRef / validationRef
- formal revision identity
- validated line totals
- validated discount rows
- formal subtotal
- formal total due
- eligible/accepted tender facts
- expiry/revalidation identity if the canonical contract has one

Do not invent a new Pricing Engine.

A5 local arithmetic may render preview, but final amount shown in Final Review must be clearly derived from formal validation/readback.

---

## 5. UNKNOWN / readback

Validation or commit transport timeout/network error:
`UNKNOWN`

Rules:
- never convert timeout to FAILED automatically
- readback first
- retry only with the same formal identity
- no new submissionId on button retry
- COMMITTED readback stops retry
- REJECTED readback returns stable rejection
- no blind duplicate tender/order side effect

Preserve all A1 idempotency semantics.

---

## 6. Checkout UI — shared business contract

MFP Pad and MFP Mobile may use different presentation.

They must share:
- checkout domain
- channel semantics
- tender semantics
- Student Discount intent
- cash calculation
- Final Review facts
- formal submit/readback
- money read model

No mobile-specific payment engine.

---

## 7. Checkout source / channel

Owner FINAL checkout source set must support at least:
- WALK_IN / 現場
- PHONE / 電話
- WHATSAPP
- MORE_FUN_APP / 自家平台
- FOODPANDA
- KEETA

Do not collapse channel and tender.

Channel answers:
`WHERE DID THE ORDER COME FROM?`

Tender answers:
`HOW WAS IT PAID?`

For applicable channels show source identity facts such as:
- customer phone
- pickup code
- external platform order number

Pickup code is display/human verification aid.
It is NOT a hard transaction gate.

---

## 8. Tender contract

Use the current canonical tender configuration where available.

Owner minimum:
- CASH
- ALIPAY
- WECHAT PAY
- FPS / 轉數快
- PAYME

Admin may add/disable future tenders.

Do not hard-code the canonical tender list as the payment authority.

A5 UI may have fallback fixture tenders only inside tests/harness adapters, never runtime production truth.

---

## 9. Cash keypad

Owner FINAL cash quick controls:
- $20
- $50
- $100
- $200
- $500
- EXACT / 剛剛好

Display:
- amount due
- received
- change

Rules:
- received < due → cannot confirm CASH
- received == due → change 0
- received > due → deterministic change
- no negative/NaN/Infinity
- money uses integer minor units
- cash arithmetic does not become Payment Authority

Pad and Mobile must use the same calculation contract.

---

## 10. Student Discount — exact Owner rule

Owner FINAL rule:

`STUDENT COUNT = staff-confirmed actual student count`

Eligible item:
Owner-defined eligible special drink facts from canonical config/pricing policy.

Discount:
eligible special drink = 50%.

Two modes:

### MANUAL
Staff chooses up to N eligible drinks.

### AUTO
System chooses up to N eligible drinks,
where N = confirmed Student Count.

AUTO priority:
`MOST EXPENSIVE ELIGIBLE DRINK FIRST`

Tie-breaking:
must be deterministic.
Use stable cart/order line identity after equal price unless an existing canonical contract defines another order.

Rules:
- discount count <= Student Count
- fewer eligible drinks than students → discount only existing eligible drinks
- never create items
- never discount non-eligible item
- Student Count must be explicitly entered/confirmed
- support direct input and quick count actions where practical

Critical authority rule:
The client creates `STUDENT_DISCOUNT_INTENT`.
Formal Pricing Authority validates eligibility and final discounted amount.

The client preview is not the final Pricing truth.

---

## 11. Final Review

Before formal commit show approx 75% major review surface on Pad, stable action geometry.

At minimum:
- channel/source
- tender
- formal total due
- cash received / change when CASH
- Student Discount summary where applicable
- pickup/external identity where applicable
- quote/revision freshness status

Before confirm, staff may:
- change Payment Method
- return to Order
- adjust allowed pre-commit checkout choices

These actions must NOT create formal transaction side effects.

---

## 12. Final Payment Confirm = formal transaction boundary

This button is the formal commit boundary.

Flow:

`VALIDATED CHECKOUT`
→ user explicit confirm
→ stable submissionId/idempotencyKey
→ Store Kernel formal command
→ COMMITTED / REJECTED / UNKNOWN
→ canonical readback

On COMMITTED:
- one formal Order/transaction effect
- one current effective tender
- downstream production/print admission belongs to existing authority
- A5 may show completion review from canonical result/readback

A5 must NOT:
- manufacture formal orderId
- manufacture display number
- manufacture tender success
- manufacture print success
- manufacture fulfillment state

---

## 13. Permission alignment — mandatory before formal submit

Owner FINAL product rule:

`VALID AUTHENTICATED MFP LOGIN`
→ eligible for Owner FINAL-defined MFP frontline/local operations.

No Manager-only Gate in this Owner version.

A5 must align the formal submit path.

Preserve:
- device authorization
- staff authentication
- session expiry/revocation
- Store Kernel formal admission
- canonical security readback

But do not reject checkout solely because:
- a valid logged-in staff lacks a Manager-style granular UI permission that Owner FINAL did not require.

Required implementation direction:
- define a formal MFP frontline capability/alignment contract
- action-specific permission metadata may remain for audit/future extension
- but FINAL frontline checkout must not depend on Manager role

Do not simply delete authorization.
Do not bypass Store Kernel admission.
Do not weaken revoked/expired/unknown fail-closed.

Required RED:
valid STAFF role + valid device/session + no manager-only permission
→ checkout formal path remains eligible under Owner FINAL product rule.

---

## 14. Business Day / Cash Opening

A5 must implement the MFP V3 client contract/UI for Business Day money opening facts.

Need:
- businessDayId / businessDate identity
- opening cash
- source of opening suggestion
- previous retained cash reference where applicable
- explicit confirm
- audit facts

Owner rule:
retained cash from prior close may become next Business Day opening basis.

If opening amount is changed:
record the explicit change / cash movement semantics.
Do not silently rewrite prior close.

Business Day reset semantics must follow store business-day boundary, not blindly 00:00, if canonical config provides that boundary.

Do not invent a second Business Day authority.

---

## 15. Cash In / Cash Out ledger

A5 must implement a money-ledger seam/read model for local cash movements.

Each movement:
- movementId
- businessDayId
- type = CASH_IN | CASH_OUT
- amountMinor
- reason
- actor/staff reference
- occurredAt
- optional note
- source/ref where applicable

Rules:
- Cash In/Out != Sales
- Cash In/Out != Refund
- Cash In/Out != Payment Method Correction
- no silent drawer balance mutation
- append-only operational record
- idempotent submission
- formal/canonical readback when bound

Cash refund records are linked money adjustments, not generic Cash Out unless canonical money contract says so.

---

## 16. Day Close / Cash Count

A5 must implement Day Close source-level domain + UI.

Owner required facts:
- opening cash
- cash sales
- Cash In
- Cash Out / expenses
- cash refund / cash adjustment
- expected cash
- actual counted cash
- variance
- cash removed
- retained cash
- next Business Day opening suggestion

Expected cash concept:

`opening cash
+ cash sales
+ Cash In
- cash refunds/adjustments
- Cash Out
= expected cash`

Then:
`actual counted - expected = variance`

Variance:
- show numeric amount
- show sign/direction
- never silently rewrite transactions

---

## 17. Cash count input modes

Owner required:

### Denomination mode
At minimum:
- $1
- $2
- $5
- $10
- $20
- $50
- $100
- $500

Input quantity for each denomination.

### Direct total mode
Staff enters total counted cash directly.

Both modes normalize to the same countedCashMinor.

No floating point money.

---

## 18. Channel Summary / Tender Summary

Day Close must keep separate dimensions.

### Channel Summary
At minimum:
- WALK_IN
- PHONE
- WHATSAPP
- MORE_FUN_APP
- FOODPANDA
- KEETA
- future channels

For each:
- order count
- recognized amount

### Tender Summary
At minimum:
- CASH
- ALIPAY
- WECHAT
- FPS
- PAYME
- ELECTRONIC_UNCLASSIFIED
- future tender

Rule:
Payment Method Correction must report only the current effective tender.
Historical tender changes stay in audit history.
No double count.

---

## 19. Unclassified electronic payment reporting

Owner rule:

If historical PHONE / WHATSAPP / direct order cannot reliably identify exact electronic provider:
- do not guess ALIPAY / WECHAT / FPS / PAYME
- report `ELECTRONIC_UNCLASSIFIED`

Cash reconciliation may infer:
`cash vs non-cash`

It must NOT infer:
`which exact electronic provider`

Reporting inference:
- does not rewrite original Order
- does not create payment evidence
- does not bypass formal Payment Correction

---

## 20. Immutable Daily Report

A5 must implement the money/reporting truth contract for a completed Day Close.

Daily Report must include at minimum:
- business date
- gross/effective sales facts
- order count
- refund/cancel/adjustment summary
- Channel Summary
- Tender Summary
- cash reconciliation
- Cash In/Out
- cash removed / retained
- product-sales inputs/read model where available from formal Order truth

Owner rule:
Once formally closed, original Daily Report is immutable.

Later cross-day refund/correction:
- never rewrites old report
- creates append-only linked Adjustment/Refund record
- links original Order/report
- read view may show original + later adjustments together

Do not implement the A6 refund UI here if it requires Order Operations.
But implement the A5 reporting contract so A6 can append correctly later.

---

## 21. Report print boundary

A5 owns report data/facts.

A7 owns physical Print execution.

A5 may expose:
- print intent
- report render model

Do not create a second Print engine.

Historical daily-report ticket code is donor evidence only.

---

## 22. Local/offline money continuity

Owner FINAL requires local transaction continuity when WAN/cloud is down for operations that do not intrinsically require online access.

A5 source architecture must support:
- local checkout via Store Kernel when Store Kernel is locally reachable
- local tender recording
- local cash movement
- local day-close facts

without requiring unrelated Cloud/Admin/Owner/Provider round trips.

But:
A5 must not claim production offline readiness until physical Store Kernel binding exists.

No cloud polling.

---

## 23. Durable state rules

TanStack Query:
- formal quote/readback/server facts
- no periodic polling

Zustand:
- Checkout UI state
- Final Review state
- money-entry UI state
- not formal money truth

Dexie:
allowed only for bounded durable client metadata/readback or formally authorized local operational money records.

Never persist as independent truth:
- fake payment success
- fake Order commit
- Pricing truth
- unverified tender result

Store Kernel/canonical readback wins.

---

## 24. Pad formal Checkout UI

Implement functional Pad UI:
- left full order summary
- right source/channel
- tender
- source-specific identity
- stable cash keypad geometry
- Student Discount entry
- return to order
- Final Review
- explicit Payment Confirm
- clear UNKNOWN/rejected/readback states

Stable muscle-memory geometry.

---

## 25. Mobile formal Checkout UI

Implement touch-first Mobile Checkout:
- summary
- channel
- tender
- cash input
- Student Discount
- Final Review
- explicit Payment Confirm
- completion/readback

Different layout is allowed.
Same business contract is mandatory.

---

## 26. Required tests

At minimum:

### Formal boundary
1. opening Checkout creates zero formal commits
2. changing channel creates zero formal commits
3. changing tender creates zero formal commits
4. returning to order creates zero formal commits
5. Final Review creates zero formal commits
6. only Payment Confirm can submit
7. double tap creates one formal effect
8. retry reuses same submissionId/idempotencyKey
9. timeout -> UNKNOWN -> readback first
10. COMMITTED readback stops retry
11. REJECTED readback stable
12. stale price/revision rejects before commit
13. formal total comes from validation/readback, not local preview

### A4 gate
14. unresolved required blocks checkout
15. REVALIDATION_REQUIRED blocks checkout
16. price-not-ready blocks checkout
17. unsellable/unavailable blocks checkout

### Owner permission alignment
18. valid authenticated STAFF with authorized device is eligible for FINAL checkout without Manager-only assumption
19. expired/revoked/unknown session still fails closed
20. revoked/unknown device still fails closed

### Channel/tender
21. channel and tender are independent dimensions
22. source set covers WALK_IN/PHONE/WHATSAPP/MORE_FUN_APP/FOODPANDA/KEETA
23. pickup code is not a hard transaction gate
24. tender UI consumes canonical/configured tender facts

### Cash
25. $20/$50/$100/$200/$500/EXACT quick entry
26. insufficient cash blocks confirm
27. change arithmetic exact in minor units
28. no float/NaN/Infinity money

### Student Discount
29. count never exceeds confirmed Student Count
30. manual mode preserves selected eligible lines
31. auto mode chooses most expensive eligible drinks first
32. equal-price tie break deterministic
33. non-eligible line never discounted
34. no phantom discount item
35. formal pricing validation can reject client discount intent

### Business Day / Cash
36. previous retained cash may seed next opening suggestion
37. opening override is explicit/audited
38. Cash In adds expected cash
39. Cash Out subtracts expected cash
40. Cash In/Out remain distinct from Sales/Refund
41. denomination count normalizes correctly
42. direct total mode normalizes same counted fact
43. variance = actual - expected
44. cash removed cannot exceed counted
45. retained cash = counted - removed

### Reporting
46. channel summary distinct from tender summary
47. current effective tender only after correction
48. no double count old/new tender
49. unknown electronic provider => ELECTRONIC_UNCLASSIFIED
50. cash reconciliation cannot guess exact electronic provider
51. reporting inference never rewrites Order truth
52. completed Daily Report immutable
53. later adjustment append-only linked to original report/order

### Regression / guards
54. A1 idempotency remains green
55. A2 security remains green
56. A3 sync remains green
57. A4 ordering/Owner closure remains green
58. no v2 client-state import
59. no SMM authority/state/head/session
60. no new Pricing/Payment/Order authority
61. no periodic business/money polling
62. no production deploy path

---

## 27. CI

Extend the MFP dedicated workflow.

Required:
- install
- test
- typecheck
- build
- authority/security/sync/ordering/checkout-money guard

Static guard should reject:
- direct client manufacture of COMMITTED/payment success
- v2 client-state imports
- SMM business authority identifiers
- new Pricing engine
- new Payment engine
- new Print engine
- periodic money polling
- production deploy config

No production deploy.

---

## 28. Change control

Current mode:
`PREPARE`

Candidate manifest must declare A5 paths.

Preferred source scope:
- current governance/handoff/plan docs
- `.github/mfk-change-manifest.json`
- MFP CI
- `v3smt/src/**`
- styles/index/package only if needed

Do not edit v2 donor files.

If a neutral shared contract under `contracts/**` is genuinely required:
STOP and report exact need before widening scope.

---

## 29. Production binding status

Carried blockers remain:
- A2 formal production device/staff authority binding
- production Store Kernel binding
- A3 production sync adapter
- physical offline acceptance
- deploy/OTA/public cutover

A5 may still achieve:
`SOURCE_VERIFIED`

with injected/test adapters and fail-closed runtime binding.

Do not claim DEPLOYED or PHYSICAL_VERIFIED.

---

## 30. Completion target

A5 completion:
`SOURCE_VERIFIED`

A5 does NOT mean:
- Order Operations complete
- refund/cancel UI complete
- Dining complete
- Print complete
- production deploy complete
- physical cash drawer acceptance
- SMM decommission

A6 remains Order Operations.

---

## 31. Completion report

Return exactly:

1. A5 implemented
2. Checkout domain contract
3. A4 draft admission gate
4. Formal price/revision validation contract
5. Formal quote/readback proof
6. Channel/source contract
7. Tender contract
8. Cash keypad contract
9. Student Discount exact Owner-rule proof
10. Final Review
11. Payment Confirm formal-boundary proof
12. Submission/idempotency/UNKNOWN proof
13. Owner permission alignment proof
14. Pad Checkout UI
15. Mobile Checkout UI
16. Business Day / cash opening contract
17. Cash In/Out ledger contract
18. Day Close / cash count contract
19. Channel Summary / Tender Summary proof
20. ELECTRONIC_UNCLASSIFIED proof
21. Immutable Daily Report / later adjustment contract
22. Offline/local money continuity proof
23. No-second-authority proof
24. Changed files
25. Exact SHA
26. Tests/results
27. CI
28. Production binding status
29. Remaining blockers
30. A6 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A5_CHECKOUT_MONEY_2026_10_02`
