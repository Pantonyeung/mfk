# 03｜Delivery, Checkpoint, Recovery

## Normal Warm Path

Client AppliedSeq = Server HeadSeq：
只 compare HEAD -> READY。

長駐 SMT/SMM 用 WebSocket Doorbell，正常唔需要 polling。

## Short Delta Catch-up

Client 899，Server 902，Journal floor 860：

GET changes after 899
-> 900, 901, 902
-> verify
-> stage
-> atomic apply
-> AppliedSeq = 902

## Long-offline / One-month-old Client

Client 1045
Server 2200
Journal floor 2150
Checkpoint 2180

禁止由 1046 replay 到 2200。

正式：
GET HEAD
-> local below journal floor
-> GET checkpoint 2180
-> verify hash/schema
-> atomic checkpoint install
-> GET tail 2181..2200
-> atomic tail apply
-> AppliedSeq 2200

正常只係 HEAD + Checkpoint + Tail。

## New Client

NONE
-> HEAD
-> latest Checkpoint
-> short tail
-> READY

## Adaptive Background Compaction

Owner 提出「舊區間整合成最新包」正式採納，但唔固定每日重建。

當 tunable threshold 達標，背景建立新 Checkpoint：
- tail event count過長
- compressed tail bytes過大
- checkpoint age過長
- schema migration
- maintenance

Threshold 數值未喺 R1 Constitution鎖死。

Compactor：

1. choose fixed headSeq N
2. materialize deterministic Port Projection at N
3. serialize + compress
4. SHA-256
5. write immutable checkpoint blob
6. readback + verify hash
7. update HEAD checkpoint pointer
8. keep previous checkpoint generation
9. compact old sync journal below retention floor

Checkpoint failure：
- 唔影響 Canonical
- 唔影響現有 Journal
- 唔移動 checkpoint pointer
- 永遠唔阻 Admin Publish

## Immutable R2 Checkpoint Store

正式 ownership：

- Durable Object = publish coordination、Port Head/Seq、recent transport Journal、checkpoint pointer、AppliedSeq/provider readback metadata。
- private `SYNC_CHECKPOINTS` R2 binding = immutable recovery blobs；唔係 Canonical Authority，Client無bucket credential/URL。
- `CUSTOMER_PAYMENT_EVIDENCE` 係另一個R2 authority boundary，完全唔共用。

Object key：

`checkpoints/v{schemaVersion}/{storeId}/{port}/{checkpointSeq-16-digit}/{objectSha256}.json.gz`

Logical payload保持 `MFK_SYNC_CHECKPOINT_V1`。Canonical JSON使用遞迴sorted object keys、原array order、UTF-8；`createdAt`固定取Projection@N嘅Head observed time。同一Projection@N重建會產生相同bytes/object identity。

Hash分工：

- `projectionHash` / `checkpointHash` = deterministic application fingerprint，供change/identity validation；`checkpointHash` preimage明確排除自己，保持V1 consumer compatibility。
- `objectSha256` = gzip compressed exact bytes嘅cryptographic SHA-256，供R2 readback/content address；唔寫入logical payload，避免circular preimage。

Write chain：

Projection@N -> canonical JSON -> native `CompressionStream('gzip')` -> SHA-256 -> conditional immutable R2 PUT -> R2 GET -> metadata/byte length/SHA/decompress/JSON/contract/store/port/seq/schema/projection validation -> DO monotonic pointer transaction -> journal compaction。

R2 PUT/GET/timeout、compression、SHA、gzip、JSON或identity任何一步失敗：pointer/head/journal不變，只記 `CHECKPOINT_BUILD_FAILED` / read diagnostics。Canonical Publish已先commit，唔等待亦唔rollback。

## Pointer, Previous Generation and Journal Floor

DO pointer保留 `current + previous` R2 generation。新pointer只可增加 `checkpointSeq`；遲到嘅舊compactor可以留低immutable orphan blob，但不得rewind pointer/head、改current projectionHash或刪新tail。

若Current object missing/corrupt，Admin Sync API以Previous object + retained contiguous tail重建同一Current logical checkpoint；identity唔完全相同即fail closed，Client保留LKG。Endpoint仍然係 `/sync/checkpoint`。

Compaction只刪 `sync:event:{PORT}:*` transport rows：

- 有Previous時，`journalFloorSeq <= previous.checkpointSeq + 1`，確保Previous真係可recover到Current。
- SMT/SMM tracked client低過floor時，protocol明確要求跳Current checkpoint；floor內仍只拉delta。
- Customer無per-browser AppliedSeq；以Current/Previous recovery invariant保留tail。
- KEETA額外取 `min(recovery floor, ProviderAppliedSeq + 1)`；provider未APPLIED/UNKNOWN delta不得刪。Provider readback unavailable時唔提高KEETA floor。
- Admin version/audit、Customer commercial proof/history、provider operation evidence唔係Sync Journal，compactor禁止觸碰。

Migration係non-flag-day：有R2 pointer先讀R2；未有pointer仍可讀舊 `sync:checkpoint:{PORT}:{SEQ}` DO payload。新build只寫R2；legacy payload清理要等獨立deployment/acceptance gate。

`mfk-sync-checkpoints` bucket name只係code binding contract；Production bucket provisioning/deploy係後續gate，唔屬本Seam。

## Atomic Apply

Client禁止更新一半。

正式：
Download batch
-> verify contiguous seq
-> verify schema
-> verify hashes
-> verify entity dependencies
-> stage temporary state
-> all pass
-> one local transaction commit
-> update AppliedSeq LAST

任何步驟 fail：
keep previous LKG
AppliedSeq unchanged
surface = STALE / RECOVERING

## Recovery Matrix

| Failure | Handling |
|---|---|
| Duplicate Delta | idempotent ignore / same entity revision |
| Out-of-order | stop apply；pull gap |
| Missing seq | GET changes after AppliedSeq |
| Seq compacted | Checkpoint recovery |
| Checkpoint hash mismatch | reject；keep LKG；redownload / incident |
| Schema incompatible | migrator；否則 major checkpoint recovery |
| Doorbell missed | reconnect HEAD catch-up |
| WebSocket down | LKG + reconnect；唔假綠 |
| Client apply crash | AppliedSeq未 advance；restart replay |
| Provider timeout | UNKNOWN + readback；禁止 blind full resync |
| Admin stale Draft | 409 fail-closed；fresh read/reapply |

## SMT Exact Chain

Admin Publish
-> SMT Port Head advances
-> WebSocket Doorbell
-> compare AppliedSeq / HeadSeq
-> pull missing delta only
-> atomic apply
-> write AppliedSeq
-> ACK/readback

Offline：
continue Last Valid LKG
-> reconnect
-> HEAD
-> delta or checkpoint recovery
-> atomic apply
-> ACK

現有 MFK acceptance 已鎖：Admin R18 -> R19 後，如果 SMT 一定要退出／重入先更新，係 PHYSICAL_FAILED。
