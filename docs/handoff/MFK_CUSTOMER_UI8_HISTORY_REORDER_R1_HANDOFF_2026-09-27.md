# MFK Customer UI8 HISTORY_REORDER R1 Handoff

日期：2026-09-27  
Issue：#408  
Branch：`work/MFK/CUSTOMER-UI8-HISTORY-REORDER-R1`  
Base：Customer UI7 accepted/banked head `421e4c0db7a2ef5e13b508c1db957fab88d2f222`

## Source

- Customer UI Package
- Product Brief V1.1 FINAL
- Frontend Handoff V1
- `stage8_order_history_reorder_male_v1.png`
- `stage8_order_history_reorder_female_v1.png`

## Core

`Historical Order = READ_ONLY`

`Reorder != Reopen Old Order`

正式流程：

`Past Order → Copy Intent → New Cart → Current Validation → Local Repair → Final Review → normal UI4 / UI5 Checkout + Submit`

Stage 8：

- 8.1 訂單列表
- 8.2 歷史訂單詳情
- 8.3 Copy Intent
- 8.4 局部 Repair
- 8.5 Final Review

## Implemented contract

### Order list

固定三個篩選：

- 進行中
- 已完成
- 全部

保持固定五項 Customer bottom nav，Orders active。

### Historical detail

歷史訂單只顯示 canonical historical snapshot：

- completion time
- Display Number
- Pickup Code
- historical item snapshot
- historical price display

`Pickup Code != Display Number`

Customer UI 不顯示 UUID / internal Order ID。

### Copy Intent

正式 Order identity 不複製。

Reorder Intent 只保留：

- Product intent
- Option / Modifier intent
- Variation intent
- Combo intent
- quantity
- free note

明確排除：

- old Formal Order identity
- old cart line identity
- old price as transaction truth
- payment evidence
- payment / tender truth
- fulfillment truth
- coupon eligibility / redemption

每次 Reorder 建立 fresh cart line identity。

### Current Validation

New Cart 只按 current menu truth 建立：

- current Product existence
- current Sellability
- current Required selections
- current Option availability
- current Combo binding
- current Combo child selection
- current Published Price

Historical price 只以獨立 history baseline 保留作 compare；不進 Copy Intent。

如 historical price != current price，該 Line 明確進 Repair，Customer 要確認 current price。

### Local Repair

只修 affected Line。

其他 Line 保留。

Affected Line 可：

- 接受目前價格／資料
- 編輯該 Line
- 移除該 Line

目前 unavailable Product 禁止經 repair 重新加入。

### Final Review

Final Review 只認：

- current cart
- current catalog
- current quote
- quote freshness = CURRENT
- zero unresolved Line attention

完成 Stage 8 後只會返回正常 Memory Jar，再經：

`UI4 Checkout → UI5 Submit`

Stage 8 本身：

- 不 commit Order
- 不 reopen old Order
- 不 bypass UI4/UI5

## Saved Template seam

Current main fresh-read 無 Saved Order Template mutation seam。

所以「設為常用訂單」只可以 safe-unavailable，禁止 fake success。

`SAVED_TEMPLATE_SEAM_CLASSIFICATION = SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_SAVED_ORDER_TEMPLATE_MUTATION_SEAM_MISSING_IN_CURRENT_MAIN`

## Forbidden retained

- reopen old Order
- mutate Historical Order
- copy Formal Order identity
- copy old payment evidence
- copy old fulfillment
- use old price as current price
- use old sellability as current truth
- reuse old Coupon eligibility / redemption
- Stage8 direct Order commit
- bypass UI4 / UI5
- Stage9
- Seed / Reward mutation
- MAIN MERGE
- DEPLOY

## Candidate files

Exact Stage8 delta from UI7 accepted base includes:

- `contracts/customer-cloud-v1.ts`
- `v2local/src/runtime/customer-cloud-intake.ts`
- `v2local/src/runtime/customer-cloud-intake.test.ts`
- `v2local/src/runtime/local-runtime.ts`
- `v2local/src/runtime/projection-outbox.ts`
- `v2local/src/runtime/projection-outbox.test.ts`
- `v2admin/worker.ts`
- `v2admin/src/customer-ui8-history-projection.test.ts`
- `v2customer/src/product-types.ts`
- `v2customer/src/reorder.ts`
- `v2customer/src/components/customer-history-ui8.tsx`
- `v2customer/src/App.tsx`
- `v2customer/src/styles.css`
- `v2customer/public/brand/stage8-history-male.svg`
- `v2customer/public/brand/stage8-history-female.svg`
- `v2customer/test/ui8-history-reorder-r1.test.mjs`

## Acceptance receipt

Exact FINAL_HEAD / FINAL_CI / BEHIND_MAIN 以 #408 最終 `READY_FOR_COMMANDER_ACCEPTANCE` comment 為準。

Milestone candidate：

`MFK_CUSTOMER_UI8_HISTORY_REORDER_R1_READY_FOR_COMMANDER_ACCEPTANCE`

NO MAIN MERGE  
NO DEPLOY  
NO STAGE 9


## Final CHANGES_REQUIRED correction

Controlling review：#408 comment `5855641400`

### 1. Reorder freshness fail-closed

History remains readable while connection is OFFLINE / STALE / UNKNOWN.

Starting Reorder now requires all three:

- `browserOnline === true`
- `connection === 'READY'`
- current `menu` exists

Otherwise：

- 「再來一單」disabled / unavailable
- human-safe explanation shown
- read-only Refresh available
- no New Cart creation

If freshness is lost after entering COPY / REPAIR / REVIEW：

- existing draft cart remains persisted
- no draft deletion
- no old Order reopen
- no continued claim that current validation is complete
- progression is blocked behind current-truth resync
- reconnect + READY resumes validation against current menu / current quote

Final Review ready gate now requires：

- fresh browser connection
- `connection === READY`
- current menu present
- `quote.freshness === CURRENT`
- zero unresolved line attention

A locally CURRENT quote over last-known menu is not sufficient while connection is stale/offline.

### 2. Customer-safe Saved Template copy

Exact diagnostic classification remains:

`SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_SAVED_ORDER_TEMPLATE_MUTATION_SEAM_MISSING_IN_CURRENT_MAIN`

It remains in source / tests / handoff / diagnostics.

Normal Customer UI no longer renders that raw engineering value.

Customer-visible copy：

「常用訂單功能尚未開放」

Disabled「設為常用訂單」remains.

## Final re-acceptance contract

- OFFLINE history readable, Reorder start blocked
- STALE Reorder start blocked
- UNKNOWN Reorder start blocked
- READY + current menu allows normal Reorder start
- freshness loss during REPAIR preserves draft and blocks completion
- freshness loss during REVIEW blocks ready / Memory Jar continuation
- reconnect READY resumes current validation
- raw FIRST_BREAK not rendered to Customer
- UI7 regression remains GREEN
- Full Customer / Admin / v2local verification required on exact final head
- fresh main behind = 0

Exact FINAL_HEAD / FINAL_CI / BEHIND_MAIN 以 #408 最終 `READY_FOR_COMMANDER_REACCEPTANCE` receipt 為準。

Milestone candidate：

`MFK_CUSTOMER_UI8_HISTORY_REORDER_R1_READY_FOR_COMMANDER_REACCEPTANCE`

NO MAIN MERGE  
NO DEPLOY  
NO STAGE 9
