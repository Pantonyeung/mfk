# MFP V3 A9R｜Formal Business Command Router Authority｜2026-10-02

Status: OWNER AUTHORIZED / CONTROLLING FOR A9R
Product: MoreFun POS
Short name: MFP
Parent A9 exact head:
`69adb11215677d506545c5428f8deea4b89e7db2`

## 1. Why A9R exists

A9 fresh audit proved:

`BLOCKED — FORMAL_COMMAND_ROUTER_BINDING_MISSING`

The V3 client emits high-level formal commands such as:
- CHECKOUT_PAYMENT_CONFIRM
- ORDER_FULFILLMENT_SET
- ORDER_MODIFICATION_REQUEST
- ORDER_PAYMENT_CORRECTION
- ORDER_REFUND
- ORDER_CANCEL
- DINING_FORMAL_ADMIT
- DINING_WAITING_CREATE
- DINING_TABLE_ASSIGN
- DINING_TABLE_TRANSFER
- DINING_ITEMS_ADD
- RUNTIME_AVAILABILITY_SET
- CAPACITY_POOL_CORRECT
- CAPACITY_OVERRIDE_CREATE
- CUSTOMER_NEW_ORDER_ACCEPTANCE_SET
- ORDER_MODIFICATION_CUSTOMER_DECISION
- EXTERNAL_KEETA_LIFECYCLE_APPLY
- EXTERNAL_CUSTOMER_ORDER_ADMIT
- EXTERNAL_KEETA_ORDER_ADMIT

Current Android Store Kernel transport exposes only low-level canonical persistence/receipt/snapshot/inbox/outbox/health primitives.

There is no approved production authority that consumes the V3 high-level command envelope and turns it into canonical business transitions.

## 2. Authority owner

The single authority owner is:

`STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`

Runtime location:
Android Carrier / Store Kernel native authority boundary.

Preferred source namespace:
`carrier/android/app/src/main/java/com/morefunos/smt/storekernel/business/**`

The browser / React client is NOT the authority.

Provider adapters are NOT the authority.

Admin is NOT the transaction authority.

## 3. Router role

The Formal Business Command Router:
- accepts a validated V3 formal command envelope
- authenticates/admission-checks through an injected formal security seam
- dispatches by commandType to exactly one canonical domain handler
- fresh-reads canonical state
- validates expected revision / invariants
- performs one closed Store Kernel transaction
- writes canonical aggregate state + receipt + required outbox effects
- returns canonical result/readback identity
- preserves idempotency

It does NOT:
- accept arbitrary aggregate mutation JSON from the browser
- let the browser choose aggregateType/state
- trust client-computed totals as final pricing truth
- create a second Order/Pricing/Payment/Print/Capacity engine

## 4. Contract boundary

Browser command:
`mfp.store-kernel.command.v1`

Native formal router result:
`mfp.store-kernel.submission.result.v1`

Required result states:
- COMMITTED
- REJECTED
- UNKNOWN

COMMITTED requires canonical receipt/readback evidence.

Timeout / transport uncertainty:
UNKNOWN
→ readback first.

## 5. Security boundary

Every business mutation must receive an authorization decision from a formal native/server security authority seam.

A9R must NOT embed:
- PIN verification in React
- manager-style UI permission assumptions
- provider credentials
- long-lived session secrets

Until production Security Authority is bound:
business router production readiness remains BLOCKED.

Source tests may inject deterministic authorization fixtures.

## 6. Domain authority rule

A9R is not permission to redesign accepted Owner business behavior.

Command handlers must be derived from:
1. Owner FINAL requirements/crosswalk
2. A1–A8 V3 formal contracts/tests
3. accepted legacy GREEN behavior evidence/tests

Legacy v2local is donor/test evidence only.
It must not remain the production state authority.

When donor behavior conflicts with Owner FINAL:
Owner FINAL wins.

## 7. Persistence rule

Only Store Kernel canonical persistence may be transaction truth.

The Router must use the existing:
- StoreKernelTransactionCoordinator
- command receipt/idempotency model
- aggregate revision compare-and-set
- inbox/outbox durability
- journal

No parallel SQLite DB.
No browser Order DB.
No localStorage business truth.

## 8. Aggregate mapping discipline

Before implementing any business mutation, A9R must publish a command-to-state mapping.

For every command:
- required read aggregates
- expected revision source
- written aggregate(s)
- canonical result/readback
- outbox effect(s)
- idempotency identity
- failure codes

Do not let command payload directly dictate aggregate names or canonical state JSON.

## 9. Pricing / Payment rule

For CHECKOUT_PAYMENT_CONFIRM:
- formal validated quote/revision is required
- amount comes from formal pricing/readback
- Student Discount intent must be revalidated formally
- tender eligibility formally validated
- cash settlement uses integer minor units
- one canonical Order/payment result
- no Order before Payment Confirm for normal checkout
- double tap/retry idempotent

A9R must not trust A4/A5 preview arithmetic as final truth.

## 10. Order / Dining rule

All formal Order operations preserve SAME canonical Order identity unless the formal record is explicitly a linked adjustment/refund/PrintJob.

Dining is not a second Order engine.

Waiting → table / table transfer / additions / split settlement must preserve accepted A6 semantics.

## 11. Capacity / Availability rule

A9R consumes Admin/canonical configuration but the Store Kernel formal business authority owns transaction-time operational state.

Must preserve:
- deduct on formal accepted executable order
- cancellation restore once
- refund alone does not imply restore
- channel thresholds
- business-day boundary
- finite audited override

## 12. Money rule

Business Day / Cash / Day Close mutations must:
- use integer minor units
- remain append-only/auditable where required
- preserve immutable completed Daily Report + linked later adjustments
- keep Channel Summary and Tender Summary distinct

No browser Money authority.

## 13. External rule

Customer / Keeta adapters provide transport/provider facts.

Formal external Order admission still crosses this Router into Store Kernel authority.

Provider ACK/decision is not canonical Order/Refund truth by itself.

Duplicate external identity must not create duplicate Orders.

## 14. Print boundary

The Router may create/observe canonical PrintJob intents/effects according to the accepted Print Router contract.

Physical dispatch remains A7 Carrier Print Gateway authority.

No print driver inside business handlers.

## 15. Native bridge boundary

A9R may extend the trusted native bridge with one bounded formal command capability.

Preferred pattern:
- exact message type for formal business submit/readback
- validate protocol/version
- no arbitrary command forwarding
- correlate requestId
- no secrets in responses/logs

The existing low-level `store.kernel.commit.v1` must not be exposed to React as the business implementation shortcut.

## 16. A9R phases

### R0 — Command Registry + Contract Matrix
- freeze command set
- freeze result schema
- freeze command-to-authority mapping
- native router skeleton
- no production mutation yet

### R1 — Checkout + Money Authority
- formal validation/readback
- Payment Confirm
- tender/payment
- Business Day / cash / Day Close

### R2 — Orders + Dining + Availability/Capacity
- fulfillment
- correction/refund/cancel
- Dining
- sold-out
- capacity/override

### R3 — External + Canonical Print Effects
- Customer/Keeta formal admission/lifecycle
- after-sale formal refund handoff
- canonical PrintJob effects

### R4 — Production Binding + V3 Client Adapter
- V3 submit/readback transport
- canonical read adapters
- security seam
- full A1–A8 regression
- physical-candidate readiness audit

No phase automatically authorizes Candidate Publish.

## 17. First RED

Browser submits:
`CHECKOUT_PAYMENT_CONFIRM`

The browser payload must NOT contain:
- aggregateType
- aggregateId mutation list
- canonical order state
- final payment state JSON

Native Router must:
1. recognize commandType
2. fresh-read canonical state/config
3. formally validate quote/revision/tender
4. create canonical mutation(s) internally
5. commit through StoreKernelTransactionCoordinator
6. return one canonical result

A forged browser attempt to submit low-level aggregate mutation through the formal business route must be REJECTED before Store Kernel mutation.

## 18. Status gate

Current:
A9R = AUTHORIZED / NOT YET SOURCE_VERIFIED

Candidate Publish remains:
BLOCKED

The Router lane must reach SOURCE_VERIFIED and then production bindings must be reassessed before Candidate Publish can even be considered.

MILESTONE:
`MFP_V3_A9R_FORMAL_BUSINESS_COMMAND_ROUTER_AUTHORITY_2026_10_02`
