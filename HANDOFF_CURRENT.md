# MFK CURRENT HANDOFF｜2026-09-22

Current navigation:
docs/navigation/MFK_航海圖_V1.18_Round019_2026-09-22.txt

Control:
#22

## CURRENT P0

#44
Admin → SMT automatic publish

## OWNER LOCK

Admin = only control plane.

SMT = execution client + Local LKG.

SMT must NOT contain:
- Menu editor
- Admin draft
- Publish button
- file import
- install/apply choice
- manual Admin acceptance

SMT may only show read-only menu sync/revision status.

## MANUAL A2

#35 manual file transfer is SUPERSEDED as production design.

Keep only:
revision/fingerprint/apply/readback contract semantics.

DO NOT apply the manually-created R20 JSON.

## TARGET FLOW

Admin Publish
→ authenticated canonical revision commit
→ realtime doorbell
→ SMT automatic canonical fetch
→ validate
→ atomic LKG apply
→ automatic ACK/readback
→ Admin shows applied revision

Offline:
use current Local LKG
→ transactions continue
→ reconnect auto catch-up

## EXACT NEXT

Implement #44 bounded seam.

Owner acceptance:
press Publish in Admin only.
No action on SMT.
SMT must change revision automatically.
Admin must receive applied revision readback.

SMT OTA #40 remains HOLD.
