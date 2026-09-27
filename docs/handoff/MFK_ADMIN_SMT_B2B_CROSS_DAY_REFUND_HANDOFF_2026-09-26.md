# MFK Admin / SMT B2b Cross-Day Refund｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / ADMIN DEPLOY GREEN / OTA GREEN

## Owner-final accounting model

Example:
- Monday sale = HK$50.
- Monday Day Close 1.0 is completed and sealed.
- Tuesday actual refund = HK$20.

### Original sale day
Monday Day Close 1.0 remains immutable.

Admin creates a Monday Day Close 1.1 refund addendum:
- exact Order;
- exact item / quantity reference;
- refund amount;
- original sale time;
- actual refund execution time;
- actual refund method;
- refundId.

The 1.1 addendum is:
`NON_POSTING_REFERENCE`

It does NOT:
- rewrite the sealed 1.0 cash figure;
- reduce Monday physical drawer;
- post the HK$20 again into period totals.

### Actual refund day
The real Money Out belongs to the actual refund execution Business Date.

For a Tuesday HK$20 refund:
- Tuesday refund total includes HK$20;
- Tuesday net is reduced by HK$20;
- if method=CASH, Tuesday expected drawer is reduced by HK$20;
- if method is non-cash, physical drawer is unchanged and settlement/net carries the refund.

A refund-only day is allowed to have a negative net.

### Period / quarter totals
Refund is subtracted exactly once, by execution date.

Therefore:
- Monday net remains HK$50;
- Tuesday net contains -HK$20 refund effect;
- Monday + Tuesday period net = HK$30.

The original-day 1.1 is audit/reference only.
The same `refundId` links the 1.x addendum and the execution-day posting, preventing double count.

## Admin-only cross-day authority
Cross-day / closed-day refund is Admin-only.

Admin Refund workspace:
- searches projected historical Orders that have a Day Close;
- excludes Keeta / Foodpanda / third-party Orders;
- selects exact Order line;
- stores quantity reference;
- allows full or partial item amount;
- defaults actual refund method from effective tender when clear;
- allows explicit alternate actual refund method;
- creates canonical Admin refund event;
- creates Day Close 1.x addendum.

Backend guards:
- original Day Close must exist;
- exact line must exist;
- quantity must be valid;
- line / Order refundable ceiling cannot be exceeded;
- provider refund fails closed to Provider after-sale;
- addendum version must match baseVersion.sequence.

## SMT consumer
SMT does not become the authority for historical refund creation.

It:
- listens for `ADMIN_REFUND_AVAILABLE`;
- fetches trusted Admin refund events through authorized SMT device endpoint;
- validates the refund contract;
- applies the same refundId idempotently to the SAME historical Order;
- preserves restart/readback;
- projects refund history back to Admin;
- never creates a new Order / Display.

## Same-day B2a remains
SMT same-day refund remains:
- current Business Date only;
- before Day Close only;
- exact item / quantity / amount;
- explicit actual refund method;
- Cancel != Refund;
- no print / drawer / automatic cancel.

## Reporting / day close
Admin sales report now includes:
- gross sales;
- refund total by execution date;
- cash refund total;
- period net.

SMT reports and Day Close show:
- actual refund time;
- original sale date/time;
- Order / item;
- actual method;
- amount.

Daily Close ticket includes:
- refund total;
- refund-method breakdown;
- refund details;
- cash refund;
- expected cash.

## Provider boundary
Keeta / Foodpanda / third-party refunds remain Provider after-sale.

Neither Admin local cross-day refund nor SMT local refund may invent a Provider refund.

## Landed
Product main:
`1d4177dc30327fd307018bffa4a160e90fdff63d`

PR:
`#341`

Bank:
`bank/MFK/ADMIN-B2B-CROSS-DAY-REFUND-2026-09-26`

## Proof
Bounded full proof:
- run `36238206305` SUCCESS
- Admin: 18 / 18 test files PASS
- Admin: 117 / 117 tests PASS
- Admin build PASS
- SMT: 42 / 42 test files PASS
- SMT: 186 / 186 tests PASS
- SMT build PASS
- protected seams PASS
- diff check PASS

Dynamic proof includes:
- Monday HK$50 + Tuesday HK$20 refund;
- Monday financial close remains HK$50;
- Tuesday refund = HK$20 and refund-only net = -HK$20;
- combined period net = HK$30 exactly once;
- alternate FPS refund does not reduce cash drawer;
- repeated Admin refund intake is idempotent;
- restart preserves history.

Post-merge:
- V2 Local POS Smoke `36238307885` SUCCESS

## Admin deploy
Deploy request commit:
`9d0b5041c5bbbe0c44ca9564122d3b778a2a5587`

Deploy run:
`36238330586` SUCCESS

Target:
`https://admin.morefunos.com`

## OTA
Exact OTA source:
`1d4177dc30327fd307018bffa4a160e90fdff63d`

Builder request:
`888638e726fa4c53b21aaf21ab0d805b6a39a2e4`

OTA run:
`36238374160` SUCCESS

Release:
`runtime-candidate-mfk-1d4177dc3032`

Bundle:
`MoreFunOS-SMT-runtime-candidate-mfk-1d4177dc3032.mfos`

OTA proof:
- exact source checkout PASS;
- V2 Local tests/build PASS;
- signed package PASS;
- R2 publish PASS;
- public manifest/hash/bundle readback PASS;
- marker `MFK_RUNTIME_OTA_PUBLISHED`.

## Protected
No change to:
- Order identity authority;
- B1 payment correction;
- B3 cancel notice;
- Print Router;
- normal cash drawer action;
- Provider after-sale authority;
- SMM / Customer / Keeta ingress.

Standing cadence remains:
IMPLEMENT → PROOF → MERGE → BANK → ADMIN DEPLOY when required → CANDIDATE OTA → PUBLIC READBACK GREEN → NEXT.
