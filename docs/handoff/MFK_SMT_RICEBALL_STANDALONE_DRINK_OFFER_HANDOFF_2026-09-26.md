# MFK SMT Riceball Standalone Drink Offer｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / MAIN SMOKE GREEN

## Owner-final product identity
- 海報「手打檸檬茶」同現有 canonical Product 係同一樣產品。
- Reuse Product ID: `b3529ce7-9b4e-5d20-9e1e-e4ef68319561`.
- Existing standalone Admin base price remains HK$22.
- No duplicate 手打檸檬茶 Product is created.
- A3c Combo drink +$10 mapping now points to this canonical Product instead of a LABEL-only placeholder.

## Riceball standalone drink offer
One eligible standalone riceball unlocks one eligible standalone drink offer.

Admin-published offer table:
- 冰菊普洱茶 HK$13
- 日式玄米茶 HK$13
- 限定茶 HK$13
- 磨飯氣泡水 HK$13
- 台式奶茶 HK$16
- 手打檸檬茶 HK$17

## Eligibility / pairing
- Eligible riceballs are derived from Admin A/B/C/D Main Pool Product IDs.
- Offer-eligible drinks are explicit Admin Product IDs.
- No product-name or category heuristic.
- 1 riceball : 1 drink.
- Multiple units pair deterministically by Cart order.
- Extra riceballs remain unused.
- Extra drinks retain standalone price.
- Service mode is respected.
- A3d paired meal lines do not count as standalone riceballs, so the offer cannot stack with an already-formed riceball meal combo.

## Pricing
- Offered drink unit price = Admin-published promotional drink base + preserved drink option adjustments.
- Non-offered drink unit price = current Admin standalone product price + preserved option adjustments.
- If a qualifying riceball disappears or is converted into A3d meal pairing, the drink automatically returns to standalone price.
- Qty > 1 drink rows normalize into per-unit pricing when only some units qualify.

## Authority
Admin publishes:
`snapshot.pricingPromotions.riceballDrink`

SMT projects:
`projectSyncedRiceballDrinkPromotion()`

SMT applies:
`applyRiceballDrinkPromotion()`

No provider ingress repricing.
No second pricing authority.

## Landed
Main:
`9498b2e9716f829d91c70cff731cd627639e9f0e`

PR:
`#336`

Bank:
`bank/MFK/SMT-RICEBALL-DRINK-OFFER-2026-09-26`

## Proof
Bounded PR proof:
- run `36232756688` SUCCESS
- Admin: 17 / 17 test files PASS
- Admin: 113 / 113 tests PASS
- Admin build PASS
- SMT: 37 / 37 test files PASS
- SMT: 162 / 162 tests PASS
- SMT build PASS
- protected authority seams PASS
- diff check PASS

Post-merge:
- V2 Local POS Smoke run `36232812961` SUCCESS

Initial proof run `36232710884` failed only because an Admin static test still expected 手打檸檬茶 to be a LABEL. Owner correction changed that exact canonical mapping to PRODUCT; the assertion was updated and the next full proof was GREEN.

## Protected
- A3c optional drink semantics remain intact.
- A3d meal pairing / pricing remains intact.
- Order / Payment / Print authority unchanged.
- Provider ingress unchanged.


## OTA / Store readiness
Owner cadence changed after this implementation: every bounded SMT implementation must publish its own candidate OTA immediately after GREEN merge/bank.

This part has now been published:
- exact OTA source: `9498b2e9716f829d91c70cff731cd627639e9f0e`
- release: `runtime-candidate-mfk-9498b2e9716f`
- bundle: `MoreFunOS-SMT-runtime-candidate-mfk-9498b2e9716f.mfos`
- builder run: `36232975523`
- package/sign/upload/public readback: SUCCESS
- public readback marker: `MFK_RUNTIME_OTA_PUBLISHED`

Admin support for the pricingPromotions snapshot was also deployed:
- deploy request commit: `d3b8ddac3b921bbfbf8245dcd5057cfd19505cb9`
- deploy run: `36232955418`
- result: SUCCESS

## New standing cadence
For every next bounded SMT part:
`IMPLEMENT → PROOF → MERGE → BANK → CANDIDATE OTA → PUBLIC READBACK GREEN → NEXT PART`

Do not batch multiple future SMT changes before OTA.
