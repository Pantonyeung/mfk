# MFK Customer V3｜Asset Replacement Contract R1

Date: 2026-10-01
Status: CURRENT FOR CUSTOMER V3 VISUAL ASSETS

## 1. Owner decision

Do not recompress approved ChatGPT image-generation masters merely to fit an implementation path.

The source/master asset keeps original image quality.

For the Hero background the canonical logical filename is:

`hero-background-main.png`

Recommended source path:

`v3customer/src/assets/brand/hero/hero-background-main.png`

## 2. Why the filename stays stable

The product code references one semantic asset identity, not a design-round filename.

Correct:
- `hero-background-main.png`

Avoid as runtime identity:
- `hero-background-r2.png`
- `hero-background-r3-final-final.png`
- `hero-background-compressed.webp`

Git already provides version history.

Replacing the artwork means replacing the file at the same semantic path.

## 3. No quality-loss rule

Master:
- keep original PNG bytes;
- no manual JPEG/WebP quality reduction;
- no downscale unless separately approved;
- no re-render through screenshot;
- no copy through a lossy tool.

If later delivery optimization is required, create derived build artifacts from the master while preserving the original master unchanged.

## 4. Build/cache rule

Store source art under `src/assets` and import it through the Vite build graph.

Reason:
- source filename can stay stable;
- Vite emits content-hashed production filenames automatically;
- replacement artwork gets a new build hash;
- browser cache can update without changing the semantic source name.

## 5. Current R3 correction

Current file:
`v3customer/public/brand/r3/hero-world-bg-r3.webp`

is RETIRED as the final-quality authority because it is a compressed derivative.

It may remain only as temporary preview evidence until the original PNG master is placed at the canonical source path.

Final acceptance must use:
`v3customer/src/assets/brand/hero/hero-background-main.png`

## 6. Replacement workflow

1. Generate/approve the image in ChatGPT.
2. Preserve original PNG.
3. Replace the same canonical source file.
4. Build.
5. Vite emits a new fingerprinted asset.
6. Run 360/390/412/430 visual acceptance.
7. No React/CSS path rename required.

MILESTONE: MFK_CUSTOMER_V3_STABLE_ASSET_IDENTITY_LOCKED


## 7. Confirmed R2 bucket and runtime route

Owner screenshot and existing repository configuration confirm:

- R2 bucket: `mfk-customer-assets`
- public access: disabled
- existing binding vocabulary: `CUSTOMER_ASSETS`

Customer V3 R2 object key:

`customer/brand/hero/hero-background-main.png`

Runtime route:

`/media/customer/hero/hero-background-main.png`

The V3 preview Worker reads the private R2 object through the `CUSTOMER_ASSETS` binding and returns it with ETag plus revalidation caching.

Public R2 access does not need to be enabled.

The previous lossy repository WebP derivative has been removed from the Candidate.


## 8. Five-asset R2 relay completed

Date: 2026-10-01

Temporary relay:
- branch: `temp/MFK-CUSTOMER-R2-ASSET-RELAY-20261001`
- PR: #621
- relay commit containing original PNG bytes: `9a3de8d9ae6da56435ec2495412af1ca5fbff381`
- upload/readback workflow run: `36846666919`
- job: `relay-r2-assets` = SUCCESS

R2 bucket:
`mfk-customer-assets`

Verified exact readback hashes:

- `customer/brand/hero/hero-background-main.png`
  - SHA256 `4c7169f5c57f12f445eb9222e71750f3476b4de0433424867d4442e238cd1db1`
- `customer/brand/hero/hero-male-main.png`
  - SHA256 `231d7a2848af5f8eb689d4d41a6d8114236d9fdfc76c9179948612fc70ccf8ba`
- `customer/brand/hero/hero-female-main.png`
  - SHA256 `22e1b2bee4d5cc11c514e4885f2450d74439f9caa8f78081ed3e711a17546bbe`
- `customer/brand/hero/hero-doodle-morefun-main.png`
  - SHA256 `06ac2e24485964613dff929bd2404ac17708f5ab50b8fa3dbcab475ee354ece7`
- `customer/brand/hero/hero-doodle-goodtaste-main.png`
  - SHA256 `584b1e7bd6fab50c55494bab5cce7c80635736bd647ed5d1ee626aed5f74cfd1`

The workflow also removed the stale uppercase zero-byte object:
`customer/brand/hero/hero-background-main.PNG`

Customer V3 runtime now consumes all five assets through private R2 Worker routes.

Candidate verification after R2 route wiring:
- v3customer-ci run `36846933021` = SUCCESS
- Regression Shadow run `36846933055` = SUCCESS
- v3admin existing check run `36846933041` = SUCCESS

MILESTONE: `MFK_CUSTOMER_V3_FIVE_HERO_ASSETS_R2_EXACT_READBACK_GREEN`
