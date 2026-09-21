# MFK v2smm｜Clean Migration R1

WORK_ID: `MFK-SMM-CLEAN-MIGRATION-R1`

Role: `FRONTLINE ASSISTIVE TERMINAL`

This port contains migrated SMM UI/workflow/capability shape only.

Current boundary:

- independent `v2smm/**` app;
- 42-item capability registry;
- Menu / Product / Modifier / Combo / Cart / Quote preview;
- Pending Intent and Order Result / Readback presentation;
- frontline work queue, order list, dine-in, sellability, business-day, reporting, print and diagnostics presentation;
- explicit Offline / Failure / Retry / UNKNOWN / PARTIAL / stale states;
- every command capability is `NOT_WIRED`.

Hard no-touch / no-authority rules:

- no Formal Order creation;
- no Display Number allocation;
- no pricing engine;
- no DB or browser persistence;
- no cloud submit or API call;
- no Store Kernel write;
- no live LAN wiring;
- no SMT mutation.

The app deliberately uses static migration fixtures. They demonstrate interaction shape only and are not current business truth.
