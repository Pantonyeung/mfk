# MFK Codex UI Recomposition Handoff R1

Codex executor: use the installed UI / UX / responsive / accessibility skills.

## Read first

- GitHub #93 — umbrella constitution
- GitHub #94 — Admin
- GitHub #95 — Owner
- GitHub #96 — SMM
- GitHub #97 — Customer

## Core rule

UI may be substantially recomposed.
Product truth, runtime contracts and persistence semantics may not change.

## Frozen contracts

Do not change without an explicit separate integration issue:

- Product / Category / Option Set / Combo canonical identity
- Admin Save → immutable Active Revision
- Admin → SMT automatic sync contract
- Store Kernel / Order / Payment / Print execution authority
- pricing authority
- stable submission / request / idempotency identities
- persistence keys
- runtime port interfaces
- endpoint / payload contracts
- UNKNOWN / STALE / PARTIAL semantics
- offline / LKG semantics

## Codex working order

For ONE product only:

1. fresh-read current source
2. inventory current capabilities and user tasks
3. return CURRENT CAPABILITY → USER TASK matrix
4. propose NEW IA
5. propose SCREEN MAP
6. propose COMPONENT MAP
7. responsive / mobile / tablet / desktop rules
8. loading / empty / offline / error / stale state matrix
9. accessibility / keyboard / touch rules
10. exact source allowlist
11. exact contract freeze list
12. acceptance plan

Only after the planning return is accepted may Codex edit source.

## UI acceptance

Must cover:
- navigation
- responsive composition
- touch target size
- form usability
- density
- visual hierarchy
- state feedback
- accessibility
- mobile keyboard / safe areas where relevant

## Contract acceptance

Must prove unchanged:
- IDs
- payloads
- persistence
- pricing
- submission identity
- runtime ports
- side-effect authority

## Branches

- work/MFK/ADMIN-UI-REFRESH-R1
- work/MFK/OWNER-UI-REFRESH-R1
- work/MFK/SMM-UI-REFRESH-R1
- work/MFK/CUSTOMER-UI-REFRESH-R1

Never use one all-products redesign branch.

## Main Chat separation

Codex owns presentation recomposition only.

Main Chat continues integration/link-up independently and must not wait for Codex.
