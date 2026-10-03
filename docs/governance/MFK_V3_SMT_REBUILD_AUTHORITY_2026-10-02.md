# MFK V3 SMT Rebuild Authority｜2026-10-02

Date: 2026-10-02
EffectiveAt: 2026-10-02 Asia/Hong_Kong
Status: CURRENT / CONTROLLING FOR V3 SMT REBUILD
AuthorityScope: Fresh SMT client rebuild only
Owner Authorization: EXPLICIT

## Trigger

Physical acceptance on the legacy v2 SMT runtime proved two separate request path defects:
- deterministic periodic request storms;
- interaction-driven request fan-out across Admin sync / Keeta / Customer / sellability / projection seams.

The latest v2 bleed-stop removes the fixed-period storm, but the client remains historically coupled across multiple generations of polling, lifecycle, sync-status and legacy SMM behavior.

Owner direction:
- stop broad v2 SMT feature work;
- use v2 SMT only for rollback and security-critical containment;
- rebuild the POS/SMT client as V3.

## Product target

SMT
- SMT Desktop
- SMT Handheld

One product. One codebase. Different responsive interaction surfaces.

## Frozen authorities to preserve

V3 MUST NOT rebuild or duplicate:
- Store Kernel / Formal Transaction Authority
- Order Authority
- Pricing Authority
- Payment/Tender Authority
- Fulfillment Authority
- Print Router / Durable PrintJob Authority
- Idempotency / submission identity
- Admin canonical backend authority
- P0 checkpointed-delta sync contracts
- Customer / Keeta external authority contracts

## V3 client rules

1. Fresh client shell under `v3smt/`.
2. No import of v2 client-state modules.
3. No periodic business polling.
4. Doorbell is invalidation only, never truth.
5. Reconnect / online / foreground may perform bounded single-flight catch-up.
6. Cloud/server-derived state is not persisted as a second truth.
7. UI state is local-only.
8. Any durable command/outbox must preserve formal Store Kernel authority and idempotency.
9. Desktop and Handheld share the same business contracts and Store Kernel.
10. Browser/public surface never becomes a second transaction engine.

## State model

- Server/cloud read state: TanStack Query.
- UI/draft state: Zustand.
- Durable local transport/outbox metadata only where needed: Dexie.
- Formal business truth: Store Kernel / canonical backend, not the client store.

## Network contract

Idle:
- 0 periodic business requests.

Event:
- Doorbell → compare identity/head → bounded canonical pull → apply → readback.

Reconnect:
- one single-flight catch-up.

UI tap:
- local feedback first.
- no unrelated Customer / Keeta / sellability / config / projection fan-out.

## Migration model

Legacy `v2local`:
- frozen for feature development;
- retained for rollback and emergency containment;
- no deletion until V3 SMT physical acceptance.

V3 SMT cutover is separately gated.

## First milestone

A0 foundation only:
- fresh V3 app shell
- explicit Store Kernel port contract
- state-authority contract
- zero periodic polling guard
- zero v2 client-state import guard
- no production routing

MILESTONE:
`MFK_V3_SMT_A0_FOUNDATION_2026_10_02`
