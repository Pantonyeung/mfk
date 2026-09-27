# MFK Customer App｜UI3 CONFIGURE + Combo Ordering Completion R1｜Handoff

STATUS:
READY_FOR_COMMANDER_ACCEPTANCE

WORK_ID:
MFK-CUSTOMER-UI3-COMBO-CONFIGURE-R1

BRANCH:
work/MFK/CUSTOMER-UI3-COMBO-CONFIGURE-R1

FRESH MAIN AT DISPATCH:
493f014fcf91409612f63955a0b4698ad7815e69

SOURCE HEAD BEFORE HANDOFF:
812549e0ce5c519d93a01be5309edd5090870214

FRESH MAIN BEHIND:
0

## COMPLETED

UI3 CONFIGURE:
- Hero / product identity / published starting price
- Combo Upgrade only from exact product.comboId
- Required
- Optional
- Qty
- Recommendation
- Current Configuration Summary
- Sticky published total + Add to 記憶罐
- Required / unavailable / price-incomplete states fail closed
- TRUE EMPTY media when official image is absent
- Mobile-first Product Dialog <= 480px
- touch targets >= 44px
- Reduced Motion preserved
- fixed five-nav: 首頁 / 點單 / 記憶罐 / 訂單 / 會員

COMBO ORDERING:
Admin Published Config
→ Customer menu.combos / comboPools
→ exact Product Detail Combo selection
→ published-fact local preview
→ CustomerCartLine.combo
→ local persistence / restart
→ bounded Customer Cloud Combo payload
→ same submissionId / idempotencyKey
→ customer-cloud-intake
→ existing SmmLanOrderRequest.line.combo
→ existing smm-combo-revalidation
→ SMT / Store Kernel

## LOCKS

- no product-name heuristic
- no category heuristic
- no 「套餐」word heuristic
- no price-derived A/B/C/D inference
- DRINK optional semantics reuse current canonical SMM/SMT rule
- missing published fact => 價格待同步
- price change / Combo change => affected-line repair and re-confirm
- stale unavailable choice rejected
- recommendation failure never blocks Add
- no second Combo Engine
- no second Pricing Engine
- no second Order Engine

## FINAL GREEN EVIDENCE

GitHub Actions:
RUN 36295897792

Customer:
- UI3 Configure contract: 9/9 PASS
- Combo ordering contract: 10/10 PASS
- UI2 Stage2 regression: 13/13 PASS
- Combo projection regression: 5/5 PASS
- Full Customer tests: 68/68 PASS
- Customer build: PASS

v2local:
- relevant test files: 3/3 PASS
- relevant tests: 17/17 PASS
- v2local build: PASS

v2admin shared-contract regression:
- test files: 23/23 PASS
- tests: 132/132 PASS
- Admin build: PASS
- Wrangler deploy --dry-run: PASS
- production deploy: NOT EXECUTED

## FILES CHANGED

- .github/workflows/customer-ui3-combo-configure-r1.yml
- contracts/customer-cloud-v1.ts
- v2customer/src/App.tsx
- v2customer/src/components/customer-views.tsx
- v2customer/src/components/product-sheet-ui3.tsx
- v2customer/src/local-quote.ts
- v2customer/src/product-types.ts
- v2customer/src/selection.ts
- v2customer/src/styles.css
- v2customer/src/ui/primitives.tsx
- v2customer/test/combo-ordering-r1.test.mjs
- v2customer/test/donor-fusion-r2.test.mjs
- v2customer/test/ui3-configure-r1.test.mjs
- v2local/src/runtime/customer-cloud-intake.ts
- v2local/src/runtime/customer-combo-ordering-r1.test.ts
- v2customer/docs/MFK_CUSTOMER_UI3_COMBO_CONFIGURE_R1_HANDOFF_2026-09-27.md

## AUTHORITY

AUTHORITY CHANGE = NONE

NO UI4 CART/CHECKOUT REDESIGN
NO PAYMENT NEW SEMANTICS
NO COUPON NEW SEMANTICS
NO MEMBER IMPLEMENTATION EXPANSION
NO STAGE4
NO MAIN MERGE
NO CLOUDFLARE DEPLOY

MILESTONE:
MFK_CUSTOMER_UI3_COMBO_CONFIGURE_R1_READY_FOR_COMMANDER_ACCEPTANCE
