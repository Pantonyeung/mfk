# MFK SMT D2 First Dining Print｜OTA Green Handoff｜2026-09-26

## STATUS
D2 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL PAPER ACCEPTANCE PENDING

## Product source
`140c43b124660abc207220fa6588576a97ec115c`

## D2 behavior locked
After durable D1 Dining admission, the first Dining print is a separate side effect.

Initial print set:
- 堂食枱單：routes through existing receipt logical printer, but is NOT a paid customer receipt.
- 製作單
- 堂食打包單
- Product / Bag labels according to existing routing and Admin product print rules.

Money / hardware safety:
- no paid receipt in the first Dining print set.
- table ticket explicitly states it is not a payment receipt.
- kickDrawer = false.
- CASH drawer remains payment-receipt boundary only.
- D1 Formal Order remains durable even if print fails.

## Certainty / retry
Formal Order persists:
- diningInitialPrintAttemptedAt
- diningInitialPrintState = DONE / FAILED / UNKNOWN
- planned / sent / failed counts
- completedAt when DONE

Rule:
- first attempt marker is persisted before physical dispatch.
- replay / restart returns persisted result.
- FAILED / UNKNOWN is NOT blindly auto-retried.
- manual reprint remains a separate existing operation.

## Additional routing repair found during D2
The first D2 RED exposed a real duplicate-label edge:
when a Bag Label physical route caused the legacy derived takeaway label route to exist, a product with an explicit label route could also fall through to the default takeaway label route.

Fixed:
explicit product route now wins; default route is used only when no explicit product-label binding matches.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36243661270`
- 49 / 49 test files PASS
- 227 / 227 tests PASS
- build PASS
- authority/static proof PASS

Earlier D2 RED:
- Run `36243597968`
- exposed duplicate label fallback + test mock isolation
- both corrected before final GREEN

Builder OTA:
- request commit: `eae6b1dc021cc0258c67347324a8ea7be5e32cf1`
- MFK Runtime OTA: `36243710771` SUCCESS
- package test: 49 / 49 files, 227 / 227 tests PASS
- Release: `runtime-candidate-mfk-140c43b12466`
- Public readback: SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical boundary
OTA/public readback proves the runtime package and publication chain.
It does NOT prove real paper exited the shop printers.

Remaining physical acceptance:
1. new Dining order on physical SMT
2. table ticket physically prints
3. production ticket physically prints
4. packing ticket physically prints
5. expected labels physically print
6. no paid receipt on initial Dining print
7. cash drawer remains closed
8. restart/replay does not duplicate initial print

## Current
D1 = BANKED / OTA GREEN
D2 = SOFTWARE + OTA BANKED GREEN
D2 physical print = PENDING REAL SHOP ACCEPTANCE

## MILESTONE
`MFK_D1_D2_DINING_FORMAL_ORDER_FIRST_PRINT_OTA_GREEN_PHYSICAL_PENDING`
