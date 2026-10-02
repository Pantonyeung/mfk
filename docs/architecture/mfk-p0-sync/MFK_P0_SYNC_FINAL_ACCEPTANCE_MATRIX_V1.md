# MFK P0 Sync Final Acceptance Matrix V1

狀態：SOURCE ACCEPTANCE CANDIDATE / PR #623 DRAFT HOLD

Continuation：#625

Owner lock：`MFK_SYNC_DIAGNOSTICS_STALE_AFTER_MS=300000`
禁止：自行 deploy、merge、hostname cutover、OTA、Production R2 provisioning、Production Keeta mutation。

## Exact SHA binding

本文件內 `FINAL_ACCEPTANCE_SHA` 係單一 SHA token。Git commit 無法在自身內容內嵌自己嘅 SHA；因此只有 Issue #625 內標題為 `MFK_P0_SYNC_FINAL_ACCEPTANCE_MATRIX_V1` 嘅 immutable evidence comment 將 token 綁定到一個 exact 40-character SHA，而且同一 SHA 嘅 required E1 commands及 exact-head checks已完成時，本 matrix 先正式生效。禁止用其他 SHA 嘅結果補數。

## Result vocabulary

- `SOURCE_VERIFIED`：E1 contract/source/deterministic automated evidence喺同一 `FINAL_ACCEPTANCE_SHA` 成立。
- `PHYSICAL_VERIFIED`：指定 E2/E3 runtime/browser/device/provider/infrastructure evidence已實際完成。
- `BLOCKED_PENDING_DEPLOY`：source path存在，但所需 deploy/device/provider/infrastructure未獲 Owner授權；唔係PASS，亦唔係FAIL。
- `FAILED`：預期行為未成立。

## Acceptance matrix

| Gate ID | Scenario | Expected | Evidence Level | Result | Evidence | Exact SHA | First Break | Recovery | Production Required? |
|---|---|---|---|---|---|---|---|---|---|
| P0-01 | Single Product Change | Canonical commit只產生Customer/SMT/SMM/KEETA relevant Product delta；irrelevant entity absent；normal full snapshot/menu sync零次 | E1 | SOURCE_VERIFIED | `admin-sync-websocket-transport.test.ts` one-Product publish：四個port各一個Product entity；Keeta無`/admin/menu/sync`；`checkpointed-delta-sync.test.ts` | FINAL_ACCEPTANCE_SHA | per-port deterministic diff / provider delta dispatch | reject unexpected entity/full-menu path；保留舊Head/LKG | No |
| P0-02 | Category + Product Dependency | Category先於dependent Product；只發Category/Product/order dependency changes；不全量重送 | E1 | SOURCE_VERIFIED | `checkpointed-delta-sync.test.ts`三個client port dependency order；`keeta-provider-mutation.test.ts` Category-before-SPU | FINAL_ACCEPTANCE_SHA | projection dependency ordering | fail plan/apply；保留LKG；重新由HEAD取合法delta/checkpoint | No |
| P0-03 | Long Offline 1045→2200, checkpoint 2180 | HEAD→Checkpoint 2180→Delta 2181–2200；禁止1046–2179 replay | E1 | SOURCE_VERIFIED | `r2-immutable-checkpoint.test.ts` “uses checkpoint 2180 plus tail 2181-2200” | FINAL_ACCEPTANCE_SHA | HEAD journal floor / checkpoint selection | current checkpoint；必要時previous+retained tail | No for E1; deployed R2 acceptance is E3 |
| P0-04 | Missed Doorbell | reconnect/focus/pageshow/visibility/online重新讀HEAD並catch up；doorbell loss不會永久stale | E1 | SOURCE_VERIFIED | `admin-sync-websocket-transport.test.ts` event-driven resume；Customer/SMM resume tests/source contracts | FINAL_ACCEPTANCE_SHA | resume/reconnect HEAD read | delta或checkpoint catch-up；LKG保持可讀但唔假CURRENT | No for E1; E2 browser/device required |
| P0-05 | Duplicate Delta | duplicate/stale batch no-op；no double mutation；AppliedSeq不倒退/錯行 | E1 | SOURCE_VERIFIED | `checkpointed-delta-sync.test.ts` exact duplicate batch keeps same entities and AppliedSeq | FINAL_ACCEPTANCE_SHA | shared `applyMfkSyncChangeBatch` cursor guard | ignore already-applied batch；再讀HEAD | No |
| P0-06 | Out-of-order / Gap 101,103 | detect non-contiguous/gap；zero partial commit；never guess 102 | E1 | SOURCE_VERIFIED | `checkpointed-delta-sync.test.ts` non-contiguous validator + fromExclusive mismatch keeps LKG | FINAL_ACCEPTANCE_SHA | batch validation / local AppliedSeq cursor | reject batch；保留LKG；下一次HEAD走delta或checkpoint recovery | No |
| P0-07 | Crash Mid Apply | staged incomplete state唔成authority；previous LKG完整；AppliedSeq最後先前進 | E1 | SOURCE_VERIFIED | shared batch apply copies before mutation；SMT writes full candidate then single pointer last；Customer/SMM use one synchronous bundle switch | FINAL_ACCEPTANCE_SHA | candidate materialize/hash/atomic pointer | restart由舊pointer/bundle AppliedSeq重做whole batch | No for E1; device kill/restart is E2 |
| P0-08 | Safari / BFCache | cached stable UI可render；commercial controls立即lock；tiny HEAD/proof；behind先delta/checkpoint；stale價不可交易 | E1 source; E2 browser pending | SOURCE_VERIFIED | `commercial-freshness-r1.test.mjs` pageshow/focus/visibility/online lock + tiny HEAD；real Safari未執行 | FINAL_ACCEPTANCE_SHA | commercial lock before reconcile | HEAD/proof refresh；delta/checkpoint；new valid proof先unlock | Owner-authorized deploy/browser session for E2 |
| P0-09 | Price Tamper HK$52→HK$1 | Server reject；no formal order | E1 | SOURCE_VERIFIED | `customer-commercial-freshness.test.ts` returns `CUSTOMER_COMMERCIAL_UNIT_PRICE_MISMATCH:L1` | FINAL_ACCEPTANCE_SHA | server historical material-fact verification | 409 fail closed；fresh commercial state；customer reconfirm | No |
| P0-10 | Valid Old Proof Honour HK$48 after HK$52 publish | 未過期HK$48 proof仍honour；no silent reprice | E1 | SOURCE_VERIFIED | `customer-commercial-freshness.test.ts` historical projection grant total 4800 after current 5200 | FINAL_ACCEPTANCE_SHA | signed historical projection lookup | honour到`expiresAt`；只容許已鎖非價格hard stop | No |
| P0-11 | Expired Proof | 5分鐘後fail closed；fresh HEAD/state；顯示新價；重新確認；new proof先submit | E1 | SOURCE_VERIFIED | proof verifier rejects at exactly `300000ms` using server receipt time；Customer expiry timer locks actions | FINAL_ACCEPTANCE_SHA | proof expiry verifier | HEAD→delta/checkpoint→new proof→explicit reconfirm | No |
| P0-12 | Keeta One Item / 300 Items | provider payload只含affected item；unrelated 299 absent；normal path無full replacement | E1 source; E3 provider pending | SOURCE_VERIFIED | `keeta-provider-mutation.test.ts` 1/300 scope and one-SPU update；publish integration forbids full menu | FINAL_ACCEPTANCE_SHA | KEETA delta planner | stop scoped operation；readback；full replace只限explicit recovery | Owner-authorized real provider mutation for E3 |
| P0-13 | Provider Accepted != Applied | HTTP/task accepted保持PENDING；official readback/webhook finality先APPLIED | E1 source; E3 provider pending | SOURCE_VERIFIED | `keeta-provider-mutation.test.ts`/`admin-distribution-diagnostics.test.ts` accepted-only remains PENDING | FINAL_ACCEPTANCE_SHA | provider finality/readback | poll/readback official task state；唔前進ProviderAppliedSeq | Owner-authorized real provider finality for E3 |
| P0-14 | Provider UNKNOWN | timeout/transport uncertainty→UNKNOWN；readback first；no blind resend | E1 source; E3 provider pending | SOURCE_VERIFIED | `keeta-provider-mutation.test.ts` timeout UNKNOWN + readback-before-retry | FINAL_ACCEPTANCE_SHA | transport uncertainty classifier | official readback；只喺definitive absent/retryable先同identity retry | Owner-authorized provider fault injection for E3 |
| P0-15 | Corrupt R2 Checkpoint | wrong SHA/corrupt gzip/invalid body全部reject；pointer不前進；client保留LKG | E1 source; E3 R2 pending | SOURCE_VERIFIED | `r2-immutable-checkpoint.test.ts` SHA/gzip/JSON/identity/hash failures | FINAL_ACCEPTANCE_SHA | immutable object readback validation | keep current pointer/journal/LKG；incident/redownload | Owner-authorized private R2 PUT/GET for E3 |
| P0-16 | Current Checkpoint Missing | previous generation + retained contiguous tail安全重建current | E1 source; E3 R2 pending | SOURCE_VERIFIED | `r2-immutable-checkpoint.test.ts` reconstructs missing current from previous | FINAL_ACCEPTANCE_SHA | current R2 GET/readback | previous checkpoint→retained tail→exact identity check；否則fail closed | Owner-authorized private R2 for E3 |
| P0-17 | Compaction Race @2180 + Publish 2181–2183 | Head 2183；Checkpoint 2180；tail 2181–2183完整 | E1 source; E3 R2 pending | SOURCE_VERIFIED | `r2-immutable-checkpoint.test.ts` publish/checkpoint race | FINAL_ACCEPTANCE_SHA | monotonic DO pointer transaction / retained tail | stale build可留orphan；不得刪新tail | Owner-authorized deployed compactor/R2 for E3 |
| P0-18 | Stale Compactor 2180 after 2200 | pointer保持2200 | E1 source; E3 R2 pending | SOURCE_VERIFIED | `r2-immutable-checkpoint.test.ts` stale compactor cannot rewind | FINAL_ACCEPTANCE_SHA | pointer compare inside DO transaction | return STALE；保留2200 pointer/head | Owner-authorized deployed compactor/R2 for E3 |
| P0-19 | SMT Live Update | SMT保持開住；Admin Publish→Doorbell→HEAD→Delta→Atomic Apply→AppliedSeq==Head；不重開App | E2 | BLOCKED_PENDING_DEPLOY | source chain/tests exist；無本輪deploy/真SMT evidence | FINAL_ACCEPTANCE_SHA | first unverified break係deployed Doorbell→device HEAD | capture timestamps/seq/hash；任何break即停，checkpoint或revert | Yes — Owner deploy + real SMT |
| P0-20 | SMM Live Update | SMM保持開住自動更新；不refresh/restart；AppliedSeq==Head | E2 | BLOCKED_PENDING_DEPLOY | source chain/tests exist；無本輪deploy/真SMM browser evidence | FINAL_ACCEPTANCE_SHA | first unverified break係deployed Doorbell→SMM HEAD | capture browser/network/ACK；任何break即停，checkpoint或revert | Yes — Owner deploy + real SMM |
| P0-21 | Admin Diagnostics First Break | Canonical Published；SMT CURRENT；SMM BEHIND 2；Customer AVAILABLE/NOT_GLOBALLY_TRACKED；Keeta PENDING 1；準確顯first break | E1 | SOURCE_VERIFIED | `admin-distribution-diagnostics.test.ts` separation/behind/provider/browser coverage/first-break tests | FINAL_ACCEPTANCE_SHA | diagnostics precedence classifier | preserve raw seq/hash/time/provider evidence；顯示最高優先break | No |
| P0-22 | Diagnostics Freshness >5 min | ACK超過300000ms不得CURRENT；exact seq old evidence→STALE/UNKNOWN按contract | E1 | SOURCE_VERIFIED | `admin-distribution-diagnostics.test.ts` stale exact-sequence ACK + wrangler lock `300000` | FINAL_ACCEPTANCE_SHA | freshness classifier before CURRENT | new authoritative ACK/readback；唔用connection/seq單獨假綠 | No |
| P0-23 | Compaction Isolation | sync compaction不得刪Admin audit/version、Customer proof/history、Keeta provider evidence | E1 | SOURCE_VERIFIED | `r2-immutable-checkpoint.test.ts` compacts only `sync:event:*` and preserves three evidence classes | FINAL_ACCEPTANCE_SHA | sync journal prefix allowlist | abort transaction on incomplete retained tail；non-sync keys untouched | No |
| P0-24 | Irrelevant Port | Customer無關setting不得推Customer PortSeq；global Canonical revision不得製造假traffic | E1 | SOURCE_VERIFIED | Canonical publish integration changes print rule：只SMT Head前進；SMM/Customer/KEETA不變 | FINAL_ACCEPTANCE_SHA | per-port deterministic diff | zero delta→zero PortSeq advance/doorbell | No |
| P0-25 | Fresh Customer Bootstrap | new browser→HEAD→checkpoint/projection→short tail→current proof；不要求historical replay | E1 source; E2 browser pending | SOURCE_VERIFIED | Customer reconcile bootstrap contract + `commercial-freshness-r1.test.mjs` + checkpoint/tail tests | FINAL_ACCEPTANCE_SHA | bootstrap HEAD/checkpoint identity | current checkpoint；short tail；proof identity verify；失敗保持commercial lock | No for E1; fresh real browser session for E2 |

## Source close and physical close

- Source close只可喺Issue #625 exact SHA binding、required E1同exact-head CI完成後標記 `SOURCE_READY_FOR_OWNER_REVIEW`。
- `SOURCE_READY_FOR_OWNER_REVIEW` 唔等於 `PRODUCTION_READY`。
- E2尚欠：真Safari/BFCache、真SMT live-open、真SMM live-open、fresh browser bootstrap/kill-restart。
- E3尚欠：真Keeta merchant/provider mutation + finality/UNKNOWN、private deployed R2 PUT/GET/corruption/fallback/race。
- PR #623保持Draft/HOLD；只可由Owner另行決定離開Draft。

## Exact deployment acceptance plan

1. Owner逐項明確授權deploy/preview、private R2、device/browser同Keeta merchant scope；未獲授權唔執行。
2. 喺同一approved SHA provision `SYNC_CHECKPOINTS` private R2 binding及server-only commercial keyring；讀回release/source identity。
3. 先做private R2 immutable PUT/GET/hash/gzip/body/pointer/previous-generation acceptance；失敗不移pointer並停止。
4. 開真Safari/BFCache：stable UI先render、commercial即lock、HEAD/proof後unlock；tamper/expired proof真submit fail closed。
5. SMT畫面保持開住做一個Product publish；記錄publishedAt、doorbellReceivedAt、HEAD、delta、appliedAt、AppliedSeq、ACK/readbackAt。
6. SMM畫面保持開住重做同一條chain；禁止refresh/restart作通過條件。
7. Keeta先一件item；核對provider receipt payload只含affected item，再驗accepted=PENDING、official finality=APPLIED、timeout=UNKNOWN/readback-first。
8. 每個physical gate獨立checkpoint；任何第一break即停止並revert該deploy/candidate。完成前維持Draft/HOLD，禁止cutover/OTA。
