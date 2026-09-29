# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING

Control: #22

Updated: 2026-09-29 23:22 Asia/Hong_Kong

System: MFK ONLY

## 0. Mandatory read order

1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/recovery/MFK_P0_RECOVERY_SALVAGE_AUDIT_2026-09-29.md
4. HANDOFF_CURRENT.md
5. Current remote Main and Draft PR state

## 1. One-line current reality

P0 incident salvage audit is complete; Current Main remains 6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a, four independent exact-base Candidate PRs are Draft only, and no merge/deploy/OTA has occurred.

## 2. Current authority / role boundary

- Owner: tomorrow selects one Candidate at a time and accepts or reverts after live evidence.
- Admin: canonical configuration and Cloud publish authority.
- SMT: local transaction, frontline runtime sellability and physical apply/readback authority.
- Provider: Keeta remains provider transaction/commercial evidence authority.
- Explicit non-authorities: Owner is not a second Admin; browser UI is not Cloud confirmation; source tests are not deploy/device/physical acceptance.

## 3. Exact current state

Current Main:
6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a

Controlled bank:
052295861931b72aa401aa6fa06c3cd65866706d

LAST_KNOWN_GOOD:
5ff4eea2f36d552923bfe1c46393da48d7a63573

Incident final research version:
7030a9e56b7e547940ee8c3d0cc118a189d99d97

Audit:
docs/recovery/MFK_P0_RECOVERY_SALVAGE_AUDIT_2026-09-29.md

Draft Candidates:

- #521 34ccfbd03d5a198ada34e99d39187ea7b9440918 — Dining live refresh
- #522 6a036e02d302f66621bd0d7a7ae5d5f0018fcd20 — table registry fail-closed
- #523 0552a5982d3c660542ee738377b629fe8d5f2510 — canonical Cloud publish confirmation
- #524 0e93e088003b629f28962a0f761f681d24cc5587 — bounded SMT Admin reconciliation

Every Candidate's direct parent:
6cb2d05ecfd49ca0a3bc972a03cb283ce1c64d1a

## 4. Verification

- Candidate 01 focused: 4/4; serialized v2local excluding exact-base CRLF red: 403/403; build PASS.
- Candidate 02 focused: 10/10; serialized v2local excluding exact-base CRLF red: 402/402; build PASS.
- Candidate 03 focused: 8/8; full v2admin: 212/212; build PASS.
- Candidate 04 focused: 8/8; serialized v2local excluding exact-base CRLF red: 403/403; build PASS.
- Exact-base pre-existing red: smt-owner-print-recovery-a2.test.ts uses an LF-only source assertion under Windows CRLF.
- No Builder, deploy, package, device, provider or physical acceptance is claimed.

## 5. Classification summary

ALREADY_PRESENT:

- PR #520 WebSocket transport and public SMT identity
- Admin source identity
- Keeta one-to-many/quantity/role/option mapping
- Keeta reference/effective money and pricing authority
- Keeta lifecycle/diagnostics
- SMT runtime sellability, projection and Business Day reset
- SMM ACCEPT/READY/idempotency/Dining exclusion/readback

KEEP / REBUILD:

- KEEP: #521, #524
- REBUILD: #522, #523

DROP:

- Customer Cloud quote revival
- Owner direct canonical availability mutation
- browser-vs-Cloud dual revision UX
- hard-coded global product version

QUARANTINE / UNKNOWN:

- Sync V2 in full
- Owner ONLINE_ONLY and restoreAt/expiry
- untrusted Customer/Owner/SMM/native source identity paths
- exact live revision behind Keeta auto-accept

## 6. Exact NEXT

Tomorrow, start with Draft PR #521 only:

Current accepted Main → merge #521 → CI → canonical SMT delivery → physical Dining refresh acceptance → accept checkpoint or immediate revert

Acceptance:

- A controlled Admin Dining display change reaches the physical SMT without restart.
- Matching revision/apply evidence is present.
- Existing holds/orders remain unchanged.

STOP condition:

- Any stale UI, duplicate mutation, non-matching revision, deploy failure or physical failure. Revert #521 before considering another Candidate.

## 7. Suggested remaining order

After a new accepted checkpoint for each PASS:

1. #521
2. #523
3. #522
4. #524

All dependencies are NONE; any failed Candidate can be bypassed.

## 8. DO NOT / NOT AUTHORIZED

- Do not merge more than one Candidate before acceptance.
- Do not merge any Candidate tonight.
- Do not deploy production tonight.
- Do not issue SMT OTA tonight.
- Do not restore the incident tree.
- Do not implement Sync V2.
- Do not mutate Keeta/provider state to investigate auto-accept.
- Do not turn Owner into a second Admin.

## 9. Resume command

> 接手 MFK P0 Recovery Salvage。先 fresh-read COMMANDER_CURRENT、#22 最新 controlling comment、完整 Salvage Audit、HANDOFF_CURRENT 同 remote Main/PR state。只由當前 accepted Main 揀一個 Draft Candidate，CI → Deploy → 實機驗收 → Accept/Revert；未完成回滾或新 checkpoint 前唔准開始下一件。
