# Local mobile operator UI candidate | 2026-10-03

Owner-directed bounded UI repair on `feat/MFP-MOBILE-OPERATOR-UI-2026-10-03`, exact base `8ab09ea09ced7e74787b20953aa91b890237a018`. This new local UI scope supersedes the prior diagnostic-only scope below for this candidate only.

The Owner requested Shopify-style POS ordering with restaurant customization, no Home or independent Cart page, and 待處理 / 點單 / 訂單 / 堂食 / 設定. Use the supplied desktop reference's functional grid/right-summary structure and blue/purple-white rounded visual treatment from the supplied mobile reference. Reference products, prices, offers and customer-home behavior are not canonical data.

Scope: existing operator navigation, mobile in-context selected items, Traditional Chinese operator copy, safe areas/touch targets, and honest actionable unavailable states. Preserve all authority ports and formal command semantics. No fake data or production binding, no security/money rewrite. Candidate-owned allowed paths are in `.github/mfk-change-manifest.json`.

No push, merge, deploy, OTA, native activation or physical acceptance. Existing deployed `34cd87ae` remains separate. Owner PROMOTE is required for any future publication.

# Local A9 diagnostic fail-closed integration | 2026-10-03

Owner-directed branch: `feat/MFP-V3-FRONTEND-REGRESSION-2026-10-03`.
Exact source parent: `26f44b60588c85eaeecfcb9c32c8b78e6dfdd4a1`. Existing deployed checkpoint remains `34cd87ae28f874ae97aaa74dac57b9d6dd83a06a`.

Owner-authorized Commander-led source repair and regression now integrates the independently reviewed A9 diagnostics increment over the local immutable-submission checkpoint. The candidate manifest declares only this bounded capability. Prior snapshot fixes and their security semantics remain intact; older pinned-base diagnostic metadata is not imported.

Scope: required health protocolVersion, native databaseName display, fail-closed physical/cutover evidence validation, regression/shared-wire fixtures, and the existing native CI test selector. Native JUnit remains unexecuted in this environment. No push, merge, deploy, OTA, production mutation, physical acceptance or inherited PROMOTE.

The actual shadow governance decision remains HARD_BLOCK and must be retained separately from passing software tests. See `docs/handoff/MFP_V3_DIAGNOSTICS_INTEGRATION_2026-10-03.md`. Final build identity must match the new exact local Git commit, never the deployed checkpoint.

## Historical local immutable-submission candidate below

# Local immutable submission snapshot integration | 2026-10-03

Owner-directed branch: `feat/MFP-V3-FRONTEND-REGRESSION-2026-10-03`.
Exact source parent and existing deployed checkpoint: `34cd87ae28f874ae97aaa74dac57b9d6dd83a06a`.

The Owner authorized Commander-led bounded source repairs and regression. This pass integrates the reviewed submission-snapshot repair locally. Its candidate-owned manifest and handoff supersede the earlier frontend candidate scope below for this incremental source change only. The prior Owner PROMOTE applied to the already-deployed 34cd87ae checkpoint; it does not carry to this new candidate. No push, merge, deploy, OTA, production mutation, native activation or physical acceptance is authorized by this pass.

Scope is the command-envelope payload snapshot, its regression tests, and required candidate controls. Preserve the session-bound fingerprint and existing recovery/security semantics. Sparse-array compatibility and authenticated changed-session recovery remain explicit residuals. Store Kernel retains all formal business authority.

See `docs/handoff/MFP_V3_SUBMISSION_SNAPSHOT_INTEGRATION_2026-10-03.md`. The exact final source SHA must be read from Git for the final build; never label modified source with deployed 34cd87ae identity.

## Historical deployed 34cd87ae candidate scope below

# Branch-local frontend regression and public acceptance scope | 2026-10-03

Owner-directed branch: `feat/MFP-V3-FRONTEND-REGRESSION-2026-10-03`.
Exact parent: `48c7eca6c051e72562ea9974bc2c6465b8584a7b`.

The Owner requested parallel, scenario-tested repairs and an independent public Cloudflare browser-acceptance deployment for joint debugging on 2026-10-03. This branch records that newer direction and supersedes the historical no-deploy instruction below only for that isolated static browser preview. It does not authorize merge, production routing replacement, APK installation, native OTA, live payments, or SMM decommission.

Single authority remains `STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`. Native production bindings and physical acceptance remain BLOCKED. The browser must not gain business authority or a fixture fallback. Changes in this branch are bounded frontend state/correlation/readback/sync repairs, regression enforcement, and dependency pinning. Native integration continues separately; no new native readiness claim is made here.

See `docs/handoff/MFP_V3_FRONTEND_SCENARIO_REGRESSION_ACCEPTANCE_2026-10-03.md` for reviewed patches, scenario evidence and remaining limits.

## Historical A9R entry below

The following entry describes the unchanged inherited native baseline and is retained as historical context, not as a claim that this new branch's frontend work was already verified in that earlier pass.

# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Current:
A9R — R0 router skeleton SOURCE_VERIFIED; R1 Checkout mutation BLOCKED

Branch:
`feat/MFP-V3-A9R-FORMAL-BUSINESS-ROUTER-2026-10-02`

Parent:
A9 exact head
`69adb11215677d506545c5428f8deea4b89e7db2`

Authority:
`docs/governance/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_AUTHORITY_2026-10-02.md`

Codex handoff:
`docs/handoff/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_CODEX_HANDOFF_2026-10-02.md`

## Why

A9 fresh audit proved:
`BLOCKED — FORMAL_COMMAND_ROUTER_BINDING_MISSING`

Current V3 high-level business commands do not have an approved production router into canonical Store Kernel authority.

## Current objective

Browser:
`mfp.store-kernel.command.v1`

→ trusted bounded native bridge

→ Formal Business Command Router

→ formal domain validation

→ StoreKernelTransactionCoordinator

→ canonical receipt/readback

→ `mfp.store-kernel.submission.result.v1`

## First RED

A browser CHECKOUT_PAYMENT_CONFIRM cannot contain or inject raw:
- aggregateType
- mutations
- canonical Order state
- canonical Payment state

Router internally derives canonical mutations only after formal validation.

Forged low-level mutation input must be rejected before Store Kernel commit.

## Current pass result

R0 `SOURCE_VERIFIED`:
- parser/registry/result/idempotency/native bridge/security seam
- exact 19-command matrix
- raw aggregate/canonical state rejection
- Store Kernel receipt-only terminal rejection persistence
- direct Browser `store.kernel.commit.v1` blocked

R1 first vertical remains `BLOCKED`:
- CHECKOUT_PAYMENT_CONFIRM
- `MFP_SECURITY_PRODUCTION_BINDING_MISSING`
- `FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING`
- `FORMAL_TENDER_AUTHORITY_DEPENDENCY_MISSING`

No Pricing, Tender, or PIN engine was created in the Router or React. No business aggregate mutation is authorized by this pass.

No Candidate Publish.

Exact next action: bind the existing canonical Security, Pricing, and Tender read authorities and freeze their input contracts before implementing the single native `CHECKOUT_PAYMENT_CONFIRM` handler.

MILESTONE:
`MFP_V3_A9R_CURRENT_HANDOFF_2026_10_02`
