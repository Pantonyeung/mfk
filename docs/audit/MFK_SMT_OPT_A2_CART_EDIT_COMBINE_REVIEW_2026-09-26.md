# MFK SMT Optimization A2 Review｜Cart Edit + Independent Units + Combine

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: #321
BASELINE: current main 479cdb87934af02caa5c288608bdb2e3dbe999ca
A1: PR #322 READY_FOR_OWNER_ACCEPTANCE / NOT MERGED

## 1. Scope reviewed

A2 in the optimization backlog was initially grouped as:
- SAME-line cart edit
- independent cart-unit identity
- Combine UX

Fresh source review shows these should NOT be integrated as one slice.

They have different risk and dependency profiles.

Therefore A2 is split:

A2a = SAME-LINE CART EDIT
A2b = INDEPENDENT CART UNITS + COMBINE OFF/ON

## 2. Current main reality

### Current add behavior
Current main App.tsx:
- plain product add searches existing cart line by productId + serviceMode;
- if found, increments qty;
- otherwise creates a new line.

So current main does NOT preserve one independent cart identity per tap for identical plain products.

### Current edit behavior
Current main:
- cart line click opens ProductConfigWorkspace;
- panel does NOT carry lineId into the product editor;
- addConfigured() always creates a new CartLine and appends it.

Therefore current UI has an edit affordance, but configured edit does not update the same cart line.

This is a product UX gap, not permission to alter Order/Pricing/Payment authority.

## 3. Donor evidence — A2a SAME-line edit

PR #171 contains a bounded implementation:
- Product panel carries lineId;
- existing line becomes editor initial state;
- addConfigured(..., lineId?) updates cart.map(...) when editing;
- preserves the existing line serviceMode;
- no runtime/Order/Payment/Print authority change.

Later donor lineage also contains a more evolved version with:
- explicit edit mode;
- initial selections;
- initial unit price;
- save-modification copy;
- focused regression test.

Risk:
LOW–MEDIUM.
Mostly App + ProductConfigWorkspace presentation/model.

Recommendation:
A2a should be a standalone optimization before A2b.

## 4. Donor evidence — A2b Independent units / Combine

Later SMT donor lineage changes more than one behavior:
- every new product tap creates a new cart line identity;
- Combine defaults OFF;
- Combine ON is presentation grouping, not destructive identity merge;
- grouped rows carry sourceLineIds;
- line actions accept one-or-many source IDs;
- remove/qty/service-mode/edit semantics must understand grouped vs independent lines;
- cart header adds Combine toggle.

This is substantially wider than A2a.

Files / seams affected in donor lineage include:
- App.tsx cart-add behavior
- ordering-workspace-model.ts
- OrderingWorkspace.tsx
- cart presentation/grouping logic
- cart action signatures
- possibly fast-lane cart types in later donor generations

Risk:
MEDIUM.
It remains frontend/cart-workspace behavior, but it changes cart identity and operator semantics throughout the ordering screen.

Recommendation:
Do NOT bundle A2b with A2a.
Implement only after A2a is accepted/banked.

## 5. Baseline protection

Neither A2a nor A2b may modify:
- Customer SMT intake
- SMM LAN / SMM Web acceptance
- Admin sync runtime
- Keeta intake
- v2local main runtime installation gates
- Customer runtime
- SMM adapter
- Store Kernel / Order / Pricing / Payment / Fulfillment / Print authority

A2b must also prove checkout, hold/dining, and printing receive the exact same final cart content/price as before.

## 6. Proposed execution order

A2a:
SAME-line edit only
→ clean branch from latest main after A1 decision
→ focused tests
→ integrated-main E2E guard
→ V2 Local Smoke
→ Owner acceptance
→ merge/bank

A2b:
independent lines + Combine OFF/ON presentation
→ separate clean branch
→ identity/grouping tests
→ hold/dining/checkout cart-total regression
→ integrated-main E2E guard
→ V2 Local Smoke
→ Owner acceptance
→ merge/bank

## 7. Decision

A2a = RECOMMENDED NEXT LOW-RISK OPTIMIZATION
A2b = SEPARATE FOLLOW-UP; DO NOT COUPLE

No code written in this review.

STATUS:
A2_REVIEW_COMPLETE
A2_SPLIT_LOCKED_FOR_INTEGRATION_PLANNING
FIVE_PORT_E2E_PRESERVED
SECOND_SMT_TEAM_PAUSED
