# SMT Public / Physical parity matrix — 2026-09-29

## Scope and evidence rules

This report compares the Physical SMT signed `.mfos`/OTA surface with the Public Web Acceptance SMT. It is a source and transport audit, not a production acceptance result. `UNKNOWN` is used whenever the deployed artifact or a live end-to-end observation is unavailable; matching repository source is not treated as proof of matching deployment.

The repository baseline inspected was `052295861931b72aa401aa6fa06c3cd65866706d`; its `v2local` tree is `f27c85866349047aec9afd8b66dcf33b62be01b3`, as supplied in the recovery brief. Physical deployment identity comes from its OTA manifest. Public identity is now exposed by `GET /__mfk/build` and must be deployed through `npm run deploy:web-acceptance`, which injects the exact Git SHA while Cloudflare version metadata supplies deployment time.

## Matrix

| Capability | Physical SMT | Public Web Acceptance SMT | Parity | Evidence / boundary |
|---|---|---|---|---|
| `v2local` source SHA | OTA manifest has `sourceSha` | `/__mfk/build` has `sourceSha` | **UNKNOWN** | The identity mechanisms are now comparable, but no current Physical manifest plus live Public response was captured in this repository audit. Do not infer deployment equality from the common source tree. |
| Admin config fetch | Direct canonical `GET /api/admin-sync/active` | Same request through bounded `/__mfk/admin` proxy | **SAME** | Both consume the canonical envelope and run the same validation/application path. |
| Admin WebSocket | Direct canonical `/api/admin-sync/events` | Web Worker proxy to the same canonical endpoint | **SAME** | The outer Admin Worker now returns the DO upgrade response unchanged; Public proxy already returns its upstream response unchanged. Live no-refresh gates remain to be run after deployment. |
| local LKG | Browser/WebView local storage | Browser local storage | **SAME** | Both run `admin-config-sync.ts`, including validation, atomic application and LKG readback. |
| device identity | Registered production SMT device identity | No production device registration | **INTENTIONAL_STUB** | Public acceptance deliberately has no production device identity. |
| ACK | Canonical device ACK | `WEB_ACCEPTANCE_ACK_SKIPPED` | **INTENTIONAL_STUB** | Public mode explicitly refuses to impersonate a production device. |
| SMM intake | Trusted physical/LAN intake | Token-bound acceptance pending/ack/projection seam | **INTENTIONAL_STUB** | Public uses the dedicated Web Acceptance intake, not the production LAN authority. |
| Customer bridge | Installed | Not installed | **INTENTIONAL_STUB** | Disabled by the Web Acceptance bootstrap guard. |
| Keeta intake | Installed | Not installed | **INTENTIONAL_STUB** | Disabled by the Web Acceptance bootstrap guard. |
| lifecycle | Installed | Not installed | **INTENTIONAL_STUB** | Keeta lifecycle is deliberately disabled in Public mode. |
| after-sales | Installed | Not installed | **INTENTIONAL_STUB** | Keeta after-sales is deliberately disabled in Public mode. |
| projection outbox | Installed and flushed | Not installed | **INTENTIONAL_STUB** | Public must not project acceptance transactions into production. |
| print | Native/LAN print routes available under physical policy | No physical print authority | **INTENTIONAL_STUB** | Public health declares `physicalPrint: false`; a live hardware negative test was not performed. |
| cash drawer | Physical carrier capability | No cash-drawer authority | **INTENTIONAL_STUB** | Public health declares `cashDrawer: false`; it must not perform physical mutation. |
| native bridge | Android carrier bridge | Ordinary browser only | **INTENTIONAL_STUB** | Public has no Android native carrier. |

No audited item was classified `UNINTENTIONAL_DRIFT`. That does not turn either deployment-level `UNKNOWN` into a pass.

## Acceptance gates still requiring deployed evidence

1. Publish one Admin configuration and record its revision/fingerprint.
2. Keep Public SMT open; without refresh, observe `ADMIN_CONFIG_AVAILABLE` and automatic LKG application.
3. Keep Physical SMT open; without restarting the app, observe the same revision/fingerprint application.
4. Compare Public `/__mfk/build.sourceSha` with Physical OTA manifest `sourceSha` (and retain `buildId`/`deployedAt`).
5. Confirm Physical SMT remains the only production transaction authority.
6. Confirm Public SMT produces no physical print, cash drawer action, or real provider mutation.

Until those observations are attached, deployment parity and the complete six-point gate are **UNKNOWN**, not accepted.
