# MFP V3｜Codex Implementation Handoff｜A7 Print + Hardware + Recovery｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A7-PRINT-HARDWARE-RECOVERY-2026-10-02`

Parent:
- PR #643 — MFP V3 A6｜Order Operations｜2026-10-02
- Parent exact head: `881afbd5fd463b4833e3b5980123fe33679bb260`
- A6 status: SOURCE_VERIFIED
- Owner acceptance: EXPLICIT

Visual lock:
`docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`

Controlling plans:
- `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
- `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Read-only donor / existing-authority evidence:
- `docs/implementation/MFK_ADMIN_V3_PRINT_TRANSPORT_EVIDENCE_R1_HANDOFF_2026-10-01.md`
- `carrier/android/app/src/main/java/com/morefunos/smt/PrintCommandController.java`
- `carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/NativePrintGatewayService.java`
- `carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/PrintGatewayStore.java`
- `carrier/android/app/src/main/java/com/morefunos/smt/print/SitePrinterBindingStore.java`
- `v2local/src/runtime/print-routing.ts`
- `v2local/src/runtime/native-print.ts`
- `v2local/src/runtime/print-content.ts`
- `v2local/src/runtime/smt-owner-print-recovery-a2.test.ts`
- `v2local/src/runtime/dining-first-print-d2.test.ts`
- `v2local/src/runtime/dining-payment-receipt-d3.test.ts`
- runtime/carrier boot/recovery evidence

Do not import v2 client state/runtime into V3.
Do not rebuild the existing Carrier native print gateway.

---

## 0. A7 objective

A7 connects the source-verified MFP business layers to one bounded Print / Hardware / Recovery seam without creating a second Print authority.

A7 scope:

1. Canonical PrintJob read model
2. Durable print transport evidence
3. Browser → Carrier print gateway binding seam
4. Site physical printer binding
5. Printer endpoint test / health
6. Receipt / Production / Packing / Label routing consumption
7. Order reprint
8. Per-label partial reprint
9. Dining print / receipt / labels
10. Cancel-notice print
11. Cash drawer hardware action boundary
12. Printer-failure attention
13. App / process / reboot recovery semantics
14. Network-loss local print continuity
15. Hardware / Print UI under the locked MFP visual system
16. source-level recovery diagnostics

A7 does NOT rebuild:
- Print Router
- Durable PrintJob authority
- Order Authority
- Pricing
- Payment/Tender
- Fulfillment
- Availability/Capacity
- Customer/Keeta provider logic
- Carrier print driver

---

## 1. First RED — power-loss / ambiguous print safety

Write this first before implementation.

Scenario:

- Canonical PrintJob `J1` exists.
- Local gateway durably persists the dispatch attempt.
- Physical dispatch reaches `DISPATCHING / WRITE_STARTED`.
- No trustworthy printer ACK is available.
- App/process/device restarts before a definitive result is known.

Expected after restart:

- `J1` is NOT auto-reprinted.
- transport state becomes / remains `UNKNOWN` or `AMBIGUOUS_AFTER_SEND`.
- no second physical dispatch is issued automatically.
- original `J1` identity and evidence are preserved.
- UI raises human attention.
- only an explicit human reprint action may create a NEW canonical reprint job / reprint intent.
- reprint suppresses cash-drawer pulse and does not replay Order/Payment/Fulfillment side effects.

This is the A7 P0 safety rule:

`UNKNOWN PRINT OUTCOME != SAFE TO RETRY`

---

## 2. Existing native gateway facts to preserve

The existing Android Carrier already provides source evidence for:

- durable local gateway persistence before dispatch
- `canonicalPrintJobId`
- unique `dispatchAttemptId`
- endpoint bindings
- LAN/Sunmi dispatch
- process restart recovery
- `ACKNOWLEDGED`
- `FAILED_BEFORE_SEND`
- `AMBIGUOUS_AFTER_SEND`
- payload digest
- queue snapshot
- no blind retry of a `DISPATCHING` job after restart

Do not replace these semantics with a browser-only print queue.

MFP V3 should bind to this authority through an injected adapter.

---

## 3. Print authority model

Formal Print truth remains:

`Store Kernel / Print Router / Durable PrintJob`

MFP UI may display:
- planned
- queued
- dispatching
- acknowledged transport
- failed-before-send
- unknown/ambiguous transport
- job route/type
- physical target
- timestamps
- error/attention codes

MFP UI must NOT claim:
- paper definitely physically emerged
- kitchen definitely saw the ticket

unless a formal physical evidence source exists.

Owner rule:
`Transport Evidence != Physical Paper Proof`

No fake green.

---

## 4. Canonical PrintJob contract

Create a neutral V3 PrintJob read model / injected port.

At minimum each canonical job should expose:

- canonicalPrintJobId
- orderId / reportId / sourceRef where applicable
- jobType
- routeId / logical destination
- templateId / template revision
- payload identity / digest where safe
- createdAt
- canonical state
- transport evidence state
- last attempt identity
- physical binding identity if resolved
- lastCode / attention
- reprintOfPrintJobId when applicable

Required job types should support existing Owner scope:
- RECEIPT
- PRODUCTION
- PACKING
- TABLE_TICKET
- PRODUCT_LABEL
- BAG_LABEL
- CANCEL_NOTICE
- DAILY_REPORT

Do not create another PrintJob ledger in React/Zustand/Dexie.

---

## 5. Transport state vocabulary

V3 client should normalize the gateway evidence into explicit states such as:

- NOT_STARTED
- PERSISTED
- DISPATCHING
- ACKNOWLEDGED
- FAILED_BEFORE_SEND
- UNKNOWN / AMBIGUOUS_AFTER_SEND

Rules:

### FAILED_BEFORE_SEND
Known not physically sent.
May be eligible for an explicitly authorized safe retry using the formal Print authority.

### ACKNOWLEDGED
Transport/device-level acknowledgment only.
Do not overstate as human paper confirmation.

### UNKNOWN / AMBIGUOUS_AFTER_SEND
May have printed.
Never blind retry automatically.
Requires human decision / explicit reprint.

A browser timeout by itself must not convert to safe FAILED.

---

## 6. Print gateway adapter

Create an injected MFP print gateway transport seam.

Expected operations may include:
- readGatewaySnapshot
- enqueueCanonicalPrintJob
- readEndpointBindings
- applyEndpointBinding
- probeEndpoint
- testEndpoint

No hard-coded production bridge endpoint.

Browser source must not own durable dispatch truth.

Adapter translates:
MFP canonical job
→ Carrier gateway request
→ transport evidence readback

No periodic print polling.
Use event/readback/manual diagnostic triggers.

---

## 7. Admin vs local printer responsibility

Owner FINAL authority split:

### Admin owns
- Product Printing Rule
- Product → Logical Print Destination
- Template authoring/publish
- published Print configuration

### MFP local owns
- physical printer identity
- physical host/IP
- port
- model/capability
- transport
- local binding to Admin logical destination
- selection of an Admin-published template where Owner contract permits local selection
- actual local dispatch

MFP must NOT:
- author a new formal template
- redefine Product → Printer routing
- put physical printer IP into canonical product business rules

---

## 8. Site printer binding model

Support bounded local binding facts similar to existing Carrier capability:

- bindingId / slotId
- displayName
- model
- transport
- host/IP for TCP
- port
- capability
- encoding
- enabled
- logicalDestinationId
- publishedTemplateId
- optional drawer pin when hardware supports it

Capabilities at minimum:
- 80mm / kitchen receipt-style
- label printer

Validation:
- invalid IP/host/port fails closed
- corrupt binding fails visibly
- restart preserves valid local binding
- binding changes are local hardware configuration, not product-routing changes

Owner FINAL says authenticated MFP staff may change local printer IP/binding; no Manager-only product gate in this version.

Formal device/session auth remains.

---

## 9. Printer health / test

A7 must provide:

- endpoint configured / missing
- reachable / unreachable where probe is available
- last test time
- last transport code
- current binding
- queue/gateway state
- attention state

Test Print / Probe:
- must be explicit human action
- must not create a Formal Order
- must not trigger payment
- must not trigger fulfillment
- should be clearly marked test/diagnostic output

Do not infer physical paper success from TCP connect alone.

---

## 10. Initial print / first formal output

Formal transaction/Order authority decides when print jobs are created.

A7 must never create initial business print jobs merely because:
- a page opened
- a component mounted
- Checkout opened
- order detail opened

One canonical initial PrintJob identity must not be recreated after restart/re-render.

Duplicate UI clicks must not duplicate first-print jobs.

---

## 11. Order reprint — Owner exact semantics

Reprint entry belongs to:
`Order Detail -> Reprint`

Not Printer Settings.

Reprint must create/use formal reprint intent/job.
It must NOT mutate the Order.

### 80mm-style outputs
At minimum:
- Receipt
- Production
- Packing

Owner rule:
`WHOLE TICKET REPRINT`

Do not require selecting individual products for 80mm ticket reprint.

### Labels
Labels are independently selectable units.

Flow:
Order
→ Reprint
→ Label
→ Select Label Route
→ Show labels for that route
→ All / Multi / Partial selection

Required:
- route-specific grouping
- each label has stable selectable identity
- reprint 2 of 5 is allowed
- other label routes remain untouched

---

## 12. Reprint side-effect guard

Reprint:
- same Order
- new PrintJob/reprint identity
- references original output/job where possible

Must NOT:
- reopen Cash Drawer
- re-charge payment
- mark fulfillment
- resend Order
- repeat production admission
- mutate order amount
- change tender
- replay unrelated print jobs

Drawer pulse must be suppressed on reprint.

---

## 13. Dining print

Dining uses the same Print authority.

From Dining page/table detail allow formal print/reprint entry for:

- Production
- Packing
- Table ticket / unpaid immediate ticket
- Dining-related Labels
- payment receipt where canonical payment print job exists

Owner rule:
Table ticket may print before payment.
That does NOT mean:
- paid
- completed

No separate Dining Print Engine.

Waiting-to-table transfer must not automatically repeat the initial print if it already has canonical evidence.

Dining addition:
only new material addition jobs may be produced, not the full original order again unless formal Print Router says so.

---

## 14. Cancel notice

A6 already exposes:
`CANCEL_NOTICE_REQUIRED`

A7 binds that intent to the formal Print authority.

If an Order was dispatched to production and later cancelled:
- create/observe one formal cancel-notice job
- target formal Production route
- no drawer
- no payment side effect
- idempotent

Modification after kitchen dispatch:
Owner rule remains:
- no automatic correction notice print
- human communication

Do not override this with an invented automatic correction ticket.

---

## 15. Cash drawer boundary

Cash drawer is hardware execution tied to an already authorized money/receipt event.

Rules:
- no drawer on Checkout open
- no drawer on tender selection
- no drawer on Final Review
- no drawer on Payment Correction
- no drawer on Reprint
- no drawer on failed/unknown payment
- no drawer on non-cash tender unless formal policy explicitly requires it
- duplicate payment/readback must not duplicate drawer pulse

If receipt PrintJob formally carries `kickDrawer=true`, A7 may execute it once through the hardware/print gateway.

Drawer execution evidence is transport/hardware evidence, not Payment authority.

---

## 16. Printer failure attention

Owner FINAL:
Printer failure
→ visible attention
→ human inspection

A7 UI must distinguish:
- failed before send
- unknown after send
- endpoint unreachable
- missing binding
- payload/config invalid
- acknowledged transport

At minimum display:
- affected job/order
- printer
- route/type
- state
- timestamp
- code
- next safe action

Do not silently retry UNKNOWN.

Do not hide a print failure behind a green order status.

---

## 17. Safe retry vs reprint

### Safe retry
Only when formal evidence proves the job was NOT sent, e.g. FAILED_BEFORE_SEND, and the Print authority permits retry of the same formal job/attempt model.

### Reprint
Human explicit new output request after:
- confirmed prior print
- UNKNOWN / ambiguous result
- damaged/lost paper
- operational need

Must create a new reprint identity / auditable print action.

Do not blur these two.

---

## 18. Restart / power-loss recovery

A7 source must support recovery across:
- React remount
- browser reload
- app process restart
- Android Carrier service restart
- device reboot evidence where the Carrier supports it

Rules:
- canonical PrintJob remains canonical
- local gateway PERSISTED job may resume safely if never dispatched
- local gateway DISPATCHING job after restart becomes UNKNOWN/AMBIGUOUS, not auto-resend
- completed/acknowledged job does not re-dispatch after restart
- endpoint bindings persist
- UI reconstructs state from canonical + gateway readback
- no memory-only “printed” truth

A7 source completion does NOT equal physical power-loss acceptance.
That remains BLOCKED until A9 physical tests.

---

## 19. Network-loss behavior

WAN/Cloud failure must not block local print if:
- Store Kernel is local and available
- canonical print job already exists
- local printer route/binding exists
- Carrier gateway is available

Printer LAN failure only affects that printer/route.
It must not freeze unrelated MFP transactions.

No print path may call unrelated cloud services to dispatch local tickets.

---

## 20. Hardware / peripheral surface

A7 should create the functional MFP local hardware surface under More/Tools.

At minimum:
- Printers
- Printer bindings
- test/probe
- queue/evidence
- failure attention
- drawer capability/status where available
- recovery state

Other peripherals may be represented only where a real adapter/contract exists.
Do not invent fake hardware support.

---

## 21. UI visual lock

Pad A7 UI must extend:
`MFP_PAD_ORDERING_VISUAL_LOCK_R1`

Keep:
- blue visual language
- white operational cards
- high-density layout
- stable actions
- top hamburger for More/Tools
- readable warning/attention

Mobile:
- touch-first
- same visual identity
- no shrunken Pad
- no horizontal overflow

Final pixel polish may continue later, but A7 cannot introduce another design language.

---

## 22. Recovery diagnostics

A7 may expose source-level diagnostics such as:

- gateway available/unavailable
- queue depth
- latest gateway job
- carrier/runtime identity if already safely available
- binding count
- printer test result
- last ambiguous job

Do not absorb the full A9 Diagnostics scope.
A7 diagnostics are limited to Print/Hardware/Recovery.

---

## 23. Persistence / authority rules

TanStack Query:
- canonical PrintJob/readback
- gateway snapshots / explicit diagnostics
- no periodic business polling

Zustand:
- selected printer/job
- dialogs
- test form state
- reprint selection UI

Dexie:
- may hold bounded client evidence/cache metadata only if necessary
- must NOT become PrintJob authority
- do not duplicate Carrier durable gateway queue in browser storage

Android gateway database remains local transport persistence where already implemented.

---

## 24. Production binding strategy

A7 should use injected adapters.

Where the actual browser/Carrier bridge is not safely bound in V3:
- runtime adapter must fail closed
- no fixture fallback in production path
- source can be SOURCE_VERIFIED
- production binding stays BLOCKED

Do not modify Carrier production code unless the handoff requirement cannot be fulfilled with the existing gateway.
If a Carrier change is genuinely required:
STOP and report exact gap before expanding blast radius.

---

## 25. Required tests

At minimum:

### P0 durable / UNKNOWN
1. persisted-before-send job can recover without duplicate canonical job
2. DISPATCHING at process restart becomes UNKNOWN/AMBIGUOUS
3. ambiguous job does not auto-dispatch again
4. acknowledged job does not dispatch again after restart
5. UNKNOWN cannot be silently converted to DONE
6. UNKNOWN cannot be silently converted to FAILED_BEFORE_SEND
7. explicit human reprint after UNKNOWN uses new reprint identity

### Canonical PrintJob
8. MFP reads canonical PrintJob identity/readback only
9. UI cannot manufacture a canonical PrintJob
10. duplicate component mount creates zero duplicate initial jobs
11. duplicate click does not create duplicate first-print job
12. job/order linkage preserved

### Gateway
13. canonicalPrintJobId passed to gateway
14. dispatchAttemptId stable per attempt
15. payload digest/identity preserved
16. corrupt/missing target fails before send
17. browser timeout remains uncertain unless gateway readback proves otherwise
18. no periodic print polling

### Binding / health
19. physical binding survives restart/readback
20. invalid host/port fails closed
21. binding cannot change Admin product routing
22. test/probe creates no Order/Payment/Fulfillment effect
23. reachability does not claim physical paper success

### Initial print
24. first formal output created only by formal Print authority
25. opening Order Detail creates zero initial print jobs
26. restart cannot duplicate first print

### Reprint
27. Reprint entry comes from Order Detail
28. receipt whole-ticket reprint
29. production whole-ticket reprint
30. packing whole-ticket reprint
31. label route selection
32. label all-select
33. label multi-select
34. label partial 2-of-5 reprint
35. one route reprint does not touch another route
36. reprint preserves Order truth
37. reprint does not re-charge payment
38. reprint suppresses drawer
39. reprint does not replay production admission

### Dining
40. unpaid table ticket may print without marking paid/completed
41. Dining initial print uses same formal Print authority
42. waiting-to-table transfer does not duplicate initial print
43. Dining addition prints only canonical delta jobs
44. Dining payment receipt is tied to canonical payment result
45. Dining label keeps per-label selection semantics

### Cancel notice
46. dispatched cancel creates/observes one cancel-notice job
47. duplicate cancel does not duplicate notice job
48. modification after dispatch creates no automatic correction print

### Drawer
49. no drawer on Checkout open
50. no drawer on tender selection
51. no drawer on Final Review
52. no drawer on Payment Correction
53. no drawer on Reprint
54. no drawer on failed/UNKNOWN payment
55. cash canonical receipt can pulse drawer once when formal job requests it
56. duplicate readback does not pulse drawer twice

### Failure attention
57. failed-before-send shown distinctly
58. ambiguous-after-send shown distinctly
59. missing binding attention shown
60. unknown job requires human action
61. no blind retry button for UNKNOWN without explicit reprint semantics

### Recovery/offline
62. browser reload reconstructs from readback
63. Carrier restart recovery semantics preserved
64. local print path has no unrelated cloud fetch
65. printer failure does not block unrelated transaction UI
66. binding/readback corruption fails visibly

### Regression / authority
67. A1 green
68. A2 green
69. A3 green
70. A4 green
71. A5 green
72. A6 green
73. no v2 client-state import
74. no SMM authority/state/head/session
75. no second Print/Order/Payment/Pricing engine
76. no browser DurablePrintJob authority
77. no production deploy config
78. MFP Pad/Mobile share Print/Hardware contracts

---

## 26. CI

Extend the MFP workflow:

- install
- test
- typecheck
- build
- authority/security/sync/ordering/checkout-money/order-operations/print-hardware-recovery guard

Static guard should reject:
- v2 client-state imports
- SMM business authority
- browser/local creation of a second Print authority
- `setInterval` print/business polling
- auto retry of UNKNOWN/AMBIGUOUS print outcome
- reprint with drawer pulse
- production deployment config
- direct cloud dependency for local print dispatch

No deploy.

---

## 27. Change control

Mode:
`PREPARE`

Preferred A7 scope:
- current control docs
- A7 handoff
- manifest/workflow
- `v3smt/src/**`
- styles if needed

Carrier source:
READ ONLY by default.

Do not edit v2 donor files.

If Carrier changes are necessary:
STOP and report blocker first.

---

## 28. Production binding status

A7 may reach:
`SOURCE_VERIFIED`

while production binding remains:
`BLOCKED`

Possible blockers:
- V3 browser → Carrier gateway binding
- real physical printer endpoint binding
- actual cash drawer hardware
- physical label/receipt printers
- real reboot/power-loss acceptance
- production Store Kernel PrintJob readback binding

Do not claim DEPLOYED or PHYSICAL_VERIFIED.

---

## 29. A7 completion target

`SOURCE_VERIFIED`

A7 does NOT mean:
- Customer/Keeta external complete
- public deployment complete
- physical printer acceptance complete
- OTA complete
- SMM decommission

A8 remains Customer + Keeta + External.

---

## 30. Completion report

Return exactly:

1. A7 implemented
2. Canonical PrintJob contract
3. Print transport evidence contract
4. Durable UNKNOWN/restart safety proof
5. Gateway adapter contract
6. Admin-vs-local printer authority proof
7. Site printer binding contract
8. Printer health/test proof
9. Initial print idempotency proof
10. Order reprint proof
11. 80mm whole-ticket semantics
12. Per-label partial reprint proof
13. Reprint no-side-effect proof
14. Dining print proof
15. Dining payment receipt proof
16. Dining addition/delta print proof
17. Cancel-notice print proof
18. Cash drawer boundary proof
19. Printer failure attention proof
20. Safe retry vs reprint proof
21. Restart/power-loss recovery proof
22. Offline/local print continuity proof
23. Print/Hardware UI
24. Recovery diagnostics
25. Pad/Mobile shared-contract proof
26. No-second-authority proof
27. Changed files
28. Exact SHA
29. Tests/results
30. CI
31. Production binding status
32. Remaining blockers
33. A8 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A7_PRINT_HARDWARE_RECOVERY_2026_10_02`
