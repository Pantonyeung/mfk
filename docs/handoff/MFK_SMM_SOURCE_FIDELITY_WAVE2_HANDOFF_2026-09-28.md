# MFK SMM FINAL Source Fidelity Wave 2 Handoff

日期：2026-09-28  
WORK_ID：MFK-SMM-SOURCE-FIDELITY-W2-R1  
MODE：SOURCE FIDELITY / NO MAIN MERGE / NO DEPLOY

## Authority

- 起始 Authoritative Main：`2404a068f0306c6d1aa4f641f98504614fac2236`
- Source Reality：GitHub #421 / Final Audit `5857244000`
- Asset Policy：`5860925148`
- 唯一 UI Source：`MFK_SMM_UI_完整設計包_2026-09-26`
  - `03_Stage_UI_效果圖_CURRENT`
  - `04_Final_Implementation_UI_Spec`

## Result

- Stage 7：STRUCTURE_SOURCE_FAITHFUL；source/provider final icon artwork = FINAL_ART_PENDING。
- Stage 8：由 PARTIAL 收斂到 FINAL Source structure；Table Overview / Detail / Waiting / Clear Review 已落地。
- Stage 9：由 LEGACY_NOT_FINAL 收斂到 FINAL Source structure；只保留 FINAL Spec 容許嘅前線店務工具，舊 Sellability / Print mutation UI 不再喺 Stage 9 暴露。
- Stage X：LOADING / EMPTY / OFFLINE / STALE / PARTIAL / UNKNOWN / ERROR 七種狀態統一 presentation；UNKNOWN 維持 readback-first。
- Stage 0–6：未重做；由 regression 保護。

## Authority Hard Lock

- FULFILLMENT_COMMAND = NOT_WIRED
- CANCEL_COMMAND = NOT_WIRED
- Search Phone = CANONICAL_PERMITTED_ONLY
- 無新增 Dine-in mutation authority
- 無新增 Sellability / Print mutation authority
- 無改 Staff Auth / LAN / Menu / Pricing / Cart / Tender / Submission Identity / Formal Order Authority / Fulfillment Authority

## Final Candidate Validation

Existing workflows reused；無新增 one-off workflow。

Exact candidate source tree validation：
- Run `36368211666` = SUCCESS
  - SMM = SUCCESS
  - v2local = SUCCESS
  - Full SMM：148 tests PASS / 0 fail
  - SMM build = PASS
  - Wrangler dry-run = PASS
  - v2local tests/build = PASS
- Run `36368239086` = SUCCESS
  - SMM = SUCCESS
  - SMT / v2local = SUCCESS
  - Customer = SUCCESS
  - Admin = SUCCESS
  - Admin Wrangler dry-run = PASS
- Run `36368242368` = SUCCESS
  - Owner = SUCCESS
  - Admin = SUCCESS
  - Admin Wrangler dry-run = PASS

Current main parent：`29901b86d18b06d4a19371fe3f3a6b91d8682a57`
Candidate branch：`work/MFK/SMM-SOURCE-FIDELITY-W2-R1`
BEHIND_MAIN：0

## Visual Evidence

`v2smm/evidence/source-fidelity-wave2/`

Exact required viewports：
- `440x956/stage7.png`
- `440x956/stage8.png`
- `440x956/stage9.png`
- `440x956/stagex.png`
- `360x780/stage7.png`
- `360x780/stage8.png`
- `360x780/stage9.png`
- `360x780/stagex.png`

Manifest：
- `v2smm/evidence/source-fidelity-wave2/manifest.json`
- CI render run：`36368063636`
- CJK font proof：`fonts-noto-cjk + Noto Sans CJK TC fallback`

## FINAL_ART_PENDING slots

- Stage7 source/provider icon artwork：`STAGE7_SOURCE_*`
- Stage8：`STAGE8_CLEAR_ILLUSTRATION` / `STAGE8_ADD_ORDER_ICON` / `STAGE8_CHECKOUT_ICON` / `STAGE8_CLEAR_ICON`
- Stage9：`STAGE9_STAFF_ICON` / `STAGE9_CONNECTION_ICON` / `STAGE9_CHANNEL_ICON` / `STAGE9_BUSINESS_DAY_ICON` / `STAGE9_CAPACITY_ICON` / `STAGE9_REPORTING_ICON` / `STAGE9_REFUND_ICON` / `STAGE9_DEVICE_ICON` / `STAGE9_DIAGNOSTICS_ICON`
- StageX：`STAGEX_*`

以上 slot 按 Owner Asset Fidelity Policy 保留；禁止手畫 replacement。後續只可換已批准 artwork，不改 layout / authority。

## Handoff

Commander 驗收只需對：
1. GitHub #421 source-reality baseline；
2. CURRENT screenshots；
3. 上述兩個 exact viewport evidence；
4. authority hard locks。

NO MAIN MERGE。NO DEPLOY。
