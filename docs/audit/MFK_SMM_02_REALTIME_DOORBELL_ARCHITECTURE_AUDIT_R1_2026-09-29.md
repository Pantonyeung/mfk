# MFK SMM-02 Realtime Doorbell Architecture Audit R1

## Status

`QUARANTINE / AUDIT_ONLY / NO_IMPLEMENTATION`

- Repository: `Pantonyeung/mfk`
- Recovery base: `052295861931b72aa401aa6fa06c3cd65866706d`
- Branch: `candidate/MFK/SMM-02-realtime-doorbell`
- Sibling rule: this branch does not contain or depend on the SMM-01 source delta.
- No merge, deploy, OTA, transaction-authority change, cloud-mirror change, or schema migration is authorized here.

## Executive verdict

A correct SMM doorbell cannot be implemented as a small isolated delta on this base.

The repository has an Admin/SMT WebSocket doorbell, but the event and the SMM canonical fetch do not currently converge on the same operational read model:

1. Physical SMT sends `ORDER_UPSERT` events to the Admin projection and Admin emits `SMT_PROJECTION_AVAILABLE`.
2. SMM `/api/smm/snapshot` does not read that Admin order projection. It reads `acceptance-projection` from `SMM_INTENT_STORE`.
3. `acceptance-projection` is published only by the temporary Web Acceptance runtime, using a 1.5-second reconcile timer.
4. Physical SMT dining/work data has no production SMM cloud mirror on this base.
5. The Physical SMT LAN host supports request/response HTTP only; it has no event stream.

Adding a client WebSocket now would therefore ring a doorbell before the canonical SMM snapshot is guaranteed to contain the change. That violates:

`Persist -> Doorbell -> Canonical Fetch -> Apply -> Readback / ACK`

It would also risk hiding the separately governed `SMM Offline Read Model / Physical SMT Cloud Mirror` gap. Implementation is quarantined.

## Current canonical fetch paths

### SMM browser

`v2smm/src/pwa-runtime.ts`

1. `readSnapshot()` first tries a LAN `smm.lan.snapshot.v1` request when LAN is configured.
2. The LAN attempt is bounded by 3.5 seconds.
3. Failure falls through to `/api/smm/snapshot` or the explicit Web Acceptance snapshot route.

### Physical SMT LAN snapshot

`v2local/src/runtime/smm-lan-ingress.ts`

- `createSmmLanIngress(...).readSnapshot()` derives the snapshot directly from current local runtime state.
- `orders` and `work` are derived from `runtime.orders()`.
- `dineSessions` is derived from `runtime.holds()`.
- Menu/config comes from the accepted Admin config LKG.
- This is a canonical read of current Physical SMT state; it is not a cloud mirror.

`carrier/android/app/src/main/java/com/morefunos/smt/smm/SmmLanHost.java`

- Exposes `GET /smm/v1/health` and `POST /smm/v1/request`.
- Replies with `Connection: close`.
- Has no WebSocket, SSE, long-poll, or event subscription endpoint.

### Internet SMM snapshot

`v2smm/worker.ts`

- `mapPublishedSnapshot()` builds menu/config and deliberately starts with `orders: []`, `work: []`, and `dineSessions: []`.
- Both `/api/smm/snapshot` and `/api/smm/acceptance/snapshot` overlay operational rows from the same `SMM_INTENT_STORE` key: `acceptance-projection`.
- The snapshot has `observedAt`, but no monotonic operational projection revision/cursor suitable for event dedupe and readback confirmation.

## Existing transport and storage inventory

| Area | Existing seam | What it proves | Why it is not yet the SMM doorbell |
| --- | --- | --- | --- |
| SMM Durable Object | `SMM_INTENT_STORE` / `SmmIntentStore` | Store-scoped durable intent, staff session, Web Acceptance projection, and bridge state exist | No WebSocket endpoint or accepted SMM invalidation contract exists |
| Admin realtime | `AdminSyncStore /events` | WebSocket doorbell transport already exists | It is an Admin/SMT event channel, not a same-source SMM snapshot invalidation contract |
| Admin config | `ADMIN_CONFIG_AVAILABLE` | Config publication can notify connected clients | SMM has no current subscription, and this covers config only |
| SMT projection | `SMT_PROJECTION_AVAILABLE` after `/api/projection/events` persistence | Physical order projection acceptance can ring after persistence | SMM snapshot does not read this projection; dining/work completeness is absent |
| Web Acceptance | `reconcileSmmWebAcceptanceIntake()` | A full SMM-shaped snapshot can be posted to `acceptance-projection` | Acceptance-only runtime uses 1.5-second polling and is not the Physical SMT production mirror |
| Physical LAN | `SmmLanHost` | Trusted devices can request a fresh canonical LAN snapshot | Request/response only; no server-push transport |

## Mutation-source inventory

### CONFIG

Source:

- Admin publishes an accepted config envelope through `AdminSyncStore.publishEnvelope()`.
- The Admin Durable Object persists `active` and then emits `ADMIN_CONFIG_AVAILABLE`.
- SMM Internet snapshot fetches current Admin active config through `fetchActive()`.

Assessment:

- The persistence-before-doorbell order exists for config.
- This is the only mutation family that is close to reusable without inventing a second truth.
- It is not sufficient to label the whole SMM operational snapshot realtime.

### ORDER

Sources converge in `v2local/src/runtime/local-runtime.ts`:

- Frontline SMT order creation and order operations.
- SMM order admission through `createSmmLanIngress()`.
- Customer bridge intake.
- Keeta intake and provider lifecycle updates.
- Fulfillment, correction, refund, cancellation, and other accepted order changes.

Current propagation:

- Accepted order mutations call `projectOrder()`.
- `projectOrder()` calls `queueOrderProjection()`.
- The outbox persists `ORDER_UPSERT` locally and flushes it to Admin `/api/projection/events`.
- Admin persists the order projection and emits `SMT_PROJECTION_AVAILABLE`.

Gap:

- SMM `/api/smm/snapshot` does not consume Admin `projection:order:*` records.
- Reusing the Admin event would cause SMM to fetch a different, potentially stale operational source.
- Redirecting SMM to the Admin order projection would be a separate read-model/authority design and would still not supply the existing SMM `work` and `dineSessions` shape.

### WORK

Source:

- `work` is not independently persisted. `createSmmLanIngress().readSnapshot()` derives it from current Physical SMT orders and fulfillment labels.

Gap:

- There is no canonical cloud `work` projection/revision for SMM to fetch after an event.
- An `ORDER_UPSERT` hint may imply work changed, but only once a canonical SMM cloud projection exists.

### DINING

Source:

- `dineSessions` is derived from `localRuntime.holds()`.
- Dining mutations persist through `save()`, `commitDiningState()`, and `commitDiningHolds()` and notify in-process runtime listeners.

Gap:

- Dining hold/session mutations are not represented by the current SMT projection contract.
- A formal dining order may emit `ORDER_UPSERT`, but table assignment, party size, joined tables, payments, waiting state, archive, and other hold changes can occur independently.
- No production SMM cloud mirror or event source covers the complete dining snapshot.

### SMM-origin commands

- Order submission retains explicit transaction readback and refresh behavior.
- Fulfillment retains explicit command readback and canonical refresh behavior.
- These explicit readbacks must remain even after a future doorbell exists; a doorbell is never transaction confirmation.

## Web Acceptance path

`v2local/src/runtime/smm-web-acceptance-intake.ts`

- Polls pending SMM orders and fulfillment commands.
- Publishes `ingress.readSnapshot()` to `/api/smm/acceptance/smt/projection`.
- Runs on initial load, lifecycle recovery, and a 1.5-second visible/online interval.

`v2smm/worker.ts`

- Stores that payload as `acceptance-projection`.
- Does not emit an SMM snapshot invalidation event after the projection write.

Assessment:

- A Durable Object doorbell could be emitted after this write, but it would describe only the temporary Web Acceptance mirror.
- Shipping that as the production SMM realtime design would conceal the missing Physical SMT mirror and retain a separate polling producer.

## Why the existing Admin WebSocket is not enough

The Admin WebSocket is useful prior art, not the missing SMM contract.

- It emits multiple operational hints (`ADMIN_CONFIG_AVAILABLE`, `SMT_PROJECTION_AVAILABLE`, Customer/Keeta hints, refunds).
- `SMT_PROJECTION_AVAILABLE` identifies accepted Admin projection event types, not a revision of the SMM snapshot.
- SMM cannot confirm the event by fetching the same canonical operational read model.
- Directly treating the Admin event payload as SMM data would create a second transaction/read-model truth.
- Forwarding raw Admin event taxonomy into SMM would couple SMM to sources rather than to snapshot invalidation.

## Minimum future contract

Do not start with `ORDER_CHANGED`, `WORK_CHANGED`, `DINING_CHANGED`, and `CONFIG_CHANGED`.

The minimum safe V1 doorbell is one generic invalidation:

```json
{
  "schema": "MFK_SMM_DOORBELL_V1",
  "type": "SMM_SNAPSHOT_INVALIDATED",
  "storeId": "MF01",
  "eventId": "opaque-id",
  "issuedAt": "ISO-8601"
}
```

Rules:

- Payload contains no order, work, dining, price, or transaction facts.
- `eventId` is dedupe identity only, not transaction identity.
- Add a projection revision/cursor only after the canonical snapshot source owns and returns one.
- Publish only after the canonical read model has durably accepted the corresponding change.
- Client dedupes the event, enters the same single-flight refresh boundary, fetches the canonical snapshot once, validates it, applies it, and retains explicit command readback separately.
- Socket open/reconnect performs one catch-up fetch because events may be missed while disconnected.
- No periodic business-snapshot fallback.

## Required unquarantine gates

1. SMM-01 passes live acceptance and its containment delta is transplanted onto the then-accepted base.
2. A separate `SMM Offline Read Model / Physical SMT Cloud Mirror` capability is approved with explicit ownership, persistence, freshness, and authority boundaries.
3. Physical SMT `orders`, derived `work`, and `dineSessions` have one canonical cloud snapshot source that SMM can fetch without inventing transaction truth.
4. The canonical snapshot exposes an accepted projection identity or a documented reconnect catch-up rule that does not rely on client clocks.
5. Every relevant mutation path is mapped to a persistence-complete invalidation point.
6. LAN realtime scope is decided explicitly: either add a trusted Physical SMT event transport with Android/device acceptance, or declare cloud doorbell only and preserve lifecycle/manual LAN catch-up.
7. SMM event-channel authentication/origin policy, reconnect backoff, and connection-state behavior are approved.
8. Web Acceptance polling is not presented as the production Physical SMT mirror.

## Candidate implementation slices after unquarantine

1. Cloud producer: publish generic invalidation only after canonical SMM projection persistence.
2. Cloud transport: expose same-origin `/api/smm/events?storeId=MF01` as a lightweight doorbell channel.
3. Client: dedupe `eventId`, use the accepted SMM-01 single-flight refresh boundary, catch up once on connect/reconnect, and keep LKG while offline.
4. LAN transport, if approved: add a trusted event channel at the Physical SMT host and complete source/device acceptance separately.

These slices must not carry snapshot payloads in events and must not make SMM transaction authority.

## Request-budget result

This audit makes no runtime request change.

- SMM-01 owns removal of the 2.5-second SMM snapshot poll.
- SMM-02 must not reintroduce a fallback business-snapshot timer.
- A future idle connected SMM should maintain at most one lightweight event connection and issue `0` business snapshot requests/minute when no invalidation occurs.

## Authority and persistence impact

- Authority impact: `NONE` in this audit.
- Persistence impact: `NONE` in this audit.
- Durable Object schema migration: `NONE`.
- Physical SMT cloud mirror: deliberately not implemented.
- Transaction, fulfillment, pricing, config, printing, cash drawer, Sync V2, localStorage, and OTA behavior: unchanged.

## PASS / FAIL / BYPASS

### PASS

- Audit identifies the actual persistence, event, and canonical-fetch seams.
- No event payload is proposed as business truth.
- Missing Physical SMT mirror and LAN event transport remain explicit blockers.
- SMM-02 stays independent from the SMM-01 branch.

### FAIL

- Client WebSocket is added before canonical projection convergence exists.
- Admin projection events are treated as proof that `/api/smm/snapshot` is current.
- Web Acceptance projection is mislabeled as the Physical SMT production mirror.
- A timer fallback or second transaction truth is introduced.

### BYPASS

Keep SMM-02 quarantined. Use SMM-01 lifecycle/manual/transaction readback refreshes only. Open a separately authorized Physical SMT Cloud Mirror audit before resuming realtime implementation.

## Dependency

`QUARANTINED`

- Future client implementation depends on accepted SMM-01 containment, transplanted onto the then-accepted main/base.
- Production operational invalidation depends on a separately approved Physical SMT Cloud Mirror / Offline Read Model capability.
- This audit does not grant either dependency or authorize implementation.
