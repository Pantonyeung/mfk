package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.DiningTransitionPlanner;
import com.morefunos.smt.storekernel.business.FormalCanonicalOrderReadProducer;
import com.morefunos.smt.storekernel.business.FormalDiningReadProducer;

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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Real Room/coordinator evidence for the pure Dining planner and canonical Dining/Order reader.
 * The adapter below is deliberately test-only: it does not register a command, define an outbox,
 * or settle the production serializer/result contract described by the integration proposal.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class DiningTransitionPlannerRoomTest {
    private static final String STORE_ID = "MF01";
    private static final String ORDER_ID = "ORDER-1";
    private static final String PAYMENT_ID = "PAYMENT-1";
    private static final String ASSIGNED_AT = "2026-10-03T01:05:00Z";
    private static final String TRANSFERRED_AT = "2026-10-03T01:10:00Z";

    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;

    @Before
    public void setUp() throws Exception {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
        seed(FormalDiningReadProducer.AGGREGATE_TYPE, STORE_ID, 5, diningWaiting().toString());
        seed(FormalCanonicalOrderReadProducer.AGGREGATE_TYPE, ORDER_ID, 3, waitingOrder().toString());
        seed("PAYMENT", PAYMENT_ID, 2, canonicalPayment().toString());
    }

    @After
    public void tearDown() {
        if (coordinator != null) coordinator.close();
        if (database != null && database.isOpen()) database.closeStoreKernel();
    }

    @Test
    public void orderedWaitingAssignmentAndTransferPreserveCanonicalOrderAndFirstSeatedTime()
        throws Exception {
        final FormalDiningReadProducer.Snapshot waiting = read();
        final FormalCanonicalOrderReadProducer.CanonicalOrder before = order(waiting);
        final String rawItemsBefore = rawOrder().getJSONArray("items").toString();
        final String rawAdjustmentsBefore = rawOrder().getJSONArray("adjustments").toString();
        final StoreKernelAggregateEntity paymentBefore = aggregate("PAYMENT", PAYMENT_ID);

        final DiningTransitionPlanner.Plan assignment = planAssignment(waiting, "T01", ASSIGNED_AT);
        coordinator.commit(request("ASSIGN-SEQUENCE", "assign-sequence", waiting, assignment))
            .get(5, TimeUnit.SECONDS);
        final FormalDiningReadProducer.Snapshot assigned = read();
        assertEquals(6L, assigned.revision());
        assertTrue(assigned.waiting().isEmpty());
        assertEquals("OCCUPIED", table(assigned, "T01").state());
        assertEquals(ORDER_ID, table(assigned, "T01").orderId());
        assertEquals("T01", order(assigned).dining().tableId());
        assertEquals(ASSIGNED_AT, order(assigned).dining().seatedAt());

        final DiningTransitionPlanner.Plan transfer = planTransfer(
            assigned,
            "T01",
            "T02",
            TRANSFERRED_AT
        );
        coordinator.commit(request("TRANSFER-SEQUENCE", "transfer-sequence", assigned, transfer))
            .get(5, TimeUnit.SECONDS);
        final FormalDiningReadProducer.Snapshot transferred = read();
        final FormalCanonicalOrderReadProducer.CanonicalOrder after = order(transferred);

        assertEquals(7L, transferred.revision());
        assertEquals("AVAILABLE", table(transferred, "T01").state());
        assertEquals("OCCUPIED", table(transferred, "T02").state());
        assertEquals(ORDER_ID, table(transferred, "T02").orderId());
        assertEquals("T02", after.dining().tableId());
        assertEquals(ASSIGNED_AT, after.dining().seatedAt());
        assertEquals("W1", after.dining().waitingId());
        assertEquals(before.orderId(), after.orderId());
        assertEquals(before.displayNumber(), after.displayNumber());
        assertEquals(before.source(), after.source());
        assertEquals(before.effectiveTenderId(), after.effectiveTenderId());
        assertEquals(before.recognizedAmountMinor(), after.recognizedAmountMinor());
        assertEquals(before.outstandingAmountMinor(), after.outstandingAmountMinor());
        assertEquals(before.refundableAmountMinor(), after.refundableAmountMinor());
        assertEquals(before.items(), after.items());
        assertEquals(before.adjustments(), after.adjustments());
        assertEquals(rawItemsBefore, rawOrder().getJSONArray("items").toString());
        assertEquals(rawAdjustmentsBefore, rawOrder().getJSONArray("adjustments").toString());
        final StoreKernelAggregateEntity paymentAfter = aggregate("PAYMENT", PAYMENT_ID);
        assertEquals(paymentBefore.revision, paymentAfter.revision);
        assertEquals(paymentBefore.stateJson, paymentAfter.stateJson);
        assertEquals(paymentBefore.stateHash, paymentAfter.stateHash);
        assertEquals(2, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().outboxCount());
    }

    @Test
    public void competingAssignmentsFromOneSnapshotAreSerializedAndCommitAtMostOneInRoom()
        throws Exception {
        final FormalDiningReadProducer.Snapshot snapshot = read();
        final StoreKernelContract.CommitRequest first = request(
            "ASSIGN-RACE-A",
            "assign-race-a",
            snapshot,
            planAssignment(snapshot, "T01", ASSIGNED_AT)
        );
        final StoreKernelContract.CommitRequest second = request(
            "ASSIGN-RACE-B",
            "assign-race-b",
            snapshot,
            planAssignment(snapshot, "T02", ASSIGNED_AT)
        );

        final CountDownLatch ready = new CountDownLatch(2);
        final CountDownLatch start = new CountDownLatch(1);
        final ExecutorService callers = Executors.newFixedThreadPool(2);
        try {
            final Future<Object> firstOutcome = callers.submit(() -> commitOutcome(first, ready, start));
            final Future<Object> secondOutcome = callers.submit(() -> commitOutcome(second, ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            final List<Object> outcomes = List.of(
                firstOutcome.get(5, TimeUnit.SECONDS),
                secondOutcome.get(5, TimeUnit.SECONDS)
            );
            assertEquals(1, outcomes.stream()
                .filter(StoreKernelTransactionCoordinator.CommitResult.class::isInstance).count());
            assertEquals(1, outcomes.stream()
                .filter(value -> value instanceof Throwable
                    && "STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT".equals(
                        ((Throwable) value).getMessage()
                    ))
                .count());
        } finally {
            callers.shutdownNow();
        }

        final FormalDiningReadProducer.Snapshot committed = read();
        final long occupied = committed.tables().stream()
            .filter(value -> "OCCUPIED".equals(value.state()))
            .count();
        assertEquals(1, occupied);
        assertTrue(committed.waiting().isEmpty());
        assertEquals(order(committed).dining().tableId(), committed.tables().stream()
            .filter(value -> "OCCUPIED".equals(value.state()))
            .findFirst().orElseThrow().tableId());
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void committedAssignmentReplaysAndChangedFingerprintCannotWriteAgain() throws Exception {
        final FormalDiningReadProducer.Snapshot snapshot = read();
        final DiningTransitionPlanner.Plan plan = planAssignment(snapshot, "T01", ASSIGNED_AT);
        final StoreKernelContract.CommitRequest request = request(
            "ASSIGN-REPLAY",
            "assign-replay-original",
            snapshot,
            plan
        );
        final StoreKernelContract.CommitRequest changedFingerprint = request(
            "ASSIGN-REPLAY",
            "assign-replay-changed",
            snapshot,
            plan
        );

        final StoreKernelTransactionCoordinator.CommitResult first = coordinator.commit(request)
            .get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommitResult replay = coordinator.commit(request)
            .get(5, TimeUnit.SECONDS);
        final ExecutionException conflict = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(changedFingerprint).get(5, TimeUnit.SECONDS)
        );

        assertFalse(first.replayed);
        assertTrue(replay.replayed);
        assertEquals(first.commitSequence, replay.commitSequence);
        assertEquals("STORE_KERNEL_IDEMPOTENCY_FINGERPRINT_CONFLICT", conflict.getCause().getMessage());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(3, database.storeKernelDao().aggregateCount());
        assertEquals(6L, read().revision());
    }

    @Test
    public void stalePreparedAssignmentFailsAfterWaitingRevisionAdvance() throws Exception {
        final FormalDiningReadProducer.Snapshot snapshot = read();
        final StoreKernelContract.CommitRequest staleAssignment = request(
            "ASSIGN-STALE",
            "assign-stale",
            snapshot,
            planAssignment(snapshot, "T01", ASSIGNED_AT)
        );
        final DiningTransitionPlanner.Plan waitingCreate = DiningTransitionPlanner.plan(
            "DINING_WAITING_CREATE",
            snapshot.revision(),
            map("partySize", 3L, "customerDisplayName", "June"),
            plannerRead(snapshot),
            map(
                "storeId", STORE_ID,
                "occurredAt", "2026-10-03T01:04:00Z",
                "waitingId", "W2",
                "displayNumber", "Q002"
            )
        );
        coordinator.commit(request("WAITING-ADVANCE", "waiting-advance", snapshot, waitingCreate))
            .get(5, TimeUnit.SECONDS);

        final ExecutionException conflict = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(staleAssignment).get(5, TimeUnit.SECONDS)
        );
        final FormalDiningReadProducer.Snapshot after = read();

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", conflict.getCause().getMessage());
        assertEquals(6L, after.revision());
        assertEquals(2, after.waiting().size());
        assertEquals("AVAILABLE", table(after, "T01").state());
        assertEquals(3L, order(after).revision());
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void cancellationMembershipRevisionInvalidatesPreparedTransfer() throws Exception {
        final FormalDiningReadProducer.Snapshot waiting = read();
        coordinator.commit(request(
            "ASSIGN-BEFORE-CANCEL",
            "assign-before-cancel",
            waiting,
            planAssignment(waiting, "T01", ASSIGNED_AT)
        )).get(5, TimeUnit.SECONDS);
        final FormalDiningReadProducer.Snapshot assigned = read();
        final StoreKernelContract.CommitRequest staleTransfer = request(
            "TRANSFER-AFTER-CANCEL",
            "transfer-after-cancel",
            assigned,
            planTransfer(assigned, "T01", "T02", TRANSFERRED_AT)
        );

        // Test-only lifecycle writer: the semantic release policy remains deliberately undefined,
        // but the membership-affecting lifecycle write must share/bump the Dining aggregate CAS.
        coordinator.commit(cancellationMembershipInvalidation(assigned))
            .get(5, TimeUnit.SECONDS);
        final ExecutionException conflict = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(staleTransfer).get(5, TimeUnit.SECONDS)
        );
        final FormalDiningReadProducer.Snapshot cancelled = read();

        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", conflict.getCause().getMessage());
        assertEquals(7L, cancelled.revision());
        assertEquals("CANCELLED", order(cancelled).lifecycleState());
        assertEquals("CANCELLED", order(cancelled).fulfillmentState());
        assertEquals(order(assigned).revision() + 1, order(cancelled).revision());
        final IllegalArgumentException inactive = assertThrows(
            IllegalArgumentException.class,
            () -> planTransfer(cancelled, "T01", "T02", TRANSFERRED_AT)
        );
        assertEquals("DINING_ORDER_NOT_ACTIVE", inactive.getMessage());
        assertEquals(2, database.storeKernelDao().receiptCount());
    }

    @Test
    public void interruptedPlannedAssignmentRollsBackAndCanonicalReadbackCanRetry() throws Exception {
        final FormalDiningReadProducer.Snapshot snapshot = read();
        final StoreKernelContract.CommitRequest assignment = request(
            "ASSIGN-ROLLBACK",
            "assign-rollback",
            snapshot,
            planAssignment(snapshot, "T01", ASSIGNED_AT)
        );
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.AFTER_AGGREGATE_MUTATION
        );

        final ExecutionException failure = assertThrows(
            ExecutionException.class,
            () -> coordinator.commit(assignment).get(5, TimeUnit.SECONDS)
        );
        assertEquals(
            "STORE_KERNEL_TEST_FAILURE_AFTER_AGGREGATE_MUTATION",
            failure.getCause().getMessage()
        );

        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(database);
        final FormalDiningReadProducer.Snapshot rolledBack = read();
        assertEquals(5L, rolledBack.revision());
        assertEquals("W1", rolledBack.waiting().get(0).waitingId());
        assertEquals("AVAILABLE", table(rolledBack, "T01").state());
        assertEquals(3L, order(rolledBack).revision());
        assertEquals("W1", order(rolledBack).dining().waitingId());
        assertNull(order(rolledBack).dining().tableId());
        assertEquals(0, database.storeKernelDao().receiptCount());

        final StoreKernelTransactionCoordinator.CommitResult retried = coordinator.commit(assignment)
            .get(5, TimeUnit.SECONDS);
        assertFalse(retried.replayed);
        final FormalDiningReadProducer.Snapshot committed = read();
        assertEquals(6L, committed.revision());
        assertTrue(committed.waiting().isEmpty());
        assertEquals("T01", order(committed).dining().tableId());
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    private Object commitOutcome(
        StoreKernelContract.CommitRequest request,
        CountDownLatch ready,
        CountDownLatch start
    ) throws Exception {
        ready.countDown();
        assertTrue(start.await(5, TimeUnit.SECONDS));
        try {
            return coordinator.commit(request).get(5, TimeUnit.SECONDS);
        } catch (ExecutionException error) {
            return error.getCause();
        }
    }

    private FormalDiningReadProducer.Snapshot read() throws Exception {
        return new FormalDiningReadProducer(coordinator, STORE_ID)
            .readSnapshot(List.of(ORDER_ID))
            .get(5, TimeUnit.SECONDS);
    }

    private DiningTransitionPlanner.Plan planAssignment(
        FormalDiningReadProducer.Snapshot snapshot,
        String tableId,
        String occurredAt
    ) {
        return DiningTransitionPlanner.plan(
            "DINING_TABLE_ASSIGN",
            snapshot.revision(),
            map(
                "waitingId", "W1",
                "tableId", tableId,
                "expectedTableRevision", revision(table(snapshot, tableId).revision())
            ),
            plannerRead(snapshot),
            map("storeId", STORE_ID, "occurredAt", occurredAt)
        );
    }

    private DiningTransitionPlanner.Plan planTransfer(
        FormalDiningReadProducer.Snapshot snapshot,
        String fromTableId,
        String toTableId,
        String occurredAt
    ) {
        return DiningTransitionPlanner.plan(
            "DINING_TABLE_TRANSFER",
            order(snapshot).revision(),
            map(
                "orderId", ORDER_ID,
                "fromTableId", fromTableId,
                "toTableId", toTableId,
                "expectedTableRevision", revision(table(snapshot, toTableId).revision())
            ),
            plannerRead(snapshot),
            map("storeId", STORE_ID, "occurredAt", occurredAt)
        );
    }

    private StoreKernelContract.CommitRequest request(
        String commandId,
        String fingerprintSeed,
        FormalDiningReadProducer.Snapshot source,
        DiningTransitionPlanner.Plan plan
    ) throws Exception {
        final StoreKernelAggregateEntity diningAggregate = aggregate(
            FormalDiningReadProducer.AGGREGATE_TYPE,
            STORE_ID
        );
        assertEquals(source.revision(), diningAggregate.revision);
        final JSONObject dining = new JSONObject(diningAggregate.stateJson);
        dining.put("revision", source.revision() + 1);
        applyWaiting(plan, dining);
        applyTables(plan, dining);

        final JSONArray mutations = new JSONArray().put(new JSONObject()
            .put("aggregateType", FormalDiningReadProducer.AGGREGATE_TYPE)
            .put("aggregateId", STORE_ID)
            .put("expectedRevision", source.revision())
            .put("state", dining));
        final List<StoreKernelContract.AggregateReadDependency> readDependencies =
            coordinatorDependencies(source, plan);

        if (plan.orderDining != null) {
            final FormalCanonicalOrderReadProducer.CanonicalOrder sourceOrder = order(source);
            final StoreKernelAggregateEntity orderAggregate = aggregate(
                FormalCanonicalOrderReadProducer.AGGREGATE_TYPE,
                sourceOrder.orderId()
            );
            assertEquals(sourceOrder.revision(), orderAggregate.revision);
            final JSONObject orderState = new JSONObject(orderAggregate.stateJson);
            orderState.put("revision", sourceOrder.revision() + 1);
            final Map<String, Object> link = new LinkedHashMap<>(plan.orderDining);
            link.remove("orderId");
            orderState.put("dining", new JSONObject(link));
            mutations.put(new JSONObject()
                .put("aggregateType", FormalCanonicalOrderReadProducer.AGGREGATE_TYPE)
                .put("aggregateId", sourceOrder.orderId())
                .put("expectedRevision", sourceOrder.revision())
                .put("state", orderState));
        }

        return StoreKernelContract.parseCommit(new JSONObject()
            .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
            .put("type", StoreKernelContract.COMMIT)
            .put("requestId", "REQ-" + commandId)
            .put("commandId", commandId)
            .put("storeId", STORE_ID)
            .put("operationId", "TEST_DINING_PLANNER_ROOM")
            .put("idempotencyKey", "IDEMP-" + commandId)
            .put("requestFingerprint", StoreKernelContract.sha256(fingerprintSeed))
            .put("result", new JSONObject()
                .put("state", "COMMITTED")
                .put("commandId", commandId))
            .put("traceId", "test-dining:" + commandId)
            .put("committedAt", "2026-10-03T01:15:00Z")
            .put("mutations", mutations)
            .put("outbox", new JSONArray()))
            .withReadDependencies(readDependencies);
    }

    private static List<StoreKernelContract.AggregateReadDependency> coordinatorDependencies(
        FormalDiningReadProducer.Snapshot source,
        DiningTransitionPlanner.Plan plan
    ) {
        final Map<String, StoreKernelContract.AggregateReadDependency> actual =
            new LinkedHashMap<>();
        for (Map<String, Object> logical : plan.readSet) {
            final String kind = (String) logical.get("kind");
            final String id = (String) logical.get("id");
            if ("DINING".equals(kind)) {
                assertEquals(STORE_ID, id);
                assertEquals(source.revision(), logical.get("revision"));
                actual.put("DINING", new StoreKernelContract.AggregateReadDependency(
                    FormalDiningReadProducer.AGGREGATE_TYPE,
                    STORE_ID,
                    source.revision()
                ));
            } else if ("TABLE".equals(kind)) {
                assertEquals(revision(table(source, id).revision()), logical.get("revision"));
                // Tables are values inside the one Dining aggregate, so its CAS guards them.
                actual.put("DINING", new StoreKernelContract.AggregateReadDependency(
                    FormalDiningReadProducer.AGGREGATE_TYPE,
                    STORE_ID,
                    source.revision()
                ));
            } else if ("ORDER".equals(kind)) {
                final FormalCanonicalOrderReadProducer.CanonicalOrder order = order(source);
                assertEquals(order.orderId(), id);
                assertEquals(order.revision(), logical.get("revision"));
                actual.put("ORDER", new StoreKernelContract.AggregateReadDependency(
                    FormalCanonicalOrderReadProducer.AGGREGATE_TYPE,
                    order.orderId(),
                    order.revision()
                ));
            } else {
                throw new AssertionError("Unexpected logical Dining dependency: " + kind);
            }
        }
        return new ArrayList<>(actual.values());
    }

    private StoreKernelContract.CommitRequest cancellationMembershipInvalidation(
        FormalDiningReadProducer.Snapshot source
    ) throws Exception {
        final JSONObject dining = new JSONObject(aggregate(
            FormalDiningReadProducer.AGGREGATE_TYPE,
            STORE_ID
        ).stateJson).put("revision", source.revision() + 1);
        final FormalCanonicalOrderReadProducer.CanonicalOrder sourceOrder = order(source);
        final JSONObject orderState = rawOrder()
            .put("revision", sourceOrder.revision() + 1)
            .put("lifecycleState", "CANCELLED")
            .put("fulfillmentState", "CANCELLED");
        final JSONArray mutations = new JSONArray()
            .put(new JSONObject()
                .put("aggregateType", FormalDiningReadProducer.AGGREGATE_TYPE)
                .put("aggregateId", STORE_ID)
                .put("expectedRevision", source.revision())
                .put("state", dining))
            .put(new JSONObject()
                .put("aggregateType", FormalCanonicalOrderReadProducer.AGGREGATE_TYPE)
                .put("aggregateId", ORDER_ID)
                .put("expectedRevision", sourceOrder.revision())
                .put("state", orderState));
        return StoreKernelContract.parseCommit(new JSONObject()
            .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
            .put("type", StoreKernelContract.COMMIT)
            .put("requestId", "REQ-CANCEL-MEMBERSHIP")
            .put("commandId", "CANCEL-MEMBERSHIP")
            .put("storeId", STORE_ID)
            .put("operationId", "TEST_DINING_MEMBERSHIP_GUARD")
            .put("idempotencyKey", "IDEMP-CANCEL-MEMBERSHIP")
            .put("requestFingerprint", StoreKernelContract.sha256("cancel-membership"))
            .put("result", new JSONObject().put("state", "COMMITTED"))
            .put("traceId", "test-dining:cancel-membership")
            .put("committedAt", "2026-10-03T01:09:00Z")
            .put("mutations", mutations)
            .put("outbox", new JSONArray()))
            .withReadDependencies(List.of(
                new StoreKernelContract.AggregateReadDependency(
                    FormalDiningReadProducer.AGGREGATE_TYPE,
                    STORE_ID,
                    source.revision()
                ),
                new StoreKernelContract.AggregateReadDependency(
                    FormalCanonicalOrderReadProducer.AGGREGATE_TYPE,
                    ORDER_ID,
                    sourceOrder.revision()
                )
            ));
    }

    private static void applyWaiting(DiningTransitionPlanner.Plan plan, JSONObject dining)
        throws Exception {
        final JSONArray current = dining.getJSONArray("waiting");
        final JSONArray next = new JSONArray();
        for (int index = 0; index < current.length(); index++) {
            final JSONObject row = current.getJSONObject(index);
            if (!row.getString("waitingId").equals(plan.waitingRemoveId)) next.put(row);
        }
        if (plan.waitingCreate != null) next.put(new JSONObject(plan.waitingCreate));
        dining.put("waiting", next);
    }

    private static void applyTables(DiningTransitionPlanner.Plan plan, JSONObject dining)
        throws Exception {
        final JSONArray tables = dining.getJSONArray("tables");
        for (Map<String, Object> change : plan.tableChanges) {
            final String tableId = (String) change.get("tableId");
            for (int index = 0; index < tables.length(); index++) {
                final JSONObject current = tables.getJSONObject(index);
                if (!tableId.equals(current.getString("tableId"))) continue;
                final Object rawRevision = current.get("revision");
                if (!(rawRevision instanceof Number)) {
                    throw new AssertionError("Test adapter requires numeric table revisions");
                }
                final JSONObject replacement = new JSONObject(change)
                    .put("revision", ((Number) rawRevision).longValue() + 1);
                tables.put(index, replacement);
                break;
            }
        }
    }

    private static Map<String, Object> plannerRead(FormalDiningReadProducer.Snapshot snapshot) {
        final List<Map<String, Object>> waiting = new ArrayList<>();
        for (FormalDiningReadProducer.Waiting value : snapshot.waiting()) {
            final Map<String, Object> row = map(
                "waitingId", value.waitingId(),
                "displayNumber", value.displayNumber(),
                "partySize", value.partySize(),
                "createdAt", value.createdAt()
            );
            if (value.customerDisplayName() != null) {
                row.put("customerDisplayName", value.customerDisplayName());
            }
            if (value.orderId() != null) row.put("orderId", value.orderId());
            waiting.add(row);
        }

        final List<Map<String, Object>> tables = new ArrayList<>();
        for (FormalDiningReadProducer.Table value : snapshot.tables()) {
            final Map<String, Object> row = map(
                "tableId", value.tableId(),
                "label", value.label(),
                "location", value.location(),
                "revision", revision(value.revision()),
                "state", value.state()
            );
            if (value.orderId() != null) row.put("orderId", value.orderId());
            if (value.displayNumber() != null) row.put("displayNumber", value.displayNumber());
            if (value.partySize() != null) row.put("partySize", value.partySize());
            if (value.seatedAt() != null) row.put("seatedAt", value.seatedAt());
            tables.add(row);
        }

        final List<Map<String, Object>> orders = new ArrayList<>();
        for (FormalCanonicalOrderReadProducer.CanonicalOrder value : snapshot.orders()) {
            final Map<String, Object> row = map(
                "orderId", value.orderId(),
                "displayNumber", value.displayNumber(),
                "revision", value.revision(),
                "lifecycleState", value.lifecycleState(),
                "fulfillmentState", value.fulfillmentState(),
                "serviceMode", value.serviceMode()
            );
            if (value.dining() != null) {
                final Map<String, Object> link = map("partySize", value.dining().partySize());
                if (value.dining().waitingId() != null) {
                    link.put("waitingId", value.dining().waitingId());
                }
                if (value.dining().tableId() != null) link.put("tableId", value.dining().tableId());
                if (value.dining().seatedAt() != null) link.put("seatedAt", value.dining().seatedAt());
                row.put("dining", link);
            }
            orders.add(row);
        }
        return map(
            "storeId", snapshot.storeId(),
            "revision", snapshot.revision(),
            "waiting", waiting,
            "tables", tables,
            "orders", orders
        );
    }

    private StoreKernelAggregateEntity aggregate(String type, String id) {
        final StoreKernelAggregateEntity value = database.storeKernelDao()
            .readAggregate(STORE_ID, type, id);
        assertNotNull(value);
        return value;
    }

    private JSONObject rawOrder() throws Exception {
        return new JSONObject(aggregate(FormalCanonicalOrderReadProducer.AGGREGATE_TYPE, ORDER_ID).stateJson);
    }

    private void seed(String type, String id, long revision, String stateJson) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            STORE_ID,
            type,
            id,
            revision,
            stateJson,
            StoreKernelContract.sha256(stateJson),
            "2026-10-03T01:00:00Z"
        ));
    }

    private static FormalCanonicalOrderReadProducer.CanonicalOrder order(
        FormalDiningReadProducer.Snapshot snapshot
    ) {
        assertEquals(1, snapshot.orders().size());
        return snapshot.orders().get(0);
    }

    private static FormalDiningReadProducer.Table table(
        FormalDiningReadProducer.Snapshot snapshot,
        String tableId
    ) {
        return snapshot.tables().stream()
            .filter(value -> tableId.equals(value.tableId()))
            .findFirst()
            .orElseThrow();
    }

    private static Object revision(FormalDiningReadProducer.Revision revision) {
        return revision.text() == null ? revision.number() : revision.text();
    }

    private static Map<String, Object> map(Object... pairs) {
        final Map<String, Object> value = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            value.put((String) pairs[index], pairs[index + 1]);
        }
        return value;
    }

    private static JSONObject diningWaiting() throws Exception {
        return new JSONObject()
            .put("schema", FormalDiningReadProducer.SCHEMA)
            .put("storeId", STORE_ID)
            .put("revision", 5)
            .put("waiting", new JSONArray().put(new JSONObject()
                .put("waitingId", "W1")
                .put("displayNumber", "Q001")
                .put("partySize", 2)
                .put("createdAt", "2026-10-03T00:55:00Z")
                .put("customerDisplayName", "May")
                .put("orderId", ORDER_ID)))
            .put("tables", availableTables());
    }

    private static JSONArray availableTables() throws Exception {
        final JSONArray tables = new JSONArray();
        for (int number = 1; number <= 8; number++) {
            tables.put(new JSONObject()
                .put("tableId", String.format("T%02d", number))
                .put("label", "Table " + number)
                .put("location", "INDOOR")
                .put("revision", 4)
                .put("state", "AVAILABLE"));
        }
        return tables.put(new JSONObject()
            .put("tableId", "OUTDOOR")
            .put("label", "Outdoor")
            .put("location", "OUTDOOR")
            .put("revision", "TABLE-4")
            .put("state", "AVAILABLE"));
    }

    private static JSONObject waitingOrder() throws Exception {
        return new JSONObject()
            .put("schema", FormalCanonicalOrderReadProducer.SCHEMA)
            .put("storeId", STORE_ID)
            .put("orderId", ORDER_ID)
            .put("displayNumber", "0001")
            .put("source", "WALK_IN")
            .put("createdAt", "2026-10-03T00:56:00Z")
            .put("revision", 3)
            .put("lifecycleState", "ACTIVE")
            .put("fulfillmentState", "IN_PROGRESS")
            .put("effectiveTenderId", "CASH")
            .put("recognizedAmountMinor", 1200)
            .put("outstandingAmountMinor", 1300)
            .put("refundableAmountMinor", 0)
            .put("serviceMode", "DINE_IN")
            .put("items", new JSONArray().put(new JSONObject()
                .put("lineId", "LINE-1")
                .put("productId", "DRINK-1")
                .put("name", "Drink")
                .put("quantity", 2)
                .put("unitMinor", 1250)
                .put("options", new JSONArray().put("LESS_ICE"))))
            .put("adjustments", new JSONArray().put(new JSONObject()
                .put("adjustmentId", "ADJ-1")
                .put("type", "PAYMENT_CORRECTION")
                .put("status", "COMMITTED")
                .put("amountMinor", 50)
                .put("tenderId", "CASH")
                .put("occurredAt", "2026-10-03T00:58:00Z")))
            .put("dining", new JSONObject()
                .put("waitingId", "W1")
                .put("partySize", 2));
    }

    private static JSONObject canonicalPayment() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.canonical-payment.v1")
            .put("paymentId", PAYMENT_ID)
            .put("orderId", ORDER_ID)
            .put("storeId", STORE_ID)
            .put("status", "CONFIRMED")
            .put("submissionId", "SUBMISSION-1")
            .put("quoteRef", "QUOTE-1")
            .put("formalRevision", 1)
            .put("currency", "HKD")
            .put("amountMinor", 1200)
            .put("confirmedAt", "2026-10-03T00:58:00Z")
            .put("tender", new JSONObject()
                .put("tenderId", "CASH")
                .put("kind", "CASH")
                .put("evidenceMode", "CASH_COUNTED")
                .put("recordingEvidenceRef", "TEST-EVIDENCE-1")
                .put("amountMinor", 1200));
    }
}
