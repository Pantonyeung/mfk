# MFK Customer UI1｜Asset Manifest R1

Date: 2026-10-01
Scope: Customer Home Hero / Banner assets
Authority: Owner-confirmed assets only

## Global retention rule

- Owner-confirmed Hero/Banner assets are retained in R2 and are not deleted during normal rotation.
- Runtime changes use status / schedule / priority / manifest pointers.
- Lifecycle status vocabulary: `ACTIVE / ROTATING / PAUSED / SEASONAL / EXPIRED / ARCHIVED`.
- Deletion requires explicit Owner instruction or legal/corruption cleanup.

## HERO-UI1-BRAND-R1

- Asset ID: `HERO-UI1-BRAND-R1`
- Owner status: `OWNER_CONFIRMED`
- Rotation status: `ACTIVE`
- Semantic type: `IP_STORY`
- Use: Customer UI1 Home Hero carousel / fullscreen Hero detail
- Master format: PNG
- Master dimensions: 941 × 1672
- Master bytes: 2,358,609
- SHA256: `5a4c4d0a148bca33f22c31651c3fcf74b3c0d594687f3173dfb6a06b718692ce`
- R2 bucket: `mfk-customer-assets`
- R2 key: `customer/ui1/hero/master/hero-brand-r1.png`
- R2 write verification: SUCCESS
- R2 object size verification: 2,358,609 bytes
- R2 ETag: `25e96b9ae4cfcd3e254ba823b68fd5a7`
- Source generation id: `b45e50de-1356-47e1-b2eb-fc15dac362b6`
- Creative asset name: `MFK-Customer-UI1-HERO-BRAND-R1-MASTER`

### Runtime rule

- Preview and future Main must reference the same R2-backed asset authority.
- Do not duplicate this image into `public/` as the production source.
- Do not use the Creative Claw CDN as the production authority.
- Runtime WebP / AVIF derivative can be added separately after final crop/compression lock.
- The master PNG remains immutable once promoted.

### Current status

`MASTER_IN_R2 / OWNER_CONFIRMED`

Runtime derivative:
`PENDING`
