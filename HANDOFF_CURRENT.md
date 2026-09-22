# MFK CURRENT HANDOFF｜2026-09-22

Mandatory entry:
`COMMANDER_CURRENT.md`

Current navigation:
`docs/navigation/MFK_航海圖_V1.15_Round016_2026-09-22.txt`

Control:
#22

Commander protocol:
#39

## PRIORITY

Owner HOLD:
SMT OTA physical acceptance.

Owner RESUME:
Admin connection.

## SMT OTA HOLD

#40 remains open.

Published no-drift 814-baseline persistence candidate:
`runtime-candidate-mfk-d133043dfe7d`

Do not continue physical OTA acceptance until Owner resumes.

## ADMIN LIVE

Canonical Admin:
`https://admin.morefunos.com`

Hosting/domain:
GREEN / BANKED.

Live deployment:
`35677844235` SUCCESS

Deploy source:
`d30e8dcc789806a42ea93c3670beb60270a1ee28`

A2 source was already in that deployment.
No later `v2admin/**` product diffs exist on current main.

Therefore live Admin is current for the A2 surface.

## ADMIN CONNECTION STATE

A1 #34:
BANKED / GREEN

A2 #35:
IMPLEMENTATION GREEN / BANKED

Missing:
`OWNER REAL CROSS-DEVICE WALKTHROUGH`

A3:
NOT AUTHORIZED

## EXACT NEXT

Live Admin:
`/admin/publish`

Read-only confirm A2 controls exist.

Then SMT:
More → Admin · Menu

Read-only capture:
`ACTIVE REVISION`

Do not build a final A2 bundle until exact SMT base revision is known.

Then run one tiny Product-name change through:
Validate → Impact → Bundle → SMT Apply → Readback → Admin Compare = MATCH.

## NON-BLOCKING DEBT

`v2admin/BUILD_ID` still references old `morefun-v2-admin`.
README retains superseded H1 wording.

Actual wrangler target is correct:
`mfk-admin`.

Do not prioritize this over A2 acceptance.
