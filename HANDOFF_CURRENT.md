# Unified V3 source candidate handoff | 2026-10-03

Current branch: `work/MFP-V3-UNIFIED-INTEGRATION-2026-10-03`.
Read `COMMANDER_CURRENT.md` for exact sources and authority. Detailed collision resolution, verification and remaining provider gates are recorded in `docs/handoff/MFP_V3_UNIFIED_SOURCE_INTEGRATION_2026-10-03.md`.

This candidate combines exact Admin #605, Customer #619, cloud MFP #653 and latest native `f6138d1b`. It must never be relabelled as old `48c7eca6` native or as a single mobile-only delta.

Admin includes Owner. MFP host owns formal transaction/pricing/print execution; Mobile is auxiliary. V2 is historical/data extraction reference only. No second database, authority, pricing engine in React or fake transaction success.

Current result is a source-integration candidate, not an approved live system. Build, frontend, source-contract and fixture tests are distinct from native Android execution, live canonical readback and physical acceptance. Native runtime test execution in this cloud environment is unavailable until a real Gradle/Android toolchain is supplied or authorized CI runs. The existing CI selector is expanded to cover the merged native Store Kernel, gateway and runtime unit suites without invoking deployment.

Do not deploy, publish canonical data, enroll accounts/devices, run money actions or print physically. Preserve all source IDs/prices/options/defaults/combos/print settings. Missing canonical inputs remain blocked rather than defaulted. Parent review must approve any next publication step.

Important promotion dependency: inherited `.github/workflows/deploy-mfk-admin.yml` can deploy on main changes to `contracts/**` or `v2admin/**`. Branch push/Draft PR does not trigger that main path; an eventual main merge may. Do not treat merging this aggregate as a source-only action or bypass backup/readback/deployment approval.

Separate hosting-app side effects are also unverified: Cloudflare app checks ran on the earlier PR #653 branch push. Any future branch push/PR may trigger external hosting work even when the MFP source-CI workflow itself has no deploy step. Review actual hosting routes before publication; do not infer safety from GitHub Actions branch filters alone.

Selected business configuration extract source addendum: `docs/handoff/MFP_ADMIN_BUSINESS_CONFIG_EXTRACT_2026-10-03.md`. The explicit Prepare → Download control is limited to verified canonical catalog/options/printing data. No real extract has been produced or verified by this source implementation, and it cannot satisfy the pre-rollout preservation gate by itself.

Local reconciliation now retains both the exact export commit `4f0775f6` and verified main `2e32fb87` as ancestors. All ten newer main design/PRD/naming documents are preserved unchanged. The aggregate manifest uses main as its effective comparison base; the earlier `f680166a` packet remains a historical checkpoint. No remote source publication, deployment or actual selected-data backup is implied. The next source checkpoint is ready for parent review only after its fresh combined checks and exact identity capture.

## Physical acceptance scheduling qualification

Owner deferred onsite device/paper acceptance to 2026-10-04, with an 08:00–10:00 Asia/Hong_Kong arrival window. Physical acceptance is PENDING / DEFERRED_BY_OWNER_AVAILABILITY, not PASS or synthetic ACK. It does not globally block separately authorized software verification or UI deployment preparation. Software PrintJob identity, Admin routing, recovery and durable-state proofs keep their own gates; actual deployment remains a separate explicit decision. No reminder or automatic physical action is scheduled by this source update.

The native canonical quote-selection source slice is recorded in `docs/handoff/MFP_V3_CANONICAL_QUOTE_SELECTIONS_2026-10-03.md`. Reviewed source `ed340d7b` preserves the same host quote authority/readset/deadline, adds pure canonical option/combo vectors and prepares unexecuted Room cases. No actual R27 data or Android execution is supplied. Nested combo-component options, option quantities, operational sellability and Student intent remain explicit gaps. The user's flexible selection and one-default-receipt requirements do not authorize silently inventing new intent fields or pricing/print policy here.

The reviewed optional-section correction `3b0aa5c8` aligns the extract with the deployed envelope contract: catalog required, optional absent sections visibly inventoried, no synthesized empty/default data. It remains a selected capture, not proof of a complete settings workflow or real saved backup. Richer formal Admin product/options/media/print journeys require separate connection evidence.

Modifier-price source correction `43676097` is now integrated; see `docs/handoff/MFP_ADMIN_MODIFIER_PRICE_SYNC_2026-10-03.md`. Pricing reads use existing optionCenter, requested edits synchronize both raw copies, metadata/defaults survive later edits, and stale open forms/dirty pricing rows fail closed. The optional-export correction remains included. Preserved historical numeric strings such as `1.000` may still pass the current publication seam despite native rejection; the visible warning does not replace a cross-layer readiness gate. No live price, draft, publication or transaction was changed.


Admin report B1 source prerequisite `0495705cea1ef54e59c6202ed14ac5315771f325` is locally integrated over exact `89e21fa3cbfff5dbbb02a81a889fb4d0dd05b3bd`. Product code and source handoff match the independently approved packet; aggregate governance was reconciled by union. Client option publication now rejects the historical native-incompatible amount gap described above, plus malformed/default/reference/mirror/native-limit/cardinality failures, without repairing data or changing authority/CAS. This supersedes that bounded source-gap statement only. Full authoritative server enforcement and Packet C remain unimplemented. Final exact SHA, combined source regressions and unchanged aggregate HARD_BLOCK risks are recorded in the external integration evidence; no live/Android/physical acceptance or publication permission is implied.


Admin report Packet C source `9f907eebb5ca6de1a2b54859765515b647dddeb6` is locally integrated over exact `48db835ed71385ce0bf781f8387e74b6c1c7c26b`. Reviewed product blobs and dedicated handoff match the approved source; aggregate governance is preserved by union and append. Existing product-local reusable group/default editing now exists with one atomic draft mutation, preservation/CAS, unsupported quantity limits, interrupted-save/navigation protection and same-draft response-order guards. The earlier Packet C-unimplemented statement is superseded at source level only. New products still need basic Save then explicit reopen for options. Browser UI/history acceptance remains BLOCKED / NOT RUN; live service/canonical/host, Android/Room and physical gates remain pending. Exact integrated SHA, combined checks and aggregate HARD_BLOCK risk delta are external integration evidence; no publication or deployment permission is implied.


## Owner-directed V3 acceptance release preparation

Owner explicitly directed expedited Admin/POS/Customer V3 deployment, permitted replacement of unaccepted V2 UI, and retained V2 source as reference on 2026-10-03. This bounded source addendum supersedes the earlier no-runtime-provider-adoption restriction only for the explicitly adopted Admin service: five server modules are copied to V3 ownership; existing service name mfk-admin, ADMIN_SYNC/AdminSyncStore and all other DO/R2/migration identities remain unchanged. No second database, empty seed, data migration or credential change. V2 files remain unchanged reference.

A separately documented security delta fails closed on unresolved public Customer routes before storage access; existing authenticated Admin and device/staff paths retain checks. This is not approval of the old Customer public provider. Canonical V3 assets cannot switch to demo via URL. Fixed business polling is removed; existing initial/mount/focus/reconnect/doorbell/manual read mechanisms remain.

Source preparation is not deployment. Parent must verify Cloudflare target/current version and retained bindings, preservation/rollback evidence, exact reviewed source/build, and business-read acceptance before activation/mutation. Full aggregate HARD_BLOCK remains visible; unrelated MFP/Customer runtime completeness is not represented as an Admin UI-only acceptance requirement. No workflow, classifier, Builder or OTA change occurs here. See docs/handoff/MFP_ADMIN_V3_ACCEPTANCE_RELEASE_2026-10-03.md.


### Preservation-first activation amendment

The initial code-only V3 deployment uses server `MFP_V3_CONFIG_WRITES_ENABLED=0` and build `VITE_MFK_V3_CONFIG_WRITES_ENABLED=0`; missing/malformed values also lock. The UI mounts only existing normal app authentication and selected-business Prepare/Download, not editors or draft/publish providers. Server blocks mutating canonical `/publish`, every non-auth `/admin-browser/` route (including draft/product create/update/delete/publish and version rollback), and payment-QR upload. Matching outer aliases and direct inner DO calls are covered; `GET`/`HEAD`/`OPTIONS` and existing auth/session paths retain behavior. Existing unrelated transaction/operational endpoints are not claimed globally read-only.

Phase 1 is code-only and reversible with preserved storage, not a backup. After the actual selected-business download and identity/checksum/count inspection, parent may deploy the same independently reviewed source in phase 2 with both flags exactly `1`. That re-enables existing authorization-gated configuration paths; it creates no general permission for arbitrary business writes. Server health and asset release manifest report configuration-write mode separately. Query parameters cannot unlock either mode.


### Parent privacy review correction (10:40 UTC)

Public generic `/api/admin-sync/` and `/api/projection/` are now blocked before DO/R2 access in every configuration-write mode, including aliases to full active-envelope reads and projection/native writes. Existing authenticated `/api/admin-browser/` login, canonical read and selected-business extract remain. Setting the config-write flag to1 does not reopen these providers. This supersedes any earlier statement in this packet that the generic transport/doorbell remains active; future restoration requires separately reviewed authenticated admission.

The full-mode read-model provider no longer constructs a WebSocket or reconnect timer for the deliberately blocked event endpoint. Its channel status is UNBOUND; the freshness text explicitly discloses this. Fixed business polling remains absent. Initial/focus/reconnect/manual canonical reads retain their original authenticated path. No missed-event convergence or operational/native provider acceptance is claimed. The source defect is not a finding of an observed live breach; no unfiltered live envelope or credential was inspected.


## Reviewed V3 acceptance release branch

Current release branch is `release/MFP-V3-ACCEPTANCE-2026-10-03`, based exactly on `34ce775f72712208676f9ce4f0653e0921338d89`. This branch-specific statement supersedes the prior integration-branch label for this release only. Parent independently approved Admin preservation patch `f0fd0e7e9e221c0a58224044753fa682a08cbaeea4bf75a3349949d407aa6ce1` and Customer truthful-acceptance patch `70d704866baaef680a14b069201c83cb9d894ce0aa51c8b0d011943b2bb8bed7` before integration. Product blobs are unchanged from those reviews. MFP source is unchanged from the base. No unreviewed D1 files are present.

Customer fixtures remain explicitly demo-only. Submission, proof and payment-success paths are unavailable; runtime identity is built from this exact source. Preserve its existing R2 media worker/routes/binding and do not overwrite shared artwork. Admin starts in preservation-only UI/server mode; actual selected-business backup is still pending. V2 source stays unchanged reference.

Owner-approved deployment preparation is recorded without claiming aggregate HARD_BLOCK cleared. The release workflow and target/binding/version preflight require separate parent review before remote publication or dispatch. Main is not merged. This source integration does not perform business writes, credential changes, Carrier/OTA, transactions or physical printing.


## Reviewed manual release workflow

Parent approved the four-file manual workflow packet and its single-line concurrency correction, patch SHA-256 `891008e86b6225a1428eda5080f2ba6a23b259245a800ee88a8d130302e10077`. It reuses the registered `deploy-mfk-admin.yml` path on this exact release branch, defaults to read-only preflight, verifies trusted repository/branch/current remote SHA, and uses only existing Cloudflare secrets for fixed existing targets. No broad push trigger, R2 object upload, main merge or Builder/OTA change. The existing `mfk-admin-production` concurrency group is retained with cancellation disabled.

Immediate authority is non-force publication of this release branch followed by manual `operation=preflight,target=all` for its final exact commit. Actual deployment waits for parent inspection of current target/domain/version/namespaces and rollback metadata. Full aggregate HARD_BLOCK remains a reported review input, not silently reclassified. Phase-one Admin remains preservation-only; Customer providers remain unavailable.


## Current handoff: MFP-V3-LIVE-WIRING-R1

The latest Commander addendum controls this bounded PUBLIC_LINKED_TEST_ACCEPTANCE source continuation. Start from verified `ae7b1207e1e3cf050e4f387d4ed0b81cb8cfe1e3` on `work/MFP-V3-LIVE-WIRING-2026-10-03`, retaining shared feature `595a907914e72b7c646c68686cf294bc42e3131e`. Do not redo its contracts. Freshly recheck branch status before any later publication; do not reset or overwrite unexpected changes.

Customer and formal POS are separate writers/worktrees. Customer owns `v3customer/**` and `.github/workflows/v3-linked-customer-check.yml`; POS owns `v3smt/**` and `.github/workflows/v3-linked-pos-check.yml`. Shared manifest/Commander/Handoff have one integrator. An independent reviewer is read-only and reviews exact commits; writers fix findings. Integrate only reviewed candidates and run combined checks afterward. Deliver the first usable surface promptly while the other continues.

Use the existing named linked-test instances only; MF01 is read-only business configuration source. Preserve the isolated scope, all source privacy guards and normal flag-off behavior. Customer retry identity survives refresh/uncertain response; POS only marks SEEN/REJECTED. Every formal order/payment/checkout/physical-print capability remains false. No forwarding into native/formal orders, money, display/KDS, printer or cash-drawer paths. Do not infer production authority from these public test requests.

Parent owns preflight and separately authorized publication/deployment. Correct formal POS service is `mfk-smt-web`, not `mfk-mfp-v3-acceptance`. Old `.github/scripts/v3-release-preflight.mjs` is historical and must not be used for this task's POS deployment. Preserve Customer media/R2 artwork and existing service bindings. No new credentials, migration, main merge, force-push, Carrier/OTA or physical action. Local tests and browser fixture checks are reported separately from actual public E2E and Owner UI acceptance. Exact integrated SHA and verified results are recorded in delivery evidence outside these self-referential source files.


### Read-only preservation proof handoff

The approved proof continuation starts exactly at published `1808bda83d935e1161329c4f07aeeb9187bc51c7` in a fresh isolated worktree. Parent needs actual before/after MF01 canonical identity observations, not proof inferred from the copied catalog. Use the explicit linked Admin “驗收資料” refresh to read minimal original/recorded-bootstrap/current-linked metadata and accurately scoped isolated counts. Missing proof is UNAVAILABLE, bootstrap revision remains null, and fnv1a32 is identified as non-cryptographic. The proof endpoint must perform no bootstrap, session, publish or storage write. Do not infer global/native/physical zero counts. Parent alone captures live browser evidence and publishes/deploys after exact source review; consumer source/config bytes are unchanged by this patch.
