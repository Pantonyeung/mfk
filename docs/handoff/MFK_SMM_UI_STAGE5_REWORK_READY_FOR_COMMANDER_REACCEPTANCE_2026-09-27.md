# MFK SMM UI｜Stage 5 Rework｜2026-09-27

STATUS:
READY_FOR_COMMANDER_REACCEPTANCE

CONTROL:
Pantonyeung/mfk #399 comment 5854435845

PR:
#402

FINAL_HEAD:
a5e1f6b1c6fdcfdedea38050074d678c2fc7c686

FINAL_CI:
36310294357 = SUCCESS

FRESH_MAIN:
c2d5b016fe3dd08d276e915ae0f0fb2301e964cf

BEHIND_MAIN:
0

## Stage 5 visual acceptance

Source:
Stage_5_提交正式訂單_V2.png

Implemented as full-screen state family, not generic bottom sheet:
- 5.2 提交中 / DRAFT
- 5.3 已提交 / PENDING
- 5.4 訂單確認 / CONFIRMED
- 5.5 提交失敗 / REJECTED
- 5.6 狀態未明 / UNKNOWN

Supplied artwork:
- stage5-submitting.webp
- stage5-pending.webp
- stage5-confirmed.webp
- stage5-rejected.webp
- stage5-unknown.webp

Responsive acceptance:
- 440×956 primary
- 360px minimum
- touch targets
- reduced motion

## Shared state separation

Loading / Empty / Offline / Stale / Partial / Unknown / Error remain distinct.
Transport Offline does not rewrite transaction UNKNOWN.
Stale / Partial do not become submission results.
Error exposes no resubmit.
Transaction UNKNOWN remains same-submission readback-first.

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

## CI evidence

Existing governance CI:
run 36310294357 = SUCCESS

SMM:
- 110 / 110 PASS
- build PASS
- Wrangler deploy --dry-run PASS

v2local:
- 87 test files PASS
- 386 / 386 PASS
- build PASS

One-off workflow:
.github/workflows/smm-stage5-formal-submit-r1.yml = removed from landing diff.

## Preview classification

PR #402 Cloudflare failures:
- mfk-customer = failure
- mfk-owner = failure

Base main c2d5b016fe3dd08d276e915ae0f0fb2301e964cf shows the same two failures:
- mfk-customer = failure
- mfk-owner = failure

Classification:
PRE_EXISTING / PREVIEW_ENV_CONFIG
NOT NEW_REGRESSION from Stage 5 candidate.

## Landing diff files

- contracts/smm-lan-v1.ts
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

FINAL_VALIDATED_HEAD:
a5e1f6b1c6fdcfdedea38050074d678c2fc7c686

FINAL_VALIDATED_CI:
36310294357 = SUCCESS

NOTE:
FINAL_HEAD has passed the existing governance CI. No production deploy was performed.
