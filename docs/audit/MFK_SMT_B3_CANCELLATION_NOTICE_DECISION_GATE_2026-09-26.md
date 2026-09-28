# MFK SMT B3 Cancellation Notice｜Decision Gate Audit｜2026-09-26

## STATUS
AUDIT COMPLETE / OWNER PRINT-SIDE-EFFECT DECISION REQUIRED / NO PRODUCT MUTATION

## Fresh current main
`7b4dfc049339d9cfe8b37e46029530f5ea42fe27`

B1 is banked and OTA GREEN.

## Current main
Current `cancelOrder()`:
- keeps SAME Order;
- changes fulfillment to 已取消;
- stores optional cancellation reason;
- appends action audit;
- does NOT auto refund;
- does NOT reprint;
- does NOT open drawer.

Current print fanout already returns per-job physical result:
- each result has jobId / role / ok / code;
- therefore a successful 製作單 can be distinguished from a merely planned or failed production print.

Current StoredOrder does NOT yet record:
- productionIssuedAt;
- cancellationNoticePrintedAt;
- cancellationNoticeState.

## Donor behavior reviewed
Donor B3 adds:
1. `productionIssuedAt` only after a 製作單 result actually succeeds.
2. On staff cancellation, if production was issued and no cancellation notice was already attempted:
   - send one cancellation notice to production printer route;
   - `kickDrawer=false`;
   - persist certainty as DONE / FAILED / UNKNOWN.
3. Repeated cancel is idempotent and does not print a second cancellation notice.
4. No production success => no cancellation notice.
5. Provider/Keeta lifecycle is not changed by this bounded donor behavior.

## Protected seams
B3 must not change:
- Print Router / normal Print Admission rules;
- receipt / packing / label fanout;
- cash drawer behavior;
- Payment / Refund;
- Keeta provider cancellation/refund path;
- Order identity.

## Real Owner decision
This introduces a new physical print side effect after staff cancellation.

### P1 — Automatic cancellation notice
After staff confirms cancellation:
- if a production ticket had actually printed successfully before, automatically print ONE cancellation notice to production printer(s);
- if production never succeeded, print nothing;
- repeated cancel prints nothing extra;
- drawer never opens;
- UI shows DONE / FAILED / UNKNOWN.

### P2 — Manual cancellation notice
Cancellation itself never prints.
If production had previously printed, UI shows 「製作單已出，建議打印取消通知」 and staff manually presses a print button.

## Recommendation
P1.

Reason:
once kitchen production was physically issued, cancellation is operationally urgent; requiring a second manual button creates the exact risk of kitchen continuing to make a cancelled item. The guard is narrow because it triggers only from confirmed prior production-print success.

## Pending
Owner choose P1 or P2.

Until chosen:
B3_AUDIT_COMPLETE
B3_PRINT_SIDE_EFFECT_DECISION_REQUIRED
NO_B3_PRODUCT_MUTATION
B2_REFUND_STILL_DEFERRED
