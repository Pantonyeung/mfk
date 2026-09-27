# MFK Customer UI6 STORE_FULFILLMENT R1 Handoff

日期：2026-09-27  
Issue：#400  
Branch：`work/MFK/CUSTOMER-UI6-STORE-FULFILLMENT-R1`  
Base main：`c2d5b016fe3dd08d276e915ae0f0fb2301e964cf`

## Scope completed

只完成 Customer UI6：

- 等待店舖確認
- 製作中
- 稍有延誤（只在 canonical projection 明確提供 DELAYED / ETA 時顯示）
- 可取餐
- 未能接單
- 已取消

未做 UI7 完成交收。

## Authority / safety

- Customer UI 只讀 canonical Order / Fulfillment projection。
- Customer runtime port 無 Fulfillment mutation command。
- Refresh / weak-network recovery 只做 readback，唔會重新 Submit。
- READY 仍然唔等於 COMPLETED。
- DELAYED 唔會由 client elapsed timer 自行推斷。
- Customer 唔會 Accept、改 Fulfillment、標記 Ready 或 Completed。
- 無第二 Order / Fulfillment engine。

## Identity

三種身份已分開：

- 流水號 = SMT / Store Formal Order Display Number
- 取餐碼 = 電話最後 4 位
- Order ID = internal correlation only

Customer UI 不顯示實際 Order ID、UUID 或工程碼。

Projection outbox 只帶最小化 Pickup Code（last4），唔將完整 customer phone 加入 Admin Order projection。

## Projection mapping

Canonical fulfillment label → Customer UI6：

- 待處理 / 等待店舖確認 → RECEIVED
- 已接單 → ACCEPTED（Customer presentation 收斂為製作中）
- 進行中 / 製作中 → PREPARING
- 稍有延誤 → DELAYED
- 可取餐 → READY
- 未能接單 / 已拒絕 → REJECTED
- 已取消 → CANCELED
- 已完成 → COMPLETED（既有 downstream / history；UI6 不新增 UI7）

ETA 只 pass-through canonical `etaLabel` / `promisedReadyLabel`；無 canonical ETA 就顯示未提供，唔估算。

## Files changed

- `v2customer/src/components/customer-fulfillment-ui6.tsx`
- `v2customer/src/App.tsx`
- `v2customer/src/product-types.ts`
- `v2customer/src/components/customer-views.tsx`
- `v2customer/src/styles.css`
- `v2customer/test/ui6-store-fulfillment-r1.test.mjs`
- `v2admin/worker.ts`
- `v2admin/src/customer-ui6-projection.test.ts`
- `v2admin/src/customer-cloud-edge.test.ts`
- `v2local/src/runtime/projection-outbox.ts`
- `v2local/src/runtime/projection-outbox.test.ts`
- `.github/workflows/customer-ui6-store-fulfillment-r1.yml`

## Automated acceptance evidence

Green code run：

- GitHub Actions Run：`36306148806`
- Tested SHA：`caa0f771a1d17a3cc060bf669ffdaef68329fb6f`
- Customer UI6 contract：GREEN
- Customer UI5 regression：GREEN
- Full Customer tests：GREEN
- Customer build：GREEN
- Full v2local tests：GREEN
- v2local build：GREEN
- UI6 Admin canonical projection tests：GREEN
- Full Admin tests：GREEN
- Admin build：GREEN
- Wrangler dry-run：GREEN

Branch comparison at tested code SHA：

- behind main：0
- main merge：未做
- deploy：未做

## Commander acceptance focus

1. UI6 是否只投影 canonical state，無 Customer mutation authority。
2. RECEIVED → PREPARING → DELAYED(optional canonical) → READY 呈現。
3. REJECTED 同 CANCELED 分離。
4. 流水號 / 取餐碼 / Order ID identity boundary。
5. UUID / internal Order ID 無 Customer-visible value。
6. UI7 Handover / Completed 無新增操作。
7. Refresh / reconnect 無 resubmit。

## Milestone

`MFK_CUSTOMER_UI6_STORE_FULFILLMENT_R1_READY_FOR_COMMANDER_ACCEPTANCE`

NO MAIN MERGE  
NO DEPLOY
