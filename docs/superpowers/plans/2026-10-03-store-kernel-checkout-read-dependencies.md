# Store Kernel Checkout Read Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Store Kernel commit atomically reject when a canonical aggregate read by checkout changes before the write transaction commits.

**Architecture:** Extend the existing `StoreKernelContract.CommitRequest` with an immutable, native-only read set. `StoreKernelTransactionCoordinator` checks every declared aggregate revision inside the same Room transaction, after receipt replay and before any aggregate, receipt, inbox, outbox, or journal write. Existing browser commit JSON stays unchanged and existing callers default to an empty read set.

**Tech Stack:** Java 17, Android Room 2.8.5, Robolectric 4.16, JUnit 4

**Spec:** `docs/governance/MFP_V3_A9R_FORMAL_BUSINESS_ROUTER_AUTHORITY_2026-10-02.md`

## Global Constraints

- Use the existing `StoreKernelTransactionCoordinator` and Store Kernel Room database only.
- Receipt replay runs before dependency validation, so a confirmed prior result remains replayable after source facts advance.
- A dependency mismatch makes zero writes and returns a stable known Store Kernel rejection; it never fabricates `COMMITTED`.
- Do not expose read dependencies in the browser `store.kernel.commit.v1` parser.
- No deploy, OTA, Candidate publish, merge, second database, or live financial transaction.

## Review Focus

- A dependency revision changes after handler preparation: checkout commit rejects with zero mutations, receipts, and outbox effects.
- An already committed submission is retried after dependencies advance: the stored receipt replays before the stale dependency is evaluated.
- A declared dependency is absent: expected revision `0` is accepted and any later creation conflicts.
- Duplicate dependency keys: construction fails closed before coordinator execution.
- Existing commits with no read set: behavior and tests remain unchanged.

---

### Task 1: Atomic Native Read Set

**Files:**
- Modify: `carrier/android/app/src/main/java/com/morefunos/smt/storekernel/StoreKernelContract.java`
- Modify: `carrier/android/app/src/main/java/com/morefunos/smt/storekernel/StoreKernelTransactionCoordinator.java`
- Modify: `carrier/android/app/src/test/java/com/morefunos/smt/storekernel/StoreKernelFormalReceiptTest.java`
- Modify: `.github/mfk-change-manifest.json`

**Interfaces:**
- Consumes: existing `StoreKernelContract.CommitRequest`, aggregate revisions, and receipt-first idempotency flow.
- Produces: immutable `StoreKernelContract.AggregateReadDependency` values and `CommitRequest.withReadDependencies(List<AggregateReadDependency>)`; coordinator rejection code `STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT`.

- [x] **Step 1: Write the failing Room tests**

Add tests named `staleReadDependencyRollsBackCheckoutBeforeAnyWrite`, `committedReplayWinsAfterReadDependencyAdvances`, `missingReadDependencyRevisionZeroConflictsAfterCreation`, and `duplicateReadDependenciesFailClosed`. Also fix the existing receipt-fingerprint conflict test so it must observe an exception.

- [x] **Step 2: Run the focused test class and verify RED**

Run: installed Gradle 9.3.1 `testDebugUnitTest -x verifySmtWebBundle --tests com.morefunos.smt.storekernel.StoreKernelFormalReceiptTest --no-daemon`

Observed: compilation failed because `AggregateReadDependency` / `withReadDependencies` did not exist before implementation.

- [x] **Step 3: Implement the immutable native-only read set**

Add `AggregateReadDependency(String aggregateType, String aggregateId, long expectedRevision)` and `CommitRequest.withReadDependencies(List<AggregateReadDependency>)`. Copy and freeze inputs, reject invalid/duplicate keys, keep parsed browser requests on the empty read set, and validate each dependency with `dao.readAggregate(...)` after prior-receipt replay and closed-commit shape validation but before any aggregate, receipt, outbox, inbox, or journal mutation.

- [x] **Step 4: Run focused and scoped suites and verify GREEN**

Run: the focused receipt test, then the existing A9R business and receipt classes together.

Observed: the focused Room class passed 19/19. The scoped A9R contract/router/Room suite passed 32/32 (5 contract, 8 router, 19 persistence), including rollback, serialized race, lost-reply readback, and database reopen coverage.

- [x] **Step 5: Commit**

Commit only the three source/test files, manifest scope update, and this plan with message `feat(mfp): guard formal checkout read dependencies`.
