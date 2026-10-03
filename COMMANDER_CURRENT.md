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
- AtomicFile backup recovery: `6b87f6a`
- Android API 24 compatibility: `16ca7fb`
- settlement evidence and device-local Owner logout policy: `1e94181`
- canonical Order readback: `2cfe24422967740c69d9ae4ba1420ed7a921a840`
- Room-backed security admission: `8f9f2287844824538d12aca89ae61bb2b7008868`
- Admin-to-formal-quote producer: `ce6769bb088c5d3bcf4df5270e204b1868eb54ee`
- tender and Business Day producers: `bfff335004ea26972a3b721b99c78ce48e30bff1`
- high-level Android checkout bridge: `0d5c18e33b6d4aee59ddd66f69973c82e9196b28`

This branch-local current control explicitly supersedes the older A9R execution-branch pointer for this Owner-directed POS Kernel lane. It does not supersede the A9R authority, create a second authority, or grant promotion.

## Current substage

`A9R — POS KERNEL R1 SOURCE_AND_ROOM_VERIFIED / PRODUCTION SOURCE BINDING IN PROGRESS`

The bounded non-Student `CHECKOUT_PAYMENT_CONFIRM` transaction and high-level Android runtime bridge are source/Room verified. Security, quote, tender, Business Day, display allocation, atomic Order/Payment commit, receipt/readback, and canonical Order readback now use the existing Room Store Kernel. Production remains fail-closed because no approved enrollment/login/session writer populates device/Owner/staff records and no explicit Admin POS-tender publication writer populates `POS_TENDER_POLICY`.

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

- formal command parser, registry, high-level quote/checkout bridge, receipt/readback, and raw browser Store Kernel operation rejection;
- native-only revisioned read dependencies and transaction deadline in the existing Room transaction;
- canonical Admin configuration validation/projection and explicit HTTPS read client;
- immutable device/staff/session and checkout-source contracts that fail closed when a producer is absent;
- atomic display-sequence CAS, canonical Order, canonical Payment, receipt, and deterministic Order/Payment outbox effects for non-Student cash confirmation;
- receipt-first retry/lost-reply/reopen recovery;
- outbox ACK/release fencing by the claimed positive `attemptCount`;
- explicit `CASH_COUNTED` versus `STAFF_CONFIRMED` settlement evidence with no provider-verified claim or screenshot storage;
- device-bound parent Owner authorization so a local logout revokes staff access on that device without revoking another device.
- Room-backed security admission, formal quote, tender, Business Day, and canonical Order read producers;
- native-to-web formal quote and Payment Confirm transport with stale quote/tender response generation fencing.

At `0d5c18e`, the full Android unit suite is 19 suites / 122 tests, with 0 failures, 0 errors, and 0 skipped. `:app:lintDebug` and `:app:assembleDebug -x verifySmtWebBundle --no-daemon` succeed. V3 web verification is 31 files / 600 tests plus TypeScript typecheck and production build. These are source/Room/build results, not production credential, enrolled-device, physical-print, provider-settlement, or live-payment proof.

## Production binding boundary

Missing production inputs must fail closed. The Room-backed admission/quote/tender/Business Day/display/Order-read ports and the high-level Android bridge are now bound. Current gaps are population and lifecycle writers for device enrollment, Owner authorization, staff PIN/session issue/revoke, explicit Admin POS-tender publication, Admin startup/doorbell convergence, dispatcher consumers, and the remaining Orders/Dining operations. These gaps are authorized engineering work, but credentials and the canonical POS-tender publication field cannot be invented.

The Owner has resolved the prior settlement/logout decisions:

- electronic settlement records staff visual review as `STAFF_CONFIRMED`; it must not claim provider verification, upload/store screenshots, or create a second payment after reconnect/session change;
- Owner logout revokes the parent authorization and descendant staff access on that device only; other devices remain unaffected.

The real native verifier/session issuer/revoker and canonical tender-policy publisher remain absent. Browser security authority is therefore still unbound, and the runtime cannot obtain a production session or tender row; checkout fails closed before a real transaction.

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
- A9R high-level checkout bridge: `SOURCE_AND_ROOM_VERIFIED`
- A9R production admission/tender population: `BLOCKED / FAIL_CLOSED`
- A9-C Candidate Publish: `BLOCKED`
- A9-P physical acceptance: `BLOCKED`
- A9-X cutover/SMM decommission: `BLOCKED`

MILESTONE:
`MFP_V3_A9R_POS_KERNEL_CURRENT_EXECUTION_CONTROL_2026_10_03`
