# Native canonical quote selections | 2026-10-03

## Source and bounded result

Prepared from exact unified source `f680166aa5ddf64ac1d44492a296c3c2e056597f` in a separate worktree. Admin contract source is retained `5954f301c684e795453d622790ca11acae8dfe79`, with the already-integrated legacy-default preservation fix. No shared integration-tree edit, remote push, live publication, money action, permission change or deployment is part of this patch.

`FormalQuoteRoomProducer` still owns the quote and uses its existing fresh Admin/tender snapshot and one existing-coordinator commit. Its package-private `FormalQuoteSelectionResolver` is a pure implementation detail of that native authority. React prices, material money copies and preview totals remain untrusted. No V2 runtime dependency or writer is introduced.

Supported exact fields:

- Product base: `catalog.products` identity/category/name/active/basePrice and existing optional product takeaway adjustment/surcharge semantics.
- Product options: `optionCenter.sets` with active, required, SINGLE/MULTI, integer min/max, allowQuantities, and options with id/active/decimal priceAdjustment. Membership/defaults come from `productLinks(productId,setId,defaultOptionIds)`. If the legacy product `modifierGroupIds` mirror exists, it must agree with those links.
- Omitted set selection applies the explicitly published defaults. An explicitly supplied empty set selection is an override and must meet min/max. No invented default is selected. Foreign sets/options, duplicate identities, malformed cardinality, inactive selected facts and unrepresentable money reject.
- Combo base: `catalog.combos` id/name/active/basePrice/mainPoolId/addonPoolIds. Takeaway combos require the explicit published takeawayAdjustment and Boolean surcharge policy. No implicit zero is inserted for a missing combo price fact.
- Combo hierarchy: each selected `poolId/groupId/subPoolId/choiceId` maps to the referenced Admin pool/group/band/choice; `subPoolId` must equal the choice's published `bandId`. Published type and product identity must agree. MAIN_COURSE/ADDON membership, group bounds, active pool/band/choice/product/category, and READY band/choice pricing are enforced.
- Combo unit price is the published combo base plus service adjustment plus each selected band's and choice's exact adjustment. Child standalone product prices are not added. A repeated product in distinct component tuples is valid; an identical repeated tuple rejects. Source evidence is deduplicated when multiple choices share a band, without dropping the per-component charge.
- Current integer quantity bounds remain 1–999. Exact decimal/minor parsing and checked addition/multiplication are reused. Negative base, nonfinite/rounded/missing/OWNER_VALUE_REQUIRED prices, overflow and negative resulting units reject. Signed published adjustments remain representable as in the existing source contract.

Compound material-fact identities are length-delimited SHA-256 hashes of canonical source IDs, avoiding local-ID and delimiter collisions. Short existing PRODUCT base/service fact IDs are retained. Long IDs preserve the old 160-character source bound while keeping downstream fact IDs within 160 characters.

## Explicit unsupported fields and remaining gates

- The client option shape contains unique option IDs, with no per-option quantity. `allowQuantities=true` can be used for quantity-one selections only; duplicate IDs and added quantity fields reject. Full option-quantity support needs an actual client/canonical intent contract.
- The client combo shape has no nested product-option intent. Combo components with any linked option set reject with `FORMAL_QUOTE_COMBO_COMPONENT_OPTIONS_UNSUPPORTED`; neither defaults nor price deltas are silently dropped.
- Legacy modifier groups alone are not converted into a new authority. Attached groups without an explicit optionCenter reject. Plain products with no attachment remain compatible.
- This quote source contains published active flags, not a proven operational sold-out/capacity read model. Dynamic availability remains a separate release gate; this patch does not claim runtime sold-out proof.
- WALK_IN remains the supported channel. Student eligibility/rounding/stacking remain unbound and Student requests remain disabled.
- Actual Admin R27 data, canonical live publication/readback, device/Owner/staff provisioning, catalog adapters, full native Android CI, and downstream live E2E are not proved by fixtures.

## Read/write and freshness invariants

Quote creation still reads `ADMIN_ACTIVE_CONFIGURATION` and `POS_TENDER_POLICY` together, writes only `FORMAL_QUOTE`, attaches both exact revision dependencies and the original quote deadline, and uses the existing coordinator. Confirmation still validates current Admin source/kernel revision, quote identity and exclusive expiry. The downstream security, Business Day, tender and receipt/readset/atomic payment commit code is unchanged.

## Verification

Executed:

- `python .github/scripts/test_native_quote_selections.py`: 66 assertions pass, compiling the actual resolver and source-money contract. The helper uses an explicitly marked two-constant AdminProducer stub only. Java17 source/bytecode is checked using the installed JDK; API compatibility is not checked because this image lacks `ct.sym`. This is not Android/Room/producer execution.
- Initial RED: missing resolver; subsequent behavioral REDs caught the 120-versus-160-character regression and missing combo service-price fallback. Both corrected with the same tests GREEN. Independent review identified a PRODUCT/COMBO same-ID service-fact namespace ambiguity; an additional behavioral RED caught it before the COMBO namespace was separated.
- Focused retained Admin catalog/options/combo tests: 3 files, 15 tests pass.
- Existing source guard regression: 53 pass.
- Existing actual native-print SQL regression: 7 pass.
- Source inspection confirms unchanged Admin/tender read dependencies, commit deadline and Student rejection. Source checks are not transaction execution.

Prepared for the existing full JUnit/Room CI task:

- `FormalQuoteSelectionResolverJvmTest` invokes the exact pure vectors.
- `FormalCheckoutRoomPricingProducerTest` adds durable normalized default/combo identity cases, stale-publication and exclusive-expiry cases, and Student rejection using the same canonical-field fixtures.

`gradle :app:testDebugUnitTest -x verifySmtWebBundle` could not run: `gradle: command not found`, with no wrapper/SDK supplied. The new Room tests are **unexecuted** here. No CI was triggered, and no live-data or full E2E success is claimed.

Independent scoped review cleared all findings after the service-fact namespace correction. The reviewer independently reran the 66 supplied assertions and 15 additional edge checks, with `git diff --check` clean. Those checks have the same explicitly limited pure-Java scope.
