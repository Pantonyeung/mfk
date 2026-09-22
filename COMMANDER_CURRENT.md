# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22
System: MFK ONLY

> Every Commander MUST fresh-read this file before acting.
> Every Commander MUST update this file again before returning work / ending the conversation / hitting context limits.

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. Pantonyeung/mfk #22 latest controlling comment
3. Current navigation listed below
4. `HANDOFF_CURRENT.md`
5. Exact active work issue(s)

Do not use an older report, handoff, navigation map, or Morefun-v2 document as current authority.

## 1. Current navigation

`docs/navigation/MFK_航海圖_V1.10_Round011_2026-09-22.txt`

Current navigation must be advanced whenever controlling state changes materially.

## 2. Current global reality

MFK is the only current system.

Exactly six external product roles:

1. SMT
2. Admin
3. SMM
4. Customer
5. Keeta
6. Owner

No seventh product.

One decision authority per business fact/action.

## 3. Permanent execution rule

`CONNECT ONE PIECE → TEST SAME PIECE IMMEDIATELY → BANK → STOP → OWNER DECIDES NEXT`

Never infer permission to open the next seam.

## 4. Current Admin state

A1:
`MFK_ADMIN_MENU_INDEX_A1_SEMANTIC_LINK_GREEN`
BANKED.

A2 implementation:
`MFK_ADMIN_A2_CONTROLLED_TRANSFER_IMPLEMENTATION_GREEN`
BANKED.

A2 real separate-device Owner walkthrough:
PENDING.

A3 automatic Admin→SMT network transport:
NOT AUTHORIZED.

## 5. Admin hosting / domain

Dedicated MFK Cloudflare account:
GREEN.

Worker:
`mfk-admin`

Canonical MFK Internet root:
`morefunos.com`

Canonical Admin:
`https://admin.morefunos.com`

Owner browser proof confirms current MFK Admin is live at the canonical domain.

Hosting milestones:

- `MFK_ADMIN_WORKER_DEPLOY_GREEN`
- `MFK_ADMIN_CANONICAL_APP_READBACK_GREEN`
- `MFK_ADMIN_HOSTING_H2_LIVE_GREEN`
- `MFK_ADMIN_CANONICAL_DOMAIN_H3_GREEN`

`workers.dev` is bootstrap/temporary validation only.

## 6. Current exact NEXT

Run one real A2 cross-device Owner walkthrough:

Admin:
`Pending Changes / 發布`
→ make one tiny Menu Index change
→ Validate
→ confirm A2 impact
→ enter exact SMT base revision
→ export A2 Publish Bundle

SMT:
→ import same bundle
→ apply Local LKG
→ prove observed revision/fingerprint
→ state MATCH
→ export SMT Readback Receipt

Admin:
→ import same receipt
→ expected revision = observed revision
→ expected fingerprint = observed fingerprint
→ Compare = MATCH

Only then BANK:

`MFK_ADMIN_A2_OWNER_CROSS_DEVICE_GREEN`

## 7. DO NOT

Until Owner explicitly authorizes:

- NO A3 automatic Admin→SMT network transport
- NO Cloud polling
- NO D1/KV/DO transport
- NO Pricing seam
- NO Modifier seam
- NO Combo seam
- NO SMM→SMT
- NO Customer→SMT
- NO Owner remote command
- NO Keeta live wiring
- NO OTA migration/cutover

## 8. Cloud permanent rule

MFK Cloud = EVENT-DRIVEN FIRST.

Business hours:
`10:00–20:30 Asia/Hong_Kong`

Off hours:
`LOW_TRAFFIC_MODE`

Forbidden:

- global 1-minute heavy cron
- 5-second liveness watchdog
- multi-domain scheduled drain
- background polling just to discover no work

Cloud failure must never block SMT local:

- Order
- Checkout
- Payment
- Local Commit

## 9. Keeta current state

MFK Keeta:
THIN EDGE ADAPTER ONLY.
NOT_WIRED.

Old Morefun-v2 Keeta:
RETIRED.
Never reconnect MFK to it.

## 10. OTA current state

OTA remains untouched on the legacy endpoint/account until a separate Owner-authorized OTA migration seam is opened.

Do not combine OTA migration with Admin/Keeta work.

## 11. Canonical evidence/control surfaces

- #22 = append-only controlling coordination log
- #39 = Commander seamless handoff protocol
- `COMMANDER_CURRENT.md` = mandatory stable current entry point
- `HANDOFF_CURRENT.md` = detailed current handoff
- current navigation = state/control index

## 12. Mandatory Commander return protocol

Before every return / completion / context handoff:

1. Fresh-read current main + #22.
2. Update `COMMANDER_CURRENT.md` to exact observed reality.
3. Remove stale NEXT text.
4. Record exact:
   - WORK_ID
   - issue
   - branch
   - commit / landing commit
   - test run
   - provider/manual evidence
   - GREEN/RED/UNKNOWN
5. State exactly ONE current NEXT.
6. State all NOT_AUTHORIZED / DO_NOT items.
7. Post the same return summary to #22.
8. If a current navigation state materially changed, publish a new navigation round.
9. Never include passwords, API token values, secrets, or private credentials.

No Commander work is considered fully returned until this handoff is updated.

## 13. New-chat resume command

Use the reusable prompt in:

`docs/commander/COMMANDER_BOOTSTRAP_PROMPT.txt`

Template source:

`docs/commander/COMMANDER_HANDOFF_TEMPLATE.md`
