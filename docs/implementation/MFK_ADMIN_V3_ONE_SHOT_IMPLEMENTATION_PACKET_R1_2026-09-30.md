# MFK Admin V3｜One-shot Implementation Packet R1

日期：2026-09-30
狀態：IMPLEMENTATION AUTHORIZED / ZERO PRODUCTION ROUTING
Owner instruction：開始實作
Product authority：#601 / merged Product Brief R1
Root control：#596
Production：v2 remains live

## 1. Delivery model

One isolated implementation program.

Internal gates:
- Gate 1 / A0-A1: foundation, release identity, auth/scope, canonical read
- Gate 2 / A2: projection + ACK/readback
- Gate 3 / A3: draft/edit/publish/readback
- Gate 4 / A4: Dexie only if offline formal command is explicitly approved
- Gate 5 / A5: auth/browser parity
- Gate 6 / A6: preview + physical acceptance
- Gate 7 / A7: cutover proposal only after acceptance

No partial production promotion.

## 2. Current implementation branch

feat/MFK-V3ADMIN-ONE-SHOT-R1

Base:
3c6c00d032eec121f1b6f1a9c059a3215c572ef0

## 3. Gate 1 scope

Implement:
- isolated V3 client
- client build identity
- serving release manifest identity
- mismatch => write lock
- memory-only auth
- centralized store/scope context
- TanStack Query canonical read
- shared validateMfkAdminConfigEnvelope
- no v2 localStorage
- no v2 client-state import
- zero production routing
- CI

Do not yet implement:
- production deploy
- full 53-page product
- offline publish queue
- Admin refund/cancel/payment-correction mutations
- backend/SMT authority rewrite

## 4. Carry-forward from A1

Selective reuse:
- challenge/verify proof flow
- TanStack Query policy
- memory-only session
- zero-routing CI principles

Rewrite:
- local canonical validator -> shared contract
- hard-coded store usage -> centralized scope context
- prototype UI -> Product Brief UI

Do not port:
- v2 browser storage
- local sync status truth
- compatibility migration
- unconditional Dexie outbox

## 5. Acceptance Gate 1

- npm test
- npm run typecheck
- npm run build
- dist/release.json exists
- no v2 state imports
- no localStorage/sessionStorage server truth
- shared canonical validator used
- client/serving release mismatch detectable
- no production routing
- PR review GREEN

## 6. Next after Gate 1

Build UI Shell / Design System,
then first vertical slice:

Login
-> Client Release Match
-> Canonical Read
-> Category
-> Product
-> Price
-> Draft
-> Validate
-> Impact
-> Publish
-> Cloud Readback
-> SMT Readback
-> Safari reopen convergence

MILESTONE:
MFK_ADMIN_V3_ONE_SHOT_IMPLEMENTATION_STARTED
