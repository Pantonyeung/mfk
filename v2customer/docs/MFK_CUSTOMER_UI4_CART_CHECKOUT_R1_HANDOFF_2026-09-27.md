# MFK Customer App｜UI4 CART_CHECKOUT R1｜Handoff

STATUS:
READY_FOR_COMMANDER_ACCEPTANCE

WORK_ID:
MFK-CUSTOMER-UI4-CART-CHECKOUT-R1

BRANCH:
work/MFK/CUSTOMER-UI4-CART-CHECKOUT-R1

FRESH MAIN:
cd91df0ae18798c3d002aec087b564b787a7daa0

PRE-HANDOFF GREEN HEAD:
c7d7310aabe87f1b02bc490f481a6700fb1f40d2

FRESH MAIN BEHIND:
0

ISSUE:
#385

## COMPLETED

Canonical UI4 routes:
- /memory-jar
- /checkout/contact
- /checkout/payment
- /checkout/review

Memory Jar:
- Product
- Variation
- Modifier / Option summary
- Combo name + Combo child summary
- Qty
- Line total
- Edit
- Remove
- Line Attention / Repair
- same-line Edit reopens existing UI3 Product Detail
- existing selection / Combo / variation / qty / note restored
- SAME lineId preserved on edit
- remove / repair are line-scoped only
- no whole-cart wipe

Checkout:
1. 確認商品
2. 聯絡與取餐
3. 付款
4. 提交前確認

Step 4 is review / local confirmation UI only.
No UI5 Submit / Waiting surface is connected by UI4.

Contact:
- 稱呼
- 電話
- Pickup Code = phone last 4
- Pickup Code copy explicitly separates it from 流水號 / 備用參考碼 / 訂單識別
- no UUID / internal code is rendered by UI4

Payment:
- PAY_AT_STORE
- ELECTRONIC
- electronic methods and QR consume current Admin-published paymentChannels
- missing QR fails closed; no fake QR
- screenshot remains payment evidence only
- submitted copy =「已提交付款憑證」
- UI states that SMT / staff still performs payment verification
- cart mutation invalidates old payment evidence
- persistence continues stripping paymentEvidence from durable checkout workspace

Requote / Repair:
- entering Contact and Review refreshes current canonical projection
- quotePublishedCart + publishedCartRepairs reused
- Material change is visible
- Old → New shown where both published values exist
- affected-line repair only
- no silent price update
- no invented price
- SMT remains final authoritative revalidation

Coupon:
DEFERRED.
Fresh current repo search found no canonical Eligible Coupon checkout source.
No Coupon authority / discount engine was introduced.

## PRESERVED

- UI2 Browse
- UI3 Configure
- canonical Combo
- CustomerCartLine.combo
- local persistence
- existing submissionId / idempotency semantics
- existing payment evidence upload semantics
- five-nav
- central 記憶罐 navigation
- TRUE EMPTY product media
- touch target >=44
- Reduced Motion
- SMT / Store Kernel authority

## ACCEPTANCE EVIDENCE

GitHub Actions:
RUN 36298865661 = SUCCESS

Customer:
- UI4 Cart Checkout contract: 10/10 PASS
- UI3 Configure regression: 9/9 PASS
- Combo Ordering regression: 10/10 PASS
- UI2 Browse regression: 13/13 PASS
- Combo projection regression: 5/5 PASS
- Full Customer suite: 82/82 PASS
- Customer build: PASS

v2local:
- customer-cloud-intake / Customer Combo / SMT Combo revalidation: PASS
- v2local build: PASS

## STALE TEST CONTRACTS UPDATED

Three historical presentation assertions were superseded by the explicitly locked UI4 contract:
- R4 old guided checkout marker → canonical UI4 4-step checkout
- R2 old「前往最後確認」cart label →「聯絡與取餐」
- historical payment-evidence invalidation copy → explicit UI4 invalidation copy

No product authority changed by these test updates.

## FILES CHANGED

- .github/workflows/customer-ui4-cart-checkout-r1.yml
- v2customer/src/App.tsx
- v2customer/src/components/customer-checkout-ui4.tsx
- v2customer/src/components/customer-views.tsx
- v2customer/src/styles.css
- v2customer/test/customer-experience-r4.test.mjs
- v2customer/test/donor-fusion-r2.test.mjs
- v2customer/test/migration.test.mjs
- v2customer/test/ui4-cart-checkout-r1.test.mjs
- v2customer/docs/MFK_CUSTOMER_UI4_CART_CHECKOUT_R1_HANDOFF_2026-09-27.md

## LOCKS

AUTHORITY CHANGE = NONE

NO UI5 SUBMIT_WAIT
NO NEW SUBMIT SEMANTICS
NO ORDER COMMIT CHANGE
NO SMT AUTHORITY CHANGE
NO COUPON ENGINE
NO SECOND PRICING ENGINE
NO SECOND PAYMENT ENGINE
NO SECOND ORDER ENGINE
NO MAIN MERGE
NO PRODUCTION DEPLOY

MILESTONE:
MFK_CUSTOMER_UI4_CART_CHECKOUT_R1_READY_FOR_COMMANDER_ACCEPTANCE
