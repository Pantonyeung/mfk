# MFK Customer UI Salvage Plan

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC / PLANNING`  
PORT: `CUSTOMER`  
SOURCE_REFERENCES: `MFK_CUSTOMER_UI_FORENSIC_AUDIT.md`; historical UI material is reference evidence only; Figma remains `UNKNOWN`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Status: `PLANNED / NOT AUTHORIZED FOR IMPLEMENTATION`  
Product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`

## Target rule

Customer Target UI keeps the current complete journey, runtime certainty, and authority seams. It selectively restores the old navy/orange/warm visual language and clearer story hierarchy only where it does not change product behavior.

| AREA | OLD | CURRENT | TARGET | WHY | WHAT CHANGES | WHAT MUST NOT CHANGE | RISK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shell / nav | Unified navy/orange/warm system | Correct five-nav with mixed current styling | Mixed | Preserve IA while reducing visual inconsistency | tokens, icons, active state, spacing | labels/order/routes/cart continuity/badges | Medium |
| Launch | Rich mascot/food storyboard | Implemented first/returning/reduced-motion overlay | Current behavior + selected art | Current is safe and complete | approved asset/timing polish only | two CTAs, session choice, non-blocking data, reduced motion | Medium |
| Home | Brand storefront and Top 6 | Rich store/order context and recommendations | Mixed | Current behavior is stronger; old brand hierarchy is clearer | hero/announcement/shortcut/card hierarchy | store status, active order, closed-store rules, recommendations | High |
| Browse | Featured + small product cards | Implemented source-oriented browse/search | Current | Already aligned with old contract | only isolated consistency fixes | menu data, sold-out, search, canonical images | Medium |
| Configure | Continuous detail story | Exact-ID progressive sheet | Current behavior + selective UX | Canonical correctness outranks storyboard | step summaries and visual hierarchy | combo IDs, validation, quote/availability fields | High |
| Memory Jar | Branded four-step control centre | Split Jar with line repair | Mixed | Retain exact repair behavior | line/card hierarchy and cohesive step styling | local non-authoritative data, identity, repair, evidence invalidation | High |
| Checkout/payment | Clear contact/payment/review story | Split routes and live proof upload | Mixed | Presentation can be clearer | stepper/grouping/copy hierarchy | channel facts, proof semantics, submit boundary | Critical |
| Submit/wait | Branded certainty/wait states | Safe stable-intent/readback flow | Current | Transaction certainty is already strongest | art/spacing only | identity, lock, readback, no background retry | Critical |
| Fulfillment/pickup | Mascot-led timeline and identity panels | Canonical read-only projection | Mixed | Old storytelling can improve comprehension | timeline/identity hierarchy | state mapping and no Customer completion mutation | Critical |
| History/reorder | Clear immutable history and repair | Implemented copy-intent/current revalidation | Current | Current is functionally complete | light visual alignment | new cart identity, current validation, line repair | High |
| Member/account | Full relationship/recovery vision | Honest projections and disabled credential mutation | Current until Product Review | Old product scope exceeds proven connections | visual organization and disabled explanation only | no local loyalty, credential, coupon, or consent authority | Critical |
| States/responsive | 390/token/accessibility specification | 360/390/412 evidence and robust states | Mixed | Normalize across screens without redesigning behavior | shared tokens/focus/touch/state layout | semantic distinctions and callbacks | Medium |

## Three-level separation

### Level A — visual only

Tokens, typography, spacing, colour, borders, approved assets, icon treatment, cards, touch geometry, responsive layout, and reduced-motion presentation.

### Level B — UX structure

Home section hierarchy, Product step summaries, Memory Jar/checkout information hierarchy, fulfillment timeline, and Member grouping. Existing route identities and the five-nav order remain current.

### Level C — product behavior

Quote source, coupon selection/redeem/hold/release, member activation/login/reset, favorite/saved-order/preference writes, payment verification, order submission/retry, fulfillment, Customer completion, notification service, and any authority contract. These require Product Review and explicit Owner decision.

## Planned UI stages

All `CUSTOMER-UI-*` stages have `PRODUCT_BEHAVIOR_IMPACT: NONE` and remain `HOLD`.

| ORDER | STAGE | TITLE | LEVEL | SCOPE | DEPENDENCY | PROPOSED ACCEPTANCE |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | CUSTOMER-UI-01 | App shell, design tokens and five-item navigation | A | Shared shell/nav/token consolidation | none | Exact five labels/order/center Jar/routes; cart/order badges preserved; 360/390/412 |
| 2 | CUSTOMER-UI-02 | Launch experience | A | UI0 first/returning/reduced-motion | CUSTOMER-UI-01 | Two CTAs only; non-blocking; asset failure fallback; session character stable |
| 3 | CUSTOMER-UI-03 | Home storefront hierarchy | A/B | UI1 hero/status/announcement/recommendations/shortcuts | CUSTOMER-UI-02 | Same active-order/store/closed behavior; normal/loading/empty/error/offline/stale |
| 4 | CUSTOMER-UI-04 | Menu browse and search consistency | A/B | UI2 category/featured/small/search/zero result | CUSTOMER-UI-03 | Same catalog/sellability/media; sold-out remains visible/disabled |
| 5 | CUSTOMER-UI-05 | Product and combo configuration hierarchy | A/B | UI3 sheet/steps/summary/sticky CTA | CUSTOMER-UI-04 | Exact IDs and validation; no heuristic/pricing authority; add/edit unchanged |
| 6 | CUSTOMER-UI-06 | Memory Jar and line-repair presentation | A/B | Cart list/empty/repair/suggestions | CUSTOMER-UI-05 | Same local workspace, line identity, repair and evidence invalidation |
| 7 | CUSTOMER-UI-07 | Checkout and payment-evidence presentation | A/B | contact/payment/review routes | CUSTOMER-UI-06 | Same pickup code, channel facts, proof upload, fail-closed validation; no payment-confirmed copy |
| 8 | CUSTOMER-UI-08 | Submit and waiting certainty states | A | submit/wait routes and WhatsApp handoff presentation | CUSTOMER-UI-07 | Stable submission, same readback, no resend/background retry; all result states distinct |
| 9 | CUSTOMER-UI-09 | Store fulfillment and pickup tracking | A/B | UI6/UI7 timeline, identity, help | CUSTOMER-UI-08 | Canonical read-only states; Ready/Arrived/Verified/Handover/Complete remain distinct |
| 10 | CUSTOMER-UI-10 | Orders, history and reorder | A/B | UI8 current/history/detail/copy/repair | CUSTOMER-UI-09 | Old order immutable; new cart/current validation; affected-line repair only |
| 11 | CUSTOMER-UI-11 | Member, account and support presentation | A/B | UI9/UI10 projections, disabled auth, PWA/notification, WhatsApp support | CUSTOMER-UI-10 and CUSTOMER-PRODUCT-02 decision | No credential/member/coupon mutation; notification permission remains explicit |
| 12 | CUSTOMER-UI-12 | Cross-screen states, responsive and accessibility pass | A | shared states, focus, touch, reduced motion, tablet/desktop containment | CUSTOMER-UI-11 | All state semantics and product behavior preserved; matching mobile/desktop evidence where supported |

## Product Review holds

| ISSUE | DECISION REQUIRED | WHY THIS IS NOT A UI STAGE | EXIT CRITERIA |
| --- | --- | --- | --- |
| CUSTOMER-PRODUCT-01 | Quote authority and current documentation/capability alignment | `App.tsx` uses locally derived published-menu totals while a canonical quote port exists; repository docs/registry lag the runtime | Owner names canonical display/commit quote contract, permitted local projection, freshness semantics, doc/registry owner, and tests |
| CUSTOMER-PRODUCT-02 | Member/coupon/favorite/saved-order/preference mutation scope | Old product requires commands/lifecycles that current UI partly presents but does not own or connect | Owner names source of truth, commands, consent/permissions, offline policy, audit/recovery semantics, and staged priorities |

UI issues must not resolve these reviews. `CUSTOMER-UI-11` may only improve honest current/disabled presentation until Product Review decisions exist.

## Release discipline after approval

Each promoted stage starts from the latest accepted Main checkpoint and produces one candidate branch, one Draft PR, one preview, and one acceptance set. Required comparison: `OLD REFERENCE / CURRENT BEFORE / CANDIDATE AFTER` at matching viewports, including relevant normal, empty, loading, and error/offline states.

No implementation is authorized by this plan. Stop after audit and planned issue creation.
