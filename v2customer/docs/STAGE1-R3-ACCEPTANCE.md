# MFK Customer UI｜Stage 1 R3 Acceptance Packet

WORK_ID: `MFK-CUSTOMER-UI-STAGE1-R3`

STATUS: `READY_FOR_COMMANDER_ACCEPTANCE`

BASE MAIN: `46f15641de536c988e496987f6504e8efa6d096c`

WORK BRANCH: `work/MFK/CUSTOMER-UI-STAGE1-R3`

MERGE: `FORBIDDEN UNTIL OWNER EXPLICITLY AUTHORIZES`

## Authority used

This branch is implemented from the locked UI work, not the legacy homepage design:

1. MFK 客戶端 Product Brief V1.1 FINAL
2. MFK Customer UI Component Spec V1
3. MFK Customer UI 一致性總審核 V1
4. MFK Customer UI Frontend Handoff V1
5. Current MFK runtime read models only for live data

Legacy `HomeView`, legacy `HeroCarousel`, legacy homepage shell chrome, and legacy homepage navigation presentation are not used as the Stage 1 implementation surface.

## Stage 1 locked anatomy

- Fixed Header
  - official More Fun / 磨飯 logo asset
  - store status badge
- Large Visual / Hero
  - AI-generated brand artwork
  - no product photo
- Announcement Strip
  - store notice readback
  - AI-generated artwork as decorative image
- Top 6
  - current recommendation projection
  - sold-out excluded
  - bounded to 6
  - product image area intentionally blank placeholder
- Quick Entries
  - 記憶券
  - 常購清單
  - 期間限定
- Bottom Navigation
  - 首頁｜點單｜記憶罐｜訂單｜會員
  - 記憶罐 fixed center
- Closed store
  - still Browse / Build Cart
  - formal commit remains outside Stage 1 and may block later

## Visual contract

Tokens used:
- Brand Navy `#15396B`
- Brand Orange `#F07F24`
- Warm Background `#F7F1E9`
- Surface `#FFFDFA`
- Success `#3A9A68`
- Error `#D75D5D`

Layout:
- mobile-first
- 480px content shell
- safe-area bottom navigation
- 44px minimum touch target
- reduced-motion fallback

## AI / media rules

AI-generated Stage 1 artwork:
https://cdn.creativeclaw.co/u/6ad84d58/images/57ce2f93-c8d0-491d-9bd0-23a2be364d14.png

Official logo asset:
https://cdn.creativeclaw.co/u/6ad84d58/images/402357b6-d757-4238-99f7-3d20607da6f2.png

Product photography:
- intentionally NOT rendered
- product card media remains neutral blank placeholder
- no old food photos reused

No AI-generated text, price, address, opening hours, or promotion is treated as commerce authority.

## State contract

Stage 1 has distinct presentation for:
- LOADING
- READY
- ERROR
- OFFLINE
- STALE / PARTIAL
- NOT_CONNECTED
- Top 6 empty

Status is never represented by color alone; user-readable labels are always present.

## Data / authority boundary

Stage 1 may read:
- Store Status / ETA / Notice
- Menu availability
- current product projection
- current recommendation projection
- member coupon count
- cart item count
- current active order projection
- historical order summary

Stage 1 does NOT:
- quote formal price
- decide sold-out truth
- redeem coupon
- upload payment evidence
- create formal order
- allocate display number
- mutate fulfillment
- submit checkout

## Source allowlist

Added:
- `.github/workflows/customer-ui-stage1-r3-smoke.yml`
- `v2customer/src/stage1/Stage1Home.tsx`
- `v2customer/src/stage1/Stage1BottomNavigation.tsx`
- `v2customer/src/stage1/stage1.css`
- `v2customer/test/stage1-home-r3.test.mjs`
- `v2customer/docs/STAGE1-R3-ACCEPTANCE.md`

Modified:
- `v2customer/src/App.tsx`
  - routes only Home surface to Stage1Home
  - suppresses legacy header/status/nav only while Home is active
  - keeps all other current views unchanged
  - Top 6 recommendation limit raised from 4 to 6

## TDD evidence

RED:
- Run `36250031538`
- Expected RED: Stage1Home source missing.

GREEN:
- Run `36250233489`
- Job `108426768391`
- npm test: SUCCESS
- npm run build: SUCCESS

## Explicit supersession

`work/MFK/CUSTOMER-UI-STAGE1-R2` is an abandoned exploration branch because it reused legacy homepage design assumptions.

It is NOT an acceptance source and must NOT be merged.

## Commander acceptance checklist

1. New Stage 1 is visibly/spec structurally independent from legacy HomeView.
2. Header = logo + store status.
3. Hero uses AI artwork, no real product image.
4. Announcement strip exists and disappears when no notice.
5. Top 6 is bounded, projection-based, sold-out excluded.
6. Product image slots remain blank placeholders.
7. Three quick entries are exact.
8. Bottom nav is exact and Memory Jar is center.
9. Closed store still permits browse.
10. Loading / Error / Offline / Stale / Empty are distinct.
11. Touch target / mobile max width / reduced motion are present.
12. No commerce authority moved into Stage 1.
13. No Stage 0 mutation exists on this branch.
14. No Stage 2 mutation exists on this branch.
15. Test + Build are GREEN.

## Owner gate

Commander may review this Stage 1 branch.

No merge, landing, deploy, Stage 2 implementation, or mutation of the original/current branch is authorized by this packet.

MILESTONE TARGET:

`MFK_CUSTOMER_UI_STAGE1_R3_COMMANDER_ACCEPTED`
