package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

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

import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalDiningReadProducerRoomTest {
    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;

    @Before
    public void setUp() throws Exception {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
        seed("MFP_DINING_OPERATIONAL_STATE", "MF01", 5, diningWaiting().toString());
        seed("ORDER", "ORDER-1", 3, waitingOrder().toString());
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void readsDiningAndNamedCanonicalOrdersFromOneRoomSnapshot() throws Exception {
        final FormalDiningReadProducer.Snapshot snapshot = new FormalDiningReadProducer(
            coordinator,
            "MF01"
        ).readSnapshot(List.of("ORDER-1")).get(5, TimeUnit.SECONDS);

        assertEquals(5L, snapshot.revision());
        assertEquals("W1", snapshot.waiting().get(0).waitingId());
        assertEquals("ORDER-1", snapshot.waiting().get(0).orderId());
        assertEquals(9, snapshot.tables().size());
        assertEquals("OUTDOOR", snapshot.tables().get(8).location());
        assertEquals("ORDER-1", snapshot.orders().get(0).orderId());
        assertEquals("W1", snapshot.orders().get(0).dining().waitingId());
        assertThrows(UnsupportedOperationException.class, snapshot.waiting()::clear);
        assertThrows(UnsupportedOperationException.class, snapshot.tables()::clear);
        assertThrows(UnsupportedOperationException.class, snapshot.orders()::clear);
    }

    @Test
    public void interruptedAssignmentRollsBackDiningAndOrderBeforeCanonicalReadback() throws Exception {
        final StoreKernelContract.CommitRequest assignment = assignmentRequest(
            diningAssigned("T01", 6),
            assignedOrder("T01", 4)
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
        assertEquals("STORE_KERNEL_TEST_FAILURE_AFTER_AGGREGATE_MUTATION", failure.getCause().getMessage());

        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(database);
        final FormalDiningReadProducer producer = new FormalDiningReadProducer(coordinator, "MF01");
        final FormalDiningReadProducer.Snapshot rolledBack = producer
            .readSnapshot(List.of("ORDER-1"))
            .get(5, TimeUnit.SECONDS);
        assertEquals(5L, rolledBack.revision());
        assertEquals("W1", rolledBack.waiting().get(0).waitingId());
        assertEquals("W1", rolledBack.orders().get(0).dining().waitingId());
        assertEquals("AVAILABLE", rolledBack.tables().get(0).state());

        coordinator.commit(assignment).get(5, TimeUnit.SECONDS);
        final FormalDiningReadProducer.Snapshot committed = producer
            .readSnapshot(List.of("ORDER-1"))
            .get(5, TimeUnit.SECONDS);
        assertEquals(6L, committed.revision());
        assertTrue(committed.waiting().isEmpty());
        assertEquals("OCCUPIED", committed.tables().get(0).state());
        assertEquals("ORDER-1", committed.tables().get(0).orderId());
        assertEquals("T01", committed.orders().get(0).dining().tableId());
        assertEquals("2026-10-03T01:05:00Z", committed.orders().get(0).dining().seatedAt());
    }

    private void seed(String type, String id, long revision, String stateJson) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01",
            type,
            id,
            revision,
            stateJson,
            StoreKernelContract.sha256(stateJson),
            "2026-10-03T01:00:00Z"
        ));
    }

    private static JSONObject diningWaiting() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.dining.operational-state.v1")
            .put("storeId", "MF01")
            .put("revision", 5)
            .put("waiting", new JSONArray().put(new JSONObject()
                .put("waitingId", "W1")
                .put("displayNumber", "Q001")
                .put("partySize", 2)
                .put("createdAt", "2026-10-03T00:55:00Z")
                .put("customerDisplayName", "May")
                .put("orderId", "ORDER-1")))
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
            .put("schema", "mfp.canonical-order.v1")
            .put("storeId", "MF01")
            .put("orderId", "ORDER-1")
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
                .put("unitMinor", 1250)))
            .put("adjustments", new JSONArray())
            .put("dining", new JSONObject()
                .put("waitingId", "W1")
                .put("partySize", 2));
    }

    private static JSONObject diningAssigned(String tableId, long revision) throws Exception {
        final JSONObject state = diningWaiting();
        state.put("revision", revision);
        state.put("waiting", new JSONArray());
        final JSONObject table = state.getJSONArray("tables").getJSONObject(0);
        table.put("state", "OCCUPIED")
            .put("orderId", "ORDER-1")
            .put("displayNumber", "0001")
            .put("partySize", 2)
            .put("seatedAt", "2026-10-03T01:05:00Z")
            .put("tableId", tableId)
            .put("revision", 5);
        return state;
    }

    private static JSONObject assignedOrder(String tableId, long revision) throws Exception {
        return waitingOrder()
            .put("revision", revision)
            .put("dining", new JSONObject()
                .put("waitingId", "W1")
                .put("tableId", tableId)
                .put("partySize", 2)
                .put("seatedAt", "2026-10-03T01:05:00Z"));
    }

    private static StoreKernelContract.CommitRequest assignmentRequest(
        JSONObject dining,
        JSONObject order
    ) throws Exception {
        final JSONArray mutations = new JSONArray()
            .put(new JSONObject()
                .put("aggregateType", "MFP_DINING_OPERATIONAL_STATE")
                .put("aggregateId", "MF01")
                .put("expectedRevision", 5)
                .put("state", dining))
            .put(new JSONObject()
                .put("aggregateType", "ORDER")
                .put("aggregateId", "ORDER-1")
                .put("expectedRevision", 3)
                .put("state", order));
        return StoreKernelContract.parseCommit(new JSONObject()
            .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
            .put("type", StoreKernelContract.COMMIT)
            .put("requestId", "REQ-DINING-ASSIGN")
            .put("commandId", "CMD-DINING-ASSIGN")
            .put("storeId", "MF01")
            .put("operationId", "MFP-FORMAL-BUSINESS")
            .put("idempotencyKey", "IDEMP-DINING-ASSIGN")
            .put("requestFingerprint", StoreKernelContract.sha256("dining-assign-v1"))
            .put("result", new JSONObject().put("state", "COMMITTED"))
            .put("traceId", "formal-dining:assign")
            .put("committedAt", "2026-10-03T01:05:00Z")
            .put("mutations", mutations)
            .put("outbox", new JSONArray()));
    }
}
