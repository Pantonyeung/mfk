# MFK Admin V3

Parallel client rebuild under system authority #596.

Status: A1 AUTHENTICATED CANONICAL READ-ONLY / NO PRODUCTION ROUTING.

This directory is intentionally isolated from `v2admin`.

State ownership:
- server state: TanStack Query
- durable explicit commands: Dexie / IndexedDB
- local UI/draft: React/Zustand
- auth: separate in-memory security state for A1

A1 reuses the existing Admin backend authentication challenge/verify contract and reads the formal Cloud canonical envelope. It does not edit or publish config.

Security:
- raw PIN is not transmitted
- session token is memory-only
- canonical query cache is removed on logout
- no localStorage/sessionStorage auth

A1 contains no publish flow and no production deployment configuration.

Development:
- Vite proxies `/api` to the existing Admin backend
- proxy rewrites Origin/Sec-Fetch-Site only inside the local dev server so the existing backend same-origin guard remains unchanged

Commands:

```bash
npm install --no-audit --no-fund --legacy-peer-deps --package-lock=false
npm test
npm run typecheck
npm run build
```
