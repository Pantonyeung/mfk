# MFK Customer Handoff｜2026-09-26｜Pickup Code Semantics V1

## Owner Correction Accepted
Pickup Code is NOT formal order display number.

Pickup Code:
customer phone last 4 digits.
Example:
9123 4567 → 4567.

## Locked Semantics
pickupCode = phoneLast4
displayNumber = formal store Order display sequence
fallbackReference = customer submission/manual fallback reference

All three are separate.

## Surface
Once contact phone is known:
Customer surface may show:
陳先生｜取餐碼 4567

Use consistently in:
- Memory Jar
- Checkout
- Order tracking
- Pickup
- WhatsApp fallback
- Staff/SMT pickup projection

## WhatsApp Correction
Fallback can include pickupCode before Formal Order exists.
Still include fallbackReference for dedupe / lookup.

## Safety
phoneLast4 is not globally unique.
Never use pickupCode as:
- customerId
- orderId
- database primary key

If multiple active orders share same last4:
Staff must disambiguate using name / item summary / displayNumber / additional phone check.

## Milestone
CUSTOMER_PICKUP_CODE_PHONE_LAST4_V1_LOCKED
