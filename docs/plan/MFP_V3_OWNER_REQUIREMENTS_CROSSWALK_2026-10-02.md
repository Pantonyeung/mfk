# MFP V3｜Owner Requirements Crosswalk｜2026-10-02

Status: CURRENT / CONTROLLING PRODUCT CROSSWALK
Product: MoreFun POS (MFP)
Purpose: prevent Owner FINAL requirements from disappearing during the V3 rebuild.

## 0. Source precedence

1. `Owner_對_SMT_端口要求_FINAL_V1.0`
   - canonical Owner product behavior
   - OWNER PRODUCT REQUIREMENTS COMPLETE
2. `Owner_SMT_Requirements_Working_V2.5`
   - detailed decision/change-history evidence
   - use to resolve exact historical Owner intent when FINAL is concise
3. `smt優化ui`
   - historical implementation / acceptance evidence + UX donor
   - does not override FINAL
   - useful for identifying proven interaction patterns and legacy acceptance gaps

## 1. Current MFP crosswalk result

Current carry-forward issues: 16

- 1 direct semantic conflict to resolve
- 12 canonical Owner requirement groups not explicit enough in the current A0-A9 stage handoffs
- 3 historical Owner UI acceptance constraints not yet carried into the A4 product UI gate

### 1.1 Direct semantic conflict

Owner FINAL:
authorized SMT login => authorized SMT operations listed in the FINAL; no Manager-only gate for that product version.

MFP A2:
granular permission plumbing exists for security/admission.

Resolution:
- keep action-time permission infrastructure and server-side fail-closed admission;
- for this Owner product version, the canonical MFP staff policy must grant the Owner-listed SMT/MFP operational capabilities to every successfully authorized MFP staff session;
- do not introduce a Manager-only UX gate for those listed operations unless Owner issues a later product change;
- permissions remain security facts, not a new product-role restriction invented by the client.

## 2. A4 stage closure blockers

A4 implementation slice at SHA `5e4118c003bef84a5e0262d5ac925537c4686ff3` is SOURCE_VERIFIED for its declared ordering-domain slice.

A4 stage closure remains BLOCKED until these Owner carry-forward items are completed in the same A4 lane:

### A4-C1 Display Settings
Must include:
- category rows / density
- category count/columns as applicable
- product rows/columns
- product image show/hide
- font size
- continuous overall UI density/scale
- immediate preview
- persistence across restart
- visual-only effect; no business truth mutation

### A4-C2 High-frequency navigation + More entry
High-frequency primary navigation:
- Ordering
- Orders
- Dining
- Sold-out/Capacity

Low-frequency More/Tools:
- top hamburger entry
- do not consume a primary high-frequency navigation slot

A4 only needs the shell/navigation structure; later pages may remain staged placeholders until their assigned stage.

### A4-C3 Major modal geometry
For Pad major operation modals:
- approximately 75% of usable interface
- content scrolls internally
- bottom primary action remains fixed
- stable muscle-memory geometry
- edit existing cart line must say/save as modification, not add a duplicate line

Mobile may use a mobile-appropriate sheet, but must preserve stable action placement and same semantics.

### A4-C4 Exact cart semantics
Must carry:
- sequence-number preview only; opening cart must not allocate a formal order number
- ORIGINAL view = original input order
- ORGANIZED view = Product Category order
- ORGANIZED != COMBINE
- COMBINE only exact-equivalent configuration
- per-line dine-in/takeaway state
- whole-cart dine-in/takeaway switch
- combined line quantity stepper
- uncombined lines remain independent
- delete action
- no formal Order identity in draft

### A4-C5 Hold / Retrieve / Dining entry
Must carry the Owner frontline mindset:
- cart with items: Hold / Dining entry + lower-weight destructive clear
- all takeaway => default Hold
- any dine-in => default Dining
- user can manually switch Hold <-> Dining
- empty cart => Retrieve
- held draft can be restored
- formal dining Order admission remains A6; A4 only owns the draft interaction shell

### A4-C6 Exact Fast Lane behavior
Must carry:
- Quick Pair
- Required area
- Rice/Combo shortcut area
- positional auto-pair only
- no smart recommendation
- swap assignment, not duplicate assignment
- unequal counts => pair complete sets only; residual items remain singles
- explicit combo operation required before a single item becomes combo
- Required choices come from canonical product configuration
- quick mode may defer required choices, but unresolved required state remains explicit

### A4-C7 Product UI acceptance baseline
Historical Owner UI acceptance constraints to carry:
- professional restaurant POS
- blue visual baseline
- red reserved for destructive / error / true warning
- large touch targets for high-frequency actions
- stable geometry / muscle memory
- Silent Guided Flow: visual focus, not wizard-style Next/Previous
- preserve human override where Owner locked it

These are presentation/acceptance constraints and do not create a new business authority.

## 3. Owner FINAL requirement allocation A4-A9

### A4 Ordering Surfaces
- Main navigation shell / More entry
- Display settings
- Cart exact semantics
- Hold/Retrieve/Dining draft entry
- Fast Lane / Required / combo shortcut UX
- Product configuration modal
- Quick mode local required-state handling
- Pad + Mobile formal ordering UI

### A5 Checkout + Money
- Required must block formal checkout
- Checkout layout
- channel/source selection
- tender selection
- cash keypad / received / change
- Student Discount exact rule
- final payment review
- Payment Confirm formal boundary
- duplicate confirmation protection
- Business Day money semantics
- Day Close
- denomination counting
- Cash In / Cash Out
- retained cash / next opening cash
- channel/tender summaries
- current effective tender reporting semantics
- daily-report money facts

### A6 Order Operations
- Orders page / 3 source lanes / filters
- fulfillment READY/recall
- order modification + customer confirmation
- payment-method correction on same Order
- full/partial refund
- cancel notice after kitchen dispatch
- dining lifecycle / waiting / table assignment
- split settlement orchestration back into shared Checkout
- sold-out/restore
- Capacity Pool
- per-channel thresholds
- bounded override
- business-day reset
- cancel replenish exactly once
- ETA active-load calculation / ready timing

### A7 Print + Hardware + Recovery
- Admin logical routing vs local physical printer binding
- published template selection
- receipt / production / packing / label
- whole-ticket reprint
- per-label partial reprint
- dining print / receipt / labels
- cash drawer
- printer failure attention
- native restart / power-loss print recovery
- no blind auto-reprint

### A8 Customer + Keeta + External
- Customer pending review
- payment screenshot evidence (not payment truth)
- WhatsApp QR / contact template
- customer modification/cancel notification
- Customer cutoff / immediate stop
- Customer submit failure WhatsApp fallback
- Keeta auto/manual intake
- Keeta error pending + top/attention
- defer max 2
- provider mapping/readback
- channel threshold external effects

### A9 Public + Diagnostics + Physical Acceptance + Cutover
- More/Tools completion
- reporting/history presentation + Owner projection readback
- immutable daily report + linked later adjustment presentation
- Admin sync status
- diagnostics/check center
- backup/restore
- cross-device concurrency acceptance
- Safari/device acceptance
- offline end-to-end acceptance
- public MFP security/routing
- OTA / rollback / physical cutover
- legacy SMM decommission gate

## 4. Historical 25-gap mapping

Legacy UI document listed 25 incomplete areas. None may disappear:

1. Formal Dining Order Link -> A6
2. Dining unpaid Production Admission -> A6/A7
3. Dining Print -> A7
4. Dining Receipt -> A7
5. Dining Label -> A7
6. Dining Cash Drawer -> A7
7. Cross-device concurrency -> A6/A9
8. Native power-loss recovery -> A7/A9
9. Complete COMBO Tender Detail -> A5
10. Real SeatedAt -> A6
11. Admin Dining Warning -> A6
12. Safari / physical Dining acceptance -> A9
13. Sold-out/Restore full UI -> A6
14. Capacity Pool -> A6
15. Channel Threshold -> A6/A8
16. Override -> A6
17. More/Tools Center -> A9
18. Day Close -> A5
19. Cash In/Cash Out -> A5
20. Reporting -> A5 facts / A9 presentation+acceptance
21. Immutable Daily Report + Later Adjustment -> A5/A9
22. Printer Failure Attention -> A7
23. Diagnostics -> A9
24. Backup/Restore -> A9
25. Offline/WhatsApp Fallback -> A3/A8/A9

## 5. A4 acceptance rule

A4 implementation slice:
`SOURCE_VERIFIED`

A4 stage closure:
`BLOCKED`

Reason:
A4-C1 through A4-C7 are not all implemented in the current A4 candidate.

Do not advance to A5 until:
- A4-C1..C7 implemented
- tests added
- exact-head CI green
- A4 Owner crosswalk closure report attached to PR #639

## 6. No-scope-loss rule

Every later Stage completion report must include:
- Owner FINAL sections satisfied
- Owner FINAL sections carried forward
- historical gap IDs closed
- remaining product blockers
- exact source SHA
- tests/CI
- production-binding status

MILESTONE:
`MFP_V3_OWNER_REQUIREMENTS_CROSSWALK_CURRENT_2026_10_02`
