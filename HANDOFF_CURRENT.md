# MFK CURRENT HANDOFF｜2026-09-22

Current navigation:
docs/navigation/MFK_航海圖_V1.22_Round023_2026-09-22.txt

Control:
#22

Parent:
#45 Admin Product Completion

Current exact issue:
#68 Admin Option Center R1

Parent Product detail:
#62

State:
MFK_ADMIN_PRODUCT_DETAIL_R2_DEPLOYED_OWNER_REVIEW_PENDING

## DEPLOYED PRODUCT DETAIL

Product list stays compact / 20 per page.

One Product expands into:
- 基本資料
- 價格
- 選項／加料
- 打印
- 圖片／媒體
- 進階／危險操作

Option:
Name + Option ID + Price required.

Group:
required / optional-force-show / optional
single / multi
min / max
quantity allowance
default / active

Print:
Receipt
Production
Packing
Label
Dine-in
Takeaway
Label logical destinations

Pricing:
Product + Option pricing present.
No second Pricing authority.

Media:
canonical imageRef + Keeta override + R2/D1 status contract present.

## PROOF

Verification:
35691896826 SUCCESS
job 106630464142

Deploy:
35692031072 SUCCESS

Canonical:
https://admin.morefunos.com

## IMPORTANT RED

Real Product media backend is NOT yet complete.

#66:
MFK-ADMIN-PRODUCT-MEDIA-R2-D1-R1

Missing:
- proven authenticated Admin mutation boundary
- NEW MFK-native R2 binding
- NEW MFK-native D1 media metadata binding
- real upload/delete/readback
- physical browser proof

Do not reuse old Morefun-v2 DB/R2.
Do not fake upload success.

## OPTION MODEL CORRECTION

Owner rejected Product-owned Option editing.

Correct:
Option Center = canonical Option Master
→ Option Group references Options
→ Product links to Groups / Options
→ Product-specific default lives on link policy

Option Master:
ID / Name / Price / Active

Group:
selection rules only

Product detail:
show links
link/unlink
set default for this Product
read Option ID/Name/Price from Option Center

No duplicated Option records.
No copied Option price.

## EXACT NEXT

Implement #68 before any media backend or connection work.

## HOLD

#44 HOLD
#40 HOLD
Keeta live NOT AUTHORIZED
