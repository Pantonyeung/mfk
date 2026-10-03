# MFP V3 A9 diagnostics integration | 2026-10-03

Status: local bounded source checkpoint. Actual shadow governance HARD_BLOCK; no release authority.

## Source and provenance

Integration parent: `26f44b60588c85eaeecfcb9c32c8b78e6dfdd4a1`. Separately deployed preview: `34cd87ae28f874ae97aaa74dac57b9d6dd83a06a`.
Reviewed diagnostic source: `647163bb3aebc26a9bd6e02432d742eb76a41ae8`, originally based on `48c7eca6c051e72562ea9974bc2c6465b8584a7b`.
Product/tests-only input patch SHA-256: `59ce650c99eefea303f8c06f19829c14c585192024b1fbac32e54467c2d5f893`.

The eight product/test files are integrated without modification. The old metadata/manifest is not applied. The only workflow change is adding `com.morefunos.smt.storekernel.StoreKernelA9DiagnosticsContractTest` to the existing native-router test selection.

## Behavior

- Store Kernel health requests include the already-required `protocolVersion: 1`; unrelated requests are unchanged.
- Check Center displays the real native DTO's `databaseName`.
- Physical evidence requires known unique gates, complete all-PASS results, matching typed source/release identity, nonempty device and valid zoned ISO calendar timestamps. Missing/malformed/UNKNOWN results remain blocked; explicit FAIL retains precedence.
- ISO validation rejects calendar rollover and locale/numeric strings while preserving Z/offset timestamps, colonless offsets, fractional seconds, leap days, lowercase T/Z and exact 24:00 midnight.
- Cutover prerequisites require literal boolean true, including Owner authorization. Synthetic source tests never confer real physical evidence or authorization.

## Independent verification

Fresh combined source checks passed:
- V3: 36 files / 1,251 tests, including the prior snapshot regression.
- TypeScript: `npm run typecheck`.
- Guard regression: 48 passed, zero failures.
- Governance self-tests: 13 passed, separately from actual shadow HARD_BLOCK.
- Both mounted checkout and Order tender-dialog harnesses.
- 4,209 additional diagnostic adversarial probes, zero issues.
- 215 baseline/candidate snapshot compatibility cases; original mutation repair and both preserved residuals reproduced.
- All eight product/test hashes match independently reviewed `647163bb`; the prior snapshot files and native production files are byte-unchanged.
- All 13 incrementally changed files are explicitly declared; whitespace check passed.

Final exact-commit build, actual post-build guards, re-run regression and identity verification are retained as external evidence because a commit cannot embed its own SHA. No uncommitted artifact is labeled as the deployed source. Independent assembled-diff review found no source/scope blockers: all eight imported product/test hashes matched the reviewed source; prior snapshot files/handoff remained byte-identical; all 13 paths were declared; workflow contained only the intended native selector; authority, native-NOT-RUN and shadow-HARD_BLOCK boundaries were preserved.

## Governance and limits

Actual shadow governance remains **HARD_BLOCK**, separate from the 13 self-tests. The inherited classifier lacks V3 mapping; it also reports the explicitly declared workflow/carrier test surfaces and impact descriptions for review. No bypass or scope relabeling is performed. Repository controls permit evidence-only local checkpoints in `SHADOW_REPORT_ONLY` mode; none is promotion approval.

Five Robolectric/JUnit cases are supplied and selected in existing CI but remain **NOT RUN** here because Gradle/wrapper/Android SDK are absent. Shared-fixture TypeScript execution is not native execution. Native production bindings, browser/device/hardware/physical acceptance, and actual evidence provenance remain outside this source repair.

The prior immutable submission snapshot remains intact. Its existing sparse-array fingerprint collision and authenticated changed-session UNKNOWN recovery gap remain explicitly unresolved; staff-session fingerprint semantics are unchanged.

No push, deployment, OTA, production mutation or new PROMOTE. Existing preview identity stays separate.
