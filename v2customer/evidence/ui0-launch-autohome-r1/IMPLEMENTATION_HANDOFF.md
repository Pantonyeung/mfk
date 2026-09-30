# CUSTOMER-UI0｜Launch Auto-Home R1｜Implementation Handoff

Date: 2026-10-01
Issue: #606
PR: #607
Branch: `candidate/MFK/CUSTOMER-UI0-LAUNCH-AUTOHOME-R1`
Base: `d4889ef4835ea4582324c4c2e9d8eb1435d3477e`

## Owner-Locked Behaviour

- Existing Stage 0 visual / video / IP presentation stays unchanged.
- Launch no longer asks the customer to choose Home vs Member.
- First visit: auto-enter Home after 2.5s.
- Returning session: auto-enter Home after 0.7s.
- Reduced motion: auto-enter Home after 0.12s.
- Member remains a normal Bottom Navigation destination.
- Direct deep links such as `/member` are not hijacked by the launch overlay.

## Runtime Changes

1. `v2customer/src/launch/LaunchOverlay.tsx`
   - removed Home / Member CTA fork
   - added timer-driven auto Home
   - guards against duplicate timer completion
   - keeps existing video / fallback / variant logic

2. `v2customer/src/App.tsx`
   - Launch overlay appears only for root/Home entry
   - removed `onEnterMember` Launch prop
   - direct member deep link remains on member route

## Scope Boundary

No changes to:
- Stage 0 visual assets
- Stage 1 Home
- Browse
- Product
- Cart / Checkout
- Submit / Order state
- Member UI itself
- backend / runtime authority
- deploy / OTA

## Acceptance Gate

Before merge:
- CI / build green
- first visit auto Home
- returning auto Home
- reduced-motion auto Home
- no Home / Member launch buttons
- direct `/member` deep link remains `/member`
- Owner confirms Stage 0 behaviour

Status: CANDIDATE / HOLD
