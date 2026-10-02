# MFP COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Program: MORE FUN POS V3 REBUILD
Updated: 2026-10-02 Asia/Hong_Kong
External Product: MoreFun POS
Short Name: MFP
Repository: Pantonyeung/mfk

## 0. Owner stage authorization

Owner explicitly accepted A7 at exact SHA:
`806ca51cfd812a968f9208a45e14d8a228fa91e1`

Owner explicitly authorizes advancement to:
A8 — Customer + Keeta + External

Current Stage:
A8 — Customer + Keeta + External

PR #627 remains legacy v2 rollback / containment evidence only.

## 1. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
3. `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`
4. `docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`
5. `docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`
6. `HANDOFF_CURRENT.md`
7. `docs/handoff/MFP_V3_A8_CUSTOMER_KEETA_EXTERNAL_CODEX_HANDOFF_2026-10-02.md`
8. current A8 Draft PR / Issue
9. parent PR #645 / exact parent SHA
10. Customer / Keeta contracts + verified donor evidence

Conflict:
`GOVERNANCE_DRIFT`

## 2. Product structure

MFP:
- MFP Pad
- MFP Mobile

SMM:
- cancelled as final product identity
- no new SMM authority/state/head/session

## 3. Stage status

A0 — SOURCE_VERIFIED
A1 — SOURCE_VERIFIED
A2 — SOURCE_VERIFIED
A3 — SOURCE_VERIFIED
A4 — SOURCE_VERIFIED / OWNER ACCEPTED
A5 — SOURCE_VERIFIED / OWNER ACCEPTED
A6 — SOURCE_VERIFIED / OWNER ACCEPTED
A7 — SOURCE_VERIFIED / OWNER ACCEPTED
A8 — CURRENT
A9 — Public + Diagnostics + Physical Acceptance + Cutover

## 4. A8 authority lock

A8 may connect:
- Customer pending intents
- payment evidence
- WhatsApp contact/fallback
- Customer external confirmation
- Customer cutoff/stop
- Keeta inbound/ACK/lifecycle/after-sale
- external channel attention

Do NOT rebuild:
- Order Authority
- Pricing
- Payment/Refund
- Availability/Capacity
- Print
- Sync
- Customer/Keeta provider engines

## 5. P0 external identity lock

`EXTERNAL DUPLICATE != NEW FORMAL ORDER`

Customer:
same submissionId/idempotencyKey
→ max one canonical Order.

Keeta:
same providerOrderId/providerMessageId/fingerprint
→ max one canonical Order.

Before Customer/Manual-Keeta formal accept:
- zero Formal Order
- zero ETA
- zero first print
- zero capacity consumption

## 6. Zero-polling lock

Do not copy legacy:
- setInterval business polling
- focus-triggered external fetch
- visibility-triggered request fan-out
- fixed 5-second pull

Use:
- startup bounded read
- external event / Doorbell
- reconnect
- manual refresh
- single-flight coalescing

Event payload is notification only, not canonical truth.

## 7. Customer Owner locks

Payment screenshot:
`EVIDENCE != PAYMENT TRUTH`

WhatsApp:
communication/fallback only.
Not a second Order writer.

Cutoff / immediate stop:
blocks future Customer new order intents only.
Must not stop local MFP trade or cancel existing Orders.

## 8. Keeta Owner locks

- AUTO / MANUAL comes from canonical policy
- Later != Reject != Cancel != Accept
- maximum defer = 2
- mapping failure stays attention
- provider duplicate does not duplicate Order
- provider after-sale does not replace A6/A5 refund authority

## 9. Visual lock

A8 Pad UI extends:
`MFP_PAD_ORDERING_VISUAL_LOCK_R1`

The locked top pending / external-order strip now receives real Customer / Keeta read-model facts.

No separate visual system.

## 10. Change control

Mode:
PREPARE

Authorized:
- bounded A8 source
- tests
- CI
- Draft PR
- source evidence

Not authorized:
- merge
- deploy
- OTA
- public cutover
- SMM decommission

Completion:
`SOURCE_VERIFIED`

## 11. Status language

Only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A8_CURRENT_EXECUTION_CONTROL_2026_10_02`
