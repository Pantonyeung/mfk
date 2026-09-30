# V3 Admin A1｜Authenticated Canonical Read-Only Design

Status: CANDIDATE / ZERO PRODUCTION ROUTING  
Root control: #596  
Commander slice: V3ADMIN_A1_CANONICAL_READONLY

## Goal

Prove a clean V3 Admin can authenticate against the existing Admin backend and read the current canonical Admin envelope without importing any v2 browser-state implementation.

A1 is read-only with respect to Admin configuration.

## Existing backend reused unchanged

A1 uses the current production API contract:

1. `POST /api/admin-browser/auth/challenge?storeId=MF01`
2. client derives PBKDF2-SHA256 verifier from entered PIN
3. client signs `MFK_ADMIN_BROWSER_LOGIN_V1\n<challengeId>\n<loginId>\n<nonce>` with HMAC-SHA256
4. `POST /api/admin-browser/auth/verify?storeId=MF01`
5. session token is held in memory only
6. `GET /api/admin-browser/active?storeId=MF01` with `x-mfk-admin-session`
7. response is validated with shared `validateMfkAdminConfigEnvelope`

No v2 client module is imported.

## State ownership

Auth:
- React in-memory state only
- session token is not written to localStorage, sessionStorage, Zustand persist, Dexie or Query cache data
- logout removes the canonical Query cache

Canonical server state:
- TanStack Query
- key: `['mfk','admin-v3','canonical','active','MF01']`
- `staleTime: 0`
- refetch on mount/focus/reconnect inherited from V3 QueryClient
- `gcTime: 0` for authenticated canonical query

Outbox:
- Dexie schema remains unused in A1

UI:
- Zustand remains non-persisted and UI-only

## UI acceptance

Before login:
- health state
- login ID + PIN
- explicit statement that A1 is read-only and does not persist auth

After login:
- current canonical store
- Cloud published time
- fingerprint/admin fingerprint
- diagnostic revision
- high-level snapshot counts
- manual canonical refetch
- logout

No edit controls and no publish controls exist.

## Security constraints

- raw PIN never leaves the browser
- challenge is one-time and backend-bounded
- session token is memory-only in A1
- no secret is placed in query key
- canonical cache is deleted on logout
- no browser persistent auth

## Production isolation

- no Wrangler config
- no deploy trigger
- no V3 hostname
- no change to v2 production runtime
- Vite dev proxy is development-only and provides same-origin access to the existing read/auth endpoints

## Non-goals

- no config mutation
- no publish
- no SMT ACK/projection
- no offline command
- no persisted session
- no migration from v2 localStorage
- no production cutover

MILESTONE: `MFK_V3ADMIN_A1_CANONICAL_READONLY_DESIGN`
