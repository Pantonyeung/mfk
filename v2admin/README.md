# MFK Admin

`v2admin/` 係 MFK Admin Control Plane。

## Current phase

`ADMIN_PRODUCT + ADMIN→SMT_AUTO_SYNC`

Owner 已明確開啟 Admin→SMT 連線。

正式操作：

`Edit → Save → Validate → Active Revision → Auto Canonical Publish → SMT Auto Fetch → Local LKG → ACK/Readback`

冇第二個 Publish。
冇 Menu 手動發布。
冇 SMT 匯入／安裝／確認。

## Current sync scope

每個成功 Admin Save 會發布完整 active snapshot，包括：

- Category / Product / Price
- Option Set / child Option / Product defaults
- Combo / Pool
- Availability / Capacity
- Business Day
- Logical Printer / Print Templates / Product Print Rules
- Product Media references
- Store Settings
- Quick Reasons
- Staff / permission configuration
- Channel policy / mappings
- Presentation
- Inventory Lite
- Loyalty / Coupons / Announcements

SMT 將完整 snapshot 保存成一個 atomic Local LKG。
核心點餐 projection 直接使用 Admin 商品、價格、售罄、Option Set 同 Combo。

## Authority boundary

Owner 決定規則。
Admin 係唯一設定 Control Plane。
SMT 只執行已接收設定。

仍然禁止 Admin 成為：
- Store Kernel writer
- Order / Payment authority
- physical printer binding authority
- provider live command authority

SMT 離線：
- 繼續使用 Local LKG
- Order / Checkout / Payment / Local Commit 唔受阻
- 網絡恢復後自動追最新 Admin revision

Realtime 只係 doorbell。
正式資料永遠重新 GET canonical active snapshot。

## Cloudflare H2

Target Worker:
`mfk-admin`

同一 Worker 同時提供：
- Admin SPA assets
- `/api/admin-sync/*` canonical config transport

Canonical config state 使用 dedicated Durable Object binding：
`ADMIN_SYNC`

呢個 runtime 只負責 Admin configuration distribution / ACK。
唔會承擔交易真相或 Store Kernel。

Required GitHub repository secrets remain:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Security

Publish mutation：
- same-origin only
- first legitimate Admin browser automatically enrols a random 256-bit publisher key
- Durable Object stores only SHA-256 key hash
- subsequent publish requires same publisher key
- cross-origin mutation fails closed

SMT read / doorbell / ACK 係 configuration distribution seam，唔係 transaction command seam。
