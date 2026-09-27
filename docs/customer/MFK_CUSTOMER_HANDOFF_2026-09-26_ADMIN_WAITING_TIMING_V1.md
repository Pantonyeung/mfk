# MFK Customer Handoff｜2026-09-26｜Admin-configurable Waiting Timing V1

## Owner Decision
All waiting / refresh / reminder timing is Admin-configurable. No hardcoded seconds.

## Config Scope
Customer:
- auto status refresh interval
- manual refresh cooldown
- busy hint threshold
- contact-store threshold

SMT:
- first pending-order reminder delay
- reminder repeat interval
- repeat enabled

## Invariants
- refresh = read only
- reminder ≠ accept/reject
- no order resubmit because of waiting
- one published config source

## Milestone
CUSTOMER_WAITING_TIMING_ADMIN_CONFIG_V1_LOCKED
