# MFK SMT A3e Frontline Presentation｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / ADMIN DEPLOY GREEN / OTA GREEN

## Scope
A3e closes the bounded Frontline Presentation slice.

### Admin
Frontline Presentation now has an explicit 「保存並發佈」 action.
This creates a normal Admin release and sends the same canonical snapshot through the existing Admin → SMT/SMM sync path.

No second config transport was added.

### SMT
Existing Admin Frontline Presentation fields now affect the ordering surface:
- showImages: existing behavior preserved
- showCategories: existing behavior preserved
- quickProductIds: existing behavior preserved
- tabletColumns: now drives Product grid column count
- showDescriptions: now controls Product description visibility
- headline / body: can replace the compact mode guidance copy

Admin Product description is now projected into SMT catalog truth.

## Defaults
If no special Frontline value is published:
- tabletColumns falls back to 4
- description visibility follows the current Admin default
- Quick / Normal guidance falls back to the existing built-in operational copy

## Boundary
Presentation only.

Not changed:
- Order authority
- Pricing authority
- Payment / Tender
- Print
- Keeta / provider ingress
- Customer/SMM ingress
- A3c drink semantics
- A3d riceball/snack pairing
- standalone riceball drink promotion

## Landed
Product main:
`9903ae87bca927d9444c16b9cfd366c57c14f93a`

PR:
`#337`

Bank:
`bank/MFK/SMT-A3E-FRONTLINE-PRESENTATION-2026-09-26`

Files:
- v2admin/src/DeferredWorkspaces.tsx
- v2local/src/App.tsx
- v2local/src/runtime/admin-config-projection.ts
- v2local/src/features/ordering/OrderingWorkspace.tsx
- v2local/src/features/ordering/ordering-workspace-model.ts
- v2local/src/features/ordering/ordering-workspace.css
- v2local/src/presentation/smt-frontline-presentation-a3e.test.ts

## Proof
Bounded proof:
- run `36233650841` SUCCESS
- Admin 17 / 17 test files PASS
- Admin 113 / 113 tests PASS
- Admin build PASS
- SMT 38 / 38 test files PASS
- SMT 166 / 166 tests PASS
- SMT build PASS
- protected seams PASS
- diff check PASS

Post-merge:
- V2 Local POS Smoke `36233739463` SUCCESS

## Admin deployment
Request commit:
`c63e42887e22ecbbeb13f836534d8860f8db27d0`

Deploy run:
`36233769478` SUCCESS

## OTA
Exact OTA source:
`9903ae87bca927d9444c16b9cfd366c57c14f93a`

Builder request:
`16a6c7700b2c05a52199cc22a5c17c7ce168a851`

OTA run:
`36233778316` SUCCESS

Release:
`runtime-candidate-mfk-9903ae87bca9`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-9903ae87bca9.mfos`

Proof:
- exact-source checkout PASS
- V2 local tests/build PASS
- signed package PASS
- R2 publish PASS
- public manifest/hash/bundle readback PASS
- marker `MFK_RUNTIME_OTA_PUBLISHED`

## Cadence
Owner standing cadence is active:
IMPLEMENT → PROOF → MERGE → BANK → CANDIDATE OTA → PUBLIC READBACK GREEN → NEXT PART
