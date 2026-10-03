package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalBusinessCommandBridgeController;

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
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalBusinessCheckoutBridgeIntegrationTest {
    private static final long NOW = Instant.parse("2026-12-01T03:00:00Z").toEpochMilli();

    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;
    private FormalBusinessCommandBridgeController controller;
    private LinkedBlockingQueue<String> notifications;

    @Before
    public void setUp() throws Exception {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(
            database,
            StoreKernelTransactionCoordinator.FailurePoint.NONE,
            () -> NOW
        );
        seed("ADMIN_ACTIVE_CONFIGURATION", "MF01", 3, adminState());
        seed("POS_TENDER_POLICY", "MF01", 5, tenderPolicy());
        seed("DEVICE_AUTHORIZATION", "PAD-01", 1, deviceState());
        seed("OWNER_AUTHORIZATION", "OWNER-AUTH-1", 1, ownerState());
        seed("STAFF_SESSION", "SESSION-01", 1, sessionState());
        notifications = new LinkedBlockingQueue<>();
        controller = FormalBusinessCommandBridgeController.createBound(
            coordinator,
            notifications::add,
            () -> NOW,
            60_000L
        );
    }

    @After
    public void tearDown() {
        if (controller != null) controller.close();
        if (coordinator != null) coordinator.close();
        if (database != null && database.isOpen()) database.closeStoreKernel();
    }

    @Test
    public void validatesNativeQuoteThenCommitsCheckoutThroughThePublicFormalBridge() throws Exception {
        final JSONObject intent = intent();
        final JSONObject quoteRequest = new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.checkout.validation.request.v1")
            .put("schema", "mfp.checkout.validation.request.v1")
            .put("requestId", "QUOTE-REQUEST-1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("intent", intent)
            .put("channelId", "WALK_IN")
            .put("tenderId", "CASH")
            .put("studentDiscountIntent", JSONObject.NULL);

        assertEquals("accepted", new JSONObject(controller.handle(quoteRequest.toString())).getString("status"));
        final JSONObject quoteResult = await("mfp.checkout.validation.result.v1");
        assertEquals("VALID", quoteResult.getString("state"));
        assertEquals("Cash", quoteResult.getJSONArray("tenders").getJSONObject(0).getString("label"));
        final JSONObject quote = quoteResult.getJSONObject("quote");
        assertEquals(5_000L, quote.getLong("formalTotalDueMinor"));
        assertEquals("CASH", quote.getJSONArray("acceptedTenderIds").getString(0));

        final JSONObject command = new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.command.v1")
            .put("schema", "mfp.store-kernel.command.v1")
            .put("requestId", "PAYMENT-REQUEST-1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUBMISSION-01")
            .put("idempotencyKey", "IDEMPOTENCY-01")
            .put("commandType", "CHECKOUT_PAYMENT_CONFIRM")
            .put("expectedRevision", quote.get("formalRevision"))
            .put("payload", new JSONObject()
                .put("intent", intent)
                .put("review", new JSONObject()
                    .put("channelId", "WALK_IN")
                    .put("tenderId", "CASH")
                    .put("quoteRef", quote.getString("quoteRef"))
                    .put("formalRevision", quote.get("formalRevision"))
                    .put("formalTotalDueMinor", quote.getLong("formalTotalDueMinor"))
                    .put("formalDiscountMinor", quote.getLong("formalDiscountMinor"))
                    .put("cashReceivedMinor", 5_000L)
                    .put("changeMinor", 0L)
                    .put("studentDiscountIntent", JSONObject.NULL)
                    .put("sourceIdentity", new JSONObject())))
            .put("createdAt", Instant.ofEpochMilli(NOW).toString());

        assertEquals("accepted", new JSONObject(controller.handle(command.toString())).getString("status"));
        final JSONObject committed = await("mfp.store-kernel.submission.result.v1");
        assertEquals("COMMITTED", committed.getString("state"));
        final String orderRef = committed.getString("orderRef");
        assertNotNull(database.storeKernelDao().readAggregate("MF01", "ORDER", orderRef));
        final StoreKernelOutboxEntity paymentEvent = database.storeKernelDao().readAllOutbox().stream()
            .filter(row -> "MFP_PAYMENT_CONFIRMED_V1".equals(row.eventType))
            .findFirst()
            .orElseThrow();
        assertNotNull(database.storeKernelDao().readAggregate(
            "MF01", "PAYMENT", paymentEvent.aggregateId
        ));
        assertEquals(3, database.storeKernelDao().receiptCount());
        assertEquals(2, database.storeKernelDao().outboxCount());
    }

    @Test
    public void rejectsQuoteBeforePricingWhenCanonicalAdmissionIsRevoked() throws Exception {
        final JSONObject revoked = new JSONObject(sessionState())
            .put("state", "REVOKED")
            .put("revision", 2);
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "STAFF_SESSION", "SESSION-01", 1, 2,
            revoked.toString(), "revoked", Instant.ofEpochMilli(NOW).toString()
        ));
        final JSONObject request = quoteRequest("QUOTE-REQUEST-DENIED");

        assertEquals("accepted", new JSONObject(controller.handle(request.toString())).getString("status"));
        final JSONObject result = await("mfp.checkout.validation.result.v1");

        assertEquals("REJECTED", result.getString("state"));
        assertEquals("SESSION_REVOKED", result.getString("rejectionCode"));
        assertEquals(5, database.storeKernelDao().aggregateCount());
    }

    @Test
    public void quoteContractRejectsRawAggregateInjectionWithoutWriting() throws Exception {
        final JSONObject request = quoteRequest("QUOTE-REQUEST-FORGED")
            .put("mutations", new JSONArray());

        final JSONObject result = new JSONObject(controller.handle(request.toString()));

        assertEquals("failed", result.getString("status"));
        assertEquals("FORMAL_AGGREGATE_INJECTION_REJECTED", result.getString("errorCode"));
        assertEquals(5, database.storeKernelDao().aggregateCount());
    }

    private JSONObject quoteRequest(String requestId) throws Exception {
        return new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.checkout.validation.request.v1")
            .put("schema", "mfp.checkout.validation.request.v1")
            .put("requestId", requestId)
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("intent", intent())
            .put("channelId", "WALK_IN")
            .put("tenderId", "CASH")
            .put("studentDiscountIntent", JSONObject.NULL);
    }

    private JSONObject await(String type) throws Exception {
        final String raw = notifications.poll(5, TimeUnit.SECONDS);
        assertNotNull("missing native notification", raw);
        final JSONObject value = new JSONObject(raw);
        assertEquals(type, value.getString("type"));
        return value;
    }

    private void seed(String type, String id, long revision, String state) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01", type, id, revision, state, "hash-" + type, Instant.ofEpochMilli(NOW).toString()
        ));
    }

    private static String adminState() throws Exception {
        return new JSONObject()
            .put("schema", "MFK_ADMIN_CONFIG_SYNC_V1")
            .put("storeId", "MF01")
            .put("revision", 11)
            .put("publishedAt", "2026-12-01T00:00:00Z")
            .put("adminFingerprint", "ADMIN-11")
            .put("fingerprint", "fnv1a32:12345678")
            .put("snapshot", new JSONObject()
                .put("catalog", new JSONObject()
                    .put("categories", new JSONArray().put(new JSONObject()
                        .put("id", "DRINK")
                        .put("name", "Drinks")
                        .put("active", true)))
                    .put("products", new JSONArray().put(new JSONObject()
                        .put("id", "DRINK-01")
                        .put("categoryId", "DRINK")
                        .put("name", "Drink")
                        .put("active", true)
                        .put("basePrice", "50.00"))))
                .put("storeSettings", new JSONObject()
                    .put("currency", "HKD")
                    .put("timezone", "Asia/Hong_Kong"))
                .put("businessDay", new JSONObject().put("cutoff", "04:00")))
            .toString();
    }

    private static String tenderPolicy() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.pos-tender-policy.v1")
            .put("storeId", "MF01")
            .put("revision", 5)
            .put("tenders", new JSONArray().put(new JSONObject()
                .put("id", "CASH")
                .put("label", "Cash")
                .put("enabled", true)
                .put("kind", "CASH")))
            .toString();
    }

    private static String deviceState() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.device-authorization.v1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("revision", 1)
            .put("status", "AUTHORIZED")
            .toString();
    }

    private static String ownerState() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.owner-authorization.v1")
            .put("storeId", "MF01")
            .put("ownerAuthorizationRef", "OWNER-AUTH-1")
            .put("deviceId", "PAD-01")
            .put("revision", 1)
            .put("status", "AUTHORIZED")
            .toString();
    }

    private static String sessionState() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.staff-session.v1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("staffId", "STAFF-01")
            .put("displayName", "Frontline")
            .put("role", "STAFF")
            .put("scope", "STORE")
            .put("permissions", new JSONArray())
            .put("state", "AUTHENTICATED")
            .put("staffStatus", "ACTIVE")
            .put("issuedAtEpochMs", NOW - 60_000L)
            .put("expiresAtEpochMs", NOW + 60_000L)
            .put("revision", 1)
            .put("ownerAuthorizationRef", "OWNER-AUTH-1")
            .put("ownerAuthorizationRevision", 1)
            .put("ownerAuthorizationDeviceId", "PAD-01")
            .toString();
    }

    private static JSONObject intent() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.ordering.intent.draft.v1")
            .put("draftOnly", true)
            .put("pricing", "LOCAL_PREVIEW_FROM_PUBLISHED_FACTS")
            .put("serviceMode", "takeaway")
            .put("checkoutReady", true)
            .put("previewSubtotalMinor", 1)
            .put("lines", new JSONArray().put(new JSONObject()
                .put("cartLineId", "LINE-1")
                .put("kind", "PRODUCT")
                .put("productId", "DRINK-01")
                .put("comboId", JSONObject.NULL)
                .put("displayName", "Forged Browser Name")
                .put("note", "")
                .put("quantity", 1)
                .put("serviceMode", "takeaway")
                .put("optionSelections", new JSONArray())
                .put("comboSelections", new JSONArray())
                .put("materialPriceFacts", new JSONArray().put(new JSONObject()
                    .put("factId", "FORGED")
                    .put("amountMinor", 1)
                    .put("currency", "HKD")
                    .put("revision", 1)
                    .put("role", "PRODUCT_BASE")
                    .put("sourceId", "DRINK-01")))
                .put("previewUnitMinor", 1)
                .put("state", "READY")
                .put("issues", new JSONArray())
                .put("sourceProjection", new JSONObject()
                    .put("storeId", "MF01")
                    .put("port", "SMT")
                    .put("schemaVersion", 1)
                    .put("appliedSeq", 1)
                    .put("projectionHash", "FORGED")
                    .put("appliedAt", "2026-12-01T00:00:00Z"))));
    }
}
