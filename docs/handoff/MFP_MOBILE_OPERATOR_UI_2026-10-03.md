# MFP mobile operator UI candidate

Date: 2026-10-03 UTC
Branch: `feat/MFP-MOBILE-OPERATOR-UI-2026-10-03`
Exact source base and rollback: `8ab09ea09ced7e74787b20953aa91b890237a018`
Mode: local PREPARE only. No push, PR, deploy, merge, OTA, native activation or physical acceptance.

## Owner direction and scope

The Owner requested Shopify-style POS ordering with restaurant-specific customization, no Home or independent Cart page, and five operator destinations: 待處理 / 點單 / 訂單 / 堂食 / 設定. Both supplied reference-image pixels were inspected: preserve the desktop product-grid/right-summary functional structure; use the mobile reference's blue/purple-white rounded visual treatment without copying its customer-home hero, navigation, offers, products or prices.

This is an existing UI presentation/navigation repair. It does not bind the public static browser to production, authorize transactions, import reference-menu data, or introduce a fallback catalog.

## Changes

- Five readable Traditional Chinese operator routes. Availability/capacity remains accessible from settings. No Home or independent Cart route.
- Mobile selected items remain inside ordering via a native expandable summary. The product catalog remains mounted; the existing draft domain, customization, held draft and checkout handlers are reused.
- Pad retains its product grid and right-side order summary.
- Operator copy for ordering, orders, dining, pending and settings is localized; a misleading draft-line-count-derived display number is removed.
- Unbound menu, pending, Orders/Dining/Availability states explain the limitation and route to the existing connection diagnostics. Real read retries are preserved where available. Raw codes are in expandable details.
- Unbound Reports and Day Close tools are visibly disabled with a reason, rather than enabled no-ops.
- Mobile navigation text is 16px; frequent controls are 48–54px or larger. A single safe-area-aware main navigation, in-context summary, and higher editor layer replace the competing ordering nav.
- One mounted external coordinator is retained. Hiding its UI does not create a new lifecycle, authority, retry loop or business polling.

## Verification

- Baseline: 1,251 tests across 36 files passed.
- New/updated UI expectations were observed failing before implementation: six navigation/summary/unavailable tests, five operator/recovery tests, then four operator-copy tests.
- Candidate: all 1,256 tests across 37 files passed; TypeScript check passed; Vite build passed.
- Vite retains its non-fatal >500kB chunk warning. The shell also emits an environment-level npm http-proxy warning; no dependency change was made.
- Independent source review identified a nested Hold/Dining modal stacking issue. Corrected by raising the summary only when it contains the viewport-fixed destination dialog. Reviewer confirmed no remaining source findings and independently reran all tests/typecheck/whitespace checks.
- Governance self-tests: 13 passed. Existing V3 source/authority guard tests: 48 passed.
- Actual candidate shadow decision remains `HARD_BLOCK`: the current classifier maps `v3smt/**` as UNMAPPED and requests impact review. The manifest is candidate-owned, exact base matches, and no changed path is undeclared. Passing software tests do not override that governance result.
- Real current public-site evidence was captured before changes and confirmed disconnected menu/orders/pending state and the Reports no-op. Those old screenshots are not candidate visual evidence.

## Rendered acceptance limitation

Post-edit visual acceptance is NOT complete. The supported cloud-browser interface has no viewport/emulation API. A local 384/430 CSS-width iframe harness was prepared against the real unbound runtime, but CUA navigation to `http://127.0.0.1:4179/qa-responsive.html` returned `net::ERR_BLOCKED_BY_CLIENT`. No alternate browser, bypass, public deployment or fake operational dataset was used. The temporary harness is excluded from this candidate.

Consequently, no post-edit screenshot, iPhone simulation, mobile/editor interaction pass, safe-area device pass, visual-reference match, or operational/backend acceptance is claimed. Source and SSR tests cannot establish these results.

Required next visual checks when a supported preview route is available: 384/430 CSS-width ordering and each nav destination; long product names and actual published data; expandable summary; product/option/combo editor; Hold/Dining overlay above navigation; portrait scrolling, text zoom and keyboard; native safe areas; desktop grid/right-summary preservation; settings disabled tools and real recovery controls. Use the intended runtime's actual menu and canonical readbacks before operational acceptance.

## Authority and promotion limits

Store Kernel remains the only formal business authority. Security, Pricing, Tender, Sync, Orders, Checkout, Print and provider production bindings remain separately blocked. No security, money, checkout state-machine, schema, native or provider contracts were changed. UI tests are not live order/payment acceptance. Existing deployed `34cd87ae` is unchanged. Explicit Owner PROMOTE is required for any later publication, and does not erase unverified visual or production-binding gates.
