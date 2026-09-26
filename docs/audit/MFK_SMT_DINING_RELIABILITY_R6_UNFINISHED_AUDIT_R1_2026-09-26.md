# MFK SMT Dining Reliability + R6 Unfinished Audit R1

DATE: 2026-09-26
MODE: AUDIT ONLY / NO PRODUCT MUTATION
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: Pantonyeung/mfk #321

CURRENT BASELINE:
Admin / SMT / SMM / Customer / Keeta E2E locked.
Public SMT acceptance deltas already preserved in main.
Owner NOT_CONNECTED.
A1 PR #322 remains READY_FOR_OWNER_ACCEPTANCE / NOT_MERGED.

## 1. Current main Dining reality

Current main already has a usable Dining baseline:
- Hold / waiting / table assignment.
- Admin-published Dining table registry in localRuntime.readDining().
- custom table names / active filtering / fallback / orphan occupied-table visibility.
- item-level partial settlement.
- existing Checkout UI can hand selected Dining lines into localRuntime.settleDiningHold().
- SAME Hold payment history is stored.

But current main settlement call is still the older form:
settleDiningHold(holdId, selections, tender)

Current main does NOT contain the later R2/R3 reliability command/session model:
- stable dining payment submissionId;
- expectedRevision on payment command;
- authoritative receivedMinor;
- splitTenders on Dining command;
- same-submission replay contract;
- durable checkoutRevision/readback protection;
- Dining checkout UI-session recovery after reload.

This is an OPTIMIZATION target, not permission to reopen the five-port E2E baseline.

## 2. C1 — Dining Settlement Safety R2

Donor:
PR #293
product 5b109349e12b219be542222dede850ecbe74aabb
recorded GREEN:
38 test files / 187 tests
R1 browser 12/12
actual-runtime payment browser/offline 5/5
build PASS

Exact R2 runtime tests lock:
1. partial payment preserves SAME hold/table;
2. same submission repeated/double-clicked makes one payment;
3. same submission survives module restart;
4. changed amount/tender under same submission is rejected;
5. duplicate line indexes rejected;
6. stale snapshot after another payment rejected;
7. fresh storage checked against out-of-band runtime change;
8. storage failure cannot publish memory success/free table;
9. full payment releases table in same durable write and preserves history;
10. waiting hold can pay;
11. paid history cannot be erased;
12. occupied table cannot be deleted from runtime;
13. stable identity/revision/sufficient cash enforced at authority boundary.

Assessment:
DONOR_GREEN_UNMERGED / HIGH-VALUE RELIABILITY OPTIMIZATION.

Dependency:
none on R6 production printing.
It can be isolated before full Dining chain.

Risk:
MEDIUM-HIGH because it touches payment commit semantics inside Dining, but it does not create a second Payment engine.

Recommended future slice:
C1a stable payment command + replay/stale/storage safety
C1b history/archive/release protections
Keep those as one bounded reliability milestone if replay remains small.

## 3. C2 — Dining Checkout / Reload Recovery R3

Donor:
PR #297
product c5975e01d5a5501c6aaddb6d24186846fe9e45ae
recorded GREEN:
38 files / 187 unit tests
actual Checkout browser 10/10
R1 browser 12/12
R2 browser 5/5
packaged offline tablet/desktop 2/2
build PASS

R3 browser cases:
01 dining source locked
02 cash confirm = one payment
03 completion restored after reload without repayment
04 unpaid draft restored after reload
05 full payment releases table and keeps history
06 stale checkout explains error without new payment
07 waiting checkout uses correct location
08 electronic keypad stays visible/disabled
09 Back does not pay or retain stale UI intent
10 storage failure never shows false completion; retry records once

New seam:
v2local/src/features/checkout/dining-checkout-ui-session.ts

Assessment:
DONOR_GREEN_UNMERGED / DEPENDS_ON_C1.

Recommendation:
Do not integrate R3 before R2 reliability.
R3 should remain a separate UI/recovery slice after C1 is banked.

## 4. R6 full-chain donor — what is actually proven

Latest PR #306 head:
648eb2de368621eed7bf23cecebea0bef5ce075e

Latest proof run:
36207077853 / job 108305740502

Result:
41 test files PASS / 2 test files FAIL
233 tests PASS / 3 tests FAIL

The R6 production-admission suite itself had 31 tests, with 29 PASS / 2 FAIL.
The failures were:
- waitlist W code reuse after deletion;
- generic H code reuse after deletion.

The third overall failure was in PRICE_OVERRIDE:
- expected specific AFTER_PAYMENT error;
- runtime returned broader DINING_HISTORY_PROTECTED.

Therefore the latest monolithic branch is RED, but most R6 full-chain subcontracts did pass deterministic tests.

## 5. D1 — SAME Formal Order link + production admission

Passing R6 tests include:
- table assignment creates formal Order and first Dining print set;
- one formal Order linked durably to SAME Dining Hold;
- repeated admission reuses formal Order and suppresses duplicate first production dispatch;
- formal Order link survives runtime restart;
- table transfer keeps SAME Order.

Assessment:
IMPLEMENTED_DONOR / UNIT_GREEN_INSIDE_RED_BRANCH.

Still required before integration:
- replay only this slice from fresh main;
- build GREEN;
- five-port regression;
- no Customer/SMM/Keeta/Admin seam changes;
- no old donor branch merge.

## 6. D2 — Initial Dining print + table ticket + neutral reprint

Passing R6 tests include:
- first production admission excludes paid-customer receipt;
- first table assignment includes unpaid table ticket;
- Dining reprint uses SAME Order and forces drawer OFF;
- first print stores per-job transport evidence;
- stale/forged reprint job id rejected;
- successful printer transport is NOT promoted to physical-paper truth.

Owner correction already locked:
printer transport success ≠ physical paper truth.
Human/kitchen visual confirmation remains physical authority.
Reprint picker must stay neutral.

Assessment:
SOURCE/UNIT PROOF EXISTS, PHYSICAL_ACCEPTANCE_MISSING.

Do not call this complete until real printer acceptance.

## 7. D3 — Payment receipt + CASH-only drawer boundary

Passing R6 tests include:
- CASH Dining payment receipt is drawer boundary;
- non-cash never kicks drawer;
- receipt first dispatch is durable;
- automatic retry cannot open drawer twice;
- UNKNOWN outcome suppresses blind auto retry;
- manual CASH receipt reprint forces drawer OFF;
- concurrent receipt admission dispatches at most once.

Assessment:
STRONG DONOR / PHYSICAL_ACCEPTANCE_MISSING.

This must remain separate from initial production printing so drawer authority cannot leak into table/production tickets.

## 8. D4 — Exact split tender / COMBO cash

Passing R6 tests include:
- mixed split tenders project COMBO without second Order;
- exact tender breakdown persists;
- split sum validation;
- COMBO containing CASH requires actual received cash;
- cash change is preserved correctly.

Assessment:
IMPLEMENTED_DONOR / MONEY-RISK.
Depends on C1 reliable payment command.
Do not integrate as a UI-only change.

## 9. D5 — Mutation serialization / table transfer / concurrency

Passing R6 tests include:
- concurrent distinct payments from same revision → one commit;
- concurrent first admission → one Order / one first-print attempt;
- concurrent CASH receipt admission → at most one dispatch;
- clear table waits behind payment mutation;
- unassign/reassign keeps SAME Order and table truth.

Source uses:
- Web Locks when available;
- local runtime fallback queue.

Assessment:
PARTIAL_RELIABILITY_DONOR.

Important limitation:
Web Locks prove same-origin browser/tab serialization where supported.
They are NOT proof of cross-device atomicity.
Native/multi-device physical acceptance is still missing.

## 10. D6 — Hold / Wait identity and input integrity

R6 added intended contracts:
- visible W code should not reuse after deletion;
- visible H code should not reuse after deletion;
- bounded party size/note;
- hold total recomputed by runtime;
- formal-Order custody prevents hold deletion.

Latest proof shows:
PASS:
- input validation;
- hold total validation;
- formal custody protection.

FAIL:
- W code still reused;
- H code still reused.

Assessment:
REAL_UNFINISHED_GAP.
Do not integrate identity allocator from latest donor.

## 11. D7 — seatedAt + Admin Dining Warning

Current main projects startedAt from Hold createdAt.
That is not guaranteed to equal real seating time.

R2/R3 explicitly did NOT claim seatedAt/Admin warning.
R6 source has warning UI work but no accepted real seatedAt fact.

Assessment:
REAL_FUTURE_GAP.
Must define a durable real seating timestamp before warning logic can be considered correct.

## 12. D8 — native power loss / cross-device proof

R2 proves module restart/storage reload.
R3 proves browser reload/offline packaged UI recovery.
R6 unit tests prove serialization logic.

None of those equals:
- Android/native process death at exact mutation boundary;
- real multi-device concurrent mutation;
- physical printer + drawer recovery after power/network interruption.

Assessment:
PHYSICAL_REAL_WORLD_PENDING.

## 13. D9 — PRICE_OVERRIDE is not part of Dining reliability baseline

PRICE_OVERRIDE is a later Owner-approved feature, but the latest PR #306 remains RED partly because its after-payment error-contract test conflicts with DINING_HISTORY_PROTECTED.

It should not block analysis of C1/C2/D1-D5 donors, but it must also not be smuggled into a Dining reliability landing.

Classification:
SEPARATE_FUTURE_FEATURE.

## 14. Recommended Dining sequence

Do NOT take R6 as one project.

Recommended future sequence after current low-risk SMT UI/cart milestones:

C1 — R2 settlement safety
→ bank

C2 — R3 Checkout/reload recovery
→ bank

D1 — SAME Formal Order link / production admission
→ bank

D2 — table/production/packing/label initial print + neutral reprint
→ source GREEN, then physical printer acceptance
→ bank

D3 — payment receipt + CASH drawer certainty
→ source GREEN, then physical printer/drawer acceptance
→ bank

D4 — exact split tender / COMBO cash
→ money regression
→ bank

D5 — mutation serialization / table transfer
→ same-origin proof + real device concurrency proof
→ bank

D6 — fix W/H visible identity allocator
→ bank independently

D7 — real seatedAt + Admin warning
→ later new feature

PRICE_OVERRIDE remains separate.

## 15. Non-negotiable guards

Every Dining optimization must preserve byte-identical or explicitly approved behavior for:
- Customer intake;
- SMM ingress/Web acceptance;
- Admin sync;
- Keeta intake/provider;
- current main installation gates;
- existing Order/Pricing/Payment/Print authority.

No Dining optimization may introduce:
- second Order engine;
- second Payment DB;
- second Print queue/router;
- new formal authority outside existing local runtime/kernel seams.

## 16. Current status

DINING_RELIABILITY_AUDIT_R1_COMPLETE
R2_GREEN_DONOR
R3_GREEN_DONOR
R6_MONOLITH_RED_BUT_SUBSLICE_EVIDENCE_IDENTIFIED
W_H_IDENTITY_REAL_GAP
PHYSICAL_PRINT_DRAWER_PENDING
SEATED_AT_REAL_GAP
SECOND_SMT_TEAM_PAUSED
NO_PRODUCT_MUTATION
