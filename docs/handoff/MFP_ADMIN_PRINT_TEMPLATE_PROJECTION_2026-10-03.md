# Admin-owned versioned print templates and immutable slip projections

Status: PREPARE / PURE CONTRACTS ONLY / NO LIVE PUBLICATION OR PRINTING

## Scope and exact source inventory

This bounded patch is based on combined source commit `c594e3f0ca812a94a2781822fb609969cad6e042`. The integration owner retains the central Commander, Handoff, manifest and publication decisions.

- Admin PR #605: `5954f301c684e795453d622790ca11acae8dfe79`. `v3admin/src/formal-print.ts` and `formal-print-pages.tsx` edit four legacy strings (`receipt`, `production`, `packing`, `label`) and logical printer definitions. They do not implement per-template immutable versions. `FORMAL_PRINT_ROUTING_GAP` explicitly marks per-output logical destination/template schema as missing. `formal-draft.tsx` already owns formal draft/publish/read/version clients. Reuse those clients; this patch introduces no second publisher or database.
- Cloud MFP: `029d4e190f791f8cf42c0a0cad181536723ed5bc`. `print-hardware-domain.ts` already carries canonical `templateId`, `templateRevision`, payload identity and digest. Its physical binding's optional `publishedTemplateId` is not a template-version authority. The integration owner separately removes the stale dispatch check against today's binding template ID so old authorized jobs remain usable.
- Native: `f6138d1b148cf872f238a634ce339e088bff95c3`. The gateway executes authorized payloads and retains transport evidence. It is not an Admin template authoring source. This patch does not alter native print, canonical job writers or the gateway.
- SMT V2 is historical migration/reference input only. Commit `0dfd0dce9b9ece0f603c89759a8fb40ba12f9c47` is the recorded owner-locked R5 layout change: 80mm receipt/production/packing and 50×40 product/bag labels. Current `print-routing.ts`, `print-content.ts`, `ticket-bitmap.ts`, `label-bitmap.ts` and `LocalMoreWorkspace.tsx` retain layouts, routing and onsite binding references. They are not imported by new runtime modules.
- Current source label media is exactly 50×40mm, 203dpi, offsets 0/0, line gap 28, reverse feed true. Its historical capability name `label-58mm` is not the actual label dimensions. Ticket raster is 576 dots, 203dpi, margin18, bandHeight192. Source layout code contains content and positioning not represented by the four Admin strings; copying those strings alone cannot migrate these layouts.
- No meal-voucher renderer/definition was found in the audited V2 source or documentation. This is a source gap, not proof a deployed store has none. The legacy inventory preserves a supplied `mealVoucher` or any unknown field unchanged and flags explicit mapping; it never invents a format, width, ID or renderer.
- Local IP/port/USB settings and historical storage keys remain untouched. No actual device/browser-storage export or authenticated deployed Admin canonical snapshot was read.

## Current ownership and minimum data contract

Admin owns logical destination identity and editable names, product output eligibility/routing, template content, and the active template version in a published profile. Stable destination IDs survive display-name edits. MFP maps those destinations to onsite device endpoints. There is no MFP product routing/template policy selector.

New `contracts/print-template-catalog-v1.ts` defines pure metadata/integrity validation:

- `snapshot.printTemplateCatalog = {schema, versions[]}`. A version binds stable `templateId`, positive numeric `version`, job type, name, renderer identity, exact media values and an opaque JSON definition to a SHA-256 digest. Digesting sorts object keys but does not normalize content strings, layout numbers or array order. V2/V3/V10 sort numerically.
- `snapshot.printTemplateProfile = {schema, bindings[]}`. Each Admin binding pins a logical destination/job type to exact template ID/revision/digest. Destination references and duplicate bindings fail closed. IP, USB and other unknown binding fields are rejected.
- Append-only merge rejects a different digest for an existing template ID/version and never silently drops historical versions. Replaying the exact entry is idempotent.
- The definition's renderer is opaque in this bounded contract. Metadata/digest validation does not establish renderer-specific schema validity, executable safety, typography or physical acceptance. A real publisher must run its explicit renderer validator before publication; a consumer must provide its actual supported renderer identities. Tests use `fixture.template.v1`, never a claimed production renderer.

`v3admin/src/formal-print-template-catalog.ts` prepares data for the existing formal draft. Appending a catalog version does not change the active profile. `writeFormalPrintTemplateProfile` is the explicit Admin-only data operation for changing profile references. Both leave original `printTemplates`, `logicalPrinters`, `printRules`, product mappings and unknown snapshot siblings unchanged. No API call is made.

## Canonical pull, offline LKG and job pins

`v3smt/src/print-template-projection.ts` consumes the existing validated Admin envelope, not a doorbell payload. Its result is caller-owned pure data, not a new persistent store or synchronization engine.

- Refresh available versions through the existing canonical pull/atomic-apply path. Never select the latest catalog version automatically. The Admin profile alone selects the active version.
- Reject cross-store data, stale/conflicting publish times, invalid envelope fingerprints, invalid template digests, unsupported renderers, missing profiles/routes and immutable-version conflicts before returning any replacement. The caller retains its unchanged LKG on failure or loss of connectivity.
- Retain previously validated template versions even when a later catalog no longer lists them. There is no purge/deletion/retention policy in this patch.
- `readMfpPrintTemplateProjection` validates a deserialized retained cache. This is integrity validation, not authentication or proof that a cache was authoritatively published; the existing host/provider boundary must secure and atomically retain it.
- At canonical job creation, the host must freeze exact template ID/revision/digest, destination/job type, local quantity-summary flag, original canonical print-line/category snapshot, and the final payload identity/digest. `pinMfpPrintTemplateForJob` produces the template/presentation portion only.
- Old jobs/reprints resolve their original pin against retained versions independently of today's Admin profile, product/category names, catalog and current local toggle. No job is automatically rebuilt from the latest configuration. Exact payload transport/reprint authorization remains in the existing single print authority.

## Production and packing projection

`v3smt/src/print-slip-projection.ts` is a pure, deeply frozen presentation projection. It neither decides which items route to a destination nor changes canonical order lines, totals or financial state. The canonical host must provide the already-authorized material lines for that output and categories in their canonical order.

- Both production and packing detailed lines are grouped by category ID in canonical category order, regardless of entry order. Each source line ID, name, variant configuration and parent reference is retained. Unknown category IDs appear in explicit `未分類` fallback groups after known categories; no material line disappears.
- Packing summary: category quantities, e.g. 飯團3 / 飯餐3 / 飲品2.
- Production summary: stable product-ID quantities, e.g. 豬扒肉燥飯×3 / 鹹蛋黃飯團×2 / 手打檸檬茶×2. Canonical variant identities remain separate under the product, with original source line IDs and exact options/temperature/omissions/notes. Same display names do not merge distinct products. Conflicting configurations for one claimed variant identity fail closed.
- The MFP quantity-summary ON/OFF preference is the explicit local presentation exception. It hides or shows only summaries; category-grouped detailed material lines remain. The flag and returned source/category snapshot are frozen per job and reused for a reprint.
- Counting requires explicit canonical `PHYSICAL_ITEM`, `COMBO_PARENT` or `NON_PHYSICAL` roles, explicit drink classification, canonical variant identity/configuration and already-expanded physical quantities. Combo parents and financial rows remain in the source snapshot and excluded-ID audit list but never contribute physical counts. Child quantities are counted once without multiplication by a parent. Missing evidence is a contract gap, not permission to infer from a price sign or display name.

## Remaining release/provider gates

No UI, renderer, native schema/Room persistence, endpoint binding writer, actual job creator or live publisher is connected by this patch. Required follow-on integration remains:

1. Confirm deployed Admin V3 backend, authenticated canonical read/publish routes, envelope provenance and non-browser MFP consumer authority. Do not bypass login/authentication or assume a preview is production truth.
2. Obtain an authorized immutable legacy template/profile export and any required onsite-only binding inventory. Preserve content/layout/media/routing losslessly and validate unknown formats explicitly. Do not migrate credentials or local endpoints into Admin.
3. Add server-side append-only/version-history enforcement and renderer-specific validation through the existing formal publisher, then expose the approved Admin editing flow and existing canonical consumer. A browser helper alone cannot enforce server immutability.
4. Supply canonical physical-material roles, effective quantities, variant identities and category order from the existing host. Current frontend/native source does not prove those provider fields exist for all orders/combos.
5. Persist selection/profile cache and immutable job render snapshots in the existing host authority with atomicity and reprint authorization. Connect local summary preference without adding routing authority or another queue.
6. Validate rendering and actual hardware separately under explicit authorization. Source tests do not establish physical output, payment effects, deploy readiness or live migration completion.

## Verification

- Test-first stubs produced six Admin and five MFP failing cases; the slip stub produced five failing cases. Implementations then passed. Independent review found a role-array coercion bug; a regression first demonstrated no rejection, then passed after enforcing a string role.
- Focused: six Admin catalog cases and eleven MFP cache/pin/slip cases pass.
- Full Admin on this isolated base: 24 files / 169 tests pass. Admin typecheck and production build pass.
- Full MFP on this isolated base: 37 files / 1264 tests pass; nine known baseline failures remain in `checkout-domain.test.ts` and `checkout-native-integration.test.ts`. All nine were present before this patch. The integration owner has separately repaired only the two test helpers' channel-selection order and will run the final combined suite.
- MFP typecheck and production build pass. Both builds retain the existing >500kB chunk warning. npm prints its environment `http-proxy` warning. No native Android execution or physical test was run.
