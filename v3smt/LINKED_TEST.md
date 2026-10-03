# POS connected test surface

This entry serves the existing `mfk-smt-web` service at `smt.morefunos.com`.
It does not target `mfk-mfp-v3-acceptance` and does not use the historical release helper.

## Boundary

- Build flag `VITE_MFP_V3_LINKED_TEST=1` selects the separate TEST REQUEST inbox and published test catalog. Every other value uses the original normal application and lifecycle.
- Server flag `MFP_V3_LINKED_TEST_ENABLED=1` admits the shared same-origin `/api/v3-test/` gateway for the POS surface. Missing/malformed/off fails closed before binding access.
- Only `SEEN` and `REJECTED` reviews are sent. Identity and idempotency key come from validated canonical inbox rows. Duplicate clicks share one request; terminal/repeated reviews do not create another write.
- Review response is never optimistic truth: canonical catalog/inbox is pulled again after a successful, malformed, failed or uncertain response. Each operation has a 15-second watchdog; it does not poll or resend writes.
- Socket messages only invalidate. Existing shared bounded reconnect and online/focus/pageshow recovery pull canonical data. Unmount cancels reads, subscriptions and timers; obsolete responses are fenced across reload/lifecycle changes.
- Catalog prices/options/defaults are displayed without a cart, total or quote engine. Catalog/inbox/status responses are decoded and malformed/formal-success claims fail closed. The UI derives review text from validated states, never server free text.
- `formalOrderCreated`, `paymentConfirmed`, `formalCheckoutConnected` and `physicalPrintConnected` remain false. No linked request enters formal/native commands, formal orders, KDS/display, payment, print or cash-drawer providers.
- The linked build excludes normal/native runtime chunks. `npm run verify:linked-build` checks the built artifact and test flag. Normal `App.tsx` remains unchanged.

## Runtime configuration

`wrangler.linked-test.jsonc` retains ASSETS, MFK_VERSION, keep_vars and existing formal service identity. It adds only cross-script references to `AdminSyncStore` and `CustomerRuntimeStore` in the existing `mfk-admin` script. It creates no Durable Object class/namespace, database, migration or storage bucket. Existing generic public routes stay closed through the original formal acceptance worker.

The parent must first establish the compatible linked Admin worker. A missing or disabled linked Admin provider is a closed dependency, not permission to proxy another backend. The shared test scope is isolated from MF01 business writes.

## Exact-source preparation

From the reviewed/integrated repository root, use the final exact commit rather than a branch's mutable HEAD when authorizing release. After checking out that reviewed commit:

```sh
export SOURCE_SHA="$(git rev-parse HEAD)"
export BUILD_ID="mfp-v3-linked-${SOURCE_SHA}"
cd v3smt
npm ci --no-audit --no-fund
npm run typecheck
npm test
MFP_SOURCE_SHA="$SOURCE_SHA" MFP_BUILD_ID="$BUILD_ID" npm run build
MFP_SOURCE_SHA="$SOURCE_SHA" MFP_BUILD_ID="$BUILD_ID" VITE_MFP_V3_LINKED_TEST=1 npm run build
MFP_SOURCE_SHA="$SOURCE_SHA" npm run verify:linked-build
npx --yes wrangler@4.146.0 deploy --config wrangler.linked-test.jsonc --dry-run --no-autoconfig --var "MFK_SOURCE_SHA:$SOURCE_SHA" --var "MFK_BUILD_ID:$BUILD_ID"
```

The publisher's separately authorized deployment command for this service is the same pinned command without `--dry-run`:

```sh
npx --yes wrangler@4.146.0 deploy --config wrangler.linked-test.jsonc --no-autoconfig --var "MFK_SOURCE_SHA:$SOURCE_SHA" --var "MFK_BUILD_ID:$BUILD_ID"
```

Do not run that command as part of source tests. Do not use the old `target=pos` release helper. Preserve the exact-source Worker variables together with the matching asset identity. In restricted local environments, point NPM_CONFIG_CACHE and XDG_CONFIG_HOME at writable temporary directories and set WRANGLER_SEND_METRICS=false; no Cloudflare credentials are needed for a dry run.

## Verification evidence

POS source validation on 2026-10-03:

- TypeScript: PASS
- Full POS suite: 46 files / 1,392 tests PASS, including unchanged formal regression suites
- Default and linked production builds: PASS
- Linked asset isolation check: PASS; linked build excludes normal/native app chunks
- Wrangler 4.146.0 dry-run and generated binding inspection: PASS
- Entry flag-off/on, malformed responses, forbidden formal claims, repeated/concurrent review, canonical reload, uncertain request/review timeout, lifecycle cancellation/restart, doorbell invalidation and bounded failed reconnect tests: PASS
- Cloud browser visual check: BLOCKED before navigation by `net::ERR_BLOCKED_BY_CLIENT` on the local synthetic fixture URL. No alternate route was used. SSR rendered assertions are source tests, not browser or live acceptance.

No push, deployment, live provider write, MF01 business mutation, formal transaction, physical printing or physical acceptance was performed by this source task. Integrated cross-surface QA, independent review, exact-source publication and live acceptance remain separate gates.
