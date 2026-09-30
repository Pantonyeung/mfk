# MFK Admin V3

Parallel one-shot rebuild under system authority #596 and approved Product Brief #601.

Status: IMPLEMENTATION IN PROGRESS / ZERO PRODUCTION ROUTING.

Production v2 remains live.

## State ownership

- Cloud/server state: TanStack Query
- durable explicit command outbox: disabled by default; Dexie/IndexedDB only if the Product Brief explicitly approves an offline command
- local form/UI state: React/Zustand, never canonical truth
- auth/session: separate in-memory security layer
- realtime: doorbell only; event causes canonical/read-model refetch

## Gate 1 scope

Current implementation proves:
- memory-only Admin auth
- shared canonical envelope validation
- centralized store/scope context
- client build identity vs serving release manifest
- canonical read with no-store + TanStack Query
- no v2 localStorage or v2 client-state import
- zero production routing

It does not yet implement the full 53-page product or production cutover.

## Commands

```bash
npm install --no-audit --no-fund --legacy-peer-deps --package-lock=false
npm test
npm run typecheck
npm run build
```
