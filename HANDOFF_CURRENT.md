# ADMIN V3 CURRENT PRODUCT PHASE｜2026-09-30

Controlling product candidate:
`docs/product/MFK_ADMIN_V3_PRODUCT_BRIEF_R1_2026-09-30.md`

Product issue:
#601

Current strategy:
- stop A1/A2 incremental implementation progression
- lock the whole Admin V3 product, functions, IA, UI and acceptance first
- then execute one isolated one-shot V3 rebuild
- v2 production remains untouched until full V3 acceptance

Parked references:
- PR #599 A1: implementation reference only, not to merge during product lock
- #600 A2: superseded as implementation roadmap; ideas may be reused only if consistent with #601

---

# ADMIN V3 PRODUCT GATE｜2026-09-30

Controlling candidate product brief:
`docs/product/MFK_ADMIN_V3_PRODUCT_BRIEF_R1_2026-09-30.md`

Product control:
#601

Owner direction:
- lock complete Admin functionality + IA + UI before further implementation;
- stop A1/A2 incremental implementation roadmap;
- rebuild Admin V3 once as one isolated product program;
- v2 Production remains live until full V3 preview/physical acceptance.

Current implementation status:
- A0 foundation remains merged.
- PR #599 A1 is frozen / not to merge while #601 is pending approval.
- #600 A2 incremental spec is superseded as implementation roadmap by #601.

---

# SYSTEM-WIDE CURRENT AUTHORITY｜2026-09-30｜R2

Parallel Web Client Rebirth:
`docs/governance/MFK_WEB_CLIENT_PARALLEL_REBIRTH_AUTHORITY_R2_2026-09-30.md`

Root control:
#596

Implementation strategy:
- keep current v2 production baseline running
- stop broad in-place v2 state-architecture migration
- build isolated V3 web clients in parallel
- preserve backend / Cloud canonical / SMT / API contracts
- no production cutover until V3 physical/browser acceptance is GREEN

First slice:
`v3admin` A0 foundation only, zero production routing.

---

# SYSTEM-WIDE CURRENT AUTHORITY｜2026-09-30

Web/browser state sovereignty:
`docs/governance/MFK_WEB_STATE_SOVEREIGNTY_AUTHORITY_R1_2026-09-30.md`

Root control:
#596

Applies to Admin / SMM / Customer / Owner / future web ports.

Cloud/server state = TanStack Query.  
Durable explicit browser outbox = Dexie / IndexedDB.  
Local draft/UI = React/Zustand only.  
Derived server status must not become durable browser authority.

---

# MFK CURRENT HANDOFF｜2026-09-25

Current navigation:
docs/navigation/MFK_航海圖_V1.30_Round031_2026-09-25.txt

Control:
#22

## Current

Carrier 1.0.7 + SMM PWA LAN/QR software/release gate is GREEN.

MFK product source:
`75759607ba05720f723c77d282327b7f1386f616`

Source/build verification:
`36084376938` SUCCESS

Canonical Carrier OTA publication:
`36085973121` SUCCESS

Published Carrier:
- 1.0.7 / 107
- package `com.morefunos.smt`
- APK `MoreFunOS-SMT-1.0.7-mfk-75759607ba05.apk`
- SHA-256 `b521d509f93143e191e9df363b91409e499dc0788776f067e88469611c791046`
- public manifest + APK hash readback GREEN
- evidence artifact `10844450207`

Independent release replay:
`36085863280` SUCCESS
- same product source
- same APK SHA-256

Canonical Builder path:
- `.github/workflows/mfk-carrier-ota.yml`
- `requests/mfk-carrier-ota-request.txt`

Temporary parallel duplicate publisher path has been retired. One active MFK Carrier OTA path remains.

Milestone:
`MFK_CARRIER_1_0_7_OTA_PUBLISHED_GREEN`

## Locked architecture

SMM = PWA/Web only.

Primary:
PWA → LAN HTTP/JSON :17831 → SMT.

LAN unavailable:
other allowed path / QR fallback; staff ordering remains unblocked.

QR = Order Intent only.
SMT revalidates current Menu + Pricing before Store Kernel creates Formal Order.

Runtime OTA URL and Carrier OTA URL remain independently configurable.

## Exact NEXT

Physical Ring 3 only. No product code before physical evidence.

1. Store SMT Recovery → check Carrier OTA.
2. Fresh offered version must be 1.0.7 / 107.
3. Install and confirm Carrier 1.0.7 / 107.
4. Confirm normal SMT boot + independent Runtime/Carrier OTA URL controls.
5. iPhone Safari on store LAN: PWA LAN probe + one real staff order.
6. iOS Chrome: repeat LAN capability evidence.
7. Make LAN unavailable: verify no blocking and fallback available.
8. QR Order Intent → SMT revalidation → exactly one Formal Order / Display.
9. Replay same QR/intent: zero duplicate Formal Order.
10. Restart SMT and repeat one LAN/QR sanity path.

Success target:
`MFK_CARRIER_1_0_7_SMM_PWA_LAN_QR_PHYSICAL_GREEN`

If RED:
STOP at exact FIRST BREAK and fix only that seam.
