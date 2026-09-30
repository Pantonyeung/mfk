# MFK Owner UI Forensic Audit

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC`  
PORT: `OWNER`  
SOURCE_REFERENCES: Owner historical UI package, briefs, screenshots, and current code evidence inventoried below; Figma remains `UNKNOWN`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Audit date: 2026-09-30  
Mode: `AUDIT / PLANNING ONLY`  
Port: `OWNER` (`v2owner/**`)  
Canonical product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
Live Main at audit start: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
Live Main delta from product base: one governance-only commit, changing only `COMMANDER_CURRENT.md`.

## 1. Governance and method

- Fresh authority: live `COMMANDER_CURRENT.md` plus the latest controlling comment on issue #22 (`issuecomment-5900892148`). Both lock this audit to `4c8642d4ec84792de88f00163ce99e3005b8354a` and permit audit documents and planned issues only.
- `git diff 4c8642d4ec84792de88f00163ce99e3005b8354a..a9e8be640e5975b93e0a8e5a2f2cc3f18196c047 -- v2owner v2smm v2customer` is empty.
- `docs/control/MFK_CHANGE_CONTROL.md` was read. No product path is changed by this audit.
- Old reference evidence is subordinate to live code and current authority. A visually attractive board is not proof of equivalent behavior.
- Figma source was not supplied: no Figma URL, file key, node URL, or connected document identifier exists in the package. Figma evidence is therefore `UNKNOWN`, not reconstructed.
- Tests were read as evidence; they were not rerun because this audit changes no product code and makes no runtime claim.

## 2. Reference inventory

Package: `MFK_Owner_App_UI_Package_FINAL_V1.0_2026-09-26.zip`  
Archive status: 32 files. The extracted folder has 30 files and omits the two IP JPEGs. `FINAL` in the filename is treated as package metadata, not proof that every screen is implementable.

| FILE | PORT | TYPE | DATE / VERSION | PURPOSE | SCREENS COVERED | FEATURES COVERED | CONFIDENCE | NOTES |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `00_START_HERE/README_START_HERE.md` | OWNER | Markdown | 2026-09-26 | Package entry | All | precedence and package use | High | Read first |
| `00_START_HERE/VISUAL_INDEX.md` | OWNER | Markdown | 2026-09-26 | Visual index | 00–11 | board mapping | High | Index only |
| `00_START_HERE/SUPERSEDED_NOTE.md` | OWNER | Markdown | 2026-09-26 | Rejection notice | superseded set | non-implementation boundary | High | Explicitly excludes wrong-scope work |
| `01_BRAND_ASSETS/IP_Blue_三視圖.jpeg` | OWNER | JPEG | 2026-09-26 | Source IP | onboarding/help | blue mascot | High | Present in ZIP only |
| `01_BRAND_ASSETS/IP_Purple_三視圖.jpeg` | OWNER | JPEG | 2026-09-26 | Source IP | onboarding/help | purple mascot | High | Present in ZIP only |
| `01_BRAND_ASSETS/Logo_磨飯_MoreFun.png` | OWNER | PNG | 2026-09-26 | Brand source | shell/access | logo | High | Visual asset, not authority |
| `02_CURRENT_FINAL_VISUALS/00_Onboarding_Access_Trust_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | access | onboarding, login trust | High | Behavior must remain current auth |
| `02_CURRENT_FINAL_VISUALS/01_Today_Home_LiveOrders_DineIn_V2.png` | OWNER | PNG board | V2, 2026-09-26 | Current old-design proposal | Today | effective sales, live orders, dine-in | High | Estimated unpaid is not sales |
| `02_CURRENT_FINAL_VISUALS/02_Action_Queue_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Actions | incidents, acknowledge, readback | High | Dismiss is not resolve |
| `02_CURRENT_FINAL_VISUALS/03_Order_Oversight_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Orders | read-only order oversight | High | Not POS/order execution |
| `02_CURRENT_FINAL_VISUALS/04_Channel_Health_Control_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Channels | health, pause/resume/snooze concepts | Medium | Some commands are not wired today |
| `02_CURRENT_FINAL_VISUALS/05_Sellability_SoldOut_Restore_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Sellability | sold-out/restore | High | Current command path must be preserved exactly |
| `02_CURRENT_FINAL_VISUALS/06_Staff_Overview_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Staff | roster and status | High | Read-only projection |
| `02_CURRENT_FINAL_VISUALS/07_Device_Printer_Health_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Devices | printer/device health | High | No auto-reprint |
| `02_CURRENT_FINAL_VISUALS/08_Fixed_Reports_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Reports | eight fixed report concepts | Medium | Only current connected ranges may be enabled |
| `02_CURRENT_FINAL_VISUALS/09_Manager_Log_Checklist_Handoff_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Manager tools | log, checklist, handoff | Medium | Canonical shared writer is absent today |
| `02_CURRENT_FINAL_VISUALS/10_Activity_Audit_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | Activity | audit timeline | High | Read-only evidence surface |
| `02_CURRENT_FINAL_VISUALS/11_More_Hub_V1.png` | OWNER | PNG board | V1, 2026-09-26 | Current old-design proposal | More | secondary navigation | High | Old board is not route authority |
| `03_BRIEF_AND_RESEARCH/MFK_Owner_Brief_FINAL_2026-09-26.md` | OWNER | Markdown | FINAL, 2026-09-26 | Product brief | All | WATCH/ALERT/REVIEW/BOUNDED ACT | High | Primary old product reference |
| `03_BRIEF_AND_RESEARCH/Research_Owner_App_External_Capability_2026-09-20.txt` | OWNER | Text | 2026-09-20 | External research | All | market/capability survey | Low | Context only; not MFK authority |
| `04_IMPLEMENTATION_UI_SPEC/MFK_Owner_App_Implementation_UI_Spec_FINAL_V1.0.md` | OWNER | Markdown | FINAL V1.0, 2026-09-26 | UI implementation contract | All | routes, states, visual rules | High | Subordinate to current product evidence |
| `04_IMPLEMENTATION_UI_SPEC/GOOGLE_DRIVE_FINAL_SPEC_LINK.txt` | OWNER | Text link | 2026-09-26 | External pointer | unknown | external spec location | Low | Link alone is not audited content |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/Stage0_PreBrand_Draft.png` | OWNER | PNG draft | superseded | Historical | access | pre-brand concept | High | `OBSOLETE`; do not implement |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/Stage1_Early_Draft.png` | OWNER | PNG draft | superseded | Historical | Today | early hierarchy | Medium | Motifs only; no direct restore |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/Stage2_Early_ActionQueue_Draft.png` | OWNER | PNG draft | superseded | Historical | Actions | early queue | Medium | Superseded by final board |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/Today_Home_Pre_LiveOrders_Update.png` | OWNER | PNG draft | superseded | Historical | Today | pre-live-orders home | Medium | Missing later capability |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/WRONG_Scope_Stage2_SMT_PendingOrders.png` | OWNER | PNG wrong scope | superseded | Rejected | SMT queue | pending-order handling | High | `DROP`; SMM/SMT scope |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/WRONG_Scope_Stage3_PendingOrderHandling_A.png` | OWNER | PNG wrong scope | superseded | Rejected | SMT order actions | order handling | High | `DROP` |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/WRONG_Scope_Stage3_PendingOrderHandling_B.png` | OWNER | PNG wrong scope | superseded | Rejected | SMT order actions | order handling | High | `DROP` |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/WRONG_Scope_Stage3_PendingOrderHandling_C.png` | OWNER | PNG wrong scope | superseded | Rejected | SMT order actions | order handling | High | `DROP` |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/WRONG_Scope_Stage4_POS_OrderEntry.png` | OWNER | PNG wrong scope | superseded | Rejected | POS | order entry | High | `DROP`; Owner is not POS |
| `99_SUPERSEDED_REFERENCE_DO_NOT_IMPLEMENT/WRONG_Scope_Stage4_SMT_ProductionFlow.png` | OWNER | PNG wrong scope | superseded | Rejected | SMT production | fulfillment flow | High | `DROP`; Owner is not SMT |

## 3. Current implementation audit

### Navigation and routing

- `v2owner/src/App.tsx` owns four primary views: `today`, `queue`, `orders`, `more`.
- Primary paths are `/today`, `/actions`, `/orders`, `/more`.
- Secondary paths are `/channels`, `/planning`, `/sellability`, `/staff`, `/devices`, `/reports`, `/manager-log`, `/checklist`, `/handoff`, `/activity`, and `/settings-summary`.
- Browser history and `popstate` are handled in the application. Current route behavior is product behavior and is not a visual salvage target.

### Components and presentation

- Today is composed through `today-components.tsx` and `today-view-model.ts`.
- Action Queue is in `stage02-action-queue.tsx` with explicit mapping/view-model helpers.
- Order Oversight is in `stage03-order-oversight.tsx` with explicit mapping/view-model helpers.
- Channel, planning, sellability, staff, and final-source screens are separate modules; the shell and remaining surfaces are composed in `App.tsx`.
- `styles.css` is mobile-first, contains fixed bottom navigation and breakpoints at the small-phone range. Source-fidelity selectors already reproduce substantial parts of the supplied visual system.

### Product types, runtime, persistence, and authority

- `product-types.ts` separates projections, command results, and freshness states.
- `runtime.ts` resolves the Owner runtime boundary; `cloud-runtime.ts` talks to the fixed Admin endpoint for store `MF01`.
- Snapshot refresh occurs on an interval while visible and on focus/visibility events. Command flows use readback and retain `UNKNOWN` rather than inferring success.
- `persistence.ts` stores only `mfk:owner:workspace:v1` with `LOCAL_NON_AUTHORITATIVE` workspace data (view/category plus local notes/checklist state). It is not reporting, transaction, or manager-log authority.
- Sellability has a connected bounded command surface. Channel actions remain disabled except safe recheck/readback. Planning has current canonical read/save behavior and is a current-only capability.
- Effective Sales remains the source for Today sales; unpaid estimates are not promoted to sales.

### Loading, empty, error, offline, stale, and permissions

- Current states distinguish `LOADING`, `EMPTY`, `STALE`, `PARTIAL`, `OFFLINE_READONLY`, `PERMISSION_DENIED`, `ERROR`, and `UNKNOWN` in types/runtime/presentation.
- Owner login uses a Staff ID plus 4–8 digit PIN challenge and stores a trusted session in `mfk.owner.session.v1`.
- A session carries permissions, but the UI does not consistently present permission-specific control visibility. Backend enforcement must remain the authority. A UI stage must not invent a permission matrix.
- Manager log/checklist/handoff deliberately show honest unconnected/disabled states rather than treating local notes as a canonical shared record.

### Tests read

- `migration.test.mjs`: runtime/authority/persistence boundaries.
- `final-visual-system-p0.test.mjs`: final visual contract and route/state expectations.
- `source-fidelity-wave2.test.mjs`, `wave2-render-evidence.test.mjs`, `visual-evidence.mjs`: source mapping and render evidence.
- `hosting-r1.test.mjs`: host/build identity.
- These are source evidence, not a new live, device, or physical acceptance result.

## 4. OLD vs CURRENT vs TARGET matrix

| SCREEN / CAPABILITY | OLD REFERENCE | CURRENT IMPLEMENTATION | FUNCTIONAL DIFFERENCE | VISUAL DIFFERENCE | INFORMATION ARCHITECTURE DIFFERENCE | OLD-ONLY IDEA | CURRENT-ONLY CAPABILITY | AUTHORITY / PRODUCT RISK | EVIDENCE | CLASSIFICATION |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Access / trust | Brand-first onboarding and trust board | Real Owner PIN challenge/session gate | Current has real auth; old is mostly presentation | Old has richer branded explanation | Current enters the four-tab shell directly | onboarding story | trusted session and live challenge | Do not change auth/permissions | old board 00; `App.tsx`, `staff-identity.ts` | RESTORE VISUAL IDEA |
| Today | Five-second command centre with sales/live/dine/action/health | Effective Sales, live orders, dine-in, actions, channel/staff insights | Current is connected and state-aware | Old card hierarchy is calmer and more explicit | Same primary destination | stronger grouping and callout rhythm | richer live projections and stale/error handling | Never turn unpaid/all-time values into sales | board 01; `today-*` | RESTORE UX IDEA |
| Action Queue | Incident cards with severity and next action | Canonical queue with acknowledge/readback semantics | Current defines real state transitions | Old severity/action scan is clearer | Same `/actions` route | stronger triage hierarchy | explicit view-model/readback handling | Dismiss must not mean resolved | board 02; `stage02-*` | RESTORE UX IDEA |
| Order Oversight | Read-only oversight and detail regions | Read-only current/history oversight | Current data contract is richer | Old board gives stronger seven-region detail hierarchy | Same `/orders` route | detail anatomy | canonical source/status/freshness | No order mutation or routing change | board 03; `stage03-*` | RESTORE UX IDEA |
| Channel Health | Health and bounded control concepts | Read-only health; unsupported controls disabled; recheck available | Several old commands are absent | Old board has more command affordance | Current secondary route under More | pause/resume/snooze UI | safe readback state | Enabling a disabled command is Level C | board 04; `channel-health.tsx` | RESTORE VISUAL IDEA |
| Planning | Not part of locked old screen set | Current canonical read/save planning surface | Current-only product capability | No final old visual | New secondary route | none | planning | Placement and canonical sales basis need Owner decision | `planning.tsx`, `owner-authority.ts` | NEEDS OWNER DECISION |
| Sellability | Sold-out/restore cards | Connected sellability read/command | Current has real command/result handling | Old card/status hierarchy is more legible | Same secondary surface | richer explanatory cards | runtime mutation and readback | Styling must not change command, API, or semantics | board 05; `sellability.tsx` | RESTORE VISUAL IDEA |
| Staff | Roster/availability overview | Read-only staff overview | Broadly equivalent | Old visual grouping is richer | Same secondary surface | richer visual identity | current canonical projection | Do not infer attendance/permission truth | board 06; `staff-overview.tsx` | RESTORE VISUAL IDEA |
| Devices / printers | Health cards, no auto-reprint | Read-only device/printer status | Broadly equivalent | Old health cards are more scannable | Same secondary surface | branded device cards | explicit degraded states | Never add reprint/probe command | board 07; source-fidelity screen | RESTORE VISUAL IDEA |
| Reports | Eight fixed report concepts | Today connected; other ranges/actions disabled | Old coverage exceeds connected current data | Old report taxonomy is clearer | Same `/reports`; current is narrower | full fixed report set | honest unavailable states | Do not fabricate reporting periods or totals | board 08; source-fidelity screen | NEEDS OWNER DECISION |
| Manager log / checklist / handoff | Shared operational workflows | Honest unconnected placeholders; local workspace is non-authoritative | Old assumes canonical writer/workflow | Old boards look complete | Three current routes exist but are not product-complete | shared writer/workflow | fail-closed disabled state | Writer, audit, permission and sync contracts absent | board 09; `persistence.ts`, `App.tsx` | NEEDS OWNER DECISION |
| Activity / audit | Timeline of actions and actors | Read-only activity surface | Current depends on projected evidence | Old timeline anatomy is clearer | Same secondary route | richer event grouping | current state/freshness handling | Do not fabricate actors or resolution | board 10; source-fidelity screen | RESTORE VISUAL IDEA |
| More hub | Grouped secondary destinations | Current hub includes all secondary/current-only routes | Current has more destinations | Old grouping is more compact | Same primary tab; current route set is larger | concise grouping | planning/settings summary | Hiding current-only capability would regress product | board 11; `App.tsx` | RESTORE UX IDEA |
| Responsive / shared states | Mobile storyboard intent | Real breakpoints and distinct state contract | Current is more complete | Old uses more consistent spacing/brand art | Global rather than a screen | visual polish | `PARTIAL`, permission, offline/readback states | Must preserve state semantics | spec; `styles.css`, types | KEEP CURRENT |
| Wrong-scope POS/SMT drafts | Owner performs order/production work | Not present | Correctly excluded | Irrelevant | Wrong product IA | POS/SMT execution | none | Direct authority violation | superseded folder | DROP |

## 5. Screen map

| OLD SCREEN | CURRENT EQUIVALENT | MAP | TARGET DECISION |
| --- | --- | --- | --- |
| Onboarding / Access / Trust | Owner login + app shell | MERGED | Keep current authentication; salvage only trust hierarchy and approved brand treatment |
| Today Home | `/today` Command Center | SAME | Keep current capability and Effective Sales; salvage old card hierarchy |
| Action Queue | `/actions` | SAME | Keep readback behavior; salvage triage hierarchy |
| Order Oversight | `/orders` | SAME | Keep read-only behavior; restore clearer detail grouping |
| Channel Health | `/channels` | SAME | Preserve disabled/unavailable controls; salvage status cards |
| Planning | `/planning` | NEW | Keep in current state pending Owner placement decision |
| Sellability | `/sellability` | SAME | Preserve exact command seam; visual-only salvage |
| Staff Overview | `/staff` | SAME | Visual-only salvage |
| Device / Printer Health | `/devices` | SAME | Visual-only salvage; no reprint |
| Fixed Reports | `/reports` | SAME | Keep connected scope; do not enable old-only reports |
| Manager Log | `/manager-log` | SAME | Keep honest unavailable state; product review required for writer |
| Checklist | `/checklist` | SAME | Keep honest unavailable state; product review required for writer |
| Handoff | `/handoff` | SAME | Keep honest unavailable state; product review required for writer |
| Activity / Audit | `/activity` | SAME | Keep read-only evidence; salvage timeline hierarchy |
| More Hub | `/more` | SAME | Preserve current destinations; regroup visually |
| Settings summary | `/settings-summary` | NEW | Keep current read-only summary |
| SMT pending/order handling | none | OBSOLETE | Drop |
| POS order entry / production flow | none | OBSOLETE | Drop |

## 6. Audit conclusion

- Current Owner behavior is the preservation baseline.
- The old package is strongest as a source for typography, spacing, card hierarchy, status emphasis, and More-screen grouping.
- Old command affordances must not be restored where the current runtime is disabled or read-only.
- Planning, permission-specific UI, reports beyond connected facts, and canonical manager workflows require explicit Product Review; they are not normal UI stages.
- No product code, CSS, component, implementation branch, PR, merge, deploy, or OTA was produced by this audit.
