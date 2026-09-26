# MFK SMT D1 Dining Formal Order｜BANKED + OTA GREEN｜2026-09-26

## STATUS
D1 CLOSED / MAIN LANDED / OTA GREEN / PUBLIC READBACK GREEN / D2 NEXT

## OWNER MONEY MODEL
Dining keeps three simultaneous money facts:
- Total = current Order total
- Confirmed Paid = confirmed payments
- Outstanding = active unpaid remainder

HK$82 total + HK$41 paid = Total 82 / Paid 41 / Outstanding 41.

Cancel != Refund:
- confirmed paid remains money truth until explicit Refund;
- cancelled unpaid remainder is no longer collectible outstanding.

## IMPLEMENTED
1. Reporting projection
- Order Value / Confirmed Paid / Outstanding separated.
- Open Dining Check full total no longer silently enters paid/effective sales.
- Cash/tender amount follows exact Dining payment entries.
- Product sales/units recognize exact paid Dining selections only.
- unpaid Dining items do not enter paid product ranking.

2. D1 Formal Order link
- ordered Dining Hold assigned to table creates exactly ONE Formal Order.
- SAME Hold ↔ SAME Formal Order / SAME Display.
- restart/replay does not duplicate Order or Display.
- SMM dine-in returns linked Formal Order identity.
- later SMM add-to-same-table updates SAME Formal Order.
- partial payment updates SAME Order confirmed paid / outstanding / paymentEntries.
- waiting Dining first payment creates/syncs one Formal Order before money is published.
- storage failure cannot publish a half-created Order/table assignment.
- D1 itself does not print and does not open drawer.

3. Cancel edge
- partial-paid Dining cancel keeps confirmed paid truth.
- outstanding becomes zero / non-collectible.
- Dining table releases into history.

## SOFTWARE ACCEPTANCE
Product source:
c7ad3f7da097d18744b27551f2aa5e5227cf2aec

V2 Local POS Smoke:
36242940168 SUCCESS

Tests:
48 / 48 files PASS
222 / 222 tests PASS
Build PASS
Authority/static proofs PASS

Earlier deterministic RED:
waiting-Dining first-payment Formal Order was created before syncing first payment.
Fixed before final GREEN.

## OTA
Builder request commit:
53e73a979d81e5de4b18ea1e7234ed51f64b2b71

MFK Runtime OTA:
36243136278 SUCCESS

Builder verification:
48 / 48 files PASS
222 / 222 tests PASS
Build PASS
Signed runtime package PASS
Publish OTA PASS
Public readback PASS

Release:
runtime-candidate-mfk-c7ad3f7da097

Bundle:
MoreFunOS-SMT-runtime-candidate-mfk-c7ad3f7da097.mfos

## NEXT
D2 independent knife:
durable D1 admission
→ first Dining print set
→ no paid customer receipt
→ kickDrawer=false
→ persisted dispatch certainty
→ no blind duplicate retry
→ independent proof / OTA.

## MILESTONE
MFK_D1_DINING_FORMAL_ORDER_HYBRID_MONEY_OTA_GREEN
