# Admin modifier-price coherence | 2026-10-03

## Exact scope and root cause

Correction base: `67bc447b826c468209dd9d1e5d943d2348622558`, containing reviewed native quote source `ed340d7b`. The integration owner permitted this isolated branch before its non-overlapping extract successor was committed. This bounded patch changes no real business value and performs no live read/write, migration, publication, deployment, transaction or physical action.

At that base, `FormalPricingPage` called `patchFormalModifierOptionPrice`, which updated only `catalog.modifierGroups`. `readFormalOptionCenter` and the native `FormalQuoteSelectionResolver.options` use existing `optionCenter`. A subsequent name-only modifier save used `writeFormalOptionCenter` to mirror the older option-center price over the newer catalog price. No concurrent request was needed. A separate source audit reproduced the same sequence on exact `f80718ba`, and showed the inconsistent snapshot passing frontend tender preflight, local option validation and the shared envelope fingerprint contract. These are source-only findings, not live data observations.

## Correction

- Pricing reads use existing optionCenter whenever that field is present; malformed-present data is not replaced by stale legacy pricing. Truly absent optionCenter retains supported legacy reads.
- A price action validates the requested group/option and both existing raw copies first, then returns one synchronized snapshot for the existing `mutateSnapshot`/draft-save operation. Missing/malformed/ambiguous targets fail before any mutation. Group/option identity is scoped by set, so the same option ID in another set is untouched. An absent optionCenter is not synthesized by a price action.
- Raw object spreads update only the requested price and preserve choices, per-product defaults, stable IDs and unknown fields. Later option edits merge raw existing set/option/link fields by their stable identities rather than dropping extension metadata through display normalizers. Explicitly removed records still remain removed.
- New or changed option prices through either pricing or modifier editing must match the native `FormalCheckoutSourceContracts.exactMinor` signed decimal grammar (1–14 integer digits, at most two fractional digits) and safe-minor magnitude `9,007,199,254,740,991`. No rounding or new price policy is introduced. Existing finite-source validation remains compatible with historical source preservation.
- Already-open modifier forms capture a baseline of their selected set and its product/default links. A pre-save source refresh that changes those facts blocks the stale form with an explicit close/reopen message; unrelated-set changes are preserved from the fresh snapshot. Pricing rows refresh pristine inputs when their source changes, and dirty option-price edits compare their captured raw price against the current authoritative price before returning a mutation. These local guards complement, rather than replace, optimistic server revisions.
- Existing draft ID, base fingerprint/publish-time and draft-revision semantics are unchanged. A provider-level race test proves the two synchronized copies remain paired with their original revision when a concurrent cache refetch arrives, and the server conflict is retained.

## Historical precision is a readiness gap, not a migration

Unchanged historical strings such as `1.000` remain byte-value preserved during unrelated edits. The shared envelope validates their identity but does not validate native monetary representation. Native `exactMinor` rejects that string because it has three decimal places, even though its mathematical amount is one unit. The existing migration dry-run intentionally preserves `1.000`; this patch does not rewrite it.

The Pricing page visibly warns when its authoritative option-price rows do not satisfy native format and states that preservation is not quote/runtime readiness. Newly entering `1.000`, sub-cent values, exponent notation, infinities or unsafe amounts is rejected by the edit writer. Unchanged historical values may still be sent to publication: the current frontend `publishV3FormalDraft` preflight checks tender policy, while the reference Worker draft publish path creates the shared envelope without a native option-price compatibility check. A mocked request regression and static source review confirm that no such readiness gate is supplied here. This does not prove actual deployed server acceptance.

Therefore, yes: the current source publication flow does not categorically block preserved `1.000`, while native quote parsing rejects it. A separately scoped cross-layer publication/readiness gate or an explicitly approved source repair is required before activating affected runtime configurations. No automatic repair, price rounding, invented zero or claim of runtime compatibility is permitted. The visible warning is evidence of a known issue, not a replacement for that gate.

## Verification and limits

- Initial sequence/guard regressions: 31 RED assertions before the fix, then GREEN.
- Additional compatibility and readiness regressions demonstrated the preservation/precision distinction before repair. Independent review reproduced an already-open stale modifier form sending the old price with a refreshed draft revision; mounted UI tests observed that failure before its baseline guard. Two further RED UI tests caught pristine stale price display and dirty option-price overwrite after source refresh before their repair.
- New suite covers exact two-copy patches; already-divergent reads; later option-edit preservation; IDs scoped by group; malformed and duplicate targets; exact signed/native boundaries; legacy-only defaults; historical precision warnings; mocked save → option edit → publish → authenticated readback; and optimistic stale-save/refetch behavior.
- Final source checks: Admin 32 files / 356 tests (49 new modifier-price regressions); typecheck and production asset build passed. Independent review result and exact commit are recorded in delivery evidence. Existing npm proxy, react-test-renderer deprecation and bundle-size warnings remain non-failing.

All identifiers, prices and credentials in tests are synthetic. Server responses in this new suite are mocked; no production request or actual native quotation/transaction was run. The frontend's saved/published source consistency is verified at its existing seam, not claimed as live server or physical acceptance.
