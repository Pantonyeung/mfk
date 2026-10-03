# MFP V3 unified source integration | 2026-10-03

Status: CURRENT / CONTROLLING FOR THIS CANDIDATE ONLY
Branch: `work/MFP-V3-UNIFIED-INTEGRATION-2026-10-03`
Mode: PREPARE; LOCAL SOURCE INTEGRATION ONLY

The Owner directed safe integration of the exact Admin, MFP and Customer rebuild sources, preserving product IDs, prices, options, defaults, combos and print settings. This candidate-local instruction supersedes inherited single-surface and diagnostic-only scopes for source reconciliation. It does not carry forward a donor branch's publication authority.

## Exact sources

- Admin V3 / Owner: PR #605, `5954f301c684e795453d622790ca11acae8dfe79`.
- Customer V3 completed shell: PR #619, `b7591340a4d6617c25e4041d88b37d57e6c8792b`.
- Cloud MFP frontend and Mobile: PR #653, `029d4e190f791f8cf42c0a0cad181536723ed5bc`; tree equivalent to local `1ac9a184`.
- Native MFP POS Kernel: `feat/MFP-V3-A9R-POS-KERNEL-R1-2026-10-03`, `f6138d1b148cf872f238a634ce339e088bff95c3`.
- Historical common source ancestor: `3c6c00d032eec121f1b6f1a9c059a3215c572ef0`. The completed first integration checkpoint is `f680166aa5ddf64ac1d44492a296c3c2e056597f`.
- Current declared aggregate comparison base: `2e32fb87b2c84801b11a5ea6b2102a00f2a3104c`, locally merged with its actual ancestry after a fresh remote readback. The manifest declares every candidate path relative to this main base; it remains an aggregate Admin/Customer/MFP/native candidate.
- Reviewed selected business configuration extract: `4f0775f6cae02136fa44cbb23794932f76fc6fad`, retained as an exact ancestor. No PR exists; any later PR must re-read its then-live main base and update evidence without weakening the classifier.

## Locked authority

Admin V3 includes Owner and remains the canonical configuration/policy publisher through its existing canonical envelope, draft and publication seam. It must not introduce another database. MFP includes Pad and Mobile (the former SMT/SMM surfaces) over one host Store Kernel. Transaction, pricing and print business authority remains on the host; phones are auxiliary surfaces. An authorized phone action must use the same host execution path without adding a second human confirmation.

V2 directories are retained historical/data-extraction and test references, not approved runtime providers. A shared `v1` contract name alone does not make it V2 runtime authority. Customer's existing shell is retained; its preview inputs remain explicitly preview-only until authenticated providers are established.

## Bounded capability

Integrate the four sources; reconcile shared contracts and overlapping checkout guards; preserve option defaults; add pure no-write migration classification; expose an explicit Admin tender policy draft; add pure Admin-owned versioned template/profile and immutable slip projections; repair print correlation and the existing native durable-evidence DTO. Candidate-owned exact paths are declared in `.github/mfk-change-manifest.json`.

Admin owns logical printer/destination naming, product-to-destination routing, output eligibility, content and template policy. MFP only maps those logical destinations to onsite device/IP endpoints. Existing jobs retain their immutable template version and payload digest after later Admin profile changes.

Initial intended tender choices are Cash, Alipay, WeChat, FPS and PayMe, editable through Admin. No silent canonical seeding, invented discount, price, option default or combo policy is permitted.

## Gates and non-goals

Read `HANDOFF_CURRENT.md`, `docs/control/MFK_CHANGE_CONTROL.md`, the A9R authority and the unified integration handoff before edits. Preserve hard gates; passing source tests does not grant runtime, financial or physical acceptance.

No push, PR, main overwrite, force-push, remote merge, deploy, live publication, account/credential migration, CORS or persistent-access changes, transactions, physical printing, OTA or legacy decommission is authorized by this local pass. Parent review owns publication decisions.

The native producer now has a bounded WALK_IN PRODUCT/options and explicit COMBO-selection source slice over the published Admin fields. Nested combo-component options, per-option quantities, operational availability and Student intent remain explicit gaps; see `docs/handoff/MFP_V3_CANONICAL_QUOTE_SELECTIONS_2026-10-03.md`. Security enrollment/session writers, actual V3 publisher/readback, catalog adapter and Customer providers remain release gates; fixture tests do not supply those providers.

## Bounded selected business configuration extract addendum

The Owner-authorized source-only preservation work additionally permits a minimal Prepare → Download control on the existing Admin Versions Readback page. The isolated implementation branch is `work/MFP-V3-BUSINESS-CONFIG-EXTRACT-2026-10-03`, based exactly on reviewed integration commit `f680166aa5ddf64ac1d44492a296c3c2e056597f`. Only the existing authenticated canonical read seam supplies data. This adds no route, endpoint, authority, mutation or publication permission. Source tests use synthetic inputs; actual export/download/readback and any rollout remain separate parent-owned gates. See the extract handoff for exact sections and exclusions.

## Approved local reconciliation addendum

The Owner additionally approved source-only incorporation of the reviewed extract and an ancestry-preserving local merge of verified main `2e32fb87`. Main contributes 13 commits adding ten historical design/PRD/naming documents; no product, config or API path collision exists. Keep these documents byte-identical. Their Step 3/prototype-only qualification records that design workstream's acceptance boundary. It does not replace the later, explicit current V3 source-integration scope, certify runtime acceptance or authorize deployment. Preserve the approved Desktop POS baseline, cart safeguards, single authority and separate physical acceptance gates.

The existing authenticated canonical GET may place the full envelope, including staff/auth fields, in browser memory before client-side business allowlisting. This known existing read-seam limitation is explicitly accepted for the source-only extract. The downloaded artifact excludes those fields; eliminating receipt requires a separate server-projection contract. No real extract has been downloaded or verified in this task. Parent-reported live Admin/Worker identities remain external deployment evidence, not a source test result. The earlier f807 export checkpoint kept quote selection separate; the current approved increment integrates reviewed native quote source `ed340d7be1fe8a1d91dc4da580db81eec95794d8` without widening its tested intent contract.

## Physical acceptance scheduling qualification

Owner deferred onsite device/paper acceptance to 2026-10-04, with an 08:00–10:00 Asia/Hong_Kong arrival window. Physical acceptance is PENDING / DEFERRED_BY_OWNER_AVAILABILITY, not PASS or synthetic ACK. It does not globally block separately authorized software verification or UI deployment preparation. Software PrintJob identity, Admin routing, recovery and durable-state proofs keep their own gates; actual deployment remains a separate explicit decision. No reminder or automatic physical action is scheduled by this source update.

## Bounded quote and preservation correction increment

The Owner approved integration of the reviewed native quote source and a separately reviewed selected-extract compatibility correction. Preserve the same host quote authority, Admin/tender readset, deadline and atomic confirmation path. The extract correction must distinguish optional section absence from present-empty data; it must not invent defaults or weaken malformed-present, identity or privacy checks.

The Owner additionally clarified flexible riceball/snack/drink single-item and combo selection, explicit defaults versus recommendations, Admin logical print routing, and one default receipt per formal order. These are retained requirements, not evidence that this bounded source increment implements additional UX, policy or intent shapes. Nested combo-component options, option quantities and actual operational sellability still need their own contract/provider work and tests. No receipt-routing behavior is changed by this increment.

Reviewed optional-section extract correction `3b0aa5c80b109e253b5d552cbbc507768a7cc0c1` is now included: canonical catalog is required, while absent optional option/print sections are explicitly inventoried and remain absent. Present-empty is distinct from absent; malformed-present, identity and sensitive-data guards remain. This source does not establish that the complete Admin product/settings journey is wired: the formal product editor persists basic fields, while richer options/media/printing use separate or preview surfaces and require their own end-to-end evidence.

The source-confirmed cross-page option-price split-copy defect recorded at 8d14 is corrected by reviewed source `43676097ad6215fd55d94a60e71459d2c1f4d57c`, now integrated. The existing optionCenter remains authoritative when present, price mutations synchronize both existing copies atomically, and already-open editor/price rows retain stale-write guards. This closes the bounded source bug; it does not prove the complete live settings/price/publish/quote journey.

## Bounded modifier-price source correction

The Owner-authorized software/settings correctness scope permits the reviewed correction based on exact `67bc447b826c468209dd9d1e5d943d2348622558`. It preserves raw IDs/defaults/extension fields and optimistic revisions within the existing draft mutation. New or changed option amounts must satisfy the existing native exact-decimal contract. Unchanged historical values such as `1.000` remain preserved and visibly warned; current publication preflight still does not categorically block them, while the native parser rejects them. No automatic rounding, repair, default or live activation is authorized. See `docs/handoff/MFP_ADMIN_MODIFIER_PRICE_SYNC_2026-10-03.md`. WALK_IN-only native quote support and unexecuted Room/Android gates remain unchanged.


## Reviewed Admin report B1 local integration

Reviewed source `0495705cea1ef54e59c6202ed14ac5315771f325`, exact source parent `89e21fa3cbfff5dbbb02a81a889fb4d0dd05b3bd`, is incorporated as a bounded Admin option-readiness increment. Independent source review approved B1 only; the reviewed product files and dedicated handoff are retained exactly. Aggregate scope, main comparison base and all earlier source references/allowed paths remain preserved by manifest union.

The prior historical statement that native-incompatible option values may pass this client's publication preflight is superseded for this bounded option scope: raw malformed/link/default/mirror/native-limit/price-status/cardinality checks now block before the existing publish POST. Historical values and unknown extensions remain preserved; unknown extension behavior is not certified. The writer fails closed before silent normalization loss. Generated product identity, existing CAS, Admin canonical authority and host pricing/transaction authority are unchanged.

This is not full Packet B or Packet C. Server validation/provider identity, actual draft/canonical reread, host apply/ACK, Android/Room, runtime availability and physical acceptance remain independent gates. No push, PR, deploy, live writes, transactions or physical actions are authorized by this local integration. See `docs/handoff/MFP_ADMIN_OPTION_READINESS_B1_2026-10-03.md` and the external exact-commit integration evidence.


## Reviewed Admin report Packet C local integration

Independently approved source `9f907eebb5ca6de1a2b54859765515b647dddeb6`, exact source parent `48db835ed71385ce0bf781f8387e74b6c1c7c26b`, is incorporated only as the bounded product bindings/defaults source capability. All nine reviewed product source/test files and the dedicated handoff are retained exactly. Existing product edits now save intentionally changed basic fields, reusable group bindings and explicit defaults in one canonical draft mutation, with B1 raw preservation/readiness, stable IDs and existing CAS. Imported quantity semantics remain disabled for authoring and preserved.

Parent-approved narrow additions are the existing shell's product-edit navigation guard and same-draft revision/store/base/session-aware response-order protection. The shell remains the route owner; foreign history is not overwritten. Unknown/pre-session traversal retains the mounted editor with explicit notice. Actual browser/history/visual acceptance is BLOCKED / NOT RUN after local-URL policy rejection; synthetic event tests are not browser proof. New products retain the basic-create-then-explicit-reopen option workflow, not a complete one-step product/options contract.

This supersedes only the earlier statement that Packet C has no source implementation. It does not complete full Packet B or end-to-end Packet C, identify an approved live server publisher, establish canonical reread/host ACK, execute Android/Room, or close runtime/physical acceptance. Aggregate main comparison base, earlier references/paths, authority impacts and HARD_BLOCK remain. No push, PR, deploy, live write/publication, transaction, account/device action or physical printing is authorized. See `docs/handoff/MFP_ADMIN_PRODUCT_OPTIONS_C_2026-10-03.md`.


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
