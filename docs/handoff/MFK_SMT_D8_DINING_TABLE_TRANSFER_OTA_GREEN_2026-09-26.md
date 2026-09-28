# MFK SMT D8 Dining Table Transfer｜OTA Green｜2026-09-26

## STATUS
D8 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL TABLE-TRANSFER ACCEPTANCE PENDING

## Product source
`87420efc27a58b42198f461291b277b3c8bdcec8`

## D8 behavior locked
Safe Dining table transfer uses the existing Dining authority only:

`SAME Hold / SAME Formal Order / SAME Display → change assignedTable only`

No second Order, no reprint, no drawer, no payment mutation.

## Runtime
`assignDiningTable(holdId,targetTableId)` now covers both:
- waiting → seating
- occupied table → available target table

Hard guards:
- target table must be published/assignable
- occupied target fails closed with `DINING_TABLE_OCCUPIED`
- source table remains unchanged on failure
- archived Dining cannot move

## UI
Dining detail has explicit transfer mode:
- press 轉枱
- then press an available table
- success message confirms table move and that Order number is unchanged
- transfer mode is cancellable
- occupied target is never treated as available

Transfer does NOT call:
- first-print path
- settlement/payment
- add-order
- drawer

## Identity hardening found by D8 RED
Initial D8 occupied-table proof exposed a real local identity collision under same-millisecond creation:
two Holds could receive the same `HOLD-<Date.now>` identity, so the occupied-target guard could not distinguish them.

Fixed globally:
- local Order / Hold / Action identities now use collision-safe monotonic suffixes
- identity uniqueness is checked against current persisted local state
- no UUID is exposed to frontline UI
- formal Display semantics remain unchanged

The authority workflow proof was updated to validate the new collision-safe identity seam.

## Acceptance
Final MFK V2 Local POS Smoke:
- Run: `36247033098` SUCCESS
- 58 / 58 test files PASS
- 265 / 265 tests PASS
- build PASS
- authority/static proof PASS

Earlier REDs:
- `36246508954`: D8 correctly exposed the duplicate local Hold identity bug.
- `36246670212`: all runtime tests passed after the identity fix; only the old static grep still expected literal `id:'MFK-'`.
- authority proof updated; final GREEN.

## OTA
Builder request commit:
`501766952707395379e65c063125c5b63f6a76de`

MFK Runtime OTA:
`36247111799` SUCCESS

Release:
`runtime-candidate-mfk-87420efc27a5`

Package proof:
- 58 / 58 files PASS
- 265 / 265 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D8:
1. open occupied Dining table
2. press 轉枱
3. choose empty target table
4. source becomes available
5. target shows SAME Order Display
6. Total / Paid / Outstanding unchanged
7. no first-print replay
8. no payment receipt
9. no drawer
10. occupied target attempt fails and original source remains occupied

## CURRENT
D1-D8 = SOFTWARE + OTA GREEN
Physical printer / drawer / operator acceptance = TOMORROW

## NEXT AUDIT
Do not invent table-merge semantics.

Fresh-audit only remaining Dining actions already backed by existing Owner contracts:
- cancellation surface and cancel-not-refund boundary
- whether paid Dining cancellation requires an explicit refund handoff before exposing it
- no new money semantics without Owner decision

## MILESTONE
`MFK_D1_D2_D3_D4_D5_D6_D7_D8_DINING_OPERATOR_CHAIN_OTA_GREEN_PHYSICAL_PENDING`
