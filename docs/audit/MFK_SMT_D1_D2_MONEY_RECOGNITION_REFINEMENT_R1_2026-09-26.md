# MFK SMT D1/D2 Money Recognition Refinement R1｜2026-09-26

## STATUS
SOURCE AUDIT COMPLETE / OWNER GATE REDUCED TO ONE QUESTION / NO PRODUCT MUTATION

## Fresh current
- main: `bf1d31456f20660516109222e35ca11f745d6027`
- C1 + C2: BANKED / OTA GREEN
- current D1/D2 gate audit exists on main.

## Fresh source findings

### 1. Current reporting collision is real
`v2local/src/runtime/local-operations.ts` currently selects all Orders in the Business Window and computes:

`grossSalesMinor = sum(order.totalMinor)`

There is no payment/open-check guard in `buildLocalReport`.

Therefore once D1 creates a Formal Dining Order at table assignment, the whole Order value would enter current sales unless reporting semantics are changed.

### 2. Dining payment facts already exist separately
`v2local/src/runtime/local-runtime.ts` already stores each Dining payment with:
- tender
- amountMinor
- exact line/quantity selections
- receivedMinor / changeMinor
- stable submission identity
- paidMinor
- remainingMinor

So the system already has enough facts to keep:
- Order/Open Check value
- Tender collected
- Outstanding balance
as separate truths.

### 3. Existing Owner lock already rules out silent Open Check sales
GitHub #22 Owner UI Stage 0 V2 explicitly locked:
- 「預計未結帳金額」與「有效營業額」分開
- 未結帳 / Open Checks 不得靜默計入 Current Effective Sales
- UI 要標示「未計入有效營業額」

Therefore M2（table assignment immediately counts full Order as financial sales）conflicts with current Owner direction.

## Important correction to the original M1/M2 framing
The remaining question is NOT simply M1 vs M2.

Original M1 says “Sales follows actual payment”.
But the project already distinguishes Sales from Tender Collected.

The exact unresolved money semantic is:

### D-MONEY-01｜PARTIAL-PAID OPEN CHECK RECOGNITION

Dining Order = HK$82
- Formal Order exists
- table is still open
- HK$41 has been confirmed as payment
- outstanding HK$41

What is Current Effective Sales?

A. `HK$0` until the Check is fully settled; meanwhile:
- Open Order Value = HK$82
- Tender Collected = HK$41
- Outstanding = HK$41
- Current Effective Sales = HK$0
- final settlement causes Current Effective Sales to become HK$82

B. `HK$41` while the Check remains open; meanwhile:
- Open Order Value = HK$82
- Tender Collected = HK$41
- Outstanding = HK$41
- Current Effective Sales = HK$41
- final settlement causes Current Effective Sales to become HK$82

## Commander assessment
A is the cleaner fit with the already-recorded Owner rule that Open Checks are not Current Effective Sales, and it preserves:
Sales ≠ Tender Collected ≠ Outstanding.

B is possible, but it makes Current Effective Sales partially payment-recognition-based while the Check is still open.

This is a true money semantic and requires Owner confirmation.

## Invariants independent of A/B
- Table assignment may create ONE Formal Order only.
- SAME Dining Hold ↔ SAME Formal Order.
- First Dining print occurs after durable D1 admission and before payment.
- No paid customer receipt on first Dining print.
- Drawer remains closed.
- Partial payments remain append-only facts.
- Cancel ≠ Refund.
- Confirmed payment remains payment truth until explicit Refund.
- No duplicate Order / display / print on retry/restart.
- Reporting must not infer money from fulfillment status.

## NEXT after Owner decision
1. Freeze D-MONEY-01 RED/GREEN contract.
2. Patch reporting projection first so D1 cannot create false Sales.
3. Implement D1 Formal Order + Hold linkage.
4. Prove restart/idempotency/no duplicate.
5. Merge / Bank / OTA.
6. Implement D2 first-print side effect as an independent knife.
7. Merge / Bank / OTA.

## MILESTONE
`MFK_D1_D2_MONEY_GATE_REDUCED_TO_PARTIAL_OPEN_CHECK_RECOGNITION_R1`
