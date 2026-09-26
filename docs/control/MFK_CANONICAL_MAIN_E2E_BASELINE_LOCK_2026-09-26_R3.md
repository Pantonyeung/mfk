# MFK Canonical Main E2E Baseline Lock R3

DATE: 2026-09-26
REVISION: R3
STATUS: CURRENT_DATED_AUTHORITY
CONTROL: Pantonyeung/mfk #321

SUPERSEDES:
- docs/control/MFK_E2E_FREEZE_DATE_AUTHORITY_2026-09-26_0935_HKT.md
- docs/control/MFK_FIVEPORT_E2E_LOCK_BASELINE_R2_2026-09-26.md
- docs/control/MFK_MAIN_E2E_BASELINE_LOCK_2026-09-26_R2.md
- any prior wording that treats the second SMT team's work as baseline restoration rather than optimization

## 1. Canonical baseline

The existing MFK implementation on current main is the canonical product baseline.

Verified:
- deployed/product baseline commit: c91eddf9a4c2835a2115d750494c00c63bca0447
- all commits after c91ed... up to the R2 governance state changed documentation/control files only
- zero product-code drift was found after c91ed...

Therefore:
- no product-code reconstruction is needed before optimization
- no donor branch is allowed to redefine what the baseline is
- current main product code is the source-of-truth baseline

## 2. Five E2E ports are locked

Admin = E2E CONNECTED / COMPLETE BASELINE / LOCKED
SMT = E2E CONNECTED / COMPLETE BASELINE / LOCKED
SMM = E2E CONNECTED / COMPLETE BASELINE / LOCKED
Customer = E2E CONNECTED / COMPLETE BASELINE / LOCKED
Keeta = E2E CONNECTED / COMPLETE BASELINE / LOCKED

Owner = NOT_CONNECTED / connection not started

These five connected ports are 100% NO-TOUCH at authority/E2E level.

## 3. Locked references

Customer Version:
f963f96c-a0f7-46a4-b762-88b846bd91cc

SMM Web Version:
d82889dd-613e-43dd-881b-33a842ba3e9a

SMT Web acceptance Version:
d74eefe6-8584-4fb9-9b52-759c362366a5

Admin Version:
621400a9-63ca-4071-8138-be740e2b4ad8

Keeta functional source anchor:
bb2b34e0f35b00ca374de0f4ca8d713ebd848684

The SMT Web acceptance version is not a claim about the exact physical shop Current/Boot Runtime version.

## 4. What is frozen

Optimization must not alter or remove accepted:
- Store Kernel / Formal Order authority
- Order / Display identity
- Pricing / Frozen Quote authority
- Payment / Tender authority
- Fulfillment truth
- Print Admission / Print Queue / Printer Router authority
- Admin publish/config authority
- Staff/RBAC authority
- Customer → SMT E2E path and data contract
- SMM → SMT E2E path and data contract
- Keeta → SMT provider/order path and data contract
- submission / idempotency / readback safety
- UNKNOWN/readback-first safety
- offline/restart recovery
- accepted Customer payment-evidence flow
- accepted source-lane semantics
- accepted Admin/SMM/Customer/Keeta adjustments already completed

Any optimization that touches these without a new reproducible defect and dated Owner approval is RED.

## 5. Second SMT team definition

The second SMT team's work is:

SMT_OPTIMIZATION_LAYER

It is built ON TOP OF this baseline.

PRs/branches such as #171 / #283 / #289 / #293 / #297 / #301 / #305 / #306 are:
- optimization donors
- Owner requirement experiments / previews
- unmerged candidate implementations

They are NOT:
- the baseline
- mandatory restoration sources
- permission to rewrite current E2E behavior

No cumulative branch may be merged wholesale.

## 6. Correct interpretation of the previous P1 audits

P1-1 / P1-2 / P1-3 / P1-4 remain useful as donor-location and risk-analysis documents.

They are now classified as:

OPTIMIZATION_CANDIDATE_AUDITS

They do NOT mean current main is incomplete E2E.
They do NOT mandate restoration.

A feature from those audits enters main only when the Owner selects that optimization for the next SMT version.

## 7. Future optimization workflow

CANONICAL LOCKED MAIN
→ choose one Owner optimization
→ fresh-read latest main
→ create clean branch from latest main
→ port only that optimization
→ deterministic tests
→ Admin/SMT/SMM/Customer/Keeta regression
→ Owner acceptance
→ small merge to main
→ create new dated bank
→ next optimization starts from the new main/bank

No optimization may force Customer/SMM/Admin/Keeta to be rebuilt.

## 8. Search precedence

For future decisions:
TOPIC
→ newest dated Owner authority
→ latest dated bank/main baseline
→ accepted E2E facts
→ optimization donor evidence
→ older historical documents only for provenance

Date/revision wins over words such as CURRENT / FINAL / MASTER / 主權.

## 9. Current status

CANONICAL_MAIN_E2E_BASELINE_LOCKED_R3
FIVE_PORT_E2E_NO_TOUCH
SECOND_SMT_TEAM_OPTIMIZATION_LAYER
NO_WHOLESALE_MERGE
OWNER_NOT_CONNECTED

NEXT:
SMT_OPTIMIZATION_BACKLOG_R1
