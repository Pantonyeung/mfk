# MFK Customer Combo Ordering R1｜Fresh-main Reacceptance Packet

WORK_ID: `MFK-CUSTOMER-COMBO-ORDERING-R1`

STATUS: `READY_FOR_COMMANDER_REACCEPTANCE`

FRESH MAIN:
`eff05e5724196771f56dc7b6af9eb7b4702984f2`

CLEAN BRANCH:
`work/MFK/CUSTOMER-COMBO-ORDERING-R1-FRESH`

IMPLEMENTATION HEAD BEFORE THIS PACKET:
`5ee6bd6d6c5cf141133b7456e84ab6586b19aa70`

NO MAIN MERGE.
NO PRODUCTION DEPLOY.
NO STAGE 3.

## Purpose

Complete the missing Customer Combo ordering path without redrawing Stage 2 and without regressing the latest main A3B Customer intake semantics.

The implementation is rebuilt on current main rather than merging the earlier diverged Combo branch.

## Canonical path

Admin Published Combo
→ Customer `menu.combos / comboPools`
→ ProductSheet canonical Combo selection
→ Customer-side draft validation
→ published-menu draft quote / repair
→ `CustomerCartLine.combo`
→ local workspace + PendingIntent
→ Customer Cloud bounded Combo contract
→ same submission / idempotency identity
→ `customer-cloud-intake`
→ existing `SmmLanOrderRequest.line.combo`
→ existing `smm-combo-revalidation`
→ SMT / Store Kernel

## Authority

- Admin = published Combo / Pool / price facts
- Customer = projection + draft intent only
- SMT existing Combo revalidation = authoritative Combo validation / price revalidation
- Store Kernel = transaction authority

AUTHORITY CHANGE = NONE.

No second Combo Engine.
No second Pricing Engine.
No second Order Engine.

## Latest-main preservation

Fresh-main `customer-cloud-intake.ts` A3B behavior is preserved:

- own-channel pending operator review semantics
- `CUSTOMER_PAYMENT_EVIDENCE_REQUIRED`
- customerName handoff
- `initialFulfillmentLabel:'待處理'`
- current capacity admission path
- current SMM staff bridge behavior

Combo support was layered onto that current-main intake path rather than replacing it with the older Customer intake implementation.

## Customer Combo intent

`CustomerCartLine.combo` now preserves:

- comboId
- comboName
- publishedBasePriceMinor
- exact poolId / groupId / subPoolId / choiceId
- choiceType
- choiceLabel
- productId for PRODUCT choice
- publishedAdjustmentMinor

No product-name heuristic.
No category heuristic.
No "套餐" text heuristic.

## ProductSheet

Exact `product.comboId` binding only.

Sources:
- `menu.combos`
- `menu.comboPools`

Renders:
- Combo name
- published base price
- Main pool
- Snack / Add-on pools
- Drink pools
- published price adjustment
- min / max / required draft rules
- unavailable choices disabled

DRINK optional semantics reuse the banked SMT rule:
`addonKind === 'DRINK' → effective min = 0`.

Customer rule is draft-only.
SMT revalidates authoritatively.

## Repair / stale config

Stale Combo state does not silently retain old pricing.

Customer draft repair can surface:
- CONFIG_CHANGED
- PRICE_CHANGED / MATERIAL_CHANGE

Stale missing Combo can return to standalone `只要主餐`.

Stale hidden choices are pruned when the affected canonical multi-select group is edited so removed choices cannot consume current max-selection capacity.

## Published local quote

Combo draft quote uses only current published facts:

`combo published base`
+
`current Combo published adjustments`
+
`ordinary option published adjustments`

Missing facts fail closed.
No invented price.

## Persistence / identity

Existing local workspace JSON persistence preserves nested Combo intent in:
- cart
- PendingIntent

Restart test proves:
- cart Combo survives
- pending Combo survives
- same submissionId survives
- same idempotencyKey survives

No second request identity is created.

## Customer Cloud contract

`contracts/customer-cloud-v1.ts` bounded-validates Combo payload.

Rejects:
- unknown Combo fields
- invalid choiceType
- PRODUCT without productId
- invalid IDs / labels
- invalid price facts
- excessive selection payload

Valid Combo payload is preserved exactly.

## SMT handoff

`customer-cloud-intake.ts` maps Customer line through:
`customerLineToSmmLanLine`

Customer `line.combo` becomes existing:
`SmmLanOrderRequest.line.combo`

Then pricing / validation calls existing:
`revalidateSmmComboLine`

No Customer-specific SMT Combo pricing implementation was added.

## Fresh clean verification

Run:
`36292665260`

Customer job:
- Combo ordering contract: `10 / 10 PASS`
- Stage 2 regression: `13 / 13 PASS`
- Combo projection regression: `5 / 5 PASS`
- Full Customer: `59 / 59 PASS`
- Customer build: `SUCCESS`

v2local:
- relevant test files: `3 / 3 PASS`
- relevant tests: `17 / 17 PASS`
- v2local build: `SUCCESS`

v2admin, required because shared Customer Cloud contract changed:
- test files: `23 / 23 PASS`
- tests: `132 / 132 PASS`
- build: `SUCCESS`
- Wrangler deploy dry-run: `SUCCESS`
- production deploy: `NOT EXECUTED`

## Stage 2 regression contract

Preserved:
- Stage2Menu
- TRUE EMPTY product media
- touch target >=44px
- max-width 480px
- Reduced Motion
- Sold Out visible + disabled open
- Favorite session-local only
- exact five-nav:
  - 首頁
  - 點單
  - 記憶罐
  - 訂單
  - 會員
- Memory Jar centered

## Clean candidate source scope

Production:
- `contracts/customer-cloud-v1.ts`
- `v2customer/src/App.tsx`
- `v2customer/src/components/customer-views.tsx`
- `v2customer/src/local-quote.ts`
- `v2customer/src/product-types.ts`
- `v2customer/src/selection.ts`
- `v2local/src/runtime/customer-cloud-intake.ts`

Tests / gates:
- `v2customer/test/combo-ordering-r1.test.mjs`
- `v2local/src/runtime/customer-combo-ordering-r1.test.ts`
- `.github/workflows/customer-combo-ordering-r1-fresh.yml`

No production persistence mutation was required; existing persistence already preserves nested bounded Combo intent and request identity.

## Fresh-main relation

At packet preparation:

- main = `eff05e5724196771f56dc7b6af9eb7b4702984f2`
- candidate behind = `0`

Final reacceptance must retain `behind = 0`.

## Hard boundaries

NO STAGE 3.
NO MAIN MERGE.
NO CLOUDFLARE / PRODUCTION DEPLOY.
NO PRICING AUTHORITY CHANGE.
NO ORDER AUTHORITY CHANGE.
NO PAYMENT SEMANTIC CHANGE.
NO FULFILLMENT AUTHORITY CHANGE.
NO MEMBER AUTHORITY CHANGE.
NO COMBO ENGINE.
NO SECOND PRICING ENGINE.
NO PRODUCT IMAGE GENERATION.

FINAL STATUS:

`READY_FOR_COMMANDER_REACCEPTANCE`
