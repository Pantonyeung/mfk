# MFK SMT Master Optimization Execution Map R1

DATE: 2026-09-26
MODE: CONSOLIDATION / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: Pantonyeung/mfk #321

CURRENT AUTHORITY:
docs/control/MFK_PUBLIC_SMT_ACCEPTANCE_MAIN_PRESERVATION_LOCK_2026-09-26_1037_HKT_R4.md

## 1. Frozen baseline

NO-TOUCH E2E ports:
- Admin
- SMT
- SMM
- Customer
- Keeta

Owner:
- NOT_CONNECTED
- deferred

Public SMT acceptance deltas for SMM / Customer / Admin / Keeta are already in main and protected.

A1 current integration candidate:
PR #322
R4 暫存／堂食
READY_FOR_OWNER_ACCEPTANCE
NOT_MERGED

## 2. Master status map

| ID | Capability | Status | Risk | Dependency | Action |
|---|---|---|---|---|---|
| BASE-01 | Admin/SMT/SMM/Customer/Keeta E2E | BANKED_NO_TOUCH | critical | none | preserve |
| BASE-02 | Customer/SMM/Keeta intake to SMT | BANKED_NO_TOUCH | critical | none | preserve |
| BASE-03 | Order/Pricing/Payment/Fulfillment/Print authority | BANKED_NO_TOUCH | critical | none | preserve |
| BASE-04 | Web SMT acceptance isolation | BANKED_NO_TOUCH | high | none | preserve |
| A1 | 暫存／堂食 single entry | READY_OWNER_ACCEPTANCE | low | baseline | PR #322 |
| A4 | Admin table registry in hold selector | READY_TO_IMPLEMENT | low | A1 decision | one App presentation slice |
| A2a | SAME-line cart edit | READY_TO_IMPLEMENT | low-medium | A1/A4 | isolated cart edit |
| A2b | independent units + Combine OFF/ON | REVIEWED_SPLIT_REQUIRED | medium | A2a | separate cart identity milestone |
| A3a | Quick/Normal | FUTURE_OPTIMIZATION | medium | A2 | separate |
| A3b | Required Fast Lane | FUTURE_OPTIMIZATION | medium-high | A3a | separate |
| A3c | Quick Drink | FUTURE_OPTIMIZATION | medium | A3b | separate |
| A3d | Riceball/Combo pairing | FUTURE_OPTIMIZATION | high | A3b/c | separate |
| A3e | display prefs/guidance | FUTURE_OPTIMIZATION | low-medium | A3 | separate |
| B1 | Payment Correction | ISOLATABLE | medium | cart/ordering stable | bounded money milestone |
| B3 | Cancellation Notice | ISOLATABLE | medium-high | print certainty | separate |
| B2 | Full/Partial Refund | DEFERRED | high | cash/report closure | later |
| C1 | Dining R2 settlement safety | GREEN_DONOR | medium-high | baseline | stable payment identity milestone |
| C2 | Dining R3 Checkout/reload | GREEN_DONOR | medium-high | C1 | recovery milestone |
| D1 | Formal Order link/production admission | DONOR_UNIT_GREEN | high | C1/C2 | replay from main |
| D2 | Dining initial print/table ticket/reprint | SOURCE_UNIT_GREEN_PHYSICAL_PENDING | high | D1 | physical acceptance required |
| D3 | Dining receipt + CASH drawer | SOURCE_UNIT_GREEN_PHYSICAL_PENDING | critical | D1/D2 | physical acceptance required |
| D4 | exact split tender / COMBO cash | DONOR_UNIT_GREEN | high | C1 | money regression |
| D5 | serialization/table transfer | PARTIAL_PROOF | high | C1/C2 | real multi-device proof |
| D6 | W/H visible identity allocator | REAL_GAP | medium | none | fix independently |
| D7 | real seatedAt + Dining warning | REAL_GAP | medium | table assignment truth | new durable fact |
| E1 | Capacity warning | BASELINE_COMPLETE | low | none | no touch |
| E2 | Capacity Pool / Channel Threshold / Override | REAL_GAP | high | Owner semantics | later |
| E3 | Cash Opening / Day Close | BASELINE_COMPLETE | critical | none | no touch |
| E4 | general Cash In/Out | REAL_GAP | high | cash authority | later |
| E5 | local report/CSV | BASELINE_COMPLETE | medium | none | no touch |
| E6 | adjustment/refund-aware reporting | REAL_GAP | high | B1/B2/E4 | later |
| E7 | print routing/diagnostics/reprint | BASELINE_COMPLETE | critical | none | preserve |
| E8 | print-truth wording/attention | OPTIMIZATION_CANDIDATE | low | none | UI semantic alignment only |
| E9 | Pending Action print workflow | REAL_GAP | medium | E7 | later |
| E10 | backup/restore | BASELINE_COMPLETE | high | none | no touch |
| V1 | Figma R2 code convergence | VISUAL_PENDING | low-medium | functional tree stable | visual-only |
| V2 | Figma screenshot QA | PENDING | low | V1/Figma read access | later |
| O1 | Owner connection | DEFERRED | high | SMT stable | last |

## 3. Second SMT team donor disposition

#171:
- GREEN presentation donor
- partial/outdated navigation
- useful for SAME-line edit / ergonomic references
- no wholesale merge

#283:
- Owner FINAL Frontline preview donor
- GREEN recorded
- reference only by targeted slice

#289:
- Payment Correction / Refund donor
- GREEN recorded
- split B1/B2/B3 before use

#293:
- Dining R2 GREEN donor
- preserve stable payment/replay semantics

#297:
- Dining R3 GREEN donor
- preserve reload/recovery semantics
- depends on R2

#301:
- A1 R4 donor
- targeted replay already exists as PR #322

#305:
- Admin table/source-lane reconcile donor
- current main already contains stronger runtime table registry
- only hold-selector presentation mismatch remains

#306:
- RED monolithic donor
- 233/236 PASS, 3 FAIL
- useful only as sub-slice source
- no wholesale merge
- no new development while team paused

## 4. Current safe execution path

### Stage 0 — Owner decision
Review/accept A1 PR #322.

### Stage 1 — low-risk frontline alignment
A4
→ A2a
→ optional E8 print-truth wording

### Stage 2 — cart/operator model
A2b
→ A3a
→ A3b
→ A3c
→ A3d
→ A3e

### Stage 3 — order operations
B1
→ B3

B2 remains deferred.

### Stage 4 — Dining reliability
C1
→ C2

### Stage 5 — Dining full chain
D1
→ D2 physical
→ D3 physical
→ D4
→ D5
→ D6
→ D7

### Stage 6 — cash/report/capacity closure
E4
→ E6
→ B2
→ E2
→ E9

### Stage 7 — visual finish
V1
→ V2

### Stage 8 — Owner
O1 only after SMT stable.

## 5. Mandatory merge discipline

For every selected item:

LATEST MAIN
→ verify R4 protected E2E seams
→ clean branch
→ targeted delta only
→ deterministic focused tests
→ integrated-main-e2e-lock test
→ V2 Local smoke
→ relevant SMM / Customer / Admin / Keeta regression
→ Owner acceptance
→ small merge
→ new dated bank

Any unexpected protected seam change:
RED
NO MERGE

## 6. Explicit non-goals

Do not:
- reopen completed five-port E2E
- rebuild backend authority
- merge old SMT donor branch wholesale
- conflate transport ACK with physical print truth
- turn capacity warning into a transaction blocker without a new Owner decision
- integrate Refund before cash/reporting closure
- integrate R3 before R2
- integrate R6 monolith
- let Figma redefine transaction semantics

## 7. Current status

SMT_MASTER_OPTIMIZATION_EXECUTION_MAP_R1_READY
SECOND_SMT_TEAM_PAUSED
FIVE_PORT_E2E_FROZEN
A1_WAITING_OWNER_ACCEPTANCE
NO_PRODUCT_MUTATION
