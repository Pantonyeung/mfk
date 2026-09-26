# MFK SMT Optimization A3 + A4 Review｜Quick/Fast Lane + Admin Table Registry

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: #321
CURRENT MAIN: 479cdb87934af02caa5c288608bdb2e3dbe999ca
A1: PR #322 READY_FOR_OWNER_ACCEPTANCE / NOT MERGED

## 1. A3 — Quick / Normal + Quick Drink + Fast Lane

Initial backlog wording made A3 look like a normal presentation optimization.

Fresh source review shows it is much larger.

### Current main

Current main has:
- work-bar entries for 飯團待組區 / 必選區 / 紫米套餐區;
- basic product configuration;
- basic combo projection.

But current main does NOT contain these later donor modules/contracts:
- v2local/src/features/ordering/FastLaneWorkspaces.tsx
- v2local/src/features/ordering/fast-lane-model.ts
- v2local/src/runtime/frontline-ui-preferences.ts
- contracts/order-line-composition-v1.ts

Therefore the donor Quick/Fast-Lane system is not a small visual transplant.

### Donor scope

Later R4/R5 donor includes:
- Quick / Normal ordering mode;
- Quick Drink drawer;
- pending drink targets;
- Required Fast Lane;
- Combo Fast Lane;
- Riceball Pool auto-pairing;
- line optionSelections / freeNote / comboDraft;
- structured line composition snapshot;
- display preferences;
- guidance target / silent next-step flow.

This affects:
- cart-line shape;
- product-add semantics;
- required-option completion;
- combo composition;
- hold persistence / restore;
- checkout serialization;
- presentation model/action signatures.

### Decision

A3 must NOT be implemented as one optimization.

Split it into:
- A3a Quick / Normal interaction contract
- A3b Required-option Fast Lane
- A3c Quick Drink
- A3d Riceball / Combo pairing
- A3e display preferences / guidance

Each needs separate acceptance and proof that final cart content/pricing remains identical to Admin-published truth.

Classification:
LARGE_OPTIMIZATION / DEFER UNTIL SMALLER SLICES ARE BANKED.

## 2. A4 — Admin Table Registry in hold/dining selector

Fresh review found current main is already much closer than the old donor narrative suggested.

### Already baseline in current main

Current main already has:
- SmtStoreSettings.diningTables;
- readSmtDiningTableRegistry();
- localRuntime.readDining() consumes the Admin-published table registry;
- active table filtering;
- Admin custom table names;
- 1–9 fallback when there is no registry;
- orphan occupied table protection.

Therefore Admin table authority is already connected and must NOT be rebuilt.

### Exact remaining mismatch

Current App.tsx OrderingPage still builds holdTables with hard-coded:
T01 … T09
labels 1 … 9

That means:
- main Dining board uses Admin table truth;
- the ordering-side「暫存／堂食」hold selector can still show hard-coded 1–9.

This is a presentation consistency mismatch, not an E2E/runtime gap.

### Donor R5

R5 candidate 5fc6581431df15927a613b06a6e41090b621a88b contains the bounded pattern:
- use storeSettings.diningTables when present;
- preserve Admin id / display name / sort order;
- fallback to T01–T09 only when no published table list;
- calculate occupied state against existing holds.

### Decision

A4 can be reduced to ONE targeted App.tsx presentation change.

Do not port R5 runtime wholesale.
Do not change localRuntime.readDining(), because current main already has the stronger Admin-registry behavior.

Classification:
SMALL_LOW_RISK_OPTIMIZATION.

## 3. Revised priority after continued review

Current recommended order:

1. A1 R4 暫存／堂食 — already PR #322, waiting Owner acceptance.
2. A4 Admin table registry in hold selector — smallest next slice.
3. A2a SAME-line cart edit.
4. A2b independent cart units + Combine.
5. A3 split Quick/Fast-Lane program, one sub-slice at a time.
6. Money / refund / Dining reliability after presentation/cart slices.

Reason:
A4 reuses authority already in current main and only removes a UI inconsistency.
A3 introduces the widest new cart-composition model and should not be rushed.

## 4. E2E guard

A4 must leave byte-identical:
- customer-cloud-intake
- smm-lan-ingress
- smm-web-acceptance-intake
- admin-config-sync runtime
- keeta-order-intake
- main runtime installation gates
- Customer runtime
- SMM adapter

A3 future work needs stronger cart-content regression:
Admin published product/options/price
→ SMT cart composition
→ hold/restore
→ checkout
→ final canonical Order
must remain equivalent.

## 5. Status

A3_RECLASSIFIED_LARGE_SPLIT_REQUIRED
A4_REDUCED_TO_SMALL_PRESENTATION_ALIGNMENT
FIVE_PORT_E2E_PRESERVED
SECOND_SMT_TEAM_PAUSED
NO_PRODUCT_MUTATION_IN_THIS_REVIEW
