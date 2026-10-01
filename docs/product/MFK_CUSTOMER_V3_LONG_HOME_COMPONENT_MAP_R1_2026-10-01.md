# MFK Customer V3 Long Home｜Component Map R1

Date: 2026-10-01  
Parent: MFK_CUSTOMER_V3_LONG_HOME_VISUAL_PRD_R1  
Target package: v3customer/

## 1. Shell

### CustomerV3App
Responsibilities:
- compose long page;
- no business truth;
- fixed safe-area bottom nav;
- max-width mobile preview.

Data:
- CustomerLongHomeVM only.

### Header
Visual:
- official logo;
- location pill;
- notification round button;
- search pill.

Runtime mapping later:
- location/store label <- Customer store projection;
- notification badge <- actionable customer notification projection only;
- search <- menu/discovery route.

## 2. Hero

### HeroCopy
DOM text only:
- eyebrow;
- headline;
- subline;
- CTA;
- supporting microcopy.

### HeroVisual
Assets only:
- HERO-M-DEFAULT;
- HERO-F-DEFAULT;
- decorative clouds/leaves/handwritten brand marks.

No:
- price;
- order state;
- product truth;
- address baked into image.

Layout target at 390px:
- Hero min height approximately 390px;
- text column ~47%;
- visual zone ~53-64% overlapping;
- male character front/high visual weight;
- female character secondary/right.

## 3. Quick Value Cards

Component: QuickValueCard
Count: 4
Fields:
- title
- subtitle
- icon
- tone
- click destination

Cards:
1. 今日精選
2. 人氣組合
3. 限時優惠
4. 30分鐘內可取

Production rule:
- card presence/labels may be Admin-config driven later;
- no fake availability promise without canonical timing data.

## 4. Category Rail

Component: CategoryShortcut
Count in visual target: 5
Behavior:
- compact cards;
- can become horizontal scroll below narrow threshold;
- selected category belongs to menu/discovery state, not homepage authority.

## 5. Product Recommendation Rail

Component: ProductCard
Source compatibility:
- MFK Customer UI Component Spec V1 ProductCard.

Fields:
- image
- localDisplayName
- currentPrice projection
- short description/tag
- favorite state
- quick add eligibility

Hard rules:
- SOLD_OUT -> no quick add;
- favorite mutation separate from add;
- no local price calculation;
- image fallback must never invent product identity.

Layout:
- horizontal overflow allowed;
- card width around 150px at 390 viewport.

## 6. Brand Banner

Component: BrandLifestyleBanner
Purpose:
- non-transactional brand storytelling;
- may use female or paired IP asset;
- content can be campaign/Admin projection later.

Hard rule:
- must disappear cleanly when no campaign, never block order flow.

## 7. Member / Invite

Components:
- MemberRewardCard
- InviteFriendCard

Data later:
- member points/reward <- member projection;
- invite reward <- approved campaign config.

Preview fixture:
- explicitly non-authoritative.

## 8. Recent Order

Component: RecentOrderCard
Fields:
- product/order summary
- historical time
- reorder CTA

Action:
- must route into current Reorder revalidation flow;
- never reopen historical Order.

## 9. Service Convenience

Component: ServiceShortcut
Visual target:
- delivery
- pickup
- store finder

Business note:
- first production scope remains store/pickup dependent;
- display only capabilities actually enabled by canonical config.

## 10. Lower Brand Story

Component: BrandStoryBlock
Purpose:
- explain handcrafted/light-food positioning;
- no business truth;
- may deep-link to About/brand page later.

## 11. Bottom Navigation

Current Owner-locked V3 visual:
- 首頁
- 菜單
- 訂單
- 我的

Older 2026-09-26 spec had:
- 首頁
- 點單
- 記憶罐
- 訂單
- 會員

Implementation rule for preview:
- render 4-item target;
- do not delete Memory Jar/member routes or capabilities;
- before production cutover ensure both remain reachable.

## 12. State projection

Homepage top-level states to support before production:
- LOADING
- READY
- EMPTY
- ERROR
- OFFLINE
- STALE
- CLOSED
- RETURNING
- ORDER_ACTIVE
- CAMPAIGN

No generic one-spinner implementation.

## 13. Visual acceptance regions

REGION-01 HEADER
REGION-02 HERO
REGION-03 QUICK_VALUE
REGION-04 CATEGORY
REGION-05 PRODUCTS
REGION-06 BRAND_BANNER
REGION-07 MEMBER_INVITE
REGION-08 RECENT_ORDER
REGION-09 SERVICES
REGION-10 BRAND_STORY
REGION-11 BOTTOM_NAV

AI correction order:
REGION-02 → 01 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11.

Reason:
Hero controls perceived fidelity; nav/details should not consume iteration budget before the main visual is correct.

## 14. Exact next implementation seams

A. Import Owner-confirmed HERO-M-DEFAULT / HERO-F-DEFAULT into repo-controlled V3 assets.
B. Store locked long-home screenshot as visual baseline.
C. Replace current stage0 preview Hero refs with approved Stage1 Hero refs.
D. Capture 390px screenshot.
E. Correct Hero geometry first.
F. Run 360 / 412 / 430.
G. Connect canonical read-model adapter only after visual shell stabilizes.
