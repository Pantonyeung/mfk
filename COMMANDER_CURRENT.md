# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Control: #22
Updated: 2026-09-25 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order
1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/navigation/MFK_航海圖_V1.30_Round031_2026-09-25.txt
4. HANDOFF_CURRENT.md
5. current physical evidence

## 1. Current exact state

Product source:
`75759607ba05720f723c77d282327b7f1386f616`

Source/build verification:
`36084376938` SUCCESS

Canonical Carrier OTA publish:
`36085973121` SUCCESS

Carrier:
`1.0.7 / 107`

Current public APK:
`MoreFunOS-SMT-1.0.7-mfk-75759607ba05.apk`

APK SHA-256:
`b521d509f93143e191e9df363b91409e499dc0788776f067e88469611c791046`

Public Carrier OTA manifest/readback:
GREEN

Independent replay:
`36085863280` SUCCESS, same SHA-256.

Canonical Builder release path:
`.github/workflows/mfk-carrier-ota.yml`
→ `requests/mfk-carrier-ota-request.txt`

Temporary parallel duplicate publisher path:
RETIRED.

Current milestone:
`MFK_CARRIER_1_0_7_OTA_PUBLISHED_GREEN`

Current first break:
STORE PHYSICAL INSTALL + SMM LAN/QR ACCEPTANCE NOT YET PROVEN.

## 2. Locked architecture

SMM is PWA/Web only. No SMM APK.

Primary:
SMM PWA → Carrier LAN HTTP/JSON :17831 → SMT.

LAN failure never blocks staff ordering.

QR is only an Order Intent transport.
QR cannot allocate Formal Order / Display.

Formalization remains:
intent → SMT current Menu/Pricing revalidation → Store Kernel → Formal Order.

No second Order Engine.
No second Pricing Engine.
No second Store Kernel.

## 3. OTA governance

Recovery has two independent controls:
- Runtime OTA URL
- Carrier OTA URL

Existing OTA origin/bucket reused.
No new OTA backend/domain.

One active MFK Carrier release workflow only.

## 4. Exact NEXT

PHYSICAL ONLY.

Store SMT:
- Recovery → check Carrier OTA
- offered = 1.0.7 / 107
- install
- installed Carrier = 1.0.7 / 107
- normal SMT boot
- Runtime/Carrier OTA URL controls intact

iPhone:
- Safari PWA LAN probe / pair / one order
- iOS Chrome LAN probe
- LAN unavailable non-blocking proof
- QR fallback proof
- same-intent replay zero duplicate Formal Order
- SMT restart sanity

## 5. Commander rule

Do not write new product code before physical evidence.

If GREEN:
BANK `MFK_CARRIER_1_0_7_SMM_PWA_LAN_QR_PHYSICAL_GREEN`.

If RED:
record LAST_GREEN / FIRST_BREAK / EXPECTED / ACTUAL.
Open only the smallest seam that explains the physical RED.

No architecture rewrite from a browser/device compatibility failure.
