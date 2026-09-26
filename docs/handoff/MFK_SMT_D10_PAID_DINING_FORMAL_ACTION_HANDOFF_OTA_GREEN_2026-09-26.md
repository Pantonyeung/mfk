# MFK SMT D10 Paid Dining Formal Action Handoff｜OTA Green｜2026-09-26

## STATUS
D10 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL OPERATOR ACCEPTANCE PENDING

## Product source
`5db156046b12ecf3710855be571549b5626c0926`

## D10 goal
Close the paid-Dining operator gap without inventing a second refund/cancel engine.

## Locked behavior
When Dining has confirmed payment:
- Dining detail no longer exposes the direct unpaid cancel button.
- operator sees 「正式訂單處理」.
- action navigates to the existing Orders surface with:
  `/orders?orderId=<SAME Formal Order ID>`
- Orders surface selects that exact Order.

The existing Orders authority remains responsible for:
- Refund
- Cancel
- Payment correction
- Audit history

## Money safety
D10 deliberately does NOT decide a new sequence such as:
- refund-before-cancel
- cancel-before-refund
- automatic refund on cancel

Cancel and Refund remain independent formal actions.

Dining does not call:
- refundOrder
- settleDiningHold
- ensureDiningPaymentReceipt
- paid cancel directly

This preserves:
`Cancel != Refund`

## Unpaid path
D9 remains unchanged:
- paidMinor == 0 → bounded direct Dining cancellation
- reason + final confirmation
- no refund / no drawer

## Acceptance
Final MFK smoke:
- Run: `36247765843` SUCCESS
- 61 / 61 test files PASS
- 272 / 272 tests PASS
- build PASS
- authority/static proof PASS

Earlier D10 RED:
- Run `36247721773`
- D10 tests themselves passed.
- one D9 static assertion still expected the old paid-disabled button shape.
- updated the D9 proof to lock the semantic boundary under the new D10 branch.
- no D9 cancellation behavior changed.

## OTA
Builder request commit:
`2ec57726277ac4dcec2b582f4abf40af0f8ee406`

MFK Runtime OTA:
`36247812881` SUCCESS

Release:
`runtime-candidate-mfk-5db156046b12`

Package proof:
- 61 / 61 test files PASS
- 272 / 272 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D10:
1. partially-paid Dining Order.
2. Dining detail shows 正式訂單處理 instead of direct cancel.
3. tap it.
4. Orders page opens SAME Order.
5. refund and cancel remain separate actions.
6. no action fires merely by navigation.
7. returning to Dining still reads canonical paid/outstanding state.

## CURRENT
D1-D10 = SOFTWARE + OTA GREEN
Physical printer / drawer / operator acceptance = TOMORROW

## NEXT SAFE AUDIT
Do not invent paid refund ordering semantics.

Next non-money gap candidate:
Dining elapsed-time red alert still hard-codes 35 minutes although Owner locked it as Admin-configurable.
That requires a shared Admin→SMT setting seam and should be handled as a separate cross-port knife.

## MILESTONE
`MFK_D1_D2_D3_D4_D5_D6_D7_D8_D9_D10_DINING_OPERATOR_CHAIN_OTA_GREEN_PHYSICAL_PENDING`
