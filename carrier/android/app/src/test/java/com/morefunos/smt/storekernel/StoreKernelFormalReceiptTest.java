package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class StoreKernelFormalReceiptTest {
    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;
    private String persistentDatabaseName;

    @Before
    public void setUp() {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
    }

    @After
    public void tearDown() {
        if (coordinator != null) coordinator.close();
        if (database != null && database.isOpen()) database.closeStoreKernel();
        if (persistentDatabaseName != null) {
            RuntimeEnvironment.getApplication().deleteDatabase(persistentDatabaseName);
        }
    }

    @Test
    public void rejectedResultIsDurableAndReplaysBySubmissionIdentity() throws Exception {
        final StoreKernelContract.CommandResultRequest request = resultRequest("a".repeat(64), "MFP_CHECKOUT_PRODUCTION_BINDING_MISSING");

        final StoreKernelTransactionCoordinator.CommandReceiptReadResult first = coordinator.recordCommandResult(request).get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult replay = coordinator.recordCommandResult(request).get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult readback = coordinator
            .readCommandReceiptByCommandId("READ-1", "MF01", "SUB-01")
            .get(5, TimeUnit.SECONDS);

        assertTrue(first.found);
        assertEquals(first.resultJson, replay.resultJson);
        assertEquals(first.resultJson, readback.resultJson);
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().aggregateCount());
    }

    @Test
    public void sameSubmissionWithDifferentFingerprintConflictsWithoutSecondReceipt() throws Exception {
        coordinator.recordCommandResult(resultRequest("a".repeat(64), "BLOCKED")).get(5, TimeUnit.SECONDS);

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.recordCommandResult(resultRequest("b".repeat(64), "BLOCKED")).get(5, TimeUnit.SECONDS)
        );
        assertEquals("STORE_KERNEL_IDEMPOTENCY_FINGERPRINT_CONFLICT", error.getCause().getMessage());

        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().aggregateCount());
    }

    @Test
    public void staleReadDependencyRollsBackCheckoutBeforeAnyWrite() throws Exception {
        coordinator.commit(commitRequest("CONFIG-1", "ADMIN_CONFIG", "ACTIVE", 0)).get(5, TimeUnit.SECONDS);
        final StoreKernelContract.CommitRequest checkout = commitRequest("CHECKOUT-1", "ORDER", "ORDER-1", 0)
            .withReadDependencies(List.of(new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)));
        coordinator.commit(commitRequest("CONFIG-2", "ADMIN_CONFIG", "ACTIVE", 1)).get(5, TimeUnit.SECONDS);

        final long aggregateCount = database.storeKernelDao().aggregateCount();
        final long receiptCount = database.storeKernelDao().receiptCount();
        final long outboxCount = database.storeKernelDao().outboxCount();
        final long journalCount = database.storeKernelDao().journalCount();
        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(checkout).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", error.getCause().getMessage());
        assertEquals(aggregateCount, database.storeKernelDao().aggregateCount());
        assertEquals(receiptCount, database.storeKernelDao().receiptCount());
        assertEquals(outboxCount, database.storeKernelDao().outboxCount());
        assertEquals(journalCount, database.storeKernelDao().journalCount());
        assertEquals(null, database.storeKernelDao().readAggregate("MF01", "ORDER", "ORDER-1"));
    }

    @Test
    public void committedReplayWinsAfterReadDependencyAdvances() throws Exception {
        final StoreKernelContract.CommitRequest checkout = commitRequest("CHECKOUT-2", "ORDER", "ORDER-2", 0)
            .withReadDependencies(List.of(new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 0)));
        final StoreKernelTransactionCoordinator.CommitResult first = coordinator.commit(checkout).get(5, TimeUnit.SECONDS);
        coordinator.commit(commitRequest("CONFIG-1", "ADMIN_CONFIG", "ACTIVE", 0)).get(5, TimeUnit.SECONDS);

        final StoreKernelTransactionCoordinator.CommitResult replay = coordinator.commit(checkout).get(5, TimeUnit.SECONDS);

        assertFalse(first.replayed);
        assertTrue(replay.replayed);
        assertEquals(first.commitSequence, replay.commitSequence);
        assertEquals(first.resultJson, replay.resultJson);
        assertEquals(2, database.storeKernelDao().aggregateCount());
        assertEquals(2, database.storeKernelDao().receiptCount());
    }

    @Test
    public void missingReadDependencyRevisionZeroConflictsAfterCreation() throws Exception {
        final StoreKernelContract.CommitRequest checkout = commitRequest("CHECKOUT-3", "ORDER", "ORDER-3", 0)
            .withReadDependencies(List.of(new StoreKernelContract.AggregateReadDependency("BUSINESS_DAY", "ACTIVE", 0)));
        coordinator.commit(commitRequest("DAY-1", "BUSINESS_DAY", "ACTIVE", 0)).get(5, TimeUnit.SECONDS);

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(checkout).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", error.getCause().getMessage());
        assertEquals(null, database.storeKernelDao().readAggregate("MF01", "ORDER", "ORDER-3"));
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void duplicateReadDependenciesFailClosed() throws Exception {
        final StoreKernelContract.CommitRequest request = commitRequest("CHECKOUT-4", "ORDER", "ORDER-4", 0);

        final IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> request.withReadDependencies(List.of(
                new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1),
                new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)
            ))
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCIES_INVALID", error.getMessage());
        assertEquals(0, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
    }

    @Test
    public void matchingReadDependencyDoesNotWriteOrAdvanceItsRevision() throws Exception {
        seedAggregate("MF01", "ADMIN_CONFIG", "ACTIVE", 3);

        coordinator.commit(nativeCommitRequest("MATCH-1").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 3)
        ))).get(5, TimeUnit.SECONDS);

        assertEquals(3, aggregateRevision("MF01", "ADMIN_CONFIG", "ACTIVE"));
        assertEquals(2, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().outboxCount());
        assertEquals(3, database.storeKernelDao().journalCount());
    }

    @Test
    public void expectedAbsenceIsSupportedAndReadsAreStoreScoped() throws Exception {
        seedAggregate("ANOTHER_STORE", "ADMIN_CONFIG", "ACTIVE", 7);

        coordinator.commit(nativeCommitRequest("STORE-SCOPE-1").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 0)
        ))).get(5, TimeUnit.SECONDS);

        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().aggregateCount());
    }

    @Test
    public void mutationCasStillAppliesWithMatchingReadDependency() throws Exception {
        seedAggregate("MF01", "ADMIN_CONFIG", "ACTIVE", 1);
        coordinator.commit(nativeCommitRequest("CAS-1").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)
        ))).get(5, TimeUnit.SECONDS);
        final StoreKernelContract.CommitRequest conflicting = nativeCommitRequest("CAS-2").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)
        ));

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(conflicting).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_AGGREGATE_REVISION_CONFLICT", error.getCause().getMessage());
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void readAndWriteMayShareAKeyWithoutExtraMutation() throws Exception {
        seedAggregate("MF01", "ADMIN_CONFIG", "ACTIVE", 1);
        final StoreKernelContract.CommitRequest request = new StoreKernelContract.CommitRequest(
            "REQ-BOTH", "BOTH-1", "MF01", "TEST_PERSISTENCE", "IDEMP-BOTH", "a".repeat(64), "{}",
            "TRACE-BOTH", "2026-10-03T00:00:00.000Z",
            List.of(new StoreKernelContract.AggregateMutation("ADMIN_CONFIG", "ACTIVE", 1, "{}")),
            List.of(), null
        ).withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)
        ));

        coordinator.commit(request).get(5, TimeUnit.SECONDS);

        assertEquals(2, aggregateRevision("MF01", "ADMIN_CONFIG", "ACTIVE"));
        assertEquals(1, database.storeKernelDao().aggregateCount());
    }

    @Test
    public void everyReadDependencyIsCheckedBeforeWrites() throws Exception {
        seedAggregate("MF01", "ADMIN_CONFIG", "ACTIVE", 1);
        final StoreKernelContract.CommitRequest request = nativeCommitRequest("ALL-READS-1").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1),
            new StoreKernelContract.AggregateReadDependency("BUSINESS_DAY", "ACTIVE", 1)
        ));

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(request).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", error.getCause().getMessage());
        assertEquals(1, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().outboxCount());
        assertEquals(0, database.storeKernelDao().journalCount());
    }

    @Test
    public void readDependenciesAreDefensivelyCopiedAndBounded() {
        final StoreKernelContract.AggregateReadDependency dependency =
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1);
        final List<StoreKernelContract.AggregateReadDependency> mutable = new ArrayList<>(List.of(dependency));
        final StoreKernelContract.CommitRequest request = nativeCommitRequest("COPY-1").withReadDependencies(mutable);
        mutable.clear();

        assertEquals(1, request.readDependencies.size());
        assertThrows(UnsupportedOperationException.class, () -> request.readDependencies.clear());
        assertThrows(IllegalArgumentException.class, () -> nativeCommitRequest("COPY-2").withReadDependencies(null));
        assertThrows(IllegalArgumentException.class, () -> nativeCommitRequest("COPY-3").withReadDependencies(List.of(dependency, dependency)));
        final List<StoreKernelContract.AggregateReadDependency> tooMany = new ArrayList<>();
        for (int index = 0; index <= StoreKernelContract.MAX_READ_DEPENDENCIES; index++) {
            tooMany.add(new StoreKernelContract.AggregateReadDependency("TEST", "KEY-" + index, 0));
        }
        assertThrows(IllegalArgumentException.class, () -> nativeCommitRequest("COPY-4").withReadDependencies(tooMany));
    }

    @Test
    public void readDependencyIdentityAndRevisionFailClosed() {
        assertThrows(IllegalArgumentException.class, () -> new StoreKernelContract.AggregateReadDependency("", "D", 1));
        assertThrows(IllegalArgumentException.class, () -> new StoreKernelContract.AggregateReadDependency(" T", "D", 1));
        assertThrows(IllegalArgumentException.class, () -> new StoreKernelContract.AggregateReadDependency("T", "D\n", 1));
        assertThrows(IllegalArgumentException.class, () -> new StoreKernelContract.AggregateReadDependency("T", "D", -1));
    }

    @Test
    public void oldNativeCommitConstructionRemainsCompatible() throws Exception {
        final StoreKernelContract.CommitRequest request = nativeCommitRequest("COMPAT-1");

        assertTrue(request.readDependencies.isEmpty());
        coordinator.commit(request).get(5, TimeUnit.SECONDS);
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void wireCannotInjectTrustedReadDependencies() throws Exception {
        final JSONObject raw = new JSONObject()
            .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
            .put("type", StoreKernelContract.COMMIT)
            .put("readDependencies", new JSONArray());

        final IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> StoreKernelContract.parseCommit(raw)
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCIES_NATIVE_ONLY", error.getMessage());
    }

    @Test
    public void transactionFailureAfterReceiptRollsBackEveryCommitEffect() throws Exception {
        seedAggregate("MF01", "ADMIN_CONFIG", "ACTIVE", 1);
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.AFTER_RECEIPT
        );
        final StoreKernelContract.CommitRequest request = nativeCommitRequest("ROLLBACK-1").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)
        ));

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(request).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_TEST_FAILURE_AFTER_RECEIPT", error.getCause().getMessage());
        assertEquals(1, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().outboxCount());
        assertEquals(0, database.storeKernelDao().journalCount());
        assertEquals(null, database.storeKernelDao().readAggregate("MF01", "TEST_WRITE_TARGET", "TARGET"));
    }

    @Test
    public void serializedRaceRejectsPreparedCheckoutAfterDependencyAdvance() throws Exception {
        seedAggregate("MF01", "ADMIN_CONFIG", "ACTIVE", 1);
        final StoreKernelContract.CommitRequest preparedCheckout = nativeCommitRequest("RACE-CHECKOUT").withReadDependencies(List.of(
            new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 1)
        ));

        final CompletableFuture<StoreKernelTransactionCoordinator.CommitResult> advance = coordinator.commit(
            commitRequest("RACE-CONFIG", "ADMIN_CONFIG", "ACTIVE", 1)
        );
        final CompletableFuture<StoreKernelTransactionCoordinator.CommitResult> checkout = coordinator.commit(preparedCheckout);
        advance.get(5, TimeUnit.SECONDS);
        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> checkout.get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", error.getCause().getMessage());
        assertEquals(2, aggregateRevision("MF01", "ADMIN_CONFIG", "ACTIVE"));
        assertEquals(null, database.storeKernelDao().readAggregate("MF01", "TEST_WRITE_TARGET", "TARGET"));
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(1, database.storeKernelDao().outboxCount());
    }

    @Test
    public void lostReplyRecoversFromDurableReceiptAndReplaysWithoutSecondEffect() throws Exception {
        final StoreKernelContract.CommitRequest request = commitRequest("LOST-REPLY", "ORDER", "ORDER-LOST", 0)
            .withReadDependencies(List.of(new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 0)));

        coordinator.commit(request).get(5, TimeUnit.SECONDS); // Simulate a committed reply the caller lost.
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult readback = coordinator
            .readCommandReceiptByCommandId("READ-LOST", "MF01", "LOST-REPLY")
            .get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommitResult replay = coordinator.commit(request).get(5, TimeUnit.SECONDS);

        assertTrue(readback.found);
        assertEquals(request.resultJson, readback.resultJson);
        assertTrue(replay.replayed);
        assertEquals(readback.commitSequence, replay.commitSequence);
        assertEquals(1, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(1, database.storeKernelDao().outboxCount());
    }

    @Test
    public void committedReceiptAndEffectsReplayAfterDatabaseReopen() throws Exception {
        switchToPersistentDatabase("store-kernel-reopen-test.db");
        final StoreKernelContract.CommitRequest request = commitRequest("REOPEN-1", "ORDER", "ORDER-REOPEN", 0)
            .withReadDependencies(List.of(new StoreKernelContract.AggregateReadDependency("ADMIN_CONFIG", "ACTIVE", 0)));
        final StoreKernelTransactionCoordinator.CommitResult first = coordinator.commit(request).get(5, TimeUnit.SECONDS);

        coordinator.close();
        database.closeStoreKernel();
        database = openPersistentDatabase(persistentDatabaseName);
        coordinator = new StoreKernelTransactionCoordinator(database);
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult readback = coordinator
            .readCommandReceiptByCommandId("READ-REOPEN", "MF01", "REOPEN-1")
            .get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommitResult replay = coordinator.commit(request).get(5, TimeUnit.SECONDS);

        assertTrue(readback.found);
        assertTrue(replay.replayed);
        assertEquals(first.commitSequence, replay.commitSequence);
        assertEquals(first.resultJson, readback.resultJson);
        assertEquals(1, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(1, database.storeKernelDao().outboxCount());
    }

    private static StoreKernelContract.CommandResultRequest resultRequest(String fingerprint, String rejectionCode) throws Exception {
        final String result = new JSONObject()
            .put("schema", "mfp.store-kernel.submission.result.v1")
            .put("submissionId", "SUB-01")
            .put("state", "REJECTED")
            .put("rejectionCode", rejectionCode)
            .toString();
        return new StoreKernelContract.CommandResultRequest(
            "REQ-1",
            "SUB-01",
            "MF01",
            "STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY",
            "IDEMP-01",
            fingerprint,
            result,
            "TRACE-SUB-01",
            "2026-10-02T06:02:00.000Z"
        );
    }

    private static StoreKernelContract.CommitRequest commitRequest(
        String commandId,
        String aggregateType,
        String aggregateId,
        long expectedRevision
    ) throws Exception {
        final JSONObject request = new JSONObject()
            .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
            .put("type", StoreKernelContract.COMMIT)
            .put("requestId", "REQ-" + commandId)
            .put("commandId", commandId)
            .put("storeId", "MF01")
            .put("operationId", "STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY")
            .put("idempotencyKey", "IDEMP-" + commandId)
            .put("requestFingerprint", "c".repeat(64))
            .put("result", new JSONObject()
                .put("schema", "mfp.store-kernel.submission.result.v1")
                .put("submissionId", commandId)
                .put("state", "COMMITTED"))
            .put("traceId", "TRACE-" + commandId)
            .put("committedAt", "2026-10-03T00:00:00.000Z")
            .put("mutations", new JSONArray().put(new JSONObject()
                .put("aggregateType", aggregateType)
                .put("aggregateId", aggregateId)
                .put("expectedRevision", expectedRevision)
                .put("state", new JSONObject().put("commandId", commandId))))
            .put("outbox", new JSONArray().put(new JSONObject()
                .put("eventId", "EVENT-" + commandId)
                .put("aggregateType", aggregateType)
                .put("aggregateId", aggregateId)
                .put("aggregateRevision", expectedRevision + 1)
                .put("eventType", aggregateType + "_COMMITTED")
                .put("occurredAt", "2026-10-03T00:00:00.000Z")
                .put("payload", new JSONObject().put("commandId", commandId))));
        return StoreKernelContract.parseCommit(request);
    }

    private static StoreKernelContract.CommitRequest nativeCommitRequest(String commandId) {
        return new StoreKernelContract.CommitRequest(
            "REQ-" + commandId,
            commandId,
            "MF01",
            "TEST_PERSISTENCE",
            "IDEMP-" + commandId,
            "a".repeat(64),
            "{}",
            "TRACE-" + commandId,
            "2026-10-03T00:00:00.000Z",
            List.of(new StoreKernelContract.AggregateMutation("TEST_WRITE_TARGET", "TARGET", 0, "{}")),
            List.of(),
            null
        );
    }

    private void seedAggregate(String storeId, String aggregateType, String aggregateId, long revision) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            storeId,
            aggregateType,
            aggregateId,
            revision,
            "{}",
            StoreKernelContract.sha256("{}"),
            "before"
        ));
    }

    private long aggregateRevision(String storeId, String aggregateType, String aggregateId) {
        return database.storeKernelDao().readAggregate(storeId, aggregateType, aggregateId).revision;
    }

    private void switchToPersistentDatabase(String databaseName) {
        coordinator.close();
        database.closeStoreKernel();
        persistentDatabaseName = databaseName;
        RuntimeEnvironment.getApplication().deleteDatabase(databaseName);
        database = openPersistentDatabase(databaseName);
        coordinator = new StoreKernelTransactionCoordinator(database);
    }

    private static StoreKernelDatabase openPersistentDatabase(String databaseName) {
        final Context context = RuntimeEnvironment.getApplication();
        return StoreKernelDatabase.configure(
            Room.databaseBuilder(context, StoreKernelDatabase.class, databaseName).allowMainThreadQueries()
        ).build();
    }
}
