# MFK SMT D1 Dining Formal Order｜Software Green｜2026-09-26

## STATUS
D1 SOFTWARE GREEN / MAIN LANDED / OTA NOT YET RUN / D2 NOT STARTED

## OWNER MONEY MODEL
Dining uses three simultaneous money facts:
- Total = current Order total
- Confirmed Paid = confirmed payments
- Outstanding = active unpaid remainder

Example:
HK$82 total + HK$41 paid = Total 82 / Paid 41 / Outstanding 41.

Cancel != Refund:
- confirmed paid remains money truth until explicit Refund;
- cancelled unpaid remainder is no longer collectible outstanding.

## IMPLEMENTED
1. Reporting projection
- Order Value, Confirmed Paid, Outstanding separated.
- Open Dining Check full total no longer silently enters recognized paid sales.
- Tender cash amount follows exact Dining payment entries.
- Product sales/units only recognize paid Dining selections.

2. D1 Formal Order link
- ordered Dining Hold assigned to table creates exactly ONE Formal Order.
- Hold stores Formal Order ID + Display.
- table/queue uses Formal Display when linked.
- replay/restart preserves SAME Order + SAME Display.
- SMM dine-in ingress returns linked Formal Order identity.
- later SMM add-to-same-table updates SAME Formal Order rather than creating another.
- partial payment updates SAME Order confirmedPaid/outstanding/paymentEntries.
- storage failure does not publish phantom Order/table assignment.
- D1 itself does not print.

3. Cancel edge
- partial-paid Dining cancel keeps confirmed paid truth.
- outstanding becomes zero / non-collectible.
- Dining table is released into history.

## ACCEPTANCE
Final main:
c7ad3f7da097d18744b27551f2aa5e5227cf2aec

V2 Local POS Smoke:
36242940168 SUCCESS

Tests:
48 / 48 files PASS
222 / 222 tests PASS
Build PASS
Authority/static proofs PASS

One earlier RED was found in waiting-Dining first-payment creation: first Formal Order was created before syncing the first payment into recognizedSales. Fixed before final GREEN.

## NEXT
1. D1 OTA / runtime candidate publication.
2. Public/device readback.
3. BANK D1.
4. Then D2 independently:
   durable D1 admission → first Dining print set
   no paid receipt
   kickDrawer=false
   persisted dispatch certainty / no blind duplicate retry.

## MILESTONE
MFK_D1_DINING_FORMAL_ORDER_SOFTWARE_GREEN
