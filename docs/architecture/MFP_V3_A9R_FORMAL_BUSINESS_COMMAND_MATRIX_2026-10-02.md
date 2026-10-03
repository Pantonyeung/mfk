# MFP V3 A9R Formal Business Command Matrix — 2026-10-03 Update

Status: `SOURCE_AND_ROOM_VERIFIED` for the R0 router and bounded non-Student cash checkout mapping. Production source/bridge binding remains fail-closed and in progress.

Authority owner: `STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY`

The browser may submit only `mfp.store-kernel.command.v1`. It cannot name aggregates, provide mutations, attach native read dependencies, or inject canonical Order/Payment state. Every mutation is derived by a native handler and committed through the existing `StoreKernelTransactionCoordinator`.

## Shared transaction contract

- Identity: `(storeId, submissionId, idempotencyKey, request fingerprint)`.
- Replay: the same identity and fingerprint returns the stored canonical receipt; a different fingerprint returns `FORMAL_SUBMISSION_FINGERPRINT_CONFLICT` with no second mutation.
- Readback: receipt lookup runs before Security or a handler. After transport/coordinator uncertainty, receipt readback runs before returning `UNKNOWN`; blind retry is forbidden.
- Result: `COMMITTED` requires a Store Kernel receipt. A known rejection is durable only when its failure class is safe and no commit receipt exists. No receipt plus an unclassified failure means `UNKNOWN`.
- Revision: the client `expectedRevision` is an assertion only. Native handlers fresh-read authoritative facts and attach immutable revision dependencies checked inside the same Room transaction.
- Time: freshness/expiry uses the earliest trusted-native commit deadline and is checked in the same transaction before writes.
- Outbox: every ACK/release consumer must echo the claimed positive `attemptCount`; stale or missing tokens fail closed.

## Registry and state mapping

| Command | Required fresh canonical reads before a write | Expected revision source | Logical state owner | Current stable result |
|---|---|---|---|---|
| `CHECKOUT_PAYMENT_CONFIRM` | Receipt; device; device-bound parent Owner authorization; staff session; Admin configuration; formal quote; POS tender; active Business Day; display sequence | Exact seven native aggregate dependencies plus earliest deadline | One canonical Order/Payment transaction in the existing Store Kernel | Trusted-port non-Student cash path is `SOURCE_AND_ROOM_VERIFIED`; cash evidence must be `CASH_COUNTED`, electronic evidence must be `STAFF_CONFIRMED` and never provider-verified; public bridge remains fail-closed while real producers are unbound; Student requests reject until canonical policy exists |
| `ORDER_FULFILLMENT_SET` | Security admission; canonical Order and fulfillment revision; receipt | Canonical Order revision | Existing canonical Order | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_MODIFICATION_REQUEST` | Security admission; canonical Order/payment facts and revision; receipt | Canonical Order revision | Existing canonical Order or formally linked adjustment | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_PAYMENT_CORRECTION` | Security admission; canonical Order/payment facts and revision; receipt | Canonical Payment/Order revision | Existing canonical Payment or linked correction | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_REFUND` | Security admission; canonical Order/payment/refund facts and revision; receipt | Canonical Payment/Order revision | Formally linked refund/correction | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `ORDER_CANCEL` | Security admission; canonical Order and operational revision; receipt | Canonical Order revision | Existing canonical Order plus authorized effects | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_FORMAL_ADMIT` | Security; canonical Dining/Order/config; receipt | One Dining revision plus Order revision when Order membership/lifecycle changes | Canonical Dining state and existing canonical Order identity | Planner may remain unregistered until every `Order.dining` writer shares the Dining revision CAS/bump contract |
| `DINING_WAITING_CREATE` | Security; canonical waiting/config; receipt | Canonical Dining revision | Canonical Dining operational state | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_TABLE_ASSIGN` | Security; canonical waiting/table/Order; receipt | Canonical Dining revision plus Order revision when linked | Existing canonical Dining/Order identity | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_TABLE_TRANSFER` | Security; canonical table/Order; receipt | Canonical Dining revision plus Order revision | Existing canonical Dining/Order identity | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `DINING_ITEMS_ADD` | Security; canonical Order, pricing/config and Dining; receipt | Canonical Order and Dining revisions | Existing canonical Order | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `RUNTIME_AVAILABILITY_SET` | Security; canonical availability/config; receipt | Canonical availability revision | Store Kernel transaction-time availability | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `CAPACITY_POOL_CORRECT` | Security; canonical capacity/config/Business Day; receipt | Canonical capacity revision | Store Kernel transaction-time capacity | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `CAPACITY_OVERRIDE_CREATE` | Security; canonical capacity/config/Business Day; receipt | Canonical capacity revision | Finite audited Store Kernel override | `MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING` |
| `CUSTOMER_NEW_ORDER_ACCEPTANCE_SET` | Security; canonical customer intent/config/admission; receipt | Canonical customer admission revision | Canonical admission decision | `MFP_CUSTOMER_PRODUCTION_BINDING_MISSING` |
| `ORDER_MODIFICATION_CUSTOMER_DECISION` | Security; canonical Order/modification; receipt | Canonical Order/modification revision | Existing canonical Order/modification | `MFP_CUSTOMER_PRODUCTION_BINDING_MISSING` |
| `EXTERNAL_KEETA_LIFECYCLE_APPLY` | Security; provider evidence; canonical external/Order; receipt | Canonical external lifecycle revision | Canonical external lifecycle linked to existing Order | `MFP_KEETA_PRODUCTION_BINDING_MISSING` |
| `EXTERNAL_CUSTOMER_ORDER_ADMIT` | Security; canonical customer intent/config and duplicate identity; receipt | Canonical external admission revision | Canonical Order admission | `MFP_CUSTOMER_PRODUCTION_BINDING_MISSING` |
| `EXTERNAL_KEETA_ORDER_ADMIT` | Security; provider evidence/config and duplicate identity; receipt | Canonical external admission revision | Canonical Order admission | `MFP_KEETA_PRODUCTION_BINDING_MISSING` |

## Checkout R1 exact write set

The native checkout assembler fresh-validates trusted security, normalized intent/quote, tender, Business Day, and display-sequence snapshots. For an unreplayed valid non-Student cash submission it derives one transaction containing:

- a Business-Day display-sequence compare-and-set;
- one deterministic canonical `ORDER` with exact integer-minor totals and retained Orders-contract fields;
- one deterministic linked canonical `PAYMENT` with an explicit settlement evidence mode; cash has integer-minor received/change and electronic tender records only staff-confirmed visual review;
- one durable command receipt;
- deterministic `MFP_ORDER_COMMITTED_V1` and `MFP_PAYMENT_CONFIRMED_V1` outbox events.

No Order, Payment, or outbox effect exists before Payment Confirm. Opening Checkout, changing channel/tender, and entering Final Review remain zero-commit client workflow. Student Discount intent never finalizes client-computed money and currently fails closed because canonical eligibility and remaining policy rules are not published.

The production bridge remains unregistered until every trusted source producer is bound. Test-injected sources prove the mapping and transaction behavior only; they are not production-authentication, provider-payment, or screenshot evidence. Owner logout is device-local: revoking that device's parent authorization invalidates its descendant staff access while independently authorized devices remain unaffected.

## Next authorized engineering steps

Continue bounded native source/adapter work without reviving V2 authority:

1. bind real device/Owner/staff, quote, POS tender, Business Day, and display-sequence producers;
2. harden Print/OTA source recovery without live activation;
3. freeze canonical Orders/Dining read production and revision ownership;
4. register one further command family only after its complete read set, CAS/write set, receipt, outbox, and recovery behavior are proven.

Candidate Publish, deploy, OTA activation, merge, live financial transactions, and physical acceptance remain blocked without explicit Owner `PROMOTE`.
