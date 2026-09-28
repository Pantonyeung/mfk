# MFK SMM UI｜Stage 5 Rework｜2026-09-27

STATUS:
READY_FOR_COMMANDER_REACCEPTANCE

CONTROL:
Pantonyeung/mfk #399 comment 5854794499

PR:
#402

FINAL_CODE_HEAD:
64843dd7b69a2d856acff7d598354dc28ae58926

FINAL_CODE_CI:
36310817457 = SUCCESS

FINAL_RECEIPT_BINDING:
This repository handoff intentionally does not self-record its own commit SHA as FINAL_RECEIPT_HEAD.
The single binding final receipt is the latest #399 comment whose status is READY_FOR_COMMANDER_REACCEPTANCE.
That receipt must carry the exact FINAL_RECEIPT_HEAD, exact FINAL_CI, BEHIND_MAIN, FILES_CHANGED, and PREVIEW_CLASSIFICATION.
Older FINAL_HEAD / FINAL_VALIDATED_HEAD values are non-binding and removed from this handoff.

FRESH_MAIN_AT_CODE_VALIDATION:
c2d5b016fe3dd08d276e915ae0f0fb2301e964cf

BEHIND_MAIN_AT_CODE_VALIDATION:
0

## Final correction 1 — OFFLINE DRAFT false-submission presentation

Fixed without adding a transaction state engine or authority.

- 5.2 SUBMITTING renders only when an actual submit attempt is in-flight.
- DRAFT with no submit port never enters Stage 5 submit-progress UI.
- submitOrder => NOT_CONNECTED restores the same DRAFT identity and returns to the safe checkout surface.
- original cart remains present.
- no 「已建立提交」 claim exists in Stage 5.
- submit step is shown as 「進行中」, not completed, during the actual in-flight attempt.
- NOT_CONNECTED final presentation says the formal order was not sent and that no background resend will occur.
- later explicit user retry reuses the matching saved DRAFT via the existing DRAFT identity lookup.
- UNKNOWN remains same-submission readback-first.
- no reconnect/background/blind resend added.

Deterministic regression:
- !port.submitOrder => no 5.2 completed submit claims
- NOT_CONNECTED => no false completed-submit claims
- cart preserved
- same DRAFT identity preserved
- 5.2 gated by DRAFT && submitting
- UNKNOWN readback path still calls readSubmission(same submissionId) only
- no background resend

## Final correction 2 — handoff identity drift

Identity is split explicitly:

- FINAL_CODE_HEAD = 64843dd7b69a2d856acff7d598354dc28ae58926
- FINAL_CODE_CI = 36310817457 = SUCCESS
- FINAL_RECEIPT_HEAD / FINAL_CI are bound only by the latest #399 READY_FOR_COMMANDER_REACCEPTANCE receipt.

This avoids the impossible self-referential requirement for a repository file to contain the SHA of the commit that contains itself.

## Stage 5 visual acceptance preserved

Source:
Stage_5_提交正式訂單_V2.png

Full-screen state family remains:
- 5.2 提交中 / DRAFT + submitting only
- 5.3 已提交 / PENDING
- 5.4 訂單確認 / CONFIRMED
- 5.5 提交失敗 / REJECTED
- 5.6 狀態未明 / UNKNOWN

Supplied WebP artwork remains:
- stage5-submitting.webp
- stage5-pending.webp
- stage5-confirmed.webp
- stage5-rejected.webp
- stage5-unknown.webp

Responsive contract remains:
- 440×956 primary
- 360px minimum
- safe-area handling
- reduced-motion handling

## Shared state separation preserved

Loading / Empty / Offline / Stale / Partial / Unknown / Error remain distinct.

- transport Offline != transaction UNKNOWN
- Stale / Partial do not become submission results
- Error exposes no resubmit
- transaction UNKNOWN remains same-submission readback-first

## Formal submit semantics preserved

- same submissionId
- same idempotencyKey
- synchronous double-tap lock
- UNKNOWN readback-first
- NO resubmit
- CONFIRMED no UUID/internal Order ID
- cart clears only after canonical CONFIRMED + valid display code
- Store Kernel / SMT authority unchanged
- NO Stage 6
- NO second authority

## CI evidence for FINAL_CODE_HEAD

Existing governance CI only:
admin-identity-canonical-r1 run 36310817457 = SUCCESS

SMM:
- 113 / 113 PASS
- build PASS
- Wrangler deploy --dry-run PASS
- production deploy = NONE

v2local:
- 87 test files PASS
- 386 / 386 PASS
- build PASS

One-off workflow:
.github/workflows/smm-stage5-formal-submit-r1.yml = ABSENT from landing diff.

## Preview classification

PRE_EXISTING / PREVIEW_ENV_CONFIG

Evidence:
- base main c2d5b016fe3dd08d276e915ae0f0fb2301e964cf: mfk-customer + mfk-owner Cloudflare Workers Builds already fail
- PR candidate shows the same two failures
- Stage 5 landing diff contains no v2customer/** or v2owner/** product changes

Therefore the Cloudflare preview failures are not a Stage 5 new regression.

## Landing diff files

- contracts/smm-lan-v1.ts
- docs/handoff/MFK_SMM_UI_STAGE5_REWORK_READY_FOR_COMMANDER_REACCEPTANCE_2026-09-27.md
- v2local/src/runtime/smm-lan-ingress.test.ts
- v2local/src/runtime/smm-lan-ingress.ts
- v2smm/public/brand/stage5/stage5-confirmed.webp
- v2smm/public/brand/stage5/stage5-pending.webp
- v2smm/public/brand/stage5/stage5-rejected.webp
- v2smm/public/brand/stage5/stage5-submitting.webp
- v2smm/public/brand/stage5/stage5-unknown.webp
- v2smm/src/App.tsx
- v2smm/src/Stage5Submit.tsx
- v2smm/src/product-types.ts
- v2smm/src/pwa-cloud.ts
- v2smm/src/pwa-lan.ts
- v2smm/src/smt-lan-adapter.ts
- v2smm/src/stage5-submit.d.mts
- v2smm/src/stage5-submit.mjs
- v2smm/src/stage5.css
- v2smm/test/migration.test.mjs
- v2smm/test/stage5-submit.test.mjs
- v2smm/worker.ts

LOCKS:
NO MAIN MERGE
NO DEPLOY
NO STAGE 6
