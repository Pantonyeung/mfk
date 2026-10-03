# Dining native transition proposal

Status: **LOCAL REVIEW PATCH; NOT PRODUCTION REGISTERED**.

Base inspected: `Pantonyeung/mfk@48c7eca6c051e72562ea9974bc2c6465b8584a7b`.
Authority remains `STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`. This patch adds one pure Java planner and tests. It changes no router, bridge, native persistence, frontend business authority, authentication, deployment or OTA configuration.

## What is implemented

`DiningTransitionPlanner.plan(commandType, expectedRevision, payload, canonicalRead, nativeContext)` returns an immutable `Plan`, or throws a stable bounded `IllegalArgumentException` code. It never calls a DB, network, clock, print gateway, provider, Order constructor or money engine. It has no COMMITTED/REJECTED/UNKNOWN result mapper and cannot claim a receipt.

Implemented commands:

| Command | Exact payload fields | Envelope expectedRevision | Proposal |
|---|---|---|---|
| DINING_WAITING_CREATE | partySize; optional customerDisplayName, note | dining.revision | New waiting record only; no Order allocation |
| DINING_TABLE_ASSIGN | waitingId, tableId, expectedTableRevision; optional orderId | dining.revision | Remove ordered waiting row, occupy target, update SAME Order dining link |
| DINING_TABLE_TRANSFER | orderId, fromTableId, toTableId, expectedTableRevision | order.revision | Clear source, occupy target, update SAME Order dining link |
| DINING_FORMAL_ADMIT | intent, target | dining/order authority | Explicit `DINING_CANONICAL_ADMISSION_DEPENDENCY_MISSING` |
| DINING_ITEMS_ADD | orderId, items | order.revision | Explicit `DINING_CANONICAL_ADDITION_DEPENDENCY_MISSING` |

There is no declared open/close/clear/release command in the 19-command router registry. This patch does not add one. Attempts are unsupported, including close on an unresolved/partially paid Order. Full/partial payment and eventual release belong to canonical A5 settlement. The planner never infers a close from money values or elapsed time.

The destination must be AVAILABLE, including a submitted transfer whose source equals its target. Earlier donor `assignDiningTable` may return a local no-op on same-table assignment; the A6 high-level transfer contract instead explicitly requires an available destination. This patch neither invents a successful no-op receipt nor changes that declared precondition.

## Trust and value mapping

`canonicalRead` is built by a future **native canonical reader**, never accepted from a browser payload. It contains:

- `storeId`
- `revision`: canonical dining revision, string or safe integral number
- `waiting`: current `MfpDiningWaitingReadModel` values
- `tables`: the exact T01–T08 plus OUTDOOR table read values
- `orders`: trusted canonical Order records with identity, revision, lifecycle/fulfillment, serviceMode and dining metadata

The planner needs no canonical payment/item values and emits no replacement full Order. Tests include items, recognized/outstanding money, tender and adjustments so the test-only integration checks that all remain identical.

`nativeContext` contains storeId and a trusted occurredAt. WAITING_CREATE additionally needs a native-allocated waitingId/displayNumber. These are deliberately absent from the browser command payload. Their durable allocation and stable replay belong to the existing native transaction/receipt flow, not this planner. The caller must freeze or defensively copy a coherent canonical snapshot before invoking the planner.

String revisions remain opaque. `"7"` does not equal numeric `7`. Numeric values normalize to a nonnegative safe integer; fractional/unsafe/nonfinite values fail. Exact BigDecimal fractions cannot round into valid party sizes. Actual persisted aggregate revision conversion is an adapter obligation; no global HeadSeq/commit sequence is treated as an Order revision.

Optional occupied-table displayNumber/partySize may be absent, as the current DTO permits. When absent, output derives them from the canonical Order. When present, inconsistent values fail closed. seatedAt is first actual seating time from native occurredAt, or a prior valid canonical seating time. Transfers preserve it verbatim. A6-26 explicitly retains waitingId alongside tableId on the canonical Order after seating. The planner preserves that lineage; only a live waiting-row reference denotes current queue membership.

## Minimal persistence schema proposal for integrator review

These names are **proposed**, not existing source-defined production aggregate registrations:

- Aggregate type `MFP_DINING_OPERATIONAL_STATE`, id = storeId.
- State schema `mfp.dining.operational-state.v1` with `waiting[]` and `tables[]` matching the current A6 value records. The aggregate's Store Kernel revision supplies dining.revision; do not redundantly use global commit sequence.
- Each table has its existing explicit table revision. Native application of a successful seating/transfer increments only changed table revisions, under the enclosing dining aggregate CAS. If opaque revisions are retained, an approved allocator must supply their next values; the planner never increments opaque revisions.
- Waiting notes are retained as optional native record metadata because the existing command payload declares note, though the public waiting read DTO does not expose it. This retention is a proposal for review, not a silent DTO addition.
- Canonical Orders remain in the integrator's **existing/frozen Order aggregate**, with its existing serializer. This proposal does not assign an alternative ORDER type, create a second Order or rewrite monetary/line fields.
- No separate table database or browser business store.
- **Mandatory membership serialization invariant:** every native operation that changes any live Order.dining assignment, waiting linkage, or lifecycle/fulfillment state that changes whether that link occupies a table must CAS/bump this SAME dining aggregate. This includes admission, assignment, transfer, settlement/release, cancellation, reactivation and external admission, not just the three planner commands. The DINING revision guards negative membership/absence checks against other active Orders. If the integrator cannot guarantee this invariant, the planner must remain unregistered until exact additional read/index guards are supplied. Merely scanning other Orders before commit is not sufficient protection against phantoms.

One store-level dining aggregate is the smallest consistent representation of the already-declared dining.revision and waiting/table snapshot. If an approved native schema already stores individual table aggregates, the adapter must map each logical TABLE dependency to its actual key/revision instead; do not silently mix both schemes.

### Exact empty-wait gap

A6 explicitly permits empty waiting with no Formal Order. The current table DTO requires orderId and seatedAt whenever OCCUPIED; it has no waiting/session identity field for an occupied yet unordered table. Assigning an empty wait therefore returns `DINING_EMPTY_WAIT_SEATING_SCHEMA_UNBOUND`. Resolve this with a reviewed canonical occupancy/session schema and matching DTO, or keep seating deferred until formal order admission. Never fabricate an Order merely to satisfy the occupied-table read validator.

## Plan fields and single-coordinator application

Plan fields are proposals, not committed state:

- `waitingCreate`: immutable new record, or null
- `waitingRemoveId`: ordered waiting identity to remove, or null
- `tableChanges`: full proposed table values **without revision**
- `orderDining`: SAME orderId plus the replacement declared dining metadata only, preserving historical waitingId when present; remove orderId before merging under the canonical Order's dining field
- `readSet`: logical `{kind, id, revision}` assertions
- `diningRevision`: original assertion, never a generated successor

Read dependencies:

| Operation | Logical readSet |
|---|---|
| WAITING_CREATE | DINING(storeId, dining revision) |
| TABLE_ASSIGN | DINING, destination TABLE, existing ORDER |
| TABLE_TRANSFER | DINING, source TABLE, destination TABLE, existing ORDER |

Waiting rows have no independently declared revision. Their read consistency is protected by the enclosing DINING guard; no waiting revision is invented.

Native integration must be one transaction under the existing `StoreKernelTransactionCoordinator`:

1. Existing router validates the formal envelope and receipt identity. Matching stored receipt wins before fresh business validation. Changed fingerprint rejects without a second effect. Production security must authorize the action.
2. Native reader loads a coherent canonical dining/Order/config snapshot and tracks exact aggregate revisions. Native clock/identity allocation supplies context. Decode only declared payload keys into Java scalar maps; `JSONObject.NULL` must be normalized explicitly, never treated as a string.
3. Invoke the planner. Catch a stable planner validation code and record a receipt-only rejection through existing Store Kernel mechanisms. Unexpected adapter/runtime failure is UNKNOWN, never invented success.
4. Convert DINING/TABLE/ORDER logical assertions into the approved aggregate read guards and mutation CAS. In the proposed one-dining-aggregate scheme, table value assertions are checked against the same fresh snapshot and dining CAS protects them; do not invent independent table aggregates just because the plan lists TABLE assertions.
5. Apply waiting/table changes to that snapshot and merge only the dining link into the current canonical Order serializer. Preserve every other Order field, including item/payment/refund/report/production references and Order/display identity. Assign new aggregate/table revisions in the adapter only after the actual schema is frozen.
6. Commit all changed aggregates, journal/receipt and any approved required effects through **one** existing coordinator CommitRequest. A failed source/order/destination/config read guard leaves all unchanged. No separate prepare-time DB writes, no placeholder read mutations, and no direct browser commit.
7. Generate native result only from stored receipt and canonical readback. Router remains blocked until exact result revision mapping, aggregate serialization and required outbox effects are reviewed and tested.

These three nonfinancial transitions must not emit first-order admission, first-production/print, payment, refund or capacity consumption/restoration again. This patch emits **no outbox specification**: approved projection/invalidation effects, if required, still need exact native event identity/payload mapping. An empty plan effect surface does not prove an empty production outbox is sufficient.

### Receipt/readback integration issue to settle

Current frontend derives its readback target from the original operation. WAITING_CREATE and ASSIGN without orderId read `snapshot.dining.revision`; TRANSFER and ASSIGN with known orderId read `order.revision`. The native planner may resolve an omitted ASSIGN orderId from canonical waiting. Either freeze `result.canonicalRevision` to the target the client actually reads, or update the frontend adapter to follow an authoritative receipt.orderRef consistently. Never return a transaction-global revision and compare it against an unrelated aggregate. No receipt schema is invented here.

## Source audit and reuse decision

Inspected current A6 domain/runtime/workspace and command matrix, plus exact-SHA legacy D7/D8/D11/D13/versioning/serialization tests and `v2local/src/runtime/local-runtime.ts`. Source manifest records verified Git blob identities.

Reuse:
- Existing exact command names/payloads, A6 DTO fields and revision assertions.
- Accepted same-order transfer, no duplicate first-print/admission, occupancy guard and first-seated-time semantics.

Do not import/port legacy runtime authority wholesale: assignDiningTable obtains local holds, calls ensureDiningFormalOrder, commits local Dining state, projects Order, reads legacy Admin tables and is tied to hold-key locks and localStorage. Those dependencies cannot become native canonical business truth. This bounded planner adds missing native planning; it does not delete or rewrite the accepted frontend/legacy modules.

The full existing V3 source suite was actually executed. Legacy donor tests were source-reviewed, not executed, and no claim of their runtime acceptance is made. Production reuse must still satisfy native integration gates below.

## Verification

Local actual Java, not pseudocode:

- Initial RED: 0 pass / 32 fail against the missing-implementation stub.
- Additional edge RED: exact numeric fraction and queue/table inconsistency failed before fixes; same-target test was corrected to the source-defined available-destination precondition.
- Optional-field RED: 34 pass / 1 fail before allowing absent table display/party fields per the declared DTO.
- Independent-review RED: five scenario groups exposed duplicate/conflicting live canonical identity claims and historical waitingId schema loss before fixes. Independent reviewer provided separate executable repros.
- Final Java suite: 40 pass / 0 fail. Tests include Stage 6 assignment→transfer, partially paid SAME Order preservation, stale read dependencies, immutable plans, live-link inconsistency rejection, historical waiting-lineage retention, competing threads and stable replay/fingerprint rejection in an explicitly test-only CAS/receipt model.
- Existing unchanged V3 base: 31 files / 594 tests passed; typecheck passed; build passed. Known warnings: npm http-proxy environment option and existing >500 kB chunk warning.

Command: `bash run-tests.sh` from the review bundle. It compiles with JDK 21 `-source 11 -target 11 -Xlint:all,-options -Werror` and executes the real Java classes. This checks Java 11 syntax/bytecode, not a Java 11 library bootclasspath; this minimal JDK lacks usable --release 11 support. JUnit wrapper is supplied so the same scenarios are runnable under the repository task. JUnit/Gradle/Android/Room were not executed here.

Test-only MemoryCas is not a database, native gateway, JSON parser, security adapter or durable receipt store. Its concurrency/replay tests exercise the plan's integration protocol assumptions, not SQLite/Room isolation or restart durability. Required integration gates remain: actual native JSON mapping, schema/serializer compatibility, real coordinator read-set checks, rollback, crash/restart, two-device competition, replay after lost response, final outbox cardinality, and physical device acceptance. No production activation or deployment is claimed.
