# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Control: #22
Updated: 2026-09-30 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. #22 latest controlling comment
3. `docs/control/MFK_CHANGE_CONTROL.md`
4. `HANDOFF_CURRENT.md`
5. live repository / deployment / physical evidence relevant to the task

If a document conflicts with live repository evidence, report `GOVERNANCE_DRIFT`.
Do not guess and do not let stale text override verified live evidence.

## 1. Current repository control state

Current product source base for read-only UI forensic audit:

`4c8642d4ec84792de88f00163ce99e3005b8354a`

This is the current MFK product tree after:
- PR #520 WebSocket transport / public SMT identity
- SMM request-storm containment
- Governance Shadow foundation
- PR #521 Dining live-refresh source promotion

Controlled recovery bank remains:

`052295861931b72aa401aa6fa06c3cd65866706d`

Do not move or rewrite the recovery bank as part of UI work.

## 2. Acceptance status of current Main

PR #521 source is merged, but physical acceptance is still pending.

Published candidate runtime:

`runtime-candidate-mfk-4c8642d4ec84`

Source:

`4c8642d4ec84792de88f00163ce99e3005b8354a`

OTA workflow run:

`36643004088` SUCCESS

Product completion status for #521:

`NOT_ACCEPTED`

Do not describe #521 as physically accepted until store-device acceptance is recorded.

## 3. Canonical base for OWNER / SMM / CUSTOMER UI forensic audit

For the read-only UI forensic comparison, canonical source base is:

`4c8642d4ec84792de88f00163ce99e3005b8354a`

The audit may inspect:
- `v2owner/**`
- `v2smm/**`
- `v2customer/**`
- supplied historical briefs / screenshots / UI packages as reference only

Historical material is not current implementation authority.

The audit must compare:

`OLD REFERENCE → CURRENT IMPLEMENTATION → TARGET SALVAGE PLAN`

No product implementation is authorized by the audit itself.

## 4. UI audit execution rule

AUDIT / PLANNING ONLY.

Allowed:
- inventory supplied files
- compare old vs current
- produce forensic audit documents
- produce staged salvage plan
- create planned GitHub Issues

Not allowed without a later explicit Owner promotion:
- modify product code
- create implementation PRs
- merge UI changes
- deploy
- OTA
- alter Order / Pricing / Availability / Payment / Print / Keeta / SMT authority

Each future implementation stage must be one bounded Issue → one Candidate → one acceptance → one promotion decision.

## 5. Current salvage candidates

Existing recovery Candidates remain independent and must not be mutated by the UI audit:
- #523 canonical Cloud publish confirmation
- #522 Dining table registry fail-closed
- #524 bounded Admin/SMT reconciliation

PR #521 has already been merged into source and is awaiting physical acceptance.

## 6. Governance rule

A governance-only commit after the product audit base does not invalidate the UI audit base if it changes no Owner/SMM/Customer product files.

Before starting the audit, verify:
- live Main descends from the stated product audit base; and
- any newer commits do not modify `v2owner/**`, `v2smm/**`, or `v2customer/**`.

If either condition fails, stop and report `GOVERNANCE_DRIFT`.

## 7. Exact NEXT

1. Continue physical acceptance of #521 separately.
2. Resume read-only forensic audit in order:
   OWNER → SMM → CUSTOMER.
3. Produce audit / salvage documents and planned Stage Issues only.
4. Do not implement any UI Stage until Owner explicitly promotes that Issue.

MILESTONE: `MFK_UI_FORENSIC_AUDIT_BASE_4C8642D4_LOCKED`

## 8. Admin data authority + delivery invariant

Admin is the sole canonical authority for published configuration and operational policy data consumed by SMT.

Formal Admin publish contract:

`ADMIN FORMAL PUBLISH → CLOUDFLARE PUBLISHED TIME → DOORBELL → SMT CANONICAL PULL → ATOMIC APPLY → UI REFRESH → ACK / READBACK`

Hard rules:

- Human-facing freshness and acceptance use **Cloudflare publish time** as the primary ordering reference.
- `Rxx` / revision labels are not human-facing truth, not an acceptance gate, and not a cross-device freshness oracle.
- SMT must converge to every formally published Admin state. A sync path that can permanently miss a formal Admin publish is invalid and must be removed or rebuilt.
- Doorbell is notification only; SMT must pull canonical Admin data.
- Reconcile is a required fallback for missed, duplicate, reordered, or reconnect scenarios. It is not a second authority.
- No second configuration authority may be created in SMT, SMM, Customer, Owner, browser local state, or a parallel sync engine.
- Acceptance evidence records: Cloudflare published time, SMT received time, SMT applied time, UI refreshed time, ACK/readback time, and observed latency.
- Fingerprint/source identity may be retained for machine integrity checks; revision numbering may remain internal diagnostic metadata only.

MILESTONE: `MFK_ADMIN_AUTHORITY_TIME_FIRST_DELIVERY_LOCKED`
