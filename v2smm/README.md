# MFK v2smm｜Product Completeness R1

WORK_ID: `MFK-SMM-PRODUCT-COMPLETION-R1`

Role: `TRUSTED STAFF ASSISTIVE TERMINAL`

Current state:
`PRODUCT_COMPLETE_NOT_CONNECTED`

This app is a complete SMM product surface prepared for later connection to MFK canonical services.

Implemented product responsibility:
- Traditional Chinese mobile operator shell and navigation
- Menu/category/search/zero-result handling
- Product variation / modifier / combo selection with min/max/required validation
- Durable local non-authoritative cart and pending-intent workspace
- Cart quantity/edit/remove
- Quote presentation through injected runtime port only; no local pricing engine
- Stable submission identity, UNKNOWN/readback-first flow, no blind resend
- Active/history order list, source filter, drill-down timeline
- Work queue / delayed ETA / action-required visibility
- Channel Health read-only
- Sellability command surface
- Dine-in session surface
- Business Day record-only projection
- Print/device health read-only
- Diagnostics and complete empty/loading/error/not-connected states
- Browser-refresh persistence for local drafts and operator preferences

Connection boundary:
- runtime is injected only through `window.__MFK_SMM_PRODUCT_PORT__`
- missing runtime never creates fake data or fake success
- localStorage stores drafts/preferences only and is explicitly `LOCAL_NON_AUTHORITATIVE`

Hard authority rules:
- no Formal Order writer
- no Display Number allocator
- no local Pricing/Payment engine
- no Store Kernel writer
- no Print engine
- no direct cloud/API submit
- no SMM→SMT live LAN in this phase
- no provider mutation
- all command capabilities remain `NOT_WIRED` until a later Owner-authorized connection phase

Historical `Morefun-v2/apps/smm-web/**` was used only as UI/workflow/persistence donor. Its old runtime/network/canonical ownership was not migrated.
