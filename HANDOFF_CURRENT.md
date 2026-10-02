# MFK CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Controlling authority:
`docs/governance/MFK_UNIFIED_SURFACES_R1_AUTHORITY_2026-10-02.md`

Commander:
`COMMANDER_CURRENT.md`

Execution:
- Branch: `feat/MFK-UNIFIED-SURFACES-R1-2026-10-02`
- Draft PR: #627
- Foundation: `0223513a2142b02554fd6ff61808b871af8b5bbd`
- Latest main must be fresh-read before every execution restart.

## Current owner-locked product target

ADMIN
- Admin Desktop
- Admin Mobile / Owner Surface

SMT
- SMT Desktop
- SMT Mobile / Handheld

Independent Owner App and independent SMM are cancelled as final product identities.

Legacy workers remain temporarily live:
- `mfk-owner`
- `mfk-smm-web`

No decommission until physical verification and separate Owner approval.

## Current execution objective

UNIFIED SURFACES R1 — IMPLEMENTATION + DIRECT DEPLOY ACCEPTANCE

Sequence:
1. Fresh audit PR #627 + latest main + PR #623 foundation.
2. Integrate latest main safely.
3. Lock implementation contracts.
4. Admin Mobile integration into `v2admin`.
5. SMT Handheld integration into `v2local`.
6. SMM transitional compatibility adaptation.
7. Public SMT auth/worker hardening.
8. Diagnostics adaptation.
9. Relevant tests + exact-head CI.
10. Exact source SHA lock.
11. Acceptance deploy Admin.
12. Acceptance deploy public SMT.
13. Runtime identity readback.
14. Desktop/mobile physical browser acceptance.
15. Update evidence.

## Authority boundaries

Admin Mobile:
- same Admin auth/session
- same canonical readback
- same permission/audit/publish/diagnostics
- no dependency on `mfk-owner` / Owner runtime API

SMT Handheld:
- same Store Kernel / transaction authority as Desktop
- same Pricing / Order / Fulfillment / Print authority
- same SMT projection / HeadSeq semantics
- no SMM formal authority
- no new `SMM_INTENT_STORE` dependency

Public SMT:
- authenticated public surface only
- no anonymous business mutation
- acceptance token is not staff identity
- Browser/Cloud is not Formal Order Authority

## PROMOTE scope already granted

Owner has explicitly granted `PROMOTE` for acceptance deployment inside PR #627 after safe main integration and GREEN source tests.

Authorized:
- existing Admin Worker acceptance deploy
- existing SMT public Worker acceptance deploy
- required candidate resource provisioning under existing contracts
- exact identity readback
- browser physical acceptance
- bounded fix / re-test / redeploy loops within the same scope

Still separately gated:
- final PR merge
- final hostname cutover
- OTA completion
- legacy decommission

## First restart check

Before any source edit:
- verify live main
- verify PR #627 head/base
- verify PR #623 foundation
- verify controlling authority remains 2026-10-02
- confirm no runtime conflict from main integration

If conflict:
`BLOCKED — RUNTIME_CONFLICT`

If governance documents disagree again:
`BLOCKED — GOVERNANCE_DRIFT`

## Required status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFK_UNIFIED_SURFACES_R1_CONTROL_AUTHORITY_READY_2026_10_02`

---

Historical handoff lineage dated 2026-09-30 and earlier is retained in Git history and its dated authority documents. It is not the current execution entry point where it conflicts with the 2026-10-02 Unified Surfaces R1 authority.
