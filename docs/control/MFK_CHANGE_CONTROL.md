# MFK Change Control

Status: SHADOW MODE

Scope: MFK governance and regression evidence only

This layer wraps and references existing MFK checks. It does not replace Builder, deploy, OTA, package management, or product authority.

## Agent modes

### AUDIT

- Read, compare, and investigate only.
- No repository write, branch mutation, merge, deploy, or OTA.

### PREPARE

- Create a branch from the declared exact base.
- Change only one bounded capability and its allowed paths.
- Add or reuse the smallest relevant tests.
- Deliver a Draft PR.
- No merge, deploy, or OTA.

### PROMOTE

- Enter only after an explicit Owner instruction containing `PROMOTE` for the Candidate.
- May move a Draft PR to Ready, merge through the approved path, deploy through the existing path, read back identity, perform acceptance, and record a checkpoint or revert.
- Promotion authority is per Candidate and does not carry to the next Candidate.

`CI GREEN` does not grant `PROMOTE`.

`完成` does not grant merge authority.

`修好` does not grant deploy authority.

## Candidate manifest

Every Candidate provides `.github/mfk-change-manifest.json`, based on `.github/mfk-change-manifest.example.json`. It is Candidate-owned only when that path is added or modified relative to the live Pull Request base. A copy inherited unchanged from `main` is historical data, not an active declaration.

Required fields:

- `capability`: one bounded capability identifier.
- `base_sha`: exact 40-character source base declared by the Candidate.
- `allowed_paths`: explicit files or glob patterns; no inferred exceptions.
- `authority_impact`, `persistence_impact`, `provider_impact`, `transaction_impact`.
- `expected_behavior_change` and `non_goals`.
- `rollback_sha`: exact known rollback/checkpoint SHA.
- `severity`: `HARD_BLOCK`, `SOFT_BLOCK`, or `WARNING`.

The manifest itself must be declared in `allowed_paths`. A path outside the list is `UNDECLARED_BLAST_RADIUS`; reviewers decide whether to narrow the diff or issue a new declaration. The classifier never guesses that an undeclared path is reasonable.

The workflow uses the live Pull Request base as the effective `BASE...HEAD` comparison. If an owned manifest declares another base, it reports `STALE_MANIFEST_BASE_IGNORED` and does not widen the diff from that stale SHA. If the manifest is missing or inherited unchanged, Shadow Mode reports `MANIFEST_NOT_CANDIDATE_OWNED` and `GOVERNANCE_EVIDENCE_MISSING`, ignores its declarations, and classifies the live-base diff without turning the evidence gap into an undeclared-path failure. A future promoted gate may strengthen this policy; Shadow Mode remains non-blocking.

## Gate contract

Every aggregate gate exposes these five properties:

| Gate | SEVERITY | SCOPE | KNOWN_RED_POLICY | BYPASS_POLICY | BLOCKING_BEHAVIOR now |
|---|---|---|---|---|---|
| Change Scope | HARD risk for undeclared or unmapped paths | `BASE...HEAD` changed files | Not applicable | No bypass for undeclared destructive data work | `SHADOW_REPORT_ONLY` |
| Critical Regression | Per selected suite: build is HARD, scoped behavior is SOFT, critical cross-port integrity is HARD | Only mapped ports and cross-port seams | Base red + Candidate red is non-blocking known red | Owner-recorded buffer only; critical exclusions below | `SHADOW_REPORT_ONLY` |
| Authority Safety | HARD for shared authority, destructive persistence, Order/Money, or secret/security risk | Manifest impacts plus authority paths | Historical red never creates authority | No critical bypass | `SHADOW_REPORT_ONLY` |

No new gate is a Required Check in this version. The workflow reports `PASS`, `PASS_WITH_WARNINGS`, `SOFT_REVIEW`, or `HARD_BLOCK`, but its process remains successful in Shadow Mode so it cannot become a new repository-wide outage.

## Scope mapping

| Changed path | Affected scope | Existing checks selected |
|---|---|---|
| `v2smm/**` | SMM + SMT/SMM | SMM test/build + existing SMT SMM focused tests |
| `v2local/**` | SMT | SMT test/build |
| `v2admin/**` | Admin + Admin/SMT | Admin test/build + existing SMT Admin focused tests |
| `v2customer/**` | Customer + Customer/SMT | Customer test/build + existing SMT Customer focused tests |
| `v2owner/**` | Owner + Owner/Admin | Owner test/build + existing Admin Owner-boundary tests |
| `integrations/keeta/**` | Keeta + Admin + SMT | Keeta test/build + existing Admin/SMT Keeta focused tests |
| `contracts/**` | All affected ports | All current package test/build surfaces; shared-authority review |
| `carrier/**` | Carrier + SMT + Print + OTA | Existing carrier-boundary tests; Builder/device/physical evidence remains external |
| governance/docs only | Governance | Governance self-test only; no product-wide suite |
| unknown path | Unmapped HARD risk | Stop and declare scope; no inferred pass |

The runner uses the same package scripts and focused test files already invoked by current workflows. It adds orchestration and comparison, not a second test, Builder, deploy, or OTA system.

## Base versus Candidate

| Base | Candidate | Classification | Effect |
|---|---|---|---|
| GREEN | RED | `NEW_REGRESSION` | HARD or SOFT risk from suite severity |
| RED | RED | `KNOWN_RED` | Warning, non-blocking |
| RED | GREEN | `IMPROVEMENT` | Warning/evidence |
| GREEN | GREEN | Pass | No risk |

Base and Candidate run the same selected command after separate dependency installs. Missing or malformed evidence is a warning in Shadow Mode; it is never silently treated as green.

## Decision report

The workflow publishes:

`CAPABILITY`, `MANIFEST_OWNERSHIP`, `DECLARED_BASE_SHA`, `EFFECTIVE_BASE_SHA`, `CHANGED_FILES`, `AFFECTED_PORTS`, `HARD_RISKS`, `SOFT_RISKS`, `WARNINGS`, `KNOWN_REDS`, `RELEVANT_TESTS`, `UNDECLARED_PATHS`, and `DECISION`.

JSON is retained in the workflow workspace and the Markdown form is written to the GitHub job summary. The current workflow has no deploy permissions and calls no deploy, Builder, OTA, or repository-settings API.

## Buffer and bypass policy

Owner may grant a one-time or expiring bypass for:

- documentation drift;
- an unrelated known red;
- a visual warning;
- a non-critical experimental workflow;
- a scoped soft review.

Every bypass record must state `reason`, `check`, `scope`, `expires_at` or `one-time`, and exact `rollback_sha`. It must be placed in the PR evidence before promotion.

No bypass is permitted for:

- destructive persistence or schema migration;
- Order integrity;
- Money integrity;
- authority split;
- secrets or critical security;
- an undeclared destructive data operation.

A bypass only addresses the named check and scope. It does not grant merge, deploy, OTA, or future-Candidate authority.

## Shadow exit and promotion criteria

Governance self-test, scope analysis, test execution, and final report steps use non-blocking workflow behavior. A tooling failure is reported as `GOVERNANCE_TOOLING_FAILURE`; existing product/deploy paths remain independent. Promotion from Shadow Mode requires Owner approval after reviewing false positives, known reds, unrelated workflow noise, scope accuracy, and human/AI use. Ruleset changes are separately proposed in `MFK_MAIN_RULESET_PROPOSAL.md` and are not automated here.
