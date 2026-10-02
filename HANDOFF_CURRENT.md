# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Current:
A9R — Formal Business Command Router

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

## Current pass

R0:
- parser/registry/result/idempotency/native bridge/security seam

R1 first vertical:
- CHECKOUT_PAYMENT_CONFIRM

If formal Pricing/Tender dependency is absent:
report BLOCKED dependency, do not rebuild it in browser.

No Candidate Publish.

MILESTONE:
`MFP_V3_A9R_CURRENT_HANDOFF_2026_10_02`
