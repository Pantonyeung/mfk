# MFK v2customer｜Ordering Donor Fusion + Brand Experience R2

WORK_ID: `MFK-CUSTOMER-ORDERING-DONOR-FUSION-R2`

Role: `CUSTOMER ORDERING PRODUCT / ORDER SOURCE`

Current state:
`PRODUCT_COMPLETE_NOT_CONNECTED`

Product responsibility now implemented:
- five-part customer navigation: Home / Order / Memory Jar / My Orders / My Memory
- food-first Home / Store Context / Own-channel availability / active-order priority
- Menu / Category / Search / zero-result recovery
- progressive Product detail / Variation / Modifier / Option / Combo / quantity / one-time note
- min/max/required validation
- durable local non-authoritative Cart presented as the Memory Jar
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
- read-only Member / Seeds / Coupons / Badges / remembered-taste projection surfaces
- honest per-module waiting-for-data states when member/loyalty truth is not connected
- responsive iPhone/Android visual acceptance and reduced-motion/keyboard support

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

R2 evidence:

- donor extraction: `docs/DONOR-LEDGER-R2.md`
- route, state, token and browser proof: `docs/R2-ACCEPTANCE.md`
- reproducible non-production browser harness: `visual-acceptance.html`
