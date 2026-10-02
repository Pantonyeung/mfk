package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalAdminConfigProducer;

import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalAdminConfigProducerTest {
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
    public void validCanonicalEnvelopeAppliesThroughStoreKernel() throws Exception {
        final JSONObject envelope = envelope(7, "tea");

        final FormalAdminConfigProducer.ApplyResult result = producer
            .apply(envelope.toString(), "2026-10-03T00:00:00.000Z")
            .get(5, TimeUnit.SECONDS);
        final StoreKernelAggregateEntity stored = activeConfig();

        assertFalse(result.replayed);
        assertEquals(7, result.sourceRevision);
        assertEquals(envelope.getString("fingerprint"), result.sourceFingerprint);
        assertEquals(1, result.aggregateRevision);
        assertEquals(1, stored.revision);
        assertEquals(envelope.toString(), stored.stateJson);
        assertEquals(1, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().outboxCount());
        assertEquals(3, database.storeKernelDao().journalCount());
    }

    @Test
    public void identicalEnvelopeReplaysWithoutSecondEffect() throws Exception {
        final JSONObject envelope = envelope(7, "tea");

        final FormalAdminConfigProducer.ApplyResult first = producer
            .apply(envelope.toString(), "2026-10-03T00:00:00.000Z")
            .get(5, TimeUnit.SECONDS);
        final FormalAdminConfigProducer.ApplyResult replay = producer
            .apply(envelope.toString(), "2026-10-03T00:01:00.000Z")
            .get(5, TimeUnit.SECONDS);

        assertFalse(first.replayed);
        assertTrue(replay.replayed);
        assertEquals(first.aggregateRevision, replay.aggregateRevision);
        assertEquals(1, database.storeKernelDao().aggregateCount());
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(3, database.storeKernelDao().journalCount());
    }

    @Test
    public void newerSourceAdvancesInternalRevisionAndRollbackFailsClosed() throws Exception {
        producer.apply(envelope(7, "tea").toString(), "2026-10-03T00:00:00.000Z").get(5, TimeUnit.SECONDS);
        final FormalAdminConfigProducer.ApplyResult next = producer
            .apply(envelope(9, "coffee").toString(), "2026-10-03T00:02:00.000Z")
            .get(5, TimeUnit.SECONDS);

        final ExecutionException rollback = assertThrows(
            ExecutionException.class,
            () -> producer.apply(envelope(8, "stale").toString(), "2026-10-03T00:03:00.000Z").get(5, TimeUnit.SECONDS)
        );

        assertEquals("ADMIN_CONFIG_SOURCE_REVISION_ROLLBACK", rollback.getCause().getMessage());
        assertEquals(2, next.aggregateRevision);
        assertEquals(2, activeConfig().revision);
        assertEquals(9, new JSONObject(activeConfig().stateJson).getLong("revision"));
        assertEquals(2, database.storeKernelDao().receiptCount());
    }

    @Test
    public void sameSourceRevisionWithDifferentFingerprintConflicts() throws Exception {
        producer.apply(envelope(7, "tea").toString(), "2026-10-03T00:00:00.000Z").get(5, TimeUnit.SECONDS);

        final ExecutionException conflict = assertThrows(
            ExecutionException.class,
            () -> producer.apply(envelope(7, "coffee").toString(), "2026-10-03T00:01:00.000Z").get(5, TimeUnit.SECONDS)
        );

        assertEquals("ADMIN_CONFIG_SOURCE_REVISION_CONFLICT", conflict.getCause().getMessage());
        assertEquals(1, activeConfig().revision);
        assertEquals("tea", new JSONObject(activeConfig().stateJson).getJSONObject("snapshot").getJSONObject("catalog").getString("marker"));
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void invalidFingerprintAndStoreMismatchPreserveLastKnownGood() throws Exception {
        final JSONObject accepted = envelope(7, "tea");
        producer.apply(accepted.toString(), "2026-10-03T00:00:00.000Z").get(5, TimeUnit.SECONDS);
        final JSONObject wrongFingerprint = envelope(8, "coffee").put("fingerprint", "fnv1a32:00000000");
        final JSONObject wrongStore = envelope(8, "coffee").put("storeId", "MF02");

        final IllegalArgumentException fingerprintError = assertThrows(
            IllegalArgumentException.class,
            () -> producer.apply(wrongFingerprint.toString(), "2026-10-03T00:01:00.000Z")
        );
        final IllegalArgumentException storeError = assertThrows(
            IllegalArgumentException.class,
            () -> producer.apply(wrongStore.toString(), "2026-10-03T00:01:00.000Z")
        );

        assertEquals("ADMIN_CONFIG_FINGERPRINT_MISMATCH", fingerprintError.getMessage());
        assertEquals("ADMIN_CONFIG_STORE_ID_MISMATCH", storeError.getMessage());
        assertEquals(accepted.toString(), activeConfig().stateJson);
        assertEquals(1, database.storeKernelDao().receiptCount());
    }

    @Test
    public void typescriptContractFixtureFingerprintIsAccepted() throws Exception {
        final String fixture = "{\"schema\":\"MFK_ADMIN_CONFIG_SYNC_V1\",\"storeId\":\"MF01\",\"revision\":7,"
            + "\"publishedAt\":\"2026-10-03T00:00:00.000Z\",\"adminFingerprint\":\"admin-7-tea\","
            + "\"snapshot\":{\"catalog\":{\"marker\":\"tea\"},\"storeSettings\":{\"timezone\":\"Asia/Hong_Kong\","
            + "\"currency\":\"HKD\"},\"businessDay\":{\"cutoff\":\"05:00\"},\"staffAuth\":{\"schema\":\"MFK_STAFF_AUTH_V1\"}},"
            + "\"fingerprint\":\"fnv1a32:d8ba67b9\"}";

        final FormalAdminConfigProducer.ApplyResult result = producer
            .apply(fixture, "2026-10-03T00:00:00.000Z")
            .get(5, TimeUnit.SECONDS);

        assertEquals("fnv1a32:d8ba67b9", result.sourceFingerprint);
        assertEquals(7, result.sourceRevision);
    }

    @Test
    public void concurrentAscendingPublicationsRetryCasAndConvergeToNewest() throws Exception {
        producer.apply(envelope(7, "tea").toString(), "2026-10-03T00:00:00.000Z").get(5, TimeUnit.SECONDS);

        final CompletableFuture<FormalAdminConfigProducer.ApplyResult> revision8 = producer
            .apply(envelope(8, "coffee").toString(), "2026-10-03T00:01:00.000Z");
        final CompletableFuture<FormalAdminConfigProducer.ApplyResult> revision9 = producer
            .apply(envelope(9, "juice").toString(), "2026-10-03T00:02:00.000Z");
        revision8.get(5, TimeUnit.SECONDS);
        revision9.get(5, TimeUnit.SECONDS);

        assertEquals(3, activeConfig().revision);
        assertEquals(9, new JSONObject(activeConfig().stateJson).getLong("revision"));
        assertEquals("juice", new JSONObject(activeConfig().stateJson).getJSONObject("snapshot").getJSONObject("catalog").getString("marker"));
        assertEquals(3, database.storeKernelDao().receiptCount());
    }

    private StoreKernelAggregateEntity activeConfig() {
        return database.storeKernelDao().readAggregate(
            "MF01",
            FormalAdminConfigProducer.AGGREGATE_TYPE,
            "MF01"
        );
    }

    private static JSONObject envelope(long revision, String marker) throws Exception {
        final JSONObject snapshot = new JSONObject()
            .put("catalog", new JSONObject().put("marker", marker))
            .put("storeSettings", new JSONObject().put("timezone", "Asia/Hong_Kong").put("currency", "HKD"))
            .put("businessDay", new JSONObject().put("cutoff", "05:00"))
            .put("staffAuth", new JSONObject().put("schema", "MFK_STAFF_AUTH_V1"));
        final JSONObject base = new JSONObject()
            .put("schema", "MFK_ADMIN_CONFIG_SYNC_V1")
            .put("storeId", "MF01")
            .put("revision", revision)
            .put("publishedAt", "2026-10-03T00:00:00.000Z")
            .put("adminFingerprint", "admin-" + revision + "-" + marker)
            .put("snapshot", snapshot);
        return new JSONObject(base.toString()).put("fingerprint", "fnv1a32:" + fnv1a32(javascriptJson(base)));
    }

    private static String fnv1a32(String value) {
        long hash = 0x811c9dc5L;
        for (int index = 0; index < value.length(); index++) {
            hash ^= value.charAt(index);
            hash = (hash * 0x01000193L) & 0xffffffffL;
        }
        return String.format(Locale.ROOT, "%08x", hash);
    }

    private static String javascriptJson(Object value) throws Exception {
        if (value == null || value == JSONObject.NULL) return "null";
        if (value instanceof String) return javascriptString((String) value);
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Number) return JSONObject.numberToString((Number) value);
        if (value instanceof JSONArray) {
            final JSONArray array = (JSONArray) value;
            final List<String> items = new ArrayList<>();
            for (int index = 0; index < array.length(); index++) items.add(javascriptJson(array.opt(index)));
            return "[" + String.join(",", items) + "]";
        }
        final JSONObject object = (JSONObject) value;
        final List<String> fields = new ArrayList<>();
        final Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            final String key = keys.next();
            fields.add(javascriptString(key) + ":" + javascriptJson(object.opt(key)));
        }
        return "{" + String.join(",", fields) + "}";
    }

    private static String javascriptString(String value) {
        final StringBuilder output = new StringBuilder(value.length() + 2).append('"');
        for (int index = 0; index < value.length(); index++) {
            final char character = value.charAt(index);
            switch (character) {
                case '"': output.append("\\\""); break;
                case '\\': output.append("\\\\"); break;
                case '\b': output.append("\\b"); break;
                case '\f': output.append("\\f"); break;
                case '\n': output.append("\\n"); break;
                case '\r': output.append("\\r"); break;
                case '\t': output.append("\\t"); break;
                default:
                    if (character <= 0x1f) output.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    else output.append(character);
            }
        }
        return output.append('"').toString();
    }
}
