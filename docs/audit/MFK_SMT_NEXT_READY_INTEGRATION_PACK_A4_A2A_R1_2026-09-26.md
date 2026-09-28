# MFK SMT Next-Ready Integration Pack R1｜A4 + A2a

DATE: 2026-09-26
TIME_HKT: 13:01+
MODE: PRE-INTEGRATION AUDIT ONLY
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: Pantonyeung/mfk #321

CURRENT MAIN:
4351c894424bf242e6f32633192879f2f124c34a

A1:
PR #322
head 8129fa06de1a7440302a42583cdb4bbc84419b3e
READY_FOR_OWNER_ACCEPTANCE
NOT_MERGED
MERGEABLE

No product mutation is authorized by this packet.

## 1. A4 — Admin Table Registry in Hold Selector

### Current-main truth

Current main already has the real Admin table authority:
- readSmtDiningTableRegistry()
- readSmtStoreSettings().diningTables
- active filtering
- custom table names
- sortOrder
- localRuntime.readDining() consumes the published table registry
- fallback 1–9 exists when no registry is published
- orphan occupied table protection exists in Dining board

Therefore A4 is NOT a runtime or Admin-integration job.

### Exact mismatch

Only OrderingPage holdTables still does:

Array.from({length:9})
→ T01 ... T09
→ label 1 ... 9

So the same SMT can show:
- Dining board = Admin-published names
- 暫存／堂食 modal = hard-coded 1–9

This is a presentation inconsistency.

### Exact donor pattern

R5 donor:
5fc6581431df15927a613b06a6e41090b621a88b

Bounded pattern:

storeSettings.diningTables.length
? storeSettings.diningTables
: fallback T01–T09

Then:
- preserve table.id
- display table.name
- occupied from current heldCarts
- preserve occupied codeLabel

### Proposed A4 allowlist

ONLY:
- v2local/src/App.tsx
- one focused presentation/static test if needed

DO NOT TOUCH:
- v2local/src/runtime/admin-operational-config.ts
- v2local/src/runtime/local-runtime.ts
- admin-config-sync.ts
- Customer/SMM/Keeta seams
- Order/Payment/Print

### Acceptance

1. Admin custom table names appear in Hold/Dining selector.
2. active=false tables do not appear.
3. Admin sortOrder is preserved through storeSettings.
4. no registry → fallback T01–T09 remains.
5. occupied table is disabled and displays existing hold code.
6. Dining board behavior is unchanged.
7. integrated-main-e2e-lock remains GREEN.
8. full V2 Local Smoke GREEN.

Classification:
READY_TO_IMPLEMENT_AFTER_A1_DECISION
LOW_RISK_PRESENTATION_ALIGNMENT

## 2. A2a — SAME-line Product Edit

### Current-main truth

Current main already exposes cart-line edit affordance.

But current behavior is incomplete:
- onEditCartLine(lineId) finds the line;
- for normal product, panel opens only with productId;
- OrderingPanelState has no lineId;
- ProductConfigWorkspace always initializes from defaults;
- addConfigured() always creates a new CartLine.

Therefore pressing “edit” can create a second line instead of mutating the selected cart line.

### Donor evidence

PR #171 candidate:
c715d033275974ce6980e3943289a477ceead506

Recorded GREEN:
18 files / 67 tests
production build GREEN
browser 1280×720 + 1920×1080
no runtime files changed

Relevant donor semantics:
- OrderingPanelState product panel may carry lineId.
- Cart line edit opens:
  {type:'product', productId, lineId}
- Product editor receives initial qty/configuration.
- Save on edit updates cart.map() for SAME line id.
- Existing line serviceMode is preserved.
- UI says update/save rather than add duplicate.

### Important scope correction

Do NOT bring the full #171 product editor redesign.

A2a should only port the minimum state needed for SAME-line edit.

Current main CartLine currently persists:
- id
- productId
- name
- qty
- unitMinor
- serviceMode
- detail

It does NOT yet have the later donor ProductConfiguration shape.

Therefore a clean A2a should first decide the minimum reversible edit representation.

Two safe options:

A. Minimal current-main edit:
- initialize qty from selected line
- reconstruct visible selections from current detail only if deterministic
- preserve current detail/unit price unless user changes options
- update SAME line id

B. Configuration-aware edit:
- introduce explicit selected option ids + note into CartLine
- broader and couples to future A3 Fast Lane model

Recommendation:
Use A, not B, for A2a.

Do not introduce later Fast Lane composition contracts merely to solve same-line edit.

### Proposed A2a allowlist

Expected:
- v2local/src/App.tsx
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
- focused test

Possibly:
- ordering-center-workspaces.css only if edit/add label needs styling

Do NOT TOUCH:
- runtime/**
- Customer/SMM/Keeta/Admin bridges
- Checkout authority
- hold persistence contract
- Print

### Acceptance

1. Edit line keeps same line id.
2. Editing qty updates same line.
3. Editing option-derived price updates same line.
4. serviceMode stays unchanged.
5. no second cart line created.
6. cancelling/closing editor does not mutate cart.
7. checkout total equals updated cart total.
8. hold/restore does not duplicate line.
9. integrated-main-e2e-lock GREEN.
10. V2 Local Smoke GREEN.

Classification:
READY_AFTER_A4
LOW_MEDIUM_PRODUCT_UI_OPTIMIZATION

## 3. A1 dependency

Do not create A4/A2a product branches from stale main before A1 decision.

If Owner accepts A1:
A1 merge
→ new dated bank
→ fresh latest main
→ A4 clean branch

If Owner rejects/changes A1:
A4 still starts from whatever main becomes current after that decision.

This prevents stacking unaccepted product branches.

## 4. Protected hashes/seams before next product write

Must re-read before A4/A2a:
- customer-cloud-intake.ts
- smm-lan-ingress.ts
- smm-web-acceptance-intake.ts
- admin-config-sync.ts
- keeta-order-intake.ts
- v2local/src/main.tsx
- v2customer/src/cloud-runtime.ts
- v2smm/src/smt-lan-adapter.ts

Unexpected diff = RED.

## 5. Status

A4_EXECUTION_PACKET_READY
A2A_EXECUTION_PACKET_READY
A1_DECISION_REQUIRED_BEFORE_PRODUCT_WRITE
FIVE_PORT_E2E_FROZEN
SECOND_SMT_TEAM_PAUSED
NO_PRODUCT_MUTATION
