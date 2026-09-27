# Owner Stage04 Implementation Mapping

## OA-CHN-001
- Read source: existing MFK canonical Admin/Keeta/Customer runtime projections.
- Keeta Pause/Resume reuse existing provider store REST/OPEN command + fresh provider readback.
- Snooze and Busy remain disabled because current repo has no canonical command seam.
- UNKNOWN is readback-first and never blind retried.
- No second channel authority.

## OA-PLN-001
- Canonical record: MFK_OWNER_MONTHLY_PLAN_V1 inside existing AdminSyncStore.
- Single writer: authenticated OWNER session.
- Sales input: existing canonical Current Effective Sales reporting projection only.
- Planning never writes Order, Pricing, Payment, Fulfillment, Print, Auth, Channel or Reporting transaction facts.
- Save: read current revision -> save command -> canonical apply -> storage readback -> CONFIRMED/REJECTED/UNKNOWN -> append-only Owner activity.
- Cost actuals remain manual unless a canonical source is explicitly available.
