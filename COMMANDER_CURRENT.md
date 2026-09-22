# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 13:49 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/navigation/MFK_航海圖_V1.21_Round022_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. Current control

Parent Admin completion:
#45

Current Product-detail correction:
#62

Known next RED:
#66 MFK-native Product Media R2 + D1 + Auth

State:
`MFK_ADMIN_PRODUCT_DETAIL_R2_DEPLOYED_OWNER_REVIEW_PENDING`

#44 Admin→SMT:
HOLD

#40 SMT OTA:
HOLD

Keeta live:
NOT AUTHORIZED

## 2. Owner Product-detail lock

Every formal Product must expose the complete operating information, not only name/category/price.

Required Product responsibilities now represented:
- Product name / Product Code / SKU / barcode / category / description / tags
- base price
- takeaway +$1
- other positive/negative takeaway adjustment
- Option Group bindings and settings
- every Option: Name + Option ID + Price
- required / optional / optional-force-show
- single / multi
- min / max
- quantity allowance
- option default / active
- Receipt print
- Kitchen Production print
- Packing print
- Label print
- Label logical destination(s)
- Dine-in print
- Takeaway print
- canonical Product imageRef
- R2 object / D1 media reference status
- Customer/SMM/SMT canonical image responsibility
- independent Keeta image override

## 3. UX

Product list remains summary-first:
- 20 products per page
- search / category / active filters
- one Product expands on demand

Expanded Product is bounded into collapsible sections:
1. 基本資料
2. 價格
3. 選項／加料
4. 打印
5. 圖片／媒體
6. 進階／危險操作

No return to 200+ fully-expanded cards.

## 4. Source / verification

WORK_ID:
`MFK-ADMIN-PRODUCT-DETAIL-COMPLETENESS-R2`

Branch:
`work/MFK/ADMIN-PRODUCT-DETAIL-COMPLETENESS-R2`

Final verification source:
`a038e96f29a15fc296aa00ba5719dc9c8f543478`

Verification run:
`35691896826`

Job:
`106630464142`

Result:
SUCCESS
- npm test SUCCESS
- npm run build SUCCESS
- migration firewall GREEN

Final branch workflow removed after verification.

Product source clean-landed to main.
Branch/main Product-detail source blobs match.

Deploy trigger:
`fc434fbe7d68987edfe4cc8da301892255f3cd17`

Live deploy:
`35692031072`
SUCCESS
- npm test SUCCESS
- npm run build SUCCESS
- Deploy mfk-admin SUCCESS

Canonical:
`https://admin.morefunos.com`

## 5. Pricing status

Admin pricing responsibility is now explicit for both:
- Product prices
- Option prices

Option price may be:
- positive
- zero
- negative

Option Name / Option ID / Price are validated as required.

This is configuration only.
Formal Quote authority remains the one existing Pricing authority.

## 6. Print status

Per-Product Print configuration now includes:
- Receipt
- Production
- Packing
- Label
- Dine-in
- Takeaway

Label ON:
one or more Logical Label destinations may be selected.

Admin owns Logical Printer identity/config.
Physical IP / USB remains SMT responsibility later.

## 7. Product Media status

Product Media UI / data contract is now present:
- canonical imageRef
- public/media reference
- R2 object-key field/readback state
- D1 media reference field/readback state
- independent Keeta image override
- storage/readback state
- max 8MB media contract
- browser never receives R2 credentials

Historical design oracle confirmed:
authenticated Admin Worker
→ R2 binary object
→ mediaRef
→ canonical Product imageRef
→ consumer projections.

IMPORTANT CURRENT FIRST BREAK:

Current MFK `mfk-admin` deployment is still static-assets-only and has no proven MFK-native authenticated mutation boundary, MFK R2 binding, or MFK D1 media binding.

Therefore:

`PRODUCT MEDIA REAL UPLOAD / R2 / D1 = NOT GREEN`

The UI explicitly fails closed and does NOT fake upload success.

Active backend issue:
#66

Do not reuse old Morefun-v2 D1 or R2 as current authority.

## 8. Exact NEXT

Owner first reviews live Product detail only:

`https://admin.morefunos.com/admin/catalog/products`

Open one Product → 編輯.

Verify:
- bounded sections are clean
- Option Name / ID / Price rules are correct
- Option Group settings are correct
- print flags include Receipt / Production / Packing / Label / Dine-in / Takeaway
- Label destinations are visible when Label is enabled
- Product / Option pricing presentation is correct
- Image section clearly separates canonical image from Keeta override
- media status clearly says MFK R2/D1 is not yet connected

If Product-detail UI is accepted:
BANK #62 UI/schema portion.

Then exact next technical seam is #66:
authenticated Admin mutation boundary
→ new MFK-native R2
→ new MFK-native D1 media metadata
→ real upload/readback
→ real-device proof.

Only after #66 GREEN can Product image management be called complete.

## 9. HOLD

#44 Admin→SMT automatic publish:
HOLD

#40 SMT OTA:
HOLD

Keeta live provider activation:
NOT AUTHORIZED

Manual A2 file shuttle:
SUPERSEDED / NOT PRODUCTION
