# MFK SMT B2a Same-Day Item-Linked Refund｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / OTA GREEN

## Owner-final B2a semantics

### SMT boundary
SMT may refund only when:
- the Order belongs to the current Business Date; and
- that Business Date has not been Day Closed.

If the Order is from another Business Date, or a Day Close already exists, SMT fails closed:
`REFUND_ADMIN_REQUIRED_CLOSED_DAY`

Cross-day / closed-day refund is Admin-only and belongs to B2b.

### Refund vs cancellation
Cancellation is an operational state only.
Cancellation does NOT create money movement.

Refund is a separate explicit money action and only exists after staff confirms it.

Therefore:
- Cancel does not silently create Refund.
- Refund does not silently cancel the Order.

### Exact item reference
Every refund stores the exact Order line:
- lineId
- itemName
- quantity reference
- amountMinor

The refund may equal the full item amount or only part of that item's amount.

Repeated refunds cannot exceed:
- the original refundable amount of that line; or
- the original Order total.

This line-level shape is intentionally compatible with a future Provider/Keeta item / partial-amount refund reference model without making local SMT the Provider refund authority.

### Refund method
UI defaults to the current effective tender from B1 when it is a clear single tender.

Staff may explicitly choose another actual refund method.

The chosen refund method is persisted on the immutable Refund record and is used by local report / cash expectation.

If current payment is ambiguous/split, SMT does not guess a default refund method.

### Provider boundary
Keeta / Foodpanda / third-party Order:
local `refundOrder()` fails closed with:
`PROVIDER_REFUND_USE_AFTERSALE`

Provider after-sale/refund remains the existing separate Provider path.

## Canonical refund record
SAME Order has immutable `refunds[]`.

Each record contains:
- deterministic refund id
- createdAt
- kind FULL / PARTIAL
- amount
- actual refund method
- note
- exact line references
- staff identity

No second Refund Engine or second Order is created.

## Report / cash semantics
For the current Business Date:
- gross sales = original sale inflows created on that day
- refunds = explicit Refund events created on that day
- net sales = gross sales - refunds
- cash sales = sale inflows whose effective tender is CASH
- cash refunds = Refund events whose actual refund method is CASH
- cash net = cash sales - cash refunds

Physical drawer expectation:
`opening cash + cash sales - CASH refunds`

Non-cash refunds do not alter physical drawer expectation.

Product quantity and product gross remain original sale facts in B2a; no guessed item-level net quantity rewrite.

Paid Order cancellation alone does not erase the sale financial fact because Cancel != Refund.

## Day Close
Local Day Close now includes refund-aware cash certainty:
- cashSalesMinor
- cashRefundMinor
- expectedCashMinor

Daily Close print now shows:
- gross sales
- refund total
- net
- sales tender breakdown
- refund-method breakdown
- cash sales
- cash refunds
- expected cash

## UI
Orders → 取消／修改 now has an explicit Refund action.

Refund modal requires:
- exact item
- quantity reference
- refund amount
- actual refund method
- optional reason/note

It states clearly:
- same-day / pre-Day-Close only
- cross-day / closed-day goes to Admin
- default is original/effective tender, but alternate method may be selected
- no automatic cancel / reprint / drawer

Order detail displays immutable refund history.

## Landed
Product main:
`71734e97f6f5dfe2c97428de063c3a67193e52bb`

PR:
`#340`

Bank:
`bank/MFK/SMT-B2A-SAME-DAY-REFUND-2026-09-26`

## Proof
Bounded proof:
- run `36236631335` SUCCESS
- 41 / 41 test files PASS
- 183 / 183 tests PASS
- build PASS
- protected seams PASS
- diff check PASS

Tests cover:
- exact item / quantity reference
- partial amount
- alternate refund method
- per-line and per-Order refund ceilings
- cross-day fail-closed
- refund-aware reporting / cash
- Cancel vs Refund independence
- restart persistence
- no print / drawer side effects
- Provider refund separation

Post-merge:
- V2 Local POS Smoke `36236793160` SUCCESS

## OTA
Exact product source:
`71734e97f6f5dfe2c97428de063c3a67193e52bb`

Builder request commit:
`3b60aafd5d942353b3868e2d601d3830c737663c`

OTA run:
`36236820914` SUCCESS

Release:
`runtime-candidate-mfk-71734e97f6f5`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-71734e97f6f5.mfos`

OTA proof:
- exact-source checkout PASS
- V2 Local tests/build PASS
- signed runtime package PASS
- R2 publish PASS
- public manifest/hash/bundle readback PASS
- marker `MFK_RUNTIME_OTA_PUBLISHED`

## Protected
No change to:
- Order identity
- B1 payment-correction authority
- B3 cancellation notice semantics
- Print Router
- cash drawer
- Provider after-sale authority
- Admin / SMM / Customer / Keeta ingress

## B2b remaining decision
Cross-day / closed-day refund is Admin-only and should create a Day Close 1.1 addendum rather than rewrite 1.0.

One money/accounting decision remains:

For a cross-day CASH refund:
- the historical financial correction belongs to the original sale Day Close 1.1;
- but physical cash leaves the drawer on the actual refund execution day.

Owner must confirm whether these are intentionally recorded on two different dates/ledgers:
1. original sale day 1.1 = financial refund addendum;
2. actual refund day = physical CASH OUT movement.

No B2b implementation until this collision is explicitly confirmed.
