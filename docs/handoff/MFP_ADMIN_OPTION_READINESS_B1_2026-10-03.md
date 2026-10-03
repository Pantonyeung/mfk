# Admin option readiness B1 | 2026-10-03

## Result and exact boundary

Source-only prerequisite to Admin report Packet C, based exactly on `89e21fa3cbfff5dbbb02a81a889fb4d0dd05b3bd`. Branch: `work/MFP-ADMIN-OPTION-READINESS-B1-2026-10-03`.

Packet A's canonical price mutation and stale-edit guards are present at the base and were retained. Its existing regression explicitly documented that historical `1.000` still reached publication. B1 replaces that known-gap assertion with a no-transport rejection.

This is **B1, not full Packet B or C**. It adds pure option-scope checks and integrates them with the existing modifier writer/client publication seam. It does not establish or edit the actual V3 server publisher identity/contract. Server revalidation and enforcement are required before live acceptance; a browser preflight can be bypassed and cannot supply that authority.

## Changed-field inventory

- `formal-option-readiness.ts`: structured error/warning paths over raw `optionCenter.sets`, `productLinks`, `catalog.modifierGroups` and product IDs/group references. Checks IDs/codes/compound links/default uniqueness, raw types, references, native 0–999 integer bounds, required/single rules, default membership/activity/max, exact signed decimal prices and safe minor-unit limits, mirror contradictions and unsupported option quantities.
- Native-known identity bounds (160 UTF-16 units, no surrounding ASCII spaces/control characters), collection bounds (1000 rows) and explicit option `priceStatus` readiness are checked before publication. Drafts retain those unsupported historical facts without automatic repair.
- Explicit support registry marks unknown option-scope extension fields as **preserved but unvalidated**. Reports contain paths, codes and descriptions, never extension values or unrelated private domains.
- `EDIT_SOURCE` mode prevents coercion/filtering/identity loss before modifier writes. Finite historical amounts may remain unchanged in drafts. New/changed amounts keep the Packet A exact-money edit rule.
- The existing writer now retains unchanged raw optional fields, source option order, compatibility group-array order, product-group order and unknown nested values. Existing mirror/link membership disagreement blocks a name-only save instead of dropping a binding; a missing optional product mirror stays absent on unchanged links. It does not synthesize absent optional mirror/product arrays. Missing or extra identities in an existing compatibility mirror block rebuilding rather than silently deleting unmatched records.
- `formal-draft.tsx`: publication rejects option errors before the existing POST. Draft ID/revision payload, tender preflight, envelope, auth and CAS are unchanged. The generic draft save/repair seam remains available.
- `formal-publish-pages.tsx`: field-path errors and extension/selection warnings, always-visible source-only scope wording and disabled review/publish buttons while option errors exist. Refreshed invalid drafts are checked even after impact review.
- Required groups may have explicit empty/partial defaults with a warning requiring selection at order time. No default is invented. Existing line-reopen/default semantics and native arithmetic are unchanged.
- Governance files declare only this candidate's bounded paths, not the inherited aggregate integration diff. Parent integration must reconcile the aggregate manifest, Commander and Handoff rather than overwrite them wholesale with this packet's candidate manifest.

## Verification

All fixtures are synthetic; no credentials or production configuration are used.

- Base Admin: `npm test`: **32 files / 372 tests PASS**.
- Initial new regressions: **25 failed / 3 passed**, proving the raw-loss, historical-price, mirror and UI gaps before implementation.
- Additional preservation regressions: **2 failed**, covering binding-order drift and absent optional arrays; fixed.
- Additional compatibility mirror identity regressions: **3 failed**; fixed.
- Additional raw selection-type regression: **1 failed**; fixed.
- First candidate Admin: `npm test`: **33 files / 425 tests PASS**.
- Independent-review corrections: **15 native/binding regressions failed**, then passed; **2 optional-field/order regressions failed**, then passed.
- Additional independent-review corrections: **2 unsatisfiable-minimum regressions failed** and **1 clean-draft source-scope regression failed**, then passed. Active linked groups cannot publish a minimum exceeding their active choice count; historical drafts are preserved. The source-only limitation is now visible even on a clean draft.
- Revised final Admin: `npm test`: **33 files / 447 tests PASS**.
- `npm run typecheck`: PASS.
- `npm run build`: PASS. Existing-style large-chunk warning remains; no size-limit bypass was added.
- `git diff --check`: PASS.

Evidence logs, implementation plan and final patch are saved separately in the dot cloud workspace under the Admin report folder. Independent reviewer findings on first candidate `537164be76ea1ca4d7f271788a98c77b37e6e3a8` were addressed in the revised candidate. Final independent review is a separate result attached to the revised identity; this document does not self-certify review.

## Remaining gates

- Full Packet B: approved server identity/contract, authoritative validation, full catalog/combo/print money/readiness, actual draft/canonical reread and host apply/ACK.
- Packet C: product-local attach/detach/default controls, generated product create-on-save behavior, UI cancel/reopen/reload and conflict coverage. Not implemented here.
- Actual browser visual validation and authenticated provider journey are not run; React fixture rendering/event tests are source evidence only.
- Native Android/Room execution, runtime availability, Customer/other-channel quote support, per-option quantity support and physical printer acceptance remain separate.
- No push, PR, live write, publish, deploy, enrollment, transaction, Android device action or physical printing was performed or authorized by this packet.
