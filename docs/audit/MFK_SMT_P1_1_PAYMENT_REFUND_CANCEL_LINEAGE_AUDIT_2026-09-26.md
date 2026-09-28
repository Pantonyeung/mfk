# MFK SMT P1-1｜Payment Correction + Refund + Cancel Notice Lineage Audit

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION / NO MERGE
CONTROL: #321
PRECEDENCE: docs/control/MFK_E2E_FREEZE_DATE_AUTHORITY_2026-09-26_0935_HKT.md

## 1. Owner-locked requirement

Dated Owner FINAL record (2026-09-25) locks:
- Payment Method Correction = SAME Order / SAME Display.
- Old tender remains permanent audit history.
- New tender becomes current effective tender.
- Zero new Order / Print Admission / auto reprint / auto drawer.
- Full + Partial Refund.
- Original Order remains parent truth.
- Refund is append-only linked record.
- Cash refund creates Cash Movement OUT.
- Post-production cancel prints minimal cancellation notice only when production was actually issued.
- Repeated cancel must not auto-print a second notice.
- Order modification does not auto-print a modification notice.

Later Owner requirements also lock:
- reporting counts only current effective tender after correction;
- cross-day refund/correction must not rewrite the old daily report; append linked adjustment/refund lineage instead.

## 2. Exact historical accepted donor

Do NOT use cumulative PR #306 as the first donor for this slice.

Exact accepted preview candidate:
- product candidate: ab1c7132dcecaa674e304d7a446094bd76887e4b
- validated run: 36127886972 SUCCESS
- 37/37 test files PASS
- 169/169 tests PASS
- build GREEN
- preview worker version: 2bf2b39c-89ae-48cb-af93-6479a780a325
- preview PR #289 CLOSED / NOT MERGED
- production unchanged

Feature commit chain:
- a108fc4afdc1b55492c86b2b550dc08211935cde — append-only local cash movement ledger
- ca19432161d8d92a4fae3f20e9aff6d5d8ea885c — linked refunds + post-production cancel notice
- d71267df257f48dc3d47cbf311687b541c67e66b — expose payment correction/refund history to Orders
- 6dba84fa51f3ad16ef477a5bc09c89c72034a9b4 — Orders payment-correction/refund UI
- 0e99222ea173321ec91d7903cb8489f0bf0ff001 — expose runtime port methods
- 849f0331810bd9c88420e13f72e9f7195839159f — UI styles
- 623c1402793aadf9db8e4ccf7cbea0c3336beba6 — cash movement idempotency test
- 902dec6f7eaec84e0fcc2ee968213f46e5394b71 — linked refund + cash movement tests
- 9d0a947ece5e94ea08a0d40282d98f9513e161e1 — Owner FINAL correction/refund/cancel-notice contract test
- 4118ff674ab16765bfdd94e93240deaba4a08b04 / ab1c7132... — JSX cleanup/final preview candidate

## 3. Current main reality

Current main: 5224e373e01cfad91fcebdc797b18da016ba1c2c

Current main already has:
- SAME Order local edit primitive
- cancelOrder state change + audit
- reprint primitives
- Customer payment evidence review
- Keeta after-sale/refund provider path
- current Staff Auth / ORDER_CORRECTION UI gate
- existing print router
- current projection outbox

Current main does NOT contain the accepted local Owner FINAL lineage:
- PaymentCorrectionRecord
- OrderRefundRecord
- correctOrderPayment()
- refundOrder()
- paymentCorrections/readback
- refunds/readback
- productionIssuedAt
- cancellationNoticePrintedAt/state
- dispatchCancellationNotice()
- local Cash Movement ledger used by cash refund
- Owner FINAL Orders UI for local correction/refund/audit

Classification:
BANKED_LINEAGE_GAP

This is not permission to redesign Payment/Refund authority.

## 4. Exact donor behavior

### Payment Correction
Donor:
- changes only StoredOrder.paymentLabel.
- appends PaymentCorrectionRecord {from,to,staff,time}.
- same Order identity remains.
- no print call.
- no drawer call.
- retry to the already-current tender becomes a no-op.

Result:
SEMANTIC FIT = GOOD.

### Refund
Donor:
- appends OrderRefundRecord.
- never deletes/replaces original Order.
- cumulative refund cannot exceed original total.
- Full refund must equal remaining refundable balance.
- actual refund method + note + staff are retained.
- CASH refund appends LocalCashMovement OUT.
- cash movement itself is idempotent for a supplied movement id.

Result:
SEMANTIC FIT = GOOD, but operation-level retry hardening is required before integration.

### Cancel Notice
Donor:
- records productionIssuedAt only after a successful 製作單 dispatch.
- cancellation only dispatches notice when productionIssuedAt exists.
- once Order is already cancelled, repeated cancel returns without another automatic notice.
- cancellation notice uses production printer route.
- kickDrawer=false.
- modification does not trigger a notice.

Result:
SEMANTIC FIT = GOOD.

## 5. Integration risks discovered

### R1 — Partial Refund retry identity
refundOrder creates a new refundId inside every invocation using Date.now.
If a PARTIAL refund succeeds but its UI response is lost, a blind retry with the same amount could create a second linked refund while refundable balance remains.

This conflicts with banked no-blind-retry / UNKNOWN-readback-first semantics.

Required convergence:
- stable refund operation identity / idempotency key;
- readback by same identity before creating another refund;
- Cash Movement id remains derived from that stable refund identity.

Do not alter refund business semantics.

### R2 — Permission enforcement location
Orders UI is gated by ORDER_CORRECTION, but correctOrderPayment/refundOrder donor methods themselves do not enforce permission.

Required integration review:
- preserve current Admin Staff/RBAC authority;
- fail closed at the mutation admission boundary, not only visual hiding.

Do not create a second auth engine.

### R3 — Reporting / Daily Close dependency
Donor buildLocalReport:
- uses current paymentLabel, so Payment Correction naturally moves current tender classification.
- does not deduct/ref-project OrderRefundRecord into net sales.
- does not implement the later cross-day immutable report + linked adjustment version semantics.

Therefore the refund UI/core must not be treated as full reporting closure.

Required:
- preserve immutable old daily report;
- project/ref report linked refund/adjustment facts separately;
- zero double deduction;
- current effective tender counted once.

### R4 — Cancellation notice physical fidelity
Preview proved software behavior only.
Cancellation notice uses the existing production route with kickDrawer=false, but real printer physical output is not proven by the preview.

This is a last-mile physical validation item only; it does not reopen Print authority.

### R5 — Whole-branch contamination
ab1c713... is 141 commits ahead / 303 behind current main with merge base 7c1a64f...
Never cherry-pick or merge the cumulative branch as a whole.

Use exact feature-level extraction only.

## 6. Smallest future integration allowlist

No code executed in this audit.

When implementation is authorized, create a clean branch from fresh current main and restrict initial slice to:

v2local/src/runtime/local-runtime.ts
- PaymentCorrectionRecord / OrderRefundRecord
- StoredOrder lineage fields
- exact mutation/readback methods
- production-issued/cancel-notice state
- no unrelated Dining/Ordering changes

v2local/src/runtime/local-operations.ts
- LocalCashMovement primitive only
- stable idempotent identity

v2local/src/presentation/RuntimeOrdersWorkspace.tsx
- payment correction / refund / audit / cancel-notice display
- keep current Customer/Keeta/order-lane behavior intact

v2local/src/presentation/orders-workspace.css
- only required UI styles

tests
- deterministic behavior tests, not string-presence only
- permission tests
- same-operation retry tests
- restart/readback tests
- current-effective-tender reporting regression
- refund no-double-deduction regression
- cancellation notice once-only regression

No changes to:
contracts/**
Customer bridge
SMM bridge
Keeta adapter/provider commands
Admin worker
Store Kernel identity/allocation
Pricing
Print Router
Owner port

## 7. Required RED contracts before landing

PC-01 SAME Order / SAME Display after correction.
PC-02 A→B→C leaves full immutable correction history and C as effective tender.
PC-03 repeated same correction is no-op.
PC-04 correction creates zero Print Admission / reprint / drawer / new Order.
PC-05 unauthorized mutation fails closed at runtime boundary.
PC-06 restart preserves effective tender + history.

RF-01 partial + full refunds append to same Order.
RF-02 cumulative refund never exceeds remaining.
RF-03 same refund operation retry creates one refund only.
RF-04 same CASH refund retry creates one Cash Movement OUT only.
RF-05 refund never auto-opens drawer.
RF-06 original Order gross facts remain immutable.
RF-07 effective/net reporting applies refund once.
RF-08 cross-day refund creates linked later adjustment; old daily report stays immutable.

CN-01 cancel before production = zero cancel notice.
CN-02 successful production then cancel = one minimal cancel notice.
CN-03 repeated cancel = zero second auto notice.
CN-04 cancel notice kickDrawer=false.
CN-05 modification = zero auto modification notice.
CN-06 UNKNOWN print state stays UNKNOWN / attention; no blind duplicate notice.

Cross-port:
- Customer current E2E unchanged.
- SMM current E2E unchanged.
- Keeta K1-K8 / provider lifecycle unchanged.
- Admin publish/RBAC unchanged.

## 8. Conclusion

P1-1 classification:
BANKED_LINEAGE_GAP / EXACT DONOR FOUND / NOT SAFE TO WHOLESALE MERGE.

Recommended next implementation shape:
restore accepted correction/refund/cancel lineage from exact dated donor,
while adding only the minimum idempotency/permission/reporting guards required by the already-banked system contracts.

No new product semantics are required.

STATUS:
P1_1_EXACT_DONOR_AND_RISKS_MAPPED
PRODUCT_UNCHANGED
NEXT = OWNER_CONFIRM_OR_CONTINUE_TO_P1_2_AUDIT
