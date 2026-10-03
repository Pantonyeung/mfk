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
        assertEquals(1, result.tenderPolicyAggregateRevision);
        assertEquals(1, stored.revision);
        assertEquals(envelope.toString(), stored.stateJson);
        final StoreKernelAggregateEntity tenderPolicy = tenderPolicy();
        final JSONObject tenderState = new JSONObject(tenderPolicy.stateJson);
        assertEquals(1, tenderPolicy.revision);
        assertEquals("mfp.pos-tender-policy.v1", tenderState.getString("schema"));
        assertEquals(envelope.getString("fingerprint"), tenderState.getString("adminSourceFingerprint"));
        assertEquals(5, tenderState.getJSONArray("tenders").length());
        assertEquals("CASH", tenderState.getJSONArray("tenders").getJSONObject(0).getString("id"));
        assertEquals("WECHAT_PAY", tenderState.getJSONArray("tenders").getJSONObject(2).getString("id"));
        assertEquals(2, database.storeKernelDao().aggregateCount());
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
        assertEquals(first.tenderPolicyAggregateRevision, replay.tenderPolicyAggregateRevision);
        assertEquals(2, database.storeKernelDao().aggregateCount());
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
        assertEquals(2, next.tenderPolicyAggregateRevision);
        assertEquals(2, activeConfig().revision);
        assertEquals(2, tenderPolicy().revision);
        assertEquals(9, new JSONObject(activeConfig().stateJson).getLong("revision"));
        assertEquals(2, database.storeKernelDao().receiptCount());
    }

    @Test
    public void missingOrMalformedTenderPolicyFailsBeforeAnyWrite() throws Exception {
        final JSONObject missing = envelope(7, "tea");
        missing.getJSONObject("snapshot").remove("posTenders");
        refingerprint(missing);
        final JSONObject duplicate = envelope(8, "coffee");
        duplicate.getJSONObject("snapshot").getJSONObject("posTenders").getJSONArray("tenders")
            .put(new JSONObject().put("id", "CASH").put("label", "Again").put("enabled", true).put("kind", "CASH"));
        refingerprint(duplicate);

        final IllegalArgumentException missingError = assertThrows(
            IllegalArgumentException.class,
            () -> producer.apply(missing.toString(), "2026-10-03T00:00:00.000Z")
        );
        final IllegalArgumentException duplicateError = assertThrows(
            IllegalArgumentException.class,
            () -> producer.apply(duplicate.toString(), "2026-10-03T00:00:00.000Z")
        );

        assertEquals("ADMIN_CONFIG_POS_TENDER_POLICY_REQUIRED", missingError.getMessage());
        assertEquals("ADMIN_CONFIG_POS_TENDER_ID_DUPLICATE", duplicateError.getMessage());
        assertEquals(0, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
    }

    @Test
    public void failureAfterFirstAggregateMutationRollsBackAdminAndTenderTogether() throws Exception {
        coordinator.close();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.AFTER_AGGREGATE_MUTATION
        );
        producer = new FormalAdminConfigProducer(coordinator, "MF01");

        final ExecutionException failure = assertThrows(
            ExecutionException.class,
            () -> producer.apply(envelope(7, "tea").toString(), "2026-10-03T00:00:00.000Z")
                .get(5, TimeUnit.SECONDS)
        );

        assertEquals("STORE_KERNEL_TEST_FAILURE_AFTER_AGGREGATE_MUTATION", failure.getCause().getMessage());
        assertEquals(0, database.storeKernelDao().aggregateCount());
        assertEquals(0, database.storeKernelDao().receiptCount());
    }

    @Test
    public void tenderPolicyChangeRequiresNewPolicyRevisionAndPreservesHistoricalPayment() throws Exception {
        producer.apply(envelope(7, "tea").toString(), "2026-10-03T00:00:00.000Z").get(5, TimeUnit.SECONDS);
        final String historicalPayment = new JSONObject()
            .put("schema", "mfp.canonical-payment.v1")
            .put("paymentId", "PAY-OLD")
            .put("tenderId", "PAYME")
            .toString();
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01", "PAYMENT", "PAY-OLD", 1, historicalPayment, "payment-hash", "2026-10-03T00:00:30.000Z"
        ));

        final ExecutionException sameRevisionConflict = assertThrows(
            ExecutionException.class,
            () -> producer.apply(
                envelope(8, "coffee", 1, false).toString(),
                "2026-10-03T00:01:00.000Z"
            ).get(5, TimeUnit.SECONDS)
        );
        assertEquals("ADMIN_CONFIG_POS_TENDER_SOURCE_REVISION_CONFLICT", sameRevisionConflict.getCause().getMessage());
        assertEquals(1, activeConfig().revision);
        assertEquals(1, tenderPolicy().revision);

        final FormalAdminConfigProducer.ApplyResult next = producer.apply(
            envelope(8, "coffee", 2, false).toString(),
            "2026-10-03T00:02:00.000Z"
        ).get(5, TimeUnit.SECONDS);
        final JSONObject nextTender = new JSONObject(tenderPolicy().stateJson);

        assertEquals(2, next.aggregateRevision);
        assertEquals(2, next.tenderPolicyAggregateRevision);
        assertEquals(2, nextTender.getLong("adminPolicyRevision"));
        assertFalse(nextTender.getJSONArray("tenders").toString().contains("PAYME"));
        assertEquals(historicalPayment, database.storeKernelDao().readAggregate("MF01", "PAYMENT", "PAY-OLD").stateJson);

        final ExecutionException rollback = assertThrows(
            ExecutionException.class,
            () -> producer.apply(
                envelope(9, "juice", 1, true).toString(),
                "2026-10-03T00:03:00.000Z"
            ).get(5, TimeUnit.SECONDS)
        );
        assertEquals("ADMIN_CONFIG_POS_TENDER_SOURCE_REVISION_ROLLBACK", rollback.getCause().getMessage());
        assertEquals(2, activeConfig().revision);
        assertEquals(2, tenderPolicy().revision);
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
            + "\"currency\":\"HKD\"},\"businessDay\":{\"cutoff\":\"05:00\"},\"staffAuth\":{\"schema\":\"MFK_STAFF_AUTH_V1\"},"
            + "\"posTenders\":{\"schema\":\"MFK_POS_TENDER_POLICY_V1\",\"revision\":1,\"tenders\":["
            + "{\"id\":\"CASH\",\"label\":\"Cash\",\"enabled\":true,\"kind\":\"CASH\"},"
            + "{\"id\":\"ALIPAY\",\"label\":\"Alipay\",\"enabled\":true,\"kind\":\"NON_CASH\"},"
            + "{\"id\":\"WECHAT_PAY\",\"label\":\"WeChat Pay\",\"enabled\":true,\"kind\":\"NON_CASH\"},"
            + "{\"id\":\"FPS\",\"label\":\"FPS\",\"enabled\":true,\"kind\":\"NON_CASH\"},"
            + "{\"id\":\"PAYME\",\"label\":\"PayMe\",\"enabled\":true,\"kind\":\"NON_CASH\"}]}},"
            + "\"fingerprint\":\"fnv1a32:b1ce1779\"}";

        final FormalAdminConfigProducer.ApplyResult result = producer
            .apply(fixture, "2026-10-03T00:00:00.000Z")
            .get(5, TimeUnit.SECONDS);

        assertEquals("fnv1a32:b1ce1779", result.sourceFingerprint);
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

    private StoreKernelAggregateEntity tenderPolicy() {
        return database.storeKernelDao().readAggregate(
            "MF01",
            "POS_TENDER_POLICY",
            "MF01"
        );
    }

    private static JSONObject envelope(long revision, String marker) throws Exception {
        return envelope(revision, marker, 1, true);
    }

    private static JSONObject envelope(
        long revision,
        String marker,
        long tenderPolicyRevision,
        boolean includePayMe
    ) throws Exception {
        final JSONObject snapshot = new JSONObject()
            .put("catalog", new JSONObject().put("marker", marker))
            .put("storeSettings", new JSONObject().put("timezone", "Asia/Hong_Kong").put("currency", "HKD"))
            .put("businessDay", new JSONObject().put("cutoff", "05:00"))
            .put("staffAuth", new JSONObject().put("schema", "MFK_STAFF_AUTH_V1"))
            .put("posTenders", posTenderPolicy(tenderPolicyRevision, includePayMe));
        final JSONObject base = new JSONObject()
            .put("schema", "MFK_ADMIN_CONFIG_SYNC_V1")
            .put("storeId", "MF01")
            .put("revision", revision)
            .put("publishedAt", "2026-10-03T00:00:00.000Z")
            .put("adminFingerprint", "admin-" + revision + "-" + marker)
            .put("snapshot", snapshot);
        return new JSONObject(base.toString()).put("fingerprint", "fnv1a32:" + fnv1a32(javascriptJson(base)));
    }

    private static JSONObject posTenderPolicy() throws Exception {
        return posTenderPolicy(1, true);
    }

    private static JSONObject posTenderPolicy(long revision, boolean includePayMe) throws Exception {
        final JSONArray tenders = new JSONArray()
            .put(tender("CASH", "Cash", true, "CASH"))
            .put(tender("ALIPAY", "Alipay", true, "NON_CASH"))
            .put(tender("WECHAT_PAY", "WeChat Pay", true, "NON_CASH"))
            .put(tender("FPS", "FPS", true, "NON_CASH"));
        if (includePayMe) tenders.put(tender("PAYME", "PayMe", true, "NON_CASH"));
        return new JSONObject()
            .put("schema", "MFK_POS_TENDER_POLICY_V1")
            .put("revision", revision)
            .put("tenders", tenders);
    }

    private static JSONObject tender(String id, String label, boolean enabled, String kind) throws Exception {
        return new JSONObject().put("id", id).put("label", label).put("enabled", enabled).put("kind", kind);
    }

    private static void refingerprint(JSONObject envelope) throws Exception {
        final JSONObject base = new JSONObject(envelope.toString());
        base.remove("fingerprint");
        envelope.put("fingerprint", "fnv1a32:" + fnv1a32(javascriptJson(base)));
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
