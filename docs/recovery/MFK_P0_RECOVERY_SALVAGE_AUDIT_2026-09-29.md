# MFK P0 Recovery Salvage Audit｜2026-09-29

Status: `AUDIT COMPLETE / CANDIDATES DRAFT ONLY`

Repository: `Pantonyeung/mfk`

Audit base and current Main: `6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a`

Controlled rollback bank: `052295861931b72aa401aa6fa06c3cd65866706d`

Incident range:

- LAST_KNOWN_GOOD: `5ff4eea2f36d552923bfe1c46393da48d7a63573`
- FIRST_BAD: `a4d66f1f815b473f98e41237836cf4e316a62f24`
- FINAL_RESEARCH_VERSION: `7030a9e56b7e547940ee8c3d0cc118a189d99d97`

Control for tonight:

- No Main merge.
- No production deploy.
- No SMT OTA.
- No Durable Object or localStorage migration.
- Every code Candidate is a sibling whose direct parent is the exact audit base.

## 1. Executive decision

The incident line must not be restored as a tree or merged as a unit. It contains one 99-file rollback/substitution, several useful narrow repairs, two rejected sync experiments, an unproven all-port identity implementation, and a high-risk Sync V2 sequence that changes Durable Object storage, revision authority and the WebSocket event contract.

Current Main is not descended from the incident final version. It follows the safe line:

```text
5ff4eea2 LAST_KNOWN_GOOD
├── a4d66f1 → ... → 7030a9e   incident research line only
└── 05229586 bank → 6cb2d05e current Main
```

Current Main therefore already retains nearly all valuable LAST_KNOWN_GOOD business capabilities. The correct salvage set is four small Candidates:

1. Dining live refresh after an applied Admin config.
2. Dining table selector fail-closed with no fabricated T01–T09.
3. Matching canonical Cloud evidence before Admin marks a publish complete.
4. A bounded 15-second Admin-config reconciliation fallback while the doorbell is open.

Everything else is either already present, unsafe to revive, or lacks enough authority evidence.

## 2. Audit method and lineage proof

The review used fresh remote refs and full diffs, not commit titles:

- Confirmed remote Main at `6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a` before and after Candidate publication.
- Confirmed the bank ref at `052295861931b72aa401aa6fa06c3cd65866706d`.
- Confirmed all 14 incident commits are linear descendants of LAST_KNOWN_GOOD.
- Confirmed `7030a9e56b7e547940ee8c3d0cc118a189d99d97` is not an ancestor of current Main.
- Reviewed changed production seams, contracts, runtime behavior, tests and authority boundaries for every commit.
- Compared Current Main with LAST_KNOWN_GOOD and the incident branch; Current Main keeps LAST_KNOWN_GOOD plus the bounded recovery and PR #520 changes.
- No `.codegraph/` directory exists, so CodeGraph indexing was not available and no index was created.

## 3. FIRST_BAD 99-file blast-radius audit

`a4d66f1f815b473f98e41237836cf4e316a62f24` changed 99 files with 650 insertions and 1,772 deletions. It was a whole-system tree substitution, not a single Sync fix.

| Root | Files | Delta | Production finding | Current disposition |
|---|---:|---:|---|---|
| `.github` | 1 | `+0/-17` | Cross-port integration gate changed with the rollback. | Current Main LKG gate wins; no donor restore. |
| `contracts` | 2 | `+3/-24` | Removed SMM ACCEPT/READY fulfillment contract and runtime sellability projection event. | `ALREADY_PRESENT` on Main. |
| `docs` | 4 | `+0/-212` | Deleted Customer/SMM acceptance handoffs. | Evidence only; no product Candidate. |
| `integrations` | 2 | `+0/-109` | Removed Keeta one-to-many product resolver, quantities/roles, option mapping and its tests. | `ALREADY_PRESENT` on Main. |
| `v2admin` | 15 | `+304/-395` | Removed Keeta diagnostics/money fields and runtime sellability projection; introduced Owner writes to canonical availability and Customer quote plumbing. | Valuable LKG paths are `ALREADY_PRESENT`; Owner-as-Admin mutation is `DROP`; quote path is `DROP`. |
| `v2customer` | 28 | `+87/-309` | Removed worker/build endpoint and newer UI/source-fidelity capabilities while changing checkout behavior. | Current Main implementation is `ALREADY_PRESENT`; do not copy incident UI. |
| `v2local` | 16 | `+121/-447` | Removed Keeta decomposition/money, business-day soldout reset, runtime projection, Owner command reconcile and SMM fulfillment; added Customer cloud quote reconcile and fake Dining tables. | Valuable capabilities are `ALREADY_PRESENT`; quote is `DROP`; remaining fake-table seam is Candidate 02. |
| `v2owner` | 3 | `+0/-14` | Removed Keeta lifecycle/money/print diagnostic fields. | `ALREADY_PRESENT` on Main. |
| `v2smm` | 28 | `+135/-245` | Removed fulfillment endpoints/readback and replaced UI/brand state assets. | Fulfillment and current UI are `ALREADY_PRESENT`; do not restore incident tree. |

The important authority regressions inside FIRST_BAD were broader than Sync:

- Owner was changed from a bounded command producer into a writer of Admin canonical availability. That creates a second Admin authority and is rejected.
- Customer quote was changed to Customer → Cloud queue → SMT pricing → Cloud readback. This revives the warned legacy architecture and is rejected.
- SMT runtime sellability and business-day reset were removed in favor of Admin snapshot availability. Current Main correctly retains frontline runtime fact authority.
- Keeta canonical decomposition, option mapping and provider-money facts were removed. Current Main correctly retains them.
- SMM fulfillment ACCEPT/READY and readback were removed. Current Main correctly retains them.

## 4. Commit-by-commit incident review

| # | Commit | Size | Finding | Salvage disposition |
|---:|---|---:|---|---|
| 1 | `a4d66f1f815b473f98e41237836cf4e316a62f24` | 99 files `+650/-1772` | Whole-tree rollback removed multiple accepted capabilities and introduced unsafe Owner/Customer authority paths. | Never restore wholesale. Split findings per inventory below. |
| 2 | `771af6017d9bc7ec02d72e5ee88a370deb33a4f0` | 4 files `+18/-15` | Made table rename immediately ACTIVE in the Admin draft, removed one runtime fake-table fallback, and added a 2-second focus/visibility poll. | Rename/retirement behavior is `ALREADY_PRESENT`; UI fake fallback is `REBUILD` in Candidate 02; 2-second polling is `DROP`. |
| 3 | `34985b876b75fce0012e5e1bc5d3ba0418429e7e` | 1 file `+1/-1` | Reused the existing Dining `load()` after Admin config apply. | `KEEP` as Candidate 01. |
| 4 | `f6ca02095429ead6a51b6cfed6bc0947b329db6c` | 1 file `-5` | Removed the 2-second safety poll and focus/visibility fetches for doorbell-first sync. | Keep removal of the request storm; do not accept doorbell-only as sufficient reconciliation. |
| 5 | `d9f854646bc37556ebe058df0fcb7ca5e4c2a586` | 1 file `+4` | Returned the WebSocket upgrade response directly. | `ALREADY_PRESENT`, superseded by PR #520 handling WebSocket and HTTP/CORS safely. |
| 6 | `3e6865b9ac27b3c4fa41d3039271d398df5c3986` | 11 files `+41/-4` | Added a hard-coded product version, dynamic build timestamp and compile-time SHA to all ports; several identity components were exported but never rendered. | Admin/public SMT are `ALREADY_PRESENT`; untrusted per-port injection is `QUARANTINE`; hard-coded global version is `DROP`. |
| 7 | `29e4b7bcb20c9596361c70d7e0f7a3fadd28a3c2` | 1 file `+5/-2` | Added a 15-second active-config reconciliation while the socket is open and clears it on close/error. | `KEEP` as Candidate 04, isolated from PR #520 transport. |
| 8 | `816de7f3986a629b44d4aae514db92f77bbd8534` | 2 files `+30/-5` | Added POST + separate GET readback and changed only one Admin workspace to await it. | Requirement is valid; implementation is `REBUILD` in Candidate 03 using the existing canonical POST response. |
| 9 | `262d53d8b493c529a4dcde1a1560f640b52ce135` | 3 files `+7/-35` | Explicitly rolled back the 15-second reconcile and cloud-confirmed publish experiments. | Control evidence only. The two concepts are independently re-audited in Candidates 03/04. |
| 10 | `1da48c0f5ec5c842d62bff60610ed5cb96358a5f` | 2 files `+57` | Defined 20 Sync V2 domains, baseline/delta/invalidation types and five unit tests. | `QUARANTINE`; contract alone does not establish production authority or compatibility. |
| 11 | `9b7ed6634a1024bc765a7bb381eb3f8631ac7977` | 1 file `+21/-1` | Wrote baseline/delta records into the live Admin Durable Object and replaced the doorbell event with `CONFIG_INVALIDATED`. | `QUARANTINE`; high-risk storage and event-protocol mutation. |
| 12 | `e9ca46f39c7cf6e1e1d80d02f8f3aa347b3b915f` | 1 file `+9/-7` | Replaced browser revision/publishedAt with Cloud-generated values and removed stale/idempotent conflict checks. | `QUARANTINE`; revision authority migration is not proven and breaks the existing local-release identity relationship. |
| 13 | `3eed15a7814fc34f9510934b4e3ae920bfbede5a` | 1 file `+43` | Documented that auto-accept occurs only when canonical `channelPolicy.autoAccept === true`, but did not identify the live revision that changed it. | Default/manual behavior `ALREADY_PRESENT`; exact live cause `UNKNOWN`; provider-confirm mutation `QUARANTINE`. |
| 14 | `7030a9e56b7e547940ee8c3d0cc118a189d99d97` | 3 files `+32/-7` | Taught SMT to consume `CONFIG_INVALIDATED` and Admin to accept Cloud-returned revision/fingerprint. It did not close migration, idempotency, journal retention or mixed-client behavior. | `QUARANTINE`; no implementation tonight. |

## 5. Capability inventory and classification

### 5.1 Transport, identity and Dining

| Capability | Current Main evidence | Classification | Decision |
|---|---|---|---|
| Admin WebSocket upgrade/pass-through | `v2admin/worker.ts`, `admin-sync-websocket-transport.test.ts`, merged PR #520 | `ALREADY_PRESENT` | No duplicate Candidate. |
| Admin exact source identity | `/api/health`, workflow `MFK_SOURCE_SHA`, deploy readback test | `ALREADY_PRESENT` | Keep Current Main. |
| Public SMT deployment identity | `v2local/web-acceptance-worker.ts` `/__mfk/build`, build manifest test, PR #520 | `ALREADY_PRESENT` | Keep Current Main. |
| Customer exact source identity | Existing endpoint has a static build marker but no audited immutable deploy injection tonight. | `QUARANTINE` | Do not claim exact source; audit deployment path first. |
| Owner/SMM source identity | Health endpoints do not provide an audited immutable source SHA path. | `QUARANTINE` | No Candidate without a trusted build/deploy injection seam. |
| Physical installed SMT APK identity | Public web identity does not prove installed package/source/signing identity. | `QUARANTINE` | Must be solved through the controlled package/OTA path, not UI constants. |
| Incident global `1.0.0.0.0.1` + buildAt label | Hard-coded version and build-time clock are not deployment evidence; several components were unused. | `DROP` | Do not salvage. |
| Dining live refresh after Admin apply | Current listener re-rendered but did not reload `runtime.readDining()`. | `KEEP` | Candidate 01 / PR #521. |
| Dining fake T01–T09 fallback | Runtime assignment fails closed, but Current Main hold selector fabricated tables. | `REBUILD` | Candidate 02 / PR #522. |
| Stable table ID, active/sorted registry and published name | Current Main registry/readback/tests. | `ALREADY_PRESENT` | No duplicate implementation. |
| Rename `ACTIVE/SUPERSEDED` versions | Current Main keeps stable table ID, explicit draft action, and publish boundary. | `ALREADY_PRESENT` | Rename is label evolution, not identity replacement. |
| `PLANNED` rename activation for occupied tables | No operational need proven; stable ID means rename does not reassign or retire an occupied table. | `DROP` | Keep occupancy gate for retirement, not label change. |
| Planned retirement, fresh occupancy evidence, no ID reuse | Current Main uses `PLANNED_RETIREMENT`, fresh readback, ledger and fail-closed activation. | `ALREADY_PRESENT` | No Candidate. |
| Cloud-confirmed Admin publish | Worker already returns canonical state/revision/fingerprint, but client accepted any 2xx and UI copy claimed success early. | `REBUILD` | Candidate 03 / PR #523. |
| Browser revision vs Cloud revision UX | Creates two visible authorities and was not required by the business outcome. | `DROP` | Candidate 03 uses one matching Cloud response only. |
| Bounded reconciliation after missed doorbell | Current Main has startup/open/online/event fetch but no silent-open fallback. | `KEEP` | Candidate 04 / PR #524. |

### 5.2 Owner Sellability

| Sub-capability | Current Main evidence | Classification | Decision |
|---|---|---|---|
| Manual SOLD_OUT / PAUSE / RESTORE runtime fact | Owner command → SMT `localRuntime.setAvailability()` → matching ACK/readback; no Admin config mutation. | `ALREADY_PRESENT` | Keep current bounded command architecture. |
| Runtime frontline fact vs Admin policy | Runtime availability is projected separately; Admin catalog/policy remains canonical configuration. | `ALREADY_PRESENT` | Preserve boundary. |
| Owner governance boundary | Current tests forbid Owner from directly mutating Admin canonical config and validate targets. | `ALREADY_PRESENT` | Owner remains command/governance surface, not second Admin. |
| `ALL` global operation | Existing SMT command semantics change the runtime node globally. | `ALREADY_PRESENT` | Do not add a duplicate scope engine. |
| `ONLINE_ONLY` | UI/request field exists, but Current Main command persistence and SMT runtime do not preserve or enforce it. | `QUARANTINE` | Needs one canonical scope policy and channel projection contract first. |
| `restoreAt` / expiry | UI/request field exists, but command persistence/runtime expiry authority is absent. | `QUARANTINE` | Needs clock, restart and Business Day semantics before code. |
| Incident Owner direct write to Admin snapshot availability | Makes Owner a second Admin and bypasses frontline runtime truth. | `DROP` | Never revive. |

### 5.3 Keeta, runtime sellability and SMM

| Capability | Current Main evidence | Classification | Decision |
|---|---|---|---|
| Provider product → multiple MFK products | `resolveKeetaProductMapping`, component list and intake tests. | `ALREADY_PRESENT` | No Candidate. |
| Component quantities and roles | Mapping normalizes positive quantity and production role; intake expands canonical lines. | `ALREADY_PRESENT` | No Candidate. |
| Keeta option mapping | Exact product/group/option mapping; missing and ambiguous paths fail closed. | `ALREADY_PRESENT` | No Candidate. |
| Missing/ambiguous mapping handling | Explicit `NOT_FOUND` / `AMBIGUOUS` errors and diagnostics. | `ALREADY_PRESENT` | No Candidate. |
| Provider final transaction amount | `effectiveTransactionMinor` and `KEETA_PROVIDER_AUTHORIZED_TRANSACTION`. | `ALREADY_PRESENT` | Provider transaction money remains authoritative for the transaction. |
| Canonical reference value | `referenceValueMinor` retained separately from effective transaction money. | `ALREADY_PRESENT` | No Candidate. |
| Commission/promotion/settlement evidence | Keeta commercial model keeps provider estimates/evidence without rewriting transaction price. | `ALREADY_PRESENT` | No Candidate. |
| Mapping → SMT ACK → Commercial → Provider Confirm → Provider Ready diagnostics | Intake/lifecycle/provider command/readback paths and tests exist. | `ALREADY_PRESENT` | No Candidate. |
| SMT manual sellability | Local runtime is frontline fact authority. | `ALREADY_PRESENT` | No Candidate. |
| Runtime sellability projection to Customer/Admin/Keeta | Projection outbox and Keeta overlay tests exist. | `ALREADY_PRESENT` | No Candidate. |
| Business-day soldout reset | SOLD_OUT resets on next Business Day; PAUSED remains. | `ALREADY_PRESENT` | No Candidate. |
| SMM ACCEPT / READY | Contract, Durable Object intent, trusted SMT ingress and canonical readback exist. | `ALREADY_PRESENT` | No Candidate. |
| SMM idempotency | Command ID/fingerprint plus SMT disposition/readback. | `ALREADY_PRESENT` | No Candidate. |
| SMM Dining exclusion | Dining orders are rejected from SMM fulfillment mutation. | `ALREADY_PRESENT` | No Candidate. |
| Keeta auto-accept default/manual policy | Default is false; only strict canonical `autoAccept === true` triggers accept and provider confirm. | `ALREADY_PRESENT` | Do not change code without live canonical evidence. |
| Exact revision that enabled auto-accept during incident | Incident document contains a hypothesis, not live revision/browser/SMT-LKG readback. | `UNKNOWN` | Read-only evidence needed before any remediation. |
| Automatic provider confirm based on unverified live policy | High-risk Keeta provider mutation. | `QUARANTINE` | No real-order testing and no Candidate tonight. |

### 5.4 Customer quote, Sync V2 and remaining 99-file areas

| Capability | Current Main evidence | Classification | Decision |
|---|---|---|---|
| Customer local quote against published menu | Current Customer app uses `quotePublishedCart`; tests forbid invoking the cloud `quoteCart` path. | `ALREADY_PRESENT` | Keep local/current architecture. |
| Customer → Cloud quote queue → SMT quote → Cloud readback | Added by FIRST_BAD; creates a second asynchronous pricing path and more failure states. | `DROP` | Do not revive. |
| Dead optional `quoteCart` port surface | Not called by the app and no active Worker quote endpoint on Main. | `QUARANTINE` | Cleanup can be a future isolated deletion, not a recovery Candidate. |
| Sync V2 domain contract | Types exist only on incident line. | `QUARANTINE` | Audit only. |
| Baseline + delta journal | Writes new live Durable Object keys with no retention/compaction/migration proof. | `QUARANTINE` | No implementation. |
| `CONFIG_INVALIDATED` event | Replaces the active event contract and creates mixed-client risk. | `QUARANTINE` | No implementation. |
| Cloud revision authority | Rewrites browser release identity and removes existing conflict/idempotency behavior. | `QUARANTINE` | Requires explicit structural approval and migration plan. |
| Customer current UI/worker/deploy config removed by FIRST_BAD | Present on Current Main from LAST_KNOWN_GOOD. | `ALREADY_PRESENT` | No duplicate restore. |
| SMM Stage 0/6/7/8/9/StageX UI, brand assets and PWA runtime | Present on Current Main from LAST_KNOWN_GOOD. | `ALREADY_PRESENT` | No duplicate restore. |
| Print, capacity, local operations and projection tests touched by FIRST_BAD | Present on Current Main from LAST_KNOWN_GOOD. | `ALREADY_PRESENT` | No recovery-scope edits. |

## 6. Candidate registry

Every Candidate branch was created from `6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a`; its merge-base remains that exact SHA and no Candidate contains another Candidate.

| Candidate | Branch | Commit | Draft PR | Class | Risk |
|---|---|---|---|---|---|
| 01 Dining live refresh | `candidate/MFK/01-dining-live-refresh` | `34ccfbd03d5a198ada34e99d39187ea7b9440918` | #521 | `KEEP` | Physical SMT refresh timing |
| 02 Table fail-closed | `candidate/MFK/02-dining-table-fail-closed` | `6a036e02d302f66621bd0d7a7ae5d5f0018fcd20` | #522 | `REBUILD` | HIGH RISK Admin table authority / physical SMT |
| 03 Cloud-confirmed publish | `candidate/MFK/03-cloud-confirmed-publish` | `d532cf5f35cfe4d8ba2a9914d928ce1da9d7c5a8` | #523 | `REBUILD` | HIGH RISK Admin publish authority |
| 04 Reconcile fallback | `candidate/MFK/04-smt-admin-reconcile-fallback` | `0e93e088003b629f28962a0f761f681d24cc5587` | #524 | `KEEP` | HIGH RISK WebSocket-adjacent runtime/network |

All four Draft PR bodies contain the required capability, evidence, state, classification, authority/persistence/provider/physical impact, rollback, tests, live PASS/FAIL, BYPASS and `DEPENDENCY: NONE` sections.

## 7. Verification results

| Candidate | Focused result | Package result | Build |
|---|---|---|---|
| 01 | 2 files / 4 tests passed | 90 files / 403 tests passed, excluding exact-base red below | Passed |
| 02 | 3 files / 10 tests passed | 89 files / 402 tests passed, excluding exact-base red below | Passed |
| 03 | Admin 2 files / 8 tests and v2local cross-port 1 file / 4 tests passed | Full v2admin 33 files / 212 tests; v2local 89 files / 402 tests excluding exact-base red | Passed |
| 04 | 2 files / 8 tests passed | 90 files / 403 tests passed, excluding exact-base red below | Passed |

Known exact-base test issue:

- `v2local/src/presentation/smt-owner-print-recovery-a2.test.ts` expects an LF-only source substring and fails against Windows CRLF.
- The same failure reproduces on the unmodified exact base.
- The affected Print source/test is outside every Candidate diff.
- Early four-suite parallel execution also caused isolated 5-second timeouts; focused reruns passed, and the serialized one-worker suites above passed.

Build warnings about chunks over 500 kB are existing advisory warnings, not build failures.

## 8. Tomorrow release order: lowest to highest blast radius

### Preflight for every Candidate

1. Record the current accepted Main SHA.
2. Confirm the selected Candidate has exactly one capability and `DEPENDENCY: NONE`.
3. Confirm no other Candidate is being merged or deployed concurrently.
4. Merge exactly one Candidate.
5. Run CI from the resulting Main.
6. Deploy only the affected port through its canonical path.
7. Perform the Candidate's live acceptance below.
8. On PASS, record a new accepted checkpoint before considering the next Candidate.
9. On FAIL, immediately revert the last Candidate, confirm return to the prior accepted checkpoint, label it BYPASS, and continue only with independent Candidates.

### 1. PR #521 — Dining live refresh

Why first: one existing listener calls one existing read seam; no authority or persistence change.

PASS:

- Publish a controlled, harmless Admin Dining display change.
- Confirm matching Cloud revision and SMT apply evidence.
- Without restarting or leaving Dining, the physical SMT shows the new canonical projection.
- Existing holds, orders and table occupation remain unchanged.

FAIL:

- Stale UI, stuck busy state, duplicated hold/order, or a non-matching revision shown.

BYPASS:

- PRs #523, #522 and #524 remain valid.

### 2. PR #523 — Canonical Cloud publish confirmation

Why second: it can fail closed by retaining the outbox; it does not alter SMT apply/storage.

PASS:

- Create a no-op or display-only local release.
- Immediate workspace copy says local revision is waiting for Cloud confirmation.
- Matching `PUBLISHED` or `IDEMPOTENT` revision/fingerprint clears the outbox and shows Cloud received.
- SMT applied state appears only after a separate matching SMT ACK.
- Missing/mismatched evidence keeps the outbox and shows an error.

FAIL:

- Any unmatched 2xx clears the outbox, UI claims formal publish early, matching evidence is rejected, or Cloud/SMT state is conflated.

BYPASS:

- PRs #522 and #524 remain valid; #521 remains accepted if already passed.

### 3. PR #522 — Dining table fail-closed

Why third: corrects an authority defect but can remove table choices if production canonical config is missing, so it needs a controlled physical window.

PASS:

- Physical SMT table choices match the exact active/sorted Admin registry with no extra T01–T09.
- Unknown/disabled tables cannot be assigned.
- Occupied tables retain the same table ID/hold and reject double assignment.
- Published rename changes only the label; retirement still requires fresh zero-occupancy evidence.

FAIL:

- Fabricated tables appear, a published table disappears, an occupied table can be reassigned, or a current hold loses table identity.

BYPASS:

- PR #524 remains valid; prior accepted Candidates remain valid.

### 4. PR #524 — 15-second reconciliation fallback

Why last: it runs continuously on every physical SMT and is adjacent to the WebSocket/revision protocol.

PASS:

- Normal doorbell remains immediate.
- With WebSocket delivery deliberately blocked while HTTP active read remains available, a controlled config reaches SMT within the 15-second reconciliation window through the same validated apply seam.
- Network evidence shows one bounded active read per interval, no request/reconnect storm, no duplicate business mutation, and a matching ACK.
- Closing the socket stops the interval.

FAIL:

- Request rate exceeds the bounded interval, polling continues after socket close, CPU/UI degrades, revision moves backward/conflicts, or ACK/business side effects repeat.

BYPASS:

- No earlier Candidate depends on this one.

## 9. Explicit non-candidates

No Candidate was created for the following because doing so tonight would manufacture authority or duplicate Current Main:

- Admin WebSocket transport: already merged in PR #520.
- Keeta mapping, money, lifecycle and diagnostics: already present.
- SMT sellability, business-day reset and Keeta propagation: already present.
- SMM ACCEPT/READY/idempotency/Dining exclusion/readback: already present.
- Customer cloud quote: dropped.
- Owner `ONLINE_ONLY` and expiry: quarantined pending one canonical policy/runtime contract.
- Non-Admin/non-public-SMT source identity: quarantined pending trusted deploy injection.
- Keeta auto-accept incident fix: unknown live canonical revision; no provider mutation without evidence.
- Sync V2: quarantined in full.

## 10. Recovery and rollback rules

- The bank `052295861931b72aa401aa6fa06c3cd65866706d` is the prior controlled checkpoint, not the automatic response to a single Candidate failure.
- Current Main `6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a` is tonight's common Candidate base.
- Tomorrow each accepted merge creates a newer accepted checkpoint.
- A failed Candidate is reverted alone. Do not reset unrelated accepted Candidates and do not restore the incident tree.
- Source/test GREEN does not equal deploy, device, public, provider or physical GREEN.

## 11. Tonight final control state

- Main remained at `6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a` after all pushes and Draft PR creation.
- PRs #521, #522, #523 and #524 are Drafts.
- No merge was performed.
- No production deploy was invoked.
- No SMT OTA was issued.
- No live Admin, Customer, Owner, SMM, Keeta, payment, print, cash drawer or order state was mutated.
