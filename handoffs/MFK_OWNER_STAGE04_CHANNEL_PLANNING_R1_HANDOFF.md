# MFK Owner App｜OA-CHN-001 + Monthly Target / Cost Planning R1｜Handoff

日期：2026-09-27
Work：MFK_OWNER_STAGE04_CHANNEL_PLANNING_R1
Branch：work/MFK/OWNER-STAGE04-CHANNEL-PLANNING-R1
Fresh main：493f014fcf91409612f63955a0b4698ad7815e69
Tested implementation head：b46ad6305d5a4ce1c5e31a1c75caa314beee1804
狀態：READY_FOR_COMMANDER_ACCEPTANCE
禁止：Production deploy / Main merge / OA-SEL-001 / Stage05

## Source of Truth
1. MFK_Owner_App_Implementation_UI_Spec_FINAL_V1.0.md
2. MFK_Owner_Brief_FINAL_2026-09-26.md
3. 02_CURRENT_FINAL_VISUALS/
4. 99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/ 不實作

## OA-CHN-001
- Owner 只投影 canonical channel facts；冇建立第二 Channel Authority。
- Keeta read：重用現有 KEETA_RUNTIME provider readback。
- 自家平台 read：重用 Admin active config + CUSTOMER_RUNTIME channel-health。
- Health / Availability / Mode 分離。
- Keeta Pause / Resume：重用現有 REST / OPEN canonical provider command seam。
- Command flow：READ CURRENT → COMMAND → PROVIDER/CANONICAL READBACK → CONFIRMED / UNKNOWN → AUDIT。
- UNKNOWN readback-first；禁止 blind retry。
- Snooze / Busy：current repo 冇 canonical command seam，Owner UI 保持 disabled，冇假 wiring。
- Pause 不影響已成立 Orders。

## OA-PLN-001
- Route：/planning；More Hub 入口「營業目標與成本」。
- Bottom Nav 仍只有：今日 / 待處理 / 訂單 / 更多。
- Canonical planning record：MFK_OWNER_MONTHLY_PLAN_V1。
- Storage：現有 AdminSyncStore；冇新 D1 / Durable Object / Finance DB。
- Single writer：authenticated OWNER。
- Save：revision guard → canonical put → storage readback → audit。
- 預設成本：屋租 / 水 / 電 / 煤氣 / 人工 / 其他；可加自訂 line。
- plannedMonthlyMinor 與 actualToDateMinor 分離。
- Cost Coverage：PARTIAL / MANUAL_ESTIMATE；COMPLETE 預留可信完整 actual source。
- 未完整 actual 成本只顯「估算營運淨利（按已輸入成本）」，唔叫正式／會計淨利。
- Forecast 明確標示「預計 / Forecast」。

## Current Effective Sales
- Planning 只讀現有 canonical reporting projection。
- SMT projection 新增 recognizedSalesMinor 作 read projection evidence；唔改 Order authority。
- 堂食未結帳 formal open check 初始 recognizedSalesMinor=0，所以唔會用 totalMinor / estimatedOpenAmount 冒充 Current Effective Sales。
- Draft / Pending / External Pre-admission 不進正式 Sales。

## Authority
新增唯一 authority：
- Owner Management Planning Domain writer

冇新增／冇修改 writer：
- Formal Order
- Pricing
- Payment
- Fulfillment
- Print
- Staff Auth
- Channel canonical state
- Sync
- Report transaction writer

## Files
- v2admin/src/owner-channel-planning-r1.test.ts
- v2admin/worker.ts
- v2local/src/runtime/projection-outbox.ts
- v2local/src/runtime/projection-outbox.test.ts
- v2owner/OA_STAGE04_MAPPING.md
- v2owner/src/App.tsx
- v2owner/src/channel-health.tsx
- v2owner/src/cloud-runtime.ts
- v2owner/src/planning.tsx
- v2owner/src/product-types.ts
- v2owner/src/styles.css
- v2owner/test/migration.test.mjs

## Acceptance Evidence
GitHub Actions on tested implementation head b46ad6305d5a4ce1c5e31a1c75caa314beee1804:
- owner-runtime-connection-r2 #38：SUCCESS
  - Owner test PASS
  - Owner build PASS
  - Admin test PASS
  - Admin build PASS
  - Admin Wrangler dry-run PASS
- owner-hosting-r1-smoke #21：SUCCESS
  - Owner test PASS
  - Owner build PASS
  - Owner Wrangler dry-run PASS
- owner-stage03-main-landing-r1 #27：SUCCESS
- admin-canonical-readback-r1 #19：SUCCESS
- SMT Consolidation A3 R1 #20：SUCCESS
- SMT Consolidation A3B R1 #19：SUCCESS

## Stop
No production deploy.
No main merge.
No next screen.
READY_FOR_COMMANDER_ACCEPTANCE
