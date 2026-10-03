# MFK Admin V3｜Contextual Back Navigation R1｜Handoff

日期：2026-10-01
狀態：IMPLEMENTED / PREVIEW READBACK PENDING / NO PRODUCTION CUTOVER

## Owner Finding

流動版進入深層 destination page 後，例如：
- 發佈與版本 → 版本／回讀確認
- 發佈與版本 → 回復版本
- 打印管理 → 打印狀態／異常

原本只有全域「功能」Menu。用戶要離開目前頁時，被迫重新做：
「功能 → 功能群組 → destination」。

呢個係 navigation hierarchy 缺口，唔係單頁視覺問題。

## System Fix

`AdminShell` 新增全域共用 `ContextualSectionBack`：

- 適用全部 54 個 Admin destinations
- Desktop >1179px：唔顯示，因為 persistent secondary navigation 已存在
- Tablet / Mobile <=1179px：顯示
- Mobile：sticky
- Label：`‹ 返回 {目前功能群組}`
- 點擊直接打開目前功能群組嘅 destination list
- 唔改當前 route
- 唔重新由主要功能列表開始
- Drawer 關閉後仍停留原頁

例：
- `/admin/publish/versions` → `返回 發佈與版本`
- `/admin/publish/rollback` → `返回 發佈與版本`
- `/admin/print/exceptions` → `返回 打印管理`

Browser history / iPhone swipe-back 保留，唔當唯一返回方法。

## Test Contract

`shell-foundation.test.tsx` 新增 deep-route contract，鎖定：
- contextual hierarchy nav 必須 render
- group back label 必須正確
- current destination title 必須正確

## Files

- `v3admin/src/admin-shell.tsx`
- `v3admin/src/styles.css`
- `v3admin/src/shell-foundation.test.tsx`
- `.github/workflows/v3admin-ui-preview.yml`：增加 acceptance PR trigger path，保留 Preview-only deploy

## Preview Status

現時 GitHub 未回報今次最新 head 嘅新 `v3admin-ui-preview` workflow run，所以：
- 未宣稱 public Preview 已更新
- 未宣稱 test / typecheck / build / public readback 已對最新 head 完成
- 舊 Preview 唔可以當今次修正驗收證據

Production / v2 / hostname / OTA：NO TOUCH。

MILESTONE: MFK_ADMIN_V3_CONTEXTUAL_BACK_NAV_R1_IMPLEMENTED_PREVIEW_PENDING
