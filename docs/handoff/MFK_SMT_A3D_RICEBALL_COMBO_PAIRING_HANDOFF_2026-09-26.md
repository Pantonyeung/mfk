# MFK SMT A3d Riceball / Combo Pairing｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / MAIN SMOKE GREEN

## Owner-final pairing semantics

### Pairing position vs meal tier
- Visible A / B / C... are pairing positions only.
- Meal tier is determined by the riceball/main Product ID's membership in the Admin Main Pool.
- A-tier riceball uses A meal base price.
- B-tier riceball uses B meal base price.
- C-tier riceball uses C meal base price.
- D-tier riceball uses D meal base price.
- Do not infer meal tier from the visible pairing letter.

### Default pairing / swap
- Detect eligible main/riceball units and snack units from Admin Combo Pool Product IDs.
- Default is deterministic Cart order: A↔A, B↔B, C↔C.
- Staff can select another snack for the active group.
- If that snack is already owned by another group, the snacks swap one-to-one.
- A snack unit can never exist in two groups.
- No random pairing.

### Unequal counts
- 3 mains + 2 snacks => 2 real pairs; 1 main remains standalone.
- 2 mains + 3 snacks => 2 real pairs; 1 snack remains standalone.
- In general only the deterministic intersection is paired.

## Pricing
A3d uses M1 real Combo pricing.

For each paired group:
- main line price = Admin meal-tier base determined by the riceball + preserved main option adjustments.
- snack line price = Admin SNACK Pool adjustment for the actual paired snack + preserved snack option adjustments.
- group total = main line + snack line.
- swapping snacks moves the snack surcharge with the snack immediately.

Current Admin seed examples:
- A/B/C/D meal bases come from the published Combo definitions.
- snack bands use the published free / +$3 / +$5 adjustments.

## Identity / print guard
Pairing does NOT flatten the meal into one opaque Combo product.
The paired riceball and snack retain their original Product IDs.

This preserves:
- production identity;
- product label routing;
- product-specific print rules;
- source product traceability.

Pairing metadata is added to detail:
- pairing group A/B/C...
- source Combo name;
- role 飯團 / 小食.

Paired line quantity/service-mode/edit operations route back to the pairing workspace instead of silently breaking one side of the pair.

Existing paired groups can be 「拆回單點」, restoring Admin standalone product pricing plus preserved product option adjustments.

## Drink
Drink remains separate and follows A3c:
- optional;
- blank = no price change;
- explicit no-drink uses the Admin-published negative adjustment;
- selected drink uses Admin-published adjustment;
- no Checkout blocker;
- no random assignment.

## Landed
Main:
`99ad7a012be9f65a4a592ed5229162ce6ebe6622`

PR:
`#335`

Bank:
`bank/MFK/SMT-A3D-RICEBALL-COMBO-PAIRING-2026-09-26`

Files:
- v2local/src/App.tsx
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
- v2local/src/features/ordering/RiceballPairingWorkspace.tsx
- v2local/src/features/ordering/riceball-pairing-model.ts
- v2local/src/features/ordering/riceball-pairing-workspace.css
- v2local/src/presentation/smt-riceball-pairing-a3d.test.ts
- v2local/src/presentation/smt-owner-independent-add-a2b1.test.ts

## Proof
Bounded proof:
- run `36230943590` = SUCCESS
- 36 / 36 test files PASS
- 157 / 157 tests PASS
- build PASS
- protected local authority seams PASS
- static bundle proof PASS
- diff check PASS

Post-merge:
- V2 Local POS Smoke run `36231015108` = SUCCESS

The first proof surfaced only a superseded A2b-1 static text assertion. A2b line-identity/quantity semantics were preserved; the test was updated to accept the paired-line guard.

## Protected
- Admin / SMT / SMM / Customer / Keeta accepted E2E remains frozen.
- No Order authority replacement.
- No Payment/Tender change.
- No Print authority replacement.
- No provider ingress repricing.
- No category/name heuristic for pairing.

## New Owner follow-up
Owner added a new money rule after A3d:
standalone riceball + eligible standalone drink may qualify for a special drink price.

This is NOT yet implemented in A3d and requires its own published pricing rule / exact eligibility and price mapping.
