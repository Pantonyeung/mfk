# MFK Customer Port Convergence R1 Handoff

日期：2026-09-27  
Issue：#413  
Branch：`work/MFK/CUSTOMER-PORT-CONVERGENCE-R1`

## Receiver / donor lineage

- Fresh main：`c2d5b016fe3dd08d276e915ae0f0fb2301e964cf`
- Accepted UI8 receiving chain：`76b9132d55fe9028fe8dfd988f361ce3f8cc2456`
- UI8 is descendant of fresh main, behind main = 0 at convergence start.
- Historical UI0 donor：`715c6796f0c606ab1104829fa5422ac95382072a`
- Historical UI1 donor：`264ebaf4d84a47ddbe7d782ad745f1ae0ee4a72c`

No donor branch was wholesale merged.

## UI0 source reconciliation

Historical UI0 only had a live hybrid candidate while male/female were disabled. That behavior is superseded.

FINAL Customer source is implemented as:

- male / female only
- Cold Launch resolves 50:50 once per session identity
- chosen role remains stable through one launch/session
- First Visit CTA readiness ≈ 3.3s
- Returning CTA readiness ≈ 1.1s
- Reduced Motion CTA readiness ≈ 0.65s
- no video dependency
- layered/programmatic motion
- bounded timer + asset-error fallback
- only two CTAs: 進入主頁 / 進入會員頁
- launch overlays current runtime so snapshot preload continues underneath
- launch owns zero Order/Pricing/Payment/Fulfillment authority

## UI1 source reconciliation

Historical Stage1 storefront anatomy is reconciled against FINAL source:

- Logo + store status header
- Hero
- Announcement
- Top 6
- 記憶券 / 常購清單 / 期間限定
- closed-store browse remains allowed
- current recommendation/menu projections only

The historical Stage1-specific bottom-navigation implementation was intentionally not restored. UI1 reuses the accepted current UI8 `BottomNavigation`, preserving one fixed five-item navigation and one central Memory Jar implementation across UI1–UI8.

## Preserved accepted UI8 semantics

- UI2–UI8 wiring remains present.
- Historical Order remains read-only.
- Reorder remains current-truth/freshness-gated.
- no direct Stage8 Order commit.
- saved-template FIRST_BREAK remains diagnostic-only.
- no UUID/internal IDs added.
- no Stage9.

## Verification

New deterministic convergence contract:

- `v2customer/test/customer-port-convergence-r1.test.mjs`

Final PR CI must prove:

- full Customer tests + build
- Admin full tests + build + Wrangler dry-run
- v2local Customer canonical revalidation + build

NO MAIN MERGE UNTIL COMMANDER GREEN  
NO DEPLOY
