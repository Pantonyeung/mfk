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
