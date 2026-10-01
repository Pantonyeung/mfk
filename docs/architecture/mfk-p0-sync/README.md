# MFK P0 Checkpointed Delta Distribution Protocol R1

日期：2026-10-01
狀態：OWNER DESIGN DECISION / ARCHITECTURE CONSTITUTION / IMPLEMENTATION PENDING
範圍：Admin、SMT、SMM、Customer、Keeta／第三方 Channel、Owner Read Model

## 目的

永久封死以下 P0：
- Admin 已 Publish，但 Canonical 無真正更新。
- Canonical 已更新，但下游無收到 relevant change。
- Client 收到通知，但漏資料／亂序／只更新一半仍假裝最新。
- Safari／App 長期保存舊資料，重新開仍做正式業務。
- Customer 畫面顯示舊價，但 Server 商業狀態已變。
- Keeta／Provider 只改一個 Product／Category，系統卻全 Menu 重傳。
- 顯示新 Release number，但實際 HTML／JS／Business Data 仍係舊內容。

## 一句話 Constitution

Canonical 是 Authority。
Port Projection 是每個端口真正需要嘅資料。
Delta Journal 是日常 Delivery。
Doorbell 只通知有新 Head。
Checkpoint 是快速 Catch-up／Recovery。
AppliedSeq 先代表真正套用成功。
Full Snapshot 只係首次啟動／Recovery／Major Schema Change。

## 核心文件

1. 01_AUTHORITY_AND_VERSION_MODEL.md
   - Authority
   - CanonicalRevision / PortSeq / EntityRevision / AppliedSeq
   - HEAD / CHANGE / CHECKPOINT / JOURNAL

2. 02_ADMIN_PUBLISH_AND_PORT_PROJECTION.md
   - Admin Draft -> Validate -> Impact -> Publish -> Readback
   - per-port deterministic projection
   - Provider Minimum Mutation Scope

3. 03_DELIVERY_CHECKPOINT_RECOVERY.md
   - Doorbell-first
   - Delta catch-up
   - Checkpoint compaction
   - atomic apply
   - offline / gap / crash recovery

4. 04_CUSTOMER_COMMERCIAL_AND_RELEASE_FRESHNESS.md
   - Customer commercial freshness fence
   - What You See Is What You Can Pay
   - Safari/BFCache
   - Client Release identity vs Business Data identity

5. 05_PROVIDER_OBSERVABILITY_ACCEPTANCE_MIGRATION.md
   - Keeta / provider minimal mutation
   - diagnostics
   - P0 acceptance gates
   - migration order
   - explicit forbidden patterns

## Owner Decisions Locked 2026-10-01

- 所有 Port 採增量更新；唔係每次整份資料覆蓋。
- Keeta／External Provider 只更新最細 relevant scope；Full Menu replace 只可係 provider contract exception。
- Client 太舊唔逐條追幾千個 delta；直接最新 Checkpoint + short tail。
- Checkpoint/Compaction 係背景 recovery optimisation，唔阻 Admin Publish。
- Customer 顯示價係 P0；唔接受 Checkout 先突然改價。
- Customer commercial state 要有 Server freshness evidence。
- Admin／SMT／SMM／Customer／Keeta共用 Protocol primitives，但每個 Port Projection唔同。
- Full Snapshot 係 Recovery path，唔係 Normal Delivery path。
- Connected 唔等於 Latest；HeadSeq / AppliedSeq / Readback 必須可觀察。
- P0 必須過真 Safari、真 reconnect、真 SMT/SMM、真 Provider acceptance；CI GREEN 唔等於完成。

MILESTONE: MFK_P0_CHECKPOINTED_DELTA_DISTRIBUTION_PROTOCOL_R1_OWNER_LOCKED
