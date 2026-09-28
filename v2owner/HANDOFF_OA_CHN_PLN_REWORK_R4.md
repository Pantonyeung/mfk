# MFK Owner OA-CHN / OA-PLN Rework R4

STATUS: READY_FOR_COMMANDER_REACCEPTANCE

Fresh main: 52937ff44d31f488d6e43db8bcd60ce76fab4478
Head: d667686dfa675b90b06f79f2d990c90dc55649dd
Behind: 0
PR: #391
Mode: NO MAIN MERGE / NO DEPLOY

## FIRST_BREAK
CANONICAL_PLANNING_PERSISTENCE_MISSING = RESOLVED

## OA-PLN-001
Canonical domain: MFK_OWNER_MONTHLY_PLAN_V1
Store: existing mfk-admin AdminSyncStore Durable Object
Key: storeId + monthKey
Writer: authenticated OWNER only

Fields:
- monthKey
- monthlyRevenueTargetMinor
- costLines
- note
- revision
- updatedAt
- updatedBy

Cost line:
- costLineId
- category
- label
- plannedMonthlyMinor
- actualToDateMinor
- note

Save:
READ CURRENT → EDIT → expectedRevision SAVE → CANONICAL APPLY → READBACK
- CONFIRMED only after canonical revision readback
- REJECTED on revision conflict
- UNKNOWN on canonical readback mismatch
- no fake green

New device:
fresh Owner runtime reads same AdminSyncStore plan; no localStorage planning truth.

Sales:
Current Effective Sales only from existing canonical Reporting projection.
No second Sales / Reporting truth.

## OA-CHN-001
Read-only retained.
No /owner/channels/command endpoint.
No commandChannel runtime port.
Controls disabled / availableActions semantic = [].
No fake Pause / Resume seam.

## Acceptance tests
- canonical plan read/write + revision increment
- fresh runtime/new-device same plan readback
- stale expectedRevision conflict REJECTED
- readback mismatch UNKNOWN
- target calculation
- cost planned vs actual-to-date
- estimated operating profit
- Current Effective Sales source guard
- channel read-only guard

## CI
owner-runtime-connection-r2 #55: SUCCESS (36301242523)
owner-hosting-r1-smoke #35: SUCCESS (36301242503)
owner-stage03-main-landing-r1 #41: SUCCESS (36301242513)
admin-canonical-readback-r1 #33: SUCCESS (36301242576)
admin-identity-canonical-r1 #54: SUCCESS (36301242521)
customer-ui4-cart-checkout-r1 #11: SUCCESS (36301242526)
smm-stage2-main-landing-r1 #34: SUCCESS (36301242522)
SMT Consolidation A3 #28: SUCCESS (36301242540)
SMT Consolidation A3B #27: SUCCESS (36301242542)

owner-runtime-connection-r2 includes:
- Owner full tests PASS
- Owner build PASS
- Admin full tests PASS
- Admin build PASS
- Wrangler dry-run PASS

AUTHORITY CHANGE:
OWNER MANAGEMENT PLANNING DOMAIN ONLY

NO MAIN MERGE
NO DEPLOY
