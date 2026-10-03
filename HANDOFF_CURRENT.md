# MFP CURRENT HANDOFF — 2026-10-03

Status: CURRENT / CONTROLLING HANDOFF

Current:
`A9R — POS KERNEL R1 SOURCE_AND_ROOM_VERIFIED / PRODUCTION SOURCE BINDING IN PROGRESS`

Branch:
`feat/MFP-V3-A9R-POS-KERNEL-R1-2026-10-03`

Parent:
`69adb11215677d506545c5428f8deea4b89e7db2`

Authority:
`docs/governance/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_AUTHORITY_2026-10-02.md`

Progress evidence:
`docs/handoff/MFP_V3_POS_KERNEL_PROGRESS_AND_EVIDENCE_2026-10-03.md`

Engineering plan:
`docs/plan/MFP_V3_POS_SOURCE_BINDINGS_AND_OTA_ROADMAP_2026-10-03.md`

## Owner direction

POS functionality is the priority and UI work remains paused. Continue bounded engineering through the existing native Store Kernel and consume the existing Admin canonical publication. Do not create another authority or revive old V2 transaction code. Stop only for genuine money-policy decisions, credentials/access expansion, destructive/sensitive operations, or ambiguous authority conflicts.

## Implemented and verified

`CHECKOUT_PAYMENT_CONFIRM` now has a trusted-native non-Student assembler, exact same-Room transaction mapping, and a high-level Android runtime quote/submit/readback bridge. It fresh-validates seven revisioned dependencies and the earliest freshness deadline, then atomically commits:

- Business-Day display sequence CAS;
- one canonical `ORDER`;
- one linked canonical `PAYMENT`;
- one durable command receipt;
- deterministic Order-committed and Payment-confirmed outbox events.

The same submission replays one effect. Receipt-first recovery survives a lost reply and database reopen. Rollback, stale facts, expired deadlines, display-sequence contention, malformed/forged inputs, and fingerprint conflicts are covered by real Room tests.

Outbox ACK and release now require the positive `attemptCount` from the claimed item and include it in the Room CAS. A stale callback from an expired lease cannot mutate a newer claim, even when the worker identity is reused.

Commit `1e94181` encodes the Owner's resolved policy without inventing provider proof: non-cash settlement requires canonical `STAFF_CONFIRMED` evidence, cash requires `CASH_COUNTED`, and no screenshot is stored. Parent Owner authorization is device-bound, so local logout invalidates existing/new staff access on that device while another device remains valid.

Commits `2cfe244`, `8f9f228`, `ce6769b`, and `bfff335` add canonical Order readback plus Room-backed security, formal quote, canonical tender, Business Day, and display-allocation producers. Commit `0d5c18e33b6d4aee59ddd66f69973c82e9196b28` binds them to the high-level Android bridge, rejects browser raw aggregate/receipt/inbox/outbox operations, and fences stale quote and tender responses after a channel change.

At native/web code commit `0d5c18e33b6d4aee59ddd66f69973c82e9196b28`:

- 19 Android unit-test suites;
- 122 tests passed;
- 0 failures, 0 errors, 0 skipped;
- `:app:lintDebug` passed;
- `:app:assembleDebug -x verifySmtWebBundle --no-daemon` passed.
- V3 web: 31 test files / 600 tests passed;
- TypeScript typecheck and production build passed.

The end-to-end Room bridge test seeds explicit test-only canonical records. It does not prove production device enrollment, Owner/staff authentication, POS tender publication, provider settlement, physical printing, OTA behavior, or live routing.

## Still fail-closed in production

The high-level formal checkout bridge is registered, but production inputs remain absent. The browser security authority has no approved device-enrollment, Owner-password, or staff-PIN/session issuer/revoker, and Admin has no explicit canonical POS-tender publication field/writer. Those missing records cause the Room-backed bridge to fail closed. Student checkout also remains fail-closed until canonical eligibility and the remaining money-policy rules are published.

Every outbox dispatcher must echo the claim item's positive `attemptCount`. Missing or stale tokens must fail closed.

## Current bounded work

1. Obtain the approved enrollment/login/session path and credential provenance before implementing production device/Owner/staff population.
2. Obtain or add the explicit Admin `posTenders` publication field and bind its Store Kernel projector; do not promote `customerPaymentChannels` or `paymentRefs`.
3. Wire canonical Admin startup/doorbell convergence, then verify bridge acceptance with non-production credentials and no live charge.
4. Keep the Dining planner unregistered until every `Order.dining` membership/lifecycle writer CASes and bumps the same Dining revision.
5. Continue Print/OTA crash recovery and dispatcher work without activation or physical-proof claims.

## Resolved Owner policy

- Electronic settlement uses staff-confirmed visual-review evidence. It is not provider-verified evidence, and no screenshot is uploaded or stored.
- Owner logout revokes descendant staff access on this device only. Other store devices keep their independently bound authorization.

No remaining policy question blocks ordinary producer/read/adapter engineering. Credentials, enrollment provenance, Student eligibility/basis/rounding/stacking, and any genuine new money-policy choice still require explicit authority rather than invention.

## Release boundary

No push, Draft PR publication, merge, deploy, Builder request change, OTA activation, endpoint mutation, cutover, SMM decommission, live financial transaction, or physical acceptance has been performed by this branch. Only explicit Owner `PROMOTE` can open those gates.

MILESTONE:
`MFP_V3_A9R_POS_KERNEL_CURRENT_HANDOFF_2026_10_03`
