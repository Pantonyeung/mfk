# MFK Admin V3｜Formal Server Draft Seam Proposal R1

日期：2026-10-01
狀態：PROPOSAL ONLY / REQUIRES OWNER APPROVAL BEFORE BACKEND CODE

## FIRST BREAK

Product Brief 要求：
- 已保存 Draft 跨頁存在
- Draft Bar 顯 canonical draft count / domain
- reload / new browser context 只恢復正式 server draft
- unsaved edit 不可靠 localStorage 冒充正式 Draft

Current backend 已有：
- authenticated canonical read
- formal publish
- ACK / readback
- doorbell

Current backend 未有：
- server draft create / read / update / discard
- draft identity
- draft revision / optimistic concurrency
- Pending Changes formal readback

所以 frontend in-memory edit 只可以代表「未保存修改」，唔可以冒充「草稿已儲存」。

## Bounded Scope

只新增 Admin Config Draft persistence seam，放喺現有 Admin Sync / canonical authority 內。

禁止建立：
- 新 pricing engine
- 新 order/payment/refund/cancel mutation
- 新 provider logic
- 新 SMT authority
- browser durable truth
- Dexie formal outbox
- production routing

## Draft Record

建議最少欄位：

- schema = MFK_ADMIN_DRAFT_V1
- storeId
- draftId
- baseFingerprint
- basePublishedAt
- draftRevision
- snapshot
- updatedAt
- updatedByStaffId

baseFingerprint / basePublishedAt：
建立 Draft 時的 canonical base identity。

draftRevision：
只作 server-side optimistic concurrency，不作 freshness authority。

## Endpoints

### GET /api/admin-browser/draft?storeId=MF01

Auth：
x-mfk-admin-session

Response：
- 200 + authoritative draft
- 404 ADMIN_DRAFT_NOT_FOUND

### PUT /api/admin-browser/draft?storeId=MF01

Request：
- baseFingerprint
- basePublishedAt
- expectedDraftRevision（已有 Draft 時）
- snapshot

Server 必須：
1. authenticate
2. store scope match
3. read current canonical
4. first save 時 current canonical fingerprint == baseFingerprint
5. update 時 expectedDraftRevision exact match
6. server 生成新 draftRevision
7. server 寫 updatedAt / updatedBy

Conflict：
- 409 ADMIN_DRAFT_BASE_CONFLICT
- 409 ADMIN_DRAFT_REVISION_CONFLICT

### DELETE /api/admin-browser/draft?storeId=MF01

Request：
- draftId
- expectedDraftRevision

Response：
- 200 DISCARDED

## Publish From Draft

保留現有 /api/admin-browser/publish，不破壞 v2 contract。

新增 bounded V3 endpoint：

POST /api/admin-browser/draft/publish?storeId=MF01

Request：
- draftId
- expectedDraftRevision

Atomic flow：
1. authenticate
2. permission = OWNER or PUBLISH_CONFIG
3. read current active
4. read formal server draft
5. verify draftId / draftRevision
6. verify draft.baseFingerprint == current active fingerprint
7. validate draft snapshot
8. server 建立正式 publish input
9. existing publishEnvelope semantics
10. success 後清除 draft
11. doorbell
12. client refetch canonical
13. target ACK / readback

Conflict：
409 ADMIN_DRAFT_BASE_CONFLICT

硬規則：
stale draft 不可以覆蓋較新的 canonical。

## Pending Changes

Pending Changes 可由 authoritative server Draft 衍生。

UI 可以比較：
draft.snapshot vs current canonical.snapshot

去顯示：
- changed domains
- changed object count
- before / after 摘要

但 Draft 是否存在、Draft identity、Draft snapshot 必須由 server record 決定。

## Multi-tab / Safari

Tab A save Draft revision 3。
Tab B 仍然 revision 2。

Tab B 再 save：
→ 409 ADMIN_DRAFT_REVISION_CONFLICT
→ refetch server Draft
→ 明確 conflict UI

Safari reopen：
→ login
→ GET server Draft
→ 正式恢復

禁止用 localStorage 恢復 formal Draft。

## Product Rule Note

產品規則已鎖：
- product code 系統自動生成，建立後不可手動修改
- takeaway surcharge 為 configurable amount

但如果 canonical pricing schema 未支援 configurable surcharge amount，
需要另開 pricing-authority bounded review。

本 Draft seam 不得偷偷修改 pricing semantics。

## Required Tests

Backend：
- unauthorized read/write/delete/publish
- wrong store
- first save exact base
- update exact draft revision
- stale draft revision conflict
- canonical changed after draft → base conflict
- reload returns same draft
- second-tab conflict
- discard exact identity
- publish-from-draft exact revision
- publish clears draft
- publish conflict preserves draft
- existing publish regression GREEN
- v2 Admin regression GREEN
- SMT ACK / doorbell regression GREEN

Frontend：
- unsaved edit != saved Draft
- save mutation → refetch server Draft
- reload restores server Draft
- Draft Bar derives from server Draft
- conflict explicit
- no localStorage / sessionStorage
- no Dexie formal outbox

## Approval Boundary

Owner 如批准，只批准：

- formal Admin server draft record
- GET / PUT / DELETE draft
- V3 draft publish endpoint with base/version guard
- exact contracts/tests required by above

Explicit no-touch：
- pricing authority semantics
- order/payment/refund/cancel mutation
- SMT Store Kernel
- Keeta/provider transaction logic
- v2 browser-state migration
- production routing
- hostname/cutover

## Approval Phrase

APPROVE BOUNDED ADMIN V3 FORMAL SERVER DRAFT SEAM R1

此句只授權以上 backend seam，
不等於 production deploy / cutover PROMOTE。

MILESTONE:
MFK_ADMIN_V3_FORMAL_SERVER_DRAFT_SEAM_PROPOSAL_R1_READY
