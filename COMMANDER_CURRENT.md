# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 11:58 Asia/Hong_Kong
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
PENDING

## 5. Exact NEXT

Owner refreshes:
https://admin.morefunos.com

First verify:
菜單 → 商品分類
should show 14 categories.

Then:
菜單 → 商品資料
should show 203 products.

Expected:
- 188 active
- 15 inactive retained
- direct prices present on the 188 donor-visible products

Do NOT publish to SMT yet.

After Owner visual readback:
1. bank #41 Chinese UI if confirmed
2. bank #42 menu re-entry if counts/content confirmed
3. read SMT exact Active Revision
4. only then resume one A2 cross-device change

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
