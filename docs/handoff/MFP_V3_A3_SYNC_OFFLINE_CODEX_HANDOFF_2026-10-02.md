# MFP V3｜Codex Implementation Handoff｜A3 Sync + Offline｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A3-SYNC-OFFLINE-2026-10-02`

Parent:
- PR #635 — MFP V3 A2｜Device + Staff Security｜2026-10-02
- Parent exact head: `7d895e0eae3ba7678e4d23416b453912559887ad`
- A2 source status: SOURCE_VERIFIED
- A2 production binding: BLOCKED, carried forward as a production-binding blocker only

Controlling plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

P0 sync references:
- `docs/architecture/mfk-p0-sync/01_AUTHORITY_AND_VERSION_MODEL.md`
- `docs/architecture/mfk-p0-sync/03_DELIVERY_CHECKPOINT_RECOVERY.md`

## 0. Owner lock

A3 builds one event-driven MFP sync client for both Pad and Mobile.

Do NOT:
- import v2 client-state modules
- rebuild Admin canonical authority
- create MFP canonical configuration authority
- create SMM HeadSeq or SMM projection authority
- add periodic business polling
- use focus/visibility as a reason to fan out every domain request
- treat WebSocket/Doorbell as truth
- advance AppliedSeq before atomic local apply succeeds
- turn Cloud/projection into Formal Transaction Authority

A3 is source implementation only.
No merge / deploy / OTA / public cutover.

## 1. First RED

Write this before implementation:

Reconnect from disconnected state triggers exactly one single-flight sync catch-up for the current observed head, even if:
- WebSocket open
- initial doorbell
- online event
- foreground/resume signal

arrive close together.

Expected:
- one bounded catch-up chain
- no duplicate parallel HEAD/delta/checkpoint pulls
- no periodic timer
- no trailing infinite re-request loop

## 2. P0 authority model to preserve

Formal sync identities:

### HeadSeq
Server-side current sequence for the MFP/SMT Store Port projection.

### AppliedSeq
Client-side last sequence that was fully verified and atomically applied.

Connected != Applied.
Doorbell received != Applied.

### HEAD
Small metadata only.
Must be sufficient to decide:
- READY
- DELTA_REQUIRED
- CHECKPOINT_REQUIRED
- INCOMPATIBLE / FAILED

Expected metadata includes existing P0 concepts:
- storeId
- port
- schemaVersion
- headSeq
- journalFloorSeq
- checkpointSeq
- checkpointHash
- projectionHash
- observedAt

Do not put the whole menu/config snapshot inside HEAD.

### CHANGE
Daily delivery uses entity-level self-contained changes, not client-generated canonical truth.

### CHECKPOINT
Recovery object only.
Not routine delivery.

## 3. Required A3 transport seam

Create a fresh injected MFP sync transport, for example:

- `readHead()`
- `readChanges(afterSeq)`
- `readCheckpoint(checkpointSeq)`
- `ackApplied(...)`
- `connectDoorbell(listener)`

Exact names may differ.

Rules:
- transport does not own business state
- transport may return wire facts only
- no hard-coded production endpoint in A3
- production binding may remain adapter-injected
- A2 device/session context must be injectable into authorized transport requests
- auth failure is definitive security failure, not retry-as-unknown forever

## 4. Sync state machine

Minimum local sync states:

- UNINITIALIZED
- LOCAL_LKG
- CONNECTING
- READY
- BEHIND
- RECOVERING
- OFFLINE
- ERROR

Recommended derived facts:
- headSeq
- appliedSeq
- checkpointSeq
- schemaVersion
- lastDoorbellAt
- lastHeadReadAt
- lastAppliedAt
- lastAckAt
- lastError

These are diagnostics/readback facts, not business authority.

## 5. Warm path

If:
AppliedSeq == HeadSeq

Then:
- READY
- no delta pull
- no checkpoint pull
- no repeated periodic HEAD polling

Reconnect may perform one HEAD comparison.
Stable connected idle must settle to zero periodic business traffic.

## 6. Short delta catch-up

If:
AppliedSeq < HeadSeq
and AppliedSeq >= journalFloorSeq - 1

Flow:
HEAD
→ changes after AppliedSeq
→ verify contiguous sequence
→ verify schema
→ verify hashes/identity
→ stage temporary projection
→ atomic apply
→ update AppliedSeq LAST
→ ACK/readback

Requirements:
- duplicate delta idempotent
- gap/out-of-order fails closed and recovers from current AppliedSeq
- no partial visible apply
- crash before final local commit leaves previous LKG + previous AppliedSeq

## 7. Checkpoint recovery

If:
- new client, or
- AppliedSeq below journal floor, or
- server indicates checkpoint required

Flow:
HEAD
→ checkpoint
→ verify checkpoint identity/schema/hash
→ stage checkpoint
→ atomic install
→ tail changes after checkpointSeq
→ verify/stage
→ atomic final apply
→ AppliedSeq = final HeadSeq
→ ACK

Do not replay an arbitrarily long historical journal when a valid checkpoint is required.

Checkpoint failure:
- keep previous LKG
- AppliedSeq unchanged
- state RECOVERING/ERROR
- no fake READY

## 8. Atomic local projection

MFP may keep a durable Last Valid Projection for offline continuity.

Rules:
- LKG is a local copy of canonical projection, not a second authority
- one atomic pointer/transaction switch
- AppliedSeq changes last
- incomplete candidate never becomes active
- startup restores last complete valid projection only
- projection identity/hash must be validated before activation

Dexie may be used for:
- local projection candidate
- active pointer
- AppliedSeq/checkpoint metadata
- transport recovery metadata

Do not persist:
- a competing Admin draft
- a competing pricing/order truth
- a second Formal Transaction Authority

## 9. Doorbell contract

Doorbell is notification only.

Allowed data:
- event type
- port
- advertised headSeq / revision identity
- correlation/observed timestamp

Doorbell handler:
1. record observation
2. compare advertised head to local AppliedSeq if available
3. request/coalesce bounded catch-up
4. canonical pull decides truth

Never:
- apply canonical data directly from doorbell payload
- mark READY just because socket is open
- create order/config truth from WebSocket event

## 10. Single-flight / coalescing

A3 must have one catch-up coordinator.

Required:
- concurrent catch-up triggers share one in-flight promise/task
- while in-flight, newer advertised HeadSeq is remembered/coalesced
- completion rechecks whether a newer target was observed
- no duplicate parallel delta/checkpoint chain
- no recursive request storm
- no fixed retry timer

Retry/reconnect:
- bounded backoff for transport reconnect is allowed
- business-data polling timer is not allowed

WebSocket reconnect timer != business polling.
Keep these concepts explicit in code/tests.

## 11. Lifecycle events

Allowed triggers:
- cold boot/startup: one bounded restore + catch-up attempt
- network online transition: one bounded catch-up
- WebSocket reconnect: one bounded catch-up
- explicit manual diagnostics refresh if implemented

Foreground/visibility:
- may update UI connection state
- must NOT automatically trigger multi-domain business fan-out
- if a resume catch-up is retained, it must enter the same single-flight coordinator and must be covered by the first RED

No event may bypass coalescing.

## 12. Offline behavior

WAN down:

MFP:
- uses last valid projection
- displays OFFLINE / LOCAL_LKG truthfully
- does not claim fresh canonical state
- Store Kernel local formal transaction continuity remains a separate authority capability and must not be reimplemented here

A3 sync client:
- queues no blind config mutation
- does not synthesize HeadSeq
- reconnects when transport becomes available
- performs HEAD → delta/checkpoint recovery
- ACK only after local apply

## 13. Restart / crash recovery

Required tests:

- crash after downloading delta but before atomic commit
- crash after staging checkpoint but before pointer switch
- restart restores previous valid LKG
- AppliedSeq never jumps past applied projection
- next reconnect safely replays from previous AppliedSeq

No partial candidate should become active after restart.

## 14. A2 security integration

A3 does not solve the production security binding blocker.

But sync transport must support:
- current device identity
- current authorized session where required
- fail-closed auth rejection
- session/device revocation invalidates authorized sync/mutation paths as defined by formal authority

Do not weaken A2 to make sync convenient.

A2 production binding remains a separate BLOCKED item until a safe formal endpoint exists.

## 15. Shared Pad/Mobile proof

Both surfaces must use:
- same sync coordinator
- same AppliedSeq
- same active local projection on the same installation/runtime context
- same wire contracts
- same recovery semantics

Do not create:
- MFP_PAD HeadSeq
- MFP_MOBILE HeadSeq
- independent mobile canonical sync

If devices are physically separate installations, each may have its own local AppliedSeq/readback identity, but both track the same canonical Store Port HeadSeq and projection authority.

## 16. Minimal visible A3 harness

Per locked UI strategy, add only enough UI to verify:

- connection state
- HeadSeq
- AppliedSeq
- READY / BEHIND / RECOVERING / OFFLINE
- last canonical apply time
- manual test reconnect/catch-up action if useful
- local LKG available/not available

Do not build final ordering UI.
Formal product UI starts at A4.

## 17. Required RED-first and regression tests

At minimum:

1. reconnect coalesces open + doorbell + online/resume into one single-flight catch-up
2. stable idle has zero periodic HEAD/business polling
3. AppliedSeq == HeadSeq performs no delta/checkpoint pull
4. short delta pulls only missing changes
5. duplicate delta is idempotent
6. out-of-order/gap fails closed
7. checkpoint required path installs checkpoint + short tail
8. checkpoint hash mismatch keeps previous LKG and AppliedSeq
9. atomic apply updates AppliedSeq last
10. simulated crash before commit preserves previous active projection
11. restart restores last valid projection
12. missed doorbell recovered by reconnect HEAD catch-up
13. WebSocket open alone does not mean READY
14. doorbell payload never becomes canonical projection truth
15. concurrent triggers do not duplicate network chain
16. newer head observed during in-flight is coalesced and not lost
17. auth/device rejection fails closed
18. no v2 client-state import
19. no SMM HeadSeq/state/session dependency
20. no `setInterval` business polling
21. no focus/visibility request fan-out
22. Pad/Mobile share one sync contract
23. A1 idempotency behavior unaffected
24. A2 security tests remain green
25. built asset/source guard finds no legacy SMM business authority dependency

## 18. CI

Extend the dedicated MFP workflow.

Required:
- install
- test
- typecheck
- build
- authority/security/sync guard

Static guard should reject:
- `setInterval` for business sync
- v2 client-state imports
- `SMM_INTENT_STORE`
- SMM HeadSeq implementation
- `mfk-smm-web` dependency
- new production deploy config
- direct doorbell-to-canonical-apply patterns if statically detectable

No production deploy in A3.

## 19. Change control

Current mode:
PREPARE

Candidate-owned manifest should declare the A3 bounded paths.

Do not touch:
- production Builder/OTA
- Customer/Keeta engines
- Store Kernel internals unless only a shared contract import is strictly necessary
- v2local/v2smm runtime behavior

If A3 requires production authority/backend changes:
STOP and report the exact contract blocker before widening scope.

## 20. Completion target

A3 completion:
`SOURCE_VERIFIED`

A3 does NOT mean:
- production sync endpoint deployed
- physical offline acceptance complete
- OTA complete
- SMM decommission
- public MFP release

If production sync binding is unavailable:
report it separately as BLOCKED while source-level A3 may still be SOURCE_VERIFIED.

## 21. Completion report

Return exactly:

1. A3 implemented
2. Sync transport contract
3. HeadSeq/AppliedSeq authority contract
4. Single-flight/coalescing design
5. Doorbell invalidation proof
6. Delta catch-up proof
7. Checkpoint recovery proof
8. Atomic apply/LKG proof
9. Offline behavior
10. Restart/crash recovery proof
11. A2 security integration
12. Pad/Mobile shared-sync proof
13. Zero-polling proof
14. Minimal UI harness
15. Changed files
16. Exact SHA
17. Tests/results
18. CI
19. Production binding status
20. Remaining blockers
21. A4 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A3_SYNC_OFFLINE_2026_10_02`
