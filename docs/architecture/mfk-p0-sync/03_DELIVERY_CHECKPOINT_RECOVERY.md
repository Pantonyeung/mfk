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
