# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 14:17 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/navigation/MFK_航海圖_V1.24_Round025_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. Current control

Parent Admin completion:
#45

Current exact issue:
#76 Admin Option Set Center R2

Superseded:
#68 CLOSED / NOT_PLANNED

Parent Product detail:
#62

Known later RED:
#66 Product Media R2 + D1 + Auth

State:
`MFK_ADMIN_OPTION_SET_CENTER_R2_DEPLOYED_OWNER_REVIEW_PENDING`

#44 Admin→SMT:
HOLD

#40 SMT OTA:
HOLD

Keeta live:
NOT AUTHORIZED

## 2. Owner Option architecture lock

The reusable operator unit is an Option Set / 選項組.

Examples:

飯量
- 多飯
- 少飯
- 走飯

青瓜
- 多青瓜
- 少青瓜
- 走青瓜

No flat global Option Master as the primary operator model.

## 3. Option Set responsibility

Each Option Set owns:
- Set ID
- Set Name
- Required / Optional / Optional-force-show
- Single / Multi
- Min / Max
- Allow quantities
- Active
- ordered child Options

Each child Option owns:
- Option ID
- Name
- Price adjustment
- Active
- Order

## 4. Product link responsibility

Product links whole Option Sets.

Product detail now provides:
- explicit `加入選項`
- list of available existing Option Sets
- add whole Set
- remove linked Set
- read child Option ID / Name / Price
- Product-specific default child selection
- clear default
- deep-link to Option Center for editing master Set

Default belongs to:
`Product × Option Set × Child Option`

No global default on child Option.

## 5. SMT semantic target

Future connection semantics only:

Product linked to 青瓜
→ SMT taps 青瓜
→ child choices:
  多青瓜
  少青瓜
  走青瓜

This work does NOT open SMT connection.

## 6. Migration safety

R2 migration preserves current data where possible:
- #68 groups → Option Sets
- referenced flat Options → child Options
- orphan flat Options → disabled `待整理選項` Set
- Product links preserved
- Product-specific defaults preserved
- legacy embedded modifier groups also migrate

No intentional silent data loss.

## 7. Pricing / release governance

Pricing page:
- Product price stays Product config
- child Option price belongs to its Option Set child row
- Product link never copies Option price
- one Pricing authority remains

Immutable Admin release now includes:
- Option Set Center state
- Product Option Set links

Publish validation checks hierarchical Option Set data.

## 8. Verification / deploy

WORK_ID:
`MFK-ADMIN-OPTION-SET-CENTER-R2`

Issue:
#76

Branch:
`work/MFK/ADMIN-OPTION-SET-CENTER-R2`

Verification:
`35694910787`
SUCCESS
- npm test SUCCESS
- npm run build SUCCESS

Clean landing:
- model `c87591a7af668fee3938fed8bba3710ebcac5d86`
- UI `cad72d29e568dc5f18c3618d7dc35315207dcb03`
- release governance `1efdf4b50f27ebb39ed48936dfbe8623797b4fdf`
- capability copy `4e0ebd298dc8909eaf49b9362ef171bb80894785`
- tests `acd18532edd8539163034b4627663447f47d703d`
- styles `2389780fecfe6160e99f256f90369c2a6c3c2986`

Deploy trigger:
`18b52d38daebcd8ef88c4b8c5b9974ba5d80d587`

Live deploy:
`35695027863`
SUCCESS
- test SUCCESS
- build SUCCESS
- Deploy mfk-admin SUCCESS

Canonical:
`https://admin.morefunos.com`

## 9. Exact NEXT

ONE action only:

Owner refreshes live Admin.

First:
菜單 → 選項中心

Verify:
1. default view is a list of Option Sets, not flat Options
2. `新增選項組` is visible
3. open a Set
4. `新增子選項` is visible
5. child rows have ID / Name / Price / Active / Order

Then:
商品資料 → one Product → 編輯 → 選項

Verify:
1. `加入選項` is visible
2. existing Option Sets can be added
3. linked Set shows its child choices
4. Product can select its own default child
5. Product cannot edit the Set child master fields here

If GREEN:
BANK #76 and continue #62 review.

If RED:
STOP on exact first break.

## 10. HOLD / DO NOT

- no Admin→SMT connection
- no SMT OTA work
- no Keeta live
- #66 media backend NOT NEXT until #76 accepted
- no flat global Option Master UI
- no Product-side child Option editing
