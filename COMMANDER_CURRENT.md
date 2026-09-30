# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Control: #22
Updated: 2026-09-30 12:30 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. #22 latest controlling comment
3. `docs/control/MFK_CHANGE_CONTROL.md`
4. `HANDOFF_CURRENT.md`
5. live repository / deployment / physical evidence relevant to the task

If a document conflicts with live repository evidence, report `GOVERNANCE_DRIFT` and repair the controlling record before product promotion.

## 1. Current live source / deployed Admin

Current live Main:

`0776cffed4afa6b8ecb6e5a5e4e822b1a54dd53e`

This is PR #591 / Admin bootstrap saved-state R3.

Deployment evidence:
- deploy-mfk-admin run `36668946920` = SUCCESS
- production source readback = `0776cffed4afa6b8ecb6e5a5e4e822b1a54dd53e`
- R3 is SOURCE/DEPLOY GREEN but PHYSICAL RED

The older UI-forensic base and 2026-09-25 carrier handoff are historical context only and are not current execution authority.

## 2. Current Owner execution mode

Controlling Owner rule from #22:

`ONE REPAIR → ONE PHYSICAL CHECK`

Rules:
1. Only one active repair at a time.
2. Finish one bounded Candidate.
3. Do not merge/deploy without explicit Owner `PROMOTE`.
4. Owner performs real browser/device acceptance.
5. If RED, return to the same repair. Do not start another surface.
6. Customer / Owner / SMM / SMT / Keeta implementation remains parked while this Admin repair is RED.

Active execution issue:

`#586 Admin Online Bootstrap Must Converge Before READY`

## 3. Latest physical evidence

Owner physical evidence at 2026-09-30 12:30 HKT:

Normal iPhone Safari with existing saved browser state:
- same URL: `https://admin.morefunos.com`
- still shows `等待正式發佈`
- still shows `已排隊`

Fresh ChatGPT in-app browser on the same URL:
- sees current Cloud published state
- sees `SMT 已套用`

Therefore R3 remains:

`PHYSICAL_RED`

#22 evidence comment:
`5904392394`

## 4. Current first-break split

The remaining first break is not yet proven. Only two branches are allowed:

A. Normal Safari is still executing an older already-loaded Admin document / JS bundle, so current R3 bootstrap code never runs.

B. Normal Safari has loaded current Admin JS, but persisted local sync-outbox/status survives or re-enters `QUEUED`.

Do not guess between A and B.

## 5. Current PREPARE Candidate

Draft PR:

`#593 P0 R4: normal Safari build/outbox diagnostic`

Base:
`0776cffed4afa6b8ecb6e5a5e4e822b1a54dd53e`

Purpose:
- diagnostic only
- expose loaded Admin source SHA prefix
- expose local saved outbox count
- expose last canonical-hydration fingerprint prefix
- expose local sync state

No sync semantics are changed by this Candidate.

Expected screenshot:
- badge begins `R4 <sha7> · O<n>`
- detail begins `C<fingerprint> · <sync-state>`

Interpretation:
- no R4 marker = stale loaded shell / JS proven
- R4 marker + O>0 / QUEUED = persisted outbox path proven

## 6. Hard scope

Allowed product scope:
- Admin browser diagnostic only
- no outbox pruning/replay behavior change in R4
- no Customer / Owner / SMM / SMT / Keeta code
- no OTA
- no cache clear / logout / Private mode as acceptance workaround

No second Order, Pricing, Availability, Config, or Sync authority.

## 7. Admin authority invariant

Admin remains the sole canonical authority for published configuration.

Formal chain:

`ADMIN FORMAL PUBLISH → CLOUDFLARE PUBLISHED TIME → DOORBELL → SMT CANONICAL PULL → ATOMIC APPLY → UI REFRESH → ACK / READBACK`

Hard rules:
- human-facing freshness uses Cloudflare publish time
- Rxx/revision is diagnostic only
- persistent browser storage is cache/LKG only
- UNKNOWN is not FAILED or SUCCESS
- no interval polling as an authority substitute

## 8. Exact NEXT

PREPARE only:
1. finish PR #593 CI/review
2. keep PR #593 Draft
3. do not merge/deploy until explicit Owner `PROMOTE #593`
4. after promotion, deploy Admin only
5. Owner opens normal Safari without clearing cache/logout/private mode
6. capture top-right R4 diagnostic line
7. choose A or B from evidence
8. next Candidate fixes only that proven seam

MILESTONE: `MFK_ADMIN_NORMAL_SAFARI_R4_DIAGNOSTIC_PREPARE_CURRENT`
