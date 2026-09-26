# MFK Customer Handoff｜2026-09-26｜Orders Favorites Reorder V1

## Owner Requirements
- Orders page shows previous orders.
- Filter ongoing / completed / history.
- Every Order card displays status.
- Previous Order can be copied and ordered again.
- Product cards have top-right favorite heart with micro-animation.
- Whole Order can be saved as a frequent/favorite order.
- Frequent order supports fast repeat ordering.

## Product Separation
Favorite Product:
single Product bookmark.

Saved/Frequent Order:
saved order-intent template.

Reorder:
copy historical intent into a NEW cart.
Never reopen historical Order.

## Reorder Contract
Past Order
→ copy intent
→ current product/price/sellability/modifier/combo validation
→ line-level repair if needed
→ new cart
→ final review
→ new formal Order.

## Unified Surface
Existing Home shortcut 「常購清單」 should open:
- 喜愛商品
- 常用訂單

## Heart Interaction
Single tap.
Favorite animation:
heart scale → small-heart burst → settle filled.
No double-tap requirement.

## Order Page
Primary filters:
- 進行中
- 已完成
- 全部

Active status updates use existing realtime-doorbell + canonical readback pattern.
Refresh timing remains Admin-configurable.

## Milestones
CUSTOMER_ORDER_HISTORY_FILTER_V1_DRAFT_LOCKED
CUSTOMER_PRODUCT_FAVORITE_HEART_V1_DRAFT_LOCKED
CUSTOMER_SAVED_ORDER_TEMPLATE_V1_DRAFT_LOCKED
CUSTOMER_REORDER_CURRENT_REVALIDATION_V1_LOCKED
CUSTOMER_FREQUENT_LIST_UNIFIED_ENTRY_V1_DRAFT_LOCKED
