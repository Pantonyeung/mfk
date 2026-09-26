# MFK Five-Port E2E Lock Baseline R2

DATE: 2026-09-26
REVISION: R2
STATUS: CURRENT_DATED_AUTHORITY
SUPERSEDES:
- docs/audit/MFK_SMT_OWNER_REQUIREMENT_CANDIDATE_AUDIT_R1_2026-09-26.md where it classified later SMT-team work as BANKED_LINEAGE_GAP
- any same-date wording that implies PR #171 / #306 must be restored into the baseline before optimization

## 1. Owner correction

The newer SMT team's work is PRODUCT OPTIMIZATION on top of the existing MFK baseline.

It is NOT the definition of the baseline itself.

Therefore:
- do not treat PR #171 / #306 as missing E2E baseline that must be restored first;
- do not use their absence from current main to downgrade the accepted SMT E2E state;
- do not wholesale merge them;
- evaluate them only as optional optimization donors against the locked baseline.

## 2. Exact locked baseline

Current main at lock time:
- main SHA: 5224e373e01cfad91fcebdc797b18da016ba1c2c

Product-code baseline:
- c91eddf9a4c2835a2115d750494c00c63bca0447

Compare c91eddf... → 5224e373...:
- product code drift: ZERO
- intervening changes: documentation/control files only

Immutable bank branch:
- bank/MFK/FIVEPORT-E2E-LOCK-R2-2026-09-26
- bank SHA: 5224e373e01cfad91fcebdc797b18da016ba1c2c

This branch is a snapshot reference and must never be moved.

## 3. Five connected ports — 100% protected

Admin = E2E CONNECTED / COMPLETE BASELINE / BANKED
SMT = E2E CONNECTED / COMPLETE BASELINE / BANKED
SMM = E2E CONNECTED / COMPLETE BASELINE / BANKED
Customer = E2E CONNECTED / COMPLETE BASELINE / BANKED
Keeta = E2E CONNECTED / COMPLETE BASELINE / BANKED

Owner = NOT_CONNECTED / connection not started

Locked deployed/banked references:
- Customer Version: f963f96c-a0f7-46a4-b762-88b846bd91cc
- SMM Web Version: d82889dd-613e-43dd-881b-33a842ba3e9a
- SMT Web acceptance Version: d74eefe6-8584-4fb9-9b52-759c362366a5
- Admin Version: 621400a9-63ca-4071-8138-be740e2b4ad8
- Keeta functional anchor: bb2b34e0f35b00ca374de0f4ca8d713ebd848684

SMT Web acceptance version is not the physical shop Current/Boot Runtime version.

## 4. What “locked” means

The baseline may be optimized, but an optimization must not remove or redefine any accepted E2E behavior.

NO-TOUCH business truth:
- Store Kernel / Formal Order authority
- Pricing / Frozen Quote authority
- Payment / Tender authority
- Fulfillment truth
- Print Admission / Durable PrintJob / Printer Router
- Admin publish/config authority
- Customer → SMT connected E2E path
- SMM → SMT connected E2E path
- Keeta → SMT connected E2E/provider path
- submissionId / idempotency / readback safety
- UNKNOWN/readback-first safety
- source classification
- accepted reconnect/recovery semantics
- completed Customer/SMM data and workflow adjustments
- Admin requirements already required by those connected flows
- existing Web Acceptance isolation safety

Any optimization that changes one of these is RED unless a new reproducible defect and dated Owner approval explicitly opens that exact semantic.

## 5. Optimization model

From now on:

LOCKED MAIN BASELINE
→ SMT optimization proposal
→ compare with bank branch
→ allowed delta only
→ cross-port regression
→ Owner acceptance
→ small main merge
→ new dated bank

Never:
OLD SMT cumulative branch
→ bulk merge main

Never:
optimization convenience
→ rewrite Customer/SMM/Admin/Keeta contracts

## 6. SMT team work classification

PR #171:
- optimization donor only
- OPEN / UNMERGED
- may contribute targeted UI/UX ideas
- not authority

PR #306:
- optimization donor only
- DRAFT / OPEN / UNMERGED
- mixes UI + Dining + runtime + money/print changes
- latest head 648eb2de368621eed7bf23cecebea0bef5ce075e is RED
- no wholesale merge
- any accepted feature must be independently replayed from current locked main

Its latest RED evidence includes:
- 233/236 tests pass; 3 fail
- visible W/H identity reuse failures
- price-override/history-protection expectation mismatch

## 7. Optimization priority

First task is NOT “restore PR #306 into main”.

First task is:
1. review Owner's SMT optimization requirements;
2. map each requirement to current locked baseline;
3. mark:
   - ALREADY_BASELINE
   - PURE_OPTIMIZATION
   - OPTIONAL_DONOR
   - NEW_PRODUCT_FEATURE
   - CONFLICT_WITH_BASELINE
   - OWNER_DECISION_REQUIRED
4. only implement the gaps Owner still wants.

## 8. E2E regression gate

Every SMT optimization landing must prove no regression to:
- Admin
- SMT
- SMM
- Customer
- Keeta

If cross-port regression evidence is missing, do not merge.

## 9. Current status

FIVE_PORT_E2E_BASELINE_LOCKED_R2
CURRENT_MAIN_MATCHES_LOCKED_PRODUCT_BASELINE
SMT_TEAM_WORK_RECLASSIFIED_AS_OPTIMIZATION
OWNER_NOT_CONNECTED
NO_WHOLESALE_MERGE

NEXT:
SMT_OPTIMIZATION_REQUIREMENT_MATRIX_R2
