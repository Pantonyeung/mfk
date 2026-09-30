# MFK Admin V3

Parallel client rebuild under system authority #596.

Status: A0 FOUNDATION / NO PRODUCTION ROUTING.

This directory is intentionally isolated from `v2admin`.

State ownership:
- server state: TanStack Query
- durable explicit commands: Dexie / IndexedDB
- local UI/draft: React/Zustand
- auth: separate security layer

A0 contains no publish flow and no production deployment configuration.

Commands:

```bash
npm install --no-audit --no-fund --legacy-peer-deps --package-lock=false
npm test
npm run typecheck
npm run build
```
