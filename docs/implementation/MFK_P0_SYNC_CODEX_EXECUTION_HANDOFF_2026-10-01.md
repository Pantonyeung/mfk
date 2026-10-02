# MFK P0 Sync｜Codex Execution Handoff｜2026-10-01

Status: EXECUTION HANDOFF / NOT PRODUCTION READY  
Repository: Pantonyeung/mfk  
Working branch: `feat/MFK-P0-CHECKPOINTED-DELTA-SYNC-R1`  
Draft PR: #623 `P0 Sync｜Checkpointed Delta Distribution Protocol R1`  
Handoff head at time of writing: `e2f93a81eea8c0793c22468fa286c20967bbbe7f`

## Owner intent

Finish the P0 data-distribution redesign across Admin, SMT, SMM, Customer and Keeta/provider paths.

Permanent rules:
- Canonical is authority.
- Normal delivery is per-port entity Delta, never automatic full-menu/full-snapshot replacement.
- Doorbell announces a new head; it is not data authority.
- Client only becomes current after atomic apply and AppliedSeq/watermark advancement.
- Long-offline clients use latest Checkpoint + short Delta tail; never replay thousands of events.
- Full Snapshot is bootstrap/recovery/major-schema only.
- Customer-visible commercial facts are P0: a stale displayed price must not silently become a different checkout price.
- Keeta/provider updates must use the smallest supported provider mutation scope. Full menu replace is an explicit provider-contract exception only.
- No Production deploy, hostname cutover or OTA without separate Owner authorization.

## Current implementation already on PR #623

1. Shared protocol contract
- `contracts/checkpointed-delta-sync-v1.ts`
- HEAD / CHANGE / CHECKPOINT / APPLIED ACK contracts and validation.

2. Shared sync engine
- `sync/checkpointed-delta-sync.ts`
- per-port entity maps, stable fingerprints, deterministic diff, checkpoint creation, delta application/materialization.
- includes SMT / Customer / SMM / Keeta projection builders.
- `sync/smm-admin-projection.ts` isolates SMM Admin projection.

3. Admin / Durable Object distribution kernel
- `v2admin/worker.ts`
- Admin publish writes canonical + per-port journal/head metadata.
- bounded checkpoint generation currently stored in DO storage.
- `/sync/head`, `/sync/changes`, `/sync/checkpoint`, `/sync/applied`, `/sync/readback`.
- Customer doorbell routed through CustomerRuntimeStore.
- SMT and SMM doorbell routes introduced.
- exact-base publish guard remains required.

4. SMT consumer
- `v2local/src/runtime/admin-config-sync.ts`
- Doorbell-first checkpoint/delta reconcile.
- atomic local bundle pointer.
- legacy full canonical path retained only as migration/bootstrap fallback.
- AppliedSeq ACK path.

5. Customer consumer
- `v2customer/src/cloud-runtime.ts`
- checkpoint/delta config cache and materialization.
- dynamic order/sellability readback separated from config.
- Customer config WebSocket doorbell.
- App no longer depends on config interval polling; active-order operational polling remains bounded while a live order exists.

6. SMM consumer
- `v2smm/src/config-sync.ts`
- checkpoint/delta config consumer.
- authenticated SMM transport / WebSocket work has been introduced.
- `v2smm/src/pwa-runtime.ts` merges delta-backed config with dynamic operational snapshot.
- Applied watermark ACK introduced.

7. Tests / current CI at handoff
At head `e2f93a81eea8c0793c22468fa286c20967bbbe7f`:
GREEN:
- customer-stage2-main-landing-r1
- customer-ui4-cart-checkout-r1
- customer-ui5-submit-wait-r1
- SMT Consolidation A3
- SMT Consolidation A3B
- admin-canonical-readback-r1
- admin-identity-canonical-r1
- admin-crossport-integration-gate
- smm-stage2-main-landing-r1
- owner-runtime-connection-r2

Still running at handoff:
- MFK / Regression Shadow

Do not claim final green until this head is rechecked.

## Mandatory Codex work remaining

### A. First: audit current PR before adding more code
The branch was built incrementally. Before continuing:
- inspect all 21 changed files against main;
- remove duplicate/competing sync routes or helper implementations;
- verify WebSocket tagging/auth is coherent and there is only one SMM event path;
- verify no test was weakened merely to accept a regression;
- run TypeScript/build/test suites locally/CI before further feature work.

### B. Customer commercial freshness P0
Current Customer delta delivery is NOT the final commercial guarantee.

Implement a server-verifiable commercial freshness contract so:
- browser/local cache never becomes pricing authority;
- price/sellability UI only becomes transaction-enabled against a server-confirmed Customer Port head/projection identity;
- submit carries the exact commercial identity/facts used by the UI;
- Store Kernel verifies those facts against server projection history/current bounded commercial policy;
- browser price tampering fails closed;
- do NOT solve this with “show $48 then checkout tells user $52”.
- exact TTL/carry-forward policy must remain configurable until Owner lock.

Prefer a tiny HEAD/freshness proof rather than one quote request per product.

### C. Keeta/provider minimum mutation
Current Keeta runtime still has the legacy full-menu sync path. Do NOT blindly delete it because it may remain required as recovery/provider-contract fallback.

Implement:
- consume KEETA port entity changes from the same sync journal;
- dependency-aware ordering (category before product; option/choice dependencies before affected SPU where required);
- translate MFK entity change into the smallest official/provider-supported mutation;
- record ProviderAppliedSeq / UNKNOWN / REJECTED / APPLIED;
- provider readback/webhook completion must decide final state where provider API is asynchronous;
- full menu replace only when exact provider contract requires it or as explicit recovery operation;
- changing one product/category must have a test proving unrelated menu items are not uploaded.

Use current official Keeta contract/evidence already banked in the repository; if an endpoint capability is uncertain, fresh-read official provider docs before implementation. Never invent an endpoint.

### D. Checkpoint storage / compaction
Current checkpoint path is bounded but lives in DO storage.

Complete production architecture:
- keep HEAD/journal coordination in per-store DO;
- write immutable, content-addressed compressed Checkpoint objects to R2;
- HEAD references checkpoint seq/hash/object key;
- validate hash on read/install;
- background adaptive compaction only; checkpoint generation failure must not block Admin publish;
- keep at least previous generation for recovery;
- Audit History is independent and must never be compacted with sync journal.

Do not add D1 as a second authority. D1 may later serve history/query/reporting projection only.

### E. Admin diagnostics surface
Backend `/sync/readback` exists; complete operator evidence:
- Canonical revision/commit identity
- Customer HeadSeq / checkpoint / journal floor
- SMT HeadSeq / device AppliedSeq / BEHIND n
- SMM HeadSeq / device AppliedSeq / BEHIND n
- Keeta SyncSeq / ProviderAppliedSeq / state
- Connected != Latest
- no green state from doorbell receipt alone.

V3 Admin UI currently lives on separate PR line #605; do not casually merge giant UI branch into #623. If UI work is required, make a deliberate integration branch/PR after backend contract is stable.

### F. P0 acceptance suite
Add deterministic tests for:
1. Single Product price edit => relevant entity delta only.
2. Add Category + Product => dependency changes only.
3. Local 1045 / server 2200 / checkpoint 2180 => checkpoint + short tail, no 1000+ replay.
4. missed Doorbell => reconnect HEAD catches up.
5. duplicate Delta => idempotent.
6. out-of-order/gap => no partial apply; recover.
7. app kill during apply => old LKG remains; AppliedSeq not advanced.
8. Safari/BFCache old page => commercial controls cannot transact until current freshness confirmation.
9. browser modifies price => server rejects.
10. Keeta one-item change => no unrelated full-menu upload.
11. checkpoint hash corruption => reject + keep LKG.
12. compaction race with new publish => no missing changes.
13. SMT remains open during Admin update => no exit/re-enter required.
14. SMM remains open during Admin update => no page restart required.

## Important architectural review points

- Per-store DO is the sync coordination authority, not D1.
- R2 stores immutable checkpoint blobs.
- D1, if introduced, is read/history/reporting projection only.
- Avoid timestamp-wins reconciliation.
- Avoid 60-second full-data polling.
- Avoid decimal sequence numbers.
- Avoid per-field fragile JSON Patch as the permanent business contract; prefer self-contained entity upsert/delete events.
- PortSeq only advances for a port when relevant projected state changes.
- A Canonical revision change must not automatically create traffic for every port.

## Acceptance before merge

Before changing PR #623 from Draft:
- all required CI at one exact head GREEN;
- no unresolved P0 sync test failure;
- Keeta minimal-mutation behavior proven by test/evidence;
- Customer commercial freshness contract proven end-to-end;
- checkpoint recovery/compaction proven;
- security/auth review for Customer/SMM WebSockets complete;
- no Production deploy/OTA has occurred.

## Source architecture docs

- `docs/architecture/mfk-p0-sync/README.md`
- `docs/architecture/mfk-p0-sync/01_AUTHORITY_AND_VERSION_MODEL.md`
- `docs/architecture/mfk-p0-sync/02_ADMIN_PUBLISH_AND_PORT_PROJECTION.md`
- `docs/architecture/mfk-p0-sync/03_DELIVERY_CHECKPOINT_RECOVERY.md`
- `docs/architecture/mfk-p0-sync/04_CUSTOMER_COMMERCIAL_AND_RELEASE_FRESHNESS.md`
- `docs/architecture/mfk-p0-sync/05_PROVIDER_OBSERVABILITY_ACCEPTANCE_MIGRATION.md`

Milestone:
`MFK_P0_SYNC_CODEX_EXECUTION_HANDOFF_2026_10_01`
