# MFK SMT D7 Ordered Waiting Dining Continuity｜OTA Green｜2026-09-26

## STATUS
D7 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL WAITING-DETAIL ACCEPTANCE PENDING

## Product source
`162c72e5b26e694ee41655cb0d53695a11a85bc9`

## Gap closed
D4 allowed ordered waiting Dining to create/print before seating, but the SMT queue row did not expose its canonical order/money facts and could not reopen the Dining detail before a table was assigned.

D7 closes that operator gap.

## Queue projection
Ordered waiting rows now expose:
- Formal Order identity
- Display/code
- item count
- total
- confirmed paid
- outstanding
- explicit status: 待安排座位 · 已落單

Empty waiting remains:
- no Formal Order
- itemCount = 0
- total/paid/outstanding = 0
- status = 待安排座位

## Frontline behavior
For an ordered waiting row:
- tapping the row still selects it for table assignment;
- the SAME click also opens the canonical Dining detail;
- operator can use existing D6 ＋加單 before seating;
- operator can select unpaid lines and go to existing Dining Checkout before seating;
- Checkout table context shows 輪候 rather than inventing a table number;
- the remove-X action is not offered for a non-empty Formal Dining Order.

For empty waiting:
- remains removable;
- no financial/order detail is invented.

## Safety
- no second Order / Pricing / Payment / Print engine.
- no table is fabricated.
- partial payment before seating keeps SAME Formal Order.
- transfer into a table later still uses SAME Hold / Order / Display.
- unassign action is disabled when the Dining Hold is already waiting.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36246280705` SUCCESS
- 56 / 56 test files PASS
- 261 / 261 tests PASS
- build PASS
- authority/static proof PASS

## OTA
Builder request commit:
`ded313d228f7ddd9b3083ea812de0b7c26c7b143`

MFK Runtime OTA:
`36246330458` SUCCESS

Release:
`runtime-candidate-mfk-162c72e5b26e`

Package proof:
- 56 / 56 files PASS
- 261 / 261 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D7:
1. create ordered waiting Dining.
2. queue row shows Formal Display + item count + outstanding.
3. tap row and open detail before seating.
4. add item while waiting → SAME Order + delta print.
5. optionally partial-pay while waiting → SAME Order + correct paid/outstanding.
6. assign table afterward → identity unchanged.

## CURRENT
D1-D7 = SOFTWARE + OTA GREEN
Physical acceptance = TOMORROW

## NEXT
D8 safe operator continuity:
- direct table transfer to an available table
- SAME Hold / Order / Display
- no reprint / no drawer / no money mutation
- table merge remains OUT OF SCOPE unless Owner explicitly locks semantics

## MILESTONE
`MFK_D1_D2_D3_D4_D5_D6_D7_DINING_CONTINUITY_OTA_GREEN_PHYSICAL_PENDING`
