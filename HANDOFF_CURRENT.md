# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Short name:
MFP

Current Stage:
A4 — Ordering Surfaces

Branch:
`feat/MFP-V3-A4-ORDERING-SURFACES-2026-10-02`

Parent:
#637 — MFP V3 A3｜Sync + Offline｜2026-10-02

Parent exact SHA:
`adc2cc64573d9d5f7b357a7955ff2b0edc1fd509`

A3 status:
SOURCE_VERIFIED

Current handoff:
`docs/handoff/MFP_V3_A4_ORDERING_SURFACES_CODEX_HANDOFF_2026-10-02.md`

Controlling plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

## Current objective

Build formal MFP ordering surfaces:

A3 Active Projection
→ shared MFP ordering selector/domain
→ MFP Pad UI
→ MFP Mobile UI
→ same normalized cart intent

Scope:
- categories
- products
- options/modifiers
- combo
- cart draft
- service mode
- local published-fact price preview
- read-only sellability
- Pad + Mobile actual ordering UI

## First RED

Same projection + same selections
→ identical normalized cart intent on Pad and Mobile.

No:
- second pricing authority
- second order authority
- second sync client
- SMM-specific business state

## A4 non-goals

Do not:
- formal Store Kernel checkout commit
- payment/tender
- display number allocation
- fulfillment truth
- print
- refunds/cancel
- external Customer/Keeta execution
- production deploy
- merge
- OTA

A5 owns formal checkout/money.

## Integration

A3:
- read active projection only
- no direct catalog fetch
- no new WebSocket/polling

A2:
- consume existing security gate/state

A1:
- cart remains draft; no formal order state

## UI quality

A4 is a real product UI stage.

MFP Pad:
- high-density order workspace

MFP Mobile:
- focused touch-first mobile workspace

Both:
- same shared domain contract
- same normalized intent
- same canonical material facts

## Completion target

SOURCE_VERIFIED

Production blockers from A2/A3 remain separately BLOCKED until bound/deployed.

Status language:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A4_CURRENT_HANDOFF_2026_10_02`
