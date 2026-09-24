# MFK Customer R2 donor ledger

Work ID: `MFK-CUSTOMER-ORDERING-DONOR-FUSION-R2`

Target base: `16164e7418333aaebbb1a0c9d3a90fe8f637b869`

Donor freeze: `Pantonyeung/morefun-ordering-web@279ff15be687903e9c270da7241d62dd17e4981b`

The donor was inspected as a product and interaction donor only. No donor runtime is imported by the MFK production entry.

## KEEP

| Donor concept | R2 use |
| --- | --- |
| Five customer destinations | Home, Order, Memory Jar, My Orders, My Memory remain the primary mental model. |
| Food-first home | Large editorial food imagery, clear store availability, one dominant ordering action, active order priority. |
| Stable menu browsing | Category rail, inline search expansion, list/grid continuity, visible sold-out items. |
| Product feedback | Immediate selected state, sticky actions, quantity and add feedback. |
| Memory Jar | A complete ordering surface with empty/populated evolution, line editing, quantity, removal confirmation, contact, quote and checkout progression. |
| Orders and memories | Current order, detail, history, buy again and Care entry. |
| Member language | Seeds, next care, coupons, badges, remembered tastes, recent memory and buy again. |
| Mobile interaction | Safe areas, snap carousel, pull feedback, sheets, skeleton geometry and reduced-motion support. |

## ADAPT

| Donor behavior | R2 adaptation |
| --- | --- |
| Carousel autoplay | Manual swipe and snap with accessible controls; no forced autoplay. |
| Pull to refresh | Calls the existing injected runtime read only; no page reload or background retry. |
| Welcome overlay | Replaced by contextual home/member copy that never blocks ordering. |
| Add-to-cart response | Memory Jar count transformation, local status message and stable navigation badge. |
| Member cards | Connected data renders as provided; absent data becomes a deliberate waiting-for-data state. |
| Food assets | Three donor-owned food photographs are used as brand/editorial imagery. Product images remain optional projection fields. |
| PWA/mobile ideas | Viewport, theme color and safe-area treatment kept; incomplete donor runtime/PWA topology was not copied. |

## REDESIGN

| Surface | R2 composition |
| --- | --- |
| Visual system | White/near-white base, purple-rice brand, fresh green, controlled coral, black typography and cool neutrals. |
| Home | Status, active order, image-led story, one CTA, recommendations, buy again and memory ecosystem. |
| Product | Progressive variation/group/add-on/quantity-note steps with completion summaries. |
| Memory Jar | Abstract premium jar states, stable transaction alignment and local line repair. |
| Checkout | Three-step final confirmation with one same-position submit/readback action. |
| Orders | Canonical status tracker with Ready pickup code as the focal point and explicit handover boundaries. |
| My Memory | Premium relationship space with complete Seeds, Coupons, Badges, tastes, recent memory, safe recovery and Care modules. |

## DROP_AUTHORITY

- `FRONTEND_STORE_RULES_LOCK` and frontend final price calculation.
- Apps Script action authority, Firebase topology and Google Sheet authority.
- WhatsApp as formal order commit path.
- Phone-last-four as canonical pickup identity.
- Local fabricated order or member truth.
- Hard-coded seed, energy, coupon or badge unlock rules.
- Donor product/price fallback data in production.
- Background auto-submit, blind retry, timer success or animation success.
- Donor beige/retro visual system and accumulated CSS patch architecture.

## Donor feature to current MFK capability

| Donor feature | Current MFK seam | Classification |
| --- | --- | --- |
| Store status, menu, products | `CustomerReadModelSnapshot.store/menu` | CURRENT_DATA_EXISTS |
| Memory Jar | persisted local non-authoritative cart + optional canonical quote | CURRENT_DATA_EXISTS |
| Checkout contact | persisted checkout draft | CURRENT_DATA_EXISTS |
| Submit recovery | pending intent + submit/readback runtime ports | CURRENT_DATA_EXISTS |
| Current orders | active order projection | CURRENT_DATA_EXISTS |
| History / Buy Again | history + `buildReorderCart` | CURRENT_DATA_EXISTS |
| Product and brand imagery | optional product `imageUrl` plus owned editorial assets | PRESENTATION_ONLY |
| Member identity | optional read-only member projection | NOT_WIRED / NEW_CONTRACT_REQUIRED |
| Seeds | optional read-only seed projection | NOT_WIRED / NEW_CONTRACT_REQUIRED |
| Badges | optional read-only badge collection | NOT_WIRED / NEW_CONTRACT_REQUIRED |
| Coupons | optional read-only coupon collection; application still canonical | NOT_WIRED / NEW_CONTRACT_REQUIRED |
| Remembered preferences | optional read-only member preferences | NOT_WIRED / NEW_CONTRACT_REQUIRED |

