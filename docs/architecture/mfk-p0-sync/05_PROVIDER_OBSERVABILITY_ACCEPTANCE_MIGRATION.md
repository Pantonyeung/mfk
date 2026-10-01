# 05｜Provider, Observability, Acceptance, Migration

## Keeta / Provider Chain

Admin 新增 Category + Product：

Canonical R2201
-> Provider Projection Diff
   CATEGORY_UPSERT CAT-X
   PRODUCT_UPSERT PRD-Y
-> dependency ordering
   Category first
   Product second
-> Provider Adapter translate
-> call smallest supported Provider mutation
-> provider response/readback
-> ProviderAppliedSeq

禁止：
R2201 changed -> upload whole 300-item menu

除非 Provider exact API contract 明確要求 full replace。

Provider mutation state：
PENDING / APPLIED / REJECTED / UNKNOWN

HTTP 200 如果只係 accepted request，唔可以直接當 APPLIED。

## Cloudflare Model

### Durable Object / SQLite
建議保存：
- active Canonical metadata
- immutable Canonical versions / audit pointers
- global commit records
- per-port HEAD
- recent Delta Journal
- tracked SMT/SMM/provider Applied watermarks
- session/auth metadata

Durable Object transactional + strongly consistent storage適合 Publish compare/write同 sequence allocation。

### R2
建議保存 immutable大物件：
- Port Checkpoints
- compacted Delta Segments（如將來需要）
- media assets

Object key：
/store/port/schema/seq/sha256.ext

### Hibernation WebSocket
SMT/SMM長駐 Doorbell用 Hibernation WebSocket。
idle時 DO可以hibernate，唔靠每60秒 polling。

## Diagnostics

Admin要可以見：

Canonical Revision R2201
CommitId ...

CUSTOMER
HeadSeq 902
Checkpoint 890
Journal floor 860

SMT
HeadSeq 1451
SMT-MF01-01 AppliedSeq 1451 CURRENT

SMM
HeadSeq 780
Device AppliedSeq 780 CURRENT

KEETA
SyncSeq 331
ProviderAppliedSeq 331 CURRENT

落後必須顯示：
SMT Head 1451 / Applied 1449 / BEHIND 2

Connected唔等於Latest。

## P0 Acceptance Gates

P0-01：只改一件 Product價錢，只出 relevant entity delta，禁止 full menu。

P0-02：新增 Category + Product，只產生 dependency changes。

P0-03：一個月舊 Customer，Local 1045 / Server 2200 / Checkpoint 2180；必須 checkpoint + short tail，禁止 replay 1000+ events。

P0-04：漏 Doorbell；Reconnect HEAD必須catch-up。

P0-05：duplicate / out-of-order唔可以 double apply 或 corrupt。

P0-06：Apply中途 kill app；restart仍係舊LKG，之後重做whole batch。

P0-07：Safari old cache / BFCache；Client Release identity + commercial HEAD重新確認先可交易。

P0-08：Displayed Price Integrity；可交易價格必須由 Server projection history + freshness fence證明。

P0-09：Keeta Minimal Mutation；改一件 mapped Product唔可以無 contract evidence觸發 full menu upload。

P0-10：SMT physical；保持畫面開住，Admin更新後Doorbell、delta、AppliedSeq、UI全部自動前進。

P0-11：Checkpoint corruption；hash錯必須reject + keep LKG。

P0-12：Compaction race；checkpoint綁定固定 seq，新 Publish可以繼續，完成後tail必須無漏change。

## Explicitly Forbidden

- 每次 Canonical Revision full menu reload。
- 每60秒全量 polling作主要同步。
- Browser LocalStorage copy憑 timestamp贏Server。
- Doorbell直接當正式data authority。
- 收到Doorbell就UI標Applied。
- AppliedSeq先行再套資料。
- decimal version做sequence。
- Client太舊逐條replay幾千delta。
- Customer Checkout臨尾靜默改價。
- Provider預設full menu upload。
- Sync Journal compaction刪Audit History。
- Checkpoint生成失敗阻Admin Publish。

## Implementation Order

Phase 0 Contract Freeze
- HEAD / CHANGE / CHECKPOINT META / APPLIED ACK
- CanonicalRevision + per-port PortSeq
- Customer commercial freshness fence
- Provider Minimum Mutation Scope

Phase 1 Server Journal
- deterministic entity diff
- per-port mapper
- monotonic journal/head
- read APIs

Phase 2 SMT First
- delta pull
- atomic apply
- AppliedSeq ACK
- gap recovery
- checkpoint recovery
- physical acceptance

Phase 3 Customer
- checkpointed projection cache
- tiny HEAD freshness
- commercial fence
- delta apply
- Safari/BFCache acceptance
- transaction material-fact validation

Phase 4 SMM
- reuse same protocol, no second engine

Phase 5 Provider Adapter
- relevant-change router
- dependency ordering
- smallest provider mutation
- provider readback

Phase 6 Compactor
- Journal穩定後再加 Adaptive Checkpoint Compaction

## Tunables Not Yet Locked

- Customer freshness token TTL
- previous commercial carry-forward window
- Checkpoint max age
- max tail event count
- max compressed tail bytes
- Journal retention window
- Delta batching
- Provider batching/rate-limit

以上要用 latency / traffic / provider contract / 真機測試後再 Owner Lock。

## Definition of Done

Admin Publish
-> Canonical persisted
-> relevant Port Delta persisted
-> Port Head advanced
-> Doorbell/fetch available
-> Client atomic apply
-> AppliedSeq confirmed
-> UI/runtime observed state correct
-> Customer commercial state transaction-safe
-> Provider minimal mutation readback correct
-> gap/checkpoint/Safari/offline acceptance passed

少任何一層都唔叫 P0 關閉。
