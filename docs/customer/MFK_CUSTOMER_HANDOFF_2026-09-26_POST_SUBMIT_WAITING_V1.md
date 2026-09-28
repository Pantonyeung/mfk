# MFK Customer Handoff｜2026-09-26｜Post-submit Waiting V1

## Owner Direction
If Customer→SMT succeeds:
- do not go WhatsApp
- show animated hold/waiting screen
- wait for store confirmation
- customer may exit
- Order Detail continues to show waiting if store has not confirmed

If Customer→SMT fails after 3 attempts:
- lock old submit
- WhatsApp fallback

## Separation
Transmission:
SUBMITTING → SMT ACK / Order Created

Merchant acceptance:
WAITING_STORE_CONFIRMATION → ACCEPTED / REJECTED

Never retry Submit because merchant has not accepted yet.

## Recommended Customer UX
Short success animation:
「訂單已成功送達」

Then:
「等待店舖確認」
+ animation
+ elapsed time
+ pickup code
+ order summary
+ can exit
+ status auto-updates

## Status Transport
Primary:
Realtime doorbell → canonical status readback.

Fallback foreground polling:
0–15s: 2s
15–60s: 5s
60s+: 10s

Foreground/network restore:
immediate readback.

Polling is READ ONLY.

## Reminder Ownership
Customer does not spam store with repeated bells.
SMT owns pending-order reminder cadence.
Admin can configure reminder interval / repeat / priority.
No auto accept/reject on timeout.

## Long Wait
Normal → Busy hint → Contact store option.
No automatic cancel/reject/resubmit.

## Milestones
CUSTOMER_POST_SUBMIT_WAITING_STORE_CONFIRMATION_V1_DRAFT_LOCKED
CUSTOMER_ORDER_STATUS_DOORBELL_READBACK_V1_DRAFT_LOCKED
CUSTOMER_WAITING_SCREEN_EXIT_RESUME_V1_DRAFT_LOCKED
