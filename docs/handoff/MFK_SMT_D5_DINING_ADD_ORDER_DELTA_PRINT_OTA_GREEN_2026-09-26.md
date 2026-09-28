# MFK SMT D5 Dining Add-Order Delta Print｜OTA Green｜2026-09-26

## STATUS
D5 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL DELTA-PRINT ACCEPTANCE PENDING

## Product source
`a68b5c97e08a7f1363c0577c6761bd51b1b9191a`

## D5 behavior locked
Dining 加單不建立第二張 Formal Order。

Flow:
SAME Dining Hold
→ SAME Formal Order / SAME Display
→ append new items
→ Order total / outstanding 更新
→ prior confirmed-paid money 不變
→ print only the newly added items

## Delta print
New bounded print mode:
`dining-addition`

It:
- suppresses customer receipt
- never opens cash drawer
- prints only delta items through existing operational routes
- production / packing / labels continue to obey current Admin print rules
- does NOT replay the original full first-print set

## Durability / exactly-once
Each Dining addition persists:
- additionId
- submissionId
- createdAt
- delta items / delta total
- printAttemptedAt
- printCompletedAt when DONE
- printState = DONE / FAILED / UNKNOWN
- planned / sent / failed

Rules:
- add-order mutation is durable before printing.
- print attempt marker is durable before physical dispatch.
- same submission is idempotent.
- restart/replay does not append again.
- DONE / FAILED / UNKNOWN never blindly auto-retries.

## Money integrity
Partial-paid Dining can add new items:
- already confirmed payment remains unchanged.
- new items increase Order total and outstanding only.
- existing paid line selection remains valid.
- fully settled / archived Dining cannot accept a new addition.

## SMM
Existing SMM TABLE add-order now:
- appends to the occupied Dining Hold / SAME Formal Order.
- records a durable addition batch.
- triggers addition delta print for that batch.
- does not trigger the first full Dining print again.
- replay of the same SMM submission does not duplicate item or print.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36245172344`
- 52 / 52 test files PASS
- 248 / 248 tests PASS
- build PASS
- authority/static proof PASS

Earlier RED:
- Run `36245127789`
- D5 runtime tests passed.
- SMM fixture used a non-canonical test price and was correctly rejected by SMT pricing authority.
- fixture corrected to canonical published price; final GREEN.
- no price authority was weakened.

## OTA
Builder request commit:
`8a96d3c580c284590cd3a8bb30d9c3a42e417a7f`

MFK Runtime OTA:
`36245231808` SUCCESS

Release:
`runtime-candidate-mfk-a68b5c97e08a`

Package proof:
- 52 / 52 test files PASS
- 248 / 248 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical boundary tomorrow
Add to physical Dining acceptance:
1. existing open Dining Order receives new item(s)
2. SAME Order / SAME Display remains
3. only added item(s) print
4. original full first-print set does not repeat
5. no payment receipt from add-order
6. drawer stays closed
7. replay/restart does not duplicate added items or delta print

## CURRENT
D1 = OTA GREEN
D2 = OTA GREEN / physical pending
D3 = OTA GREEN / physical pending
D4 = OTA GREEN / physical pending
D5 = OTA GREEN / physical pending

## NEXT
Fresh-audit remaining Dining operator surface:
- local SMT explicit "加單" UI wiring into `appendDiningItems`
- then table transfer / other remaining Dining continuity gaps only if current source still proves missing

## MILESTONE
`MFK_D1_D2_D3_D4_D5_DINING_CORE_CHAIN_OTA_GREEN_PHYSICAL_PENDING`
