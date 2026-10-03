# Admin product bindings/defaults Packet C | 2026-10-03

## Source-only result and exact boundary

Base: reviewed unified `48db835ed71385ce0bf781f8387e74b6c1c7c26b`. Isolated branch: `work/MFP-ADMIN-PRODUCT-OPTIONS-C-2026-10-03`.

The unchanged formal product right-sheet shell now exposes reusable group attachment/detachment and explicit per-product default selectors. Basic fields, links and defaults are submitted in **one existing canonical draft mutation**. Generated IDs, prices, ordering, raw extension fields, existing defaults and the existing CAS remain authoritative. No new server schema, store, native intent, price engine, authentication flow or Customer UI is introduced.

This is a reviewable **Packet C source candidate**, not full end-to-end Packet C acceptance. Browser/history behavior has component and simulated event-loop evidence; actual browser interaction was blocked by the browser runtime's local-URL policy. No workaround was used. Server draft/canonical reread, publisher identity, host apply/ACK, Android/Room and physical acceptance remain separate.

## Delivered field family

- `formal-product-options.ts` validates original raw B1 source before any product-option write, checks a raw product/options/link edit baseline and delegates changed links to the existing canonical option-center writer. Other product/domain changes can merge; relevant concurrent product/option/default changes fail closed. Basic-only edits do not create absent optionCenter or modifier mirrors.
- The product sheet retains stable set/option IDs, displays exact price strings, distinguishes required choices from actual defaults, permits explicit empty defaults, and never selects the first option or recommendation implicitly. Single selection can replace its default; multi-selection respects the maximum. Invalid, inactive, foreign or duplicate defaults are blocked. Required groups without complete defaults visibly require operator selection at order time.
- Detach/reattach before Save retains the local default choices. Saved detach removes only this product's binding; reusable groups and other products remain intact. Unchanged basic fields are omitted from the patch, preserving absent `description`/`active` and raw whitespace during option-only saves.
- Quantity capability remains unavailable. New quantity-based bindings and default edits are disabled; existing quantity settings, extensions and defaults are retained. The central modifier quantity toggle is disabled; changing selection mode cannot implicitly clear an imported true quantity value.
- Save/error/conflict handling retains local inputs. A synchronous in-flight latch prevents duplicate writes or dismissal during a pending Save. Unknown transport/response outcomes disable retry and require explicit readback; they do not become successful saves. Late callbacks from an unmounted editor do not close a newer editor.

## New-product limitation, intentionally visible

The approved product-create API accepts basic fields and returns server-generated ID/code. A new product remains entirely unsaved until explicit Save; opening or canceling produces no placeholder. After creating its basic draft, the user must explicitly reopen it to configure groups/defaults. The UI labels this incomplete two-step process and never issues a hidden second mutation. This packet **does not implement a one-step product-plus-options creation contract**, nor prove completeness of new-product configuration at publication.

## Bounded save/navigation integrity additions

Parent separately approved the minimal `admin-shell.tsx` guard seam, `formal-product-navigation.tsx` and its tests, plus a narrow `formal-draft.tsx` response-order correction after independent adversarial findings.

- The existing shell remains the route owner. Its own entries get a namespaced session/index marker while other `history.state` keys stay unchanged. No modal sentinel entries, route redesign or persistent client draft store are added.
- Internal navigation asks the product editor before leaving dirty, busy or uncertain work. Owned Back/Forward/multi-entry traversal is restored by a known index delta; an explicit discard replays that destination. Intent-generation checks prevent old queued restore/replay events from replacing newer decisions. StrictMode, repeated navigation and queued-event interleavings have synthetic tests.
- Unknown/pre-session/foreign history is not overwritten. Since arbitrary native traversal cannot be canceled reliably, the mounted editor and its inputs are retained with visible notice that the URL may have changed. Closing/explicit discard then reconciles to that location. Reload/cross-document departure uses the browser's `beforeunload` warning, whose actual display is browser-controlled. This is a stated limitation, not certified interception of every browser history action.
- Successful draft write responses are checked against request store/draft/base/session identity and current cached revision. Late revision 4 cannot replace already read revision 5. Equal-revision contradictory data and identity/session changes fail visibly. A successful write cancels only stale in-flight reads on its exact draft key with `revert:false`, preventing an old GET from overwriting that completed write. No optimistic success, revised server CAS or alternate authority is created.

## Changed files

- `.github/mfk-change-manifest.json`
- `COMMANDER_CURRENT.md`
- `HANDOFF_CURRENT.md`
- `docs/handoff/MFP_ADMIN_PRODUCT_OPTIONS_C_2026-10-03.md`
- `v3admin/src/admin-shell.tsx`
- `v3admin/src/formal-draft.tsx`
- `v3admin/src/formal-modifiers-page.tsx`
- `v3admin/src/formal-product-editor.tsx`
- `v3admin/src/formal-product-editor.test.tsx`
- `v3admin/src/formal-product-navigation.tsx`
- `v3admin/src/formal-product-navigation.test.tsx`
- `v3admin/src/formal-product-options.ts`
- `v3admin/src/formal-product-options.test.ts`

The isolated manifest describes this bounded increment only. Parent integration must reconcile its allowed paths and governance with the aggregate, preserving the aggregate main comparison base and prior references; do not copy this narrow manifest wholesale into the aggregate candidate.

## Verification and evidence

All fixtures are synthetic and network writes are mocked. No live data, login, purchase or physical print action occurred.

- Base: 33 Admin files / **447 tests PASS**.
- Tests-first evidence: missing helper module; **14 initial UI failures**; deletion/StrictMode/late-callback regressions; **2 untouched-basic-field regressions**; late PUT/current identity and pending discard regressions; late GET regression; queued restore/replay regressions, each recorded failing before correction.
- Final implementation: 36 Admin files / **513 tests PASS**; TypeScript typecheck PASS.
- Production asset build PASS with the existing non-failing large-chunk warning. Ordinary unpinned build identity is not release identity; exact-commit rebuild belongs to external verification.
- Existing pure native resolver source harness: **66 assertions PASS**. It uses a constants-only producer stub; this is not real Android/Room execution or Java API-level certification.
- Incremental whitespace/scope checks PASS; all 13 candidate paths are explicitly declared.
- Real browser/history/visual smoke: **BLOCKED / NOT RUN** due the runtime URL policy rejecting the isolated local fixture. The independently prepared actual-shell synthetic fixture is retained for a permitted browser environment; source-renderer/event tests are not a substitute.

Evidence, full command logs, initial red cases, synthetic browser harness and independent probes are external in `reports/admin/c-evidence`. Independent review is a separate exact-commit result; this handoff does not self-certify it.

## Remaining restrictions

B1's client-only validation limitation remains. The approved server provider contract, actual draft/canonical reread, formal publish and host ACK, Android/Room, runtime availability, all-channel/nested-combo/per-option-quantity support, and physical acceptance are not closed here. Aggregate release restriction remains HARD_BLOCK; source tests do not lower it. No live configuration writes, push, PR, main merge, deployment, publication, device/account action or physical printing is authorized or performed.
