# MFK Regression Matrix

Inventory base: `6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a`

Status vocabulary: `EXISTING_TEST`, `MISSING_TEST`, `LIVE_ONLY`, `PHYSICAL_ONLY`, `NOT_APPLICABLE`

## Existing workflow and CI inventory

The exact base contains 33 workflows. The governance layer reuses their package commands and focused tests; it does not invoke deploy or create a second delivery path.

| Kind | Existing workflows |
|---|---|
| PR-aware port/cross-port checks | `admin-canonical-readback-r1`, `admin-crossport-integration-gate`, `admin-identity-canonical-r1`, `customer-stage2-main-landing-r1`, `customer-ui4-cart-checkout-r1`, `customer-ui5-submit-wait-r1`, `owner-hosting-r1-smoke`, `owner-runtime-connection-r2`, `owner-stage03-main-landing-r1`, `smm-stage2-main-landing-r1`, `smt-consolidation-a3-r1`, `smt-consolidation-a3b-r1` |
| Candidate/landing/manual smoke | `admin-connect-a1-menu-index-landing-smoke`, `admin-connect-a2-controlled-transfer-landing-smoke`, `admin-hosting-h1-landing-smoke`, `admin-hosting-h2-landing-smoke`, `customer-ui3-combo-configure-r1`, `keeta-landing-smoke`, `keeta-runtime-simplicity-guard-landing-smoke`, `smm-stage4-checkout-r1`, `v2admin-landing-smoke`, `v2admin-workflow-upgrade-landing-smoke`, `v2customer-essential-upgrade-landing-smoke`, `v2customer-landing-smoke`, `v2owner-command-center-upgrade-landing-smoke`, `v2owner-landing-smoke`, `v2smm-assistive-upgrade-landing-smoke`, `v2smm-landing-smoke` |
| Main/deployment surfaces, unchanged | `deploy-mfk-admin`, `deploy-mfk-owner`, `mfk-domain-cutover`, `v2local-smoke`, `combo-crossport-integration-r1` |

Existing package entry points:

- Admin and SMT: `vitest run` + Vite build.
- SMM, Customer, Owner: Node test files + TypeScript/Vite build.
- Keeta: Node contract tests + source import build.
- No package manager, dependency, Node contract, action major, deploy command, or production trigger is changed by this Candidate.

`COMMANDER_CURRENT.md` names `.github/workflows/mfk-carrier-ota.yml` as the canonical Builder release path, but that file is not present at this exact source base. This matrix records OTA publication as external `LIVE_ONLY` evidence and does not recreate or replace that path.

## Critical capability matrix

| Area | Capability | Status | Existing evidence / boundary |
|---|---|---|---|
| ADMIN | Canonical publish | EXISTING_TEST | `admin-canonical-readback-r1.yml`; `admin-config-sync.test.ts`; `admin-menu-link.test.ts` |
| ADMIN | Config readback | EXISTING_TEST | `admin-snapshot-linkup.test.ts`; `admin-config-sync.test.ts` |
| ADMIN | Browser auth | EXISTING_TEST | `admin-canonical-browser.test.ts`; `staff-auth-sync.test.ts` |
| ADMIN | WebSocket transport | EXISTING_TEST | `admin-sync-websocket-transport.test.ts` |
| SMT | Local transaction authority | EXISTING_TEST | `local-operations.test.ts`; `integrated-main-e2e-lock-r1.test.ts` |
| SMT | Config apply | EXISTING_TEST | `admin-config-sync.test.ts`; `admin-menu-transfer.test.ts` |
| SMT | Order identity | EXISTING_TEST | `orders-source-lane.test.ts`; `dining-formal-order-d1.test.ts` |
| SMT | Pricing | EXISTING_TEST | `smt-owner-price-override-a1.test.ts`; `customer-combo-ordering-r1.test.ts` |
| SMT | Sellability | EXISTING_TEST | Capacity-pool runtime tests plus `owner-sellability-r1.test.ts` |
| SMT | Printing | EXISTING_TEST | `print-routing.test.ts`; `print-content.test.ts`; `printer-encoding.test.ts` |
| SMT | Printed paper/device output | PHYSICAL_ONLY | Existing software tests cannot prove cable, printer, paper, or drawer behavior |
| SMT | Dining | EXISTING_TEST | D1–D16 runtime/presentation tests and checkout/ordering UI-session tests |
| SMT | Local LKG | EXISTING_TEST | `admin-config-sync.test.ts`; `admin-menu-link.test.ts`; `admin-menu-transfer.test.ts` |
| SMM | Snapshot | EXISTING_TEST | `migration.test.mjs`; `smm-lan-ingress.test.ts` |
| SMM | Order submit | EXISTING_TEST | `stage5-submit.test.mjs`; SMT SMM intake tests |
| SMM | Fulfillment ACCEPT | EXISTING_TEST | `stage6-queue.test.mjs`; `smm-web-acceptance-intake.test.ts` |
| SMM | Fulfillment READY | EXISTING_TEST | `stage7-orders.test.mjs`; `smm-web-acceptance-intake.test.ts` |
| SMM | LAN | EXISTING_TEST | `dual-path-pwa.test.mjs`; `smm-lan-ingress.test.ts` |
| SMM | Internet fallback | EXISTING_TEST | `dual-path-pwa.test.mjs`; `migration.test.mjs` |
| SMM | Request-storm containment | MISSING_TEST | Not present on exact base; Draft #525 is not treated as current authority |
| SMM | Realtime device acceptance | LIVE_ONLY | Transport/source evidence is not a realtime device acceptance claim |
| CUSTOMER | Catalog | EXISTING_TEST | `stage2-menu-r1.test.mjs`; `stage2-fresh-integration-r1.test.mjs` |
| CUSTOMER | Local quote/pricing | EXISTING_TEST | `ui3-configure-r1.test.mjs`; `ui4-cart-checkout-r1.test.mjs`; combo tests |
| CUSTOMER | Submit | EXISTING_TEST | `ui5-submit-wait-r1.test.mjs`; `customer-cloud-intake.test.ts` |
| CUSTOMER | Readback | EXISTING_TEST | `ui5-submit-wait-r1.test.mjs`; `customer-cloud-edge.test.ts` |
| CUSTOMER | History | EXISTING_TEST | `ui8-history-reorder-r1.test.mjs`; Admin history projection test |
| KEETA | OAuth/token | EXISTING_TEST | `completeness.test.js` |
| KEETA | Webhook/signature | EXISTING_TEST | `contract.test.js` |
| KEETA | Mapping | EXISTING_TEST | `channel-mapping.test.js`; Admin projection tests |
| KEETA | One-to-many decomposition | EXISTING_TEST | `channel-mapping.test.js`; `keeta-order-intake.test.ts` |
| KEETA | Option mapping | EXISTING_TEST | `channel-mapping.test.js`; `completeness.test.js` |
| KEETA | Provider money authority boundary | EXISTING_TEST | `contract.test.js`; `completeness.test.js`; `keeta-after-sale.test.ts` |
| KEETA | Manual/auto accept | EXISTING_TEST | `keeta-live-runtime.test.ts`; `keeta-order-intake.test.ts` |
| KEETA | Lifecycle | EXISTING_TEST | `keeta-order-lifecycle.test.ts`; `keeta-after-sale.test.ts` |
| KEETA | Sellability | EXISTING_TEST | `contract.test.js`; Admin/SMT projection tests |
| KEETA | External provider acceptance | LIVE_ONLY | Owner/provider evidence only; CI cannot claim it |
| OWNER | Read-only/governance boundary | EXISTING_TEST | `migration.test.mjs`; `owner-runtime-connection.test.ts` |
| OWNER | Command scope | EXISTING_TEST | `migration.test.mjs`; `owner-sellability-r1.test.ts`; `owner-channel-planning-r1.test.ts` |
| CROSS-PORT | Shared contracts | EXISTING_TEST | Path-triggered Admin/SMM/Customer/SMT workflows; all affected ports selected for `contracts/**` |
| CROSS-PORT | Admin → SMT | EXISTING_TEST | Admin config/menu link/transfer tests |
| CROSS-PORT | SMT → SMM | EXISTING_TEST | SMM LAN ingress, combo revalidation, Web acceptance intake tests |
| CROSS-PORT | Customer → SMT | EXISTING_TEST | Customer cloud intake and combo ordering tests |
| CROSS-PORT | Keeta → SMT | EXISTING_TEST | Keeta intake/lifecycle/after-sale tests |
| PRINT | Routing/content/encoding | EXISTING_TEST | SMT print test files and `v2local-smoke.yml` static checks |
| PRINT | Real printer/paper | PHYSICAL_ONLY | Requires device and paper evidence |
| PAYMENT | Evidence/correction boundaries | EXISTING_TEST | `payment-evidence-whatsapp.test.ts`; `smt-payment-correction-b1.test.ts`; refund tests |
| PAYMENT | External settlement | LIVE_ONLY | Provider/bank readback, not source CI |
| OTA | Runtime/Carrier boundary | EXISTING_TEST | `runtime-carrier-boundary.test.ts`; build-identity test |
| OTA | Package/sign/publish/readback | LIVE_ONLY | Existing Builder/release protocol only; no second OTA path |
| OTA | Install/boot/store acceptance | PHYSICAL_ONLY | Device proof required |
| GOVERNANCE | Destructive schema semantic detection | MISSING_TEST | Manifest declaration is fail-visible; semantic schema parser is not invented in foundation |

## Scoped decision rule

Docs/governance-only changes select only the governance self-test. Product paths select the package and cross-port tests in `MFK_CHANGE_CONTROL.md`. Shared contracts widen to all ports. Candidate-only red is `NEW_REGRESSION`; the same red on base is `KNOWN_RED`. Live and physical rows remain explicit evidence gaps and are never relabeled CI green.
