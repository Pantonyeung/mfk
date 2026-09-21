# MFK v2customer｜Clean Migration R1

WORK_ID: `MFK-CUSTOMER-CLEAN-MIGRATION-R1`

Role: `CUSTOMER ORDERING SURFACE / MIGRATION_ONLY`

呢個 Port 只包含 Customer UI、頁面、表單、workflow shape、operation/failure presentation 同 capability registry。

Current boundary:

- independent `v2customer/**` app；
- Home → Menu → Product Config → Cart → Checkout → Safe Submit presentation；
- phone input + pickup-code presentation shape；
- Store Acceptance → Preparing → Ready → Pickup → Completed tracking shape；
- Order Status / Order Detail / History / Reorder shape；
- own-channel unavailable + WhatsApp fallback presentation；
- Offline / Failure / Retry / UNKNOWN / STALE presentation；
- 44-item Customer capability registry；
- 所有 `COMMAND_SHAPE` 一律 `NOT_WIRED`。

Hard boundary:

- 無 live Customer → SMT submit；
- 無 LAN / provider / cloud connection；
- 無 Store Kernel write；
- 無 Formal Order creation；
- 無 Display Number allocation；
- 無 pricing engine；
- 無 payment execution；
- 無 background replay / delayed submit；
- 無 SMT mutation；
- 無 browser persistence。

所有商品、訂單、狀態與金額字樣都係 migration fixture，只用作驗證 UI / workflow shape，唔係 current business truth。
