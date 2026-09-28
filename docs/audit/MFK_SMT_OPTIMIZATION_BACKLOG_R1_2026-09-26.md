# MFK SMT Optimization Backlog R1

DATE: 2026-09-26
TIME_HKT: 10:37+
MODE: AUDIT / INTEGRATION PLANNING ONLY
TEAM_STATUS: PAUSED_BY_OWNER
CONTROL: Pantonyeung/mfk #321

CURRENT AUTHORITY:
docs/control/MFK_PUBLIC_SMT_ACCEPTANCE_MAIN_PRESERVATION_LOCK_2026-09-26_1037_HKT_R4.md

## 1. Hard rule

The second SMT team is paused.

No new SMT donor development starts from its old branches.

Current main remains the destination and product baseline.
Admin / SMT / SMM / Customer / Keeta E2E are locked.
Owner remains NOT_CONNECTED.

Public SMT acceptance changes for SMM / Customer / Admin / Keeta are already in main and protected by the integrated-main regression guard.

## 2. Backlog classification

- BASELINE_NO_TOUCH
- DONOR_GREEN_UNMERGED
- DONOR_PARTIAL_OR_RED
- OPTIMIZATION_NEEDS_OWNER_SELECTION
- REAL_FUTURE_GAP
- NOT_A_GAP_BASELINE_ALREADY_EXISTS
- DEFERRED

## 3. Baseline — no work / no donor overwrite

These are current-main facts and are not optimization backlog items:

1. Public Web SMT acceptance isolation.
2. Production Customer / Keeta consumer installation outside acceptance mode.
3. SMM LAN ingress and readback identity.
4. SMM Web acceptance path and ACK hardening.
5. Customer menuRevision / published-price validation.
6. Customer payment-evidence reference and UNKNOWN/readback-first.
7. Customer → SMT canonical Order path.
8. Admin-published menu/config sync into SMT.
9. Customer / Keeta global arrival alerts + sound.
10. Orders source lanes:
    現場訂單 / 自家平台 / 第三方平台.
11. Existing SMT shell/header/rail and connected-info projections.
12. Existing local Order / Pricing / Payment / Fulfillment / Print authority.
13. Existing Day Close / diagnostics / backup-restore baseline capabilities.
14. Keeta connected provider lifecycle.
15. Five-port E2E acceptance baseline.

Classification: BASELINE_NO_TOUCH.

## 4. Paused-team work already completed enough to review as donors

### O1 — Human-Centered UI R1 / R3 (#171)
Status:
- OPEN / UNMERGED
- source candidate c715d033275974ce6980e3943289a477ceead506
- tests/build/public preview GREEN
- Owner final acceptance not banked

Delivered:
- Quick / Standard ordering mode
- search
- one product editor
- same-line cart edit
- one-screen checkout
- larger keypad / quick cash
- clearer work/orders/more hierarchy
- accessibility/focus/reduced-motion improvements

Conflict/supersession:
- its nav 點單/工作/訂單/狀態/更多 is older than later Owner FINAL navigation.
- must not replace current main shell/header automatically.

Classification:
DONOR_GREEN_UNMERGED / OPTIMIZATION_NEEDS_OWNER_SELECTION.

### O2 — Owner FINAL Frontline V2 (#283)
Status:
- CLOSED preview / NOT MERGED
- base product candidate a5295009ab4afc3183009818359d2233d841258b
- 34/34 test files, 151/151 tests GREEN in recorded preview

Use:
- later Owner FINAL frontline composition reference.
- compare targeted behavior only; do not replay whole branch.

Classification:
DONOR_GREEN_UNMERGED.

### O3 — Order Correction + Refund V3 (#289)
Status:
- CLOSED preview / NOT MERGED
- exact product donor ab1c7132dcecaa674e304d7a446094bd76887e4b
- 37/37 test files, 169/169 tests GREEN

Delivered donor semantics:
- SAME Order payment correction
- old tender audit / new effective tender
- Full / Partial linked refund
- cash refund cash-movement behavior
- cancellation notice after production print
- no auto drawer/reprint on correction/cancel

Classification:
DONOR_GREEN_UNMERGED / HIGH-RISK MONEY OPTIMIZATION.
Do not integrate before lower-risk presentation items unless Owner selects it.

### O4 — Dining Settlement Safety R2 (#293)
Status:
- OPEN DRAFT / UNMERGED
- product candidate 5b109349e12b219be542222dede850ecbe74aabb
- recorded GREEN: 38 files / 187 tests + browser payment proof

Delivered:
- stable submissionId
- expectedRevision
- receivedMinor
- stale/quantity/money guards
- durable write before UI publication
- partial/full settlement preservation
- full-payment archive + release
- history/deletion protection

Not claimed:
- formal Dining Order
- Dining print/drawer
- cross-device atomicity
- seatedAt/Admin warning

Classification:
DONOR_GREEN_UNMERGED / RUNTIME OPTIMIZATION.

### O5 — Dining True Checkout / Recovery R3 (#297)
Status:
- OPEN DRAFT / UNMERGED
- product c5975e01d5a5501c6aaddb6d24186846fe9e45ae
- recorded GREEN: 187 unit + 10/10 Checkout + browser/offline build proof

Delivered:
- real OperationalApp → Dining → Checkout flow
- dining source lock
- resumable UI intent
- unpaid reload restores same identity
- paid reload reads original payment without resubmission
- stale/storage actionable errors

Not done:
- formal Dining Order link
- production admission/print/receipt/label/drawer
- cross-device concurrency
- native power recovery
- full COMBO tender detail
- seatedAt/Admin warning
- Safari device acceptance

Classification:
DONOR_GREEN_UNMERGED / RUNTIME OPTIMIZATION.

### O6 — 暫存／堂食 Single Entry R4 (#301)
Status:
- OPEN DRAFT / UNMERGED
- exact tested candidate 175749edb29a2079651c659fea80762f725b51f3
- 39/39 files, 192/192 tests, browser 9/9 GREEN

Delivered:
- single 暫存／堂食 entry
- any dine-in line → default Dining
- all takeaway → default Hold
- staff can manually override both ways
- clear cart reduced to small trash action
- no Order/Payment authority change

Classification:
DONOR_GREEN_UNMERGED / LOW-RISK PRODUCT OPTIMIZATION.
Strong candidate for early integration after Owner confirms.

### O7 — Dining Control Reconcile R5 (#305)
Status:
- OPEN DRAFT / UNMERGED
- exact candidate 5fc6581431df15927a613b06a6e41090b621a88b
- 40/40 files, 196/196 tests GREEN

Delivered:
- Admin-published dining table registry in SMT selector/runtime
- active-only + sortOrder + custom table names
- fallback 1–9 if no published tables
- current source-lane mapping
- hide dine-in-only legacy Formal Orders from active Order board
- preserve R4 mindset

Classification:
DONOR_GREEN_UNMERGED / MEDIUM-RISK INTEGRATION OPTIMIZATION.

### O8 — Dining Full Chain R6 (#306)
Status:
- OPEN DRAFT / UNMERGED
- latest branch head 648eb2de368621eed7bf23cecebea0bef5ce075e
- latest proof RED: 233/236 tests PASS, 3 FAIL
- Cloudflare check also failed on latest head

Contains candidate work:
- Dining Hold ↔ SAME Formal Order
- automatic first production print
- table / production / packing / labels
- split payment history
- exact COMBO tender breakdown
- payment receipt certainty
- CASH-only drawer
- reprint drawer=false
- table transfer SAME Order
- Web Locks/local serialization
- PRICE_OVERRIDE + audit

Current blockers:
- W/H visible identity reuse tests fail
- price-override/history-protection contract mismatch
- no accepted final CI
- physical printer acceptance still required

Classification:
DONOR_PARTIAL_OR_RED.
Do NOT integrate until isolated sub-slices are replayed from current main and GREEN.

## 5. Work the paused team had NOT completed / not accepted

### N1 — Full R6 Dining production chain
Partially built, latest candidate RED.

### N2 — Cross-device Dining concurrency
Some candidate locking exists, but full accepted proof not banked.

### N3 — Native power-loss recovery for new Dining mutations
Not fully accepted.

### N4 — Physical printer acceptance for Dining tickets/receipts/labels/drawer
Not complete.

### N5 — Real seatedAt fact + Admin Dining Warning based on seated time
Not complete.

### N6 — Capacity Pool / Channel Threshold / operational override
Not complete as a full accepted product feature.

### N7 — Full reporting closure for later adjustments/effective tender
Baseline reporting exists; optimization closure is not fully accepted.

### N8 — General Cash In / Cash Out workflow
Baseline day-close/cash facts exist; complete frontline workflow is not fully accepted.

### N9 — Printer-failure Pending Action / attention experience
Print/diagnostics baseline exists; full operator-attention UX not accepted.

### N10 — Latest 2026-09-26 Figma R2 visual system in production code
Visual spec exists; code-level visual convergence has not been fully integrated/accepted.

### N11 — Owner connection
Not started; deferred by Owner.

## 6. Recommended optimization order

No code starts until Owner selects the first item.

### Phase A — low-risk, high-operator-value
A1. R4 暫存／堂食 single entry.
A2. same-line cart edit / independent cart-unit behavior / Combine UX where Owner confirms.
A3. selected Quick/Normal / Quick Drink / Fast Lane improvements.
A4. Admin table-registry presentation from R5.
A5. targeted display/ergonomic improvements that preserve current shell/header/data.

### Phase B — order operations
B1. Payment correction.
B2. Full/Partial refund.
B3. cancellation notice.

### Phase C — Dining reliability
C1. R2 settlement identity/stale/replay.
C2. R3 Checkout/reload recovery.
C3. cross-device/native restart proof.

### Phase D — Dining full chain
D1. Formal Order link / production admission.
D2. first print routes.
D3. payment receipt + CASH drawer.
D4. reprint.
D5. exact split tender.
D6. table transfer/restart/concurrency.

### Phase E — new features / finishing
E1. PRICE_OVERRIDE if still desired.
E2. seatedAt + Admin warning.
E3. capacity pool/threshold/override.
E4. cash/reporting/print-attention refinement.
E5. Figma R2 visual convergence.

## 7. Integration invariant for every item

LATEST MAIN
→ verify R4 protected hashes/seams
→ select ONE donor delta
→ clean branch from latest main
→ port delta only
→ integrated-main-e2e-lock test
→ V2 Local smoke
→ relevant SMM / Customer / Admin / Keeta regression
→ Owner acceptance
→ small merge
→ new dated bank

If the selected delta alters a protected E2E seam unexpectedly:
RED / STOP / NO MERGE.

## 8. Current status

SECOND_SMT_TEAM_PAUSED
SMT_OPTIMIZATION_BACKLOG_R1_READY
PUBLIC_ACCEPTANCE_MAIN_LOCK_PRESERVED
FIVE_PORT_E2E_NO_TOUCH
NO_NEW_DONOR_DEVELOPMENT
NO_WHOLESALE_MERGE

NEXT:
OWNER_SELECT_FIRST_SMT_OPTIMIZATION
