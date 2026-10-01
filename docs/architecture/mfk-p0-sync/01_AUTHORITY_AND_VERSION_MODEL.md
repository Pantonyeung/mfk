# 01｜Authority and Version Model

## Authority

| Surface | 正式 Authority | 禁止 |
|---|---|---|
| Admin | Canonical Configuration / Data Authority | 建 Formal Order、取代 SMT transaction authority |
| SMT / Store Kernel | Formal Transaction + Runtime Operational Authority | 用 UI/local copy 覆蓋 Canonical |
| SMM | SMT Assistive Surface | 第二 Order / Pricing Authority |
| Customer | Published Projection Consumer + Order Intent | 自己決定正式價錢／Formal Order |
| Owner | Observation / Governance / bounded control | 第二 Admin Config Writer |
| Keeta / Provider | Channel Mapping / Adapter | 反向成為 MFK Canonical Authority |

現有 MFK audit 已鎖：Customer / SMM 唔需要 Full Admin Envelope；正確係 Revision-bound Port Projection。SMT 保留 Valid LKG，斷線後 Reconnect Catch-up。

## 六個身份

### CanonicalRevision

Admin 每次正式 Publish：
R2199 -> R2200 -> R2201

用於 Admin Audit / Rollback / global causal identity。

### CommitId

每次 Publish 一個 immutable unique ID。
用途：Idempotency、Audit、跨 Port correlation。

### PortSeq

每個 Port 自己獨立 monotonic sequence，只喺該 Port 有 relevant change 時 +1。

例：
Canonical R2201
Customer PortSeq 901 -> 902
SMT PortSeq 1450 -> 1451
SMM PortSeq 780 -> 780
Keeta SyncSeq 330 -> 331

因此 Admin 改打印模板唔會令 Customer 製造空 sequence。

### EntityRevision

每個 Entity 自己版本：
Product PRD000123 revision 19
Category CAT-RICE revision 7

用途：stale guard、debug、provider mapping。

### SchemaVersion

每個 Port Projection 有 schemaVersion。Major incompatible change先進入 checkpoint migration / full recovery。

### AppliedSeq

Client 只有 atomic apply 成功後先更新 AppliedSeq。

Server SMT HeadSeq 1451
SMT AppliedSeq 1449 = BEHIND 2

Connected 唔等於 Applied。
Doorbell 收到亦唔等於 Applied。

## HEAD

HEAD 係極細 fresh metadata：

- storeId
- port
- schemaVersion
- headSeq
- journalFloorSeq
- checkpointSeq
- checkpointHash
- projectionHash
- observedAt

HEAD 唔包含成份 Menu。

## CHANGE

日常 delivery 用 self-contained entity event，唔用 fragile path-based JSON Patch 做正式 contract。

欄位：
- portSeq
- canonicalRevision
- commitId
- entityType
- entityId
- entityRevision
- op = UPSERT / DELETE
- payload
- payloadHash

例：Product 價錢由 $48 -> $52，只發 Product commercial entity 最新 state。

## CHECKPOINT

某 Port 喺 checkpointSeq 嘅完整 Projection：
- deterministic serialization
- compressed
- SHA-256
- content-addressed URL
- immutable

Full Snapshot / Checkpoint 係 recovery object，唔係日常 delivery。

## JOURNAL

Checkpoint 後嘅 Delta tail。

Audit History 同 Sync Journal 必須分開：
- Audit History 長期保存。
- Sync Journal 只係 transport recovery，可 compact。
