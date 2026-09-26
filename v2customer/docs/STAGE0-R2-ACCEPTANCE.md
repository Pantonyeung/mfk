# MFK Customer UI｜Stage 0 R2 Acceptance Packet

WORK_ID: `MFK-CUSTOMER-UI-STAGE0-R2`

STATUS: `READY_FOR_COMMANDER_ACCEPTANCE`

BASE MAIN: `da66fb7c1642165d26456198ba21824346cf4035`

WORK BRANCH: `work/MFK/CUSTOMER-UI-STAGE0-R2`

MERGE: `FORBIDDEN UNTIL OWNER EXPLICITLY AUTHORIZES`

## Scope

Stage 0 only.

- Launch / Splash overlay
- first-visit video path
- returning-session fast path
- reduced-motion static path
- final two CTAs only:
  - 進入主頁
  - 進入會員頁
- underlying current App remains mounted so Customer runtime can preload while launch media is playing
- launch layer does not own transaction, pricing, payment, order, or fulfillment semantics

## Asset reality

### Enabled now

`STAGE0_HYBRID_CANDIDATE_A`

Video:
https://cdn.creativeclaw.co/u/6ad84d58/videos/e788f78a-6345-45fa-8d87-467699aa5795.mp4

Poster:
https://cdn.creativeclaw.co/u/6ad84d58/images/386b4f12-f5c2-4f96-8862-97d66425646e.png

### Reserved but disabled

- male
- female

No fake / substitute assets are invented. Runtime contains the slots and weights, but only actually approved available media can be selected. Missing variants fail closed to the enabled hybrid asset.

Target weights once all three approved assets exist:
- male 35
- female 35
- hybrid 30

## Runtime contract

- sessionStorage keeps one selected variant stable inside the current browser session.
- localStorage key `mfk.customer.launch.seen.v1` marks returning browser use.
- first visit:
  - autoplay
  - muted
  - playsInline
  - video ending exposes native CTA layer
- returning:
  - static/fast launch path
- reduced motion:
  - no launch video
  - static poster + native CTA
- media failure:
  - static poster remains visible
  - CTA becomes available
  - launch cannot permanently block the customer

## CTA semantics

`進入主頁`
→ existing `changeView('home')`

`進入會員頁`
→ existing `changeView('more')`

No second router and no replacement App shell.

## Source allowlist

Added:
- `.github/workflows/customer-ui-stage0-r2-smoke.yml`
- `v2customer/src/launch/launch-config.ts`
- `v2customer/src/launch/LaunchOverlay.tsx`
- `v2customer/src/launch/launch.css`
- `v2customer/test/stage0-launch-r2.test.mjs`
- `v2customer/docs/STAGE0-R2-ACCEPTANCE.md`

Modified:
- `v2customer/src/App.tsx`
  - import LaunchOverlay
  - one launch-open local UI state
  - mount overlay
  - CTA delegates to existing view change function

## TDD evidence

RED:
GitHub Actions run `36248294958`
Expected failure before implementation because launch source files did not exist.

GREEN:
GitHub Actions run `36248460510`
Job `108421913673`

- Install: SUCCESS
- Test: SUCCESS
- Build: SUCCESS

## Commander acceptance checklist

1. Branch is isolated from main.
2. No merge exists.
3. Main/current product source was not overwritten.
4. Stage 0 is an overlay only.
5. Current Customer runtime loads underneath the overlay.
6. Only two final CTAs exist.
7. Reduced Motion path exists.
8. Returning path exists.
9. Media error cannot trap customer permanently.
10. Male/Female slots are present but disabled until real approved assets exist.
11. Hybrid Candidate A is the only currently enabled media.
12. No product image was added.
13. No transaction authority was added.
14. CI Test + Build are GREEN.
15. Do not proceed to Stage 1 on this branch.

## Owner gate

Commander may review this Stage 0 branch.

No merge, landing, deploy, Stage 1 work, or mutation of the original/current branch is authorized by this packet.

MILESTONE TARGET:

`MFK_CUSTOMER_UI_STAGE0_R2_COMMANDER_ACCEPTED`
