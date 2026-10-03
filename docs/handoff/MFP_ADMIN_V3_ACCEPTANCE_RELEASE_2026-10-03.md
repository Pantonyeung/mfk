# Admin V3 acceptance release source packet

Base: `34ce775f72712208676f9ce4f0653e0921338d89`. Isolated source patch, not deployed.

## V3 ownership and preserved authority

`v3admin/worker.ts`, `customer-runtime.ts`, `keeta-runtime.ts`, `keeta-menu-projection.ts`, and `keeta-store-projection.ts` were first copied byte-identically from the retained V2 reference at the base. Only worker.ts subsequently adds the explicit public Customer gate. V3 does not import runtime code from a V2 directory. Shared contracts/integrations retain their existing authority. `wrangler.release.jsonc` is exactly the previous service config placed beside V3-owned server modules; its relative `./dist` now serves V3 client assets. The original preview config remains preview-only.

No DO class/name/migration, storage key, business schema, R2 bucket, staff/session/auth material or runtime configuration value is changed. Deploying to the same existing account/service is a required external verification; the file alone cannot prove it. Preserve deployment version for code rollback; code rollback cannot reverse business writes.

## Separately reviewable changes

- `/api/customer/` routes return 503 `V3_CUSTOMER_PROVIDER_NOT_BOUND` before DO/R2 access, except existing staff-orders and smt prefixes that retain their existing auth. The broad public gate intentionally covers snapshot, channel-health, submit/readback and evidence/QR routes, and unknown future public paths. No production Customer provider is enabled. Admin-authenticated endpoints are unchanged; public display of uploaded payment QR remains blocked.
- Demo mode requires `VITE_MFK_V3_PREVIEW_MODE=1`; URL `?preview=ui-01` no longer turns a canonical build into demo. Normal build uses relative same-origin API routes. Login copy is truthful about V3 acceptance/formal data.
- Remove 60-second business-data polling from canonical and six read models. Existing start, mount, focus, reconnect, doorbell invalidation and manual reads remain. Release-identity-only refresh remains, unrelated to business-data polling. Event drop/reconnection and browser acceptance still require runtime evidence.

## Release and acceptance

Build canonical with preview=0, R2 product media=0, empty API base, exact final source SHA/release ID. Do not use Admin UI-only preview workflow. Resolve existing Cloudflare service/account/custom domain/current version and DO IDs, then prove release manifest and health separately. Source tests cannot prove existing session continuity; V3 is memory-only and requires normal sign-in after reload. Never read/copy the old browser token.

The source-selected business extract exports only catalog, optional optionCenter/logicalPrinters/printTemplates/printRules/printTemplateCatalog/printTemplateProfile, with absence preserved, current canonical metadata/checksum and sensitive-key rejection. It is not a full-system backup and excludes unpublished drafts, broader business policy, transaction/history/identity material. Current old UI has no source-verified equivalent export; actual preservation evidence is not yet obtained. Do not claim this gate passed or use an unfiltered active-envelope dump.

No actual deploy, routing mutation, live write, publish, transaction, account action or physical print has run. No workflow edits or gate weakening. Full test/build and independent review evidence accompany the external patch. Aggregate governance risks remain explicit.


### Preservation-first activation amendment

The initial code-only V3 deployment uses server `MFP_V3_CONFIG_WRITES_ENABLED=0` and build `VITE_MFK_V3_CONFIG_WRITES_ENABLED=0`; missing/malformed values also lock. The UI mounts only existing normal app authentication and selected-business Prepare/Download, not editors or draft/publish providers. Server blocks mutating canonical `/publish`, every non-auth `/admin-browser/` route (including draft/product create/update/delete/publish and version rollback), and payment-QR upload. Matching outer aliases and direct inner DO calls are covered; `GET`/`HEAD`/`OPTIONS` and existing auth/session paths retain behavior. Existing unrelated transaction/operational endpoints are not claimed globally read-only.

Phase 1 is code-only and reversible with preserved storage, not a backup. After the actual selected-business download and identity/checksum/count inspection, parent may deploy the same independently reviewed source in phase 2 with both flags exactly `1`. That re-enables existing authorization-gated configuration paths; it creates no general permission for arbitrary business writes. Server health and asset release manifest report configuration-write mode separately. Query parameters cannot unlock either mode.


### Parent privacy review correction (10:40 UTC)

Public generic `/api/admin-sync/` and `/api/projection/` are now blocked before DO/R2 access in every configuration-write mode, including aliases to full active-envelope reads and projection/native writes. Existing authenticated `/api/admin-browser/` login, canonical read and selected-business extract remain. Setting the config-write flag to1 does not reopen these providers. This supersedes any earlier statement in this packet that the generic transport/doorbell remains active; future restoration requires separately reviewed authenticated admission.

The full-mode read-model provider no longer constructs a WebSocket or reconnect timer for the deliberately blocked event endpoint. Its channel status is UNBOUND; the freshness text explicitly discloses this. Fixed business polling remains absent. Initial/focus/reconnect/manual canonical reads retain their original authenticated path. No missed-event convergence or operational/native provider acceptance is claimed. The source defect is not a finding of an observed live breach; no unfiltered live envelope or credential was inspected.
