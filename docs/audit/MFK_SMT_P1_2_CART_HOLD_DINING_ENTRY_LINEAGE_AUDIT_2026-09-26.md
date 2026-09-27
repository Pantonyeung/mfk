# MFK SMT P1-2｜Cart Identity + Same-Line Edit + 暫存／堂食 Lineage Audit

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION / NO MERGE
CONTROL: #321

## Owner requirement locked on 2026-09-25
- Cart units stay independent by default.
- Combine default = OFF.
- Combine ON groups only exact matching configuration and does not replace underlying line identity.
- Editing updates the SAME cart line; Edit != Add.
- 「暫存」+「堂食」are one primary entry with two concepts.
- Any dine-in line, including mixed cart, defaults to Dining.
- All-takeaway defaults to Hold.
- Staff can always switch manually either way.
- Clear order is visually secondary.

## Exact validated donors
Owner FINAL Frontline:
- candidate a5295009ab4afc3183009818359d2233d841258b
- run 36110761322 SUCCESS
- 34/34 test files, 151/151 tests PASS, build GREEN
- PR #283 CLOSED / NOT MERGED
- key independent-line commit b97e1bdad8c1e080d5c0ebb6d35b7ac4a8fd1ca0

R4 暫存／堂食:
- exact tested candidate 175749edb29a2079651c659fea80762f725b51f3
- run 36143162885 SUCCESS
- 39/39 test files, 192/192 tests PASS, build PASS
- rendered browser 9/9 PASS
- PR #301 DRAFT / OPEN / UNMERGED
- key commits: 0dc24526a71bc2715b23f28a283a71c39058f1cf, 110203e43206c8980a1b4817f07d708b6e6cfb12, a213b0e8a08863fb159299d17b4b3be6c0c841ca, e7189ef757b72cd45f4a9ed198e13c1450de5fac.

## Current main reality
Current product tree still:
- increments an existing same-product/service-mode line on add;
- addConfigured appends a new line;
- edit opens config but has no same-line update path;
- lacks Owner FINAL Combine OFF/ON presentation model;
- lacks R4 cart-derived Hold/Dining default + manual dual-mode behavior.

Classification:
OWNER_REQUIREMENT_LOCKED + VALIDATED_UNMERGED.
This is not a new business-engine requirement.

## Dependency
Validated Owner FINAL work also carries structured Fast Lane state and local composition durability.
Current main does not contain contracts/order-line-composition-v1.ts or fast-lane-model.ts.
Do not fake configured/Combo SAME-line edit by flattening structured choices.
If structured edit is admitted, reuse the validated local composition contract lineage, never create a second Combo/Pricing engine.

## Risks / guards
1. Do not import old nav/payment/runtime changes with this slice.
2. Combine ON is presentation/group action only; underlying identities remain.
3. Cart IDs must remain unique under rapid adds.
4. Edit preserves lineId + serviceMode and creates zero duplicate lines.
5. R4 default is UX only; staff override remains.
6. Five connected E2E ports remain unchanged.

## Future smallest allowlist
- v2local/src/App.tsx
- v2local/src/features/ordering/OrderingWorkspace.tsx
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
- ordering CSS
- only required local composition contract/model if structured edit needs it
- tests

## Required contracts
CART-01 two identical taps with Combine OFF => two independent line identities.
CART-02 Combine ON groups exact config without losing identities.
CART-03 modifier/service-mode/price mismatch never combines.
CART-04 edit updates SAME lineId; zero duplicate.
CART-05 remove affects exact intended unit/group.
CART-06 rapid-add identity uniqueness.
HOLD-01 all takeaway => default 暫存.
HOLD-02 any dine-in/mixed => default 堂食.
HOLD-03 manual switch both directions.
HOLD-04 default never changes line serviceMode or splits order.
HOLD-05 clear stays separate destructive action.

STATUS:
P1_2_EXACT_DONORS_MAPPED
FIVE_PORT_E2E_UNCHANGED
