# MFK Customer Handoff｜2026-09-26｜Simple SMT → WhatsApp Fallback V1

## Owner Simplification
Customer submit:
1. Try SMT up to 3 times.
2. If unsuccessful, switch directly to WhatsApp.
3. Once WhatsApp fallback starts, terminate the original online submit path.
4. Never background-resubmit the same Checkout Intent.

## Minimal State
DRAFT
→ SUBMITTING
→ CONFIRMED
or
→ WHATSAPP_FALLBACK_LOCKED

## Only Safety Distinction Kept
FAILED_BEFORE_SEND:
safe to fallback after attempts.

UNKNOWN_AFTER_SEND:
perform one minimal SMT lookup/readback.
- found → normal confirmed flow
- not found → WHATSAPP_FALLBACK_LOCKED

No long reconcile workflow.

## Removed Complexity
- delayed retry after fallback
- reconnect auto-submit
- second fallback queue
- second order engine
- heavy fallback-reference collision governance

## Fallback Reference
4–6 numeric digits, default 6.
Human operational reference only.

## Rule
WHATSAPP_FALLBACK_LOCKED means the old Checkout Intent can never auto-submit again.

A later new online order requires a newly confirmed Checkout Intent.

## Milestones
CUSTOMER_SMT_3_ATTEMPT_TO_WHATSAPP_SINGLE_PATH_V1_LOCKED
CUSTOMER_WHATSAPP_FALLBACK_LOCKS_ORIGINAL_SUBMIT_V1_LOCKED
