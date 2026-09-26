# MFK SMT D9 Unpaid Dining Cancellation｜OTA Green｜2026-09-26

## STATUS
D9 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL CANCEL-NOTICE ACCEPTANCE PENDING

## Product source
`cffe491c8f54fb372a972dc0932d02f2758286c7`

## D9 behavior locked
Local SMT Dining detail now exposes a bounded unpaid cancellation surface only.

Flow:
`Dining detail → 取消堂食單 → reason → final confirmation → SAME Formal Order cancel`

## Safety boundary
D9 is intentionally limited to Dining with:
`paidMinor === 0`

If any payment already exists:
- cancel button is disabled in Dining UI
- text shows 已有付款
- no automatic refund is invented
- paid cancel/refund remains a separate money workflow

This preserves the existing Owner lock:
`Cancel != Refund`

## Runtime reuse
D9 reuses existing canonical `cancelOrder`:
- SAME Order identity
- fulfillment becomes 已取消
- linked Dining Hold archives / releases table
- Dining outstanding becomes zero / no longer collectible
- no new Order
- no drawer

If a production ticket was actually issued:
- one minimal cancellation notice goes to the existing production route
- notice includes Display + cancellation reason
- kickDrawer=false
- retrying cancellation does not blindly print a second notice
- DONE / FAILED / UNKNOWN certainty remains in the existing cancellation-notice state

## Paid cancel proof
Runtime contract remains unchanged for lower-level paid cancellation:
- confirmed paid money stays recorded
- outstanding becomes zero
- refund is not created implicitly

D9 UI does NOT expose that path until the refund handoff is explicitly closed.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36247379096` SUCCESS
- 60 / 60 test files PASS
- 269 / 269 tests PASS
- build PASS
- authority/static proof PASS

## OTA
Builder request commit:
`77b81f234c88cab4810a4d988c5563dcf5ea8049`

MFK Runtime OTA:
`36247418562` SUCCESS

Release:
`runtime-candidate-mfk-cffe491c8f54`

Package proof:
- 60 / 60 files PASS
- 269 / 269 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D9:
1. unpaid active Dining Order
2. press 取消堂食單
3. enter reason + final confirm
4. table releases
5. SAME Order becomes cancelled
6. no refund is created
7. no drawer
8. if production already printed, exactly one cancellation notice is physically printed
9. cancellation retry does not duplicate the notice

## CURRENT
D1-D9 = SOFTWARE + OTA GREEN
Physical printer / drawer / operator acceptance = TOMORROW

## NEXT AUDIT
Paid Dining cancel/refund is a real money boundary.

Do not expose paid cancellation in Dining UI until the following is explicitly resolved:
- whether refund is selected before or after cancel
- how Dining confirmed-paid presentation changes after refund
- how partial refund affects active vs cancelled outstanding
- which same-day refund route is used without creating a second payment/refund engine

## MILESTONE
`MFK_D1_D2_D3_D4_D5_D6_D7_D8_D9_DINING_CHAIN_OTA_GREEN_PAID_CANCEL_REFUND_GATE`
