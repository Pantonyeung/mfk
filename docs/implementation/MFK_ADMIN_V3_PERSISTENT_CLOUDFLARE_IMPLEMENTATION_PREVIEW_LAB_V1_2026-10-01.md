# MFK Admin V3｜Persistent Cloudflare Implementation Preview Lab V1

日期：2026-10-01  
狀態：LOCKED / NON-PRODUCTION IMPLEMENTATION ENVIRONMENT  
Product Control：#601  
Implementation PR：#605

## Owner Rule

之後 Admin V3 所有 UI / product implementation，
優先直接由 Worker / 主執行 Agent 完成。

Codex 唔係預設步驟。
只有當 Codex 可以提供 Worker 本身做唔到或明顯更高價值嘅能力時先使用。

## One Persistent Preview

所有後續 Admin V3 implementation 統一落同一條 implementation branch：

`feat/MFK-V3ADMIN-ONE-SHOT-R1`

所有 `v3admin/**` push 都自動：

1. npm test
2. npm run typecheck
3. npm run build
4. deploy 到同一個 Cloudflare Pages preview project
5. public source/readback verification

Cloudflare Pages project：

`mfk-admin-v3-ui-preview`

Stable public preview：

https://mfk-admin-v3-ui-preview.pages.dev/

Current preview mode：
- build-time `VITE_MFK_V3_PREVIEW_MODE=1`
- public preview唔要求正式 Admin login
- preview fixtures必須明確標示非 Canonical
- preview不得做正式 mutation

## Hard Isolation

此 Preview Lab 不等於 Production。

禁止：
- 改 `admin.morefunos.com`
- 改 production route / hostname
- 用 Preview fixture 做 canonical truth
- 對 Production 執行未授權 mutation
- 將 Preview deploy 當 production acceptance
- 因 Preview 成功自行 merge/cutover

現有 v2 Production 繼續保持。

## Current UI

Current first implemented slice：

UI-01｜產品管理 Default List

已包括：
- full-width Product List
- search
- category filter
- status filter
- sort
- list / card switch
- responsive mobile cards
- product code read-only display
- row selection
- temporary slide-over opening hook
- Draft Bar presentation

## Current Evidence

Implementation head：

`53fe4959f5251d3b422d7da994034a54498e222b`

Cloudflare workflow：

https://github.com/Pantonyeung/mfk/actions/runs/36802637093

Result：
- test GREEN
- typecheck GREEN
- build GREEN
- Cloudflare Pages deploy GREEN
- public preview readback GREEN

## Future Working Rule

之後每完成一個 UI Slice：

`直接實作 → 同一 Branch → 同一 Public Preview → Owner 檢查 → 修正 → 下一 Slice`

唔再每一刀開新 Preview Project。
唔再每次為普通 implementation 轉交 Codex。
唔碰 Production，直到另外明確 Cutover / Production PROMOTE。

MILESTONE:
MFK_ADMIN_V3_PERSISTENT_CLOUDFLARE_IMPLEMENTATION_PREVIEW_LAB_V1_GREEN
