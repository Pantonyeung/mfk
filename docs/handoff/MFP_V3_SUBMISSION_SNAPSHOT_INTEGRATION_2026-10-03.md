# MFP V3 immutable submission snapshot integration | 2026-10-03

Status: local source checkpoint with passing software regression; **shadow governance HARD_BLOCK**. Not release-ready and no release authority.

## Exact source and authority

Parent and separately deployed checkpoint: `34cd87ae28f874ae97aaa74dac57b9d6dd83a06a`.
Candidate capability: `MFP_V3_IMMUTABLE_SUBMISSION_SNAPSHOT_2026_10_03`.
Final source identity is the exact Git commit containing this handoff and the six declared paths. Build only from that commit and read `build-identity.json` back against Git. The deployed checkpoint remains unchanged. Prior PROMOTE does not authorize this candidate.

## Repair and provenance

Reviewed input patch SHA-256: `7bdb832afbad5d861ffd09463231360d1bbef30e67485bef2138dca30a95c6bc`.
Source change is limited to `v3smt/src/store-kernel-port.ts` and the added `v3smt/src/store-kernel-submission-snapshot.test.ts`.

The envelope captures its input fields once and makes a detached recursively frozen payload before fingerprinting or asynchronous outbox work. Caller-owned data stays mutable. The existing value allowlist, negative zero, null-prototype records and literal prototype keys are retained. Enumerable getters materialize once. No protocol, authority, native, database, authentication or session-adoption policy changes.

## Independent integration verification

Independent runs on this integrated source passed:
- Full V3 suite: 34 files / 689 tests.
- TypeScript: `npm run typecheck`.
- Guard enforcement regression: 48 passed, zero failures.
- Governance self-tests: 13 passed.
- Mounted React checkout: cancellation, newer-session ownership, in-flight rendering and receipt retention.
- Mounted React Order tender dialog: configuration removal blocks UI/handler; replacement requires explicit selection; configured correction/refund preserves tender/amount.
- Compatibility corpus: 215 deterministic baseline/candidate cases preserve envelope values, fingerprint bytes and transport serialization.
- Original mutation race: fingerprint, persisted command and sent quantity each remain 1 after caller mutation.
- Sparse-array collision and changed-session recovery residuals independently reproduced against the integrated source.

The final committed build must use its own exact Git SHA, followed by actual post-build authority guards and identity comparison; these post-commit logs/identity are retained as external integration evidence to avoid a self-referential commit identity. No artifact from uncommitted source is labeled as deployed 34cd87ae.

Governance distinction: **the actual shadow candidate decision is HARD_BLOCK; the 13 self-tests are not aggregate governance acceptance**. The 13 self-tests validate the existing tool. Its historical scope classifier has no `v3smt/**` mapping and therefore emits report-only `UNMAPPED_SCOPE` / `HARD_BLOCK` for these two V3 files, even though both are explicitly declared in this candidate manifest. The classifier also flags the manifest authority/persistence/transaction descriptions for review. No undeclared blast radius is accepted, no classifier bypass/change is included, and this is not aggregate governance or promotion acceptance.

The same classifier was independently run on a clean detached prior `34cd87ae` worktree against `48c7eca6`; that prior candidate also reports `HARD_BLOCK`, including 18 unmapped V3 paths, the prior delivery-workflow change, and authority/persistence/transaction review flags, with zero undeclared paths. This confirms the V3 mapping gap predates this patch. Change Control explicitly runs in `SHADOW_REPORT_ONLY` mode and does not make the report a commit gate; this blocked local checkpoint records evidence only and carries no promotion permission.

## Residuals and limits

- Staff session remains in the fingerprint. UNKNOWN submission followed by a retry under a different staff session still returns `MFP_SUBMISSION_PAYLOAD_CONFLICT` before canonical readback. Authenticated recovery requires a separately reviewed native/security contract; this repair does not bypass it.
- Existing sparse-array acceptance and canonical fingerprint semantics are preserved: a one-hole sparse array and an empty array share the same canonical fingerprint even though JSON transport serialization differs (`[null]` versus `[]`). This is baseline behavior also present after the patch. It requires separate contract analysis and failing regression evidence before any normalization change; this repair does not silently redefine the contract.
- No browser, Android, physical hardware, live payment or complete repository acceptance is claimed. Existing native production bindings remain blocked.
- No push, deployment, OTA, production routing or state mutation was performed. The already-deployed 34cd87ae preview is a separate checkpoint.
