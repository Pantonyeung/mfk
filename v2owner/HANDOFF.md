# MFK Owner Clean Migration｜Source Handoff

WORK_ID: MFK-OWNER-CLEAN-MIGRATION-R1
STATUS: MFK_OWNER_PORT_MIGRATED_NOT_WIRED
MODE: PORT_MIGRATION_ONLY

## CURRENT
Independent Owner shell and required migration surfaces are present under v2owner only.

## CAPABILITY_COUNT
94

## COMMAND_SHAPE_COUNT
18

## WHAT_MOVED
- Today / Readiness home
- Sales / Orders / AOV / comparison cards
- Exception / Action Queue
- Order list + detail + status / readback / tender / fulfillment / side-effect / timeline
- Channel health + pause / resume / snooze command shape
- Sold-out / restore command shape
- Staff presence / clock / schedule / break / hours / role-permission shape
- Device / printer health + job certainty + impact
- Fixed reports + trend / drill-down
- Alerts / notifications
- Bounded action confirmation / reason / approval / pending / result / failure / unknown
- Admin deep-link UX only
- Recovery states
- Manager Log / Checklist / Activity
- Owner Capability Registry

## WHAT_REMAINS_NOT_WIRED
Every COMMAND_SHAPE. No network, adapter, provider, SMT, Admin authoring, Store Kernel, Order, Pricing, Payment, Print, Drawer, D1 or Cloud connection was opened.

## AUTHORITY_SCAN
Expected static source scan: zero live-network / cross-port / transaction-authority call hits.

## TEST_EXECUTION
HANDOFF_TO_MAIN_CHAT

Worker did not run npm test, production build, clean landing, or final BANK.
