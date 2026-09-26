# MFK SMT + SMM + Customer Integrated Main Lock R1

DATE: 2026-09-26
TIME_HKT: 10:37
STATUS: CURRENT_DATED_AUTHORITY
CONTROL: Pantonyeung/mfk #321

## 1. Owner requirement

Before any further SMT optimization, the already-completed SMM and Customer integration data/flows must be confirmed inside main and locked.

This file records that exact integrated state.

## 2. Verified main

Fresh-read main before this manifest:

cfda2192c51b25f3b79925dcacb2b2c1c6604817

This is not a donor branch.
This is current main.

## 3. Critical integrated paths already in main

### SMT runtime / composition

- v2local/src/runtime/smm-lan-ingress.ts
  blob: 7893177e43458f8b077752470027bd655d2d0916

- v2local/src/runtime/smm-web-acceptance-intake.ts
  blob: 381993f438f30cfea27cb73d9b23c72b19ae5bdb

- v2local/src/runtime/customer-cloud-intake.ts
  blob: f7af54e520be43d067aa8a9d879fb64f9cedcf58

- v2local/src/main.tsx
  blob: 88f72b271d55886c24b73368dfa4e9f322d2d56e

### Customer side

- v2customer/src/cloud-runtime.ts
  blob: f8d5d0ef129b1473abf3f1bd50ac1cb7f393559a

### SMM side

- v2smm/src/smt-lan-adapter.ts
  blob: 34bb7d1450e4fe7b2f277b14f2401007aecd2d89

## 4. Integrated semantics confirmed

Current main contains the already-completed SMM / Customer → SMT integration semantics, including:

- Customer published-menu / menuRevision validation
- Customer local published price submission facts
- Customer payment-evidence reference path
- Customer UNKNOWN/readback-first behavior
- Customer → SMT canonical Order creation path
- SMM line-level publishedUnitPriceMinor forwarding
- SMM stable submissionId / idempotencyKey
- SMM LAN ingress / readback
- SMM public acceptance intake isolation
- SMM Internet bridge → SMT existing canonical ingress
- Web SMT acceptance isolation:
  production Customer / Keeta consumers are not installed when WEB_ACCEPTANCE_ONLY
- production SMT path retains normal Customer / Keeta consumers outside Web Acceptance mode

## 5. No-touch integration guard

All future SMT optimization branches MUST preserve these exact integrated semantics.

By default, no SMT optimization may alter:

- v2local/src/runtime/smm-lan-ingress.ts
- v2local/src/runtime/smm-web-acceptance-intake.ts
- v2local/src/runtime/customer-cloud-intake.ts
- v2local/src/main.tsx runtime installation/gating semantics
- v2customer/src/cloud-runtime.ts E2E submission/readback safety
- v2smm/src/smt-lan-adapter.ts E2E identity/pricing semantics

unless:
NEW REPRODUCIBLE DEFECT
→ EXACT FIRST BREAK
→ DATED OWNER APPROVAL
→ BOUNDED FIX
→ SMM + CUSTOMER + SMT regression
→ NEW DATED BANK

## 6. Optimization merge rule

Second SMT-team work is optimization only.

Before any selected SMT optimization lands:
1. diff these protected paths against this manifest/bank;
2. if any protected path changes without explicit approval, integration is RED;
3. run SMM and Customer regression against SMT;
4. preserve existing Admin and Keeta E2E;
5. only then merge the selected optimization;
6. create a new dated bank.

No wholesale donor merge.

## 7. Locked versions

Customer:
f963f96c-a0f7-46a4-b762-88b846bd91cc

SMM Web:
d82889dd-613e-43dd-881b-33a842ba3e9a

SMT Web acceptance:
d74eefe6-8584-4fb9-9b52-759c362366a5

Admin:
621400a9-63ca-4071-8138-be740e2b4ad8

Keeta functional anchor:
bb2b34e0f35b00ca374de0f4ca8d713ebd848684

## 8. Status

SMT_SMM_CUSTOMER_INTEGRATED_IN_MAIN
PROTECTED_PATHS_LOCKED
FIVE_PORT_E2E_NO_TOUCH
SECOND_SMT_TEAM_OPTIMIZATION_ONLY

NEXT:
SMT_OPTIMIZATION_BACKLOG_R1
