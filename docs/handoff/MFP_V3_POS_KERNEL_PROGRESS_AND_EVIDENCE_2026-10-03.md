# MFP V3 POS Kernel Progress and Evidence — 2026-10-03

Status: `SOURCE_VERIFIED` for the bounded Store Kernel read-dependency prerequisite only.

This document records the latest Owner direction, the first verified native slice, the overnight candidate artifacts, and the OTA/source-binding evidence in one project. It does not authorize publish, deployment, OTA activation, live payment, merge, or replacement of the accepted production UI.

## Source identity

- Original reviewed checkout: `48c7eca6c051e72562ea9974bc2c6465b8584a7b`
- Isolated branch: `feat/MFP-V3-A9R-POS-KERNEL-R1-2026-10-03`
- Verified prerequisite commit: `8c52b155fb75edd39e4018853ca3c4144682e179`
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

## Completed bounded slice

The Store Kernel now accepts an immutable trusted-native `AggregateReadDependency` set on a `CommitRequest`. For a new submission, every dependency revision is checked inside the same Room transaction before any aggregate, receipt, inbox, outbox, or journal effect. Stored receipt replay still runs first, so an already-committed response remains replayable after a dependency advances.

The browser JSON parser rejects `readDependencies`; only trusted native handlers can attach them. Inputs are defensively copied, bounded to 32 entries, and reject invalid or duplicate aggregate keys.

This is a prerequisite, not a working checkout handler. It does not authenticate a device or staff member, validate wall-clock expiry, prove remote provenance, build a quote, select an eligible tender, derive a Business Day, or map Order/payment records.

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

Result:

- `FormalBusinessCommandContractTest`: 5 passed
- `FormalBusinessCommandRouterTest`: 8 passed
- `StoreKernelFormalReceiptTest`: 19 passed
- Total: 32 passed, 0 failures, 0 errors

The persistence tests use Room, including failure injection after receipt write with full transaction rollback, serialized dependency-advance race, lost-reply receipt readback/replay, and close/reopen of a file-backed Room database. They are not FakeGateway-only tests.

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
- Staff authentication can consume the canonical `MFK_STAFF_AUTH_V1` verifier projection, but the native session issuance/revocation contract and maximum 12-hour expiry must be implemented and tested without exposing PINs to persistence or logs.
- The canonical source of `studentDiscountEligible` is not present in the published Admin contract. This is a money-policy/data decision; checkout must fail closed for Student Discount until the Owner selects a canonical eligibility field or publication rule.
- No physical printer/device or live financial acceptance was run. Physical acceptance remains a separate gate.

## Next engineering action

Implement the next bounded native slice in the order defined by `docs/plan/MFP_V3_POS_SOURCE_BINDINGS_AND_OTA_ROADMAP_2026-10-03.md`: canonical Admin active-config producer and Store Kernel projection first, then device/staff session and time-bound commit validation, then quote/tender/Business Day and one `CHECKOUT_PAYMENT_CONFIRM` handler.
