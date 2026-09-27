# MFK Owner App｜OA-CHN-001 + OA-PLN-001｜Commander Acceptance Handoff

STATUS：READY_FOR_COMMANDER_ACCEPTANCE

Branch：work/MFK/OWNER-OA-CHN-PLN-R1
Base：493f014fcf91409612f63955a0b4698ad7815e69
Mode：NO MAIN MERGE / NO DEPLOY

## OA-CHN-001
Owner 顯示接受新單、Desired、Observed、Health、Mode、Cause、Freshness、Last Command、Readback。
Keeta 讀現有 Keeta Runtime OAuth / webhook / provider store readback。
Customer 讀現有 Customer Runtime channel-health。
Store open、Channel accepting orders、Health 分開，不互相代替。
Owner 暫不取得渠道 mutation authority；availableActions 為空，避免假成功／第二渠道 authority。
UI 預留 Pause / Resume / Snooze / Busy，但只有 runtime 明確提供 action 且 Owner FRESH 時先可按。

## OA-PLN-001
Target：Owner 本機非權威 planning input。
成本：屋租／水／電／煤氣／人工／其他。
每項分計劃成本與實際至今成本。
顯示：MTD、尚欠、達標率、每日所需、預計達標時間。
淨利：MTD Current Effective Sales 減已輸入實際至今成本。
成本未完整時明確標示「估算營運淨利（按已輸入成本）」；不冒充正式會計淨利。

## Authority Guard
唯一銷售來源：OwnerReadModelSnapshot.reports 中 metricKind = CURRENT_EFFECTIVE_SALES。

Owner Planning 禁止：
- 從 Order list 重算 sales
- 從 line items 重算 pricing
- 建第二 reporting authority
- 將 planned cost 當 actual cost
- 將估算淨利當正式會計結果

Admin canonical report projection 將既有 canonical projectionReports().netMinor 明確投影為：
- metricKind = CURRENT_EFFECTIVE_SALES
- currentEffectiveSalesMinor
- metricVersion = MFK_CURRENT_EFFECTIVE_SALES_V1

## Main Drift
開工時 main：493f014fcf91409612f63955a0b4698ad7815e69
完成前 fresh-read main：cd91df0ae18798c3d002aec087b564b787a7daa0
Commander 驗收／landing 前必須重新做 current-main drift review。今 branch 未 merge main。

## Acceptance
1. Keeta provider PAUSED + OAuth healthy 時，Health 可以 HEALTHY，但 acceptingOrders 必須 false。
2. Customer recent SMT pull 只代表 Customer runtime reachability；不得代替其他平台 health。
3. Channel action 未有正式 mutation seam 時全部 disabled。
4. MTD 只加總當月 CURRENT_EFFECTIVE_SALES。
5. gross / order display amount / legacy report 不得進 MTD。
6. Target、成本修改只寫 Owner local planning storage。
7. 成本缺項時淨利必須標示 partial estimate。
8. 無 canonical Current Effective Sales 時不得自行重算 MTD／尚欠／每日所需。
9. Stage 01–03 + Owner Runtime regression 必須保持 GREEN。
10. NO MAIN MERGE / NO DEPLOY。

## Test Coverage Added
Admin Owner projection Current Effective Sales metric contract。
Admin Owner channel projection Keeta + Customer integration。
Channel health 與 acceptingOrders 分離。
Planning MTD / remaining / attainment / daily-needed。
Actual-to-date cost vs planned cost。
Missing cost partial-profit label。
No canonical metric → no fabricated MTD。

## Stop State
READY_FOR_COMMANDER_ACCEPTANCE
