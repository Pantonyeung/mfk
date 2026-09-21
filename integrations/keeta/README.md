# MFK Keeta Integration Contract

Status: `MIGRATED_NOT_WIRED`

This package contains only inert provider-contract, translation, evidence, security-contract and certification shapes for Keeta Hong Kong.

Hard boundary:
- no live HTTP/network client
- no provider activation
- no Cloudflare Worker or D1 runtime
- no callback URL
- no credential/token/secret value
- no SMT/Admin/SMM/Customer/Owner wiring
- no Store Kernel, Formal Order, Pricing, Payment or Fulfillment authority
- every outbound provider command shape is `NOT_WIRED`

Historical Morefun-v2 material is used only as a contract/capability/SIT-UAT oracle. MFK remains the current authority.

The menu sync builder is intentionally full-snapshot only. Omitted existing OpenItemCodes can represent provider deletion, therefore this package never submits menu payloads.

Known external evidence remains unresolved: `KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH`. Signature verification semantics must not be weakened.
