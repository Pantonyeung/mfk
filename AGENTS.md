# MFK agent entry

- Current product identity is **MFK**. MoreFunOS is not the current product identity.
- Before any change, read `COMMANDER_CURRENT.md` and `docs/control/MFK_CHANGE_CONTROL.md`, then verify live `main` and the current controlling recovery/checkpoint evidence.
- If a controlling document conflicts with current repository evidence, **STOP** and report `GOVERNANCE_DRIFT`; do not guess, silently ignore the document, or let stale text override live evidence.
- One task owns one bounded capability. Stop before crossing scope.
- Never commit directly to `main`.
- No broad rollback or whole-tree replacement.
- Do not change the existing Builder or OTA protocol without explicit Owner authority.
- Do not create a second Order, Pricing, or Availability authority.
- If the required change exceeds declared paths or capability, stop and report it.
- On completion, list changed files and run relevant regression tests.
- Default delivery is a Draft PR only.
- Without explicit Owner `PROMOTE`, do not merge, deploy, or request OTA.
