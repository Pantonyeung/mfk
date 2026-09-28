# MFK Owner App｜OA-SEL-001 Handoff

STATUS: READY_FOR_COMMANDER_ACCEPTANCE

NEW HEAD: d841029a20102679011b4cd63b5323f60bce31af
FRESH MAIN: 58cc7f3738284d36b253a9274ff17928f2366383
BEHIND: 0
PR: #395

## Scope
OA-SEL-001 only.

Supported bounded targets:
- PRODUCT
- OPTION
- MODIFIER: compatibility grain mapped to the same canonical Option identity
- COMBO_CHILD

Actions:
- Sold-out / Restore
- Online-only stop / restore
- Temporary until today
- Temporary until specified time
- Quantity presentation only when canonical quantity exists

## Authority
Reuses existing Admin config snapshot availability / Sellability Authority.
Owner does not create a second Sellability engine.

Command:
Owner authenticated command
→ existing AdminSyncStore
→ current active revision read
→ availability-only delta
→ create next canonical Admin envelope
→ existing publishEnvelope
→ projection
→ per-target readback

Overall result:
- CONFIRMED
- PARTIAL
- UNKNOWN

No optimistic green. Unknown requires readback; no blind retry.

## Rules locked
- Availability != Inventory
- Availability != Visibility
- Sold-out != Hidden
- Inventory 0 does not automatically block transactions
- Existing Orders are not rewritten after later sold-out
- Online-only does not stop SMT local ordering
- Temporary stop expires by effective availability rule
- Price / Product structure / Combo structure / Mapping / Delete remain Admin-only

## Cross-port projection
- Customer projection keeps sold-out Product / Option visible with available=false.
- Customer Combo Child availability reads COMBO_CHILD target plus child Product availability.
- SMT projection uses sellability for local order validation.
- ONLINE_ONLY is ignored by SMT local projection.
- Option / Combo Child structural active flags remain separate from availability semantics.

## Tests
Admin OA-SEL focused tests:
- product canonical sold-out + revision/readback
- option + combo-child
- modifier alias → canonical Option authority
- online-only
- quantity display with inventory=0 without auto-block
- temporary expiry
- partial target result
- existing order immutability

Owner UI guard:
- Product / Option / Modifier / Combo Child
- Online-only
- today / specified time
- quantity display-only
- Admin-only structural boundary
- no localStorage sellability truth

## Exact-head CI
owner-runtime-connection-r2 #67: SUCCESS (36303231128)
owner-hosting-r1-smoke #44: SUCCESS (36303231131)
owner-stage03-main-landing-r1 #51: SUCCESS (36303231245)
admin-canonical-readback-r1 #42: SUCCESS (36303231162)
admin-identity-canonical-r1 #71: SUCCESS (36303231204)
customer-ui4-cart-checkout-r1 #21: SUCCESS (36303231176)
smm-stage2-main-landing-r1 #51: SUCCESS (36303231179)
SMT Consolidation A3 #37: SUCCESS (36303231132)
SMT Consolidation A3B #36: SUCCESS (36303231188)

owner-runtime-connection-r2 proves:
- OWNER TEST PASS
- ADMIN TEST PASS
- OWNER BUILD PASS
- ADMIN BUILD PASS
- WRANGLER DRY-RUN PASS

AUTHORITY CHANGE:
OWNER BOUNDED SELLABILITY COMMAND ONLY.
Canonical Sellability Authority remains existing Admin availability domain.

NO MAIN MERGE
NO DEPLOY
