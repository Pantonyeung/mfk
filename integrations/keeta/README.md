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

## Banked official menu-mutation evidence (2026-10-01)

The inert package boundary above is unchanged. The live server-only executor is in `v2admin/keeta-provider-mutation.ts` and is limited to operations present in Keeta's official Menu API documentation:

- Official menu index: <https://api-docs.mykeeta.com/apis/standard/menu>
- Keeta-ID operations: <https://api-docs.mykeeta.com/apis/standard/menu/keetaid-based>
- Category: `shopcategory/list`, `create`, `update`, `batchdel`, `batchupdatesequence`
- Product: `spu/list`, `detail`, `batchcreate`, `batchupdate`, `batchdel`, `batchupdatesequence`
- Choice group: `choicegroup/list`, `batchcreate`, `batchupdate`, `batchdel`, `listappliedspu`

The official `product/menu/sync` contract is a full replacement: omitted OpenItemCodes are deleted, and a successful response means only that an asynchronous task was submitted. MFK therefore keeps it behind explicit `RECOVERY_FULL_MENU_SYNC`; normal Admin publish uses the fine-grained operations above and never falls back to full replacement.
