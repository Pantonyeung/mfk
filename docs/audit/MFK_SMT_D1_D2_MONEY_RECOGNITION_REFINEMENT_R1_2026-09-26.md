# MFK SMT D1/D2 Money Recognition Refinement R1｜2026-09-26

## STATUS
OWNER HYBRID MONEY MODEL LOCKED / REPORTING PROJECTION FIRST / D1 PRODUCT MUTATION MAY PROCEED AFTER RED CONTRACT

## Fresh current
- main before this refinement: `bf1d31456f20660516109222e35ca11f745d6027`
- prior audit landing: `85b49604e7afe5e27f4ff1ef3a2f57fe272b150c`
- C1 + C2: BANKED / OTA GREEN

## Fresh source findings
Current local reporting sums every selected Formal Order total into grossSalesMinor. Dining payment facts already preserve exact tender, amount, line/quantity selection, received/change, paid and remaining.

## OWNER DECISION｜A + B HYBRID MODEL
A and B are not mutually exclusive. Dining money must expose three facts simultaneously.

No payment, total HK$82:
- Total = 82
- Confirmed paid = 0
- Outstanding = 82
- State = UNPAID

Partial payment HK$41:
- Total = 82
- Confirmed paid = 41
- Outstanding = 41
- State = PARTIALLY_PAID

Fully paid:
- Total = 82
- Confirmed paid = 82
- Outstanding = 0
- State = PAID

Formula:
`outstandingMinor = max(currentOrderTotalMinor - confirmedPaidMinor, 0)`

## Reporting meaning
- Open Check / Current Order Value = current Order total.
- Current recognized Dining money = confirmed paid amount.
- Tender Collected = confirmed payment facts split by tender.
- Outstanding Dining = remaining unpaid balance.
- Open Check full total must never be silently treated as paid financial sales while balance remains.

## Terminology safeguard
Preferred internal fields:
- currentOrderTotalMinor
- confirmedPaidMinor
- outstandingMinor

Preferred frontline labels:
- 總額
- 已收款
- 未收款

Status:
- 未結清
- 部分付款
- 已結清

Avoid using provider/accounting Settlement identity for this frontline concept.

## Cancel / Refund edge
Cancel != Refund remains locked.

If a HK$82 Order has HK$41 confirmed paid and is then cancelled:
- historical Order total remains HK$82;
- confirmed paid HK$41 remains money truth until explicit Refund;
- unpaid HK$41 must not remain collectible outstanding after cancellation;
- explicit Refund reverses the confirmed paid portion through the refund path.

## Invariants
- Table assignment creates ONE Formal Order only.
- SAME Dining Hold ↔ SAME Formal Order.
- First Dining print occurs after durable D1 admission and before payment.
- No paid customer receipt on first Dining print.
- Drawer remains closed.
- Partial payments are append-only.
- Retry/restart cannot duplicate Order / display / print.
- Reporting must not infer money from fulfillment status.

## NEXT
1. Freeze RED/GREEN contract for Total / Confirmed Paid / Outstanding.
2. Patch Reporting projection first.
3. Implement D1 Formal Order + Hold linkage.
4. Prove restart/idempotency/no duplicate.
5. Merge / Bank / OTA.
6. Implement D2 first-print as independent knife.
7. Merge / Bank / OTA.

## MILESTONE
`MFK_D1_D2_HYBRID_TOTAL_PAID_OUTSTANDING_MONEY_MODEL_LOCKED`
