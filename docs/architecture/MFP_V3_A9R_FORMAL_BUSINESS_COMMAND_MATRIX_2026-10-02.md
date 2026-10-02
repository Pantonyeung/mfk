# MFP V3 A9R Formal Business Command Matrix — 2026-10-02

Status: `SOURCE_VERIFIED` for the R0 router skeleton. Production mutation remains blocked.

Authority owner: `STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`

The browser may submit only `mfp.store-kernel.command.v1`. It cannot name aggregates, provide mutations, or inject canonical Order/Payment state. Every future mutation must be derived by a native handler and committed through `StoreKernelTransactionCoordinator`.

## Shared transaction contract

- Identity: `(storeId, submissionId, idempotencyKey, request fingerprint)`.
- Replay: the same identity and fingerprint returns the stored canonical receipt; a different fingerprint returns `FORMAL_SUBMISSION_FINGERPRINT_CONFLICT` with no second mutation.
- Readback: receipt lookup runs before Security or a handler. Transport uncertainty returns `UNKNOWN` with readback required and blind retry forbidden.
- Result: `COMMITTED` requires a Store Kernel receipt. `REJECTED` is recorded as a receipt-only Store Kernel result. No receipt means `UNKNOWN`.
- Revision: `expectedRevision` is only an assertion. A future handler must fresh-read and compare canonical revision; the client value never becomes canonical state.
- Current writes/outbox: `NONE`. Every R0 handler is fail-closed. Exact aggregate schemas and outbox effects remain unbound and therefore are not invented here.

## Registry and state mapping

| Command | Required fresh canonical reads before any future write | Expected revision source | Future logical state owner | Current stable result |
|---|---|---|---|---|
| `CHECKOUT_PAYMENT_CONFIRM` | Security admission; formal quote/pricing facts; discount policy; tender eligibility; active Business Day; prior receipt | Formal pricing quote/revision | One canonical Order/payment transaction; exact aggregate schema unbound | `MFP_SECURITY_PRODUCTION_BINDING_MISSING`; with authorized test Security: `FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING`; Tender also unbound as `FORMAL_TENDER_AUTHORITY_DEPENDENCY_MISSING` |
| `ORDER_FULFILLMENT_SET` | Security admission; canonical Order and fulfillment revision; prior receipt | Canonical Order revision | Existing canonical Order | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_MODIFICATION_REQUEST` | Security admission; canonical Order/payment facts and revision; prior receipt | Canonical Order revision | Existing canonical Order or formally linked adjustment | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_PAYMENT_CORRECTION` | Security admission; canonical Order/payment facts and revision; prior receipt | Canonical payment/Order revision | Existing canonical payment record or formally linked correction | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_REFUND` | Security admission; canonical Order/payment/refund facts and revision; prior receipt | Canonical payment/Order revision | Formally linked refund/correction record | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_CANCEL` | Security admission; canonical Order and operational revision; prior receipt | Canonical Order revision | Existing canonical Order plus authorized operational effects | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_FORMAL_ADMIT` | Security admission; canonical dining/order/config facts; prior receipt | Canonical dining/order revision | Canonical Order; Dining is not a second Order engine | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_WAITING_CREATE` | Security admission; canonical waiting/config facts; prior receipt | Canonical dining revision | Canonical dining operational state | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_TABLE_ASSIGN` | Security admission; canonical waiting/table/order facts; prior receipt | Canonical dining/order revision | Existing canonical dining/Order identity | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_TABLE_TRANSFER` | Security admission; canonical table/order facts; prior receipt | Canonical dining/order revision | Existing canonical dining/Order identity | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_ITEMS_ADD` | Security admission; canonical Order, pricing/config and dining facts; prior receipt | Canonical Order revision | Existing canonical Order | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `RUNTIME_AVAILABILITY_SET` | Security admission; canonical availability/config facts; prior receipt | Canonical availability revision | Store Kernel transaction-time availability | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `CAPACITY_POOL_CORRECT` | Security admission; canonical capacity/config/business-day facts; prior receipt | Canonical capacity revision | Store Kernel transaction-time capacity | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `CAPACITY_OVERRIDE_CREATE` | Security admission; canonical capacity/config/business-day facts; prior receipt | Canonical capacity revision | Finite audited Store Kernel override | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `CUSTOMER_NEW_ORDER_ACCEPTANCE_SET` | Security admission; canonical customer intent/config/admission facts; prior receipt | Canonical customer admission revision | Canonical admission decision | `MFP_CUSTOMER_PRODUCTION_BINDING_MISSING` |
| `ORDER_MODIFICATION_CUSTOMER_DECISION` | Security admission; canonical Order/modification facts; prior receipt | Canonical Order/modification revision | Existing canonical Order/modification | `MFP_CUSTOMER_PRODUCTION_BINDING_MISSING` |
| `EXTERNAL_KEETA_LIFECYCLE_APPLY` | Security admission; provider evidence plus canonical external/order facts; prior receipt | Canonical external lifecycle revision | Canonical external lifecycle linked to existing Order | `MFP_KEETA_PRODUCTION_BINDING_MISSING` |
| `EXTERNAL_CUSTOMER_ORDER_ADMIT` | Security admission; canonical customer intent/config and duplicate identity; prior receipt | Canonical external admission revision | Canonical Order admission | `MFP_CUSTOMER_PRODUCTION_BINDING_MISSING` |
| `EXTERNAL_KEETA_ORDER_ADMIT` | Security admission; provider evidence/config and duplicate identity; prior receipt | Canonical external admission revision | Canonical Order admission | `MFP_KEETA_PRODUCTION_BINDING_MISSING` |

## Checkout R1 boundary

`CHECKOUT_PAYMENT_CONFIRM` is registered and reaches the native authority boundary, but it does not mutate in this pass. Production Security is unbound; when tests inject an authorized Security decision, the handler stops at `FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING`. No formal Pricing or Tender authority/read model exists that can safely supply a validated quote, total, discount decision, or tender eligibility.

Therefore opening Checkout, changing channel/tender, and entering Final Review remain zero-commit client workflow. Only a future Payment Confirm handler may cross the formal boundary after Security, Pricing, and Tender authorities are explicitly bound. Client totals and Student Discount intent can never finalize canonical values.

## Next authorized mutation step

R2 must first bind existing canonical Security, Pricing, and Tender read authorities and publish their exact input contracts. Then implement one `CHECKOUT_PAYMENT_CONFIRM` handler that fresh-reads those facts, rejects stale revision before commit, derives integer-minor-unit Order/payment state internally, and submits one trusted `StoreKernelContract.CommitRequest`. No other command handler is authorized by this matrix.
