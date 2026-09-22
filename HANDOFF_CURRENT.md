# MFK CURRENT HANDOFF｜2026-09-22

Current system: **MFK only**.

Current main at handoff generation: `e325a05bb8e349a24d5a6a92a8c0b111f7c12c67`

Current navigation:
`docs/navigation/MFK_航海圖_V1.8_Round009_2026-09-22.txt`

Detailed seamless handoff:
`docs/handoff/MFK_Admin_Connection_Seamless_Handoff_R1_2026-09-22.txt`

Cloud / retirement lock:
`docs/governance/MFK_CLOUD_RUNTIME_BUDGET_AND_LEGACY_RETIREMENT_LOCK_R1_2026-09-22.md`

Keeta runtime guard:
`integrations/keeta/RUNTIME_SIMPLICITY_GUARD_R1.md`

## Current Admin Connection

A1:
`MFK_ADMIN_MENU_INDEX_A1_SEMANTIC_LINK_GREEN`

A2:
`MFK_ADMIN_A2_CONTROLLED_TRANSFER_IMPLEMENTATION_GREEN`

A2 real separate-device Owner walkthrough:
**PENDING**

A3 automatic network transport:
**NOT AUTHORIZED**

## Immediate next action

Run exactly one real A2 cross-device walkthrough:

Admin Publish Bundle
→ SMT Import / Apply
→ SMT Readback Receipt
→ Admin Import Receipt
→ MATCH

Hard rule:

`NO TARGET READBACK = NOT GREEN`

Do not start another connection seam until Owner has accepted that result.

## Permanent connection rule

`CONNECT ONE → TEST SAME PIECE → BANK → STOP → OWNER DECIDES NEXT`

## Cloud rule

MFK Cloud = EVENT-DRIVEN FIRST.

Business hours: `10:00–20:30 Asia/Hong_Kong`

Off hours: `LOW_TRAFFIC_MODE`

No one-minute global cron. No five-second watchdog. Cloud never blocks local SMT transaction.

## Legacy

Old Morefun-v2 Keeta runtime is RETIRED and must never be reconnected to MFK.

Legacy provider-side Cloudflare retirement remains tracked in #32.


## Canonical Domain

Canonical MFK Internet root:
`morefunos.com`

Canonical Admin:
`https://admin.morefunos.com`

`workers.dev` is bootstrap/temporary validation only and is not a canonical system URL.

Domain governance:
`docs/governance/MFK_CANONICAL_DOMAIN_GOVERNANCE_R1_2026-09-22.md`

Current provider state:
- dedicated MFK Cloudflare account exists
- `mfk-admin` bootstrap Worker exists
- Admin Custom Domain mapping is pending
- OTA remains untouched
