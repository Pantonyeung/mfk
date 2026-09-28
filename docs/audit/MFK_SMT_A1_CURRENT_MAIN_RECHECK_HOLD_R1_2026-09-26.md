# MFK SMT A1 Current-Main Recheck + Hold R1

DATE: 2026-09-26
TIME_HKT: 13:16+
MODE: AUDIT / RECHECK ONLY
TEAM_STATUS: SECOND SMT TEAM PAUSED
CONTROL: Pantonyeung/mfk #321

LATEST DATED PACKET READ:
docs/audit/MFK_SMT_NEXT_READY_INTEGRATION_PACK_A4_A2A_R1_2026-09-26.md
commit 43a7d8412bef2721b0d3984719546a105ecd9d4b

This newer packet explicitly says:
A1 decision is required before further A4/A2a product write.

Therefore no further SMT product mutation is authorized after this recheck.

## 1. PR #322 live status

PR #322 remains:
- OPEN
- NOT MERGED
- head 8129fa06de1a7440302a42583cdb4bbc84419b3e

Live PR metadata currently reports mergeable=false.

This does NOT by itself prove a product-code conflict.

Fresh compare from PR #322 base 479cdb87934af02caa5c288608bdb2e3dbe999ca to current main showed the main-side drift after that base is documentation only:
- SMT audit docs
- Customer handoff/brief docs

No product runtime/UI file changed on main in that interval.

Therefore the correct interpretation is:
PR #322 remains an Owner-acceptance candidate, but it should not be merged from the stale branch without a final fresh-main replay after Owner acceptance.

## 2. Current-main replay proof prepared before latest packet landed

Before commit 43a7d8412bef2721b0d3984719546a105ecd9d4b established the no-product-write gate, Main Integration created:

branch:
work/MFK/SMT-OPT-A1-HOLD-DINING-R4-R3

base at branch creation:
4351c894424bf242e6f32633192879f2f124c34a

This replay copied only the six A1 product/test files from the already-proven A1 candidate:
- v2local/src/App.tsx
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
- v2local/src/features/ordering/OrderingWorkspace.tsx
- v2local/src/features/ordering/ordering-center-workspaces.css
- v2local/src/features/ordering/ordering-workspace.css
- v2local/src/presentation/smt-owner-dining-cart-entry-r4.test.ts

No runtime bridge / E2E seam was changed.

## 3. R3 replay proof

V2 Local POS Smoke:
run 36220212094
job 108343922950
SUCCESS

Results:
- 27 / 27 test files PASS
- 112 / 112 tests PASS
- build PASS
- local authority guard PASS
- static bundle proof PASS

Protected paths are byte-identical to main:
- customer-cloud-intake.ts
- smm-lan-ingress.ts
- smm-web-acceptance-intake.ts
- admin-config-sync.ts
- keeta-order-intake.ts
- v2local/src/main.tsx
- v2customer/src/cloud-runtime.ts
- v2smm/src/smt-lan-adapter.ts

## 4. R3 replay status after newest packet

Because commit 43a7d8412bef2721b0d3984719546a105ecd9d4b is newer and says A1 decision is required before product write:

work/MFK/SMT-OPT-A1-HOLD-DINING-R4-R3
is now:
PROOF_ONLY_HOLD
NO PR
NO MERGE
NO FURTHER MUTATION

It is evidence that A1 still replays cleanly on a newer main baseline.
It is not authority to bypass Owner acceptance.

## 5. Current next action

OWNER DECISION ON A1 ONLY.

If Owner accepts A1:
1. fresh-read latest main;
2. create a clean branch from that exact latest main;
3. port the six A1 files only;
4. rerun integrated-main E2E guard + V2 Local Smoke;
5. merge small delta;
6. create new dated bank;
7. only then start A4.

If Owner changes/rejects A1:
- do not merge PR #322;
- discard A1 replay as product candidate;
- A4 starts later from whatever main becomes current.

## 6. Status

A1_OWNER_DECISION_GATE_ACTIVE
A1_R3_REPLAY_GREEN_HOLD_ONLY
NO_FURTHER_PRODUCT_WRITE
FIVE_PORT_E2E_FROZEN
SECOND_SMT_TEAM_PAUSED
