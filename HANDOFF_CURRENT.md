# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Short name:
MFP

Current program:
MFP V3 A0–A9 REBUILD

## Current lane

Stage:
A3 — Sync + Offline

Branch:
`feat/MFP-V3-A3-SYNC-OFFLINE-2026-10-02`

Parent:
#635 — MFP V3 A2｜Device + Staff Security｜2026-10-02

Parent exact SHA:
`7d895e0eae3ba7678e4d23416b453912559887ad`

A2:
SOURCE_VERIFIED

A2 production binding:
BLOCKED, carried forward as a deployment/production-binding blocker only.

Current Stage handoff:
`docs/handoff/MFP_V3_A3_SYNC_OFFLINE_CODEX_HANDOFF_2026-10-02.md`

Controlling plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

## Current objective

Build one event-driven MFP sync/offline seam:

Doorbell / reconnect trigger
→ single-flight HEAD comparison
→ Delta or Checkpoint recovery
→ verify/stage
→ atomic apply
→ AppliedSeq last
→ ACK/readback

## First RED

WebSocket open + initial doorbell + online/resume events arriving together must produce one bounded sync chain only.

## Required properties

- zero periodic business polling
- one canonical Store Port HeadSeq
- per-installation AppliedSeq/readback allowed
- Connected != Applied
- Doorbell is invalidation only
- checkpoint for recovery only
- LKG survives offline/restart
- partial apply never becomes active
- Pad/Mobile share the same sync contract
- no SMM HeadSeq/state/session dependency
- A1 idempotency unchanged
- A2 security not weakened

## Non-goals

Do not:
- build final Ordering UI
- deploy
- merge
- request OTA
- modify Builder
- widen Customer/Keeta engines
- rebuild Admin canonical authority
- decommission SMM

## Minimal UI

A3 may show:
- connection state
- HeadSeq / AppliedSeq
- READY / BEHIND / RECOVERING / OFFLINE
- LKG available
- last apply
- explicit test catch-up if useful

## Completion

Target:
SOURCE_VERIFIED

Status language:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A3_CURRENT_HANDOFF_2026_10_02`
