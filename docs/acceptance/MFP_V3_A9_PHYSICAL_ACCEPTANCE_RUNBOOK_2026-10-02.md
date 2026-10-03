# MFP V3 A9 Physical Acceptance Runbook｜2026-10-02

Status: SOURCE CHECKLIST ONLY / ALL RESULTS UNRECORDED

This document does not claim `DEPLOYED` or `PHYSICAL_VERIFIED`. Every result must be captured on a real device after a separately authorized Candidate publish.

For every line record: `device`, exact 40-character `source SHA`, `releaseId`, ISO timestamp, and `PASS / FAIL / BLOCKED`. A source test or emulator result is not a physical result.

## Identity / rollback

- [ ] 01 Carrier version readback
- [ ] 02 Candidate releaseId exact
- [ ] 03 Download, signing certificate, and SHA-256 verified
- [ ] 04 Candidate activation
- [ ] 05 App boot
- [ ] 06 `runtime.ready` promotes the same release
- [ ] 07 Current equals expected Candidate
- [ ] 08 Previous retained
- [ ] 09 Candidate cleared after promotion when protocol defines it
- [ ] 10 Rollback available

## Security

- [ ] 11 Registered device
- [ ] 12 Valid staff login
- [ ] 13 Invalid PIN/proof rejected
- [ ] 14 Expiry/revocation fail closed
- [ ] 15 Restart session behavior matches approved contract

## Sync / offline

- [ ] 16 Startup LKG
- [ ] 17 Admin change while app remains open
- [ ] 18 Doorbell arrives
- [ ] 19 Canonical revision advances without refresh/restart
- [ ] 20 Zero fixed periodic business polling
- [ ] 21 Offline LKG continuity
- [ ] 22 Reconnect bounded Delta/Checkpoint catch-up and ACK

## Ordering / checkout

- [ ] 23 MFP Pad Ordering visual lock
- [ ] 24 Product, option, combo
- [ ] 25 Hold, Retrieve, Dining handoff
- [ ] 26 Required-incomplete checkout blocked
- [ ] 27 Formal price/revision validation
- [ ] 28 Student Discount exact rule
- [ ] 29 Cash keypad and change
- [ ] 30 Payment Confirm is the only formal boundary
- [ ] 31 Double tap creates no duplicate Order/effect

## Orders / Dining

- [ ] 32 Three source lanes
- [ ] 33 READY reverts to IN_PROGRESS on the same Order
- [ ] 34 Pickup
- [ ] 35 Dining direct seat
- [ ] 36 Waiting to table on the same Order
- [ ] 37 Table transfer on the same Order
- [ ] 38 Addition on the same Order
- [ ] 39 Split checkout through the same Checkout
- [ ] 40 Real seatedAt and warning

## Availability / Capacity

- [ ] 41 Sold-out and restore
- [ ] 42 Capacity deduct
- [ ] 43 Cancellation replenishes once
- [ ] 44 Independent channel thresholds
- [ ] 45 Finite override exhausts and re-stops
- [ ] 46 Business Day reset evidence

## Money / Close

- [ ] 47 Opening cash
- [ ] 48 Cash In / Cash Out
- [ ] 49 Cash sale
- [ ] 50 Refund / payment correction
- [ ] 51 Day Close denomination/direct count
- [ ] 52 Variance
- [ ] 53 Retained cash / next opening
- [ ] 54 Immutable report and later linked adjustment

## Print / Hardware

- [ ] 55 Physical receipt
- [ ] 56 Production ticket
- [ ] 57 Packing ticket
- [ ] 58 Labels
- [ ] 59 Partial label reprint
- [ ] 60 Reprint does not open drawer
- [ ] 61 Cash receipt opens drawer once
- [ ] 62 Printer offline attention
- [ ] 63 Ambiguous print has no blind retry
- [ ] 64 App-kill / reboot / power-loss recovery

## Customer

- [ ] 65 Pending pay-at-store
- [ ] 66 Payment evidence review without making it Payment truth
- [ ] 67 WhatsApp QR/contact fallback
- [ ] 68 Accept once
- [ ] 69 Modify confirmation
- [ ] 70 Cutoff/immediate stop affects future remote orders only

## Keeta

- [ ] 71 Manual Immediate
- [ ] 72 Later 0 → 1 → 2
- [ ] 73 Third Later blocked
- [ ] 74 Auto-accept policy
- [ ] 75 Duplicate inbound creates no duplicate Order
- [ ] 76 Lifecycle retains the same Order
- [ ] 77 After-sale/refund
- [ ] 78 Mapping/error attention

## Offline / restart consistency

- [ ] 79 WAN down local trading
- [ ] 80 App restart
- [ ] 81 Device reboot
- [ ] 82 No duplicate Order
- [ ] 83 No duplicate print
- [ ] 84 No double capacity restore
- [ ] 85 No double money effect

## MFP Mobile / cross-device

- [ ] 86 Shared authority
- [ ] 87 Touch-first flows
- [ ] 88 Same canonical Order/payment state
- [ ] 89 Cross-device concurrency/readback

## Critical failure procedure

1. STOP at the exact failed gate and record the five evidence fields.
2. Preserve logs/diagnostics without secrets.
3. Use the existing Carrier rollback to Previous.
4. Verify `Current = Previous stable runtime` and record its releaseId.
5. Do not continue cutover and do not fix code live on the device.
6. Produce a new exact-source Candidate through a separately authorized publish request.

## Cutover / SMM gate

Remain `BLOCKED` unless MFP Pad/Mobile source and production bindings are accepted, all physical records pass, Customer/Keeta and offline/print/auth are green, no SMM runtime dependency remains, public/domain readiness is proved, and Owner gives a separate explicit authorization.
