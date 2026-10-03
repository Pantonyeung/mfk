# MFP Admin V2 to V3 Configuration Migration Map — 2026-10-03

Status: `SOURCE-AUDITED PROPOSAL / DRY-RUN ONLY / NO DATA MOVED`

This document maps reusable Admin configuration into the new Admin V3 authority without making V2 a live POS authority. Admin V3 is the only intended live Admin UI/command authority after an explicit cutover. V2 is a bounded migration source and behavioral reference only. No bulk copy, production write, credential migration, permission expansion, endpoint change, or routing change is authorized here.

## Exact source identity

- Admin V3 Draft PR: `#605`
- Branch: `feat/MFK-V3ADMIN-ONE-SHOT-R1`
- Audited commit: `5954f301c684e795453d622790ca11acae8dfe79`
- The checked-out branch's nine-file `v3admin` A0 skeleton at `160be71ac660206b05a53449b9493c347f75f05b` is stale and must not be used to judge the current Admin V3 implementation.
- PR #605 uses `contracts/admin-config-sync-v1.ts`, reads canonical state from authenticated `GET /api/admin-browser/active?storeId=...`, and exposes formal server-draft/publish/version clients under `/api/admin-browser/...`.
- PR #605 still states `ZERO PRODUCTION ROUTING`; its authority tests require no V2 client-state imports and no V2 browser-storage truth.
- Its UI-preview workflow deliberately disables canonical queries and mounts preview fixtures. Sparse preview data is not proof that production canonical data is missing.
- The separate native consumer currently reads `GET /api/admin-sync/active`. The shared envelope is reusable, but production binding is not proven until the deployed Admin V3 backend and the approved non-browser consumer route are identified and read back.
- `posTenders` is absent from audited PR #605. Local commit `df260fd12807e87ff83f20def57ee879f2bb98f2` is therefore a tested V2-reference/schema proposal, not proof that Admin V3 publishes POS tender policy.

## Audited sources and target seams

Migration source/reference:

- `v2admin/src/admin-draft.tsx`
- `v2admin/src/admin-option-set-center.ts`
- `v2admin/src/admin-config-save.ts::collectAdminSnapshot`
- `v2admin/src/PolicyWorkspaces.tsx`
- `v2admin/worker.ts::AdminSyncStore`
- `contracts/admin-config-sync-v1.ts`
- local `contracts/pos-tender-policy-v1.ts` and `df260fd` only as a proposed POS-tender contract

Admin V3 target at the audited commit:

- `v3admin/src/canonical.ts`
- `v3admin/src/formal-draft.tsx`
- `v3admin/src/formal-catalog.ts`
- `v3admin/src/formal-option-center.ts`
- `v3admin/src/formal-combo.ts`
- `v3admin/src/formal-store.ts`
- `v3admin/src/formal-print.ts`
- `v3admin/src/formal-capacity.ts`
- `v3admin/src/formal-channel.ts`
- `v3admin/src/formal-staff.ts`
- `v3admin/src/state-authority.ts`
- `v3admin/src/authority.test.ts`

Admin V3 currently reuses `MFK_ADMIN_CONFIG_SYNC_V1` and a `Record<string, unknown>` snapshot rather than defining a second envelope. Formal V3 readers/writers make several snapshot domains concrete, but there is not yet one closed, publish-grade global snapshot schema covering every legacy domain. Migration must be driven by the deployed V3 validator and readback, not by copying browser storage.

## Reuse boundary

Reusable for migration or shared canonical consumption:

- the bounded canonical envelope validator and exact fingerprint calculation;
- stable source IDs and referential integrity checks;
- exact decimal-string validation and integer HKD-minor conversion at the native consumer;
- source revision/fingerprint provenance, idempotent replay, rollback/conflict rejection, and last-known-good behavior;
- Store Kernel CAS, atomic projection, receipt/readback, and deterministic retry patterns;
- Admin V3 formal readers/writers that preserve unknown sibling fields while editing a known domain.

Not reusable as Admin V3 production authority without explicit V3 evidence:

- V2 React/localStorage hydration or `collectAdminSnapshot` as server truth;
- V2 UI sessions, browser tokens, release outboxes, sync status, ACK history, or audit logs;
- `AdminSyncStore` ownership assumptions merely because the legacy worker currently serves the shared envelope;
- a hard-coded claim that `/api/admin-sync/active` is the deployed V3 device route;
- the local V2 `posTenders` publication change as proof of an Admin V3 field;
- any V2 pricing, Order, Payment, Business Day, kernel, persistence, or runtime writer.

## Catalog mapping

All mappings preserve IDs exactly. Migration must never renumber, regenerate, case-fold, or silently merge IDs.

| V2 source | Admin V3 canonical target | Rule |
|---|---|---|
| `catalog.categories[].id` | `snapshot.catalog.categories[].id` | Exact stable identity; duplicate/blank rejects. |
| `name`, `position`, `active` | same fields | Preserve exact value and ordering. |
| `catalog.products[].id` | `snapshot.catalog.products[].id` | Exact stable identity; every `categoryId` must resolve. |
| `name`, `categoryId`, `active` | same fields | Preserve. |
| `basePrice`, `takeawayAdjustment` | same decimal-string fields | Validate losslessly as maximum two decimals and checked HKD minor units; never use floating-point rounding. |
| `modifierGroupIds` | product links plus legacy compatibility field | `optionCenter.productLinks` is the formal V3 relationship. Legacy IDs may remain compatibility evidence, not a second authority. |
| `legacyBarcode`, `legacySourcePosition`, `productCode`, `shortName`, `description`, `sku`, `tags`, `imageRef`, `takeawaySurchargeEnabled` | same product extension fields where accepted | Preserve byte-for-byte semantic values. If the deployed V3 validator does not accept a field, report it as unsupported; do not drop it silently. |

PR #605's current `FormalCatalogProduct` surface directly uses `id`, `name`, `productCode`, `categoryId`, `active`, `basePrice`, and `description`. Other V2 product extensions are preservation requirements pending publish-grade V3 schema confirmation.

## Options and defaults

Preferred V3 target is `snapshot.optionCenter`:

- `sets[]`: `id`, `name`, `required`, `forceShow`, `selection`, `min`, `max`, `allowQuantities`, `active`;
- `sets[].options[]`: `id`, `code`, `name`, `priceAdjustment`, `active`, `position`;
- `productLinks[]`: `productId`, `setId`, `defaultOptionIds[]`.

Preserve set IDs, option IDs/codes, positions, selection constraints, product links, and defaults exactly. Every referenced product, set, and default option must exist. Single-select defaults may contain at most one option; required/min/max rules must remain valid. Price adjustments follow the same exact decimal/minor-unit rule as product prices.

PR #605's `readFormalOptionCenter` falls back to legacy `catalog.modifierGroups`, and `writeFormalOptionCenter` maintains both representations. That fallback is a migration compatibility seam only. After verified V3 publication, `optionCenter` is the formal edit model and legacy modifier groups must not diverge into a second authority.

## Combo mapping

Preserve the following identities and relationships:

- `catalog.combos[]`: `id`, `name`, `active`, `basePrice`, `takeawayAdjustment`, `takeawaySurchargeEnabled`, `productId`, `mainPoolId`, `addonPoolIds`, `sections`;
- `catalog.comboPools[]`: pool `id/name/kind/addonKind/active/position`, group IDs and constraints, bands, and choices;
- section/group/band/choice IDs, positions, min/max/required constraints, product links, labels, and price adjustments.

`priceStatus: OWNER_VALUE_REQUIRED` is not zero. Any unresolved combo base or adjustment value remains non-sellable/pending and must appear in the dry-run error report. `READY` values must pass exact decimal conversion and all referenced products/pools/bands must exist.

## Snapshot-domain disposition

| `collectAdminSnapshot` domain | Disposition | Notes |
|---|---|---|
| `catalog` | MIGRATE/PRESERVE | Formal PR #605 catalog and combo seams exist. |
| `optionCenter` | MIGRATE/PRESERVE | Formal V3 option-center seam exists; keep defaults and IDs. |
| `availability` | MIGRATE/PRESERVE | Formal V3 availability UI exists; verify deployed validator. |
| `businessDay` | MIGRATE/PRESERVE | Preserve cutoff and policy fields; do not infer an OPEN-only trading gate. |
| `logicalPrinters`, `printTemplates`, `printRules` | MIGRATE/PRESERVE | Formal V3 print seams exist; this is configuration, not physical acceptance. |
| `productMedia` | CONDITIONAL | Preserve references; verify uploaded asset ownership and URL policy separately. |
| `storeSettings` | MIGRATE/PRESERVE | Preserve store identity, timezone, hours, fulfillment settings, table config, and non-secret references. |
| `quickReasons` | CONDITIONAL | PR #605 explicitly marks a schema seam required. |
| `staff` | METADATA ONLY | Identity/role/active metadata may map only after security review; never migrate PINs or verifier material through this generic process. |
| `channelPolicy`, `channelMapping` | CONDITIONAL | Formal Keeta seams exist, but provider shop binding/live commands remain separate authority. |
| `customerChannelPolicy` | CONDITIONAL | Customer channels are not POS tender eligibility. |
| `posTenders` | TARGET FIELD MISSING | Owner-approved IDs are `CASH`, `ALIPAY`, `WECHAT_PAY`, `FPS`, `PAYME`; Admin V3 publish/readback support is still required. Do not promote `customerPaymentChannels` or `paymentRefs`. |
| `capacity` | MIGRATE/PRESERVE | Formal V3 capacity seam exists; runtime occupancy is excluded. |
| `presentation.customer/owner/frontline` | CONDITIONAL | Presentation config only; no runtime or transaction state. |
| `inventory` | CONDITIONAL | Config/thresholds only; reconcile live quantities separately. |
| `loyalty`, `coupons`, `pricingPromotions` | CONDITIONAL | Money-policy validation and exact eligibility/stacking rules are required before activation. |
| `announcements` | MIGRATE/PRESERVE | Content only, after deployed schema validation. |

## Never migrate through this configuration path

- raw staff PINs, passwords, password hashes, or generic credential material;
- account/browser sessions, cookies, tokens, API keys, provider access/refresh tokens, or private endpoints;
- device enrollment, Owner authorization, staff sessions, revocation state, or permission grants;
- V2 localStorage, browser cache, draft dirtiness, UI selection, sync outbox/status, ACK/release history, or audit logs as authority;
- Orders, Payments, refunds, receipts, idempotency journals, inbox/outbox events, Business Day runtime state, Dining occupancy/waiting/seating state, live capacity, live inventory, or provider settlement state;
- physical printer bindings, print success claims, OTA state, or runtime deployment state.

## Dry-run protocol

1. Prove the deployed Admin V3 source SHA, backend service/deployment, authenticated canonical endpoint, and approved MFP consumer route.
2. Read one immutable V2 source snapshot and record source store, revision, published time, envelope fingerprint, and content counts. Do not read arbitrary localStorage as canonical input.
3. Run the deployed Admin V3 publish-grade validator without writing. Produce a normalized payload hash, exact field/count diff, referential-integrity report, money conversion report, and unsupported-field report.
4. Require an empty silent-drop set. Unsupported values must be explicitly mapped, deferred, or rejected.
5. Derive an idempotency key from source fingerprint plus target schema/validator version. Exact replay is no effect; same key with different content is a conflict.
6. Only after separate authorization, write through the Admin V3 formal server-draft/publish command. The target assigns its own revision; the V2 revision is provenance only.
7. Read back through Admin V3 canonical read, then through the approved MFP consumer route. Counts, stable IDs, exact prices, defaults, fingerprints, and required fields must match.
8. Do not activate MFP production consumption until the V3 publication/readback and device route converge on the same envelope.

## Acceptance gates

- Admin V3 source/deployment/backend identities are pinned and agree with the serving health/build evidence.
- Preview mode is excluded from migration conclusions.
- Category, product, option, combo, pool, table, printer, and policy counts reconcile.
- Stable IDs, ordering, defaults, links, and exact integer-minor prices survive restart/readback.
- No unresolved `OWNER_VALUE_REQUIRED`, dangling reference, duplicate identity, or silently unsupported field becomes sellable.
- POS tender policy is formally present in Admin V3 and reads back with the five approved stable IDs; no Customer channel field is promoted.
- No credential, session, permission, provider secret, live transaction, or runtime state crosses the configuration boundary.
- MFP consumes Admin V3 canonical publication only after the approved route is proven; V2 remains migration/reference only.

## Current blocker

The source branch is now known, but PR #605 is explicitly unrouted and does not publish `posTenders`. Before any production binding or migration write, obtain: the deployed Admin V3 backend identity, canonical publish/read endpoint and auth contract, approved MFP non-browser consumer route, revision/fingerprint readback semantics, and the Admin V3 POS-tender target field. Until then, the native generic envelope/Room work remains reusable and fail-closed, while V2-backed publication changes remain reference-only.
