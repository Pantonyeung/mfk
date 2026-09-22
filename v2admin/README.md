# MFK Admin

`v2admin/` 係 MFK 獨立 Admin Control Plane。

## Current phase

`PORT_MIGRATION_ONLY`

呢個產品目前只完成 Admin 自己嘅 Surface / Workflow 搬遷，所有跨 Port Connection 都保持關閉。

## Current migration coverage

Capability registry：41

全部 41 項都有：
- MFK route
- MFK truth owner
- concrete workspace / editor / read-model surface
- explicit migration status
- no live connection

主要已搬 Surface：

- Overview / Readiness / Pending Changes
- Publish Center
- Product / Category
- Modifier / Option
- Pricing Config
- Combo
- Menu Display / Sort
- Availability / Capacity
- Business Day
- Orders / History / Exceptions
- Logical Printer / Print Templates / Product Print Rules
- Channel Policy / Mapping / Mapping Failure / Intake / Sync / Settlement
- Customer 360 / Loyalty / Coupon
- Sales / Operations / RFM
- Store Settings / Timers
- Quick Reasons
- Staff / Roles
- Announcements
- Audit
- Advanced
- Customer / Owner / Frontline presentation config

## Migration firewall

今階段：

- Live mutation: OFF
- Live read: OFF
- Network transport: OFF
- Domain Adapter: OFF
- SMT connection: OFF
- Store Kernel write: OFF
- D1 / Cloud: OFF
- Provider command: OFF

所有未接功能必須顯示：
`NOT_WIRED` / `MIGRATION_ONLY`

## Authority

Owner 決定規則。

Admin 將規則變成：

Draft
→ Validate
→ Publish
→ Active Revision

SMT 執行已發布規則。

但 Publish / Active Revision connection 目前仍然未開。

## Connection phase

只有 Owner 明確開 seam 後先可以接。

固定節奏：

`CONNECT ONE → TEST SAME PIECE → BANK → WAIT OWNER`


## Cloudflare H1 hosting

Current MFK Admin may reuse the existing Cloudflare Worker resource named `morefun-v2-admin`.

This is **resource-shell reuse only**. The old Morefun-v2 runtime is not reused.

Cloudflare reconnect settings:

- Repository: `Pantonyeung/mfk`
- Production branch: `main`
- Root directory: `v2admin`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Non-production branch builds: OFF by default

`v2admin/wrangler.jsonc` intentionally contains only static SPA assets. It must not gain D1, R2, Durable Objects, service bindings, cron triggers or SMT/Keeta API runtime as part of H1.

The separate OTA Worker `morefunos-v2-smt-ota` and its R2 bucket are outside H1 and must remain untouched.


## Cloudflare H2 — dedicated MFK account

H2 supersedes the legacy-account hosting path.

Target Worker:
`mfk-admin`

Deployment source:
`Pantonyeung/mfk`

Project root:
`v2admin`

Deployment transport:
GitHub Actions + Wrangler.

The first empty `mfk-admin` Worker should be created once in the dedicated MFK Cloudflare account. After that, the CI token should be scoped to that Worker with Editor access. This avoids granting CI product-level Admin solely to bootstrap the first Worker.

Required GitHub repository secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

H2 remains static hosting only. It must not introduce D1, R2, Durable Objects, Cron triggers, service bindings, provider runtime or SMT automatic network transport.
