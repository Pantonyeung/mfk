# MFK Customer Combo Ordering R1｜Commander Reacceptance Packet

WORK_ID: `MFK-CUSTOMER-COMBO-ORDERING-R1`

STATUS: `READY_FOR_COMMANDER_REACCEPTANCE`

BASE PRESENTATION:
`work/MFK/CUSTOMER-UI-STAGE2-R1-FRESH-INTEGRATION`

CURRENT FRESH MAIN:
`ac49f8a3be8ffe104c953fa75d78ef72c4de17e6`

WORK BRANCH:
`work/MFK/CUSTOMER-COMBO-ORDERING-R1`

IMPLEMENTATION HEAD BEFORE THIS PACKET:
`57a2736081e9a04fb7c4c5515d6933f3168775d9`

NO MAIN MERGE.
NO PRODUCTION DEPLOY.
NO STAGE 3.

## Authority

- Admin = published Combo / Pool / price facts.
- Customer = projection + draft intent only.
- Existing SMT Combo revalidation = final Combo validation and price revalidation.
- Store Kernel = final transaction authority.

AUTHORITY CHANGE = NONE.

No Customer Combo Engine was introduced.
No second Pricing Engine was introduced.
No second Order Engine was introduced.

## Completed path

Admin Published Combo
→ Customer `menu.combos / comboPools`
→ ProductSheet canonical Combo selection
→ Customer-side draft validation
→ published-menu draft quote / repair
→ `CustomerCartLine.combo`
→ local workspace + PendingIntent
→ Customer Cloud bounded Combo contract
→ same Customer submission / idempotency identity
→ `customer-cloud-intake`
→ existing `SmmLanOrderRequest.line.combo`
→ existing `smm-combo-revalidation`
→ existing SMT / Store Kernel path

## Customer cart intent

Added bounded draft fields:

- comboId
- comboName
- publishedBasePriceMinor
- exact poolId
- exact groupId
- exact subPoolId
- exact choiceId
- choiceType
- choiceLabel
- productId when PRODUCT
- publishedAdjustmentMinor

No product-name heuristic.
No category heuristic.
No "套餐" text heuristic.

## ProductSheet

Combo UI only appears from exact canonical `product.comboId`.

Sources:
- `menu.combos`
- `menu.comboPools`

Renders:
- Combo name
- published base price
- canonical Main pool
- Snack / other Add-on pools
- Drink pools
- published choice adjustments
- min / max
- unavailable choice disabled

DRINK optional behavior reuses the existing banked SMT rule:
`addonKind === 'DRINK' → effective min = 0`.

The Customer rule is a draft/UI guard only. SMT repeats authoritative validation.

If Combo projection is missing/stale:
- Combo upgrade fails closed.
- Customer can repair edited stale Combo back to standalone `只要主餐`.
- no fake Combo data is invented.

## Local draft quote / repair

Combo draft display uses published facts only:

`combo published base`
+
`current selected combo sub-pool + choice adjustments`
+
`current ordinary product option adjustments`

Missing published price facts fail closed.

Stale facts cause:
- CONFIG_CHANGED, or
- PRICE_CHANGED / MATERIAL_CHANGE

Customer must repair / reconfirm.
Silent use of old Combo price is prohibited.

A stale hidden choice in a multi-select group is pruned when that canonical group is edited, so repair remains possible.

## Persistence

Existing local workspace and PendingIntent preserve nested `line.combo`.

Deterministic restart test proves:
- cart Combo identity survives
- pending-intent Combo identity survives
- same submissionId survives
- same idempotencyKey survives

No new transaction identity is created.

## Customer Cloud contract

`contracts/customer-cloud-v1.ts` now bounded-validates and preserves Combo intent.

Fail-closed checks include:
- bounded object keys
- bounded selection count
- known choice type only
- PRODUCT requires productId
- safe integer price facts
- required IDs / labels

Unknown Combo fields are rejected.

## SMT handoff

`customer-cloud-intake.ts` maps Customer cart lines using:
`customerLineToSmmLanLine`

Customer `line.combo` is copied into existing:
`SmmLanOrderRequest.line.combo`

Combo pricing/validation is NOT reimplemented in Customer intake.

The path calls existing:
`revalidateSmmComboLine`

Existing SMT semantics therefore remain authoritative for:
- exact Combo binding
- Main product binding
- Add-on pool/group min/max
- DRINK optional semantic
- availability
- choice identity/type/productId
- current published adjustments
- authoritative unit price

## Deterministic acceptance evidence

Initial RED:
- Run `36286949506`
- Customer Combo consumption absent.
- Valid Combo remained standalone price.
- Required Combo validation / stale adjustment rejection absent.

Repair self-review RED:
- Run `36287658453`
- stale missing Combo could not cleanly return to standalone
- cart review did not expose selected Combo identity/choices

Multi-select repair RED:
- Run `36287964723`
- removed hidden choice occupied max-selection capacity
- expected `choice-a + choice-b`
- received `choice-a + removed-choice`

Latest GREEN before this packet:
- Run `36288011815`

Customer:
- Combo ordering contract: `10 / 10 PASS`
- Stage 2 regression: `13 / 13 PASS`
- Combo projection regression: `5 / 5 PASS`
- Full Customer: `59 / 59 PASS`
- Customer build: `SUCCESS`

v2local:
- relevant Customer/Combo/SMT test files: `3 / 3 PASS`
- relevant tests: `17 / 17 PASS`
- v2local build: `SUCCESS`

v2admin, because shared Customer Cloud contract changed:
- test files: `21 / 21 PASS`
- tests: `126 / 126 PASS`
- build: `SUCCESS`
- Wrangler deploy dry-run: `SUCCESS`
- production deploy was NOT executed

## Stage 2 preservation

Unchanged:
- accepted Stage2Menu visual hierarchy
- TRUE EMPTY product media
- touch target >=44px
- max-width 480px
- Reduced Motion
- Sold Out visible + detail action disabled
- Favorite session-local only
- exact five-nav:
  - 首頁
  - 點單
  - 記憶罐
  - 訂單
  - 會員
- Memory Jar centered

No Stage 3 implementation exists in this work.

## Fresh-main state

Branch was rebuilt forward onto fresh main:
`ac49f8a3be8ffe104c953fa75d78ef72c4de17e6`

Required final compare:
`behind = 0`

## Source scope

Production:
- `contracts/customer-cloud-v1.ts`
- `v2customer/src/product-types.ts`
- `v2customer/src/components/customer-views.tsx`
- `v2customer/src/selection.ts`
- `v2customer/src/local-quote.ts`
- `v2customer/src/App.tsx`
- `v2local/src/runtime/customer-cloud-intake.ts`

Tests / gates:
- `v2customer/test/combo-ordering-r1.test.mjs`
- `v2local/src/runtime/customer-combo-ordering-r1.test.ts`
- `.github/workflows/customer-combo-ordering-r1.yml`

No persistence production mutation was necessary:
the existing JSON local workspace already preserves the nested bounded Combo intent and request identity; this behavior is now deterministically tested.

## Hard boundaries

NO STAGE 3.
NO MAIN MERGE.
NO CLOUDFLARE / PRODUCTION DEPLOY.
NO PAYMENT SEMANTIC CHANGE.
NO MEMBER CHANGE.
NO PRINT CHANGE.
NO KEETA CHANGE.
NO ADMIN AUTHORITY CHANGE.
NO SMT STORE KERNEL REWRITE.

FINAL STATUS:

`READY_FOR_COMMANDER_REACCEPTANCE`
