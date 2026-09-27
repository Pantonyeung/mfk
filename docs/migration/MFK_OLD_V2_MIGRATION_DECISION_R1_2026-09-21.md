# MFK｜舊 V2 搬遷決策表 R1｜2026-09-21

STATUS: CURRENT MIGRATION DECISION
CONTROL: MFK #22

> 呢份表只用舊 V2 repository 做 source inventory。
> 舊 V2 唔係 current authority。
> 所有搬遷決策以 current MFK reality 為準。

## A. Product Port Inventory

舊 V2 apps 共 7 個：

| Old app | MFK decision | Current state |
|---|---|---|
| admin-web | MOVE AS MFK PORT | DONE / TEST_GREEN / LANDED_CLEAN as `v2admin/**` |
| smm-web | MOVE AS MFK PORT | DONE / TEST_GREEN / LANDED_CLEAN as `v2smm/**` |
| customer-web | MOVE AS MFK PORT | ACTIVE migration as `v2customer/**` / NOT_WIRED |
| owner-web | MOVE AS MFK PORT | NEXT migration as `v2owner/**` / NOT_WIRED |
| smt-clean | DO NOT MOVE AGAIN | SMT already exists as current MFK `v2local/**` |
| smt-android | DO NOT PORT AS PRODUCT | old Android wrapper/carrier is not a new MFK product port; current MFK physical runtime stays separate |
| diagnostics-web | DO NOT PORT AS STANDALONE PRODUCT | diagnostics becomes shared capability/read surface later, not another product authority |

Summary:
- Old apps: 7
- Product ports that belong in MFK: 5 roles = SMT + Admin + SMM + Customer + Owner
- SMT already existed before this migration wave
- Admin landed
- SMM landed
- Remaining port migrations: Customer + Owner = 2
- Standalone old apps not to migrate: smt-android + diagnostics-web = 2

## B. Old packages｜44 total

Rule:
NONE of these 44 packages is copied wholesale as an authority package.
They are classified only as:
1. REDEFINE_LATER — capability is needed later, but must be redefined on MFK authority.
2. ORACLE_ONLY — MFK already owns this domain/surface; old package is reference only.
3. DEFER — not needed in current migration phase.

### B1. REDEFINE_LATER｜19

These capabilities may be implemented/wired later after all product ports are landed:

1. availability
2. business-day-cash
3. catalog
4. channel-settlement
5. event-durability
6. human-custody
7. identity-rbac
8. merchant-store
9. presentation-profile
10. production-eta
11. production-kds
12. production-operations
13. production-packing
14. reporting-projection
15. security-context-gateway
16. session-device-trust
17. store-configuration
18. store-order-intake
19. system-diagnostics

Important:
REDEFINE_LATER does NOT mean copy old code.
It means later:
MFK seam definition
→ one connection
→ immediate test
→ bank
→ next owner instruction.

### B2. ORACLE_ONLY / DO NOT MOVE CODE｜19

MFK already has the current product/domain authority or the old package is only legacy glue.
Do not import as a second engine:

1. admin-ui-integration
2. customer-ui-integration
3. owner-ui-integration
4. smm-ui-integration
5. smt-ui-integration
6. frontline-ui-integration
7. management-ui-integration
8. ui
9. internal-port-runtime
10. integration
11. store-kernel
12. order
13. payment
14. pricing
15. print
16. fulfillment
17. offline-operations
18. dine-in-service
19. production-persistence

Use only for:
- capability gap check
- workflow/UI reference
- regression/acceptance oracle

Never revive:
- old DB/persistence authority
- old API writers
- old Order/Payment/Pricing/Print authority
- old cross-port runtime glue

### B3. DEFER / NO NEED NOW｜6

Do not migrate during current port-migration wave:

1. customer-crm
2. customer-loyalty
3. customer-membership
4. digital-twin
5. inventory
6. large-order-b2b

They may be reopened only by explicit Owner priority after core ports + required seams are stable.

## C. Root/infra/workers/data/scripts/docs

Do NOT migrate these directories wholesale:
- workers/
- infra/
- data/
- scripts/
- docs/
- old governance yaml/registry files

They are archival/reference material only.

If a specific capability is later required:
fresh-read current MFK
→ define exact missing MFK seam
→ reimplement only the smallest necessary piece
→ test immediately
→ bank.

## D. Current clean landing status

1. SMT
   - current MFK: `v2local/**`
   - no remigration

2. Admin
   - current MFK: `v2admin/**`
   - migration smoke GREEN
   - clean landing GREEN
   - NOT_WIRED

3. SMM
   - current MFK: `v2smm/**`
   - source candidate smoke GREEN
   - clean landing smoke GREEN
   - NOT_WIRED

4. Customer
   - migration active
   - NOT_WIRED

5. Owner
   - migration queued
   - NOT_WIRED

## E. Fixed landing discipline

Every port:

MIGRATE IN ISOLATION
→ TEST SOURCE CANDIDATE
→ BUILD
→ CREATE CLEAN LANDING CANDIDATE FROM CURRENT MFK MAIN
→ TEST LANDING CANDIDATE
→ LAND TO MFK MAIN
→ KEEP NOT_WIRED
→ BANK

No connection during migration.

Future connection phase:

CONNECT ONE SEAM
→ TEST SAME SEAM IMMEDIATELY
→ GREEN/RED READBACK
→ BANK
→ STOP
→ OWNER DECIDES NEXT
