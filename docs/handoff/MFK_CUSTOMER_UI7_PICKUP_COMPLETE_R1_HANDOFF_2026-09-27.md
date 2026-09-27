# MFK Customer UI7 PICKUP_COMPLETE R1 Handoff

日期：2026-09-27  
Issue：#404  
Branch：`work/MFK/CUSTOMER-UI7-PICKUP-COMPLETE-R1`  
Base：Customer UI6 accepted/banked head `4d1489bdc1b60cf79af59acfecb44167666fca40`

## Source reviewed

- Current `main` fresh-read：`c2d5b016fe3dd08d276e915ae0f0fb2301e964cf`
- Customer UI Frontend Handoff V1
- Stage 7 formal visual：
  - `stage7_pickup_handover_complete_male_v1.png`
  - `stage7_pickup_handover_complete_female_v1.png`

## Scope

UI7 ONLY：

- 7.1 可取餐
- 7.2 到店出示資料
- 7.3 核對／交付
- 7.4 已取餐／完成
- 7.5 例外處理

Semantic lock：

`READY != ARRIVED != VERIFIED != HANDED_OVER != COMPLETED`

`Pickup Code != Display Number`

`Exception unresolved != Completed`

## Canonical authority

Customer 只投影 canonical readback：

- READY
- ARRIVED
- VERIFIED
- HANDED_OVER
- COMPLETED
- pickup exception facts
- pickup bag / meal counts
- completion time

Customer UI 無以下 mutation：

- set ARRIVED
- set VERIFIED
- set HANDED_OVER
- set COMPLETED

Realtime 只係提示；canonical readback 先係 truth。

## Arrival seam classification

`SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN`

Fresh-read current main 結果：

- Customer RuntimePort 無 arrival-notification command
- Store Kernel 無 customer-arrival command
- 現有 Admin Customer doorbell 只係現有 order/quote availability hint，唔係「我到了」通知 seam
- 禁止用現有 transaction / fulfillment authority 假扮 arrival

所以：

- UI 顯示「我到了」
- 但 current candidate 係 safe unavailable / disabled
- 不會 fake notification
- 不會 READY -> ARRIVED
- 更不會 READY -> COMPLETED

FIRST_BREAK：
`CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN`

## Exception

Canonical unresolved exception：

- CODE_MISMATCH
- MISSING_BAG
- SAME_NAME
- NO_SHOW
- OTHER

一律投影 `PICKUP_EXCEPTION`，即使其他欄位錯誤聲稱 COMPLETED 都 fail-closed，不進 history Completed。

## Completion

完成時間只使用 canonical：

- explicit `completedAt`
- 或 canonical fulfillment timeline 內 `COMPLETED` timestamp

禁止用 client clock / render time 推算 completion time。

## Visual

- Mobile-first
- formal Stage 7 five-state composition
- supplied male / female brand IP direction
- no invented product photos
- touch target >= 44px
- reduced-motion
- safe-area

## Forbidden retained

- second Fulfillment Engine
- Customer self Complete
- UUID / internal Order ID
- Stage8 History/Reorder expansion
- Seed / Reward immediate issuance
- MAIN MERGE
- DEPLOY

## Candidate files

- `v2customer/src/components/customer-pickup-ui7.tsx`
- `v2customer/src/App.tsx`
- `v2customer/src/product-types.ts`
- `v2customer/src/components/customer-views.tsx`
- `v2customer/src/styles.css`
- `v2customer/public/brand/stage7-pickup-male.svg`
- `v2customer/public/brand/stage7-pickup-female.svg`
- `v2customer/test/ui7-pickup-complete-r1.test.mjs`
- `v2admin/worker.ts`
- `v2admin/src/customer-ui7-pickup-projection.test.ts`
- `v2local/src/runtime/projection-outbox.ts`
- `v2local/src/runtime/projection-outbox.test.ts`

## Acceptance receipt

Exact FINAL_HEAD / FINAL_CI / behind-main 以 #404 最終 `READY_FOR_COMMANDER_ACCEPTANCE` comment 鎖定。

NO MAIN MERGE  
NO DEPLOY


## Final CHANGES_REQUIRED correction

Controlling review：#404 comment `5854856433`

已修：

1. UI7 EMPTY state
   - healthy connection + no canonical UI7 pickup stage => `EMPTY`
   - canonical `READY` 只由正式 Order/Fulfillment projection 讀回
   - unsupported stage => `UNKNOWN`
   - LOADING / READY / EMPTY / ERROR / OFFLINE / STALE / UNKNOWN 分開
   - deterministic EMPTY contract test 已加入

2. Stage 7 fixed bottom navigation
   - pickup/UI7 保留 Customer 固定五項 bottom nav
   - active = `orders`
   - 無第六項
   - existing `position:fixed`
   - existing `env(safe-area-inset-bottom)`
   - existing nav button `min-height:60px`（>=44px）
   - nav 只做 App view navigation；無 pickup/Fulfillment mutation

保持：

- `READY != ARRIVED != VERIFIED != HANDED_OVER != COMPLETED`
- unresolved exception != Completed
- `SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN`
- NO arrival authority
- NO Stage8
- NO Seed / Reward
- NO MAIN MERGE
- NO DEPLOY

Final exact HEAD / CI / behind-main 以 #404 最後 `READY_FOR_COMMANDER_REACCEPTANCE` receipt 為準。

Milestone candidate：

`MFK_CUSTOMER_UI7_PICKUP_COMPLETE_R1_READY_FOR_COMMANDER_REACCEPTANCE`
