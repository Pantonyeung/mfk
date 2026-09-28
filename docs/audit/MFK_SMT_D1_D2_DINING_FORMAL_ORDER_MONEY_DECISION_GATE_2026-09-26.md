# MFK SMT D1/D2 Dining Formal Order + First Print｜Money Decision Gate｜2026-09-26

## STATUS
AUDIT COMPLETE / OWNER MONEY SEMANTICS REQUIRED / NO D1 PRODUCT MUTATION

## Fresh current main
`f0ad0a7caa347c199ac7b764a8ef0864405d47cf`

C1 and C2 are LANDED / BANKED / OTA GREEN.

## Existing Owner-locked Dining flow from validated R6 lineage
The recorded Owner flow is:

`點單 → 掛入堂食枱 → SAME Formal Order → 自動首次完整打印 → 堂食持續操作 → 分項／分次付款 → 每次付款收據 → 只有 CASH payment receipt 開 Drawer → 堂食專用重印`

So the following is already locked:
- first table placement with ordered items creates ONE Formal Order;
- no second 「落廚」 button;
- Hold ↔ Formal Order durable identity;
- first Dining print happens before payment;
- table ticket is unpaid verification, NOT a paid receipt;
- payment remains later and may be partial / multiple;
- reprint / transfer never opens Drawer.

## Current main collision exposed by D1
Current local reporting treats every StoredOrder created during the Business Date as financial gross:

`grossSalesMinor = sum(all selected Order.totalMinor)`

There is currently no concept of:
- Formal Order but unpaid;
- partial financial recognition;
- outstanding Dining balance.

Until now this was mostly hidden because ordinary local Formal Orders are created at Checkout with a payment method.

D1 changes that:
- Formal Dining Order must exist when the table is assigned;
- payment may happen later or only partly.

Therefore blindly replaying donor D1 would cause an unpaid Dining Order to enter Sales / Day Close gross immediately.

That is a MONEY semantic and cannot be inferred.

## Concrete example
Dining Order total = HK$82.

Table assigned at 18:00.
No payment yet.

Later one item HK$41 is paid.
Remaining = HK$41.

What should Sales / Day Close report?

## M1 — Paid-amount financial recognition [RECOMMENDED]
Operational Formal Order exists from table assignment, but financial sales only recognize actual Dining payments.

Before payment:
- Formal Order exists.
- Kitchen print exists.
- Gross / net financial sales = HK$0 from this Dining Order.
- Outstanding Dining = HK$82.

After first HK$41 payment:
- Financial sales recognized = HK$41.
- Tender breakdown reflects the exact payment tender.
- Outstanding = HK$41.

After final HK$41:
- cumulative financial sales = HK$82.
- outstanding = HK$0.

If cancelled before any payment:
- financial sales = HK$0.

If cancelled after HK$41 partial payment:
- HK$41 remains financial truth until an explicit Refund is confirmed.
- Cancel != Refund, preserving the Owner-locked B2 model.

Because Dining payment already stores exact line/quantity selections, product-level paid sales can also be based on the exact paid selections rather than guessed allocation.

## M2 — Full Order gross at table assignment
As soon as table assignment creates the HK$82 Formal Order:
- financial gross immediately includes HK$82 even if HK$0 was collected;
- partial/unpaid balance becomes an implied receivable;
- cancellation without refund would require special unpaid reversal semantics.

This is much less aligned with current cash/refund rules and introduces an A/R-style accounting meaning not otherwise present in current MFK.

## Recommended D1/D2 boundary after M1 confirmation
D1:
- Table assignment with ordered items creates ONE linked Formal Order.
- SAME Hold ↔ SAME Order durable identity.
- Order starts with payment state / projection indicating unpaid, without being counted as collected financial sales.
- transfer keeps SAME Order.
- restart/replay cannot create second Order.

D2:
- immediately after the durable D1 admission, dispatch first Dining print set through existing Print Router:
  - 枱單
  - 製作單
  - 打包單
  - Label according to existing Admin product/print rules.
- exclude paid customer receipt.
- kickDrawer=false.
- first dispatch certainty persists; no blind duplicate retry.
- physical-paper truth still requires human/printer acceptance.

Later D3:
- each Dining payment produces its own receipt;
- CASH receipt only = Drawer boundary.

## Required Owner decision
Choose:

`M1` = financial sales follow actual Dining payments [recommended]

or

`M2` = full Dining Order counts as gross immediately on table assignment.

Until confirmed:
D1_D2_AUDIT_COMPLETE
MONEY_RECOGNITION_OWNER_REQUIRED
NO_D1_PRODUCT_MUTATION
C1_C2_OTA_GREEN
