# MFK v2customer｜Product Completeness R1

WORK_ID: `MFK-CUSTOMER-PRODUCT-COMPLETION-R1`

Role: `CUSTOMER ORDERING PRODUCT / ORDER SOURCE`

Current state:
`PRODUCT_COMPLETE_NOT_CONNECTED`

Product responsibility now implemented:
- Home / Store Context / Own-channel availability
- Menu / Category / Search / zero-result recovery
- Product detail / Variation / Modifier / Option / Combo
- min/max/required validation
- durable local non-authoritative Cart
- quantity/edit/remove/partial-repair presentation
- quote presentation only through injected MFK runtime port
- persistent checkout name/phone draft
- stable Submission ID + idempotency identity
- PENDING / UNKNOWN / readback-first / no blind resubmit
- Store received / rejected / accepted / preparing / delayed / ready
- Pickup Verification / Handed Over / Completed separation
- Pickup code / masked phone presentation
- Order detail / timeline
- History / Buy Again / Reorder current revalidation
- own-channel unavailable + explicit fallback surface
- offline/not-connected/loading/error/empty recovery
- browser refresh persistence for local cart/draft/pending intent

Connection boundary:
- runtime is injected only through `window.__MFK_CUSTOMER_PRODUCT_PORT__`
- missing runtime produces empty/not-connected states, never fake product/order/price truth
- localStorage stores customer intent/preferences only and is `LOCAL_NON_AUTHORITATIVE`

Hard authority rules:
- no live Customer→SMT
- no direct fetch/WebSocket/XHR/API
- no Formal Order writer
- no Display Number allocator
- no local Pricing engine
- no Payment execution
- no Store Kernel writer
- no pickup/fulfillment authority
- no provider mutation
- no background auto-resubmit
- all command capabilities remain `NOT_WIRED`

The old fixture/migration shell has been removed from production source.


## Cloud Bridge R1 candidate

Work: `MFK-CUSTOMER-CLOUD-BRIDGE-R1`  
Issue: #189  
PR: #190 (DRAFT / NOT DEPLOYED)

Connection candidate:
- Customer runtime port -> public `/api/customer/**`
- Admin published config -> public Customer menu/read model projection
- quote intent -> Customer Durable Object -> SMT authenticated pull -> local published pricing/config validation -> quote ACK/readback
- order intent -> Customer Durable Object -> SMT authenticated pull -> local canonical Order commit -> Display allocation -> ACK/readback
- Customer order status -> only submission IDs retained by that browser -> filtered SMT projection
- stable submissionId/idempotency; UNKNOWN/readback-first; zero blind resubmit

Authority remains:
- Customer localStorage = non-authoritative cart/draft/submission references only
- Cloud Durable Object = pending intent / ACK transport state only
- SMT local = Formal Order + Display authority
- no D1/R2 binding in this cut
- no cloud Payment execution
- no second Pricing/Order/Store Kernel/Sync engine

Current limitations before live deploy:
- executable multi-port verification still required
- Customer authentication / stronger privacy binding must be reviewed before public live acceptance
- variation/combo execution remains fail-closed until mapped to current published canonical semantics
- physical/store-device acceptance is deferred to Owner onsite testing
