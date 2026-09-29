# MFK SMM UI FINAL Source Fidelity｜Fresh Main Handoff

日期：2026-09-29
WORK_ID：MFK-SMM-UI-FINAL-SOURCE-FIDELITY-R2
ROLE：SMM UI SOURCE-FIDELITY WORKER

## Fresh Main
MAIN_SHA：6df0f2bdccdf05792909e99ee3771811cfd66e8e

## Source
- MFK_SMM_UI_完整設計包_2026-09-26
- 04_Final_Implementation_UI_Spec = 第一權威
- 03_Stage_UI_效果圖_CURRENT = 視覺／流程參考
- 來源包只提供 Logo、兩個 IP 三視圖及 UI 參考；無 Stage7/8/9/X 專用 final artwork files。

## Fresh Compare 結果
Stage0–4：CURRENT MAIN 已有正式 implementation + regression/evidence，無發現需要重做嘅結構缺口。
Stage5：CURRENT MAIN 已有 SUBMITTING / PENDING / CONFIRMED / REJECTED / UNKNOWN 專屬 asset + UI。
Stage6：CURRENT MAIN 已有 Queue / Detail / Actions / Status / Empty + connection states；mutation 維持 SMT authority。
Stage7：STRUCTURE_SOURCE_FAITHFUL；Stage-specific provider/source artwork 仍 EXACT_ASSET_MISSING。
Stage8：STRUCTURE_SOURCE_FAITHFUL；Overview / Detail / Waiting / Clear Review 已存在；clear/action artwork 仍 EXACT_ASSET_MISSING。
Stage9：STRUCTURE_SOURCE_FAITHFUL；Final Spec 容許工具已收斂；tool icons 仍 EXACT_ASSET_MISSING。
StageX：七種狀態存在；Final dedicated state artwork 仍 EXACT_ASSET_MISSING。

## Important Fresh-Main Finding
舊 Wave2 accepted head f5c69f10c17b1635028fd8532104b17b7fd55760 已大幅落後 current main（behind 250 commits），禁止 rebase/merge 舊 branch。
Current main 已經包含 Stage8/9/X implementation，所以「Stage8/9 MISSING」假設已過期。

## Asset Gap Matrix
- Stage7：STAGE7_SOURCE_* = EXACT_ASSET_MISSING
- Stage8：STAGE8_CLEAR_ILLUSTRATION / STAGE8_ADD_ORDER_ICON / STAGE8_CHECKOUT_ICON / STAGE8_CLEAR_ICON = EXACT_ASSET_MISSING
- Stage9：STAGE9_STAFF_ICON / STAGE9_CONNECTION_ICON / STAGE9_CHANNEL_ICON / STAGE9_BUSINESS_DAY_ICON / STAGE9_CAPACITY_ICON / STAGE9_REPORTING_ICON / STAGE9_REFUND_ICON / STAGE9_DEVICE_ICON / STAGE9_DIAGNOSTICS_ICON = EXACT_ASSET_MISSING
- StageX：STAGEX_* = EXACT_ASSET_MISSING

禁止自行畫替代品牌 IP；只可由正式來源 artwork 補入。

## Capability Entry Matrix
Current Final Spec 要求之 Stage6/7/8/9 assistive entries 已存在；未 wired mutation 保持 disabled/read-only。
無新增第二 Order / Pricing / Payment / Store Kernel / Formal Order / Display Number / Sync authority。

## Screenshot Evidence
Repo 已有：
v2smm/evidence/source-fidelity-wave2/
- 440x956 stage7/stage8/stage9/stagex
- 360x780 stage7/stage8/stage9/stagex
Stage0–4 由 v2smm/test/visual-evidence.mjs 規定 440x956 + 360x780。
Stage5/6 由現有 UI/test family 保護。

## Classification
Stage0：GREEN / SOURCE-FIDELITY REGRESSION PROTECTED
Stage1：GREEN / SOURCE-FIDELITY REGRESSION PROTECTED
Stage2：GREEN / SOURCE-FIDELITY REGRESSION PROTECTED
Stage3：GREEN / SOURCE-FIDELITY REGRESSION PROTECTED
Stage4：GREEN / SOURCE-FIDELITY REGRESSION PROTECTED
Stage5：GREEN / STAGE-SPECIFIC ASSETS PRESENT
Stage6：GREEN / STAGE-SPECIFIC EMPTY ASSET PRESENT
Stage7：GREEN_STRUCTURE / EXACT_ASSET_MISSING
Stage8：GREEN_STRUCTURE / EXACT_ASSET_MISSING
Stage9：GREEN_STRUCTURE / EXACT_ASSET_MISSING
StageX：GREEN_STRUCTURE / EXACT_ASSET_MISSING

## Remaining Gaps
唯一仍然可證明嘅 Source Fidelity gap = 來源包本身冇提供 Stage7/8/9/X 專用 final artwork 檔案。
因此本輪不應亂改 code；SMALLEST_FIX = 等正式 artwork，然後只替換已預留 slot。

## Regression / CI
Fresh main 已存在完整 SMM test/build workflow及 Wave2 source-fidelity contracts。
本輪無 code mutation，所以無新 candidate CI；沿用 current-main implementation reality，不宣稱重新跑過 CI。

## Handoff
DO NOT REBUILD Stage0–9/X。
DO NOT MERGE old Wave2 branch。
NEXT SAFE ACTION：只在收到正式 Stage7/8/9/X artwork 後做 asset-only landing + 440x956/360x780 render + regression。
