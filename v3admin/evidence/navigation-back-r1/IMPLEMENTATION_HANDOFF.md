# MFK Admin V3｜Contextual Back Navigation R1｜Acceptance Evidence

日期：2026-10-01
狀態：PREVIEW ACCEPTANCE CANDIDATE / NO PRODUCTION CUTOVER

## Owner Issue

Mobile / tablet 深層頁面進入後，只有全域「功能」Menu，冇直接返回目前功能群組（二級 menu）嘅方法。
結果係用戶要重新：
1. 打開大 Menu
2. 再揀功能群組
3. 再揀另一個頁面

## 修正

AdminShell 加入共用 contextual back navigation：

- 所有 destination page 共用
- <=1179px 顯示
- 手機上 sticky 顯示
- 文字：`‹ 返回 {目前功能群組}`
- 點擊後直接打開目前功能群組嘅 destination list
- 唔改當前 route
- 唔重新由一級 Menu 開始
- 關閉 drawer 後仍留喺原頁
- Browser history / iPhone swipe back 繼續獨立存在

例：
- 版本／回讀確認 → `返回 發佈與版本`
- 回復版本 → `返回 發佈與版本`
- 打印狀態／異常 → `返回 打印管理`

## Test

`shell-foundation.test.tsx` 已新增三條深層 route contract：
- /admin/publish/versions
- /admin/publish/rollback
- /admin/print/exceptions

必須 render：
- aria-label="目前功能層級"
- 正確群組返回文字
- 正確目前頁標題

## Preview

本 PR 只用嚟觸發 Public UI Acceptance Preview。
Production / v2 / hostname / OTA：NO TOUCH。

MILESTONE: MFK_ADMIN_V3_CONTEXTUAL_BACK_NAV_R1_ACCEPTANCE_CANDIDATE
