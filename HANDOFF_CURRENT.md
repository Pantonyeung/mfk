# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Short name:
MFP

Current program:
MFP V3 A0–A9 REBUILD

## Supersession

For MFP V3 execution, this handoff supersedes the older PR #627 / Unified Surfaces R1 current-execution handoff.

PR #627 remains legacy containment / rollback evidence only and is not the current MFP implementation lane.

The current A2 lane is:

- Branch: `feat/MFP-V3-A2-DEVICE-STAFF-SECURITY-2026-10-02`
- Draft PR: #635
- Parent PR: #633
- Parent exact SHA: `256e130ae4f7292beadbcbbe847433c769066a7e`
- A1 status: `SOURCE_VERIFIED`

Current Stage handoff:
`docs/handoff/MFP_V3_A2_DEVICE_STAFF_SECURITY_CODEX_HANDOFF_2026-10-02.md`

Controlling plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

## Product target

MFP
- MFP Pad
- MFP Mobile

One product.
One codebase.
One Device/Staff security model.
One Store Kernel.
One Formal Transaction Authority.
One Pricing / Order / Payment / Fulfillment / Print authority.
One Revision / Idempotency / Readback model.

SMM:
- cancelled as product identity
- legacy compatibility / UX donor only
- no new authority/state/head/session path

Internal SMT identifiers may remain temporarily inside Store Kernel / sync contracts.

## Current objective

A2 — DEVICE + STAFF SECURITY

Sequence:
1. Fresh-read current control + A2 handoff.
2. Verify parent exact SHA and current branch.
3. Write RED: expired/revoked staffSessionRef fails closed before Store Kernel submit.
4. Stable device identity.
5. Device authorization readback.
6. Staff authentication contract.
7. Opaque staff session.
8. Bounded expiry / revocation.
9. Action-time permission.
10. Bind A1 deviceId + staffSessionRef.
11. Minimal Pad/Mobile security verification UI.
12. Relevant tests.
13. Typecheck/build.
14. Authority/security CI guard.
15. Exact-head evidence.
16. Completion report.

## A2 non-goals

Do not:
- build final Ordering UI
- deploy production auth
- merge
- request OTA
- decommission SMM
- rename all legacy SMT protocol identifiers
- rebuild Store Kernel / Order / Pricing / Payment / Print authority

## A2 security locks

- no client-manufactured authenticated session
- no PIN persistence
- no PIN/hash/verifier export in browser state
- no session token in URL/query
- no SMM session authority
- no `x-mfk-smm-session` dependency
- no `mfk-smm-web` dependency
- no periodic auth polling
- revoked / expired / unknown device/session fails closed
- Store Kernel remains formal command admission authority

## UI strategy

A2 includes only a minimal visible security harness:
- device identity/status
- login
- current staff
- expiry/revocation
- logout
- permission denied

Final product UI begins at A4.

## Status

A0: SOURCE_VERIFIED
A1: SOURCE_VERIFIED
A2: CURRENT

Completion target:
SOURCE_VERIFIED

## Governance drift resolution

The older live-main #627 entrypoint is explicitly superseded for the declared MFP V3 execution branch by Owner direction recorded in this current branch.
Do not stop A2 merely because live main has not yet landed this pointer update.

Stop only if:
- current branch control conflicts with verified runtime/source authority;
- parent SHA drifts unexpectedly;
- the required change exceeds A2 scope;
- a second authority would be required.

Required status language:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A2_CURRENT_HANDOFF_2026_10_02`
