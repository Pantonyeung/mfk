# MFK Customer UI System R1｜Foundation Cut

WORK_ID: `MFK-CUSTOMER-UI-SYSTEM-R1`

Base: `060e3f8966a50c594521020c342497e5e3cdddaa`

Branch: `work/MFK/CUSTOMER-UI-SYSTEM-R1`

## Goal

將已鎖定 Customer UI System V1 落入 current `v2customer/**`。
本刀只建立唯一 visual foundation，唔改任何 transaction authority。

## This cut

- 新增 Customer design-token CSS layer。
- 新增 typed token module。
- Legacy CSS 暫不重寫；透過 compatibility aliases 收斂 visual authority。
- Bottom Navigation 對客名稱收斂為：
  - 首頁
  - 點單
  - 記憶罐
  - 訂單
  - 會員
- 記憶罐維持中央；internal route id 不變。
- 男／女 IP accent 只係 decorative token；Success / Warning / Error / Info 唔跟角色改色。
- 新增 deterministic UI-system regression test。

## Non-goals

- NO Customer → SMT live wiring
- NO pricing mutation
- NO order/payment/fulfillment authority change
- NO deploy
- NO second UI runtime
- NO rebuild of current Product / Cart / Submit logic

## Next implementation knife

`UI1 HOME / STOREFRONT`

順序：
Header + Store Status
→ Hero
→ Announcement
→ Top 6
→ 記憶券 / 常購清單 / 期間限定
→ fixed 5-item navigation

## Acceptance

- Build/test compatible
- Canonical five-nav vocabulary locked
- Design tokens loaded after existing stylesheet
- No business semantic mutation

MILESTONE: `MFK_CUSTOMER_UI_SYSTEM_FOUNDATION_R1`
