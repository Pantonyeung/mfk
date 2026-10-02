# MFP CURRENT HANDOFF｜2026-10-02

Status: CURRENT / CONTROLLING HANDOFF

Product:
MoreFun POS

Short name:
MFP

Current Stage:
A5 — Checkout + Money

Branch:
`feat/MFP-V3-A5-CHECKOUT-MONEY-2026-10-02`

Parent:
#639 — MFP V3 A4｜Ordering Surfaces｜2026-10-02

Parent exact SHA:
`b83321000668d39580a29e2e838aa585d5750fd5`

A4:
SOURCE_VERIFIED
OWNER ACCEPTED

Current Stage handoff:
`docs/handoff/MFP_V3_A5_CHECKOUT_MONEY_CODEX_HANDOFF_2026-10-02.md`

Controlling crosswalk:
`docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`

## Current objective

A4 Normalized Draft
→ formal price/revision validation
→ Checkout
→ Final Review
→ Payment Confirm
→ Store Kernel formal submit
→ canonical readback

Plus Owner FINAL money operations:
- Student Discount
- channel/tender
- cash keypad
- Business Day cash opening
- Cash In/Out
- Day Close
- retained cash
- Channel/Tender summaries
- immutable Daily Report money facts

## First RED

Before Payment Confirm:
formal Store Kernel commit count = 0.

After explicit Payment Confirm:
one submission only.

Double tap/retry:
same submissionId/idempotencyKey
→ no duplicate formal effect.

Stale formal price/revision:
→ reject before commit.

## Hard locks

- Pricing remains formal Store Kernel/Pricing authority
- Payment/Tender remains formal authority
- client preview != final quote
- no fake payment success
- no formal order identity before commit/readback
- no Manager-only assumption for Owner FINAL frontline checkout
- no v2 client-state import
- no SMM authority
- no periodic money polling
- no deploy/merge/OTA

## Completion target

SOURCE_VERIFIED

Production binding remains separately BLOCKED until formal runtime bindings and physical acceptance exist.

Status language:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A5_CURRENT_HANDOFF_2026_10_02`
