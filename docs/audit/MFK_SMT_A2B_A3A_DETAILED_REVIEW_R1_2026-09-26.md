# MFK SMT A2b + A3a Detailed Review R1

DATE: 2026-09-26
TIME_HKT: 13:01+
MODE: AUDIT ONLY / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: Pantonyeung/mfk #321

LATEST MAIN:
0b51db2ac4db066fb2427e1e746d37a99ee98d03

LATEST GATE:
docs/audit/MFK_SMT_A1_CURRENT_MAIN_RECHECK_HOLD_R1_2026-09-26.md

A1 remains OWNER_DECISION_GATE_ACTIVE.
No further SMT product write is authorized by this audit.

## 1. A2b — Independent Add Identity + Combine Presentation

### Current main

Current main plain product add still does:
productId + serviceMode match
→ existing line qty + 1

Therefore two separate taps on the same plain product can collapse immediately into one cart line.

This means current main does not preserve independent add-event line identity for identical plain products.

### Later donor pattern

R4 donor exact candidate:
175749edb29a2079651c659fea80762f725b51f3

Donor behavior:
- every new product add creates nextLocalCartLineId()
- new add starts qty=1
- Combine default is OFF
- when Combine OFF, presentation expands quantities as separate displayed units
- when Combine ON, presentation groups only by an exact semantic key:
  productId
  serviceMode
  unitMinor
  detail
  optionSelections
  freeNote
  comboDraft
- grouped rows retain sourceLineIds
- grouping is presentation-only; source cart lines are not destructively merged

### Important nuance

A2b should be defined as:
INDEPENDENT ADD IDENTITY

Not:
EVERY PHYSICAL QUANTITY HAS A UNIQUE DURABLE LINE ID

Reason:
the donor still allows qty adjustment on an existing line.
So pressing + on a line can keep one line with qty>1.

This is acceptable only if Owner requirement is:
separate product taps must stay independently addressable until Combine presentation chooses to group them.

If Owner instead requires every single unit—including qty increments—to have its own line identity, that is a different and larger contract.

### Why A2b is wider than A2a

A2b changes:
- add semantics
- CartLine presentation identity
- grouped sourceLineIds
- line edit/remove/qty/service-mode action signatures
- Combine toggle
- original/organized display semantics

It must not be bundled with A2a.

### Proposed A2b future acceptance

1. two separate taps on same product create two source line ids.
2. Combine OFF shows them independently.
3. Combine ON may visually group exact-equal semantics only.
4. turning Combine OFF restores independent source rows without data loss.
5. different serviceMode never groups.
6. different option/remark/price never groups.
7. edit on one independent source line does not alter sibling line.
8. delete one source line does not delete sibling line.
9. hold/restore preserves exact total and product facts.
10. Checkout creates identical total/order items compared with source cart.
11. no runtime/E2E seam changed.

Classification:
MEDIUM_PRODUCT_MODEL_OPTIMIZATION
OWNER_CONTRACT_CLARIFICATION_REQUIRED_BEFORE_IMPLEMENTATION

## 2. A3a — Quick / Normal Mode

### Current main

Current main has no Quick / Normal ordering mode.

Current product click logic is effectively:
- product with options → configure
- product without options → add

Current Admin ordering projection already exposes the necessary truth:
SyncedOptionSet includes:
- required
- forceShow
- min/max
- defaultSelected options
- published price adjustments

Therefore a bounded Quick/Normal mode can potentially be implemented without importing the later Fast Lane model.

### Safer donor

PR #171:
c715d033275974ce6980e3943289a477ceead506

Recorded GREEN:
18 files / 67 tests
production build GREEN
browser 1280×720 + 1920×1080
no runtime/** change

Its simpler product contract:
- Quick mode:
  direct add only when product does not require editor intervention
- Normal/Standard mode:
  every product opens the same product editor
- one editor remains source of published options/qty/note/price calculation
- no second pricing authority

### Later R4 donor is NOT the right A3a donor

R4 later Quick implementation is coupled to:
- fast-lane-model
- Required Fast Lane
- Quick Drink
- Combo composition
- default selection reconstruction
- guidance flow

That is too broad for A3a.

A3a should therefore use the #171 concept, but re-evaluate against current Admin fields.

### Proposed safe Quick eligibility

Quick direct-add should be allowed only when ALL are true:
- product sellable/priceReady
- no required option set needing user choice
- no forceShow option set requiring explicit display
- published defaults alone produce a valid configuration

Otherwise:
Quick mode opens the existing editor.

Normal mode:
always opens the existing editor.

### Critical pricing rule

Quick mode must use only:
Admin-published base price
+ Admin-published default option adjustments

It must never:
- invent a discount
- skip a required option
- ignore forceShow
- use name heuristics
- create a second pricing calculation engine

### A3a does NOT include

- Quick Drink
- Required Fast Lane
- Riceball pairing
- Combo Fast Lane
- silent guided workflow
- UI density preferences

Those remain A3b–A3e.

### Proposed A3a future acceptance

1. Normal mode opens editor for every product.
2. Quick mode direct-add works only for safe products.
3. required options still force editor/required completion.
4. forceShow optional sets still force editor.
5. defaultSelected option adjustment appears in final line price.
6. no second pricing engine.
7. switching mode does not mutate current cart.
8. current Customer/SMM/Admin/Keeta E2E remains byte-identical.
9. current shell/header/order alerts remain.
10. V2 Local Smoke GREEN.

Classification:
BOUNDED_FRONTLINE_OPTIMIZATION
SAFE_TO_PLAN_AFTER_A2b_OR_SEPARATELY_AFTER_OWNER_DECISION

## 3. Dependency correction

A3a is smaller than the broader A3 program and does not technically require:
- A3b Required Fast Lane
- A3c Quick Drink
- A3d Combo pairing

However:
A3a should not be implemented before A1 decision and current low-risk A4/A2a sequence is settled.

Recommended order stays:

A1 decision
→ A4
→ A2a
→ Owner clarification for A2b identity contract
→ A2b
→ A3a
→ later A3b–A3e

If Owner prefers Quick/Normal before Combine, A3a may move before A2b because it can be isolated.

## 4. Current decision gates

A1:
Owner acceptance required now.

A2b:
Owner contract clarification required:
Does “independent unit” mean:
A. independent identity per separate product-add action; qty +/- may remain one line
or
B. every quantity unit must always be a unique line identity

A3a:
No semantic Owner decision needed if bounded to published Admin truth, but implementation remains held behind A1 gate.

## 5. Status

A2B_DETAILED_REVIEW_READY
A2B_OWNER_IDENTITY_CONTRACT_REQUIRED
A3A_BOUNDED_QUICK_NORMAL_PLAN_READY
A1_OWNER_DECISION_GATE_ACTIVE
NO_PRODUCT_MUTATION
FIVE_PORT_E2E_FROZEN
SECOND_SMT_TEAM_PAUSED
