package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;

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

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class StoreKernelBrowserBoundaryTest {
    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;
    private StoreKernelBridgeController controller;

    @Before
    public void setUp() {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
        controller = new StoreKernelBridgeController(coordinator, ignored -> { });
    }

    @After
    public void tearDown() {
        controller.close();
        if (database.isOpen()) database.closeStoreKernel();
    }

    @Test
    public void browserCannotReadNamedAggregatesOrOperateInboxOutbox() throws Exception {
        final JSONObject snapshot = envelope(StoreKernelContract.AGGREGATE_SNAPSHOT)
            .put("storeId", "MF01")
            .put("keys", new JSONArray().put(new JSONObject()
                .put("aggregateType", "STAFF_SESSION")
                .put("aggregateId", "SESSION-01")));

        final JSONObject result = new JSONObject(controller.handle(snapshot.toString()));

        assertEquals("failed", result.getString("status"));
        assertEquals("STORE_KERNEL_BROWSER_OPERATION_FORBIDDEN", result.getString("errorCode"));
    }

    private static JSONObject envelope(String type) throws Exception {
        return new JSONObject()
            .put("protocolVersion", 1)
            .put("type", type)
            .put("requestId", "REQ-1");
    }
}
