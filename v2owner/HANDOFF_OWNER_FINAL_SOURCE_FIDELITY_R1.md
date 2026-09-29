# MFK Owner App FINAL Source Fidelity｜R1

WORK_ID: MFK-OWNER-SOURCE-FIDELITY-FINAL-R1
BASE_MAIN: 6df0f2bdccdf05792909e99ee3771811cfd66e8e
SOURCE: MFK_Owner_App_UI_Package_FINAL_V1.0_2026-09-26
MODE: SOURCE_FIDELITY_AUDIT + BOUNDED_UI_FIX

## Authority
Owner App = WATCH / ALERT / REVIEW / BOUNDED ACT.
No second Order/Pricing/Payment/Print/Auth/Sync authority.
Current MFK main is implementation reality.

## Screen Gap Matrix

| Screen | Current files | Verdict | Difference / gap | Smallest fix |
|---|---|---|---|---|
| OA-TOD-001 Today | today-components.tsx, today-view-model.ts | SOURCE_FAITHFUL | Already landed source-fidelity path; do not rebuild | regression only |
| OA-ACT-001 Action Queue | stage02-action-queue.tsx | SOURCE_FAITHFUL | Existing list/detail/readback path; do not rebuild | regression only |
| OA-ORD-001 Orders | stage03-order-oversight.tsx | SOURCE_FAITHFUL | Existing oversight/detail path; do not rebuild | regression only |
| OA-CHN-001 Channels | channel-health.tsx | SOURCE_FAITHFUL | Existing desired/observed/health bounded-control surface | regression only |
| OA-SEL-001 Sellability | sellability.tsx | SOURCE_FAITHFUL | Existing sold-out/restore path; final assets already isolated under owner-final/sellability | regression only |
| OA-STF-001 Staff | staff-overview.tsx | SOURCE_FAITHFUL | Existing read-only staff surface | regression only |
| OA-DEV-001 Device | source-fidelity-wave2.tsx | PARTIAL | Functional list/detail exists; current art slots are placeholders; P1 diagnostic actions correctly not fabricated | replace placeholders only when exact final asset exists; keep read-only |
| OA-RPT-001 Reports | source-fidelity-wave2.tsx | FUNCTIONAL_VISUAL_GAP | 8-report shell exists, but 7d/30d disabled and visual composition differs from final source | align report navigation/filter presentation without inventing data |
| OA-LOG-001 Manager Log | source-fidelity-wave2.tsx | CAPABILITY_ENTRY_GAP | Log/checklist/handoff shells exist but formal shared log/checklist source is not wired; create/reply/check actions disabled | wire only existing canonical capability; no local second task/log truth |
| OA-AUD-001 Activity | source-fidelity-wave2.tsx | PARTIAL | Human-readable feed/detail exists; filters incomplete versus final spec; placeholder art slots | add date/action/resource/result filters when read model exposes fields; remove placeholder dependency |
| OA-MOR-001 More | source-fidelity-wave2.tsx | PARTIAL | Group IA exists; visual/source-specific icon/illustration fidelity incomplete | align groups/rows; exact assets only |
| Settings Summary | source-fidelity-wave2.tsx | SOURCE_FAITHFUL | Read-only summary + Admin deep-link follows final boundary | regression only |
| OA-ONB-001 Onboarding/Trust | App.tsx | PARTIAL | Auth gate exists but final onboarding/trusted-device visual journey not fully represented | preserve auth authority; UI-only fidelity pass |

## Asset Gap Matrix

Formal package assets:
- Logo_磨飯_MoreFun.png
- IP_Blue_三視圖.jpeg
- IP_Purple_三視圖.jpeg

Current repo:
- canonical logo exists at v2owner/public/brand/morefun-logo-canonical.png
- sellability has screen-specific final asset subtree
- later screens still contain `data-final-art-slot` placeholders in source-fidelity-wave2.tsx

Rule:
- no generic placeholder
- no one shared mascot for all screens
- no invented More Fun character
- if a source visual needs a screen-specific illustration/icon not supplied as an independent formal asset, classify EXACT_ASSET_MISSING rather than inventing it.

## Capability Entry Matrix

| Capability | Owner surface |
|---|---|
| Order diagnostic / timeline | Orders detail + Activity |
| Channel diagnostic | Channels |
| Keeta lifecycle | Channels / Orders external section |
| Money facts | Today / Orders / Reports |
| Print state | Devices + Action Queue |
| Sellability | Sellability |
| Device health | Devices |
| Reports | Reports |
| Audit | Activity |
| Manager Log / Checklist / Handoff | PRESENTATION EXISTS, canonical shared source wiring still required |

## Authority / Copy Regression Locks
- Normal Owner UI: no canonical/projection/readback/correlation/raw UNKNOWN/OA engineering IDs.
- Diagnostic/Audit detail may expose engineering facts progressively.
- Owner command must call existing authority and wait for readback.
- No optimistic fake green.
- No auto reprint after device recovery.
- No Owner-side pricing/order/payment/print writer.

## Current Evidence
Current main tree confirms:
- Today through Staff have dedicated source files.
- Later screens are concentrated in source-fidelity-wave2.tsx.
- source-fidelity-wave2.tsx contains placeholder art slots and safe-unavailable states.
- exact source package contains final visuals 00-11 and locked implementation spec.

## Next bounded implementation
1. Preserve Today–Staff unless regression found.
2. Remove/replace later-screen generic art placeholders only with exact formal assets.
3. Align Device, Reports, Manager Log, Activity, More to final visual hierarchy.
4. Wire capability entries only where current canonical runtime already exposes commands/read models.
5. Render 390/440 and 360 minimum.
6. Run build/tests; classify base-vs-candidate failures.
7. Land only independently accepted screens.

MILESTONE: OWNER_FINAL_SOURCE_FIDELITY_AUDIT_BANKED_R1
