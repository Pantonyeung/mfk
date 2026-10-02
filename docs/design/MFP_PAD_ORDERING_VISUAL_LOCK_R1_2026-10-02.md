# MFP Pad｜Ordering Visual Lock R1｜2026-10-02

Status: OWNER LOCKED
Product: MoreFun POS (MFP)
Surface: MFP Pad
Source: Owner-approved Ordering reference image in current project conversation
Applies from: A6 onward

## 1. Lock meaning

This image is now the visual mother-style for MFP Pad.

The previously implemented A4/A5 UI remains source-valid, but visual polish was not fully locked at the time.
Owner has now explicitly locked this Ordering page direction.

From A6 onward:
- do not invent a separate visual language for Orders / Dining / Sold-out / More
- extend this same shell, density, hierarchy and interaction language
- keep business semantics and authority contracts unchanged

This is a visual/product lock, not a new business authority.

## 2. Ordering page visual lock

Keep the following as the primary MFP Pad ordering composition:

- left high-frequency navigation rail
- top pending-order / external-order strip
- central category + product grid
- right cart/order panel
- bottom high-frequency fast-lane actions
- high-density POS layout
- blue-led visual language
- white panels/cards with rounded geometry
- large readable numbers and operational labels
- compact but touchable controls
- strong right-side transactional focus

## 3. Cart visual/interaction lock

Right cart remains the operational anchor.

Required visual concepts:
- large order/sequence preview at top
- ORIGINAL / SORT control
- COMBINE control
- whole-cart TAKEAWAY / DINE-IN control
- visible total item count
- individual line numbering
- per-line TAKEAWAY / DINE-IN identity
- clear product image/name/details
- quantity controls only when combined semantics allow
- per-line delete control
- subtotal/discount/total grouped near bottom
- primary Checkout button fixed as dominant action

Owner corrections that supersede literal pixels in the reference:
- barcode scanning/search language is not required
- More belongs to top hamburger/tools entry, not a high-frequency main rail position
- when cart contains items: primary secondary action is Hold / Dining, with destructive clear visually de-emphasized
- when cart is empty: Retrieve becomes the relevant action
- order number before formal payment confirm is preview/display only, never early Formal Order allocation

## 4. Fast-lane visual lock

Bottom fast-lane region remains a first-class part of the ordering page.

Must support the same visual family for:
- Fast Pair / 飯團待組
- Required / 必選
- Rice Combo / 紫米套餐

Large horizontal cards/buttons are preferred.
High-frequency actions should be visually obvious without wizard wording.

## 5. Visual system

Primary:
- MFP blue visual language
- strong blue active state
- blue primary buttons / selected states

Red:
- destructive
- error
- true warning only

Avoid:
- introducing unrelated green/orange as primary brand states
- toy-like/cartoon UI treatment in the core operational workspace
- inconsistent card geometry by page
- moving primary action positions between states

## 6. Extension rule for A6+

Orders, Dining, Sold-out/Capacity and More/Tools must be designed as siblings of this Ordering page.

They should share:
- same outer shell
- same rail/hamburger logic
- same top operational status language
- same panel radius/border/elevation family
- same typography hierarchy
- same blue active-state system
- same button scale
- same spacing rhythm
- same high-density information treatment
- same muscle-memory principle

They do NOT need to copy the exact Ordering internal layout.

Examples:

### Orders
Replace Product Grid + Cart content area with:
- left selected-order detail
- right three-source lanes
- source/payment filters
while retaining the same shell and visual system.

### Dining
Use:
- narrow waiting column
- central 3×3 table grid
- right selected-table detail
inside the same visual family.

### Sold-out / Capacity
Use:
- filter/search controls
- current unavailable list
- product/pool operation workspace
with the same card/button/status treatment.

### More / Tools
Use:
- top hamburger entry
- summary cards
- tool cards
with the same typography and blue system.

## 7. Mobile relation

MFP Mobile is not required to mimic this Pad layout pixel-for-pixel.

Mobile should inherit:
- visual identity
- typography
- blue state system
- card language
- icon language
- status semantics

But it remains touch-first and structurally optimized for mobile.

## 8. Authority guard

This visual lock must never create:
- second Order truth
- second Pricing truth
- second Payment truth
- second Print truth
- surface-specific canonical state

Pad and Mobile remain different presentations over shared business contracts.

## 9. A6 design instruction

For A6:
- use this lock as the default visual reference
- do not redesign the shell
- extend the style into Orders / Dining / Sold-out / Capacity / More
- prioritize functional semantics first
- final pixel polish can continue later, but no new unrelated design language is allowed

MILESTONE:
MFP_PAD_ORDERING_VISUAL_LOCK_R1_2026_10_02
