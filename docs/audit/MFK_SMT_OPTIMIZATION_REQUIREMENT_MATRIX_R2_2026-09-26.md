# MFK SMT Optimization Requirement Matrix R2

DATE: 2026-09-26
REVISION: R2
MODE: PLANNING / AUDIT
CONTROL: #321
BASELINE_AUTHORITY: docs/control/MFK_FIVEPORT_E2E_LOCK_BASELINE_R2_2026-09-26.md

## 0. Baseline rule

This matrix starts AFTER the accepted five-port E2E baseline.

Admin / SMT / SMM / Customer / Keeta are COMPLETE + BANKED.
Owner remains NOT_CONNECTED.

Nothing in this matrix authorizes a rewrite of another port.

## 1. Classification

- BASELINE_NO_TOUCH
- UI_OPTIMIZATION
- WORKFLOW_OPTIMIZATION
- NEW_SMT_FEATURE
- DONOR_AVAILABLE
- DONOR_RED
- CONFLICT_WITH_BASELINE
- OWNER_DECISION_REQUIRED
- DEFER

## 2. Optimization matrix

| # | SMT optimization requirement | Baseline impact | Current main | #171 donor | #306 donor | R2 decision |
|---:|---|---|---|---|---|---|
| 1 | Keep Admin/SMT/SMM/Customer/Keeta E2E unchanged | none allowed | complete | must preserve | must preserve | BASELINE_NO_TOUCH |
| 2 | 1920×1080 frontline density / stable muscle memory | presentation only | usable baseline | partial | strong donor | UI_OPTIMIZATION |
| 3 | Latest 2026-09-26 Figma R2 visual system | visual only | not fully applied | older look | older Owner FINAL look | UI_OPTIMIZATION |
| 4 | High-frequency nav: 點單 / 訂單 / 堂食 / 售罄／產能; More in hamburger | presentation routing only | older rail includes More | conflicting nav | closer donor | UI_OPTIMIZATION |
| 5 | Horizontal categories + persistent layout controls | presentation only | basic | partial | strong donor | UI_OPTIMIZATION |
| 6 | Product columns/card height/images/category/font/density local preferences | presentation only | incomplete | partial | implemented donor | DONOR_AVAILABLE |
| 7 | Quick / Normal ordering modes | UI/workflow | baseline works without it | implemented | implemented | WORKFLOW_OPTIMIZATION |
| 8 | Quick Drink | UI/workflow | absent/incomplete | limited | implemented | DONOR_AVAILABLE |
| 9 | Silent Guided Flow | UI only, must not auto-commit | absent/incomplete | partial | implemented | DONOR_AVAILABLE |
| 10 | Contextual Fast Lanes: required / combo / riceball workflow | workflow accelerator only | partial | partial | stronger donor | WORKFLOW_OPTIMIZATION |
| 11 | Independent cart units + Combine toggle default OFF | cart presentation/model only; formal authority unchanged | baseline behavior differs | not final | implemented | WORKFLOW_OPTIMIZATION |
| 12 | SAME cart-line edit instead of duplicate add | cart UX only | older flow | implemented | implemented | DONOR_AVAILABLE |
| 13 | Large product/required/combo/hold/pending modal + dirty-close | presentation only | partial | partial | implemented | DONOR_AVAILABLE |
| 14 | Single 暫存／堂食 entry with contextual first tab and manual override | local workflow only | basic hold path | not final | implemented | WORKFLOW_OPTIMIZATION |
| 15 | Hold/Dining selector consumes Admin table registry | consume existing Admin truth only | mixed/hardcoded entry exists | hardcoded | implemented | DONOR_AVAILABLE |
| 16 | Checkout fixed geometry 01/02/03 and fixed keypad | presentation only | baseline works | implemented candidate | Owner-final donor | UI_OPTIMIZATION |
| 17 | Checkout speed / quick cash / exact / completion review polish | no money-authority change | baseline works | candidate | candidate | UI_OPTIMIZATION |
| 18 | Orders workspace visual density / actions / history | presentation only | strong baseline | candidate | strong donor | UI_OPTIMIZATION |
| 19 | Payment Correction UI + audit display | existing money authority must remain single | baseline E2E does not require this UI | no | donor available | NEW_SMT_FEATURE |
| 20 | Full / Partial Refund local SMT workflow | must reuse existing authority; no second payment engine | baseline E2E complete without this local UI | no | donor available | NEW_SMT_FEATURE |
| 21 | Cancellation notice after real production issue | print side-effect extension only | no local notice workflow | no | donor available | NEW_SMT_FEATURE |
| 22 | Dining waiting/table/detail/item split UX | local SMT feature | basic | no | strong donor | WORKFLOW_OPTIMIZATION |
| 23 | Dining formal Order / production admission | must use SAME Store Kernel | not baseline requirement | no | donor available | NEW_SMT_FEATURE |
| 24 | Dining first print: table/production/packing/labels | reuse Print authority only | not baseline requirement | no | donor available | NEW_SMT_FEATURE |
| 25 | Dining payment receipt / Cash-only drawer / reprint drawer=false | reuse Payment + Print authority | not baseline requirement | no | donor available | NEW_SMT_FEATURE |
| 26 | Exact split-tender detail persistence/display | money extension only | baseline COMBO exists | no | donor available | NEW_SMT_FEATURE |
| 27 | PRICE_OVERRIDE by Admin permission, audit, signed price | pricing exception feature; must not create second pricing engine | absent | no | donor available | NEW_SMT_FEATURE |
| 28 | PRICE_OVERRIDE stale protection / immutable audit / same-price no-op | concurrency/audit extension | absent | no | donor available | NEW_SMT_FEATURE |
| 29 | Real SeatedAt | dining fact extension | missing | no | incomplete | NEW_SMT_FEATURE |
| 30 | Admin Dining Warning based on real SeatedAt | consumes Admin config | partial | no | partial | DEFER until #29 |
| 31 | Cross-device Dining serialization | concurrency extension | not required by baseline | no | donor attempted | DONOR_RED |
| 32 | W/H visible wait/hold identity never reused incorrectly | local identity correctness | current baseline unaffected | no | latest donor RED | DONOR_RED |
| 33 | Sold-out UI refinement | presentation only | implemented | candidate | donor | UI_OPTIMIZATION |
| 34 | Capacity Pool | operational policy extension; must not block local trading unless separately approved | basic warning only | no | incomplete | NEW_SMT_FEATURE |
| 35 | Channel Threshold | channel-specific operational policy | absent | no | incomplete | NEW_SMT_FEATURE |
| 36 | Capacity Override | permissioned operational exception | absent | no | incomplete | NEW_SMT_FEATURE |
| 37 | More / Tools Center information architecture | presentation only | implemented but can refine | candidate | donor | UI_OPTIMIZATION |
| 38 | Day Close UX refinement | preserve existing day-close truth | implemented | no | donor | UI_OPTIMIZATION |
| 39 | Cash In / Cash Out UI | cash ledger extension only | partial | no | partial | NEW_SMT_FEATURE |
| 40 | Reporting UI / immutable daily report + later adjustment view | projection only | basic reports | no | partial | NEW_SMT_FEATURE |
| 41 | Printer failure attention / Pending Action | connect existing print certainty | diagnostics exists | no | partial | NEW_SMT_FEATURE |
| 42 | Diagnostics UX | presentation only | implemented | candidate | donor | UI_OPTIMIZATION |
| 43 | Backup / Restore UX | preserve current backup contract | implemented | no | donor | UI_OPTIMIZATION |
| 44 | Offline / restart / power-loss proof for new SMT features | test new deltas only | baseline banked | n/a | partial | DEFER to each feature acceptance |
| 45 | Owner port | separate product | not connected | n/a | n/a | DEFER |

## 3. Donor admission

PR #171:
- UI/product donor only.
- Do not take navigation or combining behavior blindly.
- Take only individual deltas that match this matrix.

PR #306:
- richest donor.
- not mergeable as a product candidate yet.
- latest head 648eb2de... is RED.
- every selected feature must be replayed from current locked main on a new branch.

## 4. Execution rule

For each optimization:
1. start from current main;
2. compare against bank/MFK/FIVEPORT-E2E-LOCK-R2-2026-09-26;
3. restrict changes to the exact SMT optimization;
4. no Admin/SMM/Customer/Keeta contract mutation;
5. run SMT tests + relevant cross-port regression;
6. Owner accepts;
7. small merge;
8. create a new dated bank.

## 5. First recommended optimization batch

BATCH O1 — presentation/workflow only, lowest E2E risk:
- #4 nav
- #5/#6 layout preferences
- #11 independent cart units + Combine OFF
- #12 same-line edit
- #13 modal/dirty-close
- #14 暫存／堂食 entry
- #15 Admin table registry consumption
- #16 checkout geometry

No money/print/runtime authority change in O1.

BATCH O2 — advanced SMT workflow:
- Quick/Normal
- Quick Drink
- Silent Guided Flow
- Fast Lanes

BATCH O3 — new money/dining/print features:
- Payment Correction UI
- Refund
- Cancellation Notice
- Dining production admission
- Dining print/receipt/drawer
- split tender
- PRICE_OVERRIDE

Only after O1/O2 are GREEN.

## 6. Status

SMT_OPTIMIZATION_REQUIREMENT_MATRIX_R2_READY
FIVE_PORT_E2E_BASELINE_LOCKED
NO_WHOLESALE_MERGE
OWNER_NOT_CONNECTED
