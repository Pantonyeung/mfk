# MFK Keeta Integration

Current state: `K0_LIVE_EDGE_AUTH_WEBHOOK_ONLY`

The provider contract migration from #27 remains the basis. #115 explicitly opens a bounded live K0 connection.

K0 live scope:
- Admin-origin OAuth start/callback
- signed token exchange / refresh
- encrypted token-at-rest in the dedicated Keeta edge Durable Object
- Admin Store → Keeta shop alias binding
- provider Store Details readback probe
- exact-signature webhook verification
- messageId dedupe / conflict fail-closed
- verified provider evidence capture only

K0 does NOT:
- create Formal Orders
- send merchant confirm/cancel/ready
- send menu sync
- approve/reject refunds
- mutate MFK Pricing / Payment / Fulfillment truth
- activate store rest/open
- weaken signature verification

Provider IDs remain aliases/evidence only. MFK remains canonical authority.

Known external blocker remains active:
`KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH`

A live callback that fails signature verification is rejected. There is no permissive fallback.

Required runtime secrets are external to source:
- `KEETA_APP_ID`
- `KEETA_APP_SECRET`
- `KEETA_TOKEN_ENCRYPTION_KEY`

Optional runtime overrides:
- `KEETA_OAUTH_REDIRECT_URI`
- `KEETA_WEBHOOK_CALLBACK_URL`

Default canonical callback endpoints:
- OAuth: `https://admin.morefunos.com/api/keeta/oauth/callback`
- Webhook: `https://admin.morefunos.com/api/keeta/webhook`

K1 only starts after K0 provider readback and at least one real signed webhook are proven.
