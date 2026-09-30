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

## 4. Current active product phase

Single active Admin V3 phase:

`V3ADMIN_PRODUCT_BRIEF_LOCK_R1`

Controlling product candidate:

`docs/product/MFK_ADMIN_V3_PRODUCT_BRIEF_R1_2026-09-30.md`

Product issue:

`#601`

Execution state:
- A0 foundation remains merged and zero-routed.
- A1 PR #599 is parked as implementation reference only; do not merge it while Product Brief R1 is being locked.
- A2 issue #600 is superseded as an implementation roadmap by Product Brief #601; its detailed read-model ideas may be reused only where consistent with the Product Brief.
- No Codex one-shot implementation starts until Product Brief #601 is approved/published into Main.
- No V3 production deploy or hostname cutover is authorized.

One-shot strategy:
- freeze product/IA/UI first
- then one isolated Admin V3 implementation program
- full R1 product acceptance on preview
- cutover decision only after physical/browser acceptance


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

1. Review and approve Product Brief #601.
2. Merge the product-spec-only PR; no runtime deploy.
3. Bank A1/A2 incremental work as reference, not the implementation roadmap.
4. Prepare one-shot Codex implementation packet from the approved Product Brief.
5. Codex may modify only explicitly allowed V3 paths.
6. Build the complete Admin V3 R1 in isolation.
7. Run full automated + preview physical acceptance.
8. Only then propose production cutover.

MILESTONE: `MFK_ADMIN_V3_PRODUCT_BRIEF_LOCK_R1_ACTIVE`
