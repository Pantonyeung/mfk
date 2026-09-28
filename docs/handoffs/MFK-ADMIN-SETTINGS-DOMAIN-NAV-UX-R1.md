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
