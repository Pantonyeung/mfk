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

## Milestone 3
- Channels route duplication reduced: mapping/failure routes now render mapping only; accept renders intake + accept policy only; sync renders sync surfaces + sync policy only; estimate renders commercial + estimate field only.
- No channel authority, OAuth, webhook, menu sync, sellability, store ops or mapping storage was rebuilt.
- Current head f110f52dd9a8107b1bef37fb33b34bc3ce5413ae; CI pending start.

## Milestone 4
- CI first break on Milestone 3 was test-scope only: shell navigation legitimately contains the words 商品對應 even when the accept-policy workspace does not render the mapping editor. Assertion narrowed to the workspace heading contract; product behavior unchanged.
- Channel page header copy is now mode-specific so accept/sync/mapping/estimate pages no longer describe unrelated tasks.
- Continued large-page audit: Product detail already has task picker; Modifiers and Combos already have guided progressive disclosure. Refund report is a single coherent workflow + audit readback and is not split merely by page length.
- Current head 0204a6c03dc4bc19b51136c4e50b10272132ca76; CI pending.

## Milestone 5
- Milestone 4 head f9153f68d849b998182ab1eed551b5258593d33d: all five required CI gates GREEN.
- Staff page no longer expands every employee form at once: roster -> one staff detail.
- Print Templates no longer expands Receipt/Production/Packing/Label/Semantics together: template chooser -> one editor.
- Existing staff.v1, PIN verifier, RBAC, print-templates.v1 and audit authority unchanged.
- Current head 2314aa98723695d7679a7082a5d148f2e65d5861; CI pending.
