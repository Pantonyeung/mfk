# MFP V3｜Codex Implementation Handoff｜A9 Public + Diagnostics + Physical Acceptance + Cutover｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A9-PUBLIC-DIAGNOSTICS-PHYSICAL-CUTOVER-2026-10-02`

Parent:
- PR #647 — MFP V3 A8｜Customer + Keeta + External｜2026-10-02
- Parent exact head: `83adb14c21170bc3a34a0022c62b1a2bea2f68c4`
- A8 status: SOURCE_VERIFIED
- Owner acceptance: EXPLICIT

Builder preparation lane:
- Repository: `Pantonyeung/morefunos-v1-builder`
- Branch: `feat/MFP-V3-A9-BUILDER-RUNTIME-OTA-2026-10-02`
- Draft PR: #174
- Issue: #175
- Builder parent main SHA: `fe2692ac8e979e7d9e1d211758b9f9dfa9846190`
- Builder preparation head at A9 opening: `4ab3820382a34f4d46306eb329d31090aa8ffa4c`

Visual lock:
`docs/design/MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026-10-02.md`

Controlling plans:
- `docs/plan/MFP_V3_OWNER_FINAL_CROSSWALK_2026-10-02.txt`
- `docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

Historical operational evidence:
- `MFK_MoreFunV1_Builder_SMT_Runtime_OTA_操作接手_2026-09-29`
- existing Android Carrier runtime/update/recovery source
- existing public SMT acceptance parity/recovery evidence
- current V3 A0–A8 source and tests

---

## 0. A9 is a gated sequence, not one automatic deployment

A9 has five explicit sub-gates:

### A9-S — Source / Production Binding
Target: `SOURCE_VERIFIED`

### A9-B — Builder V3 Runtime Packaging
Target: `SOURCE_VERIFIED`

### A9-C — Candidate Publish
Requires separate Owner / Commander authorization.
May reach: `DEPLOYED` for candidate artifact only.

### A9-P — Physical Acceptance
Requires a published candidate + real device.
Target: `PHYSICAL_VERIFIED`

### A9-X — Cutover / Promote / SMM Decommission
Requires separate explicit Owner authorization after physical acceptance.

Completing A9-S or A9-B does NOT authorize A9-C/P/X.

No automatic publish, deploy, OTA activation, domain cutover or SMM decommission.

---

## 1. First RED — exact production identity must fail closed

Write this first.

Given an MFP V3 runtime built from exact source SHA `S`:

The runtime must expose/read:
- exact MFK source SHA
- runtime releaseId
- runtimeVersion
- runtimeChannel
- build identity
- Carrier version / bridge version when native
- production binding status

If:
- runtime source SHA != expected exact SHA
- build identity absent
- Carrier current runtime != expected releaseId
- public acceptance source identity != expected source
- any critical production adapter is still unbound

Then:
- acceptance state = BLOCKED
- no PROMOTE
- no SMM decommission
- no claim of PHYSICAL_VERIFIED

P0:
`NO EXACT IDENTITY = NO CUTOVER`

---

## 2. Immediate Builder gap discovered before A9 implementation

Current Builder main has been freshly verified.

Repository:
`Pantonyeung/morefunos-v1-builder`

Current main SHA:
`fe2692ac8e979e7d9e1d211758b9f9dfa9846190`

Current workflow:
`.github/workflows/mfk-runtime-ota.yml`

Current workflow explicitly builds:
`source/v2local`

It checks V2 files and packages:
`source/v2local/dist`

Current publish request still points to legacy V2 containment source:
`9e713380f860bc33cf4b859e5b51451d1abf9df3`

Therefore:

DO NOT publish MFP V3 using the existing Builder workflow as-is.

Builder PR #174 must first become SOURCE_VERIFIED for V3 exact-source packaging.

Do NOT edit the Builder publish-trigger request file during migration.

---

## 3. Builder protocol to preserve

Historical accepted OTA protocol must be preserved, not redesigned:

1. request carries exact MFK source SHA
2. Builder checks out exact source
3. tests source
4. builds runtime
5. packages signed `.mfos`
6. verifies signing certificate
7. computes SHA-256
8. emits `runtime-update.json`
9. uploads candidate bundle/manifest
10. public manifest readback
11. public bundle re-download
12. SHA-256 readback
13. only then `MFK_RUNTIME_OTA_PUBLISHED`
14. Carrier downloads/verifies
15. candidate activation
16. `runtime.ready` confirms candidate
17. previous runtime retained for rollback

Existing release format remains:
`runtime-candidate-mfk-<source SHA first 12>`

Do not create a second OTA protocol.

---

## 4. V3 runtime.ready / release identity

Current V3 source does not yet own the legacy `runtime.ready` compatibility seam.

A9 must implement a neutral V3 Carrier runtime identity seam.

When running under trusted Android appassets runtime URL:
- read `releaseId`
- read `runtimeVersion`
- read `runtimeChannel`
- validate canonical appassets origin/path
- signal `runtime.ready` exactly once
- bridgeVersion = 1
- candidate releaseId must match runtimeVersion

Do not signal ready from:
- ordinary public browser
- mismatched origin
- mismatched release/version
- malformed identity

React StrictMode/remount must not send duplicate ready.

This compatibility seam must not import v2 runtime code.

---

## 5. Native bridge adapter

Use the existing Android `window.moreFunNative` bridge only through a bounded V3 adapter.

A9 adapter should support only formally required capabilities such as:
- `carrier.health`
- `runtime.ready`
- existing `store.kernel.*` protocol
- print gateway / printer endpoint protocols already used by A7
- diagnostics faults/actions

Do not expose arbitrary native messages to business components.

All request/response correlation:
- stable requestId
- timeout -> UNKNOWN / fail closed
- asynchronous completion events handled explicitly
- no credential logging

Public browser mode:
- no native bridge mutation
- explicit unsupported/stub diagnostics only

---

## 6. Critical Store Kernel production-binding audit

This is a mandatory A9 STOP gate.

Current V3 client formal command contract:
`mfp.store-kernel.command.v1`

Current Android Carrier Store Kernel bridge exposes low-level:
- `store.kernel.commit.v1`
- `store.kernel.command.receipt.read.v1`
- `store.kernel.aggregate.snapshot.v1`
- inbox/outbox
- health

A9 MUST verify the existing formal business-command authority/router that legitimately translates V3 high-level business commands into canonical Store Kernel mutations/readbacks.

Do NOT solve a missing formal business router by putting Order/Pricing/Payment business logic into the V3 browser.

Do NOT directly manufacture low-level aggregate mutations in React merely to make tests pass.

If no existing production-authorized formal command router exists for:
- checkout
- order operations
- money/day close
- availability/capacity
- external admission/refund

then report:
`BLOCKED — FORMAL_COMMAND_ROUTER_BINDING_MISSING`

and identify the exact missing authority/adapter contract.

A9 may remain SOURCE_VERIFIED for diagnostics/adapter scaffolding while production business binding remains BLOCKED.

No fake production success.

---

## 7. Production adapters

A9 must replace A0–A8 fail-closed placeholders only where a real authority contract exists.

Audit and bind:

### Security
- device authorization
- staff login/proof verification
- session readback
- expiry/revocation
- logout

### Store Kernel
- formal command submit
- submission readback
- canonical identity

### Sync
- Head/Delta/Checkpoint/ACK/Doorbell
- one production adapter
- no periodic business polling

### Checkout
- formal validation/readback
- canonical tender config

### Order Operations
- canonical order/operations readback
- split checkout entry to A5

### Money
- business day/cash movements/day close readback where required

### Print
- canonical PrintJob readback
- Carrier gateway / binding

### External
- Customer adapter
- Keeta adapter
- external Doorbell

Every unbound adapter must remain visibly fail-closed.

No fixture fallback in production build.

---

## 8. Diagnostics / Check Center

A9 completes More / Tools diagnostics.

Create one MFP Check Center with clearly separated sources:

### Identity
- app/build source SHA
- runtime releaseId/version/channel
- Carrier versionCode/versionName
- bridgeVersion
- surface Pad/Mobile
- current store/device identity where non-sensitive

### Authority bindings
- Security
- Store Kernel
- Sync
- Checkout/Pricing readback
- Order Operations
- Money
- Print
- Customer
- Keeta

Each:
- READY / BLOCKED / FAILED style operational state
- last checked time
- stable error code
- no secrets

### Store Kernel health
- bridge availability
- DB health result
- schema/journal/synchronous evidence if returned
- command receipt/readback capability

### Sync
- canonical HeadSeq
- local AppliedSeq
- checkpoint
- Doorbell connection
- last apply result
- no request counter masquerading as authority

### Print / Hardware
reuse A7 evidence:
- gateway
- bindings
- queue
- ambiguous job
- printer attention

### Runtime / OTA
- current
- candidate
- previous
- selected release
- endpoint configured
- rollback availability

### External
- Customer adapter
- Keeta adapter
- pending/attention counts
- no provider secret display

---

## 9. Fault journal / action evidence

Bind V3 to existing native:
- `diagnostics.action.record`
- `diagnostics.fault.record`
- `diagnostics.faults.read`

Rules:
- bounded payload
- stable code
- source
- timestamp
- no PIN/session/provider secret/raw payment evidence
- browser errors do not expose sensitive context

Critical operational actions may record non-sensitive audit evidence:
- runtime candidate activation request
- rollback request
- manual printer reprint
- physical acceptance step result

Do not create a second business audit ledger.

---

## 10. Backup / Restore

Owner A6 crosswalk deferred Backup / Restore to A9.

A9 must first identify what is actually safe to back up.

Allowed candidates may include:
- local hardware bindings
- bounded device metadata where formally allowed
- presentation settings
- diagnostic export
- non-secret runtime configuration

Do NOT backup/restore by copying:
- canonical Orders as writable client truth
- Pricing truth
- Payment truth
- PrintJob authority
- Store Kernel DB into browser storage
- staff PIN/proof/session refs
- provider secrets

If formal native Store Kernel backup/restore does not exist:
surface must say BLOCKED / unavailable.
Do not invent a browser DB restore path.

---

## 11. Public acceptance surface

Public acceptance is for verification, not production transaction authority.

Required:
- exact build/source identity endpoint/surface
- no-store identity readback
- health/diagnostic surface
- ordinary browser safe mode
- no native print
- no cash drawer
- no production device impersonation
- no real provider mutation unless separately authorized
- no production Store Kernel writer

Public acceptance may compare:
- source SHA
- configuration projection
- visual behavior
- read-only external projections where safe

It must not become a second production POS.

---

## 12. Public / physical parity rule

Repository/source parity alone is insufficient.

For any claim of parity capture:
- MFP exact source SHA
- public build identity/source SHA
- runtime candidate manifest source SHA
- public bundle SHA-256
- Carrier booted releaseId
- Carrier runtime channel
- device build/Carrier version
- actual functional observation

Statuses:
- SOURCE_VERIFIED for source/code
- DEPLOYED for published candidate/public artifact
- PHYSICAL_VERIFIED only after real-device acceptance

Never infer deployment from repository HEAD.

---

## 13. Builder V3 package identity

Builder A9 source migration must ensure the packaged runtime is:
`v3smt/dist`

Not:
`v2local/dist`

Before packaging verify at exact MFK SHA:
- `v3smt/package.json`
- `v3smt/index.html`
- A9 build identity source
- runtime.ready seam
- production adapter entrypoints
- A1–A9 tests

Runtime manifest must carry exact source SHA.

Candidate naming remains exact-source-derived.

---

## 14. Candidate publish gate

No candidate publish during ordinary A9 SOURCE implementation.

After:
- MFP A9 source exact SHA accepted
- Builder V3 migration SOURCE_VERIFIED
- production binding review accepted
- Owner explicitly authorizes candidate publish

only then update Builder:
`requests/mfk-runtime-ota-request.txt`

with:
- source_sha=<exact accepted A9 SHA>
- channel=candidate
- unique request_id

Candidate publish evidence required:
- Builder workflow run SUCCESS
- exact checkout SHA
- tests/build PASS
- signed bundle
- archive SHA-256
- public manifest exact releaseId/sourceSha
- public bundle re-download hash match
- `MFK_RUNTIME_OTA_PUBLISHED`

That is at most:
`DEPLOYED`

not PHYSICAL_VERIFIED.

---

## 15. Physical device acceptance

A9 must produce an explicit runbook/checklist before candidate activation.

On real MFP Pad device:

### Identity
1. Carrier version readback
2. candidate releaseId exact
3. download/signature/SHA verified
4. activate candidate
5. app boots
6. `runtime.ready` promotes candidate
7. Current = expected candidate
8. Previous retained
9. Candidate empty after promotion where protocol defines it
10. rollback path available

### Security
11. registered device
12. valid staff login
13. invalid PIN/proof rejected
14. expiry/revocation fail closed
15. restart session behavior as approved

### Sync
16. startup LKG
17. Admin change while app remains open
18. Doorbell arrives
19. canonical revision advances without refresh/restart
20. no fixed polling storm
21. offline LKG continuity
22. reconnect bounded delta catch-up

### Ordering / Checkout
23. Pad Ordering visual lock
24. product/option/combo
25. Hold/Retrieve/Dining handoff
26. required incomplete checkout blocked
27. formal price validation
28. Student Discount
29. cash keypad/change
30. Payment Confirm only formal boundary
31. double tap no duplicate Order

### Orders / Dining
32. Orders source lanes
33. READY -> IN_PROGRESS same Order
34. pickup
35. Dining direct seat
36. waiting -> table same Order
37. table transfer same Order
38. addition same Order
39. split checkout
40. real seatedAt/warning

### Availability / Capacity
41. sold-out/restore
42. capacity deduct
43. cancellation replenish once
44. channel thresholds
45. finite override
46. business-day reset evidence

### Money / Close
47. opening cash
48. Cash In/Out
49. cash sale
50. refund/correction
51. day close count
52. variance
53. retained cash
54. immutable report/later adjustment

### Print / Hardware
55. physical receipt
56. production ticket
57. packing
58. labels
59. partial label reprint
60. reprint no drawer
61. cash receipt drawer once
62. printer offline attention
63. ambiguous print no blind retry
64. restart/power-loss recovery

### Customer
65. pending pay-at-store
66. payment evidence review
67. WhatsApp QR/contact
68. accept once
69. modify confirmation
70. cutoff/immediate stop future-only

### Keeta
71. manual Immediate
72. Later 0→1→2
73. third Later blocked
74. auto accept policy
75. duplicate inbound no duplicate Order
76. lifecycle same Order
77. after-sale/refund
78. mapping/error attention

### Offline / Restart
79. WAN down local trading
80. app restart
81. device reboot
82. no duplicate Order
83. no duplicate print
84. no double capacity restore
85. no double money effect

### Mobile
86. MFP Mobile shared authority
87. touch-first flows
88. same canonical Order/payment state
89. cross-device concurrency/readback

Physical evidence must identify:
- device
- runtime release
- exact source SHA
- timestamp
- result for each gate

A source test is not a physical result.

---

## 16. Physical failure / rollback

If candidate causes critical physical failure:
- stop acceptance
- mark FAILED or BLOCKED with exact gate
- preserve evidence
- rollback to Previous using existing Carrier rollback
- verify Current becomes previous stable
- do not continue cutover

Do not “fix forward” on the live device without a new exact-source candidate.

---

## 17. Public domains / Cloudflare

Current repo-wide Cloudflare checks for `mfk-owner` and `mfk-customer` have been failing independently of V3 source lanes.

A9 must diagnose exact failure before public cutover.

Do not call those checks harmless once cutover is being considered.

For A9:
- source lanes may still be SOURCE_VERIFIED
- public cutover remains BLOCKED until relevant domain/build checks are green or formally superseded with verified replacement paths

Existing `.github/workflows/mfk-domain-cutover.yml` is a separate exact-source deployment mechanism.
Do not trigger it automatically.

Any domain cutover requires separate Owner authorization.

---

## 18. Public build identity

Add an A9 build identity mechanism for MFP V3 that can prove:
- exact source SHA
- build ID
- runtime/product target = MFP_V3
- build timestamp or deploy metadata when available
- mode = physical runtime / public acceptance

The identity must not expose secrets.

For ordinary browser acceptance, an explicit build identity route/surface may be used.
For Android runtime, diagnostics must show exact identity from packaged build + Carrier release.

No identity mismatch may be hidden by UI.

---

## 19. Production health / readiness verdict

Create one deterministic A9 readiness verdict from explicit gates.

Example categories:
- SOURCE
- BUILD_IDENTITY
- SECURITY_BINDING
- STORE_KERNEL_BINDING
- SYNC_BINDING
- CHECKOUT_BINDING
- ORDER_OPERATIONS_BINDING
- MONEY_BINDING
- PRINT_BINDING
- CUSTOMER_BINDING
- KEETA_BINDING
- BUILDER_V3
- PUBLIC
- PHYSICAL

Verdict rules:
- missing critical source/binding -> BLOCKED
- source bug/test failure -> FAILED
- published artifact only -> DEPLOYED
- real device all required physical gates -> PHYSICAL_VERIFIED

Do not output a synthetic green “ready” if a required production adapter is unavailable.

---

## 20. SMM decommission gate

SMM decommission is NOT automatic at A9 start.

Only eligible after:
- MFP Mobile SOURCE_VERIFIED
- MFP Pad SOURCE_VERIFIED
- A9 production binding accepted
- real device PHYSICAL_VERIFIED
- formal order/price/options/combo/auth/offline/print acceptance
- Customer/Keeta regression green
- no runtime dependency on SMM_INTENT_STORE / SMM HeadSeq / mfk-smm-web
- explicit Owner authorization

Until then:
SMM remains legacy compatibility / rollback evidence.

Do not delete SMM in A9 source implementation.

---

## 21. Cutover gate

Final cutover needs explicit Owner command after evidence review.

Before cutover provide:
- accepted exact MFK SHA
- accepted exact Builder SHA
- runtime candidate releaseId
- bundle SHA-256
- Builder workflow run
- physical device acceptance report
- rollback Previous releaseId
- public/domain readiness
- Customer/Keeta readiness
- unresolved blockers = none for required gates

Only then Owner may authorize:
- candidate/stable promotion as applicable
- official public routing
- legacy SMM decommission

No implicit cutover.

---

## 22. A9 UI

Continue `MFP_PAD_ORDERING_VISUAL_LOCK_R1`.

More / Tools should now expose functional:
- Check Center
- Diagnostics
- Runtime / OTA status
- Print / Hardware
- Backup / Restore status
- build/runtime identity
- fault journal

Keep technical detail behind diagnostics, not in high-frequency Ordering UI.

Mobile:
- same identity/readiness data
- touch-first
- no shrunken Pad

---

## 23. Required source tests

At minimum:

### Identity / runtime.ready
1. exact source SHA visible
2. build target MFP_V3
3. candidate appassets identity accepted
4. releaseId/runtimeVersion mismatch rejected
5. non-appassets runtime.ready rejected
6. StrictMode/remount sends runtime.ready once
7. stable packaged baseline identity handled explicitly
8. source mismatch blocks readiness

### Native bridge
9. trusted bridge request correlation
10. timeout fails closed
11. async completion correlated
12. public browser no native mutation
13. secret data excluded from diagnostics
14. unsupported native action fails visibly

### Production binding
15. security unbound blocks readiness
16. Store Kernel unbound blocks readiness
17. sync unbound blocks readiness
18. checkout validation unbound blocks readiness
19. order operations unbound blocks readiness
20. print unbound blocks readiness where physical required
21. Customer/Keeta unbound reflected explicitly
22. no fixture production fallback

### Formal router audit
23. high-level V3 command cannot be client-translated into fabricated canonical mutations
24. missing formal command router -> BLOCKED
25. no second Order/Pricing/Payment engine added

### Diagnostics
26. Carrier health readback
27. Store Kernel health readback
28. sync head/applied/checkpoint
29. print gateway/binding state
30. runtime current/candidate/previous
31. fault journal
32. no secrets in diagnostics
33. stable error codes
34. readiness verdict deterministic

### Backup/restore
35. safe presentation/hardware metadata may export where supported
36. sessions/secrets excluded
37. canonical business truth cannot be restored from browser backup
38. missing native canonical backup shows BLOCKED

### Builder guard in MFK source
39. A9 docs/control reference Builder PR #174
40. cutover refuses legacy v2local package identity
41. exact-source runtime candidate format
42. no publish request mutation in MFK A9 source stage

### Public acceptance
43. public build identity no-store semantics
44. public safe mode has no native print/drawer
45. public does not impersonate production device
46. public does not become Store Kernel writer
47. source parity remains UNKNOWN until deployed evidence exists

### Physical acceptance model
48. checklist requires exact device/runtime/source identity
49. physical result cannot be inferred from source tests
50. FAILED gate blocks promote
51. rollback retains previous release identity
52. candidate activation alone != PHYSICAL_VERIFIED

### Cutover/decommission
53. cutover requires explicit Owner authorization
54. SMM decommission requires physical acceptance
55. no SMM deletion in source stage
56. unresolved blocker prevents final-ready verdict

### Regression / architecture
57. A1 green
58. A2 green
59. A3 green
60. A4 green
61. A5 green
62. A6 green
63. A7 green
64. A8 green
65. no v2 client-state import
66. no SMM authority/state/head/session dependency
67. no new Order/Pricing/Payment/Print/Capacity authority
68. no periodic business polling
69. production build green
70. A9 static authority guard green

---

## 24. CI

Extend MFP V3 CI:
- install
- test
- typecheck
- build
- A0–A9 authority guard
- build identity guard
- runtime.ready compatibility guard
- production-binding fail-closed guard
- diagnostics secret guard
- no legacy V2 package-target assumption in A9 source

No deploy.

Builder PR #174 has its own source verification lane.
Do not trigger OTA publish request.

---

## 25. Change control

Mode:
`PREPARE`

MFK A9 allowed scope:
- current control docs
- A9 handoff
- manifest/workflow
- `v3smt/src/**`
- build identity/config needed for V3
- styles
- A9 acceptance/runbook docs

Carrier source:
READ ONLY by default.

If native capability truly missing:
STOP and report exact gap before Carrier modification.

Builder source changes:
only on Builder A9 branch/PR #174.
No request trigger mutation.

---

## 26. Completion target for first A9 Codex pass

The first A9 implementation pass targets:

`SOURCE_VERIFIED`

It must NOT claim:
- DEPLOYED
- PHYSICAL_VERIFIED
- cutover complete
- SMM decommissioned

The first pass must also report whether formal production binding is actually possible with existing authority contracts.

If not:
A9 remains SOURCE_VERIFIED + explicit BLOCKED production binding.

---

## 27. Completion report

Return exactly:

1. A9 source implemented
2. Build identity contract
3. runtime.ready compatibility proof
4. Native bridge adapter proof
5. Production security binding status
6. Store Kernel binding status
7. Formal command router audit
8. Sync production binding status
9. Checkout/Pricing binding status
10. Order Operations binding status
11. Money binding status
12. Print production binding status
13. Customer production binding status
14. Keeta production binding status
15. Check Center / Diagnostics
16. Store Kernel health proof
17. Sync diagnostics proof
18. Runtime/OTA diagnostics proof
19. Fault journal proof
20. Backup/Restore boundary proof
21. Public acceptance safe-mode proof
22. Public build identity proof
23. Readiness verdict proof
24. Builder V3 migration status / PR #174
25. Physical acceptance runbook
26. Rollback runbook
27. SMM decommission gate proof
28. Cutover gate proof
29. Changed files
30. Exact MFK SHA
31. Tests/results
32. CI
33. Production binding blockers
34. Candidate publish readiness
35. Next exact action requiring Owner authorization

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A9_PUBLIC_DIAGNOSTICS_PHYSICAL_CUTOVER_2026_10_02`
