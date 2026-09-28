# MFK SMM UI｜Stage 4 Checkout｜2026-09-27

STATUS:
READY_FOR_COMMANDER_ACCEPTANCE

WORK_ID:
MFK-SMM-UI-STAGE4-CHECKOUT-R1

BRANCH:
work/MFK/SMM-UI-STAGE4-CHECKOUT-R1

FRESH MAIN AT START:
5c1a5bd7668abcf3e4d12bf21769f9eccb6d0b4b

FRESH MAIN AT GREEN VALIDATION:
58cc7f3738284d36b253a9274ff17928f2366383

PRE-HANDOFF GREEN HEAD:
f0c6335de732345d14b1f02b69c6a049653efc07

PR:
#394

==================================================
SOURCE CONTRACT
==================================================

SMM Pack Stage 4:
Service Mode
→ Dining Target（堂食）
→ Tender
→ Final Summary
→ Submit CTA

DINE_IN without Table / Waiting target:
Submit MUST be disabled.

Stage 5 formal submit state flow is NOT part of this cut.

==================================================
STAGE 4 COMPLETED
==================================================

CartSheet checkout mode:
- Stage 3 CTA enters Stage 4 inside the same CartSheet flow
- no new route
- close returns to normal app shell
- back returns to Stage 3 cart draft

1. Service Mode
- TAKEAWAY / DINE_IN
- explicit operator switch continues using current published price projection
- no new Pricing Engine

2. Dining Target
- rendered only for DINE_IN
- source = snapshot.diningTables / Admin published table projection
- TABLE target must still exist in current published table list
- WAITING is valid with 1–30 covers
- no free-text table identity
- missing / stale target => invalid
- invalid target => Submit disabled
- Dining Target persisted only in LOCAL_NON_AUTHORITATIVE workspace preferences

3. Tender
Current recorded tender choices:
- CASH
- ALIPAY
- WECHAT
- FPS
- PAYME

Stage 4 records selection only.
No payment execution.
No automatic cash drawer action.
No second Payment Engine.

4. Final Summary
Shows:
- item count
- service mode
- dining target when DINE_IN
- tender
- menu revision
- cart line totals
- optional cart note
- published total preview
- SMT final revalidation notice

Stage 3 unresolved PRICE_CHANGED / CONFIG_CHANGED:
- remains visible as a blocker
- Submit disabled
- return to Stage 3 to repair

5. Submit CTA
- displayed in Stage 4
- disabled until checkout facts are complete
- DINE_IN requires valid TABLE / WAITING
- CTA is boundary-only in this cut
- DOES NOT call submitCart
- DOES NOT call port.submitOrder
- DOES NOT create / transition PENDING / CONFIRMED / REJECTED / UNKNOWN UI state
- user-visible notice explicitly states no formal order was sent in Stage 4

==================================================
PRESERVED STAGE 5 SEAMS
==================================================

Existing backend / source seams remain untouched:
- createSmmStableSubmissionId
- submissionId
- idempotencyKey
- createSmmPendingIntent
- submitCart
- rapid multi-tap lock
- port.submitOrder
- readSubmission
- UNKNOWN readback-first logic

They are preserved but not exposed by Stage 4 UI.

==================================================
PRESERVED
==================================================

- Stage 0–3
- human loginId / trusted staff identity
- stable cart lineId / createdAt
- same product different config separate
- Stage 3 explicit PRICE_CHANGED / CONFIG_CHANGED repair
- canonical Combo path
- SMT authoritative menu / pricing / Combo revalidation
- localStorage = LOCAL_NON_AUTHORITATIVE
- Store Kernel / Formal Order authority

AUTHORITY_CHANGE = NONE

NO second:
- Pricing Engine
- Combo Engine
- Order Engine
- Payment Engine

==================================================
ACCEPTANCE TESTS
==================================================

Stage 4 dedicated contract covers:
- flow ordering: Service Mode → Dining Target → Tender → Final Summary → Submit
- DINE_IN no target => disabled
- WAITING valid
- TABLE requires published table identity
- TAKEAWAY does not require dining target
- five tender values
- final summary facts
- unresolved Stage 3 attention blocks submit
- Submit CTA does not execute Stage 5
- Dining Target local persistence
- Admin-published table-only identity
- Stage 0–3 / loginId / Combo regressions
- responsive / safe-area / touch target
- Stage 3 CTA transitions only to Stage 4 presentation

==================================================
GREEN EVIDENCE
==================================================

GitHub Actions:
run 36302855065 = SUCCESS

SMM:
- 93 tests PASS
- 0 FAIL
- build PASS
- Vite 155 ms
- Wrangler deploy --dry-run PASS
- NO production deploy

Protected v2local:
- 87 test files PASS
- 386 tests PASS
- build PASS
- Vite 340 ms

Additional:
admin-identity-canonical-r1
run 36302855104 = SUCCESS

==================================================
FILES
==================================================

- .github/workflows/smm-stage4-checkout-r1.yml
- v2smm/src/App.tsx
- v2smm/src/persistence.ts
- v2smm/src/stage4-checkout.mjs
- v2smm/src/stage4-checkout.d.mts
- v2smm/src/stage4.css
- v2smm/test/stage4-checkout.test.mjs
- v2smm/test/stage3-ui.test.mjs
- v2smm/test/migration.test.mjs

==================================================
LOCKS
==================================================

NO MAIN MERGE
NO PRODUCTION DEPLOY
NO STAGE 5 FORMAL SUBMIT FLOW

MILESTONE:
MFK_SMM_UI_STAGE4_CHECKOUT_R1_READY_FOR_COMMANDER_ACCEPTANCE
