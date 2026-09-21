# MFK Keeta Runtime Simplicity Guard R1

Status: CURRENT DESIGN GUARD / NOT_WIRED
Date: 2026-09-22

## 1. Legacy incident finding

The retired Morefun-v2 Keeta runtime was over-designed for MFK needs.

It combined too many responsibilities in one provider runtime:
- webhook verification / normalization
- durable receipt / dedup persistence
- merchant decision state
- canonical order acceptance bridge
- product / option alias resolution
- provider command delivery
- store-details provider read
- commercial readback
- OAuth state/token encryption/storage
- token refresh/retry
- scheduled stale-receipt recovery
- provider store binding
- auto-accept config
- separate channel gateway
- service binding back into the legacy Admin runtime

It also ran a one-minute recurring schedule. The legacy Admin Worker separately ran another one-minute schedule and a 5-second realtime watchdog.

This produced a bad operating shape:
`NO BUSINESS EVENT → BACKGROUND WORK STILL RUNS`.

That is the opposite of MFK local-first simplicity.

## 2. Why quota/CPU was consumed quickly

Primary design causes:

1. Fixed one-minute wakeups
   - 1,440 scheduled invocations/day before real orders/webhooks are counted.

2. Background discovery scans
   - stale/pending records were scanned to discover work instead of letting real events trigger work.

3. Cross-runtime call chains
   - Keeta Worker → service binding → Admin canonical service → D1 / downstream work.
   - one provider action could fan out into multiple runtimes and persistence reads/writes.

4. Too many responsibilities per Worker
   - transport, OAuth, durability, canonical acceptance, provider command and recovery were coupled.
   - CPU spikes in any part made the whole invocation expensive.

5. Git deployment fan-out
   - the legacy Cloudflare project was linked to `Pantonyeung/Morefun-v2` and non-production branch builds were enabled in the provider UI.
   - a high-change repository can therefore consume build minutes independently of actual store traffic.

6. Deployment command side effects
   - legacy deployment configuration ran remote D1 migrations as part of deployment before uploading the Worker version.
   - build activity therefore carried remote infrastructure work instead of being a minimal artifact deployment.

## 3. MFK Keeta target

Keeta must remain a thin edge adapter.

### Inbound

`Keeta Webhook`
→ verify provider signature
→ parse / normalize provider evidence
→ dedup / replay identity
→ hand off one canonical intake request
→ return provider acknowledgement

No polling is needed to discover a webhook.

### Outbound

`Canonical MFK decision/event`
→ build exactly one Keeta request
→ send
→ normalize provider response
→ persist/read back only the minimum delivery evidence

No provider Worker may become an Order, Pricing, Fulfillment or Refund authority.

## 4. Runtime prohibitions

Forbidden in future MFK Keeta runtime:
- one-minute global cron
- sub-5-minute liveness polling
- 5-second watchdog/alarm
- one scheduled run draining multiple unrelated domains
- scanning a provider DB merely to discover work when an event can trigger it
- sleep/setTimeout to hold a request open for business delay
- OAuth refresh polling cron
- provider-owned second business-truth DB
- general-purpose provider orchestration engine
- automatic blind retry after UNKNOWN result
- coupling to old Morefun-v2 Admin/Keeta runtime

## 5. Store-time policy

Timezone: `Asia/Hong_Kong`

Business hours: `10:00–20:30`
- event-driven first
- if a safety sweep is truly necessary, it must be single-purpose and no more frequent than the runtime guard permits

Off hours: `20:30–10:00` = `LOW_TRAFFIC_MODE`
- non-urgent scheduled safety work: disabled or >=30-minute cadence
- provider webhook may still be event-driven only after that seam is explicitly activated

## 6. Build/deployment policy

Future MFK Keeta deployment must not repeat legacy Git/build fan-out.

Required:
- production source must be current MFK, never Morefun-v2
- production branch only unless a preview is explicitly requested
- non-production branch auto-build disabled by default
- no remote DB migration on every ordinary code build/deploy
- schema migration is an explicit, separately approved operation
- deploy one exact runtime seam only
- inspect CPU/invocations/errors immediately after deployment

## 7. Acceptance gate before any live Keeta connection

Before Owner permits a live Keeta seam:
1. exact trigger is named
2. exact input/output is named
3. max batch is named
4. expected CPU per invocation is named
5. provider CPU limit is named
6. expected invocations/day is estimated
7. business-hours behavior is defined
8. LOW_TRAFFIC_MODE behavior is defined
9. stop condition/backoff is defined
10. local SMT independence is proven

Only then:
`CONNECT ONE → TEST IMMEDIATELY → BANK → STOP`

## 8. Current state

`MFK Keeta = CONTRACT / TRANSLATION / EVIDENCE ONLY`
`LIVE API = OFF`
`LIVE WEBHOOK = OFF`
`RUNTIME SECRET BINDING = OFF`
`PROVIDER ACTIVATION = OFF`

Old Morefun-v2 Keeta runtime is retired and must never be re-used as MFK runtime authority.
