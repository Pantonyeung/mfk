# MFK Public SMT Acceptance → Main Preservation Lock R4

DATE: 2026-09-26
TIME_HKT: 10:37
REVISION: R4
STATUS: CURRENT_DATED_AUTHORITY
CONTROL: Pantonyeung/mfk #321

SUPERSEDES:
- any wording that treats public Web SMT acceptance work as temporary-only code that may be discarded
- any wording that allows an SMT donor branch to overwrite the current main shell, header, SMM/Customer/Admin integration or acceptance-proven seams

## 1. Owner clarification

The temporary public SMT was used to accept and refine real SMM / Customer / Admin-related behavior.

Those accepted changes are not throw-away preview behavior.

They must be preserved in the product mainline before SMT optimization continues.

At the same time, existing main SMT product implementation must also be preserved:
- current shell/header/rail
- current connected information
- current Customer/SMM/Keeta order projections
- current Admin-backed configuration behavior

Future SMT optimization is therefore:

CURRENT MAIN BASELINE
+ ACCEPTANCE-PROVEN INTEGRATION
+ SELECTED SMT OPTIMIZATION

Never:

OLD DONOR SMT
→ overwrite main
→ lose acceptance-proven SMM/Customer/Admin changes

## 2. Fresh ancestry proof — acceptance work is already in main

The following public-Web-SMT acceptance commits are confirmed ancestors of current main:

- 3e73783bec8c0e88e5399d544c91780b0722b8ad
  Admin sync proxy in temporary Web SMT acceptance mode

- a8318bd9a8bda1b4d4b6f3895ccb1d825bddba96
  isolate temporary public Web acceptance from production consumers

- 9c94c05fb61ca155b1ebfe5ee7245548af8f6c36
  receive isolated SMM intents in Web acceptance mode

- c265991411b37355151615f0a63aa77081ec5155
  harden SMM Web SMT acceptance ACK readback

- 99597da36bec6676a6c06e998359cfb1fdd596dd
  shared canonical SMT Order + Dining read model for SMM acceptance

- f249bbd33d46d1b16d40505adb1264f9f38ca1b1
  refresh SMT Web Customer validation runtime

- 2a6f9563d66afa7339b16dbeda664617c37b36ce
  Customer SMT menuRevision validation fix

For every commit above:
- compare(commit → main) = ahead
- behind_by = 0
- merge_base = exact acceptance commit

Conclusion:
THE ACCEPTANCE-PROVEN DELTAS ARE ALREADY IN MAIN.

Therefore no duplicate merge is needed.
The correct action is preservation + regression guard, not re-merging old branches.

## 3. Acceptance-proven integration paths locked in main

### Runtime / intake

- v2local/src/runtime/customer-cloud-intake.ts
  blob f7af54e520be43d067aa8a9d879fb64f9cedcf58

- v2local/src/runtime/smm-lan-ingress.ts
  blob 7893177e43458f8b077752470027bd655d2d0916

- v2local/src/runtime/smm-web-acceptance-intake.ts
  blob 381993f438f30cfea27cb73d9b23c72b19ae5bdb

- v2local/src/runtime/admin-config-sync.ts
  blob 48b57f69e98a351fcde87ca77c3e1df24c440b1f

- v2local/src/runtime/keeta-order-intake.ts
  blob da66faf9fb9a3c2dded52c0a39c5b83f5a544b80

- v2local/src/main.tsx
  blob 88f72b271d55886c24b73368dfa4e9f322d2d56e

### Customer / SMM side

- v2customer/src/cloud-runtime.ts
  blob f8d5d0ef129b1473abf3f1bd50ac1cb7f393559a

- v2smm/src/smt-lan-adapter.ts
  blob 34bb7d1450e4fe7b2f277b14f2401007aecd2d89

## 4. Current SMT presentation baseline must also be preserved

These files are the current-main presentation baseline to compare before every optimization:

- v2local/src/App.tsx
  blob af6a5605109af808ce9f53f3b85717066e0e2857

- v2local/src/features/ordering/OrderingWorkspace.tsx
  blob e6fcfb3170b606c3aa2b2cfaf37336fa2093d94f

- v2local/src/features/ordering/ordering-workspace.css
  blob 8a2938395fb1099cf2e2c691a32fe9b3deeedaac

- v2local/src/presentation/RuntimeOrdersWorkspace.tsx
  blob c6fec1c3cd5a8001528275a6cdab1df3d7a50936

- v2local/src/presentation/orders-workspace.css
  blob 9d746fdeb09c2083d35fe0cd9804b7c415ebd56f

- v2local/src/presentation/RuntimeDiningWorkspace.tsx
  blob ffee29e07306fa4a6cc1ae525b6a747440d806ed

These hashes do not mean presentation can never be optimized.
They mean every future optimization MUST diff against this baseline and explicitly preserve all non-target behavior.

## 5. UI / connected-information invariants

Future SMT optimization must preserve unless Owner explicitly selects a replacement:

- current SMT shell / rail / header hierarchy
- MFK main navigation presence
- current Order count / operational projection behavior
- global Customer arrival alert
- global Keeta arrival alert
- sound alert behavior
- Customer / Keeta event listeners
- Orders page Customer arrival projection
- Orders page Keeta arrival projection
- source lanes:
  - 現場訂單
  - 自家平台
  - 第三方平台
- Admin-published menu/config projection
- existing Customer/SMM/Keeta information already shown in SMT

A visual optimization may restyle or reorganize these only as an explicit Owner-selected optimization.
It may not accidentally delete or disconnect them.

## 6. Automated preservation guard now in main

Test added:

v2local/src/runtime/integrated-main-e2e-lock-r1.test.ts

Commit:
80efeae7c551b7d4f3c45583f9454b0f11fa5a59

V2 Local POS Smoke:
run 36212463397
job 108321718424
SUCCESS

Results:
- 26 / 26 test files PASS
- 107 / 107 tests PASS
- production build PASS
- existing authority/static bundle guards PASS

The new guard proves:
1. Web Acceptance isolation remains intact.
2. Production Customer + Keeta consumers remain installed outside acceptance mode.
3. Customer menuRevision / price / evidence / canonical readback semantics remain present.
4. SMM submission/idempotency/pricing/readback semantics remain present.
5. current SMT shell/header + Customer/Keeta alerts + three source lanes remain present.

## 7. Mandatory optimization integration algorithm

For every future SMT optimization:

1. start FROM latest main, never from donor as destination;
2. compare donor against main;
3. select only the Owner-approved optimization delta;
4. retain main versions of all acceptance-proven runtime/data seams unless the selected change explicitly requires one;
5. retain current header/shell/connected-info behavior unless Owner explicitly selected a UI replacement;
6. run integrated-main-e2e-lock test;
7. run full V2 Local POS Smoke;
8. run relevant SMM / Customer / Admin / Keeta regression;
9. if any protected integration disappears or changes unexpectedly → RED / do not merge;
10. Owner acceptance;
11. small merge to main;
12. new dated bank.

## 8. Current status

PUBLIC_SMT_ACCEPTANCE_DELTAS_CONFIRMED_IN_MAIN
SMT_SMM_CUSTOMER_ADMIN_CONNECTED_INFO_LOCKED
CURRENT_MAIN_PRESENTATION_BASELINE_RECORDED
AUTOMATED_PRESERVATION_GUARD_GREEN
SECOND_SMT_TEAM_OPTIMIZATION_ONLY
NO_WHOLESALE_MERGE

NEXT:
SMT_OPTIMIZATION_BACKLOG_R1
