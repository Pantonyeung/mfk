# MFK SMM UI｜Stage 3 CartSheet 購物草稿 Handoff｜2026-09-27

STATUS:
READY_FOR_COMMANDER_ACCEPTANCE
NO_MAIN_MERGE
NO_DEPLOY
NO_STAGE4

WORK_ID:
MFK-SMM-UI-STAGE3-CARTSHEET-R1

BRANCH:
work/MFK/SMM-UI-STAGE3-CARTSHEET-R1

FRESH MAIN / MERGE BASE:
cd91df0ae18798c3d002aec087b564b787a7daa0

SOURCE HEAD BEFORE THIS HANDOFF:
9989de22b11664a92113e0144dabe5ede07be834

==================================================
SOURCE OF TRUTH
==================================================

SMM Codex Pack 2026-09-27:
- Stage 3 = 購物草稿 / CartSheet
- Stage 0–2 already GREEN and landed on main
- Stage 4 checkout must not start
- preserve human loginId
- preserve canonical Combo
- preserve SMT authoritative revalidation
- preserve stable cart line identity
- localStorage = LOCAL_NON_AUTHORITATIVE only
- no second Pricing / Combo / Order Engine

==================================================
STAGE 3 COMPLETED
==================================================

CartSheet:
- line summary
- quantity +/- with 1..99 guard
- edit existing line
- remove line
- clear cart
- total / valid subtotal
- service mode: 堂食 / 外賣
- optional order note
- empty cart state
- checkout CTA boundary only

Existing-line edit:
- reuses Stage 2 ProductSheet
- preserves lineId
- preserves createdAt
- preserves quantity
- restores Variation
- restores Modifier / Option selections
- restores canonical Combo selections

Same product:
- separate add creates separate cart line
- no implicit merge

Menu / price change:
- cart refresh reprices from current published projection
- affected line only is marked for repair
- unaffected lines stay intact
- invalid line blocks「前往結帳」
- SMM preview remains non-authoritative
- SMT still performs authoritative menu / price / Combo revalidation

Order note:
- persisted only in SMM LOCAL_NON_AUTHORITATIVE workspace
- max 160 chars
- not submitted in Stage 3
- not Formal Order truth

==================================================
STAGE 4 BOUNDARY
==================================================

Deliberately NOT implemented in CartSheet:
- Tender selection
- Dining Target / Table / Waiting
- Final submit controls
- UNKNOWN readback CTA
- Formal Order creation

Existing backend submit / idempotency / UNKNOWN code remains untouched for later Stage.

==================================================
AUTHORITY / NO-TOUCH
==================================================

AUTHORITY_CHANGE = NONE

Preserved:
- loginId / trusted staff identity
- Stage 0–2
- canonical Combo path
- SMT authoritative revalidation
- stable submissionId / idempotency backend seam
- UNKNOWN readback backend seam
- Store Kernel authority
- Formal Order authority

No second:
- Pricing Engine
- Combo Engine
- Order Engine
- Payment Engine

==================================================
FILES
==================================================

- v2smm/src/App.tsx
- v2smm/src/persistence.ts
- v2smm/src/stage3.css
- v2smm/test/stage3-ui.test.mjs
- v2smm/test/migration.test.mjs

==================================================
GREEN EVIDENCE BEFORE HANDOFF COMMIT
==================================================

GitHub Actions:
run 36298455670 = SUCCESS

SMM:
- 69 tests PASS
- 0 FAIL
- build PASS
- Vite 151ms
- Wrangler deploy --dry-run PASS
- NO DEPLOY

Protected v2local:
- 87 test files PASS
- 385 tests PASS
- build PASS
- Vite 307ms

Additional:
admin-identity-canonical-r1
run 36298455666 = SUCCESS

==================================================
COMMANDER ACCEPTANCE CHECKLIST
==================================================

1. CartSheet matches Stage 3 boundary.
2. Stable line identity preserved during edit.
3. Same product different config remains separate line.
4. Canonical Combo restored and not reimplemented.
5. Affected-line repair only.
6. localStorage remains non-authoritative.
7. Stage 4 controls absent from CartSheet.
8. loginId / Stage 0–2 regression absent.
9. SMT authoritative revalidation preserved.
10. No main merge / no production deploy.

MILESTONE:
MFK_SMM_UI_STAGE3_CARTSHEET_R1_READY_FOR_COMMANDER_ACCEPTANCE
