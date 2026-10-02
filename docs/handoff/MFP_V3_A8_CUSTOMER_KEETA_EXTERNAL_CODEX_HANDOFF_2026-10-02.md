# MFP V3｜Codex Implementation Handoff｜A8 Customer + Keeta + External｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A8-CUSTOMER-KEETA-EXTERNAL-2026-10-02`

Parent:
- PR #645 — MFP V3 A7｜Print + Hardware + Recovery｜2026-10-02
- Parent exact head: `806ca51cfd812a968f9208a45e14d8a228fa91e1`
- A7 status: SOURCE_VERIFIED
- Owner acceptance: EXPLICIT

Visual lock:
`docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`

Controlling plans:
- `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
- `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Read-only donor / contract evidence:
- `contracts/customer-cloud-v1.ts`
- `contracts/keeta-order-intake-v1.ts`
- `contracts/admin-refund-v1.ts`
- `v2local/src/runtime/customer-cloud-intake.ts`
- `v2local/src/runtime/payment-evidence-whatsapp.ts`
- `v2local/src/runtime/keeta-order-intake.ts`
- `v2local/src/runtime/keeta-order-lifecycle.ts`
- `v2local/src/runtime/keeta-after-sale.ts`
- `v2local/src/runtime/admin-operational-config.ts`

Do not import v2 client state/runtime into V3.
Do not copy legacy polling/focus-trigger behavior.

---

## 0. A8 objective

A8 connects MFP to external order intent and provider workflows without creating a second Order engine.

A8 scope:

1. Customer pending-order read model
2. Customer pay-at-store review
3. Customer electronic payment evidence review
4. WhatsApp QR / contact fallback
5. Customer accept / modify / cancel orchestration
6. Customer modification confirmation pending state
7. Customer cutoff / immediate stop projection
8. Customer WhatsApp fallback semantics
9. Keeta inbound identity / dedupe
10. Keeta auto/manual accept policy
11. Keeta immediate/later handling
12. Keeta defer max 2
13. Keeta error attention
14. Keeta mapping / provider facts projection
15. Keeta lifecycle events
16. Keeta after-sale / partial refund orchestration over existing A6/A5 formal operations
17. Channel threshold integration
18. external adapter health / attention
19. zero-polling event-driven transport
20. Pad + Mobile external/pending UI

A8 must NOT rebuild:
- Store Kernel / Order Authority
- Pricing
- Payment/Tender
- Refund authority
- Availability/Capacity
- Customer app order engine
- Keeta provider engine
- Print
- Sync
- Staff/device authority

---

## 1. First RED — duplicate external intent must never create duplicate Order

Write this first.

### Customer case

Given Customer intent:
- submissionId = C1
- idempotencyKey = K1

MFP reads the same pending intent twice due to:
- duplicate external event
- reconnect
- explicit manual refresh

Before human accept:
- formal Order count = 0

After one explicit Accept:
- exactly one formal Store Kernel admission
- one canonical Order O1
- same C1/K1 identity linked
- duplicate Accept/replay returns/readbacks O1
- no duplicate first print/payment/capacity side effect

### Keeta case

Given:
- providerOrderId = K100
- providerMessageId = M100
- provider fingerprint = F100

Duplicate inbound delivery/reconnect must map to:
- one external intent identity
- one canonical Order maximum
- one ACK/readback lineage
- no second Order

P0 rule:

`EXTERNAL DUPLICATE != NEW FORMAL ORDER`

---

## 2. External state authority

A8 external adapter owns transport/readback facts only.

Canonical business truth remains:
- Formal Order → Store Kernel
- Price → formal Pricing authority
- Payment/Refund → A5/A6 formal money authority
- Availability/Capacity → formal operational authority
- Print → A7 authority

Customer / Keeta external state can expose:
- pending intent
- provider/customer evidence
- external status
- ACK/readback
- attention
- defer metadata

It must not become Order truth.

---

## 3. Zero-polling lock

Legacy donor code contains old fallback/focus/interval behavior.
Do NOT copy it.

A8 production source must have:
- no `setInterval` external business polling
- no focus-triggered multi-domain pull
- no visibility-triggered request fan-out
- no fixed 5-second polling

Allowed triggers:
- startup bounded initial read
- explicit external Doorbell/event
- network reconnect through one bounded coordinator
- explicit manual refresh/diagnostics

All concurrent triggers must coalesce through a single-flight external reconcile coordinator per domain or a shared bounded coordinator.

Doorbell/event:
`notification only`
not canonical truth.

---

## 4. Customer pending-order contract

Customer intent may enter MFP as pending.

Required read-model facts:
- submissionId
- idempotencyKey
- customer display name
- phone/contact
- item count
- formal/local preview amount if provided
- service mode
- requested payment method
- payment channel
- payment evidence ref
- createdAt
- current external status
- canonical Order link if committed
- attention/status code

Before formal accept:
- no canonical Order
- no ETA countdown
- no first print
- no capacity consumption
- no payment truth

---

## 5. Customer Pay-at-Store

Flow:

Customer intent
→ MFP pending review
→ staff reviews sellability/content
→ Accept / Modify / Cancel

Accept:
- formal Store Kernel admission
- canonical readback
- only then Order/ETA/Print/Capacity downstream effects

Modify:
- must not silently mutate Customer intent into a committed Order
- produce explicit proposed modification / pending confirmation state where customer confirmation is required

Cancel:
- external pending intent cancellation / rejection
- no Formal Order if not yet committed

No duplicate effect on retry.

---

## 6. Customer electronic payment evidence

Owner rule:
Payment screenshot/evidence is evidence only.

`PAYMENT EVIDENCE != PAYMENT TRUTH`

MFP pending card/detail must show:
- customer name
- items
- item count
- amount
- payment channel
- evidence image/ref
- zoom/open evidence
- review status

Staff review checks may include:
- date
- time
- amount
- image clarity
- whether evidence appears related to this payment

Required states:
- UNREVIEWED
- VERIFIED
- REJECTED / NEEDS_RESUBMISSION

Formal Accept of an electronic-payment Customer order requires:
- evidence VERIFIED
- formal payment/tender admission/readback
- no client-manufactured payment success

Evidence REJECTED:
- order remains pending / needs customer action
- no formal payment
- no formal Order commit unless canonical policy explicitly separates pay-at-store semantics

---

## 7. WhatsApp QR / evidence correction

Pending Customer payment evidence must expose WhatsApp contact action.

Use cases:
- wrong date
- wrong time
- wrong amount
- unclear screenshot
- request new evidence

QR/message intent must be deterministic and based on Customer contact facts.

WhatsApp action:
- does not create Order
- does not mark payment
- does not mark evidence VERIFIED
- does not become a second Customer Order writer

---

## 8. Customer modify/cancel confirmation

For a committed own-platform Order modification:

A6 may expose:
`CUSTOMER_CONFIRMATION_REQUIRED`

A8 owns the external Customer delivery/readback seam.

Flow:
MFP formal modification request
→ external Customer notification
→ Customer ACCEPT / REJECT readback
→ Store Kernel formal follow-up command/readback

Rules:
- no fake confirmation
- no timeout-as-accept
- UNKNOWN remains pending/attention
- amount increase routes to A5 money top-up
- amount decrease/refund routes to A6/A5 refund
- same Order identity

---

## 9. Customer cutoff / immediate stop

Owner FINAL:

MFP may control whether Customer app accepts new orders.

Support:

### Special cutoff
Example:
Today 16:30
→ Customer cannot submit new formal intents after cutoff
→ Customer sees early-stop/unavailable message
→ WhatsApp fallback available

### Immediate stop
Overload:
→ stop new Customer intents now

Rules:
- affects new Customer submissions only
- does not stop MFP local trading
- does not cancel existing Orders
- does not refund existing Orders
- state comes from formal operational/canonical policy/readback
- no client-only hidden toggle truth

If production external propagation binding is missing:
source contract may be SOURCE_VERIFIED, external propagation remains BLOCKED.

---

## 10. Customer WhatsApp fallback

If Customer app cannot reach normal submit path:

Customer app
→ WhatsApp fallback
→ order content sent to store WhatsApp
→ human handling
→ MFP staff creates/processes a formal order through normal MFP authority

Hard rule:
`WHATSAPP FALLBACK != SECOND ORDER WRITER`

A8 may show fallback/handoff evidence.
Do not automatically ingest WhatsApp text into a Formal Order unless a separately authorized parser/contract exists.

---

## 11. Keeta inbound identity

Use exact provider identity.

At minimum:
- provider = KEETA
- providerShopId
- providerOrderId
- providerMessageId
- providerPushedAt
- receivedAt
- fingerprint
- raw provider evidence/ref
- current external intent state
- canonicalOrderId / display once committed

Provider identity + fingerprint must dedupe.

Do not use display number/name/amount as dedupe identity.

---

## 12. Keeta mapping boundary

Keeta provider payload may require mapping to canonical products/options/combo.

A8 may consume:
- Admin-published mapping
- canonical product identities
- provider SKU/SPU ids
- option/combo mapping
- provider authorized commercial facts

A8 must not:
- mutate MFP Direct Price
- invent canonical product mapping heuristically
- accept ambiguous mapping
- silently drop required components

Ambiguous/missing mapping:
→ ATTENTION / pending human action
→ no formal Order admission

---

## 13. Keeta auto/manual accept

Policy source:
formal Admin/canonical channel policy.

### AUTO
If:
- valid mapping
- valid formal sellability/capacity
- no content/provider blocker
- policy autoAccept=true

Then:
- one formal Store Kernel admission
- canonical readback
- ACK provider using canonical identity
- normal downstream Print/production via existing authority

### MANUAL
Pending card must show:
- source / Keeta
- provider order no
- item count
- total
- Immediate Handle
- Later

Manual pending must not be mistaken for accepted.

---

## 14. Keeta Later / defer max 2

Owner exact rule:

`Later != Reject != Cancel != Accept`

Support:
- deferCount 0 → may Later
- deferCount 1 → may Later
- deferCount 2 → cannot Later again

After Later:
- remains pending
- remains visible/attention
- next reminder state preserved

No infinite defer loop.

No fixed polling timer is required to implement reminder.
Use external event / local deadline scheduler without business endpoint polling.

---

## 15. Keeta error attention

On:
- mapping error
- provider content error
- authorization/readback error
- formal admission rejection
- ACK failure
- lifecycle mismatch
- after-sale failure

A8 must surface:
- provider order identity
- error/attention code
- last update
- safe next action

Error must:
- stay human-visible
- not silently drop the order
- not auto-create a second order
- not convert provider failure into local success

---

## 16. Keeta lifecycle events

Consume provider lifecycle events through injected adapter.

Required rules:
- event links to existing canonical Order
- no lifecycle event may create a new Order if canonical link is missing without formal intake
- duplicate providerMessageId idempotent
- out-of-order/stale event must fail closed or require canonical provider reconciliation
- canonical Store Kernel Order remains business truth

Do not import the legacy focus-triggered lifecycle reconcile behavior.

---

## 17. Keeta after-sale / refund

Provider after-sale is external orchestration around A6/A5 formal refund authority.

A8 may support:
- afterSaleOrderId
- providerOrderId
- providerMessageId
- provider status
- requested refund amount/items
- APPROVE / REJECT
- provider reason/reject code
- partial refund preview/application

But formal refund truth remains:
A6/A5 canonical linked refund/adjustment.

Rules:
- provider ACK/decision != local refund truth by itself
- no refund above canonical eligible amount
- same Order retained
- duplicate after-sale event idempotent
- provider failure/UNKNOWN stays attention
- cash/provider tender reporting remains A5 truth

---

## 18. Channel threshold integration

A6 exposes canonical Capacity/channel acceptance facts.

A8 uses them to decide external new-order admission.

Keeta/Customer remote admission:
- respect channel stop/threshold
- do not cancel existing orders after threshold crossing
- do not auto-refund
- local MFP trade remains available

A8 must not calculate a second Capacity truth.

External stop propagation can be BLOCKED until production adapter exists.

---

## 19. Customer / Keeta top pending UI

Owner ordering visual lock already includes top pending/external strip.

A8 binds real external read-model facts into that area.

Pad:
- Customer pending card/group
- Keeta pending card/group
- item count / amount / source identity
- immediate attention
- quick entry to detail/review

Do not overload the strip with full detail.
Click opens a stable major review panel.

Mobile:
- pending inbox/cards
- touch-first detail/review
- same business contracts

No fake fixture data in production path.

---

## 20. External detail/review UI

### Customer
- items
- service mode
- amount
- payment method/channel
- evidence
- WhatsApp contact
- Accept / Modify / Cancel

### Keeta
- provider identity
- items
- mapped canonical facts
- amount/commercial summary
- Immediate / Later
- attention
- lifecycle/after-sale where applicable

All formal actions must show:
- pending/submitting/readback
- REJECTED
- UNKNOWN
- committed/readback

No optimistic fake commit.

---

## 21. External coordinator

Implement one bounded event-driven reconcile coordinator.

Requirements:
- startup initial read
- Doorbell/external event
- reconnect
- manual refresh
- concurrent triggers coalesce
- no parallel duplicate pulls for same external domain
- no infinite trailing loop
- no fixed business polling

New external event observed during in-flight:
- remember/coalesce target
- one bounded recheck after current work

No focus/visibility fan-out.

---

## 22. A2 security integration

External staff actions require valid MFP device/session.

Owner FINAL:
authenticated MFP staff can perform defined frontline operations.
No Manager-only product gate in this Owner version.

Preserve:
- device authorization
- session expiry/revocation
- Store Kernel admission
- provider/external adapter authorization

No external provider credential in client state/logs.

---

## 23. A3/A6/A7 integration

A3:
- external transport must not wake/restart catalog sync fan-out
- no new Store Port head/state

A6:
- committed Customer/Keeta orders appear through canonical Order read model
- refunds/modifications use A6 formal operations
- channel thresholds/capacity read from A6 canonical model

A7:
- formal accepted external Order print jobs use same Print authority
- no external-specific Print engine

---

## 24. Provider credentials / public browser security

A8 production browser source must not contain:
- Keeta secret/app secret
- provider private signing key
- Customer server credentials
- long-lived provider bearer token
- webhook secret

Browser receives only bounded session/adapter results.

Sensitive provider requests execute in server/provider adapter layer.

No secrets in query strings/logs.

---

## 25. Required tests

At minimum:

### Customer identity/pending
1. duplicate Customer intent identity does not duplicate pending item
2. pending Customer intent creates zero Formal Orders before Accept
3. duplicate Accept creates one canonical Order
4. same submissionId/idempotency links to same canonical Order
5. Customer pending does not start ETA
6. Customer pending does not print
7. Customer pending does not consume capacity

### Customer payment evidence
8. evidence != payment truth
9. electronic order cannot accept as paid before evidence VERIFIED
10. evidence REJECTED remains pending
11. WhatsApp action changes no Order/payment truth
12. evidence zoom/detail uses same evidence ref
13. formal payment result still comes from A5/Store Kernel

### Customer modify/cancel
14. own-platform modification can become CUSTOMER_CONFIRMATION_REQUIRED
15. no fake external confirmation
16. external ACCEPT keeps same Order
17. external REJECT keeps same Order and rejects proposed change
18. timeout/UNKNOWN remains pending
19. amount increase routes to money top-up contract
20. amount decrease routes to refund contract

### Customer channel controls
21. special cutoff blocks future Customer new intents
22. immediate stop blocks future Customer new intents
23. cutoff does not cancel existing Order
24. cutoff does not stop local MFP transaction
25. WhatsApp fallback is not a second Order writer

### Keeta identity/dedupe
26. duplicate providerOrderId/providerMessageId/fingerprint does not duplicate intent
27. duplicate Keeta intake creates max one Formal Order
28. committed Keeta ACK links canonical Order/display
29. provider display/amount not used as dedupe key
30. missing/ambiguous mapping blocks formal admission

### Keeta auto/manual
31. AUTO valid order formally admits once
32. AUTO failure remains attention/pending
33. MANUAL pending creates zero Formal Order until Immediate
34. Immediate formally admits once
35. Later does not accept/reject/cancel
36. defer 0 -> 1 allowed
37. defer 1 -> 2 allowed
38. defer 2 -> Later blocked
39. deferred order remains visible/attention

### Keeta lifecycle
40. lifecycle event links to same canonical Order
41. duplicate providerMessageId is idempotent
42. event cannot manufacture new Order when canonical link absent
43. stale/out-of-order event fails closed or requires reconcile
44. ACK failure remains attention

### Keeta after-sale
45. after-sale duplicate event idempotent
46. provider APPROVE alone does not manufacture local refund truth
47. formal refund bounded by canonical eligible amount
48. partial refund preserves original Order
49. alternate/provider refund method readback preserved
50. provider failure remains attention
51. after-sale decision references same canonical Order

### Channel threshold/capacity
52. Customer respects own-platform stop
53. Keeta respects third-party stop
54. threshold crossing does not mutate existing Orders
55. external stop never stops local MFP
56. no second Capacity calculation

### Event-driven transport
57. idle external coordinator performs zero periodic pulls
58. no setInterval business polling
59. no focus-triggered external request
60. no visibility-triggered external request
61. concurrent Doorbell/online/startup triggers coalesce
62. new event during in-flight is not lost
63. bounded trailing recheck only
64. Doorbell/event payload is not canonical truth

### Security
65. valid authenticated frontline staff can act
66. expired/revoked/unknown session fails closed
67. provider secrets absent from browser source
68. no credential query-string/logging

### Cross-stage/authority
69. accepted Customer Order enters A6 canonical Order model
70. accepted Keeta Order enters A6 canonical Order model
71. external accepted Order uses A7 same Print authority
72. external refund uses A6/A5 formal refund authority
73. no second Order engine
74. no second Payment/Refund engine
75. no Customer/Keeta Print engine
76. no new sync head/state
77. no v2 client-state import
78. no SMM authority/state/head/session
79. no periodic business polling
80. A1 green
81. A2 green
82. A3 green
83. A4 green
84. A5 green
85. A6 green
86. A7 green

---

## 26. CI

Extend MFP workflow:

- install
- test
- typecheck
- build
- authority/security/sync/ordering/checkout-money/order-operations/print-hardware/external guard

Static guard rejects:
- `setInterval` external/business polling
- focus/visibility-triggered external fetch in A8 production source
- v2 client-state imports
- SMM authority/session/head
- browser provider secrets
- second Order/Payment/Refund/Print/Capacity engine
- direct provider credential use
- production deploy config

No deploy.

---

## 27. Change control

Mode:
`PREPARE`

Preferred A8 paths:
- current control docs
- A8 handoff
- manifest/workflow
- `v3smt/src/**`
- styles if needed

Contracts:
Reuse existing external contracts where possible.

If a neutral shared contract under `contracts/**` is genuinely missing:
STOP and report the exact contract gap before widening scope.

Do not edit v2 donor files.

---

## 28. Production binding status

A8 may reach:
`SOURCE_VERIFIED`

while production binding remains:
`BLOCKED`

Possible blockers:
- Customer external adapter endpoint/session
- Keeta provider adapter production binding
- Customer confirmation callback
- Keeta lifecycle / after-sale live binding
- external channel stop propagation
- WhatsApp deep-link/QR production details
- public deployment

Do not claim DEPLOYED or PHYSICAL_VERIFIED.

---

## 29. A8 completion target

`SOURCE_VERIFIED`

A8 does NOT mean:
- public deployment complete
- live Keeta provider acceptance complete
- live Customer app acceptance complete
- SMM decommission
- physical acceptance

A9 owns public + diagnostics + physical acceptance + cutover.

---

## 30. Completion report

Return exactly:

1. A8 implemented
2. External authority contract
3. Customer pending-order contract
4. Customer pay-at-store proof
5. Customer payment-evidence proof
6. WhatsApp QR/fallback proof
7. Customer modify/cancel confirmation proof
8. Customer cutoff/immediate-stop proof
9. Customer idempotency/dedupe proof
10. Keeta inbound identity proof
11. Keeta mapping-boundary proof
12. Keeta auto/manual accept proof
13. Keeta defer-max-2 proof
14. Keeta error-attention proof
15. Keeta lifecycle proof
16. Keeta after-sale/refund proof
17. Channel-threshold integration proof
18. External single-flight/zero-polling proof
19. A2 security integration
20. A3 sync isolation proof
21. A6 Order Operations integration
22. A7 Print integration
23. Provider-secret/browser-security proof
24. Pad external/pending UI
25. Mobile external/pending UI
26. No-second-authority proof
27. Changed files
28. Exact SHA
29. Tests/results
30. CI
31. Production binding status
32. Remaining blockers
33. A9 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A8_CUSTOMER_KEETA_EXTERNAL_2026_10_02`
