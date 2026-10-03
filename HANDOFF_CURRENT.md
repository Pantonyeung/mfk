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

`CHECKOUT_PAYMENT_CONFIRM` now has a trusted-native non-Student cash assembler and an exact same-Room transaction mapping. It fresh-validates seven revisioned dependencies and the earliest freshness deadline, then atomically commits:

- Business-Day display sequence CAS;
- one canonical `ORDER`;
- one linked canonical `PAYMENT`;
- one durable command receipt;
- deterministic Order-committed and Payment-confirmed outbox events.

The same submission replays one effect. Receipt-first recovery survives a lost reply and database reopen. Rollback, stale facts, expired deadlines, display-sequence contention, malformed/forged inputs, and fingerprint conflicts are covered by real Room tests.

Outbox ACK and release now require the positive `attemptCount` from the claimed item and include it in the Room CAS. A stale callback from an expired lease cannot mutate a newer claim, even when the worker identity is reused.

Commit `1e94181` encodes the Owner's resolved policy without inventing provider proof: non-cash settlement requires canonical `STAFF_CONFIRMED` evidence, cash requires `CASH_COUNTED`, and no screenshot is stored. Parent Owner authorization is device-bound, so local logout invalidates existing/new staff access on that device while another device remains valid.

At native code commit `1e94181b2bd433531571e68e13cb5516f9c08904`:

- 12 Android unit-test suites;
- 89 tests passed;
- 0 failures, 0 errors, 0 skipped;
- `:app:lintDebug` passed;
- `:app:assembleDebug -x verifySmtWebBundle --no-daemon` passed.

These tests inject trusted source ports. They do not prove production device enrollment, Owner/staff authentication, electronic settlement, physical printing, OTA behavior, or public routing.

## Still fail-closed in production

The public formal checkout bridge is intentionally not registered. It remains blocked until real native producers supply device/Owner/staff admission, formal quote/normalized intent, enabled POS tender, active Business Day, and display allocation. Student checkout also remains fail-closed until canonical eligibility and the remaining money-policy rules are published.

Every outbox dispatcher must echo the claim item's positive `attemptCount`. Missing or stale tokens must fail closed.

## Current bounded work

1. Reconcile native Print/OTA handoff changes and add crash-recovery regression coverage without changing a live endpoint or activating an update.
2. Freeze the exact canonical Orders/Dining read producer signature and schema.
3. Keep the Dining planner unregistered until every `Order.dining` membership/lifecycle writer CASes and bumps the same Dining revision.
4. Preserve Order identity, display number, payment, items, and first seated time; never fabricate an Order merely because a table is occupied.
5. Continue real native producer/adapter binding and then register only the bounded capability whose complete input/read set is proven.

## Resolved Owner policy

- Electronic settlement uses staff-confirmed visual-review evidence. It is not provider-verified evidence, and no screenshot is uploaded or stored.
- Owner logout revokes descendant staff access on this device only. Other store devices keep their independently bound authorization.

No remaining policy question blocks ordinary producer/read/adapter engineering. Credentials, enrollment provenance, Student eligibility/basis/rounding/stacking, and any genuine new money-policy choice still require explicit authority rather than invention.

## Release boundary

No push, Draft PR publication, merge, deploy, Builder request change, OTA activation, endpoint mutation, cutover, SMM decommission, live financial transaction, or physical acceptance has been performed by this branch. Only explicit Owner `PROMOTE` can open those gates.

MILESTONE:
`MFP_V3_A9R_POS_KERNEL_CURRENT_HANDOFF_2026_10_03`
