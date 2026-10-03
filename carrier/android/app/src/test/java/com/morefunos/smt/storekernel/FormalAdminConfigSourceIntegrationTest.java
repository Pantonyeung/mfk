package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalAdminConfigProducer;
import com.morefunos.smt.storekernel.business.FormalAdminConfigSourceClient;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.net.URI;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalAdminConfigSourceIntegrationTest {
    private static final String TYPESCRIPT_FIXTURE = "{\"schema\":\"MFK_ADMIN_CONFIG_SYNC_V1\",\"storeId\":\"MF01\",\"revision\":7,"
        + "\"publishedAt\":\"2026-10-03T00:00:00.000Z\",\"adminFingerprint\":\"admin-7-tea\","
        + "\"snapshot\":{\"catalog\":{\"marker\":\"tea\"},\"storeSettings\":{\"timezone\":\"Asia/Hong_Kong\","
        + "\"currency\":\"HKD\"},\"businessDay\":{\"cutoff\":\"05:00\"},\"staffAuth\":{\"schema\":\"MFK_STAFF_AUTH_V1\"}},"
        + "\"fingerprint\":\"fnv1a32:d8ba67b9\"}";

    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;
    private FormalAdminConfigProducer producer;

    @Before
    public void setUp() {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
        producer = new FormalAdminConfigProducer(coordinator, "MF01");
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void canonicalHttpReadFlowsIntoRoomAndServerFailurePreservesLkg() throws Exception {
        final FormalAdminConfigSourceClient source = source(200, TYPESCRIPT_FIXTURE);

        final FormalAdminConfigSourceClient.FetchResult result = source.fetchActive().get(5, TimeUnit.SECONDS);
        final StoreKernelAggregateEntity stored = activeConfig();

        assertTrue(result.activePresent);
        assertEquals(7, result.sourceRevision);
        assertEquals("fnv1a32:d8ba67b9", result.sourceFingerprint);
        assertEquals(1, stored.revision);
        assertEquals(7, new JSONObject(stored.stateJson).getLong("revision"));
        assertEquals(1, database.storeKernelDao().receiptCount());
        final String acceptedState = stored.stateJson;

        final CompletionException failure = assertThrows(CompletionException.class, () -> source(503, "").fetchActive().join());
        assertEquals("ADMIN_CONFIG_SOURCE_HTTP_503", failure.getCause().getMessage());
        assertEquals(1, activeConfig().revision);
        assertEquals(acceptedState, activeConfig().stateJson);
        assertEquals(
            "tea",
            new JSONObject(activeConfig().stateJson).getJSONObject("snapshot").getJSONObject("catalog").getString("marker")
        );
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void missingActiveDoesNotCreateEmptyAuthority() throws Exception {
        final FormalAdminConfigSourceClient.FetchResult result = source(404, "").fetchActive().get(5, TimeUnit.SECONDS);

        assertEquals(false, result.activePresent);
        assertEquals(0, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
    }

    private FormalAdminConfigSourceClient source(int status, String body) {
        return new FormalAdminConfigSourceClient(
            URI.create("https://admin.morefunos.com"),
            "MF01",
            ignored -> CompletableFuture.completedFuture(new FormalAdminConfigSourceClient.HttpResponse(status, body)),
            producer,
            () -> Instant.parse("2026-10-03T01:02:03Z")
        );
    }

    private StoreKernelAggregateEntity activeConfig() {
        return database.storeKernelDao().readAggregate(
            "MF01",
            FormalAdminConfigProducer.AGGREGATE_TYPE,
            "MF01"
        );
    }
}
