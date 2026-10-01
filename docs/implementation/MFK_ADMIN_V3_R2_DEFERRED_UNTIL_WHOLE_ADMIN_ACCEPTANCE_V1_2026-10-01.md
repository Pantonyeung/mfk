# MFK Admin V3｜R2 Deferred Until Whole-Admin Acceptance｜2026-10-01

狀態：OWNER LOCKED / NON-PRODUCTION

## Owner Decision

圖片功能入口保留，但 R2 實際接通放到後面。

工作順序固定：

1. 先完整實作整個 Admin V3
2. Owner 逐頁／整體驗收
3. Owner 認收 Admin 後
4. 再逐步打通 Product Media R2
5. 最後先處理正式 Production media cutover

## Current Image UX

Product Editor 保留兩個獨立圖片入口：

- 自家／Customer 顯示圖
- Keeta／第三方平台圖

Architecture lock：

- 所有 Product image binary 最終全部入 Cloudflare R2
- Customer/self 與 Keeta image reference 分開
- Browser 不持有 R2 credential
- 不接受外部 URL 成為正式 image authority

## Current Preview Behavior

目前 persistent public Preview：

https://mfk-admin-v3-ui-preview.pages.dev/

圖片區域：
- 入口可見
- 顯示「入口已開 · R2 待接通」
- upload control fail-closed / disabled
- 唔會嘗試建立 R2 bucket
- 唔會 deploy R2 binding
- 唔會因 R2 未接通阻塞整個 Admin Preview 更新

Workflow：
- test
- typecheck
- build
- UI-only Cloudflare Pages deploy
- public source readback

## Source Kept Ready For Later

以下 R2 integration code 保留喺 implementation branch，之後認收 Admin 後直接繼續：

- v3admin/src/product-media-api.ts
- v3admin/functions/api/product-media.js
- v3admin/functions/media/products.js
- v3admin/functions/api/preview-health.js
- v3admin/wrangler.jsonc

R2 target bucket contract：
`mfk-admin-v3-product-media-preview`

Object key contract：
`product-media/{storeId}/{productId}/{surface}/{sha256}.{ext}`

surface：
- customer
- keeta

## Hard Boundary

Owner 認收 Admin 前禁止：

- R2 bucket provisioning
- Preview R2 binding activation
- Product image upload activation
- Production R2 binding
- Production product-media cutover
- admin.morefunos.com route change

MILESTONE:
MFK_ADMIN_V3_R2_DEFERRED_UNTIL_WHOLE_ADMIN_ACCEPTANCE_V1
