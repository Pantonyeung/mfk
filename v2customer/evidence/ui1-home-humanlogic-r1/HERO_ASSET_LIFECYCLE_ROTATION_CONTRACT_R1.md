# CUSTOMER UI1｜Hero Asset Lifecycle + Rotation Contract R1

Date: 2026-10-01
Status: OWNER HARD REQUIREMENT

## 1. Hero content types

Every Hero slide must declare one semantic type:

1. IP_STORY
   - Purpose: brand / IP story / character world
   - Tap destination: story detail / brand detail
   - Must not pretend to be a product

2. PRODUCT
   - Purpose: promote one real menu product
   - Tap destination: open that exact product
   - Requires canonical productId
   - Price / availability / image come from runtime menu truth

3. CAMPAIGN
   - Purpose: period-limited / drinks / seasonal / launch / promotion
   - Tap destination: campaign detail or relevant category/product
   - Requires campaign authority / active period when applicable

4. HOLIDAY_INFO
   - Purpose: store holiday / closure / special opening schedule
   - Tap destination: monthly holiday / opening information
   - Must come from store/business schedule truth
   - Must never invent closure dates

## 2. Permanent retention rule

Owner hard requirement:

**Hero and Banner assets must not be deleted as part of normal rotation.**

Once an asset is Owner-confirmed and promoted to R2:
- master file is immutable
- asset record remains in manifest
- asset may be ACTIVE, ROTATING, PAUSED, SEASONAL, EXPIRED, or ARCHIVED
- changing current Home presentation means changing manifest/config references, not deleting old files
- old assets remain available for future reuse / seasonal return / audit

Deletion is allowed only for:
- legal/compliance removal
- accidental duplicate/corrupt upload
- explicit Owner delete instruction

## 3. Rotation model

Hero assets are reusable inventory.

Example lifecycle:

GENERATED
→ OWNER_CONFIRMED
→ MASTER_IN_R2
→ ACTIVE
→ ROTATING
→ PAUSED / SEASONAL / EXPIRED
→ REACTIVATED later

No normal path includes DELETE.

## 4. R2 keying

Masters:
`customer/ui1/hero/master/<asset-id>.png`

Runtime derivatives:
`customer/ui1/hero/runtime/<asset-id>.webp`
`customer/ui1/hero/runtime/<asset-id>.avif`

Banners:
`customer/ui1/banner/master/<asset-id>.png`
`customer/ui1/banner/runtime/<asset-id>.webp`

Asset IDs are versioned and immutable.

## 5. Runtime config

Home must not hard-delete or overwrite an old asset.

Runtime selection is controlled by config/manifest such as:

```
id
type
assetId
status
priority
startAt
endAt
tapAction
targetId
```

Changing the Home means:
- enable/disable
- reorder
- schedule
- replace active pointer

not delete the underlying R2 object.

## 6. Content rotation policy

Suggested cadence:
- IP_STORY: evergreen, rotate periodically
- PRODUCT: rotate with menu / featured product truth
- CAMPAIGN: active only in valid campaign window
- HOLIDAY_INFO: active only around relevant date range

The UI may show 4–6 Hero items at once, but the asset library can keep many more historical approved assets.

## 7. Tap-action contract

IP_STORY:
`OPEN_STORY(storyId)`

PRODUCT:
`OPEN_PRODUCT(productId)`

CAMPAIGN:
`OPEN_CAMPAIGN(campaignId)` or `OPEN_CATEGORY(categoryId)`

HOLIDAY_INFO:
`OPEN_STORE_SCHEDULE(month)`

Unknown target:
do not render as tappable Hero.

## 8. Audit

Every Hero/Banner manifest row records:
- assetId
- semantic type
- R2 key
- runtime derivative key
- SHA256
- Owner status
- current status
- start/end window if any
- tap action
- target id
- created date
- last activated date

## 9. Permanent rule

**Approved visual assets are retained and rotated, not deleted and recreated.**
