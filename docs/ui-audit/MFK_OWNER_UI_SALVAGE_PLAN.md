# MFK Owner UI Salvage Plan

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC / PLANNING`  
PORT: `OWNER`  
SOURCE_REFERENCES: `MFK_OWNER_UI_FORENSIC_AUDIT.md`; historical UI material is reference evidence only; Figma remains `UNKNOWN`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Status: `PLANNED / NOT AUTHORIZED FOR IMPLEMENTATION`  
Product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`

## Target rule

Target Owner UI = current product behavior and authority boundaries + selectively proven old visual/UX ideas. Old images never decide commands, data sources, state semantics, or permissions.

| AREA | OLD | CURRENT | TARGET | WHY | WHAT CHANGES | WHAT MUST NOT CHANGE | RISK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Access / shell | Brand-led trust story | Real PIN challenge, session and four-tab shell | Mixed | Old trust hierarchy helps first use; current auth is real | Logo, typography, explanatory hierarchy, spacing | challenge, session, permissions, routes | Medium |
| Today | Strong visual command-centre cards | Broader connected projections and robust states | Mixed | Current truth with faster scanning | section order, density, card emphasis | Effective Sales definition, APIs, navigation, state mapping | Medium |
| Actions | Clear severity cards | Canonical queue/readback behavior | Mixed | Old hierarchy improves triage | labels, layout, status emphasis | acknowledge/readback semantics; Dismiss ≠ Resolved | High |
| Orders | Strong detail anatomy | Canonical read-only oversight | Mixed | More legible evidence without mutation | information grouping and responsive detail | source, order status, routing, mutations | High |
| Channels | Prominent health/control board | Mostly read-only and disabled actions | Current behavior + old visual | Avoid fake operations | health cards and disabled explanation | enabled state and command availability | High |
| Planning | No locked screen | Current canonical read/save | Current pending decision | It cannot be deleted because old package omitted it | No UI work before Owner decision | planning source/write contract | High |
| Sellability | Clear sold-out/restore cards | Real bounded command with readback | Mixed | Visual improvement is safe only around the existing seam | cards, hierarchy, confirmation copy layout | command payload, API, readback, permission | High |
| Staff / devices | Branded health overviews | Read-only projections | Mixed | Low behavior risk | visual hierarchy and empty/degraded presentation | no inferred attendance, reprint, probe, or repair | Low |
| Reports / activity | Strong fixed taxonomy and timeline | Connected facts plus honest disabled ranges | Mixed | Improve scanning without inventing data | layout, grouping, evidence labels | reporting source, ranges, totals, actor facts | Medium |
| Manager tools | Complete-looking workflows | Honest unconnected placeholders | Current until Product Review | Old requires missing canonical writer/contracts | only improve disabled explanation in UI stage | no local canonical record, no submit/save workflow | High |
| More | Compact grouped hub | More complete current route set | Mixed | Preserve capability while improving discovery | group labels, ordering, cards | route set and current-only entries | Medium |
| Shared states / responsive | Visual examples | Richer real state contract and breakpoints | Current behavior + refined visual | Current is functionally stronger | consistent tokens, focus, spacing, mobile/desktop checks | state semantics and retry/command behavior | Medium |

## Three-level separation

### Level A — visual only

- Typography, spacing, brand colour application, borders, icons, cards, status emphasis, and responsive composition.
- Safe only when event handlers, runtime calls, component inputs, and status mapping remain byte-for-byte equivalent except for presentation wiring.

### Level B — UX structure

- Today section grouping, Action Queue scanning order, Order detail grouping, More hub grouping, and progressive disclosure of secondary detail.
- Route identities and navigation destinations remain current. Any proposed route removal/merge is `NEEDS OWNER DECISION`.

### Level C — product behavior

- Planning placement/authority, new channel commands, report ranges, permission-driven control policy, manager log/checklist/handoff writer, order actions, printing, or any new runtime behavior.
- Result: `AUDIT → PRODUCT REVIEW ISSUE → OWNER DECISION`. No UI implementation issue may contain these changes.

## Planned UI stages

Every stage below has `PRODUCT_BEHAVIOR_IMPACT: NONE` and remains on `HOLD` until individually promoted.

| ORDER | STAGE | TITLE | LEVEL | SCOPE | DEPENDENCY | ACCEPTANCE SUMMARY |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | OWNER-UI-01 | Access, app shell and primary navigation | A/B | Login presentation, header, four tabs, trust copy | none | Same auth/routes/session; mobile + desktop before/after; loading/error/access states |
| 2 | OWNER-UI-02 | Today command-centre hierarchy | A/B | Today cards and section order | OWNER-UI-01 | Same projections and Effective Sales; 5-second scan; normal/loading/empty/stale/offline |
| 3 | OWNER-UI-03 | Action Queue triage presentation | A/B | Queue list/detail/status hierarchy | OWNER-UI-02 | Same queue mapping/actions/readback; no semantic merge of dismiss/resolve |
| 4 | OWNER-UI-04 | Order Oversight information architecture | A/B | List/detail/evidence grouping | OWNER-UI-03 | Read-only behavior unchanged; no new order action |
| 5 | OWNER-UI-05 | Channel Health presentation | A/B | Channel cards and disabled explanations | OWNER-UI-04 | Unsupported controls remain disabled; only safe recheck remains enabled |
| 6 | OWNER-UI-06 | Sellability command presentation | A | Existing sold-out/restore surface | OWNER-UI-05 | Same payload/API/confirmation/readback; UNKNOWN remains locked |
| 7 | OWNER-UI-07 | Staff and device health surfaces | A/B | Read-only staff/device hierarchy | OWNER-UI-06 | No attendance, device, print, or reprint mutation |
| 8 | OWNER-UI-08 | Reports and activity evidence surfaces | A/B | Connected reports and read-only audit timeline | OWNER-UI-07 | No invented range/total/actor; unavailable remains explained |
| 9 | OWNER-UI-09 | More hub and manager-tool placeholders | A/B | More grouping plus honest unconnected screens | OWNER-UI-08 | Current routes preserved; no manager writer/workflow |
| 10 | OWNER-UI-10 | Cross-screen responsive, state and accessibility pass | A | Breakpoints, focus, touch targets, state consistency | OWNER-UI-09 | All current behavior and state distinctions preserved |

## Product Review holds

| ISSUE | DECISION REQUIRED | WHY THIS IS NOT A UI STAGE | EXIT CRITERIA |
| --- | --- | --- | --- |
| OWNER-PRODUCT-01 | Planning placement and canonical sales/planning contract | May change authority and information architecture | Owner names canonical fields/source, allowed writes, placement, permissions, and acceptance |
| OWNER-PRODUCT-02 | Manager log/checklist/handoff and permission policy | Requires shared writer, audit, sync and permission semantics | Owner approves data owner, commands, conflict model, audit fields, permission matrix, and fail-closed states |

## Stage contract template

Each approved stage must follow:

`Accepted Main M(n) → one candidate branch → one Draft PR → OLD / CURRENT BEFORE / CANDIDATE AFTER → focused tests/build/preview → Owner review → PROMOTE or close/revert → merge → live check → checkpoint M(n+1)`

No later Owner stage may be stacked on an unaccepted candidate. Product behavior remains out of scope for every `OWNER-UI-*` issue.

## Stop state

This plan authorizes no implementation. The next valid action is an explicit Owner instruction in the form `PROMOTE ISSUE OWNER-UI-xx TO PREPARE` (or a Product Review decision), one issue at a time.
