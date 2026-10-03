# MFP V3 POS Kernel Progress and Evidence — 2026-10-03

Status: `SOURCE_AND_ROOM_VERIFIED` for the bounded non-Student cash `CHECKOUT_PAYMENT_CONFIRM` assembler and commit mapping. Trusted production source ports and the public bridge remain fail-closed and unbound.

This document records the latest Owner direction, the first verified native slice, the overnight candidate artifacts, and the OTA/source-binding evidence in one project. It does not authorize publish, deployment, OTA activation, live payment, merge, or replacement of the accepted production UI.

## Source identity

- Original reviewed checkout: `48c7eca6c051e72562ea9974bc2c6465b8584a7b`
- Isolated branch: `feat/MFP-V3-A9R-POS-KERNEL-R1-2026-10-03`
- Verified prerequisite commit: `8c52b155fb75edd39e4018853ca3c4144682e179`
- Latest verified native code commit: `3c0cd77` (`CHECKOUT_PAYMENT_CONFIRM` mapping: `3e53a26`)
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
- Owner account/password authorization is the required parent of staff account/PIN sessions; a missing, changed, unknown, or revoked parent authorization removes staff access. Parent authorization/logout scope remains an explicit unresolved policy decision.

## Completed bounded slice

The Store Kernel now accepts an immutable trusted-native `AggregateReadDependency` set on a `CommitRequest`. For a new submission, every dependency revision is checked inside the same Room transaction before any aggregate, receipt, inbox, outbox, or journal effect. Stored receipt replay still runs first, so an already-committed response remains replayable after a dependency advances.

The browser JSON parser rejects `readDependencies`; only trusted native handlers can attach them. Inputs are defensively copied, bounded to 32 entries, and reject invalid or duplicate aggregate keys.

The repository now also contains immutable session observations, exact Admin checkout source facts, and a trusted-native checkout assembler. Those contracts do not authenticate a device, verify a PIN, issue an Owner/staff session, prove enrollment provenance, select a production tender, or compute the unresolved Student policy by themselves.

The staff-session contract enforces a maximum 12-hour lifetime, transaction-time observation inputs, exact store/device/staff/session and parent-Owner authorization identity/revision, active frontline roles without a Manager-only gate, and rejects `VIEWER`/`REPORT_ONLY`, expired, inactive, revoked, unknown, or mismatched inputs. Verifier metadata is redacted and accepts only PBKDF2-SHA256 with a 256-bit hash; there is no raw-PIN field.

The Admin checkout adapter consumes the accepted `ADMIN_ACTIVE_CONFIGURATION` Room state and extracts exact integer-minor money facts with provenance. It deliberately leaves `posTenderPolicy` and `studentEligibilityPolicy` unbound. `customerPaymentChannels` and promotion data remain evidence only.

Commit `3e53a26` completes the bounded non-Student cash mapping behind trusted native ports. The assembler rechecks the client review against fresh native security, normalized-intent/quote, tender, and Business Day snapshots; combines exactly seven revisioned dependencies; and gives the existing coordinator the earliest freshness deadline. The closed transaction creates one Business-Day display-sequence mutation, one canonical `ORDER`, one linked `PAYMENT`, one durable receipt, and exactly two deterministic outbox events. The Order state is directly consumable by the retained Orders contract and includes `WALK_IN` source, `POS` source platform, allocated display number, active/in-progress lifecycle, canonical items, tender, and exact recognized/outstanding/refundable integer-minor values.

Display-number allocation is compare-and-set in the same Room transaction. Two submissions that both claim sequence revision 0 / display `0001` cannot both commit. Receipt replay still precedes dependency/deadline checks, so a committed response survives retry, lost reply, advanced facts, coordinator replacement, and database reopen without a second effect.

The production bridge is intentionally not activated. Tests inject trusted native source ports; absent real device/session, quote, POS tender, Business Day, and display-sequence producers, public checkout remains fail-closed. No browser field can attach read dependencies, supply canonical state, or choose aggregate/outbox identities.

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

Latest full native result at `3c0cd77`:

- 11 suites
- 85 tests passed
- 0 failures, 0 errors, 0 skipped
- 12 dedicated `FormalCheckoutPaymentConfirmIntegrationTest` cases using real Room
- 25 `StoreKernelFormalReceiptTest` cases, including same-worker stale ACK/release lease races
- `:app:assembleDebug -x verifySmtWebBundle --no-daemon`: successful, including desugaring, DEX, and APK packaging

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

- Device admission needs an MFK-native enrollment/authorization record. Admin ACK membership is only config-delivery evidence and is not authorization.
- Staff authentication can consume the canonical `MFK_STAFF_AUTH_V1` verifier projection, and the value contract now enforces the 12-hour maximum; the real native verifier, session issuer/revoker, and persisted producer remain unbound and must expose no PINs to persistence or logs.
- Owner-parent authorization scope remains undecided: device-local, store-wide, or cross-device. The value contract fails closed but does not choose the scope or create account/password credentials.
- `storeSettings.customerPaymentChannels` is a Customer electronic-channel configuration. It is not, by itself, proof of all-POS tender eligibility or settlement. The formal POS tender publication field/source must be bound explicitly and otherwise fails closed.
- Admin `businessDay.cutoff` classifies the business date for reporting/history. Current accepted behavior does not establish an old-V2-style OPEN-only trading gate; no such gate may be invented.
- The canonical source of `studentDiscountEligible` is not present in the published Admin contract. This is a money-policy/data decision; checkout must fail closed for Student Discount until the Owner selects a canonical eligibility field or publication rule.
- Student discount still needs exact option/surcharge basis, odd-minor rounding, and stacking behavior against `riceballDrink`; the mapper does not invent those answers.
- Electronic tender settlement still needs an explicit rule: staff-recorded evidence versus provider-verified success.
- The native checkout handler ports still need real MFK producers for device/Owner/staff admission, formal quote/normalized intent, enabled POS tender, active Business Day, and display-sequence allocation. Public bridge registration stays fail-closed until all are available.
- `MFP_ORDER_COMMITTED_V1` and `MFP_PAYMENT_CONFIRMED_V1` are now inserted atomically with deterministic identities, but dispatcher consumers and print/projection acknowledgement semantics remain separate stages. Commit `3c0cd77` fences outbox ACK/release by the claim's monotonically increasing `attemptCount`; a callback from an expired lease cannot alter a reclaimed lease even when the worker identity is reused. Dispatchers must echo the claim item's positive `attemptCount` or fail closed.
- No physical printer/device or live financial acceptance was run. Physical acceptance remains a separate gate.

## Next engineering action

Bind real device/Owner/staff, formal quote, POS tender, Business Day, and display-sequence producers to the verified handler before enabling public `CHECKOUT_PAYMENT_CONFIRM`. Continue one formal command family at a time through Orders/Dining readback and recovery, and update each outbox dispatcher to echo the claimed attempt token. Do not claim production checkout, live payment, printer, or OTA acceptance from the test-injected source suite.
