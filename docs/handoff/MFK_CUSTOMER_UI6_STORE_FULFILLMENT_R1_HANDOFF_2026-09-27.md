# MFK Customer UI6 STORE_FULFILLMENT R1 Handoff

日期：2026-09-27  
Issue：#400  
Branch：`work/MFK/CUSTOMER-UI6-STORE-FULFILLMENT-R1`  
STATUS：READY_FOR_COMMANDER_REACCEPTANCE

## CHANGES_REQUIRED correction

本輪只修 Commander 指定 3 項：

1. UI6 canonical-state fail-closed
   - `order=null` 禁止 fallback `RECEIVED`
   - unsupported stage 禁止 fallback `RECEIVED`
   - 無 canonical state 時明確分 `LOADING / EMPTY / ERROR / OFFLINE / STALE / UNKNOWN`
   - 有 last-known canonical state 時可以保留顯示，但 freshness 必須另外標示
   - canonical `COMPLETED` deep-link 離開 waiting route，返回 Orders / History；禁止顯示「等待店舖確認」

2. 專用 Workflow 已移除
   - `.github/workflows/customer-ui6-store-fulfillment-r1.yml` 已刪除
   - Final diff 無新增 Customer UI6 專用 Workflow
   - Re-acceptance 使用 repository 已存在 workflow / PR checks，無新增永久 CI path

3. Handoff evidence drift 已清理
   - 舊 pre-reacceptance SHA / Run 不再作 final evidence
   - Exact final HEAD / exact final CI 以 #400 最新 `READY_FOR_COMMANDER_REACCEPTANCE` comment 為 immutable acceptance receipt
   - 本文件所屬 branch HEAD 必須與該 receipt 的 FINAL_HEAD 一致；CI 必須係該 exact HEAD 的 checks

## Scope retained

Customer UI6 只包括：

- 等待店舖確認
- 製作中
- 稍有延誤（只在 canonical projection 明確提供 DELAYED / ETA 時顯示）
- 可取餐
- 未能接單
- 已取消

保持：

- READY ≠ COMPLETED
- NO UI7 完成交收
- Customer 無 Fulfillment mutation authority
- Refresh / reconnect 只 readback，零 resubmit
- Customer UI 不顯示 UUID / internal Order ID
- 流水號 / 取餐碼 / Order ID identity 分離
- DELAYED / ETA 只 pass-through canonical truth，client timer 不得自行推斷

## Readback / freshness contract

無 canonical Order / Fulfillment state：

- `LOADING`：讀取中；唔顯示 Fulfillment stage
- `EMPTY`：readback 未有 state；唔顯示 Fulfillment stage
- `ERROR`：讀取錯誤；無 last-known state 就唔顯示 Fulfillment stage
- `OFFLINE`：離線；無 last-known state 就唔顯示 Fulfillment stage
- `STALE`：資料過期；無 last-known state 就唔顯示 Fulfillment stage
- `UNKNOWN`：unsupported / 未確認；fail-closed，唔顯示 RECEIVED

有 last-known canonical Order 時：

- 保留該 canonical stage
- 另外顯示 freshness
- connection / browser state 永遠唔改寫 Fulfillment truth

## COMPLETED deep-link

`/orders/:orderId/waiting` 如 readback / history 已證明 canonical `COMPLETED`：

- 不 render RECEIVED
- 不 render waiting confirmation
- 不新增 UI7 action
- 轉去 Orders / History surface

## Identity

- 流水號 = SMT / Store Formal Order Display Number
- 取餐碼 = 電話最後 4 位
- Order ID = internal correlation only

Customer UI 不顯示實際 Order ID、UUID 或工程碼。

## Re-acceptance proof contract

Final acceptance 只認 #400 最新 re-acceptance receipt，並要求：

- Customer full tests + build GREEN
- UI5 regression GREEN
- v2local full tests + build GREEN
- Admin full tests + build GREEN
- Wrangler dry-run GREEN
- behind main = 0
- Final diff 無 Customer UI6 專用 Workflow
- exact CI 必須掛喺 exact FINAL_HEAD
- NO MAIN MERGE
- NO DEPLOY

## Correction files

- `v2customer/src/components/customer-fulfillment-ui6.tsx`
- `v2customer/src/App.tsx`
- `v2customer/src/styles.css`
- `v2customer/test/ui6-store-fulfillment-r1.test.mjs`
- `.github/workflows/customer-ui6-store-fulfillment-r1.yml` — DELETED
- `docs/handoff/MFK_CUSTOMER_UI6_STORE_FULFILLMENT_R1_HANDOFF_2026-09-27.md`

## Milestone

`MFK_CUSTOMER_UI6_STORE_FULFILLMENT_R1_READY_FOR_COMMANDER_REACCEPTANCE`

NO MAIN MERGE  
NO DEPLOY
