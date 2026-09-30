# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Control: #22
Program control: #596
Updated: 2026-09-30 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. #22 latest controlling comment
3. `docs/control/MFK_CHANGE_CONTROL.md`
4. `HANDOFF_CURRENT.md`
5. `docs/governance/MFK_WEB_CLIENT_PARALLEL_REBIRTH_AUTHORITY_R2_2026-09-30.md`
6. live repository / deployment / physical evidence relevant to the task

If controlling text conflicts with live repository evidence, report `GOVERNANCE_DRIFT`.
Do not guess and do not let stale text override verified live evidence.

## 1. Current product baseline

Current production v2 source baseline:

`3816a32f846fe36c7a2ca8fe7589e56796178b27`

Current v2 web clients remain the production baseline:
- v2admin
- v2smm
- v2customer
- v2owner

SMT / Cloud canonical / provider / payment / pricing / fulfillment authorities remain existing system authorities.

No production cutover to V3 has been authorized.

## 2. Owner strategy override｜Parallel V3 Web Client Rebirth

Owner explicitly changed the web-client implementation strategy.

The previous in-place migration strategy is superseded for broad web-state architecture work.

Controlling rule:
- keep v2 production running
- stop broad in-place v2 browser-state architecture migration
- build isolated V3 web clients in parallel
- preserve backend / Cloud canonical / SMT / API contracts
- V3 must not inherit v2 browser-state authority patterns
- no V3 production routing until physical/browser acceptance is GREEN

This is an explicit Owner exception to older wording that prohibited re-migration of an existing web port.

The exception is limited to parallel web-client rebuilds. It does not authorize rewriting transaction, pricing, payment, fulfillment, provider, SMT Store Kernel, or Cloud canonical authorities.

Authority document:

`docs/governance/MFK_WEB_CLIENT_PARALLEL_REBIRTH_AUTHORITY_R2_2026-09-30.md`

Root program tracker:

`#596`

## 3. V3 architecture lock

Cloud / server state:
- TanStack Query
- query/refetch/readback
- never durable browser authority

Durable explicit unsent command:
- Dexie / IndexedDB
- queued state requires a real pending command

Draft / UI:
- React or Zustand
- persisted draft must be versioned/migrated/partialized
- never formal server truth

Auth:
- separate security layer

Hard prohibitions:
- no durable browser PUBLISHED / QUEUED / PUBLISHING as server truth
- no localStorage formal outbox
- no browser-vs-Cloud timestamp ordering as authority
- no doorbell payload as a second data authority

## 4. Current active implementation slice

Single active implementation slice:

`V3ADMIN_A1_CANONICAL_READONLY`

Branch:

`feat/MFK-V3ADMIN-A1-CANONICAL-READONLY`

PR:

`A1 PR pending creation`

A0 is merged to Main at `f826598f0517229b94c7e817c642e808dc515cc3` with zero production routing.

A1 scope:
- isolated `v3admin/**`
- authenticated Admin challenge/verify using the existing backend contract
- session token held in React memory only
- TanStack Query read of formal `/api/admin-browser/active`
- shared canonical envelope validation
- visible read-only canonical summary
- reusable V3 CI
- zero production routing
- no v2 runtime code change
- no backend / SMT / SMM / Customer / Owner runtime change

A1 state:
- candidate branch only until PR promotion
- no config edit, publish, mutation or outbox command
- CI/review must be GREEN
- default delivery is Draft PR
- no merge/deploy/cutover without explicit Owner `PROMOTE`

## 5. V2 freeze rule

After R2:
- no broad v2 web-state framework migration
- no new v2 browser-state compatibility architecture
- v2 may receive only bounded production defect repair when backed by reproducible evidence
- v2 remains running baseline until V3 cutover acceptance

## 6. Admin data authority + delivery invariant

Admin remains the sole canonical authority for published configuration and operational policy data consumed by SMT.

Formal Admin publish contract:

`ADMIN FORMAL PUBLISH → CLOUDFLARE PUBLISHED TIME → DOORBELL → SMT CANONICAL PULL → ATOMIC APPLY → UI REFRESH → ACK / READBACK`

Hard rules:
- human-facing freshness uses Cloudflare publish time
- revision labels are not freshness authority
- doorbell is notification only
- canonical pull/readback is authority
- no second configuration authority may exist in browser local state, SMM, Customer, Owner or SMT
- reconcile may recover delivery but is not a second authority

## 7. Promotion rule

Default delivery is Draft PR only.

Without explicit Owner `PROMOTE`:
- do not merge
- do not deploy
- do not create production routing
- do not switch canonical hostname

Owner may authorize a later bounded promotion after reviewing candidate evidence.

## 8. Exact NEXT

1. Finish A1 candidate implementation.
2. Open A1 as Draft PR.
3. Require V3 CI + Regression Shadow + Codex review GREEN.
4. Bank A1 candidate evidence.
5. Wait for explicit Owner `PROMOTE` before merge.
6. No V3 deployment or hostname cutover.
7. After A1 is banked, A2 implementation is delegated to Codex from a written UI/behavior/acceptance specification.

MILESTONE: `MFK_V3ADMIN_A1_COMMANDER_LOCKED`
