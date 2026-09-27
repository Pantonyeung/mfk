# MFK Owner App｜OA-STF-001 Handoff R1 Reacceptance

STATUS: READY_FOR_COMMANDER_REACCEPTANCE

ISSUE: #398  
PR: #401  
BRANCH: work/398-oa-stf-001-r1

## Commander correction source

Current command: GitHub #398 comment 5854345534.

This packet supersedes the previous READY_FOR_COMMANDER_ACCEPTANCE handoff.

## Corrected scope

OA-STF-001 remains READ ONLY.

### Human employee ID
- Normal Owner UI reads canonical human `loginId` / employee code only.
- Internal `staffId` remains key / stable correlation identity only.
- Missing or unsafe fallback loginId renders: `未有員工編號資料`.
- A loginId equal to internal staffId or display name is treated as unreliable legacy fallback and is not shown as employee code.

### History & Audit custody
- Audit attribution uses stable canonical staff identity fields only:
  - `actorStaffId`
  - `requesterStaffId`
  - `approverStaffId`
- `staff.name` is never used for attribution.
- Historical name-only rows remain unattributed and render: `未有可可靠歸屬 Audit 讀回`.
- Same-name staff regression is covered.

### Capability summary
- Raw permission tokens are not present in normal Owner staff projection.
- Canonical permissions are projected through a bounded human-readable label map.
- Unknown / absent permissions do not leak raw tokens.
- Missing safe summary renders: `未有能力摘要資料`.

### Unchanged safety boundary
- attendance / clock / break / worked-hours have no canonical source => `未有資料`
- no create / disable staff
- no role / permission mutation
- no PIN / credential reset or display
- no Wage / Payroll display
- no second Staff / Auth / Attendance / Payroll authority

## Preview failure classification

CLASSIFICATION: **PRE_EXISTING / PREVIEW_ENV_CONFIG — ADVISORY**

Evidence:
1. PR #401 Cloudflare preview reported both `mfk-owner` and `mfk-customer` failed at old head `22d35e2`, and again at corrected code head `ea0a964`.
2. PR #402 is an SMM / v2local-only change set (no `v2owner/**` and no `v2customer/**` files), yet Cloudflare preview also failed both `mfk-owner` and `mfk-customer` on commit `d9469de`.
3. PR #403 is Customer-focused and contains no `v2owner/**` files, yet Cloudflare preview still failed `mfk-owner`.
4. Required GitHub CI for the corrected OA-STF code head is green, including Owner tests/build, Admin tests/build and Wrangler dry-run.

Therefore the Cloudflare preview failures are not attributable to the OA-STF candidate delta and are classified as preview environment/config behaviour rather than NEW_REGRESSION.

## Files changed in OA-STF reacceptance branch

- `v2admin/worker.ts`
- `v2admin/src/owner-runtime-connection.test.ts`
- `v2owner/src/product-types.ts`
- `v2owner/src/staff-identity.ts`
- `v2owner/src/staff-overview.tsx`
- `v2owner/test/migration.test.mjs`
- `v2owner/HANDOFF_OA_STF_001_R1.md`

Existing R1 routing / visual files retained:
- `v2owner/src/App.tsx`
- `v2owner/src/styles.css`

## Final receipt binding

Exact `FINAL_HEAD`, exact final CI run IDs, fresh main and behind-main are bound after this handoff commit in:
- GitHub #398 final worker return
- PR #401 body
- Google Drive handoff
- Jade Note handoff

Those four receipts are the authoritative final identity to avoid a self-referential Git commit SHA.

## Governance

NO MAIN MERGE  
NO DEPLOY
