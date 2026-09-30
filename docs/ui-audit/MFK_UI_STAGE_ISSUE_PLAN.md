# MFK UI Stage Issue Plan

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC / PLANNING`  
PORT: `CROSS-PORT`  
SOURCE_REFERENCES: Canonical Owner, SMM, and Customer forensic audits and salvage plans in this directory; GitHub Issues `#531–#568`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Status: `PLANNED / NOT AUTHORIZED FOR IMPLEMENTATION`  
Canonical product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
Recommended review sequence: `OWNER → SMM → CUSTOMER` (soft sequence; no cross-port hard block)

## Global issue gate

Every issue created from this plan carries:

```text
IMPLEMENTATION STATUS: HOLD
OWNER PROMOTE REQUIRED: YES
```

An issue is a work package, not implementation authority. A UI issue must have `PRODUCT_BEHAVIOR_IMPACT: NONE`. Anything else is a Product Review issue and remains decision-only.

## Ordered plan

| ORDER | PORT | ISSUE TITLE | SCOPE | RISK | HARD_DEPENDENCY | PROPOSED ACCEPTANCE |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | OWNER | `OWNER-UI-01 Access, app shell and primary navigation` | Level A/B login presentation, header, four-tab shell | Medium | none | Same auth/session/routes; OLD/CURRENT/AFTER; mobile+desktop; loading/error/access |
| 2 | OWNER | `OWNER-UI-02 Today command-centre hierarchy` | Today sections/cards | Medium | none | Same Effective Sales/projections; normal/loading/empty/stale/offline |
| 3 | OWNER | `OWNER-UI-03 Action Queue triage presentation` | Queue list/detail/status hierarchy | High | none | Same mapping/actions/readback; dismiss never equals resolve |
| 4 | OWNER | `OWNER-UI-04 Order Oversight information architecture` | Read-only list/detail/evidence grouping | High | none | No new order action/routing; current fields and states preserved |
| 5 | OWNER | `OWNER-UI-05 Channel Health presentation` | Health cards and disabled explanations | High | none | Unsupported controls remain disabled; recheck unchanged |
| 6 | OWNER | `OWNER-UI-06 Sellability command presentation` | Existing sold-out/restore screen visual only | High | none | Same handler/payload/API/readback/permission; UNKNOWN locked |
| 7 | OWNER | `OWNER-UI-07 Staff and device health surfaces` | Read-only staff/device hierarchy | Low | none | No attendance/device/print mutation or invented truth |
| 8 | OWNER | `OWNER-UI-08 Reports and activity evidence surfaces` | Connected reports and read-only activity | Medium | none | No invented range/total/actor; unavailable stays explained |
| 9 | OWNER | `OWNER-UI-09 More hub and manager-tool placeholders` | More grouping and honest unconnected manager screens | Medium | none | Routes retained; no local canonical manager workflow |
| 10 | OWNER | `OWNER-UI-10 Responsive, state and accessibility pass` | Cross-screen presentation only | Medium | none | State semantics, focus/touch, mobile+desktop, reduced motion |
| 11 | OWNER REVIEW | `OWNER-PRODUCT-01 Planning placement and authority contract` | Decision record only | High | none | Approved source/fields/writes/placement/permissions or explicit defer |
| 12 | OWNER REVIEW | `OWNER-PRODUCT-02 Manager workflow and permission contract` | Decision record only | Critical | none | Approved writer/audit/sync/permission/fail-closed contract or defer |
| 13 | SMM | `SMM-UI-01 Stage 0 access, staff login and connection recovery` | Visual-only access gate | High | none | Same auth/pairing/offline/bypass; 360×780 + 440×956 |
| 14 | SMM | `SMM-UI-02 App shell, five-tab navigation and order browse` | Shell/nav/search/category/menu cards | Medium | none | Same data/sold-out/destinations; all shared states |
| 15 | SMM | `SMM-UI-03 Product configuration hierarchy` | ProductSheet presentation | High | none | Exact IDs/combo/required/min/max/add semantics unchanged |
| 16 | SMM | `SMM-UI-04 Cart and line-repair presentation` | Cart mode only | High | none | Same local workspace/attention/repair; no silent price acceptance |
| 17 | SMM | `SMM-UI-05 Checkout review presentation` | Checkout mode only | High | none | Same service/tender/table target validation; no payment mutation |
| 18 | SMM | `SMM-UI-06 Submit certainty and result states` | Stage 5 presentation only | Critical | none | Same identity/lock/readback/no-resubmit; five transaction states |
| 19 | SMM REVIEW | `SMM-PRODUCT-01 Stage 6 fulfillment and permission contract` | Decision record only | Critical | none | Reconcile runtime/tests/registry/roles for ACCEPT/READY |
| 20 | SMM | `SMM-UI-07 Work Queue hierarchy` | Stage 6 list/detail/action presentation | Critical | SMM-PRODUCT-01 Owner decision | Exact allowed commands and canonical refresh; others disabled |
| 21 | SMM | `SMM-UI-08 Orders, history and search` | Stage 7 read-only presentation | Medium | none | Same filters/projected fields; no UUID/mutation |
| 22 | SMM | `SMM-UI-09 Dining overview and waiting flow` | Stage 8 presentation | High | none | Same normal-order handoff; checkout/clear mutation disabled |
| 23 | SMM | `SMM-UI-10 More operational hub` | Stage 9 read/review tools | Medium | none | Tool set retained; no new operational command |
| 24 | SMM | `SMM-UI-11 Shared states, responsive and accessibility pass` | Stage X/cross-screen presentation | High | none | Seven states distinct; 360/440; focus/touch/reduced motion |
| 25 | CUSTOMER | `CUSTOMER-UI-01 App shell, design tokens and five-item navigation` | Shared shell/nav/tokens | Medium | none | Exact labels/order/center Jar/routes/badges; 360/390/412 |
| 26 | CUSTOMER | `CUSTOMER-UI-02 Launch experience` | UI0 presentation | Medium | none | Two CTAs; non-blocking; first/returning/reduced motion |
| 27 | CUSTOMER | `CUSTOMER-UI-03 Home storefront hierarchy` | UI1 visual/UX hierarchy | High | none | Same store/active-order/closed behavior and state set |
| 28 | CUSTOMER | `CUSTOMER-UI-04 Menu browse and search consistency` | UI2 browse/search/zero-result | Medium | none | Same catalog/sellability/media; sold-out disabled |
| 29 | CUSTOMER | `CUSTOMER-UI-05 Product and combo configuration hierarchy` | UI3 ProductSheet | High | none | Exact IDs/validation; add/edit unchanged; no heuristics |
| 30 | CUSTOMER | `CUSTOMER-UI-06 Memory Jar and line-repair presentation` | Cart list/empty/repair/suggestions | High | none | Same local workspace/line identity/repair/evidence invalidation |
| 31 | CUSTOMER | `CUSTOMER-UI-07 Checkout and payment-evidence presentation` | Contact/payment/review routes | Critical | none | Same pickup code/channel/proof/fail-closed validation |
| 32 | CUSTOMER | `CUSTOMER-UI-08 Submit and waiting certainty states` | UI5 submit/wait/WhatsApp presentation | Critical | none | Same identity/readback/no resend/background retry |
| 33 | CUSTOMER | `CUSTOMER-UI-09 Store fulfillment and pickup tracking` | UI6/UI7 presentation | Critical | none | Canonical read-only states; Ready through Complete distinct |
| 34 | CUSTOMER | `CUSTOMER-UI-10 Orders, history and reorder` | UI8 current/history/copy/repair | High | none | Old order immutable; new cart/current validation; line repair |
| 35 | CUSTOMER REVIEW | `CUSTOMER-PRODUCT-01 Quote authority and documentation alignment` | Decision record only | Critical | none | Canonical quote/display contract and doc/registry owner approved |
| 36 | CUSTOMER REVIEW | `CUSTOMER-PRODUCT-02 Member, coupon and preference command scope` | Decision record only | Critical | none | Source/commands/consent/offline/audit priorities approved or deferred |
| 37 | CUSTOMER | `CUSTOMER-UI-11 Member, account and support presentation` | UI9/UI10 visual/UX only | Critical | CUSTOMER-PRODUCT-02 Owner decision | No new credential/member/coupon command; honest disabled states |
| 38 | CUSTOMER | `CUSTOMER-UI-12 Responsive, state and accessibility pass` | Cross-screen presentation | Medium | none | State semantics preserved; focus/touch/reduced-motion; mobile/desktop evidence |

## Buffered dependency model

`HARD_DEPENDENCY` is reserved for a technical or product-contract prerequisite. `SOFT_SEQUENCE` is review order only and may be bypassed by Owner decision. A failed or deferred Stage does not create a cross-port chain unless `BLOCKS` names the exact downstream Issue.

| ISSUE | HARD_DEPENDENCY | SOFT_SEQUENCE | BYPASS_ALLOWED | BLOCKS |
| --- | --- | --- | --- | --- |
| OWNER-UI-01 | NONE | First Owner UI review stage | YES | NONE |
| OWNER-UI-02 | NONE | Recommended after OWNER-UI-01 review | YES | NONE |
| OWNER-UI-03 | NONE | Recommended after OWNER-UI-02 review | YES | NONE |
| OWNER-UI-04 | NONE | Recommended after OWNER-UI-03 review | YES | NONE |
| OWNER-UI-05 | NONE | Recommended after OWNER-UI-04 review | YES | NONE |
| OWNER-UI-06 | NONE | Recommended after OWNER-UI-05 review | YES | NONE |
| OWNER-UI-07 | NONE | Recommended after OWNER-UI-06 review | YES | NONE |
| OWNER-UI-08 | NONE | Recommended after OWNER-UI-07 review | YES | NONE |
| OWNER-UI-09 | NONE | Recommended after OWNER-UI-08 review | YES | NONE |
| OWNER-UI-10 | NONE | Recommended after OWNER-UI-09 review | YES | NONE |
| OWNER-PRODUCT-01 | NONE | Independent after the Owner forensic audit | YES | NONE |
| OWNER-PRODUCT-02 | NONE | Independent after the Owner forensic audit | YES | NONE |
| SMM-UI-01 | NONE | Recommended after the Owner UI review wave for cross-port consistency | YES | NONE |
| SMM-UI-02 | NONE | Recommended after SMM-UI-01 review | YES | NONE |
| SMM-UI-03 | NONE | Recommended after SMM-UI-02 review | YES | NONE |
| SMM-UI-04 | NONE | Recommended after SMM-UI-03 review | YES | NONE |
| SMM-UI-05 | NONE | Recommended after SMM-UI-04 review | YES | NONE |
| SMM-UI-06 | NONE | Recommended after SMM-UI-05 review | YES | NONE |
| SMM-PRODUCT-01 | NONE | Independent; recommended before SMM-UI-07 | YES | SMM-UI-07 only |
| SMM-UI-07 | SMM-PRODUCT-01 Owner decision | Recommended after SMM-UI-06 review | NO | NONE |
| SMM-UI-08 | NONE | Recommended after SMM-UI-07 review | YES | NONE |
| SMM-UI-09 | NONE | Recommended after SMM-UI-08 review | YES | NONE |
| SMM-UI-10 | NONE | Recommended after SMM-UI-09 review | YES | NONE |
| SMM-UI-11 | NONE | Recommended after SMM-UI-10 review | YES | NONE |
| CUSTOMER-UI-01 | NONE | Recommended after SMM shell direction is reviewed for cross-brand consistency | YES | NONE |
| CUSTOMER-UI-02 | NONE | Recommended after CUSTOMER-UI-01 review | YES | NONE |
| CUSTOMER-UI-03 | NONE | Recommended after CUSTOMER-UI-02 review | YES | NONE |
| CUSTOMER-UI-04 | NONE | Recommended after CUSTOMER-UI-03 review | YES | NONE |
| CUSTOMER-UI-05 | NONE | Recommended after CUSTOMER-UI-04 review | YES | NONE |
| CUSTOMER-UI-06 | NONE | Recommended after CUSTOMER-UI-05 review | YES | NONE |
| CUSTOMER-UI-07 | NONE | Recommended after CUSTOMER-UI-06 review | YES | NONE |
| CUSTOMER-UI-08 | NONE | Recommended after CUSTOMER-UI-07 review | YES | NONE |
| CUSTOMER-UI-09 | NONE | Recommended after CUSTOMER-UI-08 review | YES | NONE |
| CUSTOMER-UI-10 | NONE | Recommended after CUSTOMER-UI-09 review | YES | NONE |
| CUSTOMER-PRODUCT-01 | NONE | Independent after the Customer forensic audit | YES | NONE |
| CUSTOMER-PRODUCT-02 | NONE | Independent; recommended before CUSTOMER-UI-11 | YES | CUSTOMER-UI-11 only |
| CUSTOMER-UI-11 | CUSTOMER-PRODUCT-02 Owner decision | Recommended after CUSTOMER-UI-10 review | NO | NONE |
| CUSTOMER-UI-12 | NONE | Recommended after CUSTOMER-UI-11 review | YES | NONE |

## Created GitHub issue registry

All 38 issues are open and carry `[PLANNED][HOLD]`, `IMPLEMENTATION STATUS: HOLD`, and `OWNER PROMOTE REQUIRED: YES`.

| ORDER | ISSUE | GITHUB |
| ---: | --- | --- |
| 1 | OWNER-UI-01 | [#531](https://github.com/Pantonyeung/mfk/issues/531) |
| 2 | OWNER-UI-02 | [#532](https://github.com/Pantonyeung/mfk/issues/532) |
| 3 | OWNER-UI-03 | [#533](https://github.com/Pantonyeung/mfk/issues/533) |
| 4 | OWNER-UI-04 | [#534](https://github.com/Pantonyeung/mfk/issues/534) |
| 5 | OWNER-UI-05 | [#535](https://github.com/Pantonyeung/mfk/issues/535) |
| 6 | OWNER-UI-06 | [#536](https://github.com/Pantonyeung/mfk/issues/536) |
| 7 | OWNER-UI-07 | [#537](https://github.com/Pantonyeung/mfk/issues/537) |
| 8 | OWNER-UI-08 | [#538](https://github.com/Pantonyeung/mfk/issues/538) |
| 9 | OWNER-UI-09 | [#539](https://github.com/Pantonyeung/mfk/issues/539) |
| 10 | OWNER-UI-10 | [#540](https://github.com/Pantonyeung/mfk/issues/540) |
| 11 | OWNER-PRODUCT-01 | [#541](https://github.com/Pantonyeung/mfk/issues/541) |
| 12 | OWNER-PRODUCT-02 | [#542](https://github.com/Pantonyeung/mfk/issues/542) |
| 13 | SMM-UI-01 | [#543](https://github.com/Pantonyeung/mfk/issues/543) |
| 14 | SMM-UI-02 | [#544](https://github.com/Pantonyeung/mfk/issues/544) |
| 15 | SMM-UI-03 | [#545](https://github.com/Pantonyeung/mfk/issues/545) |
| 16 | SMM-UI-04 | [#546](https://github.com/Pantonyeung/mfk/issues/546) |
| 17 | SMM-UI-05 | [#547](https://github.com/Pantonyeung/mfk/issues/547) |
| 18 | SMM-UI-06 | [#548](https://github.com/Pantonyeung/mfk/issues/548) |
| 19 | SMM-PRODUCT-01 | [#549](https://github.com/Pantonyeung/mfk/issues/549) |
| 20 | SMM-UI-07 | [#550](https://github.com/Pantonyeung/mfk/issues/550) |
| 21 | SMM-UI-08 | [#551](https://github.com/Pantonyeung/mfk/issues/551) |
| 22 | SMM-UI-09 | [#552](https://github.com/Pantonyeung/mfk/issues/552) |
| 23 | SMM-UI-10 | [#553](https://github.com/Pantonyeung/mfk/issues/553) |
| 24 | SMM-UI-11 | [#554](https://github.com/Pantonyeung/mfk/issues/554) |
| 25 | CUSTOMER-UI-01 | [#555](https://github.com/Pantonyeung/mfk/issues/555) |
| 26 | CUSTOMER-UI-02 | [#556](https://github.com/Pantonyeung/mfk/issues/556) |
| 27 | CUSTOMER-UI-03 | [#557](https://github.com/Pantonyeung/mfk/issues/557) |
| 28 | CUSTOMER-UI-04 | [#558](https://github.com/Pantonyeung/mfk/issues/558) |
| 29 | CUSTOMER-UI-05 | [#559](https://github.com/Pantonyeung/mfk/issues/559) |
| 30 | CUSTOMER-UI-06 | [#560](https://github.com/Pantonyeung/mfk/issues/560) |
| 31 | CUSTOMER-UI-07 | [#561](https://github.com/Pantonyeung/mfk/issues/561) |
| 32 | CUSTOMER-UI-08 | [#562](https://github.com/Pantonyeung/mfk/issues/562) |
| 33 | CUSTOMER-UI-09 | [#563](https://github.com/Pantonyeung/mfk/issues/563) |
| 34 | CUSTOMER-UI-10 | [#564](https://github.com/Pantonyeung/mfk/issues/564) |
| 35 | CUSTOMER-PRODUCT-01 | [#565](https://github.com/Pantonyeung/mfk/issues/565) |
| 36 | CUSTOMER-PRODUCT-02 | [#566](https://github.com/Pantonyeung/mfk/issues/566) |
| 37 | CUSTOMER-UI-11 | [#567](https://github.com/Pantonyeung/mfk/issues/567) |
| 38 | CUSTOMER-UI-12 | [#568](https://github.com/Pantonyeung/mfk/issues/568) |

## Per-issue required body

Every created issue contains all of these fields:

- `TITLE`
- `PORT`
- `STAGE`
- `CURRENT STATE`
- `REFERENCE EVIDENCE`
- `TARGET CHANGE`
- `VISUAL SCOPE`
- `UX SCOPE`
- `PRODUCT BEHAVIOR IMPACT`
- `ALLOWED PATHS`
- `NON-GOALS`
- `HARD_DEPENDENCY`
- `SOFT_SEQUENCE`
- `BYPASS_ALLOWED`
- `BLOCKS`
- `ACCEPTANCE`
- `ROLLBACK`
- `CLASSIFICATION`
- `IMPLEMENTATION STATUS: HOLD`
- `OWNER PROMOTE REQUIRED: YES`

## Acceptance and rollback invariant

- UI issue acceptance requires matching-view `OLD REFERENCE / CURRENT BEFORE / CANDIDATE AFTER`, the named normal/degraded states, focused tests/build, and explicit proof that behavior/authority did not change.
- Rollback is close/revert the single candidate and return to the prior accepted Main checkpoint. No later stage may be used to repair a failed earlier stage.
- Product Review acceptance is an explicit Owner decision and approved contract; it does not itself authorize code.
