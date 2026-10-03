package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalBusinessCommandContract;
import com.morefunos.smt.storekernel.business.FormalBusinessCommandRouter;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler;
import com.morefunos.smt.storekernel.business.FormalCheckoutCommitFactory;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords;
import com.morefunos.smt.storekernel.business.FormalSecurityAuthority;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.BusinessDay;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountDecision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Facts;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Line;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Mapping;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Phase;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Quote;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Revision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SecurityEvidence;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SettlementEvidenceMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SourceIdentity;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Submission;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Tender;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.TenderKind;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalCheckoutPaymentConfirmIntegrationTest {
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
        coordinator.close();
        database.closeStoreKernel();
        if (persistentDatabaseName != null) {
            RuntimeEnvironment.getApplication().deleteDatabase(persistentDatabaseName);
        }
    }

    @Test
    public void ordinaryNonStudentCheckoutCommitsOrderPaymentOutboxAndReceiptAtomically() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        seed(dependencies);

        final StoreKernelContract.CommitRequest request = FormalCheckoutCommitFactory.create(
            command,
            mapping,
            dependencies,
            System.currentTimeMillis() + 60_000L
        );
        final StoreKernelTransactionCoordinator.CommitResult first = coordinator.commit(request).get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommitResult replay = coordinator.commit(request).get(5, TimeUnit.SECONDS);

        assertFalse(first.replayed);
        assertTrue(replay.replayed);
        assertEquals(10, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().outboxCount());

        final StoreKernelAggregateEntity order = database.storeKernelDao().readAggregate(
            "MF01", "ORDER", mapping.order().orderId()
        );
        final StoreKernelAggregateEntity payment = database.storeKernelDao().readAggregate(
            "MF01", "PAYMENT", mapping.payment().paymentId()
        );
        final JSONObject orderJson = new JSONObject(order.stateJson);
        final JSONObject paymentJson = new JSONObject(payment.stateJson);
        assertEquals("mfp.canonical-order.v1", orderJson.getString("schema"));
        assertEquals("WALK_IN", orderJson.getString("source"));
        assertEquals("POS", orderJson.getString("sourcePlatform"));
        assertEquals("0001", orderJson.getString("displayNumber"));
        assertEquals("ACTIVE", orderJson.getString("lifecycleState"));
        assertEquals("IN_PROGRESS", orderJson.getString("fulfillmentState"));
        assertEquals("CASH", orderJson.getString("effectiveTenderId"));
        assertEquals(5_000L, orderJson.getLong("recognizedAmountMinor"));
        assertEquals(0L, orderJson.getLong("outstandingAmountMinor"));
        assertEquals("TAKEAWAY", orderJson.getString("serviceMode"));
        assertEquals("Drink", orderJson.getJSONArray("items").getJSONObject(0).getString("name"));
        assertEquals("DRINK-01", orderJson.getJSONObject("normalizedIntent").getJSONArray("lines")
            .getJSONObject(0).getString("productId"));
        assertFalse(order.stateJson.contains("FORGED-CLIENT-PRODUCT"));
        assertEquals("mfp.canonical-payment.v1", paymentJson.getString("schema"));
        assertEquals(mapping.order().orderId(), paymentJson.getString("orderId"));
        assertEquals(5_000L, paymentJson.getLong("amountMinor"));
        assertEquals("CASH_COUNTED", paymentJson.getJSONObject("tender").getString("evidenceMode"));

        final List<StoreKernelOutboxEntity> outbox = database.storeKernelDao().readAllOutbox();
        assertEquals("MFP_ORDER_COMMITTED_V1", outbox.get(0).eventType);
        assertEquals("MFP_PAYMENT_CONFIRMED_V1", outbox.get(1).eventType);
        assertEquals(mapping.order().orderId(), new JSONObject(outbox.get(0).payloadJson).getString("orderId"));
        assertEquals(mapping.payment().paymentId(), new JSONObject(outbox.get(1).payloadJson).getString("paymentId"));
        assertEquals("0001", new JSONObject(outbox.get(0).payloadJson).getString("displayNumber"));

        final StoreKernelAggregateEntity sequence = database.storeKernelDao().readAggregate(
            "MF01", "ORDER_DISPLAY_SEQUENCE", "DAY-1"
        );
        assertEquals(1L, sequence.revision);
        assertEquals(1L, new JSONObject(sequence.stateJson).getLong("lastAllocatedSequence"));

        final StoreKernelTransactionCoordinator.CommandReceiptReadResult receipt = coordinator
            .readCommandReceiptByCommandId("READ-CHECKOUT", "MF01", command.submissionId)
            .get(5, TimeUnit.SECONDS);
        final FormalBusinessCommandContract.Result result = FormalBusinessCommandContract.Result.fromStoredJson(receipt.resultJson);
        assertTrue(receipt.found);
        assertEquals("COMMITTED", result.state);
        assertEquals(mapping.order().orderId(), result.orderRef);
    }

    @Test
    public void competingCheckoutCannotReuseDisplayNumberOrPartiallyCommit() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope firstCommand = command(
            "FORGED-CLIENT-PRODUCT", 5_000L, "1"
        );
        final FormalBusinessCommandContract.CommandEnvelope secondCommand = command(
            "FORGED-CLIENT-PRODUCT", 5_000L, "2"
        );
        final Mapping firstMapping = FormalCheckoutRecords.map(facts(firstCommand));
        final Mapping secondMapping = FormalCheckoutRecords.map(facts(secondCommand));
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        seed(dependencies);
        final StoreKernelContract.CommitRequest firstRequest = FormalCheckoutCommitFactory.create(
            firstCommand, firstMapping, dependencies, System.currentTimeMillis() + 60_000L
        );
        final StoreKernelContract.CommitRequest secondRequest = FormalCheckoutCommitFactory.create(
            secondCommand, secondMapping, dependencies, System.currentTimeMillis() + 60_000L
        );

        coordinator.commit(firstRequest).get(5, TimeUnit.SECONDS);
        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(secondRequest).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_AGGREGATE_REVISION_CONFLICT", error.getCause().getMessage());
        assertEquals(10, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().outboxCount());
        assertNull(database.storeKernelDao().readAggregate("MF01", "ORDER", secondMapping.order().orderId()));
        assertNull(database.storeKernelDao().readAggregate("MF01", "PAYMENT", secondMapping.payment().paymentId()));
        final StoreKernelAggregateEntity sequence = database.storeKernelDao().readAggregate(
            "MF01", "ORDER_DISPLAY_SEQUENCE", "DAY-1"
        );
        final JSONObject sequenceJson = new JSONObject(sequence.stateJson);
        assertEquals(1L, sequence.revision);
        assertEquals(1L, sequenceJson.getLong("lastAllocatedSequence"));
        assertEquals(firstMapping.order().orderId(), sequenceJson.getString("lastOrderId"));
    }

    @Test
    public void lostCheckoutCommitReplyIsRecoveredFromRealRoomReceipt() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Facts trusted = facts(command);
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        final long confirmedAtEpochMs = trusted.submission().confirmedAt().toEpochMilli();
        seed(dependencies);
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.NONE,
            () -> confirmedAtEpochMs
        );
        final FormalBusinessCommandRouter.Gateway durableGateway = roomGateway();
        final FormalBusinessCommandRouter.Gateway lostReplyGateway = new FormalBusinessCommandRouter.Gateway() {
            @Override
            public CompletableFuture<FormalBusinessCommandRouter.StoredResult> read(String storeId, String submissionId) {
                return durableGateway.read(storeId, submissionId);
            }

            @Override
            public CompletableFuture<FormalBusinessCommandRouter.StoredResult> recordRejected(
                FormalBusinessCommandContract.CommandEnvelope rejectedCommand,
                FormalBusinessCommandContract.Result result
            ) {
                return durableGateway.recordRejected(rejectedCommand, result);
            }

            @Override
            public CompletableFuture<FormalBusinessCommandRouter.StoredResult> commit(
                FormalBusinessCommandContract.CommandEnvelope committedCommand,
                StoreKernelContract.CommitRequest request
            ) {
                return durableGateway.commit(committedCommand, request).thenCompose(ignored ->
                    CompletableFuture.failedFuture(new IllegalStateException("TRANSPORT_REPLY_LOST"))
                );
            }
        };
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            lostReplyGateway,
            allowedSecurity(),
            Map.of("CHECKOUT_PAYMENT_CONFIRM", handler(trusted, dependencies, confirmedAtEpochMs))
        );

        final FormalBusinessCommandContract.Result recovered = router.submit(command).get(5, TimeUnit.SECONDS);
        final FormalBusinessCommandContract.Result replay = router.submit(command).get(5, TimeUnit.SECONDS);

        assertEquals("COMMITTED", recovered.state);
        assertEquals(recovered.toStoredJson(), replay.toStoredJson());
        assertEquals(10, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().outboxCount());
    }

    @Test
    public void committedCheckoutReopensAndReplaysWithoutSecondEffect() throws Exception {
        switchToPersistentDatabase("formal-checkout-reopen-test.db");
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        seed(dependencies);
        final StoreKernelContract.CommitRequest request = FormalCheckoutCommitFactory.create(
            command, mapping, dependencies, System.currentTimeMillis() + 60_000L
        );
        final StoreKernelTransactionCoordinator.CommitResult first = coordinator.commit(request).get(5, TimeUnit.SECONDS);

        coordinator.close();
        database.closeStoreKernel();
        database = openPersistentDatabase(persistentDatabaseName);
        coordinator = new StoreKernelTransactionCoordinator(database);
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult readback = coordinator
            .readCommandReceiptByCommandId("READ-REOPEN-CHECKOUT", "MF01", command.submissionId)
            .get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommitResult replay = coordinator.commit(request).get(5, TimeUnit.SECONDS);

        assertTrue(readback.found);
        assertTrue(replay.replayed);
        assertEquals(first.commitSequence, replay.commitSequence);
        assertEquals(first.resultJson, readback.resultJson);
        assertEquals(10, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().outboxCount());
        assertEquals("0001", new JSONObject(database.storeKernelDao().readAggregate(
            "MF01", "ORDER", mapping.order().orderId()
        ).stateJson).getString("displayNumber"));
    }

    @Test
    public void injectedTrustedPortsRouteOrdinaryCheckoutThroughRealRoomAndDurableReadback() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Facts trusted = facts(command);
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        final long confirmedAtEpochMs = trusted.submission().confirmedAt().toEpochMilli();
        seed(dependencies);
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.NONE,
            () -> confirmedAtEpochMs
        );
        final FormalCheckoutPaymentConfirmHandler handler = handler(trusted, dependencies, confirmedAtEpochMs);
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            roomGateway(),
            allowedSecurity(),
            Map.of("CHECKOUT_PAYMENT_CONFIRM", handler)
        );

        final FormalBusinessCommandContract.Result first = router.submit(command).get(5, TimeUnit.SECONDS);
        final FormalBusinessCommandContract.Result replay = router.submit(command).get(5, TimeUnit.SECONDS);
        final FormalBusinessCommandContract.Result readback = router.read(readRequest(command)).get(5, TimeUnit.SECONDS);

        assertEquals(first.toStoredJson(), "COMMITTED", first.state);
        assertEquals(first.toStoredJson(), replay.toStoredJson());
        assertEquals(first.toStoredJson(), readback.toStoredJson());
        assertEquals(10, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().outboxCount());
    }

    @Test
    public void forgedClientReviewIsRejectedBeforeAnyTransactionWrite() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT", 4_999L);
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));

        final IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutCommitFactory.create(command, mapping, dependencies(), System.currentTimeMillis() + 60_000L)
        );

        assertEquals("FORMAL_CHECKOUT_REVIEW_STALE", error.getMessage());
        assertNoCheckoutWrites(mapping, 0);
    }

    @Test
    public void incompleteTrustedReadSetIsRejectedBeforeAnyTransactionWrite() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> incomplete = dependencies();
        incomplete.remove(incomplete.size() - 1);

        final IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutCommitFactory.create(command, mapping, incomplete, System.currentTimeMillis() + 60_000L)
        );

        assertEquals("FORMAL_CHECKOUT_READ_SET_INCOMPLETE", error.getMessage());
        assertNoCheckoutWrites(mapping, 0);
    }

    @Test
    public void securityAndBusinessDayDependencyRevisionsMustMatchTrustedEvidence() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> mismatched = dependencies();
        mismatched.set(0, new StoreKernelContract.AggregateReadDependency("DEVICE_AUTHORIZATION", "PAD-01", 2));

        final IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutCommitFactory.create(command, mapping, mismatched, System.currentTimeMillis() + 60_000L)
        );

        assertEquals("FORMAL_CHECKOUT_READ_SET_REVISION_MISMATCH", error.getMessage());
        assertNoCheckoutWrites(mapping, 0);
    }

    @Test
    public void malformedOrTrailingTrustedIntentIsRejectedBeforeAnyTransactionWrite() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Facts baseline = facts(command);
        final String coerced = new JSONObject(baseline.validatedIntentJson()).put("checkoutReady", "true").toString();
        final String trailing = baseline.validatedIntentJson() + "{}";
        for (String invalidIntent : List.of(coerced, trailing)) {
            final Mapping mapping = FormalCheckoutRecords.map(withIntent(baseline, invalidIntent));
            final IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> FormalCheckoutCommitFactory.create(
                    command, mapping, dependencies(), System.currentTimeMillis() + 60_000L
                )
            );
            assertEquals("FORMAL_CHECKOUT_INTENT_INVALID", error.getMessage());
            assertNoCheckoutWrites(mapping, 0);
        }
    }

    @Test
    public void staleTrustedFactRollsBackOrderPaymentOutboxAndReceipt() throws Exception {
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        seed(dependencies);
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "FORMAL_QUOTE", "QUOTE-1", 1, 2,
            "{\"fixture\":\"advanced\"}", "advanced-hash", "2026-10-03T01:03:00Z"
        ));
        final StoreKernelContract.CommitRequest request = FormalCheckoutCommitFactory.create(
            command, mapping, dependencies, System.currentTimeMillis() + 60_000L
        );

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(request).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", error.getCause().getMessage());
        assertNoCheckoutWrites(mapping, 7);
    }

    @Test
    public void expiredFreshnessDeadlineRejectsBeforeAnyCheckoutWrite() throws Exception {
        final AtomicLong now = new AtomicLong(2_000L);
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.NONE,
            now::get
        );
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        seed(dependencies);
        final StoreKernelContract.CommitRequest request = FormalCheckoutCommitFactory.create(
            command, mapping, dependencies, 2_000L
        );

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(request).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_COMMIT_DEADLINE_EXPIRED", error.getCause().getMessage());
        assertNoCheckoutWrites(mapping, 7);
    }

    @Test
    public void injectedFailureAfterReceiptRollsBackWholeCheckout() throws Exception {
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.AFTER_RECEIPT
        );
        final FormalBusinessCommandContract.CommandEnvelope command = command("FORGED-CLIENT-PRODUCT");
        final Mapping mapping = FormalCheckoutRecords.map(facts(command));
        final List<StoreKernelContract.AggregateReadDependency> dependencies = dependencies();
        seed(dependencies);
        final StoreKernelContract.CommitRequest request = FormalCheckoutCommitFactory.create(
            command, mapping, dependencies, System.currentTimeMillis() + 60_000L
        );

        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(request).get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_TEST_FAILURE_AFTER_RECEIPT", error.getCause().getMessage());
        assertNoCheckoutWrites(mapping, 7);
    }

    private void assertNoCheckoutWrites(Mapping mapping, long expectedFixtureCount) {
        assertEquals(expectedFixtureCount, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().outboxCount());
        assertEquals(0, database.storeKernelDao().journalCount());
        assertNull(database.storeKernelDao().readAggregate("MF01", "ORDER", mapping.order().orderId()));
        assertNull(database.storeKernelDao().readAggregate("MF01", "PAYMENT", mapping.payment().paymentId()));
    }

    private FormalBusinessCommandRouter.Gateway roomGateway() {
        return new FormalBusinessCommandRouter.Gateway() {
            @Override
            public CompletableFuture<FormalBusinessCommandRouter.StoredResult> read(String storeId, String submissionId) {
                return coordinator.readCommandReceiptByCommandId("READ-" + submissionId, storeId, submissionId)
                    .thenApply(receipt -> receipt.found ? stored(receipt) : null);
            }

            @Override
            public CompletableFuture<FormalBusinessCommandRouter.StoredResult> recordRejected(
                FormalBusinessCommandContract.CommandEnvelope command,
                FormalBusinessCommandContract.Result result
            ) {
                return coordinator.recordCommandResult(new StoreKernelContract.CommandResultRequest(
                    command.requestId,
                    command.submissionId,
                    command.storeId,
                    FormalBusinessCommandRouter.OPERATION_ID,
                    command.idempotencyKey,
                    command.requestFingerprint,
                    result.toStoredJson(),
                    "formal:" + command.requestFingerprint,
                    "2026-10-03T01:02:01Z"
                )).thenApply(this::stored);
            }

            @Override
            public CompletableFuture<FormalBusinessCommandRouter.StoredResult> commit(
                FormalBusinessCommandContract.CommandEnvelope command,
                StoreKernelContract.CommitRequest request
            ) {
                return coordinator.commit(request).thenApply(result -> {
                    try {
                        return new FormalBusinessCommandRouter.StoredResult(
                            command.requestFingerprint,
                            FormalBusinessCommandContract.Result.fromStoredJson(result.resultJson),
                            true
                        );
                    } catch (Exception error) {
                        throw new CompletionException(error);
                    }
                });
            }

            private FormalBusinessCommandRouter.StoredResult stored(
                StoreKernelTransactionCoordinator.CommandReceiptReadResult receipt
            ) {
                try {
                    return new FormalBusinessCommandRouter.StoredResult(
                        receipt.requestFingerprint,
                        FormalBusinessCommandContract.Result.fromStoredJson(receipt.resultJson),
                        true
                    );
                } catch (Exception error) {
                    throw new CompletionException(error);
                }
            }
        };
    }

    private static FormalCheckoutPaymentConfirmHandler handler(
        Facts trusted,
        List<StoreKernelContract.AggregateReadDependency> dependencies,
        long confirmedAtEpochMs
    ) {
        return new FormalCheckoutPaymentConfirmHandler(
            ignored -> CompletableFuture.completedFuture(new FormalCheckoutPaymentConfirmHandler.SecuritySnapshot(
                trusted.security(), dependencies.subList(0, 3), confirmedAtEpochMs + 2_000L
            )),
            ignored -> CompletableFuture.completedFuture(new FormalCheckoutPaymentConfirmHandler.PricingSnapshot(
                trusted.validatedIntentRef(), trusted.validatedIntentHash(), trusted.validatedIntentJson(),
                trusted.channelId(), trusted.sourceIdentity(), trusted.quote(), trusted.discountDecision(),
                dependencies.subList(3, 5), confirmedAtEpochMs + 1_900L
            )),
            (ignored, pricing) -> CompletableFuture.completedFuture(new FormalCheckoutPaymentConfirmHandler.TenderSnapshot(
                trusted.tender(), trusted.submission().confirmationEvidenceRef(), List.of(dependencies.get(5)), confirmedAtEpochMs + 1_800L
            )),
            ignored -> CompletableFuture.completedFuture(new FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot(
                trusted.day(), List.of(dependencies.get(6)), confirmedAtEpochMs + 2_100L
            )),
            new FormalCheckoutPaymentConfirmHandler.Clock() {
                @Override public long epochMillis() { return confirmedAtEpochMs; }
                @Override public Instant instant() { return trusted.submission().confirmedAt(); }
            }
        );
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

    private static FormalSecurityAuthority allowedSecurity() {
        return new FormalSecurityAuthority() {
            @Override
            public CompletableFuture<Decision> authorize(FormalBusinessCommandContract.CommandEnvelope command) {
                return CompletableFuture.completedFuture(Decision.allowed());
            }

            @Override
            public CompletableFuture<Decision> authorizeReadback(FormalBusinessCommandContract.SubmissionReadRequest request) {
                return CompletableFuture.completedFuture(Decision.allowed());
            }
        };
    }

    private static FormalBusinessCommandContract.SubmissionReadRequest readRequest(
        FormalBusinessCommandContract.CommandEnvelope command
    ) throws Exception {
        return FormalBusinessCommandContract.parseSubmissionRead(new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.submission.read.v1")
            .put("requestId", "READ-CHECKOUT")
            .put("storeId", command.storeId)
            .put("deviceId", command.deviceId)
            .put("staffSessionRef", command.staffSessionRef)
            .put("submissionId", command.submissionId)
            .toString());
    }

    private void seed(List<StoreKernelContract.AggregateReadDependency> dependencies) {
        for (StoreKernelContract.AggregateReadDependency dependency : dependencies) {
            database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
                "MF01",
                dependency.aggregateType,
                dependency.aggregateId,
                dependency.expectedRevision,
                "{\"fixture\":true}",
                "fixture-hash",
                "2026-10-03T01:00:00Z"
            ));
        }
    }

    private static List<StoreKernelContract.AggregateReadDependency> dependencies() {
        final List<StoreKernelContract.AggregateReadDependency> result = new ArrayList<>();
        result.add(new StoreKernelContract.AggregateReadDependency("DEVICE_AUTHORIZATION", "PAD-01", 1));
        result.add(new StoreKernelContract.AggregateReadDependency("OWNER_AUTHORIZATION", "OWNER-AUTH-1", 1));
        result.add(new StoreKernelContract.AggregateReadDependency("STAFF_SESSION", "SESSION-01", 1));
        result.add(new StoreKernelContract.AggregateReadDependency("ADMIN_ACTIVE_CONFIGURATION", "MF01", 1));
        result.add(new StoreKernelContract.AggregateReadDependency("FORMAL_QUOTE", "QUOTE-1", 1));
        result.add(new StoreKernelContract.AggregateReadDependency("POS_TENDER_POLICY", "MF01", 1));
        result.add(new StoreKernelContract.AggregateReadDependency("BUSINESS_DAY", "DAY-1", 1));
        return result;
    }

    private static FormalBusinessCommandContract.CommandEnvelope command(String clientProduct) throws Exception {
        return command(clientProduct, 5_000L);
    }

    private static FormalBusinessCommandContract.CommandEnvelope command(
        String clientProduct,
        long claimedTotalMinor
    ) throws Exception {
        return command(clientProduct, claimedTotalMinor, "1");
    }

    private static FormalBusinessCommandContract.CommandEnvelope command(
        String clientProduct,
        long claimedTotalMinor,
        String identitySuffix
    ) throws Exception {
        final JSONObject review = new JSONObject()
            .put("channelId", "WALK_IN")
            .put("tenderId", "CASH")
            .put("quoteRef", "QUOTE-1")
            .put("formalRevision", "QUOTE-REV-1")
            .put("formalTotalDueMinor", claimedTotalMinor)
            .put("formalDiscountMinor", 0)
            .put("cashReceivedMinor", 5_000)
            .put("changeMinor", 0)
            .put("studentDiscountIntent", JSONObject.NULL)
            .put("sourceIdentity", new JSONObject());
        final JSONObject payload = new JSONObject()
            .put("intent", new JSONObject()
                .put("schema", "mfp.normalized-ordering-intent.v1")
                .put("lines", new JSONArray().put(new JSONObject().put("productId", clientProduct))))
            .put("review", review);
        return FormalBusinessCommandContract.parseCommand(new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.command.v1")
            .put("schema", "mfp.store-kernel.command.v1")
            .put("requestId", "REQ-CHECKOUT-" + identitySuffix)
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUB-CHECKOUT-" + identitySuffix)
            .put("idempotencyKey", "IDEMP-CHECKOUT-" + identitySuffix)
            .put("commandType", "CHECKOUT_PAYMENT_CONFIRM")
            .put("expectedRevision", "QUOTE-REV-1")
            .put("payload", payload)
            .put("createdAt", "2026-10-03T01:02:00Z")
            .toString());
    }

    private static Facts facts(FormalBusinessCommandContract.CommandEnvelope command) throws Exception {
        final String intent = new JSONObject()
            .put("schema", "mfp.normalized-ordering-intent.v1")
            .put("storeId", "MF01")
            .put("serviceMode", "TAKEAWAY")
            .put("checkoutReady", true)
            .put("lines", new JSONArray().put(new JSONObject()
                .put("cartLineId", "LINE-1")
                .put("kind", "PRODUCT")
                .put("productId", "DRINK-01")
                .put("displayName", "Drink")
                .put("comboId", JSONObject.NULL)
                .put("quantity", 1)
                .put("serviceMode", "takeaway")
                .put("optionSelections", new JSONArray())
                .put("comboSelections", new JSONArray())
                .put("materialPriceFacts", new JSONArray().put(new JSONObject()
                    .put("factId", "PRICE-DRINK-01")
                    .put("revision", "MENU-7")))))
            .toString();
        return new Facts(
            Phase.VALIDATED_PAYMENT_CONFIRM,
            new Submission(
                command.storeId,
                command.submissionId,
                command.idempotencyKey,
                command.requestFingerprint,
                "CONFIRM-EVIDENCE-1",
                Instant.parse("2026-10-03T01:02:01Z")
            ),
            new SecurityEvidence(
                "PAD-01", Revision.numeric(1), "SESSION-01", Revision.numeric(1), "STAFF-1",
                "OWNER-AUTH-1", Revision.numeric(1)
            ),
            "INTENT-1",
            StoreKernelContract.sha256(intent),
            intent,
            "WALK_IN",
            new SourceIdentity(null, null, null),
            new Quote(
                "QUOTE-1", Revision.text("QUOTE-REV-1"), "HKD",
                List.of(new Line("LINE-1", 1, 5_000, 5_000, false)),
                List.of(), 5_000, 0, 5_000, List.of("CASH"),
                Instant.parse("2026-10-03T01:02:00Z")
            ),
            new DiscountDecision("NO-STUDENT-1", Revision.text("STUDENT-POLICY-UNUSED"), DiscountMode.NONE, 0, List.of()),
            new Tender(
                "CASH", TenderKind.CASH, SettlementEvidenceMode.CASH_COUNTED,
                "CASH-COUNT-1", 5_000, 5_000L, 0L
            ),
            new BusinessDay(
                "DAY-1", LocalDate.parse("2026-10-03"), Revision.numeric(1), "DAY-CUTOFF-1",
                "0001", "DAY-1", 0, 1
            )
        );
    }

    private static Facts withIntent(Facts facts, String intent) {
        return new Facts(
            facts.phase(), facts.submission(), facts.security(), facts.validatedIntentRef(),
            StoreKernelContract.sha256(intent), intent, facts.channelId(), facts.sourceIdentity(),
            facts.quote(), facts.discountDecision(), facts.tender(), facts.day()
        );
    }
}
