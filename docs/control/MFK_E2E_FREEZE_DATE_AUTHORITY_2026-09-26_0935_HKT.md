# MFK E2E Freeze + Dated Authority Rule

EFFECTIVE_DATE: 2026-09-26
EFFECTIVE_TIME_HKT: 09:35
STATUS: CURRENT_DATED_AUTHORITY
CONTROL_ISSUE: Pantonyeung/mfk #321

## 1. Canonical six-port model

MFK has six product ports:

1. Admin
2. SMT
3. SMM
4. Customer
5. Keeta
6. Owner

Current E2E status:

- Admin = E2E_CONNECTED / COMPLETE_BASELINE / BANKED
- SMT = E2E_CONNECTED / COMPLETE_BASELINE / BANKED
- SMM = E2E_CONNECTED / COMPLETE_BASELINE / BANKED
- Customer = E2E_CONNECTED / COMPLETE_BASELINE / BANKED
- Keeta = E2E_CONNECTED / COMPLETE_BASELINE / BANKED
- Owner = NOT_CONNECTED / CONNECTION_NOT_STARTED

“COMPLETE_BASELINE” means the accepted E2E path, authority boundaries, identities, business effects and recovery semantics are protected facts.
It does NOT mean the product can never evolve.
Optimization may continue only if the banked E2E behavior remains intact.

## 2. 100% fail-closed integration rule

For all five connected ports, the integration lane treats accepted E2E behavior as NO-TOUCH by default.

Without a new reproducible defect plus an explicit dated Owner decision, do NOT rebuild, replace, silently reinterpret, or remove any accepted:

- Store Kernel / Formal Order authority
- Pricing / Frozen Quote authority
- Payment / Tender authority
- Fulfillment truth
- Print Admission / Durable PrintJob / Router truth
- Admin publish/config authority
- Customer → SMT canonical intake semantics
- SMM → SMT canonical intake semantics
- Keeta → SMT canonical intake/provider semantics
- Submission / idempotency / readback identity
- UNKNOWN/readback-first safety
- accepted source-lane classification
- accepted E2E recovery behavior

Any integration candidate that conflicts with a banked fact is RED by default.

Required exception path:
NEW REPRODUCIBLE DEFECT
→ EXACT FIRST BREAK
→ DATED OWNER APPROVAL
→ BOUNDED CHANGE
→ CROSS-PORT REGRESSION
→ BANK NEW DATED BASELINE

No broad redesign is allowed as a repair.

## 3. Frozen deployed/banked references

Source freeze snapshot:
- branch: bank/MFK/FRONTLINE-GREEN-2026-09-26
- snapshot: 4c20a0ef4e9660494d8ad50f1357e4749bff3748
- deployed application-code baseline parent: c91eddf9a4c2835a2115d750494c00c63bca0447

Accepted runtime/application references:
- Customer: Version f963f96c-a0f7-46a4-b762-88b846bd91cc
- SMM Web: Version d82889dd-613e-43dd-881b-33a842ba3e9a
- SMT Web acceptance: Version d74eefe6-8584-4fb9-9b52-759c362366a5
- Admin: mfk-admin Version 621400a9-63ca-4071-8138-be740e2b4ad8
- Keeta: functional source anchor bb2b34e0f35b00ca374de0f4ca8d713ebd848684
- Owner: product source 7ac0c5778e2c2e84c3e61286fb41dd3574c272ad, NOT_CONNECTED

SMT Web acceptance version is NOT a claim about the exact physical shop Current/Boot Runtime version.

## 4. Cross-port work already completed is protected

The following recent work is part of the protected baseline and may not disappear when SMT evolves:

- SMM completed E2E behavior and current staff/frontline semantics
- Customer completed E2E behavior, local published-menu pricing, line repair, fresh payment evidence and bounded submit/fallback behavior
- Admin requirements already introduced to support Customer/SMM/SMT, including published configuration needed by those flows
- Keeta connected provider/order path and banked integration semantics
- Customer/SMT menuRevision validation repair
- existing Web Acceptance isolation rules

New SMT product work must consume these facts; it must not redefine them.

## 5. SMT evolution rule

The newer SMT team work is PRODUCT EVOLUTION on top of the banked SMT E2E baseline.

Current donor/candidate streams:
- PR #171 = OPEN / UNMERGED presentation/product candidate
- PR #306 = DRAFT / OPEN / UNMERGED Dining/full-chain/runtime donor

Neither PR is authoritative by itself.
Neither may be wholesale merged.
Owner requirements must first be audited against:
1. the dated frozen baseline,
2. current main,
3. PR #171,
4. PR #306,
5. later dated Owner decisions.

Only targeted accepted deltas may be ported onto a clean branch created from current main.

## 6. Date-precedence rule — mandatory for every future search

For any governance, handoff, authority, requirement or status lookup:

1. Identify the topic.
2. Find all relevant dated records.
3. Sort by EFFECTIVE_DATE first.
4. Within the same date, sort by explicit HKT time/revision, then Git commit/comment time.
5. Use the newest dated record as current authority.
6. Older dated records remain historical evidence only.
7. Any undated document is REFERENCE_ONLY and cannot override a dated record.
8. Words such as CURRENT, LATEST, AUTHORITY, 主權, CURRENT HANDOFF, FINAL or MASTER do NOT override a newer date.
9. A newer dated Owner decision supersedes an older document on the same subject even if the older filename says CURRENT.
10. Never use an old document to downgrade a capability that was implemented and accepted later.

Future authoritative filenames/titles must include at least:
YYYY-MM-DD

For same-day multiple authorities, include:
YYYY-MM-DD_HHMM_HKT

## 7. Search protocol

Before using any “current” project document:

SEARCH BY TOPIC
→ FILTER BY DATE
→ READ NEWEST DATED RECORD
→ CHECK explicit supersedes/no-redo instructions
→ only then inspect older documents for history or requirement provenance

Do not start from an undated/current-named document and assume it is current.

## 8. Current work order

1. Protect five connected E2E ports.
2. Do not start Owner connection yet.
3. Audit the Owner’s complete SMT requirements.
4. Compare those requirements with banked baseline + PR #171 + PR #306.
5. Classify only new SMT product gaps.
6. Integrate targeted deltas without changing banked E2E facts.
7. Cross-regression all five connected ports before every main landing.

Classification:
- BANKED_NO_TOUCH
- OPTIMIZATION_ON_BANKED_BASELINE
- IMPLEMENTED_UNMERGED
- PARTIAL_NEW_REQUIREMENT
- REAL_NEW_MISSING
- CONFLICT_WITH_BANKED_BASELINE
- OWNER_DECISION_REQUIRED

## 9. Current status

FIVE_PORT_E2E_BANKED_FROZEN
OWNER_NOT_CONNECTED
DATE_PRECEDENCE_RULE_LOCKED
SMT_NEW_PRODUCT_REQUIREMENTS_UNDER_AUDIT

NEXT:
SMT_OWNER_REQUIREMENT_AND_CANDIDATE_CONSOLIDATION_R1
