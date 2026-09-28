# MFK Customer Handoff｜2026-09-26｜Numeric Fallback Reference V1

## Owner Decision
Manual fallback reference:
- numeric only
- 4 to 6 digits
- no letters
- no symbols

## Recommended Default
6 digits.

## Separation
pickupCode = phone last4
displayNumber = formal SMT order display sequence
fallbackReference = numeric 4–6 digits

## Lifecycle
One submissionId → one fallbackReference → same value across retries → WhatsApp fallback → staff lookup.

## Milestone
CUSTOMER_FALLBACK_REFERENCE_NUMERIC_4_TO_6_V1_LOCKED