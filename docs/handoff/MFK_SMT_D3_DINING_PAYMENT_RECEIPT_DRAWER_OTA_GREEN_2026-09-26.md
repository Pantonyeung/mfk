# MFK SMT D3 Dining Payment Receipt / Cash Drawer｜OTA Green Handoff｜2026-09-26

## STATUS
D3 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL RECEIPT + DRAWER ACCEPTANCE PENDING

## Product source
`5a34e3b05f53eaf08b59bba8a14f800c24ba7611`

## D3 behavior locked
Each durable Dining payment has its own payment-scoped receipt side effect.

Receipt semantics:
- receipt contains only the exact selected paid items/quantities for this payment.
- receipt total = this payment amount, not the whole Dining Order total.
- receipt title = 堂食付款收據.
- receipt records table, payment amount, remaining unpaid balance.
- CASH receipt records received amount + change.
- COMBO receipt preserves exact split tender amounts.

Drawer boundary:
- CASH payment receipt => kickDrawer=true.
- COMBO with a CASH component => kickDrawer=true exactly once.
- non-cash receipt => kickDrawer=false.
- no production / packing / label jobs are created by a Dining payment receipt.

## Certainty / retry
Each LocalDiningPayment persists:
- receiptAttemptedAt
- receiptState = DONE / FAILED / UNKNOWN
- receiptPlanned / receiptSent / receiptFailed
- receiptCompletedAt when DONE

Rule:
- payment is durable before receipt/drawer side effect.
- receipt attempt marker is durable before physical dispatch.
- restart/recovery reads the same payment and resumes only when no receipt attempt existed.
- DONE / FAILED / UNKNOWN never blindly auto-retries.
- UNKNOWN protects against duplicate paper / duplicate cash-drawer open.

## COMBO money repair
Dining COMBO now preserves:
- splitTenders[]
- exact split total must equal selected payment amount
- reporting cash sales counts only the CASH component
- receipt label carries split tender detail
- CASH component controls drawer eligibility

## UI alignment
Dining money labels now use:
- 總額
- 已收款
- 未收款
instead of overloading accounting/provider Settlement terminology.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36244343897`
- 50 / 50 test files PASS
- 236 / 236 tests PASS
- build PASS
- authority/static proof PASS

Earlier D3 RED:
- Run: `36244294612`
- D3 runtime tests themselves passed.
- one C2 static wiring assertion expected the old recovery status text.
- updated the C2 contract to require D3 receipt readback on recovery.
- final GREEN after correction.

Builder OTA:
- request commit: `5ff8801d8fcd9768b2386e7895a80b51372f974b`
- MFK Runtime OTA: `36244392583` SUCCESS
- package test: 50 / 50 files, 236 / 236 tests PASS
- Release: `runtime-candidate-mfk-5a34e3b05f53`
- Public readback: SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical boundary for tomorrow
D1 / D2 / D3 can be accepted together on the real shop SMT:

A. First Dining admission
1. create Dining order and assign table
2. one Formal Order / one Display
3. initial table / production / packing / expected labels
4. no paid receipt
5. drawer stays closed

B. Partial non-cash payment
1. pay selected item(s)
2. one payment receipt containing only paid selection
3. remaining balance correct
4. drawer stays closed

C. Partial / full CASH payment
1. one payment receipt
2. received + change correct
3. drawer opens once
4. restart/recovery does not reprint or reopen drawer

D. COMBO payment with CASH component
1. split amounts correct on receipt/readback
2. reporting cash = CASH component only
3. drawer opens once

E. UNKNOWN / printer failure
1. payment remains durable
2. no duplicate payment
3. no blind auto-reprint / drawer retry

## CURRENT
D1 = BANKED / OTA GREEN
D2 = BANKED / OTA GREEN / physical paper pending
D3 = BANKED / OTA GREEN / physical receipt+drawer pending

## MILESTONE
`MFK_D1_D2_D3_DINING_TRANSACTION_CHAIN_OTA_GREEN_PHYSICAL_PENDING`
