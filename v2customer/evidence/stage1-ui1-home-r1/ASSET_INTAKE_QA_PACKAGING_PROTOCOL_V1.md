# Customer Stage 1 — Asset Intake / QA / Packaging Protocol V1

WORK_ID: MFK-CUSTOMER-UI1-HOME-R1
STATUS: OWNER-APPROVED WORKFLOW
DATE: 2026-09-30

## Workflow

1. External image worker generates Stage 1 assets from the approved Asset Master List.
2. Worker returns each asset as an individual file.
3. UI Lead performs intake QA.
4. Rejected assets are not saved into runtime paths.
5. Accepted assets are normalized, renamed, and stored as master assets.
6. Runtime derivatives are created only after acceptance.
7. All accepted Stage 1 assets are wired into the app in one controlled integration batch.
8. Owner reviews the real implemented UI after packaging.
9. No Merge / Deploy / OTA without explicit Owner CONFIRM / PROMOTE.

## Required worker handoff per asset

- ASSET_ID
- role / target slot
- character: male / female / none
- canonical state
- source reference used
- file
- canvas dimensions
- transparent background: yes / no
- notes

## Intake QA

Every returned asset is checked for:

- exact MFK IP identity fidelity
- face / hair / glasses / clothing fidelity
- correct male/female design
- correct action / emotion
- transparent background where required
- no embedded copy
- no embedded Logo unless explicitly required
- no price / order number / fake product facts / fake UI
- clean edges at runtime scale
- readability at 80–88 CSS px for Active Order assets
- same canvas / anchor / baseline for male/female pairs
- file opens correctly
- no visible generation artifacts
- acceptable file size / decode cost

## Status

Allowed:
- RECEIVED
- QA_PASS
- QA_FAIL
- NEEDS_REVISION
- MASTER_ACCEPTED
- RUNTIME_READY
- WIRED
- OWNER_ACCEPTED

## Storage

Master accepted assets:
- v2customer/public/brand/stage1/order/
- v2customer/public/brand/stage1/hero/
- v2customer/public/brand/stage1/banner/
- v2customer/public/brand/stage1/icons/

Evidence / QA:
- v2customer/evidence/stage1-ui1-home-r1/assets/

## Master vs runtime

MASTER:
- preserve high-resolution accepted source
- keep transparency
- never destructively overwrite

RUNTIME:
- optimized WebP / PNG / SVG as appropriate
- sized for actual slot and device density
- generated from accepted master only

## Batch integration

Do not wire assets one by one during production.

When a logical batch is complete:
- freeze accepted asset list
- generate runtime derivatives
- update asset registry
- wire all relevant slots
- run 360 / 390 / 412 visual checks
- run focused tests / build
- produce final asset manifest
- present real app UI to Owner

## Current completed batch

Batch 1 generated examples currently exist for:
- AO-M-PREPARING
- AO-F-PREPARING
- AO-M-READY
- AO-F-READY

These are not automatically OWNER_ACCEPTED. Final acceptance happens during intake QA against the official IP references.
