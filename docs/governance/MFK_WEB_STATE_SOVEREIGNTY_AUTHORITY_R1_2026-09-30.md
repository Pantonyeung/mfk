# MFK Web State Sovereignty Authority R1

Date: 2026-09-30  
Status: CURRENT / CONTROLLING / SYSTEM-WIDE  
Root Control: Pantonyeung/mfk #596  
Scope: Admin / SMM / Customer / Owner / future web ports

## 1. Why this is authority-level

A browser is not allowed to become a second system authority.

The production incident that exposed this rule was not an Admin-only UI defect. Two browser contexts could run the same deployed source and observe the same Cloud canonical identity while presenting different operational modes because derived server state had been persisted locally.

That defect class applies to every web port that can cache, persist, hydrate, retry, or project server state.

Therefore this document controls browser/server-state architecture across all current and future MFK web surfaces.

## 2. Sovereignty classes

### Cloud / server canonical state

Standard: `@tanstack/react-query`.

Includes:
- canonical Admin configuration
- publish confirmation/readback
- SMT ACK / projection
- Customer server read models
- Owner server read models
- SMM server read models
- any future authenticated canonical server resource

Rules:
- server data is fetched through query keys and query functions
- mutation success invalidates/refetches canonical queries
- focus/reconnect/mount freshness is handled through the standard query layer
- server-derived status is never durable browser authority
- query cache is a cache, not a second source of truth

### Durable unsent command / offline outbox

Standard: `dexie` on IndexedDB.

Rules:
- only explicit unsent commands may be durable
- writes that define command persistence use IndexedDB transactions
- network I/O stays outside Dexie transactions
- same-origin tabs/windows observe outbox changes through Dexie live queries
- a UI may say QUEUED only when a real pending command exists in the outbox
- Cloud acknowledgement removes/settles the matching command by stable identity

### Local draft / UI state

Standard: React component state or Zustand persist when persistence is justified.

Rules:
- persisted stores require explicit `version`, `migrate`, and `partialize`
- drafts/preferences are never formal server truth
- dirty state should be derived where practical instead of persisted
- persisted draft data must be validated/migrated before use

### Authentication / security state

Auth/session is a separate security layer.

Rules:
- do not put session secrets or publisher credentials into generic query/draft/outbox stores
- browser token persistence is transitional only where the current backend contract requires it
- prefer secure server session / HttpOnly cookie when the backend seam is opened

## 3. Prohibited architecture

The following are prohibited for all web ports:
- durable browser `PUBLISHED`, `QUEUED`, `PUBLISHING` or equivalent server-derived truth
- browser timestamps compared with Cloud timestamps to decide authority
- localStorage as a formal outbox
- persisted read-model cache being treated as fresher than a successful canonical network read
- WebSocket/doorbell payload becoming a second data authority
- independent per-port implementations of freshness semantics when the shared state authority contract already defines them

## 4. Doorbell rule

WebSocket / SSE / push / provider event = notification only.

Required flow:

EVENT
→ invalidate affected query key
→ fetch canonical server state
→ render canonical result

No event payload may silently overwrite formal browser truth without canonical readback.

## 5. Cross-port implementation order

1. Shared authority contract.
2. Admin TQ1 canonical active/readback.
3. Admin TQ2 projection / ACK.
4. Admin TQ3 publish mutation + canonical invalidation.
5. DX1 durable outbox.
6. ZS1 versioned Admin draft state.
7. AUTH1 security/session hardening.
8. Apply the same authority contract to SMM / Customer / Owner by their next touched server-state slice.
9. Remove legacy localStorage compatibility only after readback parity is proven.
10. Physical parity: normal Safari + in-app browser + second same-origin tab.

## 6. Compatibility rule

Migration may read legacy browser data temporarily, but new architecture must not create a second durable authority.

Compatibility code must have:
- a named migration version
- bounded lifetime
- explicit deletion/retirement condition
- regression coverage

## 7. Required shared contract

Repository contract:
`contracts/web-state-authority-v1.ts`

All new web-state work must conform to that contract. A port may choose different UI components, but not different authority semantics.

## 8. Acceptance

A web-state migration is not GREEN because it builds.

GREEN requires:
- canonical query readback
- no second browser authority
- real pending command evidence for any queued state
- multi-context parity for the same canonical state
- regression tests on the touched port
- physical/browser acceptance when the defect is browser-lifecycle dependent

## 9. Authority precedence

This is a dated Owner/system authority created after the earlier Admin-only incident records.

For browser/server-state sovereignty, this document and root control #596 take precedence over issue #586 and earlier port-local repair notes.

Milestone:
`MFK_WEB_STATE_SOVEREIGNTY_AUTHORITY_R1`
