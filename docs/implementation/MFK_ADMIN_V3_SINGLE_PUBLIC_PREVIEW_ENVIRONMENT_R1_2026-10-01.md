# MFK Admin V3｜Single Public Preview Environment R1

日期：2026-10-01  
狀態：OWNER DIRECTIVE / CONTROLLING PREVIEW DELIVERY RULE

## Owner Rule

由而家開始，Admin V3 所有實作只使用 **一個固定、隔離、公網可檢查嘅 Preview 環境**。

固定 Preview Site：

https://mfk-admin-v3-ui-preview.pages.dev/

實作 Branch：

https://github.com/Pantonyeung/mfk/tree/feat/MFK-V3ADMIN-ONE-SHOT-R1

Implementation PR：

https://github.com/Pantonyeung/mfk/pull/605

## Delivery Model

每一個 UI / workflow slice：

實作
→ test
→ typecheck
→ build
→ deploy 去同一個固定 Preview Site
→ Owner 公網檢查
→ 修改
→ 同一 Site 更新

禁止每個 Slice 另開一個長期 Preview project。

## Production Hard Boundary

呢個 Preview 環境：

- 唔係 admin.morefunos.com
- 唔改 production hostname
- 唔改 production route
- 唔 replace v2 Admin
- 唔做 OTA
- 唔做 production cutover
- 唔用 Preview fixture 冒充 canonical truth

v2 Production 繼續獨立運行。

## Preview Data Rule

當某個 UI Slice 未需要正式 backend read/write：

可以使用清楚標示嘅 preview fixture data 去做視覺／interaction驗收。

必須明示：
- 介面示例
- 非 Canonical
- 不代表正式營運資料

一旦 Slice 進入正式 data contract：
必須接返 approved canonical API / server Draft / readback authority。

## Current Slice

UI-01｜產品管理 Default List

- full-width Product List
- no permanent right-side editor
- search
- category filter
- status filter
- sort
- list/card toggle
- responsive mobile cards
- row click → temporary drawer opening hook
- Draft Bar presentation
- product code read-only presentation

MILESTONE:
MFK_ADMIN_V3_SINGLE_PUBLIC_PREVIEW_ENVIRONMENT_R1_LOCKED


## First Verified Deployment

Public URL:

https://mfk-admin-v3-ui-preview.pages.dev/

Source SHA:

53fe4959f5251d3b422d7da994034a54498e222b

Workflow:

https://github.com/Pantonyeung/mfk/actions/runs/36802637093

Result:
- test GREEN
- typecheck GREEN
- build GREEN
- Cloudflare Pages deploy GREEN
- public readback GREEN
- production hostname untouched
- production route untouched
