# MFK P0｜Checkpointed Delta Sync Protocol｜全端發佈／分發／接收 Chain V1

日期：2026-10-01  
狀態：OWNER-LOCKED DESIGN / IMPLEMENTATION PENDING  
級別：P0 Architecture  
適用：Admin / SMT / SMM / Customer / Keeta / Owner Read Models  
核心原則：**Canonical 是 Authority；Delta 是 Delivery；Projection 是 Port Data；Checkpoint 只做 Bootstrap / Recovery。**

---

## 0. 點解呢份文件存在

呢個設計係針對一個 P0 級風險：

1. Admin 已經 Publish 新資料，但下游收唔到。
2. 下游收到通知，但套用唔到／只套用一半，仍然使用舊資料。
3. Browser / App 顯示新版本號，但實際內容仍然係舊資料。
4. Customer 長時間冇開 App，重返時仲食舊菜單／舊價錢。
5. External Channel（例如 Keeta）只改一個分類／產品，卻錯誤重傳成份 Menu。
6. Full Snapshot 每次覆蓋造成慢、浪費流量、增加錯誤面。
7. Client 落後大量版本時，如果逐條 replay 由舊 seq 追到最新，亦會慢同複雜。

呢份文件鎖定一套全端共用嘅同步協議，避免下一手工程師重新用 Full Menu / Full Snapshot 當正常 Publish。

---

# 1. Authority 不變

## 1.1 Admin

Admin = Canonical Configuration / Data Authority。

Admin 負責：
- Product / Category / Modifier / Combo
- Pricing
- Channel Mapping / Commercial Mapping
- Logical Printer / Print Config
- Staff / RBAC
- Store Settings
- Structural Config Publish / Rollback

Structural Config 繼續：
`Draft → Validate → Impact → Publish → Readback`

呢個 Workflow 唔改。

## 1.2 SMT / Store Kernel

SMT / Store Kernel = 現場營運及 Formal Transaction Authority。

SMT：
- 消費 Admin Published Projection
- 保留 Last Known Good
- Offline Local-First
- Formal Order / Payment / Fulfillment / Print Execution 唔移去 Cloud

## 1.3 SMM

SMM = SMT Assistive Surface。

- 可以讀 Port Projection
- 可以發 bounded command / intent
- 唔可以變成第二 Pricing / Order / Config Authority

## 1.4 Customer

Customer = Published Commercial Projection Consumer + Order Intent Surface。

- 唔保存完整 Admin Envelope
- 唔擁有 Price Authority
- 顯示嘅可交易 commercial state 必須來自 Server Published Projection
- Submit 仍然經 Formal Transaction validation

## 1.5 Keeta

Keeta = External Channel Mapping / Adapter。

- 同一 MFK Product 可以有 Keeta-specific Name / Price / Category / Option / Combo mapping
- External Adapter 只接收 relevant change
- 禁止因為 Admin 有新 Revision 就默認 full-menu replacement
- 只有 Provider 官方 contract 明文要求 full replacement 時先可例外

---

# 2. Cloudflare 應該點用

## 2.1 現有系統實際用緊嘅係 DO，不係 D1

目前 `v2admin/wrangler.jsonc` 有：

- `ADMIN_SYNC → AdminSyncStore`
- `KEETA_RUNTIME → KeetaRuntimeStore`
- `CUSTOMER_RUNTIME → CustomerRuntimeStore`

而且全部係 `new_sqlite_classes`，即 SQLite-backed Durable Objects。

目前冇 D1 binding。

所以今次 P0 Sync **唔需要另起 D1 做第二份 Authority**。

## 2.2 Durable Object（DO）責任

以 Store 為粒度，DO 負責：

- Canonical current head metadata
- Global publish ordering
- Per-port sync head
- Change Journal
- Checkpoint manifest
- Applied ACK / watermark
- WebSocket Doorbell
- Gap detection / replay metadata
- Publish serialization

原因：
- 同一 DO 有 private、transactional、strongly consistent storage
- 適合做單一 Store 嘅 monotonic sequencing
- 已有 `AdminSyncStore`，唔應重建第二套

## 2.3 R2 責任

R2 負責：

- Immutable compressed Checkpoint blobs
- Content-addressed large projection payload
- 大型 immutable media / evidence

例如：

`sync-checkpoints/MF01/customer/2180-sha256ABC.json.br`

Checkpoint 一旦寫入就不可原地修改；新內容一定新 key / 新 hash。

## 2.4 D1

P0 Sync Protocol V1 **唔需要 D1**。

如果未來需要：
- 大型 Audit 搜尋
- BI / Reporting Index
- 跨 Store analytical query

可以另行考慮 D1。

但 D1 唔可以變成 Canonical Config Writer，亦唔可以同 AdminSyncStore 雙主。

---

# 3. Version Model：兩級 Sequence

唔用 `R123.1` 呢類 decimal version 做機器排序。

正式用兩級：

## 3.1 Global Commit Sequence

`commitSeq`

每次 Admin 成功 Publish 一個正式 Canonical Commit：

`2200 → 2201 → 2202`

用途：
- Audit
- Publish ordering
- Version history
- 關聯同一批 changes

## 3.2 Per-Port Projection Sequence

每個 Port 有自己 `portSeq`：

- Customer：C-1580
- SMT：S-910
- SMM：M-702
- Keeta：K-441

只有 relevant change 先令嗰個 Port 嘅 `portSeq +1`。

例如 Admin 只改 Logical Printer Name：

- Global commitSeq：2201
- SMT portSeq：911
- Customer portSeq：保持 1580
- Keeta portSeq：保持 441

所以 Customer / Keeta 零流量。

每個 Port event 同時記：

- `sourceCommitSeq`
- `portSeq`

咁 Audit 可以追返邊個 Admin Publish 產生呢個 Port change。

---

# 4. Change Event 唔用脆弱 Field Patch

禁止將正式同步核心建立喺：

`replace /catalog/products/23/price = 52`

呢類 position/path patch 太依賴前置狀態。

正式使用 Self-contained Entity Event。

例如：

```json
{
  "schema": "MFK_PORT_CHANGE_V1",
  "storeId": "MF01",
  "port": "CUSTOMER",
  "portSeq": 1581,
  "sourceCommitSeq": 2201,
  "eventId": "CUSTOMER:1581:PRODUCT_COMMERCIAL_UPSERT:PRD000123",
  "type": "PRODUCT_COMMERCIAL_UPSERT",
  "entityId": "PRD000123",
  "entityRevision": 19,
  "payload": {
    "name": "紫米照燒雞飯糰",
    "categoryId": "CAT-RICEBALL",
    "priceMinor": 5200,
    "sellable": true
  },
  "fingerprint": "sha256:..."
}
```

優點：
- idempotent
- duplicate 可安全忽略
- out-of-order 可 detect
- 唔依賴 array position
- Client 漏咗較舊同類 event，最新 UPSERT 仍然有完整 entity state

DELETE 亦用 identity：

`PRODUCT_REMOVE { entityId }`

唔用「刪第 23 項」。

---

# 5. Admin Publish 完整 Chain

## Step A｜登入

Admin 每次重新開 App / Reload：
- 必須 Login
- Session 唔落 LocalStorage / SessionStorage
- Login 成功先 fresh-read Canonical + Draft
- 唔用舊 Browser snapshot 當 Authority

## Step B｜Draft

Admin 編輯只改 Formal Draft。

例如：
- 新增 Category
- 新增 Product
- Product $48 → $52

Draft 可以多個改動，但仍未分發。

## Step C｜Validate / Impact

Publish 前 Server：
1. Validate Canonical schema
2. Validate references
3. Compare current active base
4. Compute deterministic entity-level diff
5. 計算邊個 Port 受影響

例：

Admin 改：
- + CAT-NEW
- + PRD001245

Impact：

Customer：
- CATEGORY_UPSERT
- PRODUCT_COMMERCIAL_UPSERT

SMT：
- CATEGORY_UPSERT
- PRODUCT_RUNTIME_UPSERT

SMM：
- CATEGORY_UPSERT
- PRODUCT_MANAGEMENT_UPSERT

Keeta：
- 只有有 Channel Mapping 嘅 relevant entities

Print-only config change：
Customer = 0 events。

## Step D｜Atomic Publish Commit

同一 Publish boundary 必須一次完成：

1. Verify expected active fingerprint / revision
2. 產生新 Canonical
3. `commitSeq + 1`
4. 記錄 immutable Admin Version
5. 寫 Canonical active
6. 寫 Change Journal
7. 寫每個 affected Port event
8. 更新 affected Port head
9. 建立 Publish readback metadata

任何一步失敗：
- 唔可以報 PUBLISHED
- 唔可以只更新一半 Port head

Cloud Published 仍然同 SMT Applied 分開。

## Step E｜Doorbell

Publish 成功後先撳鐘。

Doorbell 唔傳成份資料。

例如 SMT：

```json
{
  "type": "PORT_HEAD_AVAILABLE",
  "port": "SMT",
  "storeId": "MF01",
  "headSeq": 911,
  "sourceCommitSeq": 2201
}
```

Doorbell = notification only。
唔係 Authority。

---

# 6. HEAD / DELTA / CHECKPOINT 三件核心物件

## 6.1 HEAD

每個 Port 有極細 HEAD endpoint：

`GET /sync/customer/head?storeId=MF01`

例：

```json
{
  "schema": "MFK_SYNC_HEAD_V1",
  "port": "CUSTOMER",
  "headSeq": 2200,
  "checkpointSeq": 2180,
  "minReplaySeq": 2100,
  "checkpointHash": "sha256:ABC",
  "checkpointKey": "sync-checkpoints/MF01/customer/2180-ABC.json.br",
  "schemaVersion": 1
}
```

HEAD 必須：
- no-store
- 非常細
- 可高頻安全讀

## 6.2 DELTA

`GET /sync/customer/changes?after=2196`

Server 回：
- 2197
- 2198
- 2199
- 2200

一個 response 可以 batch 多個 event。
唔係一個 event 一個 HTTP request。

## 6.3 CHECKPOINT

Checkpoint = 某個 `portSeq` 時，該 Port 所需資料嘅完整 Projection。

Customer Checkpoint 只包含 Customer 所需：
- Categories
- Products
- Display commercial state
- Modifiers
- Combos
- Sellability
- Channel-visible store settings

唔包含：
- Admin RBAC
- Printer IP
- Audit internals
- Keeta secret mapping
- SMT-only runtime state

Checkpoint：
- compressed
- immutable
- content-addressed
- SHA-256 verified

---

# 7. Checkpoint Compaction：解決 1045 → 2200

例：

Client localSeq = 1045  
Server headSeq = 2200  
Server minReplaySeq = 2100  
Latest checkpointSeq = 2180

Client 唔會 replay 1046 → 2200。

流程：

1. GET HEAD
2. 發現 1045 < minReplaySeq
3. GET Checkpoint@2180
4. Verify SHA-256
5. Stage 到新 local namespace
6. Validate schema + references
7. Atomic pointer switch：
   `activeProjection = checkpoint2180`
8. GET Delta 2181 → 2200
9. Atomic apply
10. `appliedSeq = 2200`

總共通常：
- 1 個 HEAD
- 1 個 Checkpoint
- 1 個 Tail batch

唔係 1,155 個 request。

---

# 8. 幾時做新 Checkpoint

唔鎖死「每日一次」。

Checkpoint 係 background compaction。

觸發條件應 configurable，可以用 whichever comes first：

- Delta event count 超過 threshold
- Delta compressed bytes 超過 threshold
- 距離上次 Checkpoint 超過最大時間
- Major publish / migration
- Operator manual recovery checkpoint

初始 tuning 可以由實測決定，**threshold 唔屬於 Protocol 不變式**。

重要：
- Checkpoint creation 唔阻 Publish
- 新 Checkpoint 成功寫 R2 + hash verify 後先更新 HEAD manifest
- Manifest 成功後先可 compact 舊 Sync Journal

建議至少保留 Current + Previous Checkpoint 作 recovery。

---

# 9. Audit History 同 Sync Journal 必須分開

## Audit / Version History

長期保留：
- Admin publish
- Who / reason
- before / after
- immutable version
- rollback source
- canonical fingerprint

唔因為 Sync compaction 刪除。

## Sync Journal

只係 Delivery / Recovery 工具。

可以 compact：
- 舊 Delta
- 已被 verified checkpoint 覆蓋嘅 delivery event

**禁止因為 compact Sync Journal 而破壞 Admin Audit / Rollback。**

---

# 10. SMT 接收 Chain

SMT 係 long-lived Local-First Runtime。

## 正常

1. SMT local `appliedSeq=910`
2. Admin Publish
3. DO Doorbell：headSeq=911
4. SMT 比較 910 vs 911
5. GET changes after 910
6. Validate event schema / fingerprint
7. Stage change
8. Atomic apply
9. 寫 local `appliedSeq=911`
10. POST ACK/readback
11. Runtime 先對新資料可見

如果 apply fail：
- 保留舊 LKG
- appliedSeq 唔郁
- 報 DEGRADED / RECOVERY_REQUIRED

現有規則「一定要退出／重入先更新 = PHYSICAL_FAILED」保持。

## Offline

SMT 照用 Last Known Good。
Reconnect：
- HEAD handshake
- 少量 lag → Delta
- 太舊 → Checkpoint + Tail

---

# 11. SMM 接收 Chain

SMM 使用同一 Protocol，但只收 SMM Projection。

SMM 唔需要：
- 完整 Admin Snapshot
- Customer-only commercial UI payload
- Keeta-only mapping secrets

SMM：
1. Doorbell
2. Compare local appliedSeq
3. Pull relevant Delta
4. Atomic apply
5. ACK

SMM 仍然無 Formal Transaction Authority。

---

# 12. Customer 接收 Chain

Customer 係最敏感 P0 Port。

## 12.1 首次／新客

1. GET Customer HEAD
2. GET Latest Customer Checkpoint
3. Verify hash
4. Atomic install
5. GET Checkpoint → Head 嘅 Tail
6. READY

## 12.2 常用客

localSeq=2198、head=2200：

- HEAD
- Delta 2199–2200
- READY

## 12.3 一個月冇開

localSeq=1045、head=2200：

- HEAD
- Checkpoint 2180
- Tail 2181–2200
- READY

唔 full replay。

## 12.4 Active Browser

Customer 頁面開住時可以保持 lightweight WebSocket / realtime doorbell。

新 commercial change：
- 收 Doorbell
- 拉 relevant Delta
- 更新單一 Product / Category
- 唔 reload 成個 Menu

## 12.5 Safari BFCache / Resume

Browser 從 background / BFCache 恢復：
- 立即做 HEAD reconciliation
- Stable visual shell 可保留
- 未完成 HEAD 前，舊 commercial state 唔可以成為可提交交易 Authority
- 一旦發現落後，通常只食 Delta；太舊先 Checkpoint

---

# 13. Customer Price P0 Contract

呢條係死線：

**客戶眼前可操作嘅價錢，必須係 Server 已正式認可、可成交嘅價錢。**

每個 Customer commercial event 包：

- Product ID
- Price
- Commercial Version
- Port Seq
- Server Commercial Proof / fingerprint
- Effective state

Browser 自己改 DOM $52 → $1 冇用，因為冇相應 Server Proof。

Submit 帶：
- product identity
- material selections
- displayed commercial version / proof
- submissionId

Server / Store Kernel：
- 唔信 Browser 自報 amount
- 驗證呢個 commercial proof 確實由 Server 發出
- Final Formal Transaction validation 保留

如果 Client 一個月冇更新，舊 commercial proof 唔應該仍然係 actionable；Resume HEAD sync 會先收斂到 current commercial projection。

Race condition 必須遵守：
**如果 Server 正式向 Customer 展示並允許提交某個價格，Submit path 唔可以靜默將佢換成另一價錢。**

任何價錢 transition 嘅 exact grace / cutover semantics，要寫成獨立 Commercial Contract，唔可以藏喺 UI。

---

# 14. Keeta / External Provider 發佈 Chain

核心規則：

**Provider Minimum Mutation Scope。**

例：

Admin 只新增：
- Category CAT-NEW
- Product PRD001245

MFK Keeta Projector 只產生 relevant channel changes。

Keeta Adapter：
1. 讀 K-port relevant event
2. Resolve Keeta mapping
3. 轉成 Provider 支援嘅最細 mutation
4. 發送
5. 記 Provider operation ID / result
6. Readback / evidence
7. Mark External Applied

禁止：

`有新 Admin Revision → upload entire menu`

除非 verified Provider contract 明確規定呢個 mutation 只能 full replace。

如果 Provider 要：
- Category + Product 一齊提交

就提交 Category + Product。

唔可以順便提交全店所有 Categories / Products / Options / Combos。

External Provider ACK 唔可以反寫 MFK Canonical；佢只係 external delivery readback。

---

# 15. Admin 自己點收

Admin 同 SMT/Customer唔同。

Admin 係短 Session Authority Surface：

1. 每次開 App 必須 Login
2. Login 後 fresh-read Canonical + Draft
3. 唔 restore 長期 Browser authority
4. Admin 自己 Publish 時：
   `Publish → Canonical Readback → Distribution Readback`
5. Logout：
   - server session revoke
   - memory query cache clear
6. 下次再入重新 Login + fresh boot

Admin 唔需要靠 60 秒 full polling 保證自己 Publish 嘅資料。

---

# 16. Owner App

Owner 主要係 Observation / Governance。

Owner 可以讀：
- Port Head
- Applied Lag
- Channel health
- Device / Printer impact

但 Owner 唔因為見到 lag 就自己寫第二份 Canonical。

Quick Action 仍然走：
`Read → Command → Readback → Audit`

---

# 17. Applied Watermark：真正知道「收到未」

每個 Port 唔只顯示 Connected。

必須有：

- `headSeq`
- `appliedSeq`
- `lastAppliedAt`
- `lastAckAt`
- `schemaVersion`
- `checkpointSeq`

例如：

```text
Customer Head      2200
Customer Applied   2200

SMT Head           911
SMT Applied        911

SMM Head           702
SMM Applied        701   ← LAG 1
```

Admin 可以直接知道邊個 Port 落後。

**Doorbell received ≠ Applied。**

只有 atomic apply 成功 + appliedSeq advance 先叫 Applied。

---

# 18. Duplicate / Out-of-order / Gap

## Duplicate

Client 已 applied 2200，再收到 event 2200：
- ignore
- idempotent

## Out-of-order

Client=2198，先收到 2200：
- 唔直接 apply
- 發現 gap 2199
- GET changes after 2198
- batch 2199–2200
- atomic apply

## Missing Journal

Client=1045，但 `minReplaySeq=2100`：
- 唔 error loop
- Checkpoint Recovery

## Corrupt Checkpoint

SHA mismatch：
- 絕對唔 install
- 保留 previous LKG
- retry alternate checkpoint / report P0

## Crash mid-apply

新 projection 先寫 staging。
驗證全部成功後一次 pointer switch。

Crash 前：
- active pointer 仍然指舊完整版本

Crash 後：
- 要麼舊版
- 要麼新版

禁止半新半舊。

---

# 19. Release Cache 同 Business Data Sync 分開

Code Release 同 Data Revision 唔係同一件事。

## Code

- `index.html`
- `release.json`
- HEAD / manifest

必須重新驗證 / no-store。

Vite content-hashed：
- JS
- CSS

可以 immutable cache，因為內容變 = URL 變。

## Business Checkpoint

Checkpoint URL 帶 Seq + SHA：

`/customer/2180-ABC.json.br`

可以 immutable cache。

## HEAD

永遠 no-store。

所以速度同安全唔衝突：
- 細 HEAD fresh
- 大 immutable blob 可 cache
- Delta 只拉缺少部分

---

# 20. 正常 Publish 絕對唔 Full Snapshot

呢條係 P0 Rule：

**New Canonical Revision ≠ Full Resync。**

每次 Publish 要做：

`Canonical Diff → Relevant Entity Changes → Per-Port Projection → Delta Delivery`

Full Snapshot 只准：

1. First Bootstrap
2. Client 太舊，已超出 Journal retention
3. Hash / local state corruption
4. Major schema migration
5. Explicit recovery / disaster repair

其他情況 Full Snapshot Push 視為架構錯誤。

---

# 21. Checkpoint 只係 Recovery，唔係第二 Authority

Checkpoint 係由 Canonical / Port Projection deterministic build 出嚟。

Checkpoint 唔可以自行修改。

Source of truth 仍然係：
- Admin Canonical Config
- SMT Formal Transaction Runtime Authority
- 各 Domain 正式 authority

Checkpoint 只係一個已驗證 delivery image。

---

# 22. API Target Contract

建議 target API：

```text
GET /api/sync/:port/head
GET /api/sync/:port/changes?after=<seq>
GET /api/sync/:port/checkpoint/<seq>/<hash>

POST /api/sync/:port/applied
GET /api/sync/distribution/readback   // Admin only
WS  /api/sync/:port/events            // Doorbell
```

Admin Publish：
```text
POST /api/admin-browser/draft/publish
```

唔改成另一套 Publish Engine。

---

# 23. Storage Target

SQLite-backed `AdminSyncStore` DO 可以新增概念表／namespace：

```text
sync_global_head
sync_port_head
sync_port_event
sync_checkpoint_manifest
sync_client_applied
sync_projection_entity
```

或者先保持 KV-style key API，再逐步轉 SQL table。

重點係：
**同一 AdminSyncStore authority，唔新建第二同步 database writer。**

R2：

```text
sync-checkpoints/{storeId}/{port}/{seq}-{sha256}.json.br
```

---

# 24. P0 Observability

Admin Distribution / Diagnostics 最少顯示：

每個 Port：
- Current head
- Last applied
- Lag count
- Last apply time
- Connection / last contact
- Checkpoint used
- Last recovery reason
- Error state

External Provider：
- requested mutation scope
- Provider request ID
- Provider result
- Provider readback
- Last mismatch

唔可以只顯示「Connected」。

---

# 25. Mandatory P0 Acceptance

以下全部要做真實驗收：

## P0-01 單 Product 改價

只產生該 Product relevant Port Delta。
禁止 full menu。

## P0-02 新 Category + 新 Product

只產生：
- Category
- Product
- 必要 mapping

Keeta 唔可以 upload 全 menu。

## P0-03 Irrelevant Port Zero Payload

只改 Printer Template：
Customer / Keeta 應 0 payload。

## P0-04 SMT Live Update

SMT 唔退出、唔 refresh。
Admin Publish → Doorbell → Delta → appliedSeq advance。

如需退出重入先更新 = FAIL。

## P0-05 Duplicate

同 Event 重送兩次：
結果只 apply 一次。

## P0-06 Out-of-order

先 2200 後 2199：
Client 唔 corrupted；自動 gap recovery。

## P0-07 Offline Catch-up

SMT offline 20 changes：
Reconnect 後 batch catch-up。

## P0-08 Very Old Customer

Customer local 1045，Head 2200：
必須 Checkpoint + Tail。
禁止逐條 replay 1046–2200。

## P0-09 New Customer

冇 local state：
Latest Checkpoint + Tail。

## P0-10 Safari BFCache

一個月前頁面恢復：
不能用舊 commercial state直接交易。
HEAD reconciliation 後只拉缺少 Delta / Checkpoint。

## P0-11 Customer Price

畫面可操作價格同 Formal Submit commercial proof 一致。
禁止 Checkout silent reprice。

## P0-12 Crash During Apply

模擬 apply 中斷：
Restart 只可以見完整 old 或完整 new。
禁止 mixed state。

## P0-13 Corrupt Checkpoint

Hash mismatch：
拒絕安裝 + 保留 LKG + recovery。

## P0-14 Provider Scope

只改一產品：
External request evidence 必須證明最細 mutation scope。
除非 Provider contract 要求 full replace。

## P0-15 Distribution Readback

Admin Publish 後可以睇：
Cloud Published
→ Port Head
→ Port Applied / External Readback

唔可以 Publish 200 就畫全綠。

---

# 26. Migration Order

唔一次重建成個系統。

## Phase 1｜Protocol Core

喺現有 AdminSyncStore：
- Global commitSeq
- Per-port head
- Change Journal
- HEAD / changes API
- applied ACK

## Phase 2｜SMT

重用現有：
- Doorbell
- Valid LKG
- Reconnect catch-up

由 Full Canonical pull 逐步轉成 Delta-first + Checkpoint recovery。

## Phase 3｜Customer Commercial

優先：
- Product
- Category
- Price
- Modifier
- Combo
- Sellability

鎖 Price P0。

## Phase 4｜SMM

只做 revision-bound SMM projection。

## Phase 5｜Keeta

將 outbound full-menu-style flow 拆成 minimum mutation adapter。

Exact Provider granularity 必須跟 verified contract；唔估 API。

## Phase 6｜Checkpoint Compaction

R2 immutable checkpoint + journal compaction。

## Phase 7｜Admin Distribution Readback

正式顯示各 Port head/applied/lag。

## Phase 8｜Physical P0 Acceptance

真 Safari / SMT / SMM / Network loss / restart / Keeta sandbox 或真 Provider evidence。

---

# 27. Do Not Rebuild

以下已有 Authority，不因為 P0 Sync 重建：

- Admin Publish Engine
- Store Kernel
- Formal Order Engine
- Pricing Authority
- Payment / Tender
- Fulfillment
- Print Router / Queue
- Staff Auth
- Customer idempotency / UNKNOWN recovery
- Keeta inbound identity mapping

P0 Sync 係 Delivery / Projection / Recovery seam。

---

# 28. 一句話 Chain

```text
ADMIN
Login
→ Draft
→ Validate
→ Impact
→ Publish
→ Canonical Commit
→ Entity Diff
→ Per-Port Projection
→ Port Journal / Head
→ Doorbell

SMT / SMM / Active Customer
Doorbell
→ Compare appliedSeq vs headSeq
→ Pull missing Delta
→ Validate
→ Stage
→ Atomic Apply
→ appliedSeq
→ ACK / Readback

Old / New Client
HEAD
→ Replay window available?
   YES → Delta Tail
   NO  → Latest Checkpoint → Tail
→ Atomic Apply
→ READY

KEETA
Relevant Port Change
→ Channel Mapping
→ Provider Minimum Mutation
→ Provider Result
→ Readback
→ External Applied Evidence

ADMIN READBACK
Cloud Published
→ Port Head
→ Port Applied / Provider Readback
→ Only evidence-backed GREEN
```

---

# 29. 永久不變規則

1. Canonical 是 Authority。
2. Delta 是正常 Delivery。
3. Projection 是每個 Port 自己需要嘅資料。
4. Checkpoint 只係 Bootstrap / Recovery。
5. Doorbell 只係通知，唔係資料真相。
6. Received ≠ Applied。
7. `appliedSeq` 成功 advance 先叫 Applied。
8. Duplicate 必須 idempotent。
9. Gap 必須 replay / checkpoint，唔估。
10. Full Snapshot 唔可以因為「有新 Revision」就自動推。
11. Customer 可操作價格必須有 Server commercial authority/proof。
12. Customer Checkout 禁止 silent reprice。
13. Keeta / External 必須 minimum mutation scope。
14. Audit History 唔可以因 Sync compaction 消失。
15. D1 唔可以變第二 Canonical Writer。
16. Offline / Recovery 唔可以令任何 Surface 偷接第二 Authority。
17. Production GREEN 必須有 readback / applied proof；HTTP 200 唔等於完成。

---

# 30. Current vs Target

## Current 已有可重用

- Admin Canonical Publish
- Admin Cloud Hydration / Readback
- Admin immutable version history
- SMT Doorbell `ADMIN_CONFIG_AVAILABLE`
- SMT LKG / reconnect catch-up 基礎
- Projection Outbox primitive
- Customer submit revision / price / combo validation
- SMM authority boundary
- Keeta mapping / provider evidence基礎
- Cloudflare SQLite-backed Durable Objects
- R2

## Target 新增

- Global commitSeq
- Per-port portSeq
- Entity Change Journal
- Per-Port deterministic projector
- HEAD API
- Delta API
- Checkpoint Manifest
- R2 content-addressed checkpoints
- appliedSeq ACK
- Gap replay
- Journal compaction
- Customer commercial proof contract
- External minimum mutation delivery
- Admin Port Distribution Readback

---

# 31. Architecture Decision

正式鎖定名稱：

**MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1**

MILESTONE：

**MFK_P0_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1_OWNER_LOCKED_DESIGN**

Implementation 未開始時，任何工程師／AI 唔可以將本文寫成「已上線」。

下一手如果落實：
先做一個 bounded Protocol Core seam，唔可以一次重建 Admin / SMT / Customer / Keeta。
