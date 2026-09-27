# MFK SMT D4 Ordered Dining Waiting Admission｜OTA Green｜2026-09-26

## STATUS
D4 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL WAITING-ORDER ACCEPTANCE PENDING

## Product source
`cf4449c2ac89c5be1a776ca93fd12cc91201caff`

## Owner requirement closed by D4
Ordered Dining waiting can:
`先落單 / 出廚房 → 之後有位再入枱 → SAME Formal Order`

This closes the prior gap where an ordered waiting Hold existed without Formal Order / first production print until seating or payment.

## D4 behavior
- empty waiting entry stays non-financial and creates no Formal Order.
- ordered Dining waiting explicitly enters Formal Order authority before seating.
- SAME Hold ↔ SAME Formal Order / SAME Display.
- first unpaid print can happen while no table exists.
- waiting first ticket title = 堂食輪候單.
- production / packing routes run before seating.
- later assign to table keeps SAME Order identity.
- later seating does NOT repeat the first print because D2 first-print certainty is already persisted.
- restart between waiting admission and seating keeps SAME Order.

## SMM
SMM DINE_IN + WAITING now:
- enters existing Dining authority.
- returns linked Formal Order identity.
- triggers the same initial Dining print certainty path.
- no second Order/Print engine.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36244677703`
- 51 / 51 test files PASS
- 241 / 241 tests PASS
- build PASS
- authority/static proof PASS

Builder OTA:
- request commit: `f01068921872d02c4b7ed0e436361a23927299a1`
- MFK Runtime OTA: `36244726071` SUCCESS
- package test: 51 / 51 files, 241 / 241 tests PASS
- Release: `runtime-candidate-mfk-cf4449c2ac89`
- Public readback: SUCCESS
- source SHA / archive hash / carrier contract verified

## Tomorrow physical acceptance addition
Besides D1-D3, also verify:
1. create ordered waiting Dining
2. Formal Order / Display exists before seating
3. waiting ticket + production/packing print before seating
4. then assign to a table
5. Order / Display remains SAME
6. no duplicate first-print set after seating/restart

## CURRENT
D1 = OTA GREEN
D2 = OTA GREEN / physical pending
D3 = OTA GREEN / physical pending
D4 = OTA GREEN / physical pending

## NEXT AUDIT
Dining add-items / SAME Order continuation:
- current SMM can append items to occupied Dining Hold / SAME Order;
- current first-print certainty correctly prevents a second full initial print;
- therefore newly added items currently need their own bounded delta-print contract rather than replaying the first full print.
- local SMT add-item operator surface also needs exact wiring review.

## MILESTONE
`MFK_D1_D2_D3_D4_DINING_CORE_CHAIN_OTA_GREEN_PHYSICAL_PENDING`
