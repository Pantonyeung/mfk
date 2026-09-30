# MFK V3｜門鈴式資料同步、版本收斂與 Safari 防舊版方案 V1

日期：2026-09-30  
狀態：PLANNING ONLY / NO CODE

## 核心問題
Admin V3 唔係因為舊 UI 唔靚而重做。Keeta 驗收已證明：
- iPhone Safari 可以繼續食舊 Client release；
- Cloud / Canonical 已更新，Client 仍可能長期使用舊 Projection；
- Browser local state / cache 唔可以再充當 Authority；
- 同一門店有網絡時，SMT 不應長期停留不同 Canonical Config。

核心反模式：
Stale Local Projection acting like Authority

## 永久 Authority 原則
- Browser 唔係 Authority。
- localStorage 唔係 Authority。
- Query cache 唔係永久 Authority。
- Doorbell / WebSocket payload 唔係 Authority。
- Admin Cloud Canonical 係正式配置 Authority。
- SMT / Store Kernel 係現場 Transaction / Runtime Authority。
- Published ≠ Applied。
- Sent ≠ Received。
- Received ≠ Applied。
- Local revision 大 ≠ Local 比 Cloud 更新。
- Receiver 唔可以因為自己 R 號較大拒絕重新讀正式 Canonical。

## 正式門鈴模型
Sender：
1. 先將資料 Commit 去正式 Authority。
2. Commit 成功後敲 Receiver 門。

Receiver：
3. 收到 Doorbell。
4. 向 Authority 拉 Current HEAD / Read Model。
5. Validate。
6. Apply / Store。
7. Commit ACK / Readback。
8. 再敲返 Sender 門。

Sender：
9. 收到 ACK Doorbell。
10. 再讀正式 ACK / Readback。
11. exact match 先顯完成。

Doorbell 只通知，唔搬正式 Truth。

## 禁止業務輪詢
禁止每幾秒 polling「有冇新資料」。

可以有輕量 Doorbell transport：
WebSocket / SSE / Push。

正式資料只在以下事件拉：
- App Open / Login
- Doorbell
- Network Reconnect
- App 回前景
- Doorbell transport reconnect
- Manual Refresh / Reconcile

## Admin → SMT
Admin：
Draft → Validate → Impact → Publish → Cloud Canonical Commit。

Canonical identity 至少：
- storeId
- releaseId
- publishedAt
- fingerprint
- schemaVersion

Commit 後發 ADMIN_CONFIG_AVAILABLE 門鈴。

SMT 收 Doorbell：
→ GET Current Canonical HEAD
→ Validate
→ Atomic Apply
→ Commit ACK
→ 發 SMT_CONFIG_APPLIED 門鈴

Admin 收 Doorbell：
→ GET official ACK
→ exact identity match
→ 顯「SMT 已套用」

## SMT → Admin
SMT 先 Commit projection / order summary / day-close / runtime health / config ACK / print evidence / reconcile result，再 Doorbell Admin。

Admin：
Doorbell → invalidate exact Query → GET 正式 Read Model → Render。

禁：event payload 直接變 UI Truth。

## 多 SMT 收斂
如果同一 Store Canonical Config：
SMT1 = R10
SMT2 = R20

而兩部都有正常網絡，唔可以視為長期正常。

正式狀態：
CONFIG DRIFT / CONVERGENCE FAILURE

所有 Required Online SMT 最終要 exact-match 同一 Desired Canonical Identity：
- releaseId
- publishedAt
- fingerprint

短暫 rollout 可以顯「等待 SMT 回讀」。
超過 bounded convergence window：
Attention → Action Item / Incident。

## Local Higher Revision 不得拒收
錯：
「Doorbell R10；我本地 R20，所以唔收。」

正確：
任何有效 config Doorbell → GET Current Cloud HEAD。

如果舊 R10 event 遲到，但 Cloud HEAD 已係 R20：
→ Receiver 仍讀 R20
→ 唔 downgrade
→ ACK R20

Doorbell 可以舊；Canonical HEAD 先係新舊 Authority。

## Missed Doorbell
Doorbell transport 要有：
- CONNECTED
- RECONNECTING
- UNAVAILABLE

Event 可有：
- eventId
- sequence
- emittedAt

如果 Doorbell missed：
reconnect / foreground 後立即做 bounded Current HEAD reconcile。

可靠性模型：
Doorbell = 快；Canonical Reconcile = 最終正確。

## Runtime Version vs Config Version
Config Release：
同一 Store 必須收斂同一 Desired Canonical。

Runtime Binary：
只有 deliberate staged OTA 先可短期不同。

即使 SMT Runtime binary 不同，亦唔可以各自持有不同 Canonical Config Truth。

## Safari Client Release Freshness
TanStack Query 只解決 Server Data Freshness，唔解決 stale JS bundle。

每個 V3 build 內嵌：
- CLIENT_BUILD_ID
- SOURCE_SHA
- RELEASE_ID
- BUILD_TIME

Server 提供：
- CURRENT_DEPLOYED_RELEASE_ID
- CURRENT_SOURCE_SHA

Boot：
Client identity vs Serving identity。

Mismatch：
- 顯「系統已有新版本，正在載入」
- 做一次受控 reload / versioned navigation
- 再 mismatch：停止進入可寫工作區

禁止要求：
- clear cache
- Private Mode
- 手動刪 Safari website data

## Cache策略
入口 HTML / App Shell：
- no-store
或
- no-cache + must-revalidate

Release Manifest：
- no-store

Content-hashed assets：
- long cache
- immutable

V3 R1 無必要唔加 Service Worker。

## State libraries
TanStack Query：
Canonical / ACK / Projection / Reports / Device / Integration / Audit / Diagnostics。

Mutation：
useMutation → invalidate exact queries → authoritative refetch/readback。

Zustand / React：
只放 form / filter / tabs / UI preference / bounded local editing state。

Dexie：
只有正式批准 Offline Command 先用。
唔因為有 library 就預設建立 outbox。

## 第一條正式 Vertical Slice
登入
→ Client Release Match
→ Canonical Read
→ 新增分類
→ 新增商品
→ 設價
→ 儲存草稿
→ 檢查完整性
→ 影響預覽
→ 確認發佈
→ Cloud Canonical Commit
→ Admin 敲 SMT 門
→ SMT GET Current HEAD
→ Atomic Apply
→ SMT ACK Commit
→ SMT 敲 Admin 門
→ Admin GET ACK
→ exact match
→ Safari 關閉再開
→ Client Release Match
→ Canonical Result Match

呢條先係 Admin V3 第一個真正完成。

## Physical Acceptance
必測：
- iPhone normal Safari，唔清 cache
- in-app browser
- second tab
- new deployment
- reopen
- canonical update
- multi-SMT convergence
- missed doorbell
- reordered doorbell
- local higher revision
- ACK doorbell + official refetch
- rollback v2 serving identity

任何以下即 FAIL：
- Safari 要 clear cache 先更新
- Private Mode 先正常
- online SMT 長期不同 Canonical Config
- local R 號大就拒讀 Cloud HEAD
- Doorbell payload 直接做 Truth
- missed Doorbell 後無 reconcile
- old Doorbell 導致 downgrade
- Published 被當 Applied
- localStorage PUBLISHED/QUEUED/APPLIED 做 server truth
- setInterval 長期 polling 業務資料
- browser 舊 cache 覆蓋較新 canonical result

MILESTONE:
MFK_V3_DOORBELL_CANONICAL_CONVERGENCE_AND_SAFARI_FRESHNESS_PLAN_V1_READY
