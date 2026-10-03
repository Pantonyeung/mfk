# MFP COMMANDER CURRENT — MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-03 Asia/Hong_Kong
Repository: Pantonyeung/mfk

## Owner authorization

The Owner reauthorized Codex to prioritize a functioning POS system while UI work remains paused. Engineering is to continue through bounded POS capabilities without stopping for already-solvable implementation gaps. Stop only for genuine money-policy choices, credentials/access expansion, destructive or sensitive operations, or an ambiguous authority conflict.

Parent A9 exact SHA:
`69adb11215677d506545c5428f8deea4b89e7db2`

Current execution branch:
`feat/MFP-V3-A9R-POS-KERNEL-R1-2026-10-03`

Latest verified native implementation commits:

- checkout mapping: `3e53a264bbbd4dcfe90305f0d69b63427b40f0ad`
- outbox attempt fence: `3c0cd77681b15b8d980f4e1dbe7aa2650643dbf3`

This branch-local current control explicitly supersedes the older A9R execution-branch pointer for this Owner-directed POS Kernel lane. It does not supersede the A9R authority, create a second authority, or grant promotion.

## Current substage

`A9R — POS KERNEL R1 SOURCE_AND_ROOM_VERIFIED / PRODUCTION SOURCE BINDING IN PROGRESS`

The bounded non-Student cash `CHECKOUT_PAYMENT_CONFIRM` transaction is implemented and verified with injected trusted source ports. The public production bridge remains unregistered and fail-closed until native device/Owner/staff, quote, POS tender, Business Day, and display-sequence producers are bound and verified.

The next bounded engineering work is native Print/OTA recovery hardening and canonical Orders/Dining read planning. Dining mutation registration remains blocked until every Order.dining lifecycle writer participates in the same Dining revision CAS/bump contract.

## Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `HANDOFF_CURRENT.md`
3. `docs/governance/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_AUTHORITY_2026-10-02.md`
4. `docs/architecture/MFP_V3_A9R_FORMAL_BUSINESS_COMMAND_MATRIX_2026-10-02.md`
5. `docs/handoff/MFP_V3_POS_KERNEL_PROGRESS_AND_EVIDENCE_2026-10-03.md`
6. `docs/plan/MFP_V3_POS_SOURCE_BINDINGS_AND_OTA_ROADMAP_2026-10-03.md`
7. `.github/mfk-change-manifest.json`
8. Store Kernel native contracts/coordinator/bridge and relevant tests
9. accepted donor behavior tests only

## Authority owner

`STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`

Runtime boundary: Android Carrier / Store Kernel native authority layer.

React/browser is not the business authority. Admin remains the sole canonical publisher of configuration consumed by this same Store Kernel. Old V2 pricing, Order, Payment, kernel, and persistence code remains oracle-only and must not be revived.

## Verified native scope

- formal command parser, registry, bounded bridge, receipt/readback, and raw mutation rejection;
- native-only revisioned read dependencies and transaction deadline in the existing Room transaction;
- canonical Admin configuration validation/projection and explicit HTTPS read client;
- immutable device/staff/session and checkout-source contracts that fail closed when a producer is absent;
- atomic display-sequence CAS, canonical Order, canonical Payment, receipt, and deterministic Order/Payment outbox effects for non-Student cash confirmation;
- receipt-first retry/lost-reply/reopen recovery;
- outbox ACK/release fencing by the claimed positive `attemptCount`.

At `3c0cd77`, the full Android unit suite is 11 suites / 85 tests, with 0 failures, 0 errors, and 0 skipped. `:app:assembleDebug -x verifySmtWebBundle --no-daemon` also succeeds. These are source/Room/build results, not production, device, physical-print, or live-payment proof.

## Production binding boundary

Missing production inputs must fail closed. Current engineering gaps include native device/Owner/staff admission, formal quote, enabled POS tender, active Business Day, display allocation, dispatcher consumers, canonical Orders/Dining reads, and public bridge registration. These gaps are authorized engineering work; they are not permission to invent credentials, policy, or a second authority.

The two unresolved Owner decisions are:

- whether electronic settlement becomes canonical from staff-confirmed evidence or provider-confirmed success;
- whether Owner logout revokes descendant staff sessions only on this device or across all store devices.

Ordinary non-Student checkout engineering may continue without those decisions.

## Hard locks

- no direct browser aggregate mutations;
- no second Store Kernel, Order, Pricing, Payment, Refund, Print, Dining, Capacity, Staff, Device, or persistence authority;
- no localStorage transaction authority or periodic business polling engine;
- no V2 runtime authority import or SMM authority;
- no fake `COMMITTED`, production proof, physical proof, or live financial transaction;
- no push-triggered publication, Candidate Publish, deploy, OTA activation, merge, cutover, or decommission without explicit Owner `PROMOTE`.

## A9 gates

- A9-S source diagnostics: `SOURCE_VERIFIED`
- A9-B Builder V3 packaging: `SOURCE_VERIFIED` only for the previously recorded source; current branch is not published
- A9R router and bounded checkout mapping: `SOURCE_AND_ROOM_VERIFIED`
- A9R production source/bridge binding: `IN_PROGRESS / FAIL_CLOSED`
- A9-C Candidate Publish: `BLOCKED`
- A9-P physical acceptance: `BLOCKED`
- A9-X cutover/SMM decommission: `BLOCKED`

MILESTONE:
`MFP_V3_A9R_POS_KERNEL_CURRENT_EXECUTION_CONTROL_2026_10_03`
