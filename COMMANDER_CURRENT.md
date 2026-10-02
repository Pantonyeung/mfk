# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
Repository: Pantonyeung/mfk

## Owner authorization

Owner explicitly authorized the missing Formal Business Command Router authority/implementation lane after A9 source audit.

Parent A9 exact SHA:
`69adb11215677d506545c5428f8deea4b89e7db2`

Current substage:
`A9R — Formal Business Command Router`

Working branch:
`feat/MFP-V3-A9R-FORMAL-BUSINESS-ROUTER-2026-10-02`

## Mandatory read order

1. COMMANDER_CURRENT.md
2. HANDOFF_CURRENT.md
3. docs/governance/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_AUTHORITY_2026-10-02.md
4. docs/handoff/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_CODEX_HANDOFF_2026-10-02.md
5. docs/acceptance/MFP_V3_A9_SOURCE_BINDING_AUDIT_2026-10-02.md
6. docs/handoff/MFP_V3_A9_PUBLIC_DIAGNOSTICS_PHYSICAL_CUTOVER_CODEX_HANDOFF_2026-10-02.md
7. A1–A8 V3 source/contracts/tests
8. Store Kernel native contracts/coordinator/bridge
9. accepted donor behavior tests only

## Authority owner

`STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`

Runtime boundary:
Android Carrier / Store Kernel native authority layer.

React/browser is NOT the business authority.

## Current implementation pass

A9R R0 + first R1 vertical slice:

R0:
- native high-level command parser
- command registry
- result mapping
- bounded native bridge
- idempotency/readback
- reject browser raw aggregate mutation injection
- formal security seam

First vertical slice:
`CHECKOUT_PAYMENT_CONFIRM`

If formal Pricing/Tender authority inputs are absent:
STOP at safe BLOCKED boundary.
Do not move pricing/payment authority into React.

## Hard locks

- no direct browser aggregate mutations
- no second Order/Pricing/Payment/Refund/Print/Capacity authority
- no second DB
- no v2 client-state runtime import
- no SMM authority
- no fake COMMITTED
- no deploy / OTA / Builder publish request change / cutover

## A9 overall gates

A9-S source diagnostics = SOURCE_VERIFIED
A9-B Builder V3 packaging = SOURCE_VERIFIED
A9R formal router = CURRENT
A9-C Candidate Publish = BLOCKED
A9-P Physical Acceptance = BLOCKED
A9-X Cutover/SMM Decommission = BLOCKED

Completion target for current pass:
SOURCE_VERIFIED

MILESTONE:
`MFP_V3_A9R_CURRENT_EXECUTION_CONTROL_2026_10_02`
