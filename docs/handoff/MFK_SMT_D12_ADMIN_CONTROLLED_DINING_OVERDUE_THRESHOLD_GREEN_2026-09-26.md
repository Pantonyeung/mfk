# MFK SMT D12 Admin-Controlled Dining Overdue Threshold｜GREEN｜2026-09-26

## STATUS
D12 ADMIN DEPLOY GREEN / SMT SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL TIMER ACCEPTANCE PENDING

## NUMBERING RECONCILIATION
During this knife a concurrent Dining lifecycle packet already occupied D11.

Canonical numbering is therefore:
- D11 = Paid Dining formal lifecycle safety
- D12 = Admin-controlled Dining overdue threshold

The first Admin deploy / first OTA request used the temporary pre-collision D11 label.
No product semantic changed during the rename.
D12 is the canonical governance name from this handoff onward.

## OWNER REQUIREMENT CLOSED
Owner requirement:
- Dining table turns red only after an Admin-configurable elapsed-minute threshold.
- 35 minutes is an example/default only.
- SMT must not hard-code 35.

## D12 behavior
Admin Store Settings now publishes:
`diningOverdueMinutes`

Admin UI:
- field: 堂食超時變紅（分鐘）
- minimum: 1
- default: 35
- save validation fails closed below 1
- published through existing canonical `storeSettings` snapshot

SMT:
- reads `diningOverdueMinutes` from existing Admin config LKG
- fallback = 35 only for older snapshots without the field
- subscribes to Admin config changes
- table-grid overdue calculation uses the published value
- detail countdown uses the same published value
- no hard-coded `elapsed>=35` / `elapsed-35` remains

## Authority
No second timer authority.
Flow:
Admin canonical Store Settings
→ existing Admin config publish/sync
→ SMT LKG
→ readSmtStoreSettings()
→ Dining presentation

No Order / Payment / Print / Dining transaction authority change.

## SMT acceptance
Final local proof after D12 numbering reconciliation:
- Run: `36248343282` SUCCESS
- 64 / 64 test files PASS
- 284 / 284 tests PASS
- build PASS
- authority/static proof PASS

Canonical D12 source:
`1e6cca2fc7b376bdc848ec4e43d9469fa5dc0be8`

## Admin acceptance / deploy
Admin deployment run:
`36248328890` SUCCESS

Admin proof:
- 19 / 19 test files PASS
- 119 / 119 tests PASS
- build PASS
- deploy PASS
- Worker: `mfk-admin`
- Version ID: `2f6b088c-ce4c-4415-be03-52e80c33575a`

The deploy request used the old temporary label `D11 Dining overdue threshold`.
Capability bytes/semantics are the same D12 capability; no redundant second production deploy was issued solely for renaming.

## SMT OTA
Builder request:
`cc391045a6023cec103a478555df49c1e403b6ff`

MFK Runtime OTA:
`36248449663` SUCCESS

Release:
`runtime-candidate-mfk-1e6cca2fc7b3`

OTA package:
- 64 / 64 test files PASS
- 284 / 284 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D12:
1. Admin set threshold to a non-default value, e.g. 47 minutes.
2. publish/sync.
3. SMT Dining reads the new value without a second setting.
4. before 47 min: table not overdue-red.
5. at/after 47 min: table overdue-red.
6. detail countdown uses 47, not 35.
7. restart/offline LKG retains the published threshold.

## CURRENT
D1-D12 Dining software chain = GREEN
Admin D12 = DEPLOYED
SMT D12 = OTA GREEN
Physical acceptance = TOMORROW

## MILESTONE
`MFK_D12_ADMIN_CONTROLLED_DINING_OVERDUE_THRESHOLD_GREEN_PHYSICAL_PENDING`
