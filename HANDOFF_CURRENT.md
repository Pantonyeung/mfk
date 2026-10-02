# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Current Stage:
A6 — Order Operations

Branch:
`feat/MFP-V3-A6-ORDER-OPERATIONS-2026-10-02`

Parent:
#641 — MFP V3 A5｜Checkout + Money｜2026-10-02

Parent exact SHA:
`830fd2f033f2246c1a4f30da71a0a8f9160da751`

A5:
SOURCE_VERIFIED
OWNER ACCEPTED

A5 UI polish:
DEFERRED BY OWNER

Current Stage handoff:
`docs/handoff/MFP_V3_A6_ORDER_OPERATIONS_CODEX_HANDOFF_2026-10-02.md`

Controlling crosswalk:
`docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`

## Current objective

Canonical Formal Orders
→ shared MFP Order Operations layer
→ Orders / Fulfillment / Dining / Sold-out / Capacity
→ formal Store Kernel commands
→ canonical readback

## First RED

Same canonical Order:
IN_PROGRESS → READY → IN_PROGRESS

must remain the SAME Order.
No second Order.
No duplicate formal effect.

## Owner Final A6 scope

- Orders three source lanes
- Source → Tender filters
- Fulfillment
- ETA
- modification / correction / refund / cancel
- Dining 3×3 + Waiting
- same-order table assignment/transfer
- split checkout orchestration to A5
- Sold-out / Restore
- Capacity Pool
- independent channel thresholds
- bounded override
- More / Tools shell

## Hard locks

- no second Order Authority
- no second Availability/Capacity authority
- no Dining Order engine
- no Dining Payment engine
- no Print engine
- no Customer/Keeta provider engine
- no v2 client-state import
- no SMM authority
- no periodic business polling

## Completion target

SOURCE_VERIFIED

Status language:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A6_CURRENT_HANDOFF_2026_10_02`
