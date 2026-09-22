# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 13:13 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order

1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/navigation/MFK_航海圖_V1.20_Round021_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. One-line current reality

Admin complete-product R1 remains in Owner live walkthrough.

Current parent:
#45

Current exact UX correction:
#50

State:
`MFK_ADMIN_PRODUCT_LIST_UX_DEPLOYED_OWNER_REVIEW_PENDING`

Admin→SMT automatic connection:
#44 HOLD

SMT OTA:
#40 HOLD

## 2. Owner UX standard

A formal operator page must be:
- clean by default
- summary-first
- details only when needed
- necessary warnings visible
- non-essential fields hidden until edit
- bounded in page length
- mobile usable
- no 200+ fully-expanded editor cards

This is now part of the Admin product-completeness acceptance standard.

## 3. Exact work completed

WORK_ID:
`MFK-ADMIN-PRODUCT-LIST-UX-R1`

Issue:
#50

Branch:
`work/MFK/ADMIN-PRODUCT-LIST-UX-R1`

Source verification:
`35689711947`
SUCCESS
- npm test SUCCESS
- npm run build SUCCESS

Clean landing:
- CatalogWorkspaces `43f373a23198942837e537623e578584bbe52ff8`
- catalog test `0ade0b1ede925abfdb310db1031e78cd7c7a2139`
- styles `41bcdcd06c6b0f5bbc196baad96b3101f5be2f8c`

Deploy trigger:
`df5feb12d0245ba74ff7e574f5c693228e9b0496`

Live deploy:
`35689795493`
SUCCESS

Canonical:
`https://admin.morefunos.com`

## 4. Product page UX now

Default 商品資料 view:
- max 20 product summaries per page
- search by name / product code / barcode / SKU
- category filter
- active / inactive filter
- current filtered count
- page X / Y
- compact summary shows:
  - product name
  - product code / barcode
  - category
  - price or missing-price warning
  - active state
  - modifier group count

Detailed fields are hidden by default.

Operator presses `編輯` for one product:
- only that product detail expands
- name
- product code
- short name
- SKU
- category
- base price
- barcode
- image ref
- description
- tags
- takeaway +$1
- other takeaway adjustment
- modifier binding
- active / inactive
- delete action

Pagination:
20 items per page.

Mobile:
summary-first two-column compact layout with one edit control.

## 5. Exact NEXT

ONE next action only:

Owner refreshes:
`https://admin.morefunos.com/admin/catalog/products`

Acceptance:
1. default page is compact, not 203 expanded cards
2. first page shows no more than 20 summaries
3. search / category / status filters are usable
4. press one `編輯` and only that product detail expands
5. mobile page remains clean and readable
6. pagination works

If accepted:
BANK #50 and continue #45 walkthrough to the next Admin page.

If not accepted:
STOP on Product page and fix the exact visual/interaction break.

## 6. HOLD

#44 Admin→SMT:
HOLD

#40 SMT OTA:
HOLD

Keeta live:
NOT AUTHORIZED

SMM / Customer / Owner live:
NOT AUTHORIZED

Manual A2 JSON shuttle:
SUPERSEDED / NOT PRODUCTION
