# Customer V3 connected-test wiring

Opt-in build: `VITE_MFP_V3_LINKED_TEST=1 npm run build` from `v3customer`.
Candidate config: `wrangler.linked-test.jsonc`. Deployment is publisher-owned:
`npx --yes wrangler@4.146.0 deploy --config wrangler.linked-test.jsonc`.
Do not run this command without the release publisher's authorization and exact-SHA verification. The existing `mfk-admin` must already expose the reviewed linked-test AdminSyncStore/CustomerRuntimeStore classes.

The config retains the formal `mfk-customer` service, existing ASSETS and CUSTOMER_ASSETS → `mfk-customer-assets`, and cross-script binds both existing Durable Object classes from `mfk-admin`. It declares no migrations/new classes/databases and performs no object uploads. Existing media worker is unchanged. The linked API server flag must be exactly `1`; missing/malformed/off values fail closed. Generic API providers remain closed. Normal flag-off UI stays the prior acceptance-preview path.

The linked UI reads server-published catalog prices/options/defaults from same-origin `/api/v3-test/catalog`. It sends only synthetic customer contact values and PAY_AT_STORE. No browser total is a formal quote. Submission identity is a cryptographic UUID with `V3:<UUID>` idempotency. The exact immutable intent is durably saved before sending; repeated clicks, retries and reload use that identity. Persistence failure blocks submission. Readback is canonical; WebSocket messages only invalidate and trigger refetch. No periodic business polling exists.

## Bounded acceptance

- Displays CONNECTED TEST and PENDING / SEEN / REJECTED test-request status only.
- No formal order, payment confirmation, physical print or formal checkout is represented as connected.
- One active request is retained per browser profile. An explicit New Test Request action requires fresh canonical SEEN or REJECTED evidence and unchanged active storage. It atomically archives the exact old intent and clears only the active slot after verified persistence. No refresh/retry/unknown outcome resets identity. Archived requests expose manual canonical readback; their immutable intents are recovery data, never frozen business status. Unsaved cart selections are not durable.
- Only the shared product/options contract is supported. Unsupported combos/variations/quantity options remain server-unavailable. No auth/session/token/PIN transport, real customer details or payment evidence upload UI is added.
- Local UI browser suite requires Chromium. Cloud execution reported socket creation blocked for Playwright and ERR_BLOCKED_BY_CLIENT for the managed cloud browser's localhost navigation. Therefore source/in-memory tests and build/dry-run evidence do not imply browser or live acceptance. CI includes the unskipped browser tests for an eligible runner.

## Verification

`npm run typecheck`; `npm test`; `VITE_MFP_V3_LINKED_TEST=0 npm run build`; `VITE_MFP_V3_LINKED_TEST=1 npm run build`; `npx --yes wrangler@4.146.0 deploy --dry-run --config wrangler.linked-test.jsonc`; `npm run test:linked:ui`.

Node checks cover original flag-off guards, server catalog validation, all false formal flags, durable UUID/exact retries, reload, repeated/concurrent submissions, malformed input, cross-site/method/privileged route rejection, flag-off fail-closed behavior, inherited R2 routing, real shared doorbell coalescing/reconnect/cleanup and optional single-choice empty selection. Worker integration uses actual Customer and existing Admin classes over synthetic in-memory namespaces; it does not access live data.
