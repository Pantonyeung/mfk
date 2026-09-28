# MFK SMT A3c Quick Drink｜Decision Gate Audit R1｜2026-09-26

## STATUS
AUDIT COMPLETE / PRODUCT MUTATION NOT STARTED / OWNER DECISION REQUIRED

## Fresh current main
- Current SMT functional main includes A3b at `8f0b0fc636c99838d7e116d61cea6ca3bf4a6469`.
- A3b handoff follows at `8e22642bf9bd42cfb0b56192a7e7bb8bdefea2ee`.
- Five-port E2E baseline remains frozen.

## Current-main reality
Current main now has:
- Quick / Normal mode.
- Quick Required admission + Required Fast Lane.
- Basic Admin-backed ComboWorkspace.

Current main does NOT have:
- `comboDraft`
- pending Combo drink targets
- DRINK-role pending groups
- reversible configured Combo child snapshots
- A3d Riceball / Combo pairing model

Current ComboWorkspace requires its selected required groups before adding the Combo. It creates one completed Combo cart line directly.

## Donor A3c behavior
The later donor Quick Drink is NOT a generic "add drink" bar.

Exact donor behavior:
1. Scan existing `comboDraft.pendingGroups`.
2. Keep only pending groups whose Admin Combo role is `DRINK`.
3. Quick Drink drawer targets the first pending Combo drink.
4. If the selected choice is non-product, fill that pending Combo group.
5. If it is a product with options, open a drink Product Editor first.
6. The configured drink is then attached back into the SAME Combo composition.
7. "指定餐點" exists when there are multiple pending drink targets.
8. Pricing comes from Admin Combo/Choice/Product facts; no name heuristic and no second pricing authority.

Primary donor evidence:
- `9332a99cca1ae847db327ee821ecdfe432e7a18a` feat(smt): wire quick mode and Admin-backed quick drink
- `4a807de7442c14bb7302cf7252454929cf837f98` configured drink pairing tests
- `d646d26a3d918d77897322136efe41f26c615652` Quick Mode + Quick Drink contract test

## Collision / dependency
A3c as designed depends on A3d-style Combo composition state that current main intentionally does not yet have.

Implementing A3c now requires choosing one of materially different product meanings:

### Option A — Combo-target-only Quick Drink
Quick Drink only fills an existing pending Combo drink slot.
- Closest to donor behavior.
- Preserves Combo pricing/identity semantics.
- But A3d/pending Combo composition must exist first.
- Practical execution order becomes A3d foundation → A3c Quick Drink.

### Option B — Standalone Quick Drink
Quick Drink adds a drink as an independent Cart line.
- Can be implemented immediately.
- But it is NOT donor A3c behavior.
- A drink that was meant to be part of a Combo would become standalone content/pricing unless staff later repairs it.

### Option C — Hybrid
If a pending Combo drink exists, attach to it; otherwise add standalone.
- Fastest for operators.
- But introduces two meanings to the same button and changes line/pricing outcome depending on hidden Cart state.

## Why this must stop
This is not a visual preference.
The choice changes:
- whether the drink is a Combo child or standalone line;
- how price adjustment is calculated;
- which cart identity owns the drink;
- what happens when multiple meals need drinks;
- later dissolve/edit/hold/restore semantics.

Per Owner process rule, this is a real operator + pricing/composition semantic branch.

## No unsafe shortcut
Do NOT infer "drink" from product name/category text.
Donor derives drink role from Admin Combo Pool `addonKind=DRINK`.

## Required Owner decision
Choose A / B / C.

If A:
- Reorder implementation so bounded A3d Combo pending-target foundation lands first.
- Then A3c Quick Drink remains a thin UI/action layer.

If B:
- A3c can proceed immediately as independent drink quick-add.

If C:
- Must lock target precedence and visible indication before implementation.

## Current
A3C_AUDIT_COMPLETE
A3C_OWNER_DECISION_REQUIRED
NO_PRODUCT_MUTATION
FIVE_PORT_E2E_FROZEN
