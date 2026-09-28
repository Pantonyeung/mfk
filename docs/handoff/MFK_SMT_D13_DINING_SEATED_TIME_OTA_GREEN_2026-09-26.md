# MFK SMT D13 Dining Seated Time｜OTA Green｜2026-09-26

## STATUS
D13 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL TIMER ACCEPTANCE PENDING

## Product source
`14c1ea1de37b06d1fe259711895d8f3b8864467f`

## Root cause
Ordered waiting Dining reused Hold `createdAt` as table `startedAt`.

Therefore:
- customer could wait 20 minutes;
- then be seated;
- table immediately appeared as already dining for 20 minutes;
- Admin D12 overdue threshold was being measured from the wrong origin.

This violated the Owner requirement that table detail shows actual 開始用餐時間.

## D13 behavior locked
Dining now separates:

- `createdAt` = Hold / waiting creation time
- `seatedAt` = actual first table-assignment time

### Waiting → seating
- waiting may already have SAME Formal Order and production print;
- waiting time continues to use `createdAt`;
- first real table assignment writes `seatedAt`;
- table elapsed / Admin overdue countdown starts from `seatedAt`.

### Direct table order
SMM direct TABLE admission records:
`seatedAt == createdAt`

### Table transfer
D8 table transfer:
- changes only assignedTable;
- preserves the original `seatedAt`;
- does not restart Dining elapsed time;
- SAME Hold / Order / Display remains.

### Temporary unassign / reseat
Existing first seating time is preserved.
No second Dining-start truth is invented.

### Backward compatibility
Legacy active table Holds without `seatedAt` fall back to their existing `createdAt`;
no historical time is fabricated.

## UI
Dining detail now distinguishes:
- 輪候時間
- 用餐時間

Waiting detail explicitly states:
`未入座唔會計堂食超時`

Admin D12 overdue red state applies only to seated table elapsed.

## Acceptance
MFK V2 Local POS Smoke:
- Run: `36248542470` SUCCESS
- 66 / 66 test files PASS
- 289 / 289 tests PASS
- build PASS
- authority/static proof PASS

## OTA
Builder run:
`36248620117` SUCCESS

Exact source:
`14c1ea1de37b06d1fe259711895d8f3b8864467f`

Release:
`runtime-candidate-mfk-14c1ea1de37b`

Package proof:
- 66 / 66 files PASS
- 289 / 289 tests PASS
- build PASS
- R2 publish PASS
- Public readback PASS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
Add D13:
1. create waiting Dining order;
2. leave it waiting for several minutes;
3. assign a table;
4. table Dining timer starts at seating, not waiting creation;
5. transfer table and confirm timer does not reset;
6. D12 Admin threshold turns red based on seated elapsed only.

## CURRENT
D1-D13 = SOFTWARE / DEPLOY / OTA GREEN where applicable.
Physical printer / drawer / operator / timer acceptance = TOMORROW.

## NEXT AUDIT
Remaining Dining gaps must not be invented.

Known unresolved semantics requiring fresh Owner contract before product mutation:
- merge-table / 併枱 when two existing Formal Orders are involved;
- modification/removal of already-produced Dining lines, especially after partial payment.

## MILESTONE
`MFK_D1_TO_D13_DINING_CHAIN_OTA_GREEN_PHYSICAL_PENDING_REMAINING_SEMANTICS_GATED`
