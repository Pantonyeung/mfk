# MFP V3 POS Kernel Progress and Evidence — 2026-10-03

Status: `SOURCE_AND_ROOM_VERIFIED` for the bounded non-Student `CHECKOUT_PAYMENT_CONFIRM` assembler, Room producers, high-level Android runtime bridge, and generic canonical-envelope/POS-tender Room projection. The local V2 publisher is reference-only; Admin V3 production publication, admission, and public/native runtime binding remain absent and fail closed.

This document records the latest Owner direction, the first verified native slice, the overnight candidate artifacts, and the OTA/source-binding evidence in one project. It does not authorize publish, deployment, OTA activation, live payment, merge, or replacement of the accepted production UI.

## Source identity

- Original reviewed checkout: `48c7eca6c051e72562ea9974bc2c6465b8584a7b`
- Isolated branch: `feat/MFP-V3-A9R-POS-KERNEL-R1-2026-10-03`
- Verified prerequisite commit: `8c52b155fb75edd39e4018853ca3c4144682e179`
- Latest verified code commit: `5056b737d5d734019115c5e5fbaf88e234cd4d93` (`CHECKOUT_PAYMENT_CONFIRM` mapping: `3e53a26`; outbox fence: `3c0cd77`; Order read: `2cfe244`; security: `8f9f228`; quote: `ce6769b`; tender/Business Day: `bfff335`; Print: `29e9716`; OTA: `359b8c6`; Dining read: `fe6316f`; V2-reference tender publication: `df260fd`; unregistered Dining planner/evidence: `ffe04cd` + `863974f`; Print/OTA fixture regression: `5056b73`)
- Existing Draft PR reference: `#651`; this branch has not been pushed to it.
- Existing A9 base authority: `69adb11215677d506545c5428f8deea4b89e7db2`

## Owner direction applied

- POS functionality is the priority; UI work remains paused.
- All business mutation stays in the same native Store Kernel and consumes canonical Admin-published configuration.
- No second Order, Pricing, Payment, Business Day, or persistence authority is introduced.
- No formal Order exists before `CHECKOUT_PAYMENT_CONFIRM`.
- Valid frontline staff do not require Manager role.
- Student Discount is 50%, automatically chooses the highest eligible unit, and uses stable line order for ties.
- Tender availability is driven by canonical enable/disable configuration.
- Money uses integer minor units; duplicate taps and retries produce one effect.
- Runtime assets and configuration remain updateable; no menu, price, tender, or runtime content is compiled as native truth.
- Owner account/password authorization is the device-bound parent of staff account/PIN sessions; a missing, changed, unknown, or revoked parent authorization removes staff access on that device. Owner logout is device-local and does not revoke independently authorized store devices.
- Electronic tender becomes canonical from explicit staff visual review recorded as `STAFF_CONFIRMED`, not provider verification. No screenshot is uploaded or stored, and reconnect/session change must not create a duplicate payment.

Admin V3 source identity is Draft PR `#605`, branch `feat/MFK-V3ADMIN-ONE-SHOT-R1`, exact audited SHA `5954f301c684e795453d622790ca11acae8dfe79`. It uses the shared canonical envelope plus formal server draft/publish/version clients, but remains `ZERO PRODUCTION ROUTING`; preview mode intentionally uses fixtures, and `posTenders` is absent. The checked-out A0 `v3admin` folder is stale. V2 is migration/reference only. Exact mapping and dry-run gates are recorded in `docs/architecture/MFP_ADMIN_V2_TO_V3_CONFIGURATION_MIGRATION_MAP_2026-10-03.md`.

## Completed bounded slice

The Store Kernel now accepts an immutable trusted-native `AggregateReadDependency` set on a `CommitRequest`. For a new submission, every dependency revision is checked inside the same Room transaction before any aggregate, receipt, inbox, outbox, or journal effect. Stored receipt replay still runs first, so an already-committed response remains replayable after a dependency advances.

The browser JSON parser rejects `readDependencies`; only trusted native handlers can attach them. Inputs are defensively copied, bounded to 32 entries, and reject invalid or duplicate aggregate keys.

The repository now also contains immutable session observations, exact Admin checkout source facts, and a trusted-native checkout assembler. Those contracts do not authenticate a device, verify a PIN, issue an Owner/staff session, prove enrollment provenance, select a production tender, or compute the unresolved Student policy by themselves.

The staff-session contract enforces a maximum 12-hour lifetime, transaction-time observation inputs, exact store/device/staff/session and device-bound parent-Owner authorization identity/revision, active frontline roles without a Manager-only gate, and rejects `VIEWER`/`REPORT_ONLY`, expired, inactive, revoked, unknown, or mismatched inputs. A revoked device A parent invalidates device A staff admission/session while an independently authorized device B remains valid. Verifier metadata is redacted and accepts only PBKDF2-SHA256 with a 256-bit hash; there is no raw-PIN field.

The Admin checkout adapter consumes the accepted `ADMIN_ACTIVE_CONFIGURATION` Room state and extracts exact integer-minor money facts with provenance. It deliberately leaves `posTenderPolicy` and `studentEligibilityPolicy` unbound. `customerPaymentChannels` and promotion data remain evidence only.

Commit `3e53a26` completes the bounded non-Student cash mapping behind trusted native ports. The assembler rechecks the client review against fresh native security, normalized-intent/quote, tender, and Business Day snapshots; combines exactly seven revisioned dependencies; and gives the existing coordinator the earliest freshness deadline. The closed transaction creates one Business-Day display-sequence mutation, one canonical `ORDER`, one linked `PAYMENT`, one durable receipt, and exactly two deterministic outbox events. The Order state is directly consumable by the retained Orders contract and includes `WALK_IN` source, `POS` source platform, allocated display number, active/in-progress lifecycle, canonical items, tender, and exact recognized/outstanding/refundable integer-minor values.

Display-number allocation is compare-and-set in the same Room transaction. Two submissions that both claim sequence revision 0 / display `0001` cannot both commit. Receipt replay still precedes dependency/deadline checks, so a committed response survives retry, lost reply, advanced facts, coordinator replacement, and database reopen without a second effect.

The high-level Android bridge is now source-bound. A quote request first revalidates the canonical device, device-local Owner authorization, and staff session; native pricing then rereads active Admin configuration and explicit `POS_TENDER_POLICY`, recomputes integer-minor totals, and atomically persists `FORMAL_QUOTE`. Payment Confirm rereads security, quote, Admin, tender, Business Day, and display sequence before the existing atomic commit. The runtime can send only formal quote/command/readback envelopes. Raw browser aggregate snapshots, receipts, inbox, outbox, and commits are rejected.

Channel changes invalidate the current quote immediately. Both quote state and the mutable canonical tender snapshot use generation fencing, so an older native response cannot overwrite a newer channel validation. A VALID native quote without its same-response tender snapshot fails closed.

Production checkout is still not usable because the Admin V3 deployment/non-browser consumer route and POS-tender publication are unproven, no approved device-enrollment, Owner-password, or staff-PIN/session writer populates the required security aggregates, the browser security authority is deliberately unbound, and no registered public/native catalog plus checkout capability exposes the host core. The same-Room projector exists; the local V2 `posTenders` publisher does not prove V3 publication. The bridge integration tests still seed test-only security records; they are not production authentication evidence.

## Test evidence

Real local test environment:

- Android Studio JBR Java 17
- Gradle 9.3.1
- Android Room 2.8.5
- Robolectric 4.16

Command:

```text
gradle.bat -p carrier/android testDebugUnitTest -x verifySmtWebBundle --tests com.morefunos.smt.storekernel.business.* --tests com.morefunos.smt.storekernel.StoreKernelFormalReceiptTest --no-daemon
```

Result before the latest contract slice:

- `FormalBusinessCommandContractTest`: 5 passed
- `FormalBusinessCommandRouterTest`: 10 passed
- `StoreKernelFormalReceiptTest`: 19 passed
- Total: 34 passed, 0 failures, 0 errors

Latest scoped command:

```text
gradle.bat -p carrier/android :app:testDebugUnitTest -x verifySmtWebBundle --tests com.morefunos.smt.storekernel.business.* --tests com.morefunos.smt.storekernel.StoreKernelFormalReceiptTest --tests com.morefunos.smt.storekernel.FormalAdminConfigSourceIntegrationTest --no-daemon
```

Latest full native result at `5056b73`:

- 26 suites
- 156 tests passed
- 0 failures, 0 errors, 0 skipped
- 12 dedicated `FormalCheckoutPaymentConfirmIntegrationTest` cases using real Room
- 25 `StoreKernelFormalReceiptTest` cases, including same-worker stale ACK/release lease races
- real Room formal-bridge quote-to-commit coverage plus raw browser Store Kernel boundary coverage
- `:app:lintDebug`: successful
- `:app:assembleDebug -x verifySmtWebBundle --no-daemon`: successful, including desugaring, DEX, and APK packaging

Latest V2-reference Admin result at `df260fd`:

- 40 test files
- 284 tests passed
- isolated strict TypeScript check for `pos-tender-policy-v1.ts` successful
- Vite production build successful
- only the pre-existing chunk-size advisory remained; the broad legacy Admin/Worker typecheck is not green because it imports existing Worker/Keeta typing debt

The checkout persistence tests use Room and cover atomic commit/replay, forged review rejection, incomplete and mismatched read sets, malformed/trailing normalized intent, dependency advance, deadline expiry, injected failure after receipt with full rollback, display-sequence contention, Router lost-reply recovery from a durable receipt, and close/reopen of a file-backed database. They are not FakeGateway-only tests. The trusted authorities in this suite are test-injected and are not production-source proof.

The router also performs receipt-first recovery after a commit exception. A lost reply that already has a durable receipt returns the canonical result. Only whitelisted pre-write revision conflicts with no receipt are converted to a durable rejection; all other failures remain `UNKNOWN` and require readback.

`verifySmtWebBundle` was excluded because this isolated worktree does not contain a built `v2local/dist/index.html`. This exclusion is not evidence that Carrier packaging is valid; it exposes the separate packaged-baseline issue recorded below.

## Reviewed patch provenance

- Library item: `libfile_db753f9e7d788191afbc9d8a7c30d04f`, version 1, `a9r-checkout-review-package.zip`
- Reviewed patch base: `48c7eca6c051e72562ea9974bc2c6465b8584a7b`
- Reviewed patch SHA-256: `a6172f1533c686978a3ef9d97773caf805486ca4603e24a1f11c00c107369d2f`
- Windows materialization remained blocked by the supported helper failing with `AttributeError: module 'os' has no attribute 'setxattr'`.
- The exact reviewed unified diff was supplied as task text, reconciled with stronger local tests, and verified in the real repository test environment.

## Overnight candidate artifact index

These are retained as isolated candidate/reference assets. They are not production authority, not imported code in this branch, and not approved UI replacements.

| Candidate | Reference | Existing evidence | Remaining acceptance |
|---|---|---|---|
| POS UI | Library `libfile_456c582dcf7c81918b98ccc2eef8792a`; private preview `https://morefun-pos-private-preview.pantonyeungjp.chatgpt.site` | 26 model tests and 4 stub/source checks; candidate covers split-one/all, dirty-edit confirmation, held pricing context, storage-failure payment gating, and next order | Source bytes still pending supported import; no actual browser/mobile/visual acceptance |
| Customer UI | Library `libfile_8e6ddbeb23b88191903004c2ac957208`; private preview `https://morefun-customer-private-preview.pantonyeungjp.chatgpt.site` | 17 domain and 8 React state tests; type/build pass; candidate covers selected-item reorder, line identity/editing, complete review before simulated payment, optional recommendations, and persisted pending guards | Source bytes still pending supported import; no actual browser/mobile/visual acceptance |
| Review report | Library `libfile_67d5de9562d48191b0acbdb477808af8` | Owner-private review reference | Pending supported import and source reconciliation |

Cloud QA stopped at Owner login. The preview evidence must not be described as production, device, visual, or financial acceptance.

## OTA and Carrier source evidence

Two update paths exist and must remain separate from transaction data:

1. Web runtime OTA: signed/hash-verified `.mfos` bundle download, stage, activate, ready, promote, previous-release rollback in `RuntimeUpdateClient`, `RuntimeBundleVerifier`, and `RuntimeReleaseStore`.
2. Carrier APK update: `carrier-update.json`, APK SHA-256, package/version/installed-signer validation, and PackageInstaller in `CarrierUpdateClient`, exposed through `CarrierRecoveryActivity`.

Both Runtime and Carrier manifest endpoints already use persisted active/previous/default stores. Recovery can test, save, restore previous, and restore default endpoints. `RuntimeUpdateClient.checkForUpdate()` and `CarrierUpdateClient.checkForUpdate()` read the effective stored endpoint. HTTPS and existing bundle/APK verification rules remain mandatory.

Required endpoint acceptance before a new Carrier can ship:

- enter a new valid HTTPS endpoint in Recovery;
- test it without saving;
- save it and verify active/previous/default values;
- restart the process/device and verify retention;
- verify the actual corresponding updater reads the saved override;
- restore previous/default;
- reject HTTP, user-info, fragment, invalid manifest, hash, package, signer, version, or compatibility failures.

No live endpoint is changed by this branch.

## Known OTA/source-binding gaps

- `v3smt/src/sync-binding.ts` still uses `unboundSyncTransport`; head/changes/checkpoint calls reject `MFP_SYNC_BINDING_UNAVAILABLE`. Menu, price, tender, staff, and Business Day convergence is not working merely because the protocol exists.
- `runtime.ready` is emitted after React mount. It does not prove config sync, Store Kernel authority, checkout, printer, or business readiness.
- `carrier/android/app/build.gradle.kts` packages `../../../v2local/dist`; the current baseline/fallback may return to V2. A safe V3 Carrier baseline/rollback migration is required before packaging.
- The V3 runtime manifest declares Carrier/bridge compatibility, but those values alone do not prove that a deployed APK contains the A9R router.
- Current Builder source verification pins the older MFK SHA `69adb11215677d506545c5428f8deea4b89e7db2`, while the request reference remains older still. No workflow or request is changed without release authorization.
- Business transaction data stays in Store Kernel and must never be overwritten, rolled back, or treated as an asset of runtime OTA.

## Actual remaining blockers

- Admin V3 #605 is source-audited but explicitly unrouted. Production needs the deployed V3 backend identity, authenticated canonical publish/read endpoint, approved MFP non-browser consumer route, revision/fingerprint readback semantics, and a formal `posTenders` field before native Admin binding can be activated.
- Device admission needs an MFK-native enrollment/authorization record. Admin ACK membership is only config-delivery evidence and is not authorization.
- Staff authentication can consume the canonical `MFK_STAFF_AUTH_V1` verifier projection, and the value contract now enforces the 12-hour maximum; the real native verifier, session issuer/revoker, and persisted producer remain unbound and must expose no PINs to persistence or logs.
- Owner-parent authorization is now device-local. The real account/password verifier, persisted authorization/session issuer, and revocation producer remain unbound and must not create or expose credentials.
- `storeSettings.customerPaymentChannels` is a Customer electronic-channel configuration and remains insufficient for all-POS tender eligibility or settlement. The same-Room `POS_TENDER_POLICY` projector is implemented, but Admin V3 #605 has no `posTenders` field; local V2 publication is reference-only.
- Admin `businessDay.cutoff` classifies the business date for reporting/history. Current accepted behavior does not establish an old-V2-style OPEN-only trading gate; no such gate may be invented.
- The canonical source of `studentDiscountEligible` is not present in the published Admin contract. This is a money-policy/data decision; checkout must fail closed for Student Discount until the Owner selects a canonical eligibility field or publication rule.
- Student discount still needs exact option/surcharge basis, odd-minor rounding, and stacking behavior against `riceballDrink`; the mapper does not invent those answers.
- Electronic tender evidence is settled as `STAFF_CONFIRMED` after staff visual review. The Room tender producer now consumes the explicit Admin policy; it must not claim provider verification, store screenshots, or duplicate payment on reconnect/session change.
- The checkout handler ports and bridge now use real Room-backed security, quote, tender, Business Day, display allocation, and canonical Order read producers. What remains absent is production security population (device enrollment, Owner/password authorization, staff PIN/session issue/revoke), Admin startup/doorbell convergence, and registered public/native catalog plus checkout capability. Missing records fail closed.
- `MFP_ORDER_COMMITTED_V1` and `MFP_PAYMENT_CONFIRMED_V1` are now inserted atomically with deterministic identities, but dispatcher consumers and print/projection acknowledgement semantics remain separate stages. Commit `3c0cd77` fences outbox ACK/release by the claim's monotonically increasing `attemptCount`; a callback from an expired lease cannot alter a reclaimed lease even when the worker identity is reused. Dispatchers must echo the claim item's positive `attemptCount` or fail closed.
- No physical printer/device or live financial acceptance was run. Physical acceptance remains a separate gate.

## Next engineering action

Pause further native binding at this checkpoint. First reconcile the deployed Admin V3 backend, formal canonical endpoint, approved MFP consumer route, readback semantics, and POS-tender field against exact SHA `5954f301c684e795453d622790ca11acae8dfe79`; run the documented V2-to-V3 map as a no-write dry run. Only then register the smallest authenticated native catalog-read plus checkout capability and obtain the approved device-enrollment and Owner/staff credential path. Keep the Dining planner unregistered until the complete Order index and every membership writer share the same Dining CAS/bump. Do not claim production checkout, live payment, printer, or OTA acceptance from test-only records.
