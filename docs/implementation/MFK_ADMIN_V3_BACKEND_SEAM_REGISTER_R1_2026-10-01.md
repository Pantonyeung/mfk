# MFK Admin V3｜Backend Seam Register R1

日期：2026-10-01
狀態：PLANNING / CURRENT SOURCE EVIDENCE REVIEWED
原則：有 gap 就記 gap，唔由 frontend 發明第二 authority。

# 1. VERIFIED｜可以直接重用嘅 seams

## S-01 Admin Auth
Routes：POST /api/admin-browser/auth/challenge；POST /api/admin-browser/auth/verify；GET/POST /api/admin-browser/auth/session。
V3 rule：session token memory-only。
Status：VERIFIED

## S-02 Canonical Active
Route：GET /api/admin-browser/active
Validation：validateMfkAdminConfigEnvelope
Status：VERIFIED

## S-03 Formal Publish
Route：POST /api/admin-browser/publish
Current server已證實：Admin session、PUBLISH_CONFIG/OWNER permission、shared envelope validation、canonical publishedAt、exact retry idempotency。
Status：VERIFIED

## S-04 SMT ACK Write
Route：POST /api/admin-sync/ack
Server驗：ACK schema、known published fingerprint、exact publishedAt。
Status：VERIFIED

## S-05 SMT ACK Read
Route：GET /api/admin-sync/acks
Exact applied：canonical fingerprint + canonical publishedAt 必須同 ACK一致。
Status：VERIFIED

## S-06 Admin Doorbell
Route：GET /api/admin-sync/events
Transport：WebSocket。
Rule：Doorbell只 invalidate/refetch；唔直接變 UI truth。
Status：VERIFIED TRANSPORT

## S-07 SMT Projection Intake
Route：POST /api/projection/events
Current event families：ORDER_UPSERT、CASH_OPENING_CONFIRMED、DAY_CLOSE_RECORDED、RUNTIME_SELLABILITY_UPSERT。
Accepted後發 SMT_PROJECTION_AVAILABLE。
Status：VERIFIED

## S-08 Orders Projection
Route：GET /api/projection/orders
Status：VERIFIED

## S-09 Reports Projection
Route：GET /api/projection/reports
Current daily facts：gross、adjustment、net、orders、cash sales、refund、cash refund、opening/day-close。
Status：VERIFIED BASE REPORT

## S-10 Refund Read
Route：GET /api/admin-sync/refunds
Status：VERIFIED READ
V3 Admin只讀；current worker legacy POST不得接入 V3 transaction UI。

## S-11 Runtime Sellability Readback
Route：GET /api/admin-sync/runtime-sellability-readback
Status：VERIFIED READBACK

## S-12 Health
Route：GET /api/health
Status：VERIFIED
用途只係 backend health/source diagnostics，唔等於 Client Release Identity。

# 2. PARTIAL / GAP

## P-01 Formal Server Draft
Product需要：cross-page draft continuity、Pending Changes、changed objects、validation、impact preview。
Current source已證實 canonical active + publish，但未證實 dedicated server Draft API。
Status：PARTIAL / GAP
Decision：第一條 slice可以用 non-authoritative in-memory editing proof；完整 R1 若要求 durable/cross-session Draft，必須補 bounded server draft seam。

## P-02 Release History
worker有 published records storage，但未證實正式 version-history GET。
Status：PARTIAL / GAP

## P-03 Rollback
Product規則：Rollback = 建立新 release。
未證實 dedicated rollback endpoint。
Status：GAP

## P-04 Action Queue / Incident Truth
未證實 canonical ActionItem API。
Status：GAP

## P-05 Order Exception Aggregation
Orders projection verified；dedicated exception read model未證實。
Status：PARTIAL

## P-06 Device Health
未證實 dedicated V3 Admin device read model。
Status：GAP/PARTIAL

## P-07 OTA Governance
已有 existing SMT/Builder OTA authority；未證實完整 Admin artifact/desired/install/readback seam。
Status：PARTIAL

## P-08 Print Evidence
未證實 dedicated Admin print jobs/attempt/readback endpoint。
Status：GAP/PARTIAL

## P-09 Staff / Role / Permission CRUD
Canonical staffAuth facts存在；未證實獨立 CRUD seam。
Status：PARTIAL

## P-10 Trusted Device / Session Governance
Own session read/logout verified；全 session enumeration、cross-session revoke、trusted-device registry未證實。
Status：PARTIAL / GAP

## P-11 Product Trusted Report
未證實 dedicated trusted product report endpoint。
Status：GAP

## P-12 Channel Trusted Report
已有 provider/channel/order/report facts；未證實正式 channel metric read model。
Status：PARTIAL

## P-13 Operations Report
可由 existing facts形成部分；未證實完整 trusted operations report。
Status：PARTIAL / GAP

## P-14 Export Governance
未證實 export permission/job/result evidence seam。
Status：GAP

## P-15 Audit Read
未證實正式 Admin audit GET。
Status：GAP

## P-16 Integrations
Provider routes有局部能力；未證實統一 integration registry/read model。
Status：GAP/PARTIAL

## P-17 Effective Settings
未證實 effective value/source/override/security-floor read model。
Status：GAP

## P-18 Settlement Facts
未證實 trusted canonical settlement endpoint。
Status：GAP

## P-19 Business Day / Cash Workflow Mutation
Projection read facts存在；Admin Open/Close/Count/Handover command seam未證實。
Status：GAP/PARTIAL

## P-20 Runtime Sellability Admin Request
Runtime readback verified；Admin request temporary sold-out/restore正式 command seam需再核。
Status：PARTIAL

# 3. Explicit OUT OF ADMIN Mutation Scope

- Refund execution
- Cancel Order execution
- Payment Method Correction execution
- POS Order creation
- Payment execution
- Store Kernel fulfillment mutation
- Physical printer IP/USB binding

如果 V3 Admin出現以上 execution CTA：AUTHORITY RED。

# 4. Vertical Slice Gate Decision

第一條 Vertical Slice已可依賴 S-01 / S-02 / S-03 / S-04 / S-05 / S-06。

但落完整 Draft/Pending Changes前，P-01必須作 bounded decision：
A. 第一刀用 in-memory unsaved draft，只證明 Category/Product/Price→Publish；或
B. 先補 formal server draft seam。

完整 R1收口前，跨頁/跨 session Draft continuity如果仍係 requirement，就必須正式閉環 P-01。

# 5. Backend Work Rule

任何 GAP 要做 backend時，先列：exact seam、owner domain、request/response、version guard、permission、idempotency、UNKNOWN semantics、readback、audit/evidence、bounded allowlist、no-touch authority。

MILESTONE:
MFK_ADMIN_V3_BACKEND_SEAM_REGISTER_R1_READY
