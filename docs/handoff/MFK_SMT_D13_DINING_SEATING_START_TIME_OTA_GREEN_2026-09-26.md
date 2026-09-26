# MFK SMT D13 Dining Seating Start Time｜OTA Green｜2026-09-26

## STATUS
D13 SOFTWARE GREEN / OTA GREEN / PUBLIC READBACK GREEN / PHYSICAL TIMING ACCEPTANCE PENDING

## Product source
`14c1ea1de37b06d1fe259711895d8f3b8864467f`

## D13 behavior locked
Dining elapsed time now distinguishes:
- waiting time = from Hold creation
- seated dining time = from actual first table assignment

A waiting customer can wait 20 minutes, then be seated:
- waiting display may show 20 minutes
- dining elapsed starts from seating, not Hold creation

## Runtime
Dining Hold now carries optional `seatedAt`.

Rules:
- first seat sets `seatedAt`
- direct table creation sets `seatedAt` immediately
- table transfer preserves the original `seatedAt`
- unassign/re-seat does not silently rewrite historical Order identity

## UI
- waiting detail shows 輪候時間
- seated detail shows 用餐時間
- Admin `diningOverdueMinutes` is evaluated against seated time only
- waiting state explicitly says 未入座唔會計堂食超時

## Acceptance
MFK V2 Local POS Smoke:
- Run `36248542470` SUCCESS
- 66 / 66 test files PASS
- 289 / 289 tests PASS
- build PASS
- authority/static proof PASS

## OTA
Builder request commit:
`a32ce618aa325e77b79b288c6c26b796705d0013`

MFK Runtime OTA:
`36248620117` SUCCESS

Release:
`runtime-candidate-mfk-14c1ea1de37b`

Package proof:
- 66 / 66 files PASS
- 289 / 289 tests PASS
- build PASS
- Public readback SUCCESS
- source SHA / archive hash / carrier contract verified

## Physical acceptance tomorrow
1. create waiting Dining Hold
2. leave it waiting for a measurable period
3. seat to a table
4. seated timer starts from seating
5. move table
6. seated timer does not reset
7. Admin overdue threshold only turns red against seated elapsed time

## CURRENT
D1-D13 = software/OTA chain closed for this Dining reliability/operator slice.
Physical printer / drawer / timing acceptance remains tomorrow.

## MILESTONE
`MFK_D1_D13_DINING_OPERATOR_RELIABILITY_OTA_GREEN_PHYSICAL_PENDING`
