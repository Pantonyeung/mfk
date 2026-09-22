# MFK Canonical Domain Governance R1

Date: 2026-09-22
Status: CURRENT / CONTROLLING
Control: Pantonyeung/mfk #22

## Canonical root

`morefunos.com`

This is the permanent Internet namespace for MFK system web surfaces.

## Immediate canonical Admin URL

`https://admin.morefunos.com`

Admin application deep links must remain under that hostname, for example:
`https://admin.morefunos.com/admin/publish`

## Namespace rules

- `workers.dev` = bootstrap / temporary validation only.
- Never publish `workers.dev` as the canonical system URL in user-facing documentation, QR codes, bookmarks or provider callbacks.
- `morefunos.com` apex is reserved as the root namespace / future front door.
- Each future Internet-facing product gets an explicit subdomain under `morefunos.com` only after Owner approval.
- Do not invent future hostnames automatically.
- SMT local transaction runtime remains local-first and does not require a public hostname.
- OTA keeps its current endpoint until an explicit OTA migration seam is opened, tested and banked.
- Keeta/provider callbacks must not be pointed to a new MFK hostname until the exact provider seam is authorized and tested.

## Cloudflare mapping

For `mfk-admin`, use a Worker Custom Domain:
`admin.morefunos.com`

Dashboard path:
`Workers & Pages → mfk-admin → Domains → Add → Custom Domain → admin.morefunos.com`

Custom Domain is preferred because the Worker is the origin for the Admin site.

## Security

After the domain is serving the real MFK Admin, protect the Admin hostname/Worker with Cloudflare Access before normal operational use.

## Acceptance

`admin.morefunos.com` must load the MFK Admin app and `/admin/publish` route.

Until that proof exists:
`CANONICAL DOMAIN = LOCKED / PROVIDER ROUTE = PENDING`
