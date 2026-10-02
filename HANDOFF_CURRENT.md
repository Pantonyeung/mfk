# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Current Stage:
A8 — Customer + Keeta + External

Branch:
`feat/MFP-V3-A8-CUSTOMER-KEETA-EXTERNAL-2026-10-02`

Parent:
#645 — MFP V3 A7｜Print + Hardware + Recovery｜2026-10-02

Parent exact SHA:
`806ca51cfd812a968f9208a45e14d8a228fa91e1`

A7:
SOURCE_VERIFIED
OWNER ACCEPTED

Current handoff:
`docs/handoff/MFP_V3_A8_CUSTOMER_KEETA_EXTERNAL_CODEX_HANDOFF_2026-10-02.md`

## Current objective

External Customer / Keeta facts
→ bounded external adapter/readback
→ MFP pending/review UI
→ formal Store Kernel operations only when authorized
→ canonical Order readback

## First RED

Customer duplicate intent:
same submissionId/idempotencyKey
→ zero Formal Order before Accept
→ exactly one canonical Order after Accept.

Keeta duplicate:
same provider identity/fingerprint
→ max one canonical Order.

## Owner A8 scope

Customer:
- Pay at store pending
- electronic payment evidence
- WhatsApp QR/contact
- accept / modify / cancel
- modification confirmation
- cutoff / immediate stop
- WhatsApp fallback

Keeta:
- inbound identity/dedupe
- mapping boundary
- auto/manual accept
- Immediate / Later
- Later max 2
- lifecycle
- after-sale/refund orchestration
- error attention

External:
- channel-threshold integration
- zero-polling event-driven coordinator
- provider-secret browser safety

## Hard locks

- no second Order engine
- no second Payment/Refund engine
- no Customer/Keeta Print engine
- no second Capacity truth
- no setInterval polling
- no focus/visibility request fan-out
- no v2 client-state import
- no SMM authority
- no provider secrets in browser

## Completion target

SOURCE_VERIFIED

Production external binding may remain BLOCKED.

MILESTONE:
`MFP_V3_A8_CURRENT_HANDOFF_2026_10_02`
