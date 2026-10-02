# MFK Unified Surfaces R1 Authority｜2026-10-02

Date: 2026-10-02
EffectiveAt: 2026-10-02 Asia/Hong_Kong
Status: CURRENT / CONTROLLING
AuthorityScope: PR #627 — Unified Surfaces R1｜Admin Mobile + SMT Mobile/Public
Owner Authorization: EXPLICIT
Promotion Scope: ACCEPTANCE_DEPLOYMENT_AUTHORIZED
Supersedes:
- `COMMANDER_CURRENT.md` 2026-09-30 V3-only / no-broad-v2 implementation rule, only for the Unified Surfaces R1 scope below.
- `docs/governance/MFK_WEB_CLIENT_PARALLEL_REBIRTH_AUTHORITY_R2_2026-09-30.md`, only where it would prohibit the bounded v2admin / v2local surface convergence authorized here.
- `docs/handoff/2026-10-02_smt_unified_surfaces_proposal.md` as product-decision authority; that document becomes historical design input.

## 1. Owner hard lock

The final product structure is:

ADMIN
- Admin Desktop
- Admin Mobile / Owner Surface

SMT
- SMT Desktop
- SMT Mobile / Handheld

The following independent product identities are retired as target architecture:
- independent Owner App
- independent SMM

Legacy services remain temporarily available only for rollback/transition:
- `mfk-owner`
- `mfk-smm-web`

They must not be deleted until the new surfaces are physically verified and Owner separately authorizes decommission.

## 2. Authority boundaries

Admin Desktop and Admin Mobile share the same Admin authority:
- same Admin session/authentication
- same canonical readback
- same permission model
- same audit
- same publish/governance APIs
- same diagnostics
- same command pathways

Admin Mobile is a mobile UX projection. It is not a second Admin authority.

SMT Desktop and SMT Handheld share the same Store Kernel / Formal Transaction Authority:
- same Revision
- same Idempotency
- same submission identity
- same Pricing Authority
- same Order Authority
- same Fulfillment Authority
- same Print Authority
- same canonical readback

Browser/mobile surfaces never become a second transaction authority.

## 3. Owner feature migration rule

`v2owner` may be used only as UI / workflow / product-behavior donor.

Valid Owner-facing operational UX may move into Admin Mobile, including:
- Today / Overview
- Action Queue
- Orders oversight
- Channel health
- Planning
- Sellability
- Staff overview
- Device health
- Reports
- Manager log
- Activity / Audit
- settings summary

Do not migrate:
- second runtime authority
- second auth authority
- second configuration state
- second command truth
- Owner polling authority

Any persisted Owner state may survive only when it is UI draft/preferences. It must not become server truth.

## 4. Admin responsive contract

Desktop remains the full Admin workspace.

Mobile is a purpose-built mobile layout, not scaled desktop.

Required acceptance viewports:
- 390x844
- 430x932
- 768x1024
- 1440 desktop

Mobile priority:
- Today / Overview
- Orders
- Action Queue
- Sellability
- Channels
- Staff
- Diagnostics
- More

Structural configuration may remain accessible, but permission decisions always use the same Admin permission model.

## 5. No Owner network dependency

New Admin Mobile must not depend on:
- `owner.morefunos.com`
- `mfk-owner`
- `v2owner` runtime APIs

Acceptance must prove that normal Admin Mobile operation continues when the legacy Owner worker is unavailable.

## 6. SMT Handheld convergence

`v2smm` may be used only as Handheld UX / interaction donor.

Handheld behavior may donate:
- ordering flow
- cart
- product/options/combo UX
- checkout UX
- orders
- dine-in
- sold-out
- more/tools
- staff session UX

Do not retain as the new formal path:
- `SMM_INTENT_STORE`
- SMM independent runtime authority
- SMM pricing authority
- SMM formal queue authority
- SMM cloud command authority
- SMM independent canonical Port authority

New Handheld must enter the formal SMT runtime / Store Kernel path.

## 7. Sync transition model

Current P0 sync foundation may keep legacy SMM compatibility during transition, but new product semantics are:

Canonical Port:
- SMT

Surface observations:
- Desktop
- Handheld

Desktop and Handheld may have distinct client IDs / Applied evidence, but they share:
- SMT HeadSeq
- SMT projection
- SMT canonical semantics

Connected != Applied remains controlling.

Do not perform a destructive enum migration merely to remove SMM immediately. Legacy compatibility may remain until `mfk-smm-web` decommission.

## 8. Public SMT rule

`v2local/wrangler.web-acceptance.jsonc` / `mfk-smt-web` is authorized to evolve from WEB_ACCEPTANCE_ONLY into an authenticated public SMT surface.

Required:
- HTTPS
- Internet reachable
- exact source SHA observable
- build/release identity observable
- no public unauthenticated business mutation
- no browser secret
- no provider/Admin/commercial HMAC secrets in browser
- no staff PIN/hash output
- formal SMT staff/session security for business actions

Existing `WEB_ACCEPTANCE_TOKEN` may remain as preview/deployment protection only. It is not final staff identity.

Public SMT does not make Cloud/Browser a Formal Order Authority.

If safe off-LAN command routing to Store Kernel is not implemented, report:
`REMOTE_OFF_LAN_COMMAND_PATH_NOT_IMPLEMENTED`

Do not create a second cloud order engine.

## 9. Print rule

All formal print actions from Desktop or Handheld remain:

Surface
→ Store Kernel
→ Durable PrintJob
→ Print Router
→ Hardware Host / Print Edge
→ Physical Printer

Handheld never owns printer authority.

## 10. Customer / Keeta / P0 sync regression lock

This program does not rewrite Customer or Keeta.

The following P0 foundation remains required:
- Customer Commercial Freshness
- five-minute B+ proof
- Delta / Checkpoint
- Keeta minimum mutation
- ProviderAppliedSeq
- immutable R2 checkpoint
- Admin diagnostics

Regression must remain GREEN.

## 11. Security lock

Public SMT must audit:
- asset exposure
- API exposure
- staff authentication
- session expiry
- CSRF/origin handling
- websocket auth
- command auth
- secret exposure

Any business mutation endpoint must fail closed when unauthenticated.

## 12. Acceptance deployment PROMOTE authority

Owner grants explicit `PROMOTE` authority for acceptance deployment of PR #627 Unified Surfaces R1 after:
1. latest main is integrated safely;
2. relevant source/unit/integration tests are GREEN;
3. exact deployment SHA is locked.

This PROMOTE authority permits:
- deploy Admin candidate to `mfk-admin` / existing approved Admin route
- deploy public SMT candidate to `mfk-smt-web` / existing workers.dev endpoint or already-approved custom domain
- provision required candidate resources such as `SYNC_CHECKPOINTS` or `CUSTOMER_COMMERCIAL_PROOF_KEYRING` where the existing formal contract requires them, without exposing secrets
- perform runtime readback and browser physical acceptance
- perform bounded fix → new SHA → re-test → redeploy → reaccept loops inside the same Unified Surfaces R1 scope

Every deployment must record:
- exact source SHA
- buildId
- deployedAt
- Worker version
- URL
- health
- release identity

This PROMOTE authority does NOT authorize:
- final merge of PR #627
- final hostname cutover
- OTA acceptance completion
- legacy Owner/SMM decommission
- new domain invention
- second Cloud Order Authority
- destructive migration outside this scope

Those remain separate Owner gates.

`ROLLBACK_LOCK_INCOMPLETE` no longer blocks Unified Surfaces R1 implementation/acceptance deployment.

## 13. First action after this authority lands

Fresh-read:
- PR #627
- latest main
- PR #623 foundation
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

Then integrate latest main into:
`feat/MFK-UNIFIED-SURFACES-R1-2026-10-02`

If a runtime conflict appears:
STOP and report the exact conflict.

Do not treat foundation SHA `0223513a2142b02554fd6ff61808b871af8b5bbd` as the final Unified Surfaces deploy SHA.

## 14. Status language

Only use:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

## 15. Completion boundary

Legacy decommission may be considered only after:
- Admin Mobile = PHYSICAL_VERIFIED
- SMT Handheld = PHYSICAL_VERIFIED
- new surfaces prove zero dependency on legacy Owner/SMM workers
- Owner separately authorizes decommission

Milestone:
`MFK_UNIFIED_SURFACES_R1_OWNER_LOCK_2026_10_02`
