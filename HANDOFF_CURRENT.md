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
