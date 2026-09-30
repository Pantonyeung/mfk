# MFK Web Client Parallel Rebirth Authority R2

Date: 2026-09-30  
Status: CURRENT / CONTROLLING / SYSTEM-WIDE  
Root Control: Pantonyeung/mfk #596  
Supersedes implementation strategy in: MFK Web State Sovereignty Authority R1  
Scope: Admin / SMM / Customer / Owner / future web ports

## 1. Decision

Do not continue broad in-place state-architecture surgery inside current v2 web clients.

The web-state sovereignty rules from R1 remain controlling, but implementation changes from incremental v2 migration to a parallel V3 client rebuild.

Reason:
- v2 clients already contain accumulated localStorage, bootstrap, cache, sync and compatibility semantics
- changing one seam can have delayed side effects that are difficult to observe immediately
- the production Safari split-brain incident demonstrated that hidden browser persistence can survive otherwise correct runtime changes
- the same defect class can affect every web port

Therefore:
- current v2 production remains operational baseline
- new V3 web clients are built in parallel
- V3 does not inherit browser persistence semantics from v2
- production traffic is not switched until V3 physical acceptance passes

## 2. What is NOT being rewritten

The following remain existing authorities/contracts unless a separately approved defect requires change:
- Cloud/Admin canonical backend
- SMT Store Kernel / formal order authority
- payment / pricing / fulfillment authorities
- existing provider contracts
- current API contracts
- existing production v2 clients until cutover

This is a web-client rebirth, not a whole-system rewrite.

## 3. V3 state standards

Cloud/server state:
- @tanstack/react-query
- canonical query keys
- mutation -> invalidate/refetch
- focus/reconnect/mount refetch
- no durable browser server truth

Durable unsent command:
- Dexie / IndexedDB
- only explicit pending commands
- stable command identity
- queued UI requires a real pending row

Draft/UI state:
- React state or Zustand
- persisted draft requires version/migrate/partialize
- never formal authority

Auth/security:
- separate layer
- no generic state store for credentials

## 4. V2 freeze rule

After this authority:
- no broad v2 architecture migration
- no new v2 browser-state framework
- no new v2 compatibility state machine unless required to fix a reproducible production P0/P1 defect
- fixes must be bounded and must not become the V3 design source

V2 is the running baseline, not the donor architecture.

## 5. V3 build order

A0. V3 shared skeleton + authority contract + CI, zero production routing  
A1. V3 Admin canonical read-only shell  
A2. V3 Admin projection/ACK read models  
A3. V3 Admin draft/edit/publish through standard mutation/readback  
A4. V3 Admin Dexie outbox only if offline publish is explicitly required  
A5. V3 Admin auth hardening + browser parity  
A6. V3 Admin preview hostname and physical acceptance  
A7. Admin cutover only after acceptance

Then reuse the same V3 core for:
- SMM
- Customer
- Owner

## 6. Cutover rule

No V3 port replaces V2 based on build success alone.

Required:
- same canonical result across normal Safari / in-app browser / second tab
- reload and reconnect parity
- no hidden local authority
- API contract parity
- visual/product acceptance
- rollback path to v2 still available

## 7. Repository layout

V3 code is isolated:
- v3admin/
- later v3smm/
- later v3customer/
- later v3owner/
- contracts/web-state-authority-v1.ts remains shared authority vocabulary

V3 must not import v2 client-state modules.

## 8. Current first slice

V3A0:
- create isolated v3admin app
- TanStack Query provider
- Dexie dependency present but no outbox behavior yet
- Zustand dependency present but no persisted server state
- canonical read-only client seam
- dedicated V3 CI
- no production deploy route
- no change to v2 runtime

Milestone:
`MFK_WEB_CLIENT_PARALLEL_REBIRTH_AUTHORITY_R2`
