# MFK Customer Handoff｜2026-09-26｜Home + Closed Store Policy

## Newly Locked
- 第三快捷入口接受「磨飯日曆」方向
- 非營業中仍允許 Browse / Product Config / Add to Cart / Edit Cart
- 記憶罐內容不因店舖關門被清除
- 正式 Order Commit 前重新驗證營業／接單資格
- 非營業時 Commit fail-safe：
  - zero Formal Order
  - zero Display Number
  - zero cart loss
  - clear customer-facing reason
  - optional next-open time projection

## Boundary
CLOSED STORE
≠ APP DISABLED
≠ MENU DISABLED
≠ CART DISABLED

CLOSED STORE
= CURRENT ORDER COMMIT NOT ALLOWED
(unless future scheduled-order contract is separately approved)

## Open
- Closed-state Checkout depth
- Scheduled / future order
- Hero carousel details
- Easter egg content

## Milestone
CUSTOMER_CLOSED_STORE_BROWSE_CART_ALLOWED_V1_LOCKED
