# Admin V3 canonical migration dry-run R1

Status: PREPARE / offline fixture proof only / no live migration performed.

## Exact source and scope

- Repository: `Pantonyeung/mfk`.
- Actual Admin V3: Draft PR [#605](https://github.com/Pantonyeung/mfk/pull/605), branch `feat/MFK-V3ADMIN-ONE-SHOT-R1`.
- Exact source base: `5954f301c684e795453d622790ca11acae8dfe79`.
- Observed live `main` during preparation: `2e32fb87b2c84801b11a5ea6b2102a00f2a3104c`. This is not the source of this stacked Admin candidate.
- Read governance: AGENTS, COMMANDER_CURRENT, HANDOFF_CURRENT, change control, R2 parallel-client authority, #22 latest controlling comment, and the Admin regression-shadow scope review.
- Customer shell, all V2 clients, shared contracts, backend, SMT and deployment configuration are unchanged.

Admin V3 reads the same shared `MFK_ADMIN_CONFIG_SYNC_V1` envelope at `/api/admin-browser/active`. A separate V3 database has not been established. Its preview workflow enables fixture mode, which disables canonical reads. Sparse preview content does not establish that published data is missing.

## What changed

1. `canonical-migration-dry-run.ts` is a pure diagnostic taking two supplied observations, validating them with the existing shared validator, recording exact endpoint/store/revision/publish-time/fingerprint identity, and producing escaped JSON-pointer differences. It does not fetch, authenticate, persist, publish, generate a publish envelope, or grant write permission.
2. Preview/unverified identity, invalid envelopes, differing endpoints/stores, or differing canonical observations block a proposal. Neither a larger revision nor a later timestamp authorizes overwriting data. Identical valid observations return `NO_COPY_REQUIRED`.
3. For identical canonical observations only, option projection is separately inspected. A valid existing canonical optionCenter is preserved byte-for-value at the JSON data level, including per-product defaults and unknown fields. No legacy remirroring is performed.
4. If optionCenter is absent and explicit legacy facts are unambiguous, the in-memory review snapshot adds only `/optionCenter`; every original field stays unchanged. IDs/codes, price strings, service adjustments, combos, print routes and unknown fields are retained. The existing V2/V3 legacy array-order-to-position convention is reused. Explicit positions must survive unchanged.
5. Unsupported option-center shapes, missing/duplicate IDs, dangling links, missing or lossy known fields, non-boolean legacy defaults, unsupported product option policy, invalid selection/default constraints, fractional/unsafe option positions or selection counts, and non-exact/unsafe minor-unit decimal option prices block projection. No default is inferred to satisfy a required group.
6. A minimal existing adapter fix now derives each legacy product link's default IDs from explicit `defaultSelected === true`. The previous implementation silently emitted `[]`. Existing canonical per-product default IDs remain authoritative.

The dry-run does not certify the entire business meaning of opaque retained fields. It preserves them and reports canonical differences; further schema-specific investigation is required before any new transformation of those fields.

## Evidence and repeatability

The added synthetic test fixture extends the existing `formal-option-center.test.ts` and `formal-catalog.test.ts` shapes. It is explicitly not a live store export. Source prices include `010.00`, source takeaway adjustments include `-1.50`, and a true legacy default exercises the reproduced defect. Full-source equality verifies all retained fields, not only selected examples.

Verified after independent numeric-edge review:
- Clean-base Admin test suite: 23 files, 163 tests passed.
- True-default regression: RED before the helper fix (`[]` instead of `['o1']`), GREEN afterward.
- Dry-run regression matrix: RED against the absent-behavior stub, GREEN after implementation.
- Final Admin test suite: 24 files, 203 tests passed.
- Independent review exposed non-finite/overflow prices, fractional selection limits/positions, sub-cent amounts and extreme-cent precision drift. Dry-run-only fail-closed guards were added with RED/GREEN regression evidence. Original price strings remain unchanged.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Known non-blocking tool output: inherited npm `http-proxy` config warning and existing bundle-size warning (>500 kB). No npm/package upgrade was performed.

Run from `v3admin` using the existing package commands:

```sh
npm test
npm run typecheck
npm run build
```

For offline inspection, import `inspectCanonicalMigration` from `v3admin/src/canonical-migration-dry-run.ts` in a TypeScript-capable runner. Supply `{source, target}`; each observation has `mode`, the observed canonical `endpoint`, and the exact readback `envelope`. Endpoint/mode values are caller-supplied evidence labels, not an authentication attestation. Save or inspect the returned report; this module contains no write path.

Repeat invocation yields the same report. Reinspection of the proposed optionCenter shape returns `NO_CHANGE`. Frozen inputs and a failed target validation prove no source mutation or partial proposal; the network guard proves no service calls.

## Remaining live acceptance gate

No live V2 or V3 canonical payload, store identity, revision, publish time or fingerprint was retrieved. No actual source-to-target production field diff exists yet. The following must be collected and reviewed before live work:

- Verified Admin V3 serving/build identity and whether the surface is preview or authenticated canonical mode.
- Authenticated canonical readback for the intended store, with endpoint, store ID, publishedAt, revision and fingerprints.
- The V2 and V3 readbacks compared as observations of the same authority first. If equal, no data copy is required; connecting the existing read path is a separate review scope.
- If a difference exists, exact field-level evidence and its explanation, without assuming which side wins from revision or timestamp alone.
- Explicit review of any unsupported/default ambiguity and the proposed additive snapshot before any draft or publish action.

The existing edit helper `writeFormalOptionCenter` is deliberately not invoked: its normalization/remirroring needs a separate live-data roundtrip preservation review before any real edit/publish workflow.

No production writes, credentials, network/CORS changes, push, deployment or cutover are included in this candidate. A local candidate or passing tests do not authorize those actions.
