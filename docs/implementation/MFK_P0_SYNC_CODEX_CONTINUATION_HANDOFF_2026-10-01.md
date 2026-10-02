# MFK P0 Sync｜Codex Continuation Handoff｜2026-10-01

狀態：IMPLEMENTATION IN PROGRESS / DO NOT PROMOTE TO PRODUCTION

Repository: Pantonyeung/mfk  
Branch: feat/MFK-P0-CHECKPOINTED-DELTA-SYNC-R1  
PR: #623 — P0 Sync｜Checkpointed Delta Distribution Protocol R1  
Current reviewed head: e2f93a81eea8c0793c22468fa286c20967bbbe7f  
Base: main  
Branch status at handoff: 60 commits ahead / 0 behind / mergeable

## 1. Owner intent

呢個係 P0。目標唔係「有同步功能」，而係封死以下事故：

- Admin 已 Publish，但下游收唔到。
- 下游收到通知但無正確 Apply。
- Safari / Web / App 一直食舊資料。
- Customer 畫面顯示舊價但仍可交易。
- SMT / SMM / Customer 因每次 Publish 重新拉成份大資料。
- Keeta 只改 Product / Category，但 MFK 卻 full-menu upload。
- Client 落後幾百／幾千 revision 時逐條 replay 到最新。

Locked architecture：
Canonical = Authority
Port Projection = 每個端口真正需要嘅資料
Delta Journal = normal delivery
Doorbell = notification only
Checkpoint = bootstrap / catch-up / recovery
AppliedSeq = atomic apply completed
Full Snapshot = exceptional recovery only

Architecture constitution already exists under:
docs/architecture/mfk-p0-sync/

## 2. Current implementation already landed on PR #623 branch

### Shared protocol/core
- contracts/checkpointed-delta-sync-v1.ts
- sync/checkpointed-delta-sync.ts
- sync/smm-admin-projection.ts
- HEAD / CHANGE / CHECKPOINT / APPLIED ACK types
- deterministic per-port entity maps
- contiguous delta validation
- projection/checkpoint hashes
- atomic apply helpers
- Customer/SMM/SMT materializers
- ENTITY_ORDER preservation to avoid order drift

### Admin / Durable Object sync kernel
v2admin/worker.ts now has:
- per-port HEAD
- per-port Delta Journal
- source CommitSeq / CommitId
- baseline checkpoints
- adaptive checkpoint generation in DO storage
- changes/head/checkpoint/applied/readback endpoints
- publish-time per-port projection
- Customer config doorbell relay
- SMT/SMM port-head events
- Admin canonical publish remains exact-base fail-closed
- Admin Publish response distinguishes canonical publish from downstream apply state

### SMT
v2local/src/runtime/admin-config-sync.ts:
- Doorbell-first reconcile
- Head compare
- Delta catch-up
- Checkpoint recovery
- local staged bundle + pointer atomic switch
- AppliedSeq ACK
- legacy full Canonical pull only retained as bootstrap/migration fallback

### Customer
v2customer:
- config snapshot split from dynamic order/sellability readback
- Customer config checkpoint/delta cache
- Customer port Doorbell via CustomerRuntimeStore WebSocket
- visible/focus/pageshow/online reconcile
- removed constant 3-second config polling
- 3-second polling remains only while an active operational order exists
- legacy full snapshot retained as bootstrap fallback

### SMM
v2smm:
- SMM-specific projection
- config-sync.ts with Head/Delta/Checkpoint
- config merged with dynamic SMM read model
- realtime config subscription
- Applied watermark ACK
- transport auth work added; must still be reviewed carefully for actual browser/WebSocket credential behavior

## 3. CI state at handoff head e2f93a8

Completed GREEN:
- customer-stage2-main-landing-r1
- customer-ui4-cart-checkout-r1
- customer-ui5-submit-wait-r1
- smm-stage2-main-landing-r1
- SMT Consolidation A3 R1
- SMT Consolidation A3B R1
- admin-canonical-readback-r1
- admin-identity-canonical-r1
- admin-crossport-integration-gate
- owner-runtime-connection-r2

Still running at last check:
- MFK / Regression Shadow

Do not state all-green until current head workflows are re-read and Regression Shadow is complete.

## 4. Important risks / incomplete work

### P0-A Customer commercial freshness is NOT closed
Current Customer order intent still primarily uses:
- menuRevision
- cart published prices
- server revalidation

Missing locked final commercial contract:
- customerPortSeq / projectionHash binding
- server-issued freshness token / proof
- defined expiry / carry-forward owner policy
- transaction verification against historical commercial projection
- exact behavior at price cutover race

Owner requirement:
A Customer must never see an operable $48 state and then only at checkout discover $52.
Do not solve this by silently repricing or full-screen reload.

### P0-B Keeta minimum mutation is NOT implemented
Current Keeta runtime still has existing full-menu sync route.
PR #623 creates KEETA projection/journal, but no completed adapter consumes the KEETA delta journal and translates it into the provider's smallest supported mutation.

Owner requirement:
- one Product change -> one smallest supported provider mutation
- Category + Product -> dependency-scoped mutations
- full menu replacement only when exact provider API contract requires it
- provider accepted != provider applied; retain readback/event evidence

Do not invent provider endpoints. Use the banked Keeta docs/contracts in repo and fresh official docs if needed.

### P0-C Checkpoints still live in Durable Object storage
Current code has working checkpoint semantics, but R2 immutable content-addressed checkpoint offload is not yet implemented.
Target:
- DO owns HEAD / Journal / transactional sequence
- R2 owns immutable larger checkpoint blobs
- HEAD carries checkpointSeq + checkpointHash + object identity
- checkpoint write/readback/hash verify must complete before HEAD pointer moves
- checkpoint generation failure must never block Canonical Publish

### P0-D Admin distribution diagnostics UI is incomplete
Server readback exists/started.
Need Admin surface showing:
- Canonical Revision / CommitId
- per-port HeadSeq
- CheckpointSeq / JournalFloor
- tracked SMT/SMM AppliedSeq
- Customer head status without pretending every browser is tracked
- Keeta provider applied/readback status
- BEHIND N, STALE, UNKNOWN
Connected != Latest.

Do not merge giant unrelated UI changes into this PR if it can remain a bounded seam.

### P0-E Physical acceptance not complete
Need actual acceptance evidence for:
- SMT screen stays open while Admin Publish occurs; no exit/re-enter
- SMM screen stays open and receives relevant delta
- Customer Safari old tab/BFCache/resume
- missed Doorbell then reconnect
- duplicate delta
- out-of-order
- missing seq
- checkpoint corruption
- app killed mid-apply
- client one month behind -> checkpoint + short tail, never huge replay
- Admin publish during checkpoint compaction
- Keeta minimal mutation

CI green alone does not close P0.

## 5. Required Codex work order

Work one seam at a time. Do not deploy Production.

### Seam 1 — Stabilize current PR
1. Re-read PR #623 head and all current workflows.
2. Fix only current-head failures.
3. Run/verify relevant builds/typechecks/tests.
4. Do not weaken tests merely to permit new architecture; update tests only when the old assertion is explicitly superseded by owner-locked behavior.
5. Confirm no accidental cross-port WebSocket data leakage.
6. Confirm SMM WebSocket/session auth actually works with browser WebSocket constraints.

### Seam 2 — Customer commercial freshness fence
Implement contract first, then server, then client, then SMT submit verification.
Need a formal token/proof model with:
- storeId
- customerPortSeq
- projectionHash
- issuedAt
- expiresAt
- integrity proof
- material commercial facts/history verification

Do not use client-provided price as authority.
Do not silently change customer price at final submit.
If the chosen carry-forward/honour window requires an Owner choice, stop at explicit gate and document exact options/tradeoff; do not guess.

### Seam 3 — Keeta minimum mutation
Use KEETA port journal / entity diff.
Implement only provider operations supported by documented API evidence.
Dependency order Category before Product where required.
Keep current full menu sync as explicit recovery/manual full-replace path, not normal publish path.
Provider status must be PENDING/APPLIED/REJECTED/UNKNOWN with evidence.

### Seam 4 — R2 checkpoint store
Move immutable checkpoint payloads to R2, keeping transactional pointer metadata in DO.
Content-address object key.
Hash verify before publish pointer.
Keep previous checkpoint generation.

### Seam 5 — Admin diagnostics
Expose distribution evidence without turning Admin into a second runtime authority.

### Seam 6 — P0 acceptance
Automated + physical/manual evidence matrix.
Only after all P0 gates pass can PR be considered READY FOR OWNER REVIEW.

## 6. Non-negotiable invariants

- No Production deploy/cutover/OTA without explicit Owner authority.
- No full-menu/full-catalog normal sync.
- No 60-second full-data polling.
- No timestamp-based local copy authority.
- Doorbell is not authority.
- AppliedSeq is written last.
- Missing sequence is never guessed.
- Old client jumps to checkpoint if below JournalFloor.
- Audit history is never deleted by sync compaction.
- Checkpoint compaction never blocks Admin Publish.
- Customer price is P0 commercial truth.
- Keeta/provider only receives relevant changes by default.
- UNKNOWN stays UNKNOWN until readback/evidence.

## 7. Immediate technical review notes

- Current SMM sync transport/auth is newly introduced and high-risk. Verify browser WebSocket subprotocol/session approach against actual Worker request behavior before considering it done.
- Current checkpoint hashing uses deterministic application fingerprinting for protocol validation; R2 migration should explicitly decide whether object integrity key is cryptographic SHA-256 and keep the contract unambiguous.
- Current Customer/SMM local cache is non-authoritative LKG/projection cache only.
- Legacy fallback paths exist intentionally for migration. Remove them only after checkpoint bootstrap is proven in deployed acceptance; do not create a flag day.
- Do not couple operational order polling to config polling.

## 8. Definition of Done

P0 is closed only when:
Admin Publish
-> Canonical persisted/readback
-> deterministic relevant Port Delta persisted
-> Port Head advanced
-> relevant Doorbell available
-> client pulls only missing data or checkpoint+tail
-> atomic apply
-> AppliedSeq/readback where tracked
-> Customer commercial transaction proof valid
-> Keeta minimum mutation readback valid
-> gap/offline/Safari/crash/checkpoint tests pass
-> no stale UI can perform a transaction as if it were current

MILESTONE:
MFK_P0_CHECKPOINTED_DELTA_SYNC_R1_CODEX_HANDOFF_IN_PROGRESS
