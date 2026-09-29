# MFK `main` Ruleset Proposal

Status: PROPOSAL ONLY / NOT APPLIED

Live readback on 2026-09-30: repository Rulesets = 0.

Legacy branch protection state has not been verified by the current integration because the protection endpoint is not accessible with the current GitHub integration permissions. Unavailable evidence is not evidence that protection is absent.

## Proposed branch rules

- Require a Pull Request before merge.
- Block force pushes.
- Restrict branch deletion.
- Require the branch to be up to date before merge.
- Keep deploy, OTA, device, and physical acceptance outside merge-check identity.

## Staged check exposure

Shadow observation comes first. Do not make `MFK / Regression Shadow` required.

After Owner approval, expose no more than these aggregate checks:

1. `MFK / Change Scope`
2. `MFK / Critical Regression`
3. `MFK / Authority Safety`

Component workflows remain evidence inputs selected by changed scope; do not attach 20–30 component checks directly to the Ruleset. Docs-only changes must not wait for product-wide suites.

Recommended activation:

1. Observe Shadow Mode and correct false positives.
2. Make only `MFK / Change Scope` required.
3. Add `MFK / Critical Regression` after base-vs-Candidate evidence is stable.
4. Add `MFK / Authority Safety` after authority-impact classification is reviewed against real Candidates.

Do not require Builder, deploy, OTA publication, live-provider acceptance, device, or physical checks for ordinary source merge. Those retain their existing explicit promotion protocols.

## Failure buffer

- Governance tooling failure remains WARNING until the Owner promotes that gate.
- Existing deploy/OTA workflows stay independent from the governance workflow.
- Known-red and unrelated failures remain non-blocking under the recorded policy.
- Emergency bypass uses the recorded Owner bypass fields in `MFK_CHANGE_CONTROL.md`.
- The non-bypassable critical list remains fail-closed once its aggregate gate is promoted.

Applying this proposal requires a separate explicit Owner `PROMOTE` instruction and a fresh settings readback. This Candidate does not call the GitHub Rulesets or branch-protection APIs.
