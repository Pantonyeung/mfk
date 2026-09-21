# MFK v2owner｜Owner Clean Migration R1

WORK_ID: MFK-OWNER-CLEAN-MIGRATION-R1

Role: OBSERVATION / ALERTING / REVIEW / BOUNDED DECISION

This port contains Owner UI / workflow / capability shape only.

Current boundary:
- independent v2owner app;
- 94-item capability registry;
- Today / Readiness + Sales / Orders / AOV + comparison;
- Action Queue, Order Oversight and Order Detail drill-down;
- Channel Health + Sold-out / Pause command presentation;
- Staff Presence / Role / Permission presentation;
- Device / Printer Health and job-certainty presentation;
- fixed Reports, Alerts / Notifications, Manager Log / Checklist and Activity;
- bounded action Confirmation / Reason / Approval / Pending / Result / Failure / UNKNOWN presentation;
- Admin deep-link presentation only;
- OFFLINE / STALE / UNKNOWN / PARTIAL / FAILURE / RETRY recovery states;
- every COMMAND_SHAPE capability is NOT_WIRED.

Hard boundary:
- no live network read / write;
- no live remote mutation;
- no Formal Order / Checkout / Payment / Pricing execution;
- no Store Kernel / Display Number / physical Printer / Drawer action;
- no D1 / Cloud / Provider authority;
- no SMT mutation;
- no Admin config authoring;
- no browser persistence.

All data shown in this migration port is static fixture or local session-only presentation. It is not current MFK business truth.

TEST_EXECUTION: HANDOFF_TO_MAIN_CHAT
