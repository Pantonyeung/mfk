# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 14:10 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/navigation/MFK_航海圖_V1.23_Round024_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. Current control

Parent Admin completion:
#45

Current exact issue:
#68 Admin Option Center R1

Parent Product detail:
#62

Known later RED:
#66 Product Media R2 + D1 + Auth

State:
`MFK_ADMIN_OPTION_CENTER_DEPLOYED_OWNER_REVIEW_PENDING`

#44 Admin→SMT:
HOLD

#40 SMT OTA:
HOLD

Keeta live:
NOT AUTHORIZED

## 2. Owner Option architecture lock

Correct normalized model is now implemented.

### Option Center = canonical Option Master

Each Option exists once:
- internal identity
- Option ID
- Name
- Price adjustment
- Active / inactive

No Product-specific duplicate Option record.

### Option Group

Group references existing Option identities.

Group owns:
- Group ID / Name
- Option membership
- Required / Optional / Optional-force-show
- Single / Multi
- Min / Max
- Allow quantities
- Active

Group does NOT copy Option name / price.

### Product Link

Product detail:
- links / unlinks existing Option Groups
- may include / exclude existing Options in that linked group for this Product
- reads Option ID / Name / Price from Option Center
- does NOT edit Option Master data
- links to Option Center for master edits

### Product-specific Default

Default belongs to:
`Product × Option Group × Option`

NOT global Option Master.

Same canonical Option can be default for Product A and not Product B.

Single-select Group:
max one Product default.

## 3. Legacy conversion

Existing embedded modifier data is normalized on first Option Center use:
- dedupe by Option code where possible
- preserve group membership
- preserve Product link
- legacy default becomes Product-specific link default

No intentional silent data loss.

## 4. Release / pricing governance

Immutable Admin release now includes:
- Option Master
- Option Groups
- Product Option Links

Publish validation now checks Option Center.

Pricing page:
- Product price remains Product config
- Option price reads/writes Option Master
- no copied per-Product Option price
- no second Pricing engine

## 5. Verification / deploy

WORK_ID:
`MFK-ADMIN-OPTION-CENTER-R1`

Branch:
`work/MFK/ADMIN-OPTION-CENTER-R1`

Source verification:
`35693400570`
SUCCESS
- npm test SUCCESS
- npm run build SUCCESS

Clean landing:
- admin-option-center `44162e315991a20d0f0f42c69232cc3c04edc914`
- CatalogWorkspaces `433ba66774b0b68cd91e069e69e941e11ce6c00c`
- GovernanceWorkspaces `d781f634874b5ce40845b998aee8d3bbe43230e2`
- admin-capabilities `ebee5b5944bdf3fd2a7b44469ecd4bfa6b96a214`
- tests `a526cc7111de5f35652303cf2e28c2b12ddf5c86`
- styles `1893195cd96eee22c93820db9d46a10e3986645d`

Main / deploy trigger:
`e6adc98030fc2ab2a81a2860b9a78cfe68a56105`

Live deploy:
`35693511574`
SUCCESS
- test SUCCESS
- build SUCCESS
- Deploy mfk-admin SUCCESS

Canonical:
`https://admin.morefunos.com`

## 6. Exact NEXT

ONE action only:

Owner reviews live Admin:

1. 菜單 → 選項中心
2. create / inspect Option Master
3. create / inspect Option Group
4. 商品資料 → one Product → 編輯 → 選項

Acceptance:
- Option created once
- Group references existing Option
- Product only links existing Group / Option
- Product detail cannot edit canonical Option Name / ID / Price
- Product can set its own default
- another Product can set a different default for the same Option Group

If GREEN:
BANK #68 and continue remaining #62 Admin Product-detail review.

If RED:
STOP on exact Option Center UX/model break.

## 7. Known later RED

#66 Product Media backend remains NOT GREEN:
- Admin auth mutation boundary absent
- MFK-native R2 not proven
- MFK-native D1 media metadata not proven

Do NOT start #66 until #68 Owner review is GREEN.

## 8. HOLD / DO NOT

- no Admin→SMT connection
- no SMT OTA work
- no Keeta live
- no old Morefun-v2 D1/R2 authority reuse
- no duplicate Option records per Product
- no Product-owned Option price
- no global defaultSelected on Option Master
