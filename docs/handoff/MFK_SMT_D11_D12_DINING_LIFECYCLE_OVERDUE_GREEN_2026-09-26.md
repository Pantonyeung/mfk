# MFK SMT D11 + D12 Dining Lifecycle / Admin Overdue Control｜Green｜2026-09-26

## STATUS
D11 FORMAL LIFECYCLE GREEN
D12 ADMIN OVERDUE CONTROL GREEN
ADMIN DEPLOY GREEN
SMT OTA GREEN
PUBLIC READBACK GREEN
PHYSICAL ACCEPTANCE PENDING

## Exact product source published to SMT OTA
`da66fb7c1642165d26456198ba21824346cf4035`

Later test-only naming normalization:
- D11 = formal Dining lifecycle / safe formal-action handoff
- D12 = Admin-controlled Dining overdue threshold
No product semantics changed by the rename-only commits.

## D11｜Formal Dining lifecycle safety
D11 closes the formal-order lifecycle gap around paid Dining.

Locked:
- active pure Dining stays off the general Orders board by default;
- exact deep-link from Dining can select the SAME active Formal Order;
- active Dining generic mutations fail closed;
- add/edit remains Dining authority;
- generic Ready is blocked for Dining;
- payment correction does not overwrite Dining PaymentEntry truth;
- active Dining refund fails closed until Check is closed/cancelled;
- cancellation remains separate from Refund;
- fully-paid archived Dining sets the SAME Formal Order to 已完成;
- cancelled Dining appears in Order history;
- Dining refund after closure is bounded by confirmed paid quantity / confirmed money;
- ambiguous duplicate product IDs fail closed for item-linked refund.

D11 software proof:
- Smoke `36248174229` SUCCESS
- 64 / 64 test files PASS
- 284 / 284 tests PASS
- build / authority / static proof PASS

## D12｜Admin-controlled Dining overdue threshold
Owner requirement:
35 minutes is only a default/example; table overdue threshold is Admin-configurable.

Admin now publishes:
`storeSettings.diningOverdueMinutes`

Admin UI:
- field: 堂食超時變紅（分鐘）
- minimum 1 minute
- 35 = default only

SMT:
- reads canonical Admin config / LKG
- table overdue red state uses `diningOverdueMinutes`
- detail countdown uses same setting
- hard-coded 35-minute comparison removed

Backward compatibility:
- if an older Admin snapshot lacks the field, SMT defaults to 35.

## Admin deployment
Deploy request:
`b13c49859023dfd4bee255032f0151b5399b534e`

Run:
`36248328890` SUCCESS

Admin proof:
- 19 / 19 files PASS
- 119 / 119 tests PASS
- build PASS

Cloudflare Worker Version:
`2f6b088c-ce4c-4415-be03-52e80c33575a`

Target:
`https://admin.morefunos.com`

## SMT OTA
Builder request:
`e85d70c809458099acbae94d8be879d53b313f8a`

OTA run:
`36248334473` SUCCESS

Release:
`runtime-candidate-mfk-da66fb7c1642`

OTA proof:
- 64 / 64 files PASS
- 284 / 284 tests PASS
- build PASS
- R2 publish PASS
- Public readback PASS
- source SHA / archive hash / carrier contract verified

## NEXT
D13 fixes a separate timer-origin bug:
ordered waiting Dining currently uses Hold creation time as table startedAt after seating.

Target:
waiting arrival time stays waiting time;
actual first table assignment becomes seatedAt / 開始用餐時間;
table transfer keeps the original seatedAt.

## MILESTONE
`MFK_D11_D12_DINING_LIFECYCLE_ADMIN_OVERDUE_GREEN_D13_SEATED_TIME_IN_PROGRESS`
