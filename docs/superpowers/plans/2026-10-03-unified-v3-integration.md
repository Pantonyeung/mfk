# Unified V3 Source Integration Implementation Plan

> For agentic workers: execute the bounded integration in the existing isolated worktree. No new execution environment or live mutation.

**Goal:** One reviewable source candidate that preserves the correct four source branches and records honest release gaps.

**Architecture:** Admin V3 publishes configuration through the existing canonical envelope. MFP host retains one Room Store Kernel and all transaction/pricing/print authority; Mobile and Customer consume authenticated contracts only. Preserve the completed Customer shell without converting preview fixtures into business truth.

**Tech Stack:** TypeScript/React/Vite/Vitest; Java/Room/Android; existing Cloudflare configuration seams.

**Spec:** `COMMANDER_CURRENT.md` and `docs/plan/MFP_V3_OWNER_REQUIREMENTS_CROSSWALK_2026-10-02.md`.

## Global constraints

- Four exact source SHAs in Commander; no older native reconstruction.
- No live writes, deployment, credentials, transactions, physical print or authority duplication.
- Preserve original IDs, values, defaults, composition and print configuration.
- Hard gates remain hard. Source assertions and fixtures are not Android or live acceptance.

## Review focus

- A late quote or lost native reply must not restore a cancelled checkout or create a second payment.
- Channel changes invalidate the preceding quote before another final review.
- Print job, attempt and payload digest must correlate; missing evidence remains unknown.
- Canonical option defaults must survive editor round-trip and dry-run extraction.
- Missing canonical providers must be visible and must not silently select V2 or fixtures.

## Work

- [x] Verify source refs, common ancestors and isolated worktree; baseline MFP 1,256 tests/type/build.
- [x] Merge Admin and Customer without product-code collisions; reconcile controls separately.
- [x] Merge latest native; retain cloud timeout/cancel guards and native channel invalidation. Adjust only test setup to perform required channel revalidation; retain original behavioral assertions.
- [x] Add RED source-contract tests for native durable payload digest, then minimal same-store DTO wiring and companion native runtime tests.
- [x] Apply independently reviewed Admin default-preservation and pure no-write dry-run patch.
- [x] Apply reviewed frontend print-correlation, explicit Admin tender drafts and Admin-owned versioned template/slip adapters.
- [x] Run final frontend/contract/type/build suites and source guard self-tests. Record Customer browser launch restrictions and unexecuted Android scope.
- [x] Write exact aggregate manifest, collision report and smallest provider/quote gaps; retain hard governance result.
- [x] Commit only the isolated local candidate for final structural review and handoff. No publication.

## Approved source-only extract increment

- [x] Retain reviewed extract 4f0775f6 from exact f680 checkpoint.
- [x] Re-read remote main 2e32fb87 and preserve its ten non-colliding documents via local ancestry merge.
- [x] Reconcile the aggregate comparison base and historical prototype qualification without changing deployment workflows or gates.
- [x] Rerun combined Admin/MFP/contract/type/build checks; capture exact local checkpoint/build identities after the source commit.

## Approved bounded quote and extract-correction increment

- [x] Preserve reviewed native quote-selection source with exact ancestry and aggregate control reconciliation.
- [x] Integrate independently reviewed optional-section extract correction without inventing data.
- [x] Run combined frontend and native-pure checks; record the exact committed identity, guard/classifier results and independent review in the successor packet. Retain unexecuted native/physical gates and the separate pricing correction.

## Approved modifier-price coherence increment

- [x] Merge reviewed modifier-price source without dropping optional-extract correction tests or metadata/default retention.
- [x] Run combined regressions; record exact identity builds and independent source review in the successor packet. Retain historical decimal publication/readiness gap and WALK_IN-only limitation.
