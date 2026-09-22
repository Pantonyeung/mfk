# MFK CURRENT HANDOFF｜2026-09-22

Current navigation:
docs/navigation/MFK_航海圖_V1.17_Round018_2026-09-22.txt

Control:
#22

## CURRENT

SMT OTA:
HOLD

Admin:
ACTIVE

## CHINESE OPERATOR UI

#41
deployed GREEN
visual owner readback pending

## LEGACY MENU RE-ENTRY

#42

Owner-selected donor:
Pantonyeung/Morefun-v2
menu-combined-2026-09-05-v1

Imported to MFK Admin:
- 14 categories
- 203 products
- 188 active/direct-visible
- 15 inactive donor-hidden
- 188 direct prices
- exact product names and IDs
- legacy barcodes retained internally

No canonical modifier/combo bindings existed in the selected donor snapshot; none were invented.

Verification:
35684903667 SUCCESS

Live Admin deploy:
35684991125 SUCCESS

State:
MFK_ADMIN_MF01_LEGACY_MENU_REENTERED_DEPLOYED_GREEN

## EXACT NEXT

Owner confirmed legacy MF01 menu is visible.
#42 is BANKED / CLOSED.

Run A2 manual controlled transfer:

1. SMT → More → Admin · Menu → read exact ACTIVE revision.
2. Admin「待發布變更」→ set 門店目前版本 to that exact revision.
3. 檢查內容 → 確認影響範圍 → 建立並下載發布檔案.
4. Transfer SAME file to SMT and import.
5. SMT downloads readback file.
6. Import readback to Admin.
7. Require 核對結果 = 一致.

Scope:
A2 sends Menu Index only:
14 categories + 188 active products.
It does not send prices/modifiers/combos.

15 inactive donor products remain Admin-only until a future explicit rule.

After A2 MATCH:
BANK and STOP.
Pricing is a separate future seam.

A3 NOT AUTHORIZED.
