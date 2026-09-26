# MFK SMT A3d Riceball / Combo Pairing｜Decision Gate Audit R1｜2026-09-26

## STATUS
AUDIT COMPLETE / NO A3d PRODUCT MUTATION / OWNER DECISION REQUIRED

## Fresh current main
Latest A3c final functional head:
`4da40b04153c9b0a373204bb44258761bb75c4cd`

A3c handoff finalization:
`b09eafd43ee5a3f123a46ec14aa8078c7c449e86`

Five-port E2E remains frozen.

## Current-main behavior
Current `ComboWorkspace` is direct construction:
1. Staff opens 紫米套餐區.
2. Selects an Admin-published Combo.
3. Selects its Main / Snack choices.
4. Drink is now an A3c optional supplement and may be skipped.
5. Cart receives one Combo line at Admin combo base price + published sub-pool / choice adjustments.

Current main does NOT convert already-added standalone Cart items into a Combo.

## Donor A3d behavior
The later donor adds a separate pairing model.

It can:
- inspect already-added Cart lines;
- match eligible Product IDs against Admin Combo Pool choices;
- create deterministic A / B / C... pairing plans;
- consume one unit from matching standalone lines;
- replace the consumed units with one Combo line;
- reprice that Combo from Admin combo base + published choice adjustments + preserved product-option configuration adjustments;
- snapshot the consumed components;
- allow 「拆開套餐」 to restore source items.

The donor does not silently commit the auto pairing: it previews plans and staff presses 「建立 N 組快速組合」.

## A3c compatibility
Donor A3d's old DRINK behavior is superseded.

A3c Owner-final rule wins:
- DRINK must not be a blocker.
- No required pending drink group.
- Blank drink = no action / no adjustment.
- Drink supplements remain optional and may stay separate.
- A3d core pairing therefore concerns Main + Snack / other non-drink combo components only.

Also do NOT use the donor's `category.includes('飯團')` fallback as authority.
Eligibility must come from Admin Combo Pool Product IDs.

## Real semantic collision
Pairing existing standalone Cart lines changes money and Cart identity.

Example shape:
`standalone main + standalone snack`
→ staff confirms pairing
→ source units are consumed
→ one Combo line is created
→ price becomes Admin Combo price rather than the prior standalone sum

Even with exact Admin pricing, this is a real money/operator semantic change and therefore requires Owner decision.

## Owner options

### A — Assistive auto-pair + explicit confirm
- System proposes all eligible pairs deterministically by Cart order.
- Preview shows which source lines will be consumed and before/after Combo price.
- Nothing changes until staff presses 「建立快速組合」.
- Can build all eligible plans in one action.
- Pairing uses Admin Product IDs only.
- Drink stays optional under A3c.
- Combo can be dissolved back to its source items / option details.

This is closest to donor Fast Lane while avoiding silent repricing.

### B — Manual pairing only
- System shows eligible source lines.
- Staff manually chooses exact main + snack + Combo for every group.
- Price preview before confirm.
- No automatic pairing proposal.

Slower but highest explicit control.

### C — Keep current direct Combo builder only
- Existing standalone Cart lines are never converted/repriced into Combo.
- Staff must open 紫米套餐區 and create a Combo directly from scratch.
- 飯團待組區 becomes guidance/display only or remains zero.

Smallest semantic surface, least automation.

## Recommendation
A is the best operator-flow candidate IF Owner wants the system to recognize already-entered items as a possible meal deal.

Safeguards for A:
- preview only before commit;
- explicit staff confirm;
- Admin Product ID matching only;
- deterministic Cart-order pairing;
- visible before / after price;
- reversible dissolve;
- no drink blocker;
- no silent repricing.

## Required Owner decision
Choose A / B / C.

Until then:
A3D_AUDIT_COMPLETE
A3D_OWNER_MONEY_IDENTITY_DECISION_REQUIRED
NO_A3D_PRODUCT_MUTATION
A3C_FINAL_GREEN
FIVE_PORT_E2E_FROZEN
