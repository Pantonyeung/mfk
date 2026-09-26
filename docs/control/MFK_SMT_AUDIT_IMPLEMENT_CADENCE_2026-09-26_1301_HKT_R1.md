# MFK SMT Audit → Implement Cadence R1

DATE: 2026-09-26
TIME_HKT: 13:01
STATUS: CURRENT_PROCESS_AUTHORITY
CONTROL: Pantonyeung/mfk #321

## Owner instruction

Do not accumulate long audit-only phases.

Default SMT integration cadence is now:

FRESH LATEST MAIN
→ AUDIT ONE BOUNDED SLICE
→ if one direction is clearly better, choose it
→ IMPLEMENT IMMEDIATELY
→ focused tests
→ integrated-main E2E guard
→ V2 Local Smoke
→ relevant cross-port regression
→ small merge to main
→ new dated bank
→ next slice

## When Owner decision is REQUIRED

Ask Owner directly only when the choice materially changes one or more of:

- money semantics
- Order identity / lifecycle semantics
- Payment / Refund / payout semantics
- Pricing authority
- Print physical side-effect authority
- irreversible data meaning
- two genuinely reasonable operator workflows with materially different outcomes
- a protected E2E seam would need to change

Do not ask merely because:
- UI wording/layout differs
- one implementation is clearly simpler/safer
- an existing Admin/SMT authority can be reused
- a donor has several variants but one clearly preserves current main better
- a change is presentation-only and covered by regression

## Direction rule

If one direction is clearly safer and better for frontline use while preserving authority:
choose it and document why.

If two directions are materially different and neither dominates:
stop and ask Owner with the exact decision only.

## Protected baseline

Admin / SMT / SMM / Customer / Keeta E2E remain frozen.
Public SMT acceptance deltas remain protected in main.
Second SMT team remains PAUSED and donor-only.
Owner port remains deferred.

No optimization may overwrite:
- Customer/SMM/Keeta/Admin integration seams
- Store Kernel / Formal Order authority
- Pricing / Payment / Fulfillment / Print authority
- existing header/shell/connected order information except an explicitly selected visual optimization

## Current landed progress under this cadence

A1 R4 暫存／堂食:
LANDED
main c4202a0b6ba33e20ce2c7d79a4617cf00ca919aa
bank/MFK/SMT-A1-R4-2026-09-26

A4 Admin table selector:
LANDED
main f75b58caff2aeafe2c1bbb4aa487604e4259632f
bank/MFK/SMT-A4-ADMIN-TABLE-HOLD-2026-09-26

A2a SAME-line edit:
LANDED
main 0b90e4d16b54521a1574cb77d6d69dde202529c0
bank/MFK/SMT-A2A-SAME-LINE-EDIT-2026-09-26

## Next

Continue with the same cadence.
A2b identity direction is resolved by engineering judgement unless a true semantic conflict appears.

STATUS:
AUDIT_IMPLEMENT_CADENCE_ACTIVE
FIVE_PORT_E2E_FROZEN
SECOND_SMT_TEAM_PAUSED
OWNER_DECISION_ONLY_FOR_REAL_SEMANTIC_BRANCHES
