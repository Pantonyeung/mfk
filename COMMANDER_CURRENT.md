# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 12:00 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest control
3. docs/navigation/MFK_航海圖_V1.17_Round018_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issues

## 1. Owner priority

SMT OTA physical acceptance:
HOLD

Admin:
ACTIVE

## 2. Admin operator Chinese UI

Issue #41.

Source verification:
35683885708 SUCCESS

Live deploy:
35684038608 SUCCESS

State:
MFK_ADMIN_OPERATOR_CHINESE_UI_DEPLOYED_GREEN

Owner browser visual confirmation:
PENDING

## 3. Owner-selected legacy Admin Menu re-entry

Issue:
#42

Owner explicitly authorized retired Morefun-v2 Admin menu as donor for this exact work.

Selected donor:
Pantonyeung/Morefun-v2
snapshot:
menu-combined-2026-09-05-v1

Exact source:
- data/menu/menu-combined-2026-09-05-v1-products.tsv
- data/menu/menu-combined-2026-09-05-v1-direct-price.tsv
- scripts/menu/build-mf01-combined-menu-import.mjs

Donor-supported facts copied:
- raw rows = 207
- donor canonical after its own removal list = 203 products
- direct-visible / active = 188
- hidden retained inactive = 15
- categories = 14
- direct prices = 188
- exact donor product names
- exact donor product IDs
- legacy barcode retained internally
- donor source ordering retained

No unsupported data was invented.

Important:
The selected donor snapshot itself contains no canonical modifier/combo bindings.
Those remain absent rather than being fabricated.

## 4. MFK Admin implementation

Seed:
v2admin/src/admin-menu-seed-mf01-v2.ts

Test:
v2admin/src/admin-menu-seed-mf01-v2.test.ts

Admin draft:
now hydrates from the imported MF01 menu instead of 0 Categories / 0 Products.

Inactive donor products:
may remain uncategorized without blocking validation.

A2 projection:
active categories/products only;
188 donor-visible products are eligible for Menu Index projection.

Branch verification:
35684903667 SUCCESS
- test GREEN
- build GREEN

Clean landing:
main

Deploy trigger:
eb4f06233b8e9ae6400caeae5880a5eacb086922

Live deploy:
35684991125 SUCCESS
- test GREEN
- build GREEN
- Deploy mfk-admin GREEN

Milestone:
MFK_ADMIN_MF01_LEGACY_MENU_REENTERED_DEPLOYED_GREEN

Owner browser visual readback:
GREEN

## 5. Exact NEXT

Owner has confirmed the imported menu is visible in live Admin.

#42:
BANKED / CLOSED

Next is ONE A2 manual controlled transfer, but exact SMT base revision MUST be read first.

Step 1:
SMT → More → Admin · Menu
read:
ACTIVE R?

Step 2:
Admin → 待發布變更
set「門店目前版本」= exact SMT Active Revision

Step 3:
檢查內容
→ 確認影響範圍
→ 建立並下載發布檔案

Step 4:
transfer SAME file to SMT
→ 匯入 Admin A2 Bundle
→ require apply/readback

Step 5:
download SMT readback file
→ import to Admin
→ 核對結果 = 一致

A2 exact scope:
- 14 active categories
- 188 active/direct-visible products
- product/category identity
- labels
- ordering
- active projection

A2 DOES NOT include:
- price
- modifier
- combo
- availability
- print rules

15 inactive donor products remain retained in Admin but are not projected.

After MATCH:
BANK A2 owner cross-device acceptance and STOP.

Next separate seam after Owner decision:
Pricing.

## 6. A3

NOT AUTHORIZED.

## 7. SMT OTA

#40 remains HOLD.

Ready candidate:
runtime-candidate-mfk-d133043dfe7d

## 8. DO NOT

- no SMT mutation from this menu import yet
- no A2 final bundle before SMT Active Revision is read
- no A3
- no SMT OTA acceptance while HOLD
- no unsupported modifier/combo reconstruction from legacy guesses
- no Keeta live
