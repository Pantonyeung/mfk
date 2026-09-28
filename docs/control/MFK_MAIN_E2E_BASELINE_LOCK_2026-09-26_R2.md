# MFK Main E2E Baseline Lock R2

DATE: 2026-09-26
REVISION: R2
STATUS: CURRENT_DATED_AUTHORITY
CONTROL: Pantonyeung/mfk #321

## 1. Owner correction — controlling interpretation

The current MFK five-port E2E implementation is the BASELINE.

The other SMT team's work is NOT a replacement baseline and is NOT a restoration authority.
It is an OPTIMIZATION / PRODUCT-EVOLUTION donor on top of this baseline.

Canonical six ports:
1. Admin
2. SMT
3. SMM
4. Customer
5. Keeta
6. Owner

Current connection status:
- Admin = E2E CONNECTED / COMPLETE BASELINE / LOCKED
- SMT = E2E CONNECTED / COMPLETE BASELINE / LOCKED
- SMM = E2E CONNECTED / COMPLETE BASELINE / LOCKED
- Customer = E2E CONNECTED / COMPLETE BASELINE / LOCKED
- Keeta = E2E CONNECTED / COMPLETE BASELINE / LOCKED
- Owner = NOT_CONNECTED / connection not started

## 2. Main is the baseline source of truth

Fresh comparison proves:
- bank/MFK/FRONTLINE-GREEN-2026-09-26 snapshot 4c20a0ef4e9660494d8ad50f1357e4749bff3748
- current main before this R2 authority = 99bda2f35145a27e690368f2e044362a33ad0f7a
- current main is ahead only by dated governance/audit/customer documentation in that comparison
- zero product-code drift was found between the banked frontline snapshot and current main

Therefore no speculative product merge is required to "reconstruct" the baseline.
The accepted baseline is already represented by current main.

New immutable bank branch:
bank/MFK/E2E-BASELINE-MAIN-2026-09-26-R2

Baseline source commit before this authority file:
99bda2f35145a27e690368f2e044362a33ad0f7a

## 3. Locked deployed / accepted references

- Customer: Version f963f96c-a0f7-46a4-b762-88b846bd91cc
- SMM Web: Version d82889dd-613e-43dd-881b-33a842ba3e9a
- SMT Web acceptance: Version d74eefe6-8584-4fb9-9b52-759c362366a5
- Admin: Version 621400a9-63ca-4071-8138-be740e2b4ad8
- Keeta: connected E2E semantics locked; functional source anchor bb2b34e0f35b00ca374de0f4ca8d713ebd848684
- Owner: NOT_CONNECTED

The SMT Web acceptance version is not a claim about the exact physical-shop Current/Boot Runtime version.

## 4. 100% no-touch E2E rule

The following are protected baseline truth and MUST NOT be changed by SMT optimization work unless a new reproducible defect plus a dated Owner decision explicitly authorizes a bounded repair:

- Store Kernel / Formal Order authority
- Order identity / Display identity
- Pricing / Frozen Quote authority
- Payment / Tender authority
- Fulfillment truth
- Print Admission / Print Queue / Router authority
- Admin publish/config authority
- Staff/RBAC authority
- Customer → SMT E2E path
- SMM → SMT E2E path
- Keeta → SMT E2E path
- submission / idempotency / readback semantics
- UNKNOWN/readback-first safety
- accepted offline/restart recovery behavior
- accepted Customer payment-evidence behavior
- accepted Keeta provider lifecycle behavior
- accepted Admin/SMM/Customer data contracts

Any optimization candidate that alters these without explicit approval is RED.

## 5. Second SMT team = optimization donor only

The second SMT team's branches / PRs, including #171, #283, #289, #293, #297, #301, #305, #306 and related descendants, are classified as:

SMT_OPTIMIZATION_DONOR / UNMERGED

They may contain:
- better UI
- faster operator flow
- Owner-requested product behavior
- Dining enhancements
- correction/refund surfaces
- layout / navigation / modal improvements
- additional operational features

But they do NOT supersede the locked main baseline.

No cumulative donor branch may be merged wholesale into main.

## 6. Correction to prior P1 audit wording

The P1 audit pack remains useful for locating donor code and product ideas.

However, after this Owner correction:
- P1-1 / P1-2 / P1-3 / P1-4 are NOT "mandatory restoration jobs" merely because a donor contains behavior absent from current main.
- Their correct interpretation is:
  OPTIMIZATION_CANDIDATE_GAP / OWNER_REQUIREMENT_CANDIDATE
- current main remains complete E2E baseline.
- a donor feature is brought into main only when Owner chooses that optimization to become part of the next SMT version.

No historical preview may be used to declare current main incomplete.

## 7. Future SMT optimization workflow

Every optimization starts from the locked baseline:

LOCKED MAIN BASELINE
→ select ONE Owner optimization
→ fresh-read latest main
→ create clean optimization branch FROM latest main
→ port only the selected delta
→ preserve all five connected E2E ports
→ deterministic tests
→ five-port regression
→ Owner acceptance
→ small merge to main
→ create a new dated bank
→ next optimization starts from that new bank/main

Never:
- work indefinitely on an old cumulative SMT branch
- merge old branch over current main
- re-open completed Customer/SMM/Admin/Keeta work
- rebuild backend authority because UI work wants a shortcut
- use an older "CURRENT/FINAL/MASTER" document to override a newer dated authority

## 8. Search precedence

For any future SMT requirement or status decision:
TOPIC
→ newest dated Owner authority
→ latest bank/main baseline
→ accepted E2E facts
→ optimization donor evidence
→ older historical material only for provenance

Date beats labels such as CURRENT / FINAL / MASTER / 主權.

## 9. Current work order

1. Freeze/bank current main baseline.
2. Do not mutate Admin / SMM / Customer / Keeta E2E.
3. Review the second SMT team's completed work only as optimization candidates.
4. Build an Owner optimization backlog:
   - what is already in baseline
   - what donor improves
   - exact benefit
   - exact files/seams
   - E2E risk
   - whether Owner wants it in the next SMT version
5. Integrate optimizations one by one.
6. Owner connection stays deferred until the SMT baseline + selected optimizations are stable.

## 10. Status

MAIN_E2E_BASELINE_LOCKED_R2
FIVE_PORT_E2E_NO_TOUCH
SECOND_SMT_TEAM_OPTIMIZATION_ONLY
NO_WHOLESALE_MERGE
OWNER_NOT_CONNECTED

NEXT:
SMT_OPTIMIZATION_BACKLOG_FROM_LOCKED_MAIN_R1
