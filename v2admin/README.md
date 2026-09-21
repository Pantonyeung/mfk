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
