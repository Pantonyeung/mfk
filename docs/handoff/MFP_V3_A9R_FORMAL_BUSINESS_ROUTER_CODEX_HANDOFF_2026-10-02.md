# MFP V3 A9R｜Codex Handoff｜Formal Business Command Router｜2026-10-02

Status: READY_FOR_CODEX
Parent exact MFK SHA:
`69adb11215677d506545c5428f8deea4b89e7db2`

Branch:
`feat/MFP-V3-A9R-FORMAL-BUSINESS-ROUTER-2026-10-02`

Authority:
`docs/governance/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_AUTHORITY_2026-10-02.md`

## First implementation pass: R0 + R1 seam

Do not attempt public deploy/OTA.

### Required R0 outputs
1. Native formal business envelope parser/validator.
2. Explicit command registry.
3. Unknown command fail-closed.
4. No browser-supplied aggregate mutation support.
5. Stable native result mapping to COMMITTED / REJECTED / UNKNOWN.
6. Idempotency/readback identity.
7. Command-to-state matrix document.
8. Native bridge bounded formal submit/read capability.
9. Security authority seam as injected/fail-closed interface.
10. Java/native tests proving no raw aggregate injection.

### Required first vertical slice
Implement the Checkout formal boundary as the first real command:
`CHECKOUT_PAYMENT_CONFIRM`

But only if the canonical pricing/payment inputs needed to validate it can be supplied by a formal authority seam.

If Pricing/Tender formal authority is still absent:
- implement router contract/skeleton
- return BLOCKED/REJECTED with stable code
- DO NOT move pricing logic into React or blindly port preview arithmetic

The first pass must explicitly answer whether formal Checkout can be completed safely with current repo authorities.

## Mandatory fresh-read

- COMMANDER_CURRENT.md
- HANDOFF_CURRENT.md
- A9 source-binding audit
- A9 handoff
- this A9R authority
- A1 Store Kernel contracts/tests
- A5 Checkout/Money contracts/tests
- A6 Orders/Dining/Capacity contracts/tests
- A7 Print contracts/tests
- A8 External contracts/tests
- carrier StoreKernelContract
- StoreKernelTransactionCoordinator
- StoreKernelBridgeController
- MainActivity bridge
- relevant accepted v2local donor tests only

## Hard prohibitions

- no business mutation authority in React
- no direct React generation of Store Kernel aggregate mutation list
- no v2local runtime import into v3smt
- no second database
- no second Order/Pricing/Payment/Refund/Print/Capacity authority
- no fake COMMITTED
- no production deploy
- no Builder request change
- no OTA
- no SMM decommission

## R0/R1 acceptance tests minimum

1. valid high-level envelope parses
2. unknown command rejected
3. missing device/session identity rejected
4. invalid expected revision rejected
5. duplicate submission + same fingerprint replays same result
6. duplicate submission + different fingerprint conflicts
7. browser cannot submit aggregateType/mutations
8. browser cannot submit canonical state JSON
9. Store Kernel commit only happens after router validation
10. native bridge exposes bounded formal route only
11. native route cannot invoke arbitrary Store Kernel low-level operation
12. timeout maps UNKNOWN
13. UNKNOWN readback-first
14. COMMITTED requires Store Kernel receipt
15. REJECTED stable across replay
16. command matrix covers all known V3 command types
17. CHECKOUT_PAYMENT_CONFIRM is registered
18. checkout open/review creates zero formal commit
19. Payment Confirm double tap one effect
20. stale revision rejects before commit
21. client total cannot override formal total
22. invalid tender rejects
23. unresolved Student Discount intent cannot be client-finalized
24. no early Formal Order ID
25. no print side effect before formal commit
26. no capacity side effect before formal commit
27. no v2 state import
28. no SMM authority
29. A1–A9 source regressions green
30. no deployment/publish change

## Completion report

Return:
1. R0 router skeleton status
2. authority owner proof
3. native location/files
4. command registry
5. command matrix
6. envelope validation
7. low-level mutation injection rejection
8. security seam
9. Store Kernel commit seam
10. idempotency/readback
11. result state mapping
12. CHECKOUT_PAYMENT_CONFIRM status
13. Pricing authority dependency status
14. Tender authority dependency status
15. first vertical slice proof
16. changed files
17. exact SHA
18. tests
19. CI
20. unresolved blockers
21. R2 next action

Completion target:
`SOURCE_VERIFIED` for the implemented R0/R1 scope.

If Pricing/Payment authority dependency prevents formal checkout:
state that dependency as BLOCKED; do not fake it.

MILESTONE:
`MFP_V3_A9R_R0_R1_FORMAL_ROUTER_2026_10_02`
