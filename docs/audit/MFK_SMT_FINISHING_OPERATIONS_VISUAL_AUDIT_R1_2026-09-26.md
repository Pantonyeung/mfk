# MFK SMT Finishing Operations + Visual Audit R1

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: Pantonyeung/mfk #321

CURRENT AUTHORITY:
docs/control/MFK_PUBLIC_SMT_ACCEPTANCE_MAIN_PRESERVATION_LOCK_2026-09-26_1037_HKT_R4.md

BASELINE:
Admin / SMT / SMM / Customer / Keeta E2E locked.
Owner NOT_CONNECTED.
A1 PR #322 remains READY_FOR_OWNER_ACCEPTANCE / NOT_MERGED.

This audit reviews the remaining operational/visual items after A/B/C/D decomposition.
It does not reopen completed baseline functions.

## 1. E1 — Capacity / Sold-out

### Already in current main

Current main already has:
- Admin capacity config projection:
  - dailyLimit
  - warningAt
  - hardStopConfigured
  - note
- capacityNoticeForCount(currentCount)
- visible warning in OrderingPage
- explicit current behavior: even if Admin has hard-stop configured, SMT currently treats it as a notice, not a transaction blocker
- canonical Availability read/set surface
- Sold-out / Paused / Available operations
- revision-guarded availability mutation

Therefore:
- capacity warning baseline exists
- sellability/availability control exists
- current local Order path must not be blocked by inventing a new capacity engine

### Not found as complete accepted feature

No current-main evidence for:
- Capacity Pool
- per-channel capacity allocation
- Channel Threshold
- automatic platform throttling by pool
- operational capacity override state
- capacity reservation/decrement authority

Classification:
BASELINE_CAPACITY_WARNING_COMPLETE
ADVANCED_CAPACITY_CONTROL_REAL_FUTURE_GAP

Recommendation:
Do not touch existing warning/sold-out behavior.
If Owner later wants advanced capacity controls, define them as a new bounded capability and explicitly preserve sellabilityAuthority=false / non-blocking transaction baseline unless a newer Owner decision says otherwise.

## 2. E2 — Cash / Day Close / Reporting

### Already in current main

Current main already has:
- cash opening record
- carry-forward suggestion from prior retained cash
- local business-day window
- local operational report
- net sales / cash sales / average / item ranking
- CSV export
- day close
- one close per business date
- counted cash
- cash removed
- retained cash
- cash difference
- day-close print
- day-close projection
- local backup / validation / restore

These are BASELINE_NO_TOUCH.

### Important current report model

Current report is based on:
- current Order totalMinor
- current Order paymentLabel
- business-window selection

This means:
- a future Payment Correction can naturally affect effective-tender reporting if paymentLabel is updated on the SAME Order
- but current report model has no local refund history / adjustment ledger input
- arbitrary Cash In / Cash Out movement is not represented as a general ledger surface

### Not complete / not proven

No complete current-main evidence for:
- general Cash In workflow
- general Cash Out workflow outside day-close removal
- linked refund cash-movement ledger
- immutable daily report plus later adjustment layer
- refund-aware net sales
- correction/refund adjustment history in reports
- reconciliation of negative manual deal truth into payout/refund semantics

Classification:
DAY_CLOSE_REPORT_BACKUP_BASELINE_COMPLETE
GENERAL_CASH_MOVEMENT_REAL_FUTURE_GAP
ADJUSTMENT_AWARE_REPORTING_REAL_FUTURE_GAP

Dependency:
B2 Refund remains blocked behind this closure.

## 3. E3 — Print Diagnostics / Pending Action / Physical Truth

### Already in current main

Current main already has:
- logical printer / physical binding
- LAN print dispatch
- multi-printer grouping
- per-job dispatch result
- physical-route diagnostic record
- elapsed time / error code
- reprint options
- manual selective reprint
- diagnostics center
- native printer test/apply surfaces
- action audit
- no second print queue/router

These are BASELINE_NO_TOUCH.

### Current limitation

Current main stores transport-level evidence:
- SENT / PRINT_FAILED
- route PASS / FAIL
- sent / planned count

This is useful diagnostic evidence.
It is NOT proof of physical paper output.

The later Owner print-truth correction says:
- transport success is not physical-paper truth
- kitchen/human visual confirmation is final authority for missing physical paper
- system must not auto-infer which physical ticket/label is missing
- manual reprint picker should remain neutral

Because R4 now locks current main, this is not an automatic mutation request.
It is a future semantic-UX alignment candidate.

### Not found

No current-main full operator Pending Action queue for:
- unresolved print uncertainty
- acknowledgement by staff
- explicit human-confirmed missing ticket
- persistent per-order print attention workflow

Classification:
PRINT_ENGINE_DIAGNOSTICS_BASELINE_COMPLETE
PRINT_TRUTH_WORDING_OPTIMIZATION_CANDIDATE
PENDING_ACTION_REAL_FUTURE_GAP

Recommendation:
If selected later, change wording/attention only.
Do not change printer transport authority or auto-reprint behavior.

## 4. E4 — Real seatedAt + Dining Warning

### Current main

Dining projection currently uses Hold createdAt as table startedAt.

That is not necessarily the same as the real time a party was seated.

No current-main durable seatedAt field was found.

### Why this matters

A Dining warning such as “seated for N minutes” is only correct if it starts at real table assignment/seating time.

Using:
- Hold creation time
- waitlist creation time
- generic order time

would distort the warning.

Classification:
REAL_SEATED_AT_FACT_MISSING
ADMIN_DINING_WARNING_DEPENDS_ON_SEATED_AT

Recommended future design:
- write seatedAt once when a Dining hold first becomes seated/table-assigned
- preserve it through table transfer
- do not reset on reassign/transfer
- waiting hold has no seatedAt
- warning is projection only
- no transaction blocking

## 5. E5 — Figma R2 visual convergence

Latest dated visual reference:
docs/handoff/MoreFunOS_SMT_Visual_Product_Spec_Figma_R2_2026-09-26.md
commit 4c20a0ef4e9660494d8ad50f1357e4749bff3748

R2 defines:
- Premium consumer UI influence
- Soft glass surfaces
- ambient gradient
- capsule controls
- floating cards
- selective dark contrast
- 1920×1080 fixed operational geometry
- right transaction rail preserved
- 4-column product grid preserved
- 75% modal preserved
- gradients forbidden as transaction truth
- Money/Status/Checkout/Sold-out/Error must remain text + fixed semantic color
- visual-only authority; Order/Pricing/Payment/Print truth must not change

R2 itself explicitly says latest screenshot visual QA was still pending due Figma read quota.

Current main CSS contains older/or mixed visual layers and is not proven as fully converged to R2.

Classification:
VISUAL_SPEC_EXISTS
CODE_CONVERGENCE_NOT_BANKED
SCREENSHOT_QA_PENDING

Recommendation:
Visual convergence comes after selected functional SMT optimization stabilizes.
Do not use Figma to redesign business logic.

## 6. E6 — Backup / Restore

Current main has:
- mfk.* local backup
- checksum/validation
- verified restore
- no cloud dependency
- local reload after restore

Classification:
BASELINE_NO_TOUCH

No new work needed unless a reproducible restore defect appears.

## 7. E7 — Availability / Sold-out

Current main already has:
- canonical availability projection
- revision
- available/soldout/paused
- mutation guard
- SMT sold-out workspace

Classification:
BASELINE_NO_TOUCH

Do not confuse advanced Capacity Pool with current Availability authority.

## 8. Revised remaining backlog

### Already complete baseline — do not reopen
- Sold-out / Availability
- capacity warning
- Day Close
- cash opening / retained/removed cash
- local report / CSV
- printer diagnostics / manual reprint
- backup / restore

### Small / bounded optimization candidates
- A4 Admin table registry consistency in hold selector
- A2a SAME-line edit
- print-truth wording/attention alignment
- later Figma R2 visual-only convergence

### Medium / high-risk future optimization
- A2b independent units + Combine
- B1 Payment Correction
- B3 Cancellation Notice
- C1 R2 Dining settlement safety
- C2 R3 Dining Checkout/reload

### Real future gaps
- general Cash In / Cash Out
- refund-aware cash ledger
- adjustment-aware reporting
- Pending Action workflow
- real seatedAt
- Dining elapsed warning based on seatedAt
- Capacity Pool / Channel Threshold / Override
- real cross-device/native Dining proof
- physical Dining print/drawer acceptance

### Deferred
- B2 Refund until cash/reporting closure
- PRICE_OVERRIDE separate
- Owner connection

## 9. Suggested global sequence after review

Current immediate state:
A1 #322 waiting Owner acceptance.

Then:
1. A4 table selector alignment
2. A2a same-line edit
3. print-truth wording alignment if Owner selects it
4. A2b independent units / Combine
5. A3 split program
6. B1 payment correction
7. B3 cancel notice
8. C1 Dining R2
9. C2 Dining R3
10. D1–D5 Dining full-chain slices
11. cash/reporting closure
12. B2 refund
13. seatedAt/warning
14. advanced capacity
15. Figma R2 final visual convergence
16. Owner connection remains last/deferred until SMT stable

## 10. Status

FINISHING_OPERATIONS_VISUAL_AUDIT_R1_COMPLETE
BASELINE_OPERATIONS_NOT_REOPENED
ADVANCED_CAPACITY_REAL_GAP
CASH_REPORTING_ADJUSTMENT_GAP
PRINT_PENDING_ACTION_GAP
SEATED_AT_REAL_GAP
FIGMA_R2_VISUAL_ONLY_PENDING
SECOND_SMT_TEAM_PAUSED
NO_PRODUCT_MUTATION
