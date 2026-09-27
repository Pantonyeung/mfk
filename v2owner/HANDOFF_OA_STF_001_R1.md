# MFK Owner App｜OA-STF-001 Handoff R1

STATUS: READY_FOR_COMMANDER_ACCEPTANCE

ISSUE: #398
PR: #401
BRANCH: work/398-oa-stf-001-r1

FRESH MAIN:
c2d5b016fe3dd08d276e915ae0f0fb2301e964cf

CODE HEAD:
0e36fbceb82db228511e7b3937f5f3c470ce1db6

BEHIND MAIN AT CODE ACCEPTANCE GATE:
0

## Source

Owner UI Package FINAL V1.0:
- 02_CURRENT_FINAL_VISUALS/06_Staff_Overview_V1.png
- 04_IMPLEMENTATION_UI_SPEC/MFK_Owner_App_Implementation_UI_Spec_FINAL_V1.0.md
- Screen OA-STF-001

## Scope

Read-only staff summary only:
- 上班中
- 排班 vs 實際
- 休息
- 工時
- 員工提醒
- 角色摘要

Staff Detail:
- Identity & Employment
- Today
- Role & Capability Summary
- History & Audit

Entry points:
- Today → 查看員工
- More → 員工
- Route: /staff

## Current canonical reality

Current main staff projection is sourced from canonical Admin `staffAuth`.

Available:
- staff identity
- display name
- role
- capability / permission summary

Not available in current canonical projection:
- attendance / clock events
- scheduled-vs-actual attendance
- break events
- worked hours
- staff attendance alerts
- labour KPI source

Therefore OA-STF-001 displays **未有資料** for those domains.
It does not infer attendance from:
- SMT login
- store business hours
- role
- local browser data

## Authority / security

READ ONLY.

Forbidden and not implemented:
- create staff
- disable staff
- role change
- permission change
- PIN / credential reset
- attendance mutation
- payroll / wage display

Normal UI does not expose:
- raw PIN
- pinVerifier
- password
- hash
- salt

No second Staff / Auth / Attendance / Payroll authority.

## Files changed

- `v2owner/src/App.tsx`
- `v2owner/src/staff-overview.tsx`
- `v2owner/src/styles.css`
- `v2owner/test/migration.test.mjs`

Admin / backend files:
- NOT TOUCHED

## Verification on code head

- owner-runtime-connection-r2 #36305843230 — SUCCESS
- owner-hosting-r1-smoke #36305843358 — SUCCESS
- admin-identity-canonical-r1 #36305843234 — SUCCESS
- owner-stage03-main-landing-r1 #36305843295 — SUCCESS

## External handoff copies

Google Drive:
https://docs.google.com/document/d/1k85uT8nVQXpT4MreKs1VTm7trIHhmk5ZApd8HU1oFhw/edit?usp=drivesdk

Jade Note:
a24dc852-3c1b-4475-82f6-1fde6ed9109b

## Governance

NO MAIN MERGE

NO DEPLOY

## Milestone

READY_FOR_COMMANDER_ACCEPTANCE
