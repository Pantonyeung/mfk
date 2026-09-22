# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 11:24 Asia/Hong_Kong
System: MFK ONLY

> Every Commander MUST fresh-read this file before acting.
> Every Commander MUST update this file again before returning work / ending the conversation / hitting context limits.

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. Pantonyeung/mfk #22 latest controlling comment
3. Current navigation listed below
4. `HANDOFF_CURRENT.md`
5. Active issue(s)

## 1. Current navigation

`docs/navigation/MFK_航海圖_V1.15_Round016_2026-09-22.txt`

## 2. Owner priority override

Owner explicitly moved the active priority:

`SMT OTA PHYSICAL ACCEPTANCE = HOLD`

`ADMIN CONNECTION = RESUME NOW`

SMT OTA #40 remains open and preserved at:

`MFK_SMT_OTA_814_BASELINE_PERSISTENCE_CANDIDATE_PUBLISHED`

Published candidate already ready:
`runtime-candidate-mfk-d133043dfe7d`

No further SMT OTA work until Owner resumes it.

## 3. Admin current live reality

Canonical Admin:
`https://admin.morefunos.com`

Owner confirms the Admin app is reachable.

Hosting/domain:
- H2 #37 = GREEN / BANKED
- H3 #38 = GREEN / BANKED

Only live Admin deploy run:
`35677844235`
SUCCESS

Deploy source:
`d30e8dcc789806a42ea93c3670beb60270a1ee28`

Important source proof:
- A2 clean landing `4609142b9e13cd825af795bf4b90e722a26a7026`
- deploy source `d30e8d...` is 16 commits ahead of A2 landing
- deployed `GovernanceWorkspaces.tsx` contains the full A2 Publish Center UI
- compare `d30e8d...` → current main shows ZERO `v2admin/**` product diffs

Interpretation:
`LIVE ADMIN UI IS NOT STALE RELATIVE TO CURRENT v2admin SOURCE`

## 3A. Owner screenshot evidence｜Admin product page

Owner screenshot confirms live:
- `admin.morefunos.com`
- MFK Admin shell
- 菜單 → 商品資料
- `OWNER → ADMIN → SMT`
- `MFK Admin 控制面`
- `Domain adapters 尚未接駁`
- `SESSION DRAFT · NOT_WIRED`
- Product-page `Publish 未接駁` disabled as designed

This is NOT the A2 Publish Center.
It confirms the live Admin product/catalog page only.

Exact next remains:
`https://admin.morefunos.com/admin/publish`

Expected header:
`ADMIN CONNECTION A2 · HUMAN CONTROLLED`

Do not create a final A2 bundle before reading exact SMT Active Revision.

## 4. Admin connection progress

A1:
`#34 BANKED`

State:
`MFK_ADMIN_MENU_INDEX_A1_SEMANTIC_LINK_GREEN`

Proven:
Admin Menu Index Revision
→ SMT Local Menu LKG contract

A2:
`#35 IMPLEMENTATION BANKED`

State:
`MFK_ADMIN_A2_CONTROLLED_TRANSFER_IMPLEMENTATION_GREEN`

Implemented:
Admin Publish Bundle
→ human-controlled file transfer
→ SMT Local LKG apply
→ SMT Readback Receipt
→ Admin compare

Source / build:
- source `b291c895cf9ccedfc06690235fe5597bf4e2c7fa`
- source run `35670165934` SUCCESS
- landing `4609142b9e13cd825af795bf4b90e722a26a7026`
- landing run `35670256629` SUCCESS

## 5. FIRST BREAK / missing work

The missing work is NOT a missing A2 implementation.

The exact incomplete item is:

`A2 OWNER REAL CROSS-DEVICE WALKTHROUGH = PENDING`

Five required proofs still not physically banked:
1. SOURCE_INTENT
2. TRANSPORT_IDENTITY
3. TARGET_OBSERVED
4. COMPARE_RESULT
5. HUMAN_VISIBLE_READBACK

Until exact target readback returns MATCH:

`A2 OWNER ACCEPTED = NO`

## 6. Non-blocking admin debt discovered

These are real stale metadata/doc debt but NOT the current first break:

1. `v2admin/BUILD_ID` still says legacy target `morefun-v2-admin`.
2. `v2admin/README.md` still contains superseded H1 wording before the H2 section.

Actual deployment authority is correct:
`v2admin/wrangler.jsonc → name = mfk-admin`

Do not fix these before A2 acceptance unless they block evidence.

## 7. Exact NEXT

Resume A2 acceptance from the live Admin app.

Admin first:
1. open `/admin/publish`
2. confirm header = `ADMIN CONNECTION A2 · HUMAN CONTROLLED`
3. confirm the page exposes:
   - Validate
   - Impact Preview
   - Expected SMT Base Revision
   - Build / Download A2 Publish Bundle
   - Import SMT Readback Receipt
   - Human Compare Result

Do NOT create a final bundle until the exact SMT Active Revision is observed.

Then read-only target check:
SMT → More → Admin · Menu

Record:
`ACTIVE REVISION = ?`

Only after that exact base is known:
- make ONE tiny Product-name change
- Validate
- Confirm A2 Impact
- build ONE bundle
- apply SAME bundle on SMT
- download SAME readback receipt
- import receipt to Admin
- require `MATCH`

If any step fails:
STOP at first break.

## 8. A3 remains closed

Automatic network transport:

`NOT AUTHORIZED`

No:
- HTTP
- polling
- D1/KV/DO
- background worker
- new protocol

Future A3 must reuse the exact A2 bundle/readback contract.

## 9. DO NOT

- NO SMT OTA acceptance while Owner HOLD is active
- NO A3 automatic Admin→SMT transport
- NO Pricing/Modifier/Combo connection yet
- NO Keeta live wiring
- NO SMM/Customer/Owner live seams
- NO unrelated Admin cleanup before A2 first break

## 10. Current milestone

`MFK_ADMIN_A2_LIVE_UI_DEPLOYED_OWNER_CROSS_DEVICE_PENDING`

Exact NEXT:
`ADMIN /admin/publish READ-ONLY CONFIRM → SMT ACTIVE REVISION READ-ONLY CONFIRM`
