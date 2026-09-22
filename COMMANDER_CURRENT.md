# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 12:14 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest control
3. docs/navigation/MFK_航海圖_V1.18_Round019_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. Owner priority

SMT OTA physical acceptance:
HOLD

Admin automatic publish:
P0 ACTIVE

Active issue:
#44

## 2. Owner architecture lock

Admin is the ONLY control plane.

SMT MUST NOT contain Admin mutation controls.

SMT operator MUST NOT:
- edit menu
- save Admin draft
- publish menu
- import Admin file
- choose install/apply
- acknowledge Admin publish manually

SMT may expose read-only status only:
- active menu revision
- last sync status/time
- pending catch-up state
- failure state for support

## 3. Manual A2 design is superseded

Historical #35 manual controlled transfer was an acceptance harness only.

It MUST NOT be used as production transport.

Manual flow now prohibited:
Admin download JSON
→ human file move
→ SMT import
→ human receipt move
→ Admin import

Current manually-created R20 file:
DO NOT APPLY

#35 remains useful only for:
- revision/fingerprint contract
- fail-closed validation semantics
- atomic apply semantics
- target readback shape

## 4. Correct production flow

Admin Draft
→ Validate
→ authenticated Publish
→ canonical published Menu revision commit
→ event-driven realtime doorbell
→ SMT detects newer revision
→ SMT automatic canonical fetch
→ validate revision + fingerprint
→ atomic Local LKG apply
→ POS switches automatically
→ automatic ACK/readback
→ Admin shows applied store revision

Realtime is notification only.
Canonical Menu snapshot is authoritative.

## 5. Offline rule

If cloud/realtime unavailable:
- SMT keeps current Local LKG
- Order / Checkout / Payment / Local Commit continue
- no transaction blocking
- no forced logout/install prompt

When connectivity returns:
- SMT automatically reads current canonical revision
- catches up to latest valid revision
- applies without operator choice
- sends readback automatically

## 6. Event/runtime rule

MFK cloud runtime:
EVENT-DRIVEN FIRST

No high-frequency polling.
No 5-second watchdog.
No global cron for Menu delivery.

Allowed safety reconciliation:
bounded reconnect/focus/startup revision check.

## 7. SMT UI correction required

Current:
LocalAdminMenuWorkspace exposes mutation/admin controls.

Target:
remove Admin control surface from SMT.

Replace with read-only Menu Sync Status if needed.

No "Admin · Menu" control page in production SMT navigation.

## 8. Security gate

Admin Publish mutation must be authenticated and fail-closed.

No public unauthenticated publish endpoint.

Store/tenant identity must be explicit.

Revision transition must remain monotonic and validated.

## 9. Existing current state

Admin:
legacy MF01 Menu re-entry GREEN
14 categories
203 products
188 active
15 inactive

SMT:
current Active R19

Admin manually-created target R20:
not production-applied

## 10. Exact NEXT

Implement #44 in one bounded seam:

1. publish/readback contract for canonical Menu revision
2. event-driven Admin Publish signal
3. SMT automatic fetch/apply
4. automatic SMT ACK/readback
5. remove SMT Admin mutation controls
6. keep read-only revision status
7. tests/build
8. deploy
9. Owner real-device proof:
   Admin Publish only
   → zero SMT touch
   → SMT auto R19→R20
   → Admin sees applied R20

Only then BANK:
MFK_ADMIN_SMT_AUTO_PUBLISH_GREEN

## 11. DO NOT
- no manual JSON transport
- no SMT Admin mutation UI
- no operator install choice
- no high-frequency polling/cron
- no unauthenticated publish
- no SMT OTA work while HOLD
- no Keeta live
