# MFK Customer R2 acceptance map

## Complete route map

| Destination | Primary task | Normal next step | Recovery |
| --- | --- | --- | --- |
| Home | Decide whether and what to order | Start ordering | Store unavailable fallback, refresh, active-order entry |
| Order | Browse and select a real product | Open progressive product sheet | Search reset, category change, sold-out explanation |
| Product | Complete one choice group at a time | Add/update Memory Jar | Inline required/min/max/unavailable repair, back step, dismiss |
| Memory Jar | Review and repair the current intent | Final review | Per-line edit/remove, add more, material-change repair |
| Checkout | Confirm contact, quote and submit once | Wait for store result | UNKNOWN readback of the same intent, no blind resend |
| My Orders | Understand canonical fulfillment | Pickup or inspect history | Rejected/delayed/unknown states, detail timeline |
| My Memory | Review the relationship and return | Buy again or start order | Per-module empty/loading/error/stale/disconnected states |

## Golden Path

`Home → Order → Product detail → Progressive configuration → Memory Jar → Checkout → Safe submit → Store received → Accepted → Preparing → Delayed/updated ETA → Ready → Pickup verification → Handed over → Completed → History → Current revalidation → New Memory Jar`

The order stages remain distinct. `READY` is not `ARRIVED`, `VERIFIED`, `HANDED_OVER` or `COMPLETED`.

## Memory ecosystem

| Surface | Connected | Empty | Loading | Disconnected/error/stale |
| --- | --- | --- | --- | --- |
| Memory Jar | Current local intent, canonical quote where available | Abstract empty jar + start action | Quote slot retains geometry | Local intent remains; no final price invented |
| Seeds | Actual value, progress, next benefit, history | Explicit no-data state | Stable projection skeleton | Waiting-for-official-data copy |
| Coupons | Available/locked/used/expired with detail | Explicit no-coupon state | Stable projection skeleton | No local discount calculation |
| Badges | Earned/locked, detail, progress/date | Explicit no-badge state | Stable projection skeleton | No frontend award rule |
| Preferences | Confirmed preferences and frequent tastes | Explicit no-preference state | Stable projection skeleton | Pickup contact never overwrites identity/preferences |

## Design tokens

- Base: `#ffffff`, `#f7f8fa`
- Ink: `#111218`
- Purple-rice: `#5a2d82`, deep `#321044`
- Fresh green: `#168d63`
- Appetite coral: `#ed654c`
- Cool neutral line: `#dfe2e8`
- Radius: 12 / 18 / 26 / 34 px
- Touch target: 44 px minimum; primary controls 50–60 px
- Typography: system sans, high-weight food/product hierarchy, no decorative body face

## Motion tokens

- Micro press: `110ms`, scale `0.97`
- Text/layout: `210ms`
- Sheet/shared layer: `300ms`
- Product sheet dismissal threshold: distance `140px` or velocity `850px/s`
- Pull refresh threshold: `76px` or velocity `720px/s`
- Reduced motion: transitions collapse to near-zero, origin morph/parallax/orbit are removed; state changes remain functional.

## Browser interaction acceptance

Executed against the isolated `visual-acceptance.html` runtime harness. The harness is not referenced by the production `index.html` and is not in the production Vite entry.

| Proof | Browser observation |
| --- | --- |
| Home | Store availability, active order, food hero, dominant CTA, recommendation, Buy Again and memory ecosystem rendered. |
| Menu | Category, expandable search, grid/list, projected imagery/price and sold-out semantics rendered. |
| Product steps | Step 1 variation, step 2 required rice, step 3 required sauce and subsequent add-on/final steps advanced with completion summaries. |
| Memory Jar empty | Empty jar, explanation and start-order action rendered. |
| Memory Jar populated | Live count, line edit/quantity/remove confirmation, preferences, contact, suggestions, quote and sticky next action rendered. |
| Checkout | Item count, official quote status, separated pickup contact and unique submit action rendered. |
| Pending / UNKNOWN | Same-position transaction surface changed to “正在確認訂單結果”; only readback action remained. |
| Current Order / Ready | Canonical tracker rendered; pickup code was the Ready focal point with arrival/verification/handover separation. |
| History | Immutable history cards and current-menu rebuild action rendered. |
| Member / Seeds / Coupons / Badges | Connected collections rendered from the test runtime; production-without-port rendered honest waiting-for-data states. |
| iPhone | 390 × 844 acceptance completed. |
| Android | 412 × 915 acceptance completed. |
| Keyboard/focus | Search expands and autofocuses the input; dialog opens on a close control, Escape dismisses, and focus returns to the originating product control. |

## Screenshot manifest

All captures are in `evidence/r2/` and were generated from the browser acceptance surface at the stated mobile viewport.

| Required proof | File |
| --- | --- |
| Home / iPhone | `01-home-iphone.png` |
| Menu | `02-menu-iphone.png` |
| Product detail / step 1 | `03-product-step-1.png` |
| Product step 2 | `04-product-step-2.png` |
| Product step 3 | `05-product-step-3.png` |
| Memory Jar empty | `06-memory-jar-empty.png` |
| Memory Jar populated | `07-memory-jar-populated.png` |
| Checkout | `08-checkout.png` |
| UNKNOWN | `09-pending-unknown.png` |
| Pending | `10-pending.png` |
| Current Order / Preparing | `11-current-order-preparing.png` |
| Ready / pickup code | `12-ready-pickup.png` |
| Order History | `13-order-history.png` |
| Member / Seeds | `14a-member-seeds.png` |
| Coupons / Badges | `14b-coupons-badges.png` |
| Member not connected | `15-member-not-connected.png` |
| Android 412 × 915 | `16-home-android.png` |
| Reduced motion functional sheet | `17-reduced-motion-functional.png` |
| Keyboard search focus | `18-keyboard-search-focus.png` |

## Authority result

- Capability registry stays at 58 entries.
- All 5 command shapes stay `NOT_WIRED`.
- Runtime remains injection-only.
- No direct network path or donor runtime import.
- No second Order, Pricing, Payment, Auth, Sync, Member or Loyalty engine.
- Cart, checkout draft and pending intent persistence remain `LOCAL_NON_AUTHORITATIVE`.
- Reorder still uses `buildReorderCart` current validation.
