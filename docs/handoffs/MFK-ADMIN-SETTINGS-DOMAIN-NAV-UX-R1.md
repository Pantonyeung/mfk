# MFK Admin Settings Domain Navigation UX R1

WORK_ID: MFK-ADMIN-SETTINGS-DOMAIN-NAV-UX-R1
BASE_MAIN: 71e301273c81542cb534851de32852e9d4c04e76
MODE: BOUNDED UI / UX RESTRUCTURE
NO MAIN MERGE / NO MANUAL DEPLOY

## Current IA
Store Settings is one long page mixing basic, service, dining tables, WhatsApp, payment QR, references, timing, reminders and business hours.

## Target IA
Settings home -> choose domain -> focused child page. No child domain may be blocked by unrelated validation.

## Authority
Reuse store-settings.v1 draft, saveAdminConfig, immutable Admin release, revision/publish/readback, dining table stable ID/version ledger/occupancy readback. No second config/publish/table authority.

## First breaks
1. Store Settings long-page IA.
2. WhatsApp visual fallback can diverge from stored validator value.
3. Validation summary has no field target/focus/scroll.
4. saveAdminConfig remains whole-snapshot validation; domain draft save must not pretend to be canonical publish.
5. Other Admin large pages require the same bounded IA audit after this settings seam; do not create an infinite nested navigation loop.

## Milestone
Branch opened and domain validation seam added. UI route split is in progress.

## Milestone 2
- Previous HEAD b6a415d122c56bb3ed7bcd31111c17b9ca9eab13: all five required CI gates GREEN.
- Payment settings now uses list -> one payment method detail; QR forms are no longer all expanded at once.
- WhatsApp field errors are wired to real input/textarea targets.
- Full Admin large-page audit started. Largest remaining surfaces are ChannelsWorkspace, CombosWorkspace, ModifiersWorkspace and product detail; Combos/Modifiers already use guided one-object/one-step progressive disclosure, so they are not blindly split again.
- Current HEAD: 0ab560785a548c53215ae78d667781d817ed7bcd; required CI queued.
