# MFP V3 POS Source Bindings and OTA Roadmap — 2026-10-03

Status: ACTIVE ENGINEERING PLAN

Authority remains `STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`. Admin remains the sole canonical configuration publisher. This roadmap does not authorize deployment, OTA activation, Builder request changes, live charges, merge, or SMM decommission.

## Invariants

- One Room Store Kernel database and transaction coordinator.
- React submits intent only; it cannot name aggregates, inject canonical records, or finalize money.
- No hardcoded menu, price, discount eligibility, tender availability, Business Day, staff, or runtime assets.
- Configuration and runtime assets can update independently of native Carrier capability, subject to explicit compatibility gates.
- Runtime OTA cannot modify or roll back Store Kernel business transaction rows.
- Missing, stale, expired, unproven, or externally unavailable production inputs fail closed.
- Same submission and fingerprint produce one durable effect; fingerprint conflicts produce none.

## Stage 0 — Atomic native read set — complete

Commit `8c52b155fb75edd39e4018853ca3c4144682e179` adds native-only aggregate revision dependencies checked in the same Room transaction before writes, while preserving receipt-first replay. Commit `46a7b066d92337539ac8e510835328620a951c52` adds receipt readback after commit exceptions and safely classifies only proven pre-write revision conflicts. Commit `9c76650f79fba42d38037c84042e1a8ce7034b18` adds a transaction-time commit deadline without weakening receipt replay.

## Stage 1 — Canonical Admin configuration producer

Source of truth: the existing `AdminSyncStore` active `MFK_ADMIN_CONFIG_SYNC_V1` envelope served by `/api/admin-sync/active`, including `storeId`, positive source revision, `publishedAt`, `adminFingerprint`, snapshot, and envelope fingerprint.

Required native behavior:

1. Fetch over HTTPS from a configured native endpoint; no credentials or secrets in browser storage/logs.
2. Validate schema, store identity, timestamps, source revision, canonical envelope fingerprint, required catalog, and bounded payload size.
3. Reject source revision rollback, same-revision/different-fingerprint conflict, and store mismatch.
4. Project the accepted envelope to one Store Kernel aggregate `ADMIN_ACTIVE_CONFIGURATION / <storeId>` through the existing coordinator. Internal aggregate revision is monotonic per accepted publication; the Admin source revision remains an explicit state field and may not be substituted for the internal CAS revision.
5. Preserve last-known-good state on network, parse, validation, or apply failure; expose exact source freshness and error without claiming convergence.
6. Bind the existing v3 sync transport or provide a compatibility adapter from this same canonical envelope. Do not create a parallel polling authority.

Implemented source slices: `521158dda13711c6ac3d7d4fb62e2181bb2d63ce` validates and projects the canonical envelope into the Store Kernel; `d87ad51` performs one explicit HTTPS-only `/api/admin-sync/active` read with redirects disabled, bounded time/body, 404 LKG preservation, and no automatic retry or polling. Runtime startup/doorbell wiring remains intentionally unbound until the device/session authority is integrated. Commit `a2a3194732ee10b136eb488dad408d0442e6546a` adds a native read-only adapter from the accepted Room envelope to immutable checkout source facts while leaving POS tender and Student eligibility explicitly unbound. Current scoped native regression: 62/62, including 24 real Room tests and HTTP-response-to-LKG integration.

Acceptance: publish/sync convergence, idempotent same fingerprint, rollback/conflict rejection, offline LKG, restart recovery, and Store Kernel readback.

## Stage 2 — Device and staff session producers

Native aggregate contracts:

- `DEVICE_AUTHORIZATION / <deviceId>`: store, device, status, enrollment provenance, issued/revoked timestamps, and revision. Config ACK membership is not accepted as this record.
- `STAFF_SESSION / <sessionRef>`: store, device, staff identity, role/scope, issued time, last validation time, expiry, status, and the Admin config fingerprint/revision used for authentication.

Rules:

- Consume active staff rows and PBKDF2-SHA256 verifiers from canonical `MFK_STAFF_AUTH_V1` projection.
- Never persist or log raw PIN. Never return verifier material to browser callers.
- Active frontline `STAFF`, `MANAGER`, or `OWNER` may operate; no Manager gate is introduced. `VIEWER`, inactive, wrong store/device, revoked, or expired sessions reject.
- Maximum session duration is 12 hours.
- Add a trusted-native transaction deadline/time precondition so expiry is checked inside the commit transaction; aggregate revision guards alone are insufficient for time-only expiry.

The actual device enrollment ceremony is security-sensitive and requires explicit approved provenance/credentials. Engineering can implement the fail-closed record/validator without inventing enrollment authority.

Commit `a2a3194732ee10b136eb488dad408d0442e6546a` freezes the first fail-closed staff-session value contract. It enforces the 12-hour exclusive expiry boundary, exact store/device/staff/session and parent-Owner authorization identity/revision, active device/staff observations, operational roles/scopes, and published PBKDF2-SHA256 verifier metadata without persisting a PIN. `VIEWER` and `REPORT_ONLY` cannot operate. This is not a PIN verifier, device-enrollment authority, Owner-login producer, or session issuer.

The Owner requirement is that a successful Owner account/password authorization is the parent prerequisite for staff account/PIN login, and Owner logout revokes descendant staff access. The safe record model binds every staff session to an opaque parent Owner authorization reference and revision, so missing, unknown, revoked, or changed parent authority rejects. The remaining policy decision is the scope of that parent authorization and logout effect: device-local, store-wide, or cross-device. No scope is inferred by the record model.

## Stage 3 — Formal quote, discount, tender, and Business Day producers

Formal quote must re-resolve every submitted line against the active canonical published catalog and option/combo facts. Client preview totals and published fact copies are hints only.

Required money behavior:

- parse decimal Admin prices to integer HKD minor units with exact decimal rules; reject rounding ambiguity, overflow, negatives, missing price facts, unsellable or incomplete selections;
- calculate unit and line totals with checked integer arithmetic;
- Student Discount is 50% of the highest eligible single unit; stable cart-line order breaks equal-price ties;
- tender is eligible only when present and enabled in the explicitly bound canonical POS tender publication at confirmation; `storeSettings.customerPaymentChannels` alone is Customer electronic-channel configuration and cannot be promoted to all-POS eligibility or settlement proof;
- cash received/change are integer minor units; received must cover formal total; non-cash cannot inject cash change;
- the active Business Day is a canonical transaction classification derived from the accepted cutoff/timezone publication. No OPEN-only trading gate is added unless the controlling Owner contract explicitly requires one.

Canonical eligibility for Student Discount is still absent from the Admin publication contract. Until the Owner selects the field/publication rule, any Student Discount request fails closed with a stable rejection; non-student checkout work can continue.

Commit `a2a3194732ee10b136eb488dad408d0442e6546a` also freezes exact decimal-to-minor-unit conversion and path-indexed Admin catalog/option/combo money facts. It preserves catalog, option, promotion, and Customer channel data as source evidence, but never promotes Customer payment channels or promotion IDs into POS tender or Student policy. Malformed, rounded, overflowed, wrong-store, wrong-schema, or non-string money inputs fail closed.

## Stage 4 — One `CHECKOUT_PAYMENT_CONFIRM` handler

Fresh reads before commit:

- prior receipt;
- `DEVICE_AUTHORIZATION`;
- `STAFF_SESSION` plus transaction-time expiry;
- `ADMIN_ACTIVE_CONFIGURATION`;
- formal quote/pricing facts;
- enabled tender facts;
- active `BUSINESS_DAY`.

All revisioned facts are attached as `AggregateReadDependency` values. The handler derives all records internally and makes one existing-coordinator commit.

Initial exact transaction mapping:

| Record | Identity | Required contents |
|---|---|---|
| `ORDER` aggregate | deterministic per store + submission | business source such as `WALK_IN`, source platform `POS`, allocated display number, business day, staff/device, normalized lines and selections, source fact IDs/revisions, subtotal, discount, total due, tender, lifecycle, created/confirmed timestamps |
| `PAYMENT` aggregate | deterministic per store + submission | linked Order, tender, formal amount, cash received/change when applicable, status `CONFIRMED`, confirmation timestamp, no provider credential |
| command receipt | formal submission identity | canonical `COMMITTED` result, commit sequence/revision, deterministic Order reference |
| outbox | deterministic event IDs | Order committed and payment confirmed projections; print dispatch may only be requested after this commit and remains separately idempotent |

No Order/payment/outbox row is written before Payment Confirm. Duplicate submission replay cannot emit a second outbox event.

Commit `3e53a26` implements the bounded non-Student cash assembler and closed commit mapping behind trusted native ports. It validates the canonical normalized intent and client review against fresh security, quote, tender, and Business Day snapshots; attaches exactly seven native read dependencies and the earliest freshness deadline; and commits the Business-Day display sequence, canonical Order, linked Payment, durable receipt, and two deterministic outbox events in the existing coordinator transaction. The canonical Order shape matches the retained Orders read contract.

Real Room tests prove full rollback after an injected post-receipt failure, stale dependency rejection, transaction deadline rejection, one-winner display-sequence contention, lost-reply receipt recovery through the real Router gateway, duplicate replay, and file-backed database reopen without a second effect. These tests inject trusted source ports. They do not prove device enrollment, PIN verification, production POS tender/Student eligibility, physical printing, or public bridge activation.

Commit `3c0cd77` closes the same-worker outbox reclaim race without a schema migration: claim already atomically increments and returns `attemptCount`; ACK and release now require that positive token and include it in the Room compare-and-set predicate. A stale callback from attempt 1 cannot acknowledge or release attempt 2. Every dispatcher must echo the claimed token; omission fails closed.

The production bridge remains fail-closed until real MFK producers supply the exact security, pricing, tender, Business Day, and display-allocation snapshots. Non-Student cash behavior is implemented; Student requests continue to fail closed because the canonical eligibility and remaining money-policy decisions are unresolved.

Known rejection paths must be durable and distinguishable from uncertainty. After any coordinator/transport exception, read back the receipt before returning `UNKNOWN`; stable Store Kernel conflicts map to durable known rejection only when no receipt exists and the failure is classified safe.

## Stage 5 — POS runtime completion and recovery

After native checkout is verified, bind the runtime without moving authority into React:

- rejected checkout exits `SUBMITTING` and shows durable rejection;
- committed checkout offers Next Order/reset without losing canonical receipt access;
- `UNKNOWN` always performs readback-first recovery and is not cached as an irreversible terminal result;
- provider `ATTENTION` acknowledgements are rendered and actionable;
- opening/review remains zero formal commit;
- UI candidate artifacts are reconciled only after source import and browser/mobile/visual acceptance.

## Stage 6 — Operations, Customer, and Keeta

Progress one command family at a time through the existing formal router: order fulfillment/modification/correction/refund/cancel, dining/capacity/availability, Customer admission/decision, then Keeta lifecycle/admission. Each requires an explicit producer/read contract, existing-authority mapping, idempotency, receipt, outbox, recovery, and real-source tests before enabling its handler.

## Stage 7 — Carrier baseline and OTA compatibility

- Replace the V2 packaged baseline/fallback only through a verified V3 Carrier migration with recovery preserved.
- Runtime `.mfos` assets carry UI/JS/CSS/static content and require manifest signature/hash plus `minCarrierVersionCode`/bridge compatibility.
- Native authority/capability changes require a signed Carrier APK and package/version/signer validation.
- Recovery retains editable persisted Runtime and Carrier update endpoints with active/previous/default behavior.
- Acceptance includes edit, validate, save, restart retention, actual updater read, previous/default restore, and unsafe transport rejection.
- Builder source verification must pin the exact promoted source SHA before any Candidate publication. Current older pins are not evidence of A9R packaging.

## Release gates

1. Source and unit/integration evidence.
2. File-backed Room restart/replay and failure recovery.
3. Built V3 runtime bundle and Carrier packaging test without V2 fallback regression.
4. Device/security/config-sync test using non-production credentials and no live charge.
5. Physical printer/device acceptance as a separate gate.
6. Explicit Owner release authorization before push-triggered publication, deploy, OTA, cutover, or merge.
