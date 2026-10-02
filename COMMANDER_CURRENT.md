# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Control: #22
Program: UNIFIED SURFACES R1
Updated: 2026-10-02 Asia/Hong_Kong
System: MFK ONLY

Controlling authority:
`docs/governance/MFK_UNIFIED_SURFACES_R1_AUTHORITY_2026-10-02.md`

Execution PR:
#627 — Unified Surfaces R1｜Admin Mobile + SMT Mobile/Public

Execution branch:
`feat/MFK-UNIFIED-SURFACES-R1-2026-10-02`

Foundation:
`0223513a2142b02554fd6ff61808b871af8b5bbd`

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/governance/MFK_UNIFIED_SURFACES_R1_AUTHORITY_2026-10-02.md`
3. #22 latest controlling comment
4. `docs/control/MFK_CHANGE_CONTROL.md`
5. `HANDOFF_CURRENT.md`
6. PR #627
7. PR #623 foundation
8. live repository / deployment / physical evidence relevant to the task

If controlling text conflicts with live repository evidence:
`GOVERNANCE_DRIFT`

Do not guess and do not let stale text override verified live evidence.

## 1. Current product structure

ADMIN
- Admin Desktop
- Admin Mobile / Owner Surface

SMT
- SMT Desktop
- SMT Mobile / Handheld

Independent Owner App and independent SMM are no longer target products.

Legacy:
- `mfk-owner`
- `mfk-smm-web`

remain live only as transitional rollback services until physical verification and separate Owner decommission authority.

## 2. 2026-09-30 V3 strategy status

The 2026-09-30 Parallel V3 Web Client Rebirth authority remains historical lineage and still applies outside the explicit Unified Surfaces R1 exception.

For Unified Surfaces R1 only, Owner has superseded the prior V3-only / no-broad-v2 restriction and explicitly authorizes bounded convergence inside:
- `v2admin` for Admin Desktop + Mobile
- `v2local` for SMT Desktop + Handheld/Public
- donor reads from `v2owner` and `v2smm` without importing their independent authorities

Do not use this exception to rewrite Customer, Keeta, Store Kernel, Pricing, Payment, Fulfillment, Print authority, Builder or OTA governance.

## 3. Authority locks

Admin:
- one Admin auth/session authority
- one canonical config/readback authority
- one permission/audit/publish/diagnostics path
- Mobile is a projection/UX, not a second control plane

SMT:
- one Store Kernel / Formal Transaction Authority
- one Pricing / Order / Fulfillment / Print authority
- Desktop and Handheld share SMT projection, Revision, Idempotency and readback
- Handheld does not become SMM authority

Browser/mobile UI is never formal server/transaction truth.

## 4. Sync lock

P0 checkpointed delta sync remains foundation.

Target:
- canonical Port = SMT
- surface observations = Desktop + Handheld
- distinct client IDs / Applied evidence are allowed
- shared SMT HeadSeq / projection
- Connected != Applied

Legacy SMM compatibility may remain temporarily. Do not create new SMM canonical authority/state.

## 5. Public SMT lock

`mfk-smt-web` is authorized to become an authenticated public SMT surface.

Requirements:
- HTTPS
- exact source/build identity readback
- formal staff auth/session for business actions
- unauthenticated mutations fail closed
- acceptance token may protect preview/deployment but is not staff identity
- no browser/provider/Admin/commercial secrets
- Cloud browser is not Formal Order Authority

If safe off-LAN Store Kernel command routing is unavailable:
`REMOTE_OFF_LAN_COMMAND_PATH_NOT_IMPLEMENTED`

Do not create a second cloud order engine.

## 6. Promotion authority

Owner has granted explicit `PROMOTE` authority for PR #627 acceptance deployment after latest-main integration and GREEN source tests.

Authorized:
- Admin acceptance deploy through existing `mfk-admin` path
- SMT public acceptance deploy through existing `mfk-smt-web` path
- exact deployment readback
- desktop/mobile browser physical acceptance
- bounded fix → test → redeploy → reaccept loops in the same PR #627 scope

Not authorized by this PROMOTE:
- final PR #627 merge
- final hostname cutover
- OTA completion
- legacy Owner/SMM decommission
- new domain invention
- authority expansion

`ROLLBACK_LOCK_INCOMPLETE` does not block this acceptance deployment program.

## 7. First action

Fresh-read PR #627 + latest main + PR #623 foundation.

Then safely integrate latest main into:
`feat/MFK-UNIFIED-SURFACES-R1-2026-10-02`

Before implementation audit:
- v2admin
- v2owner
- v2local
- v2smm
- `v2local/wrangler.web-acceptance.jsonc`
- Admin auth/session
- SMT staff auth
- Store Kernel transaction path
- SMM LAN/runtime path
- P0 checkpoint/delta contracts
- Admin diagnostics
- Customer/Keeta regression paths

If runtime conflict appears:
STOP and report exact conflict.

Do not use `0223513a2142b02554fd6ff61808b871af8b5bbd` as final Unified Surfaces deploy SHA.

## 8. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

## 9. Legacy decommission gate

Do not delete `mfk-owner` or `mfk-smm-web` until:
- Admin Mobile = PHYSICAL_VERIFIED
- SMT Handheld = PHYSICAL_VERIFIED
- zero new-surface dependency on legacy workers is proven
- Owner separately authorizes decommission

MILESTONE:
`MFK_UNIFIED_SURFACES_R1_OWNER_LOCK_2026_10_02`
