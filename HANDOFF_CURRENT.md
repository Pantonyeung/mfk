# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Current Stage:
A7 — Print + Hardware + Recovery

Branch:
`feat/MFP-V3-A7-PRINT-HARDWARE-RECOVERY-2026-10-02`

Parent:
#643 — MFP V3 A6｜Order Operations｜2026-10-02

Parent exact SHA:
`881afbd5fd463b4833e3b5980123fe33679bb260`

A6:
SOURCE_VERIFIED
OWNER ACCEPTED

Current handoff:
`docs/handoff/MFP_V3_A7_PRINT_HARDWARE_RECOVERY_CODEX_HANDOFF_2026-10-02.md`

Visual lock:
`docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`

## Current objective

Canonical PrintJob / Print Router
→ MFP Print/Hardware read model
→ existing Carrier durable gateway
→ physical printer binding
→ explicit evidence / recovery / reprint

## First RED

Canonical PrintJob J1 enters physical dispatch.

Process/device restarts while outcome is uncertain.

Expected:
- J1 remains same job
- state = UNKNOWN / AMBIGUOUS_AFTER_SEND
- zero automatic second physical dispatch
- human explicit reprint required
- reprint gets a new auditable identity
- no drawer/payment/order/fulfillment replay

## Scope

- PrintJob readback
- transport evidence
- gateway adapter
- physical printer bindings/IP
- health/test
- receipt/production/packing/label
- whole-ticket reprint
- per-label partial reprint
- Dining print
- cancel notice
- cash drawer boundary
- printer failure attention
- restart/power-loss recovery
- local/offline print continuity
- Print/Hardware UI

## Hard locks

- no second Print engine
- no browser DurablePrintJob authority
- no blind retry of UNKNOWN
- no drawer on reprint/correction/failed payment
- no v2 client-state import
- no SMM authority
- no periodic print polling
- no Carrier rewrite unless a proven blocker requires it

## Completion target

SOURCE_VERIFIED

Production/physical print binding may remain BLOCKED.

MILESTONE:
`MFP_V3_A7_CURRENT_HANDOFF_2026_10_02`
