# MFK Owner App｜Stage04 Channel + Monthly Planning R1 Handoff

WORK_ID: MFK-OWNER-STAGE04-CHANNEL-PLANNING-R1
STATUS: READY_FOR_COMMANDER_ACCEPTANCE
CODE_HEAD: 9f582143ec1c4d24c713a7b247cf515f04ee3955
FRESH_MAIN: 493f014fcf91409612f63955a0b4698ad7815e69
BEHIND: 0
PR: #381

## OA-CHN-001
- Canonical channel read uses existing AdminSyncStore projection plus Keeta provider readback and Customer runtime health.
- Health, availability, mode and cause are separate facts.
- Keeta Pause / Resume reuse existing provider REST / OPEN seam.
- UNKNOWN is readback-first; operation identity is idempotently retained to prevent blind resend.
- Snooze / Busy remain disabled because no canonical command seam exists.
- Pause does not mutate already-committed Orders.
- No second channel authority.

## OA-PLN-001
- Route: /planning; entry from More Hub; Today only shows a compact monthly target summary.
- Canonical record: MFK_OWNER_MONTHLY_PLAN_V1 in existing AdminSyncStore.
- Single writer: authenticated OWNER session.
- Default lines: Rent / Water / Electricity / Gas / Labor / Other; custom lines supported.
- Planned and actual-to-date costs are separate.
- Sales source: canonical Current Effective Sales projection.
- Dine-in unpaid/open amount is excluded through recognizedSalesMinor; Draft/Pending/external pre-admission never enters formal sales projection.
- Remaining operating days are derived from canonical weeklyHours when available.
- Forecast is explicitly labelled predicted.
- Profit display is always estimated from entered actual cost; no accounting-profit claim.
- Save is revision guarded, operation-idempotent, canonical readback confirmed, and audited.
- No new D1, Durable Object, finance DB, or reporting engine.

## Authority
ONLY NEW WRITER:
- Owner Management Planning Domain inside existing AdminSyncStore.

UNCHANGED:
- Formal Order
- Current Effective Sales truth
- Pricing
- Payment
- Fulfillment
- Print
- Staff Auth
- Channel canonical/provider state
- Reporting transaction facts

## Verification
Workflow: owner-runtime-connection-r2
Run: 36295971595
Owner test: PASS
Owner build: PASS
Admin test: PASS
Admin build: PASS
Wrangler dry-run: PASS

No production deploy.
No main merge.
No Stage05 / OA-SEL-001.
