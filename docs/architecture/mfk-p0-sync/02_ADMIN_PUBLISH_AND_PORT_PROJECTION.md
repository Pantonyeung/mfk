# 02｜Admin Publish and Port Projection Chain

## A. Admin Login / Fresh Boot

Admin 必須登入。
Browser credential/session 唔應長期保存成正式 authority。

Login 後：
Authenticate
-> read current Canonical
-> read current Formal Draft
-> verify Client Release identity
-> render Admin

## B. Structural Config Workflow

所有 Product / Price / Modifier / Combo / Mapping / Printer Route / Staff / Business Config：

Draft -> Validate -> Impact -> Publish -> Readback

Draft mutation 必須帶：
- expectedDraftRevision
- base Canonical fingerprint
- base publishedAt
- actor / permission
- audit

## C. Validate

Server Validate：
- schema
- Product / Category references
- price legality
- mapping dependencies
- printer logical route dependencies
- staff / RBAC references
- port projection feasibility

Validate fail = zero formal effect。

## D. Impact

Publish 前 Server 計算 changed entities 同 affected ports。

例：新增一個 Category + Product

Canonical:
- CATEGORY_UPSERT CAT-NEW
- PRODUCT_UPSERT PRD-NEW

Customer projection:
- CATEGORY_UPSERT
- PRODUCT_DISPLAY_COMMERCIAL_UPSERT

SMT projection:
- CATEGORY_UPSERT
- PRODUCT_RUNTIME_UPSERT

SMM projection:
- 只投影 SMM 真正需要欄位

Keeta adapter:
- Provider Category Create/Upsert
- Provider Product Create/Upsert

硬規則：
Canonical Revision changed 唔等於 Full Menu Replace。

## E. Publish Atomic Commit

正式 critical transaction：

1. compare exact base
2. create new Canonical Rn+1
3. persist immutable Canonical version / audit
4. calculate deterministic changed entities
5. create relevant per-port Delta events
6. advance relevant Port HEADs
7. persist CommitId / hashes / metadata
8. commit

只有以上完成，Cloud UI先可以顯示 CLOUD_PUBLISHED。

Cloud Published、SMT Applied、Provider Applied 必須係分開狀態。

## F. Doorbell

Commit 完成後先通知：

type = MFK_PORT_HEAD_AVAILABLE
port = SMT
headSeq = 1451
projectionHash = ...

Doorbell 只係 Notification，唔係 Authority。
Client 仍以 sequence/hash contract決定是否需要 Pull / Apply。

## G. Admin Self Readback

發佈嗰個 Admin Session唔需要等自己門鈴：

Publish
-> Canonical GET readback
-> revision/fingerprint match
-> UI = Cloud Published

SMT Applied要另外等 AppliedSeq/ACK。

## Port Projection Rule

### Customer
只包含 Customer-facing display/commercial facts：
category、product、image refs、price、modifier/combo customer structure、sellability、store presentation。

唔包含 printer route、staff PIN、provider credentials、Admin diagnostics。

### SMT
保留完整 Valid Admin LKG 所需 operational projection：
products/modifiers/combos、price facts、runtime printer config、staff permission facts、business settings、base eligibility。

### SMM
只收 Frontline Companion真正需要資料；唔複製 SMT Kernel。

### Owner
Read model / governance projection；唔因每次 Publish full config reload。

### Keeta / Provider

Provider Minimum Mutation Scope：
只改一個 Product，就只做 Provider API支援嘅最細 Product mutation。
如果 Provider 明文要求 Category + Product batch，最多只送 dependency scope。
只有 Provider exact contract 明確只支持 Full Menu Replace，先容許 full replace exception。
