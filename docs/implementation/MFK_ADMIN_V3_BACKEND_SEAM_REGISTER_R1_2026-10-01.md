# MFK Admin V3｜Backend Seam Register R1

日期：2026-10-01
狀態：PLANNING / CURRENT SOURCE EVIDENCE REVIEWED
原則：有 gap 就記 gap，frontend 唔建立第二 Authority。

## 1. VERIFIED

S-01 Admin Auth
- POST /api/admin-browser/auth/challenge
- POST /api/admin-browser/auth/verify
- GET /api/admin-browser/auth/session
- POST /api/admin-browser/auth/session
Status: VERIFIED

S-02 Canonical Active
- GET /api/admin-browser/active
- shared validateMfkAdminConfigEnvelope
Status: VERIFIED

S-03 Formal Publish
- POST /api/admin-browser/publish
- session + permission
- shared validation
- canonical publishedAt
- exact retry idempotent
Status: VERIFIED

S-04 SMT ACK Write
- POST /api/admin-sync/ack
- known published fingerprint + exact publishedAt validation
Status: VERIFIED

S-05 SMT ACK Read
- GET /api/admin-sync/acks
Status: VERIFIED

S-06 Admin Doorbell
- GET /api/admin-sync/events
- WebSocket notification only
- connection建立時會送 current ADMIN_CONFIG_AVAILABLE
Status: VERIFIED TRANSPORT

S-07 SMT Projection Intake
- POST /api/projection/events
- ORDER_UPSERT
- CASH_OPENING_CONFIRMED
- DAY_CLOSE_RECORDED
- RUNTIME_SELLABILITY_UPSERT
- accepted後發 SMT_PROJECTION_AVAILABLE
Status: VERIFIED

S-08 Orders Projection
- GET /api/projection/orders
Status: VERIFIED

S-09 Reports Projection
- GET /api/projection/reports
Status: VERIFIED BASE REPORT

S-10 Refund Read
- GET /api/admin-sync/refunds
Status: VERIFIED READ
Note: legacy worker有 refund POST，但 V3 Product Brief 明確唔接 transaction mutation。

S-11 Runtime Sellability Readback
- GET /api/admin-sync/runtime-sellability-readback
Status: VERIFIED READBACK

S-12 Health
- GET /api/health
Status: VERIFIED
Note: Backend source SHA ≠ Client Release Identity。

## 2. PARTIAL / GAP

P-01 Formal Server Draft
Product需要跨頁 Draft continuity / Pending Changes / validation / impact preview。
Current source本輪未證實 dedicated server Draft API。
Status: GAP/PARTIAL

P-02 Release History
Worker有 published storage，但未證實正式 version-history GET。
Status: GAP/PARTIAL

P-03 Rollback
Rollback必須建立新 release；未證實 dedicated endpoint。
Status: GAP

P-04 Action Queue / Incident Truth
未證實 canonical ActionItem API。
Status: GAP

P-05 Order Exception Aggregation
Orders projection有；dedicated exception model未證實。
Status: PARTIAL

P-06 Device Health
Dedicated Admin device read model未證實。
Status: GAP/PARTIAL

P-07 OTA Governance
Existing OTA authority存在，但完整 Admin governance/readback seam未證實。
Status: PARTIAL

P-08 Print Evidence
Dedicated Admin print job/attempt/readback endpoint未證實。
Status: GAP/PARTIAL

P-09 Staff / Role / Permission CRUD
Canonical staffAuth facts存在；exact CRUD/draft schema要再核對。
Status: PARTIAL

P-10 Trusted Device / Cross-session Governance
Own session seam已證實；all-session/trusted-device enumerate/revoke未證實。
Status: GAP/PARTIAL

P-11 Product Trusted Report
Dedicated product metrics seam未證實。
Status: GAP

P-12 Channel Trusted Report
可組部分資料，但正式 channel metrics seam未證實。
Status: PARTIAL

P-13 Operations Report
部分 source存在；完整 trusted aggregation未證實。
Status: GAP/PARTIAL

P-14 Export Governance
Export permission/job/result evidence seam未證實。
Status: GAP

P-15 Audit Read
Dedicated immutable Admin audit GET未證實。
Status: GAP

P-16 Integrations
統一 integration registry/config/auth/health seam未證實。
Status: GAP/PARTIAL

P-17 Effective Settings
effective value/source/override/security floor read model未證實。
Status: GAP

P-18 Settlement Facts
Trusted canonical settlement endpoint未證實。
Status: GAP

P-19 Business Day / Cash Mutation
Read facts存在；Admin bounded workflow command seam未證實。
Status: GAP/PARTIAL

P-20 Runtime Sellability Admin Request
runtime readback verified；Admin request temporary soldout/restore command需再核對。
Status: PARTIAL

## 3. OUT OF ADMIN MUTATION SCOPE

- Refund execution
- Cancel Order execution
- Payment Method Correction execution
- POS Order creation
- Payment execution
- Store Kernel fulfillment mutation
- Physical printer IP/USB binding

如果 V3 Admin出現呢啲 execution CTA：
AUTHORITY RED。

## 4. Vertical Slice Gate Decision

第一條 vertical slice可依賴：
Auth + Canonical + Publish + ACK + Doorbell。

真正要先決定嘅 gap：
P-01 Formal Draft / Pending Changes。

可以分兩階段：
A. 第一刀以 non-authoritative in-memory unsaved edit state證明 Category/Product/Price → Publish；
B. 完整 R1收口前補 formal cross-page/durable Draft seam。

MILESTONE:
MFK_ADMIN_V3_BACKEND_SEAM_REGISTER_R1_READY
