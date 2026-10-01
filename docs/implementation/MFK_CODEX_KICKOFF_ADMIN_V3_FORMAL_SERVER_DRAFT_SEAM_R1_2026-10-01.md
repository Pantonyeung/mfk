# MFK Admin V3｜Codex Kickoff｜Formal Server Draft Seam R1

日期：2026-10-01  
模式：BOUNDED_WRITER / PREPARE ONLY  
Owner approval：APPROVE BOUNDED ADMIN V3 FORMAL SERVER DRAFT SEAM R1  
PROMOTE：NOT GRANTED

## GitHub

Repo:
https://github.com/Pantonyeung/mfk

Implementation branch:
https://github.com/Pantonyeung/mfk/tree/feat/MFK-V3ADMIN-FORMAL-SERVER-DRAFT-SEAM-R1

Draft PR:
https://github.com/Pantonyeung/mfk/pull/611

Exact base:
f78960ebbd07e1adfff62d19d3ac129be863cb53

Planning proposal:
https://github.com/Pantonyeung/mfk/blob/plan/MFK-V3ADMIN-UI-SHELL-R1/docs/implementation/MFK_ADMIN_V3_FORMAL_SERVER_DRAFT_SEAM_PROPOSAL_R1_2026-10-01.md

Planning commit:
https://github.com/Pantonyeung/mfk/commit/188e839edff65628876a4b29c9ac13f26a0075d9

Product Brief:
https://github.com/Pantonyeung/mfk/blob/main/docs/product/MFK_ADMIN_V3_PRODUCT_BRIEF_R1_2026-09-30.md

Product control:
https://github.com/Pantonyeung/mfk/issues/601

## FIRST BREAK

正式「已保存 Draft」目前冇 dedicated server persistence seam。

Product Brief 已鎖：
- 已保存 Draft 跨頁存在
- Draft Bar 由 canonical draft count/domain 衍生
- reload / new browser context / Safari reopen 只恢復正式 server Draft
- unsaved edit 不可用 localStorage / sessionStorage / Dexie 冒充正式 Draft
- Saved ≠ Published
- Publish 必須 canonical readback

所以：
React / Zustand 只可代表 UNSAVED EDIT。
Formal Draft 必須 server-side。

## Objective

只喺現有 Admin Sync / canonical configuration authority 增加最細 server Draft seam。

新增：

1. GET /api/admin-browser/draft?storeId=MF01
2. PUT /api/admin-browser/draft?storeId=MF01
3. DELETE /api/admin-browser/draft?storeId=MF01
4. POST /api/admin-browser/draft/publish?storeId=MF01

Formal server Draft record 最少：

- schema = MFK_ADMIN_DRAFT_V1
- storeId
- draftId
- baseFingerprint
- basePublishedAt
- draftRevision
- snapshot
- updatedAt
- updatedByStaffId

## Required semantics

GET:
- authenticated Admin browser session
- 200 + authoritative draft
- 404 ADMIN_DRAFT_NOT_FOUND

PUT:
- authenticate
- exact store scope
- first save 要 current canonical fingerprint/basePublishedAt match request base
- update 要 expectedDraftRevision exact match
- server 生成新 draftRevision
- server 寫 updatedAt / updatedByStaffId
- conflict:
  - 409 ADMIN_DRAFT_BASE_CONFLICT
  - 409 ADMIN_DRAFT_REVISION_CONFLICT

DELETE:
- authenticate
- draftId exact
- expectedDraftRevision exact
- 200 DISCARDED

draft/publish:
- authenticate
- OWNER 或 PUBLISH_CONFIG
- exact draftId
- exact expectedDraftRevision
- validate Draft snapshot
- reuse existing publishEnvelope semantics
- success 後先清 Draft
- existing doorbell/readback contract 保留
- conflict 保留 Draft

## Mandatory concurrency safety

baseFingerprint / basePublishedAt guard 唔可以只係「publish 前 pre-read」。

必須喺 final canonical publish write boundary 再做 compare-and-commit / serialized guard，確保：

1. Draft 驗證時讀到 canonical A
2. 如果另一 publish 在中間將 active 改成 B
3. 呢次 stale Draft 絕對唔可以再覆蓋 B

接受方法可以係：
- 將 expected canonical base 帶入現有 Durable Object serialized mutation path；
- 或 equivalent atomic/serialized compare-before-write。

不可用：
read active → await 多步 → 無 final recheck → write active。

Existing /api/admin-browser/publish contract 必須保持 backward-compatible。

## Second-tab contract

Tab A：Draft revision 3  
Tab B：仍持 revision 2

Tab B 再 PUT：
409 ADMIN_DRAFT_REVISION_CONFLICT

Client 必須可 refetch authoritative Draft；backend 不做 last-write-wins。

## Publish success contract

Draft publish 成功順序：

1. authz
2. load exact Draft
3. draft identity/revision guard
4. final canonical base guard
5. snapshot validation
6. existing publish semantics
7. canonical active written
8. publish metadata written
9. doorbell
10. Draft clear
11. client canonical refetch / target ACK readback

如 publish fail / conflict：
Draft 必須保留。

## Explicit no-touch

禁止改：

- Pricing authority / pricing semantics
- configurable takeaway surcharge amount schema
- SMT Store Kernel
- Order / Payment / Refund / Cancel
- Keeta/provider transaction logic
- v2 browser-state migration
- localStorage/sessionStorage/Dexie formal Draft
- production route
- hostname
- deployment / OTA
- existing transaction authority
- existing /api/admin-browser/publish external behavior，除非只做 backward-compatible internal guard/refactor

產品編號自動生成屬 Product flow。
外賣附加費由固定值變任意金額屬另一條 Pricing schema bounded review。
兩者唔可以偷入今刀。

## Allowed implementation paths

預設只准：

- v2admin/worker.ts
- v2admin/src/admin-formal-server-draft.test.ts
- v2admin/src/admin-sync-websocket-transport.test.ts（只可補 publish regression / guard test）
- .github/mfk-change-manifest.json
- docs/implementation/MFK_CODEX_KICKOFF_ADMIN_V3_FORMAL_SERVER_DRAFT_SEAM_R1_2026-10-01.md

如發現必須改其他 path：
STOP。
先報 exact reason / file / symbol / smallest expansion。
唔可以自行擴 scope。

## Required RED → GREEN tests

Backend minimum：

- unauthorized GET/PUT/DELETE/publish
- wrong store / scope
- GET missing = 404
- first save exact canonical base
- first save stale base = 409
- update exact draftRevision
- update stale draftRevision = 409
- same saved Draft reload readback
- second-tab stale save conflict
- delete exact draftId/revision
- delete stale revision conflict
- publish exact draftId/revision
- publish stale draftRevision conflict
- canonical changed after Draft creation = base conflict
- race: canonical changes between precheck and final write → stale Draft cannot publish
- successful publish clears Draft
- failed/conflicted publish preserves Draft
- existing /api/admin-browser/publish regression GREEN
- existing distinct publish Cloud canonical time behavior GREEN
- existing doorbell GREEN
- v2admin full test GREEN
- v2admin build GREEN

## Commands

cd v2admin
npm test
npm run build

如果 repo 有 current required scoped CI / regression command，照現有方式跑；禁止新建第二 CI / Builder system。

## Evidence required in Draft PR

交付時回報：

- exact base SHA
- candidate SHA
- files changed
- tests added
- RED evidence
- GREEN evidence
- full test/build result
- FIRST BREAK before/after
- authority impact
- persistence impact
- no-touch confirmation
- unresolved risks
- rollback SHA

## Stop rules

以下任何一項立即 STOP：

- 需要改 Pricing schema
- 需要改 Order/Payment/Refund/Cancel
- 需要改 SMT Store Kernel
- 需要 provider transaction change
- 需要 production routing
- 需要 v2 browser migration
- 需要第二 Draft authority
- 需要 weaken/delete tests
- final canonical base guard 做唔到 serialized/atomic safety
- current live repo evidence 同本 packet 衝突

## Delivery rule

只交 Draft PR。
唔 merge。
唔 deploy。
唔 cutover。
唔 OTA。

Owner 今次 approval 只係 implementation authorization。
唔係 PROMOTE。

MILESTONE:
MFK_ADMIN_V3_FORMAL_SERVER_DRAFT_SEAM_R1_CODEX_READY
