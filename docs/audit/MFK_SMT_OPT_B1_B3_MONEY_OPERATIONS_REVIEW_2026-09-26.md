# MFK SMT Optimization B1-B3 Review｜Payment Correction / Refund / Cancel Notice

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: #321
BASELINE: current main
A1: PR #322 READY_FOR_OWNER_ACCEPTANCE / NOT MERGED

## 1. Donor reviewed

PR #289 exact GREEN product donor:
ab1c7132dcecaa674e304d7a446094bd76887e4b

Recorded proof:
37/37 test files PASS
169/169 tests PASS
build GREEN
preview only / NOT MERGED

Important:
The full donor diff also contains unrelated ordering/runtime work.
Do NOT transplant the full diff.

## 2. B1 — Payment Correction

### Current main
Current main has paymentLabel as current payment display/reporting fact.
It does NOT currently expose:
- PaymentCorrectionRecord
- paymentCorrections[]
- correctOrderPayment()

### Donor behavior
Donor implements:
- SAME Order identity
- no new Display number
- update current paymentLabel
- append {from,to,time,staff} correction history
- project updated SAME Order
- no automatic reprint
- no automatic drawer action

### Reporting interaction
Current local report reads the Order's current paymentLabel.
Therefore a targeted correction can naturally change current effective tender reporting while audit history remains separate.

### Assessment
B1 can be isolated from the larger donor.

Risk:
MEDIUM because it changes money classification, but it does not require a second payment engine.

Recommendation:
Implement B1 separately, with deterministic tests:
CASH→FPS→PAYME
final effective tender = PAYME
history = CASH→FPS + FPS→PAYME
same Order
no new Display
no new Print Admission
no auto reprint
no drawer
restart preserves history/current tender

Classification:
BOUNDED_MONEY_OPTIMIZATION.

## 3. B2 — Full / Partial Refund

### Current main
Current main does NOT contain:
- OrderRefundRecord / refunds[]
- refundOrder()
- LocalCashMovement / appendLocalCashMovement general ledger

Baseline Keeta after-sale/refund handling exists separately and must not be changed.

### Donor behavior
Donor:
- appends linked refund to original Order
- guards refundable remainder
- supports FULL/PARTIAL
- records staff/note/method
- for CASH refund creates OUT cash movement
- does not automatically open drawer

### Critical dependency
Refund is not only an Orders-page UI feature.
It changes:
- effective net sales
- cash balance
- day-close expectation
- reporting
- later adjustment history

Current main reporting does not yet prove full refund-aware immutable-report semantics.

### Assessment
Do NOT integrate B2 immediately after B1.

First define/refine one existing cash/reporting authority for refunds.
No second ledger.

Classification:
DEFERRED_MONEY_LEDGER_OPTIMIZATION.

## 4. B3 — Cancellation Notice

### Current main
Current cancelOrder():
- keeps same Order
- sets 已取消
- stores cancellation reason
- does not auto refund/reprint/drawer

But current main does NOT track:
- productionIssuedAt
- cancellationNoticePrintedAt
- cancellationNoticeState

### Donor behavior
Donor:
- marks productionIssuedAt only when production print actually succeeds
- cancellation prints notice only if production was really issued
- cancellation notice routes to production printer
- kickDrawer=false
- notice certainty = DONE / FAILED / UNKNOWN
- repeated cancel is idempotent

### Critical dependency
This touches print certainty and evidence.
It must not infer production from Order state alone.

### Assessment
B3 is separable from refund, but should land only with targeted print-certainty tests.

Classification:
MEDIUM_RISK_PRINT_OPTIMIZATION.

## 5. Revised money/operations order

After low-risk SMT presentation/cart optimizations:

B1 Payment Correction
→ separate acceptance/bank

B3 Cancellation Notice
→ print-certainty acceptance/bank

B2 Refund
→ only after refund-aware cash/reporting semantics are explicitly closed

Do not bundle B1+B2+B3.

## 6. E2E protection

None of B1-B3 may change:
- Customer payment-evidence verification
- Keeta provider refund/after-sale path
- SMM/Customer/Admin/Keeta intake
- Checkout first-commit authority
- Print Router / Print Admission authority

## 7. Status

B1_ISOLATABLE_BOUNDED_MONEY_OPT
B3_ISOLATABLE_WITH_PRINT_CERTAINTY
B2_DEFER_UNTIL_CASH_REPORTING_CLOSURE
NO_PRODUCT_MUTATION
FIVE_PORT_E2E_PRESERVED
SECOND_SMT_TEAM_PAUSED
