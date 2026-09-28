# MFK SMT D6 Dining Add-Order Operator UI｜OTA Green｜2026-09-26

## STATUS
D6 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL OPERATOR ACCEPTANCE PENDING

## Product source
`3e7b341d1751aee6318b3a682f3af284cdfc3cba`

## D6 behavior locked
Local SMT now exposes the D5 SAME-Order add-order path as an explicit operator workflow:

`堂食詳情 → ＋加單 → 點單頁 → 確認加單 → SAME Formal Order → delta print → 返回堂食`

### Entry
- Active Dining detail has explicit `＋ 加單`.
- Add-order request carries:
  - holdId
  - SAME formalOrderId
  - SAME Display/codeLabel
  - table/waiting label
  - stable submissionId

### Ordering mode
- enters the existing Ordering surface, not a second menu/cart engine.
- service mode is locked to dine-in.
- existing Admin menu / price / options / Required gates are reused.
- cart header shows current SAME Order Display and add-order context.
- primary action changes from 結帳 to 確認加單.
- no checkout/payment flow is entered by confirm-add.

### Commit
Confirm add:
- calls existing `appendDiningItems`
- keeps SAME Hold / Order / Display
- updates total / outstanding only
- preserves confirmed paid truth
- then calls `ensureDiningAdditionPrint`
- only delta operational outputs are admitted
- no customer payment receipt
- no drawer

### UI durability / recovery
Add-order UI intent is persisted:
`mfk.smt.dining-add-order-ui.v1`

On reload:
- SAME hold/order/submission is recovered.
- if addition already exists, UI readbacks the persisted addition and print certainty.
- it does NOT append the items again.
- DONE / FAILED / UNKNOWN are surfaced as human-safe operator states.
- UNKNOWN explicitly says no automatic reprint.
- returning to Dining clears the add-order UI intent.

### Conflict guard
A same add-order submissionId reused with different item/amount content now fails closed:
`DINING_ADDITION_SUBMISSION_CONFLICT`

Backward compatibility:
- existing historical additions without requestSignature remain readable/idempotent.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36246015821` SUCCESS
- 54 / 54 test files PASS
- 256 / 256 tests PASS
- build PASS
- authority/static proof PASS

Earlier D6 RED:
- Run `36245962210`
- D6 tests themselves passed.
- two older A3 Required/optional-drink static tests expected the pre-D6 exact checkoutEnabled source string.
- those tests were updated to lock the actual Required semantic instead of an obsolete exact formatting string.
- no Required gate was relaxed.

## OTA
Builder request commit:
`af3d7282430b94c1d575792e45a45735d6e52323`

MFK Runtime OTA:
`36246068152` SUCCESS

Release:
`runtime-candidate-mfk-3e7b341d1751`

Package proof:
- 54 / 54 files PASS
- 256 / 256 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D6 to Dining real-shop acceptance:
1. open existing Dining table.
2. tap ＋加單.
3. Ordering page shows SAME Display and 加單 context.
4. add item/options; Required still blocks if unresolved.
5. tap 確認加單.
6. SAME Order / Display remains.
7. only newly added production/packing/label output prints.
8. no payment receipt / no drawer.
9. return to Dining shows updated Total / Paid / Outstanding.
10. reload/replay cannot duplicate addition or delta print.

## CURRENT
D1-D6 = SOFTWARE + OTA GREEN
Physical printer / drawer / operator acceptance = TOMORROW

## NEXT AUDIT
Remaining Dining operator continuity:
- ordered waiting Hold detail access / add-order while waiting
- table move using SAME Hold / SAME Order
- cancellation / refund operator surface only if current source proves it is still missing and no new money decision is required

## MILESTONE
`MFK_D1_D2_D3_D4_D5_D6_DINING_OPERATOR_CHAIN_OTA_GREEN_PHYSICAL_PENDING`
