# MFK-KEETA-API-CLEAN-MIGRATION-R1 Handoff

CURRENT: `MFK_KEETA_API_MIGRATED_NOT_WIRED_SOURCE_READY`

CAPABILITY_COUNT: 21

WHAT_MOVED:
- Keeta/Hong Kong provider identity
- capability registry
- pure signature preimage + SHA-256 output contract
- fail-closed provider response normalization
- full-snapshot menu payload/validation/request shape
- menu task + picture task completion parsers
- order placement provider-evidence normalization
- provider shop alias binding contract
- merchant confirm/cancel/reject shapes
- Ready-only `/order/prepare` shape
- sellability translation shape
- store-hours conversion/validation/request shape
- rest/open request shape with lifecycle separation
- 1005/1007 after-sale evidence + blocked decision shapes
- webhook envelope/replay/dedup/conflict contracts
- runtime secret reference interface contract
- SIT/UAT registry + external evidence registry
- source-only migration firewall tests

WHAT_REMAINS_NOT_WIRED:
- all provider commands
- live signature verification secret binding
- public webhook server
- Admin/SMT/SMM/Customer/Owner wiring
- MFK Availability binding
- Admin Store Config binding
- Formal Order creation
- provider activation

BLOCKED_EXTERNAL:
- `KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH`
- generic PREPARING provider operation remains unsupported; `/order/prepare` is READY only

UNKNOWN:
- full formal UAT mapping/acceptance remains unexecuted
- live-origin webhook signing semantics remain unresolved

AUTHORITY_SCAN:
- target confined to `integrations/keeta/**`
- no product-port files modified
- no network client / provider send path
- no Cloudflare/D1 runtime
- no secret value/token/callback URL
- no Store Kernel/Formal Order/Pricing/Payment/Fulfillment writer
- all outbound shapes `NOT_WIRED`

CANDIDATE_SHA:
- record exact branch head in GitHub #27 return comment

BLOCKER:
- NONE for source migration handoff
- live/external execution intentionally out of scope

TEST_EXECUTION:
- `HANDOFF_TO_MAIN_CHAT`

SUCCESS:
- `MFK_KEETA_API_MIGRATED_NOT_WIRED`
