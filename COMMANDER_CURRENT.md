# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 11:42 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest control
3. docs/navigation/MFK_航海圖_V1.16_Round017_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. Owner priority

SMT OTA physical acceptance:
HOLD

Admin connection:
ACTIVE

## 2. Admin operator Chinese UI

Owner hard requirement:
Admin is an operator product, not an engineering console.

Operator-visible UI must:
- use Traditional Chinese first
- hide engineering/protocol/internal architecture wording
- use human operational wording
- keep internal IDs/contracts/status enums inside code/tests/evidence unless explicitly needed for support

Issue:
#41

Implementation branch:
work/MFK/ADMIN-OPERATOR-CHINESE-UX-R1

Source verification:
run 35683885708
SUCCESS

Clean landing main:
4f332baa67900d33f72cd43a0dc457177c3cca80

Live deploy:
run 35684038608
SUCCESS

Deploy job proof:
- npm test SUCCESS
- npm run build SUCCESS
- Deploy mfk-admin SUCCESS

Milestone:
MFK_ADMIN_OPERATOR_CHINESE_UI_DEPLOYED_GREEN

Owner browser refresh / visual readback:
PENDING

## 3. What changed in operator UI

Removed/replaced operator-visible engineering wording including:
- NOT_WIRED / MIGRATION_ONLY
- SESSION DRAFT
- ADMIN CONNECTION A2 / HUMAN CONTROLLED
- SOURCE_INTENT / TARGET_OBSERVED
- Transport Bundle / Readback Receipt
- OWNER → ADMIN → SMT
- Domain adapters
- Validate / Impact Preview / Expected SMT Base
- Human Compare / Governance Boundary
- multiple raw internal status/read-model labels

Published flow now uses operator wording such as:
- 待發布變更
- 檢查內容
- 確認影響範圍
- 門店目前版本
- 建立並下載發布檔案
- 匯入門店回傳檔案
- 核對結果

UI guard tests were added to prevent engineering protocol copy from leaking back onto key operator routes.

## 4. Admin connection state

A1 #34:
BANKED / GREEN

A2 #35:
IMPLEMENTATION GREEN / BANKED

Owner real cross-device acceptance:
PENDING

Important newly confirmed FIRST BREAK before safe A2 publish:
ADMIN_A2_SOURCE_BASELINE_NOT_HYDRATED

Evidence:
live Admin session draft currently starts with 0 Categories / 0 Products.
A2 builds a full Menu Index revision from Admin draft.
Therefore a new Admin draft cannot safely publish over an existing SMT Menu baseline until the current SMT menu baseline is hydrated/imported into Admin or an equivalent safe baseline-loading seam exists.

Do NOT ask Owner to create a final A2 bundle from an empty Admin draft.

## 5. Exact NEXT

1. Owner refreshes admin.morefunos.com and visually confirms operator Chinese wording is live.
2. If Chinese UI readback is GREEN, bank #41.
3. Then solve ONE exact Admin A2 baseline-hydration seam:
   SMT current Active Menu baseline
   → safe Admin source draft hydration/readback
   → no product loss
4. Only after source baseline is present, resume one tiny A2 cross-device change.

## 6. A3

NOT AUTHORIZED.

No automatic Admin→SMT HTTP/polling/cloud transport yet.

## 7. SMT OTA

#40 remains HOLD.

Ready candidate remains:
runtime-candidate-mfk-d133043dfe7d

Do not advance until Owner resumes.

## 8. DO NOT
- no A2 publish from empty Admin draft
- no A3
- no SMT OTA acceptance while HOLD
- no Pricing/Modifier/Combo live connection yet
- no Keeta live
- no SMM/Customer/Owner live seams
