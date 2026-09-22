# MFK Cloud Runtime Budget + Legacy Retirement Lock R1
Date: 2026-09-22
Status: CURRENT / CONTROLLING
Control: Pantonyeung/mfk #22

## 1. Incident lesson

2026-09-22 Cloudflare alert exposed a legacy-runtime retirement gap:

- current system had already moved to MFK
- old Morefun-v2 Cloudflare Workers were still running background work
- legacy morefun-v2-admin had every-minute scheduled work
- legacy Keeta SIT runtime also had every-minute scheduled work
- legacy realtime watchdog used a 5-second alarm cadence
- this created CPU-limit failures even though MFK itself had not opened live cloud connections

This class of failure is now prohibited in MFK.

## 2. Permanent architecture rule

MFK cloud runtime is EVENT-DRIVEN FIRST.

Do not use fixed high-frequency polling when a real event can trigger the work.

Preferred triggers:
- Admin Publish event
- Customer submit event
- SMM submit event
- Keeta webhook
- Store Kernel / Outbox event
- Fulfillment state event
- explicit operator action

Forbidden pattern:
- global one-minute heavy cron
- 5-second liveness watchdog
- one scheduled invocation draining multiple unrelated domains
- background work running 24/7 only to discover that there is nothing to do

## 3. Store operating-time budget

Timezone: Asia/Hong_Kong
Primary operating window: 10:00–20:30

During operating hours:
- event-driven work remains first choice
- scheduled safety sweep exists only where event-driven proof is impossible
- scheduled work must be bounded and single-purpose
- no global one-minute heavy cron

Outside operating hours:
20:30–10:00 = LOW_TRAFFIC_MODE

LOW_TRAFFIC_MODE:
- non-urgent maintenance: disabled or 30–60 minute cadence
- reporting/reconciliation/housekeeping: low cadence
- no frequent polling for liveness
- provider webhooks may still be accepted if that exact provider seam has been explicitly activated
- no background cloud task may become a local SMT transaction precondition

## 4. Bounded invocation contract

Every cloud invocation must declare:

- PURPOSE
- TRIGGER
- OWNER
- INPUT
- OUTPUT
- MAX_BATCH
- EXPECTED_CPU_PER_INVOCATION
- EXPECTED_INVOCATIONS_PER_DAY
- BUSINESS_HOURS_POLICY
- OFF_HOURS_POLICY
- BACKOFF
- STOP_CONDITION
- FAILURE_ISOLATION
- LIMIT / COST ALARM

One invocation = one purpose.

Do not bundle:
Business Day + Print + Capacity + Fulfillment + Reporting + Reconciliation.

Long work must be resumable:
bounded batch → checkpoint → continuation.

## 5. Local transaction independence

The following failures MUST NOT block SMT local:

- Cloudflare unavailable
- scheduled task failure
- reporting failure
- reconciliation failure
- inventory mismatch
- provider failure
- Owner unavailable
- Admin unavailable after valid Local LKG exists

SMT local Order / Checkout / Payment / Commit must continue.

## 6. Legacy cutover retirement checklist

A system is not retired merely because a new repo becomes current.

Every future cutover must explicitly verify:

NEW SYSTEM ACTIVE
→ OLD WRITERS OFF
→ OLD CRON OFF
→ OLD ALARMS / WATCHDOG OFF
→ OLD QUEUE / DRAIN OFF
→ OLD WEBHOOK INGRESS OFF OR QUARANTINED
→ OLD WORKERS.DEV / CUSTOM ROUTES OFF
→ OLD SERVICE BINDINGS OFF
→ OLD PROVIDER CREDENTIALS REMOVED
→ OLD DB / DURABLE BINDINGS DETACHED IF NO LONGER NEEDED
→ LIVE METRICS CONFIRM QUIET
→ BANK

No BANK before retirement evidence exists.

## 7. Legacy Morefun-v2 Keeta rule

Old Morefun-v2 Keeta runtime is RETIRED.

It must not be used as current MFK Keeta authority, callback runtime, OAuth runtime, D1 runtime, provider command path or acceptance environment.

MFK Keeta will be:
- rewritten/rebound from current integrations/keeta/**
- connected only when Owner opens that exact seam
- tested immediately after each connection
- externally accepted by Owner after internal test

Never reconnect MFK to old Morefun-v2 Keeta runtime.

## 8. Current source-side retirement work

Legacy Morefun-v2 source now contains retirement/tombstone changes for:
- morefun-v2-admin scheduled runtime
- admin every-minute cron
- admin Keeta service binding
- PricingRealtimeHub legacy 5-second alarm
- morefun-v2-keeta-sit cron
- old Keeta runtime
- old Keeta channel gateway
- old Keeta D1/service bindings

Provider-side Cloudflare deployment state still requires operator confirmation.
Source change alone is never proof that live runtime stopped.

## 9. MFK connection gate

Before any future MFK Cloudflare deployment:
1. prove exact seam
2. define runtime budget
3. deploy only that seam
4. inspect invocation count + CPU + errors
5. test business-hours behavior
6. test LOW_TRAFFIC_MODE behavior
7. prove local SMT unaffected
8. BANK
9. STOP
10. Owner decides next seam

MILESTONE:
MFK_CLOUD_RUNTIME_BUDGET_AND_LEGACY_RETIREMENT_LOCKED
