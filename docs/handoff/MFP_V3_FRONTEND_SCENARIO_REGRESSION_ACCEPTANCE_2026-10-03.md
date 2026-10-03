# MFP V3 frontend scenario regression acceptance | 2026-10-03

Status: source regression candidate; not production POS acceptance.

## Scope and authority

This candidate retains existing MFP frontend modules and fixes reproduced state, correlation and sync faults. It does not replace the Store Kernel or create a second business/security/data authority. The Owner explicitly requested an independent publicly accessible Cloudflare preview for joint debugging after software regression. This is not authorization to replace an existing production site, publish an APK/OTA, merge to main, or process live transactions.

## Exact source

Base: `48c7eca6c051e72562ea9974bc2c6465b8584a7b`. The final commit SHA is read directly from this branch when building and is embedded in both the bundle and build-identity.json. Do not label modified source with the parent SHA. The dependency lock pins the packages used in the verified builds.

## Reproduced and repaired scenarios

- Checkout result overwritten by a later open or old validation; payment allowed during unresolved revalidation; response-loss stuck in SUBMITTING.
- Late authentication callback restoring a logged-out session or clearing a newer login; mismatched session identity.
- Native command/protocol override and foreign response correlation.
- Mounted checkout A callback corrupting newer checkout B; delayed SUBMITTING UI and stale error feedback.
- Orders/Dining malformed snapshots, mutable operation identity, stale canonical readback falsely COMMITTED, receipt readback resubmission and missing Dining Order identity.
- Historical receipts inventing enabled tender methods; open-dialog configuration removal/replacement.
- Sync stale DELETE, lost in-flight invalidation, advanced canonical HEAD/tail convergence, and regressive same-store HEAD/checkpoint rollback.
- Negative grep guards silently ignoring matches/errors; comprehensive no-deployment-file guard retained.

## Verification evidence before exact-source build

Combined isolated candidate: 33 V3 test files / 666 tests passed. CI guard regression suite: 48 passed. Mounted in-process React checkout and tender-dialog scenarios passed on the prior combined candidate; repeat these and all checks against this final source before publication. TypeScript/build and actual post-build guards are required again for the final candidate. A completed local test does not imply browser, Android or physical acceptance.

## Remaining limits

- Public mode remains non-mutating and native production authority remains unbound.
- Actual browser/device testing is outstanding; cloud localhost/Chromium restrictions prevented prior rendered browser QA.
- Owner/Staff changed-session recovery requires integration review beyond original-session fixture evidence.
- Actual native Orders/Dining read producer and revision scopes remain required.
- Overall source semantic audit is incomplete; an Admin/server review was blocked by the review environment. Do not call the whole repository clean.
- Larger JS chunk warning remains. No live payment, printing, drawer or provider transaction was tested.

## Patch provenance

- `runtime-seams-final.patch`: SHA-256 `cc601f10e92d92c2430d0b0567f32afdd4349215576ece03dd27c3460e7e0de6`
- `orders-dining-reuse.patch`: SHA-256 `62a5891457cdab5990600389b3d2429e370c5abad072e4386122b11c1bfdb53f`
- `mfp-ci-guard-enforcement.patch`: SHA-256 `f7f47928ac54b7107ef371fb8e2bfc9510c1fec44f57cbbfb5b0feef09dafaf3`
- `orders-tender-eligibility.patch`: SHA-256 `dcb251799b724b26ad62a7fd4e63bc9770d0dc5a258dd4dadfa40746651e3347`
- `sync-convergence-v2.patch`: SHA-256 `c82a39f687e17d08791643fa2ae73cbc424d64bd0b60895a943ba2d95cf42582`

## Existing governance self-test drift

The unchanged baseline AGENTS.md already requires declared-parent/live-repository verification and an explicitly recorded Owner-directed branch exception. One existing self-test still required the removed literal `verify live main`. Its original run failed 1/13; the assertion is updated to check all three current safeguards without changing AGENTS.md or weakening STOP/GOVERNANCE_DRIFT. Re-run result is required before commit.

## Final local checkpoint checks

The exact Git checkout passed 33 files / 666 V3 tests, TypeScript, 48 negative-guard regression tests, both mounted React scenario runners, and 13 governance self-tests after the stale assertion correction. The final committed build and deployed identity readback remain separate required steps. This candidate is a publicly accessible diagnostic/visual acceptance surface; native business operations remain unavailable.

Residual command-port audit findings (unchanged by this preview): deep nested payload snapshot mutation and changed-staff-session recovery need additional regression-backed fixes. These do not enable native business writes on the public surface, which remains fail-closed. Do not treat this preview as live POS acceptance.
