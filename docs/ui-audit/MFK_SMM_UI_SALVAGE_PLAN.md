# MFK SMM UI Salvage Plan

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC / PLANNING`  
PORT: `SMM`  
SOURCE_REFERENCES: `MFK_SMM_UI_FORENSIC_AUDIT.md`; historical UI material is reference evidence only; Figma remains `UNKNOWN`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Status: `PLANNED / NOT AUTHORIZED FOR IMPLEMENTATION`  
Product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`

## Target decisions

| AREA | OLD | CURRENT | TARGET | WHY | WHAT CHANGES | WHAT MUST NOT CHANGE | RISK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stage 0 | Strong branded access storyboard | Real auth, LAN/Internet probe and recovery | Current behavior + selective old visual | Current is operationally complete | visual hierarchy, spacing, approved art | auth, PIN challenge, bypass restrictions, pairing, offline trust | High |
| Shell / Stage 1 | Five-tab blue/navy order surface | Same nav with real data/states | Mixed | Mostly source-faithful already | consistency and scan polish | destinations, badges, availability, refresh | Medium |
| Stage 2 | Clear progressive configuration | Exact canonical combo/options/validation | Mixed | Old hierarchy helps; current contract is stronger | step presentation and summaries | combo IDs, validation, pricing projection | High |
| Stage 3 | Clean draft/cart summary | Durable cart plus line-scoped repair | Mixed | Preserve repair while reducing density | cart line hierarchy and attention cards | accepted line facts, persistence, repair semantics | High |
| Stage 4 | Clear final review | Service/tender/dining target validation | Mixed | Improve final review only | grouping, review emphasis | no payment execution; no table mutation | High |
| Stage 5 | Full result family | Stable submit/readback implementation | Current | Current is already the safest/evidence-backed target | asset/tokens only if proven | submission identity, lock, readback, no resend | Critical |
| Stage 6 | Queue/action concept | Real ACCEPT/READY via SMT plus disabled other actions | Current pending review | Runtime behavior outranks old concept | presentation only after contract review | command set, permissions, canonical refresh | Critical |
| Stage 7 | Order management board | Rich read-only list/history/detail | Current | Current already exceeds old coverage safely | light hierarchy polish | no mutation | Medium |
| Stage 8 | Corrected dining board | Rich read-only projection and normal order-entry handoff | Current | Current matches corrected intent | light visual polish | no checkout/clear/table mutation | High |
| Stage 9 | Conceptual More hub | Expanded read/review operational tools | Mixed | Preserve current capability | card grouping and status readability | no new sellability/refund/print actions | Medium |
| Stage X | Seven state visual system | Seven semantic states | Current behavior + visual normalization | Semantics are already correct | shared spacing/art/tone | state separation and callbacks | High |

## Three-level separation

### Level A — visual only

Approved asset placement, typography, spacing, colour, borders, icons, cards, touch geometry, and responsive layout.

### Level B — UX structure

Progressive configuration summaries, cart attention hierarchy, checkout review grouping, More grouping, and shared-state placement. Primary five-tab navigation stays fixed.

### Level C — product behavior

Staff authentication, runtime path selection, order submit, stable identity, fulfillment command availability, permissions, dining/table mutation, payment, printing, sellability, and retry/readback behavior. Every Level C proposal is `AUDIT → PRODUCT REVIEW ISSUE → OWNER DECISION`.

## Planned UI stages

All `SMM-UI-*` stages have `PRODUCT_BEHAVIOR_IMPACT: NONE` and `IMPLEMENTATION STATUS: HOLD`.

| ORDER | STAGE | TITLE | LEVEL | SCOPE | DEPENDENCY | PROPOSED ACCEPTANCE |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | SMM-UI-01 | Stage 0 access, staff login and connection recovery | A | Splash/login/probe/recovery presentation | none | Same gate/auth/pairing/offline rules; 360×780 + 440×956; loading/error/offline |
| 2 | SMM-UI-02 | App shell, five-tab navigation and order browse | A/B | Header/nav/search/category/product grid | SMM-UI-01 | Same destinations/data/sold-out behavior; normal/loading/empty/error/offline/stale |
| 3 | SMM-UI-03 | Product configuration hierarchy | A/B | ProductSheet progressive configuration | SMM-UI-02 | Same exact IDs, combo/required/min/max validation and add semantics |
| 4 | SMM-UI-04 | Cart and line-repair presentation | A/B | CartSheet cart mode | SMM-UI-03 | Same local workspace and line-scoped attention/repair; no silent price acceptance |
| 5 | SMM-UI-05 | Checkout review presentation | A/B | CartSheet checkout mode | SMM-UI-04 | Same service/tender/dining target validation; no payment/dining mutation |
| 6 | SMM-UI-06 | Submit certainty and result states | A | Stage 5 visual family | SMM-UI-05 | Same identity/lock/readback/no-resubmit; DRAFT/PENDING/CONFIRMED/REJECTED/UNKNOWN remain distinct |
| 7 | SMM-UI-07 | Work Queue hierarchy | A/B | Stage 6 list/detail/action presentation | SMM-UI-06 and SMM-PRODUCT-01 decision | Same allowed commands/readback/permissions; unsupported actions remain disabled |
| 8 | SMM-UI-08 | Orders, history and search | A/B | Stage 7 list/search/detail/status | SMM-UI-07 | Read-only; same filters and projected fields; no UUID/internal ID |
| 9 | SMM-UI-09 | Dining overview and waiting flow | A/B | Stage 8 overview/detail/waiting/clear review | SMM-UI-08 | Same normal order handoff; checkout/clear mutations remain disabled |
| 10 | SMM-UI-10 | More operational hub | A/B | Stage 9 cards and read/review tools | SMM-UI-09 | Current tool set retained; no new operation |
| 11 | SMM-UI-11 | Shared states, responsive and accessibility pass | A | Stage X and cross-screen consistency | SMM-UI-10 | Seven states remain separate; 360/440, touch/focus/reduced-motion pass |

## Product Review hold

| ISSUE | DECISION REQUIRED | CURRENT CONFLICT | EXIT CRITERIA |
| --- | --- | --- | --- |
| SMM-PRODUCT-01 | Canonical Stage 6 fulfillment and permission contract | Runtime/tests permit `ACCEPT` and `READY`; capability registry says `FULFILLMENT_COMMAND: NOT_WIRED`; staff role is not a complete frontend grant matrix | Owner names allowed commands, roles, canonical endpoint/readback, registry wording, UI disabled states, and acceptance evidence |

No `SMM-UI-07` implementation may start until that review is resolved. The other UI stages still require their own individual Owner promotion.

## Release discipline after approval

`Accepted Main → one SMM stage branch → one Draft PR → OLD / CURRENT BEFORE / CANDIDATE AFTER at matching viewport → focused tests/build/preview → Owner acceptance → promote/merge/live check/checkpoint or close/revert`.

No stacked multi-stage branch is permitted. This document authorizes no implementation.
