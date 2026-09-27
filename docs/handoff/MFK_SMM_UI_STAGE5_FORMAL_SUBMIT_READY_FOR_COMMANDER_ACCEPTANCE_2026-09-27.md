# MFK SMM UI｜Stage 5 Formal Submit｜2026-09-27

STATUS:
READY_FOR_COMMANDER_ACCEPTANCE

WORK_ID:
MFK-SMM-UI-STAGE5-FORMAL-SUBMIT-R1

CONTROL:
Pantonyeung/mfk #399

BRANCH:
work/MFK/SMM-UI-STAGE5-FORMAL-SUBMIT-R1

FRESH MAIN AT START:
bac52c2de64f0061c04faf2fe8d0084d1c40c8aa

FRESH MAIN AT FINAL SYNC:
c2d5b016fe3dd08d276e915ae0f0fb2301e964cf

SYNCED WORK HEAD:
886e2955fe9be1ceaa2a5f5654eb844ee107b23a

FINAL GREEN RUN:
36306429752 = SUCCESS

==================================================
SOURCE CONTRACT
==================================================

SMM Pack Stage 5 + current Final Implementation UI Spec.

Only:
DRAFT → PENDING → CONFIRMED / REJECTED / UNKNOWN

No Stage 6.

==================================================
IMPLEMENTED
==================================================

1. Stable submit identity
- one submissionId per intent
- one idempotencyKey derived from that submissionId
- unresolved PENDING / UNKNOWN / NOT_CONNECTED is read back first
- no new submission while an unresolved result exists

2. Double-tap protection
- synchronous submitLockRef guard
- lock acquired before first await
- PENDING UI keeps primary submission action locked

3. PENDING
- human-safe short submission reference only
- no raw submissionId / UUID
- same intent remains locally durable as LOCAL_NON_AUTHORITATIVE pending state

4. CONFIRMED
- canonical SMT Display Code now carried through LAN / cloud / acceptance readback
- frontend validates displayCode before showing success
- frontend never renders canonical orderId / UUID on Stage 5 success
- if Formal Order exists but Display Code readback is incomplete, result stays UNKNOWN instead of exposing internal identity
- cart clears only after canonical CONFIRMED + valid Display Code
- refresh snapshot after confirmation
- actions: 查看訂單 / 繼續點單

5. REJECTED
- terminal rejected state
- deterministic repair path:
  - menu / price → Cart
  - dining target → Checkout
  - staff / device trust → Staff
  - generic reject → Checkout
- no generic blind retry

6. UNKNOWN
- dedicated UNKNOWN surface
- primary CTA = 重新確認結果
- secondary CTA = 返回
- readSubmission uses the SAME submissionId
- no submitOrder from readback path
- no reconnect auto-submit
- no timer/background resend
- no “重新提交” action

7. Canonical Display propagation
- SmmLanOrderResponse ACCEPTED includes displayCode
- SmmLanSubmissionReadback CONFIRMED includes displayCode
- SMT ingress stores and returns displayCode for:
  - prior idempotent result
  - recovered order / dining hold
  - new takeaway Formal Order
  - new dining Formal Order
- Cloud adapter maps canonicalDisplay
- Web SMT acceptance readback includes canonicalDisplay

==================================================
PRESERVED
==================================================

- Stage 0–4
- loginId / trusted staff identity
- canonical Combo
- line-level PRICE_CHANGED / CONFIG_CHANGED repair
- Dining Target
- Tender
- Store Kernel remains Formal Order authority
- SMT remains pricing / menu / order revalidation authority
- LOCAL_NON_AUTHORITATIVE persistence only
- no second Order / Pricing / Payment / Submit engine

==================================================
GREEN EVIDENCE
==================================================

GitHub Actions:
run 36306429752 = SUCCESS

SMM:
- Stage 5 contract: 11 / 11 PASS
- Stage 4 regression: 14 / 14 PASS
- Stage 3 regression: 21 / 21 PASS
- Stage 0–2 / loginId / Combo regression: 33 / 33 PASS
- Full SMM: 104 / 104 PASS
- build PASS
- Wrangler deploy --dry-run PASS
- production deploy = NONE

Protected v2local:
- 87 test files PASS
- 386 tests PASS
- build PASS

Branch alignment:
- behind main = 0 at final sync validation

==================================================
FILES / SEAMS
==================================================

- .github/workflows/smm-stage5-formal-submit-r1.yml
- contracts/smm-lan-v1.ts
- v2local/src/runtime/smm-lan-ingress.ts
- v2local/src/runtime/smm-lan-ingress.test.ts
- v2smm/src/App.tsx
- v2smm/src/Stage5Submit.tsx
- v2smm/src/product-types.ts
- v2smm/src/pwa-cloud.ts
- v2smm/src/smt-lan-adapter.ts
- v2smm/src/stage5-submit.mjs
- v2smm/src/stage5-submit.d.mts
- v2smm/src/stage5.css
- v2smm/test/stage5-submit.test.mjs
- v2smm/test/migration.test.mjs
- v2smm/worker.ts

==================================================
LOCKS
==================================================

NO STAGE 6
NO MAIN MERGE
NO DEPLOY

MILESTONE:
MFK_SMM_UI_STAGE5_FORMAL_SUBMIT_R1_READY_FOR_COMMANDER_ACCEPTANCE
