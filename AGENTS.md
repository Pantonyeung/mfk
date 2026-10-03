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
- Admin is the sole canonical authority for formally published configuration/policy data consumed by SMT; do not create a second config authority.
- Human-facing sync freshness uses Cloudflare publish time; do not use `Rxx`/revision labels as the acceptance or latest-state oracle.
- Any Admin→SMT sync path must guarantee eventual convergence through doorbell + canonical pull + required reconcile fallback; a path that can permanently miss a formal Admin publish is invalid.

## Parallel worker entry

- Before any parallel-worker write, read [多 worker 開工必讀契約](docs/governance/MFK_MULTI_WORKER_START_CONTRACT.md) and acknowledge its task card, exact base SHA, contract version, and owned paths.
- This collaboration contract does not grant implementation, merge, deploy, or OTA authority and does not replace the controls above.
