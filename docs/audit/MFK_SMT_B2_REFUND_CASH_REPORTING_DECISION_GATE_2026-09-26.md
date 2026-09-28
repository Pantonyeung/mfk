# MFK SMT B2 Refund Cash / Reporting｜Decision Gate Audit｜2026-09-26

## STATUS
AUDIT COMPLETE / OWNER MONEY SEMANTICS REQUIRED / NO B2 PRODUCT MUTATION

## Fresh current main
`606c6abc24ba2627fb5d8d3ad51797095080a352`

B3 is LANDED / BANKED / OTA GREEN.

## Current financial reality

### Local report
`buildLocalReport()` currently:
- selects orders by Business Date;
- sums full `order.totalMinor` into `netSalesMinor`;
- derives cash sales from current effective `paymentLabel`;
- has no refund records;
- has no refund-date attribution;
- has no refund-aware expected cash.

The More / Reports page and Day Close page both call this report directly using `localRuntime.orders()`.

### Day close
Current expected drawer:
`openingCash + cashSales`

There is no refund subtraction today.

### Daily close print
The ticket already has a placeholder `refundMinor?: number`, but current runtime never supplies a formal refund ledger.
When absent it prints:
`退款總額：—（未接正式退款帳）`

Payment rows still show original sale tender inflows and are refund-unaware.

### Important cancellation collision exposed by B3
B3 cancellation intentionally does NOT refund money.

Therefore a cancelled paid Order cannot be silently removed from financial cash truth unless money was actually refunded. Otherwise drawer / electronic settlement and report would diverge.

Current daily-close ticket filters cancelled Orders from gross sales while the Local report does not. This is already inconsistent and B2 must not build on top of that ambiguity.

## Donor reviewed
Donor `ab1c7132dcecaa674e304d7a446094bd76887e4b` adds:
- immutable `OrderRefundRecord[]`;
- FULL / PARTIAL refund amount;
- refundable remainder guard;
- refund method / staff / note;
- CASH refund creates a separate OUT cash movement;
- no automatic drawer.

But donor does NOT fully close report/day-close semantics:
- Local report still sums full Order totals;
- payment breakdown remains original-inflow oriented;
- refund business-date vs original-sale-date semantics are not fully defined.

Do NOT transplant B2 donor wholesale.

## Recommended single-authority shape
Use the immutable `OrderRefundRecord` on the SAME Order as the canonical refund event.

Do NOT create a second refund ledger.

For physical cash expectation, derive cash refund OUT from the canonical refund records by refund timestamp and refund method.
A generic future cash-expense ledger can remain a separate later slice if needed.

## Owner decisions

### R1 — Which Business Date owns a refund?

#### R1-A — Refund event date [RECOMMENDED]
Original sale stays gross on its original Business Date.
Refund is recorded on the Business Date when refund actually happens.

Example:
- Monday sale $50
- Tuesday refund $20
- Monday gross remains $50
- Tuesday refund = -$20
- Tuesday net = Tuesday gross - $20

Advantages:
- closed days stay immutable;
- physical cash / settlement matches the day money actually leaves;
- no retroactive rewrite of a sealed day close.

#### R1-B — Rewrite original sale day
Refund reduces the original Order's historical sales day even if refund happens later.

This can change already-closed historical figures and does not match the day physical cash leaves.

### R2 — Which tender may be refunded?

#### R2-A — Current effective tender only [RECOMMENDED]
B1 current effective tender is authority.
- CASH Order → CASH refund
- FPS Order → FPS refund
- PAYME Order → PAYME refund
- etc.
Cross-tender refund is blocked.

If future split tender exists, exact refund allocation must be explicit; do not guess.

#### R2-B — Staff may choose any refund method
Example CASH sale refunded through FPS or FPS sale refunded in CASH.

This materially changes physical cash and settlement reconciliation.

### R3 — Partial refund granularity

#### R3-A — Financial amount only [RECOMMENDED FOR FIRST B2]
Staff enters refund amount + reason.
Refund reduces financial net only.
Product quantities / product gross sales remain the original sale facts.

This is fast and does not invent which item was returned.

#### R3-B — Item / quantity linked
Staff selects exact Order lines / quantities.
Refund can also adjust product-level net reporting.

More precise but substantially larger operator and reporting model.

### R4 — Cancellation without refund

#### R4-A — Paid cancellation remains financial gross until actual refund [RECOMMENDED]
Cancellation is an operational state.
Money changes only through an explicit refund record.

A cancelled-but-not-refunded paid Order remains in financial gross / tender inflow and should appear as an exception requiring attention.

#### R4-B — Cancellation itself reverses financial sale
This would make cancellation a money event even though B3 explicitly does not refund money.

## If Owner chooses all recommended
B2 R1 scope becomes:

1. SAME Order immutable `refunds[]`.
2. FULL refund auto-fills remaining refundable amount.
3. PARTIAL refund is amount-only.
4. Refund method = current effective tender; no cross-tender.
5. Refund belongs to refund Business Date.
6. Net sales for a day = gross formal sale inflows on that day - refund events on that day.
7. Cash expected = opening cash + cash sale inflows - CASH refund events.
8. Non-cash refunds do not alter physical drawer expectation.
9. Cancel alone never changes money.
10. No auto drawer.
11. No auto reprint.
12. Keeta/provider after-sale path remains separate.
13. Daily close ticket gets real refund total and refund-method breakdown.
14. Restart preserves refund history.
15. No second Refund engine / second cash truth.

## Required Owner response
Confirm:
`R1-A / R2-A / R3-A / R4-A`

or specify any different choice.

Until confirmed:
B2_AUDIT_COMPLETE
B2_MONEY_SEMANTICS_OWNER_REQUIRED
NO_B2_PRODUCT_MUTATION
B3_OTA_GREEN
