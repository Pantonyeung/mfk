package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalBusinessCommandContract;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler;
import com.morefunos.smt.storekernel.business.FormalCheckoutRoomPricingProducer;
import com.morefunos.smt.storekernel.business.FormalQuoteRoomProducer;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalCheckoutRoomPricingProducerTest {
    private static final long NOW = 1_796_083_200_000L;

    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;

    @Before
    public void setUp() throws Exception {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
        seed("ADMIN_ACTIVE_CONFIGURATION", "MF01", 3, adminState());
        seed("POS_TENDER_POLICY", "MF01", 5, tenderPolicy());
        seed("FORMAL_QUOTE", "QUOTE-1", 7, quoteState(intent(), NOW + 60_000L, 3));
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void readsAdminAndQuoteAsOneCanonicalPricingSnapshot() throws Exception {
        final FormalCheckoutPaymentConfirmHandler.PricingSnapshot snapshot =
            new FormalCheckoutRoomPricingProducer(coordinator, () -> NOW)
                .validate(command(intent()))
                .get(5, TimeUnit.SECONDS);

        assertEquals("INTENT-1", snapshot.validatedIntentRef());
        assertEquals("WALK_IN", snapshot.channelId());
        assertEquals("QUOTE-1", snapshot.quote().quoteRef());
        assertEquals("QUOTE-REV-1", snapshot.quote().revision().value());
        assertEquals(5_000L, snapshot.quote().totalDueMinor());
        assertEquals(0L, snapshot.discountDecision().confirmedStudentCount());
        assertEquals(2, snapshot.dependencies().size());
        assertEquals("ADMIN_ACTIVE_CONFIGURATION", snapshot.dependencies().get(0).aggregateType);
        assertEquals(3L, snapshot.dependencies().get(0).expectedRevision);
        assertEquals("FORMAL_QUOTE", snapshot.dependencies().get(1).aggregateType);
        assertEquals(7L, snapshot.dependencies().get(1).expectedRevision);
        assertEquals(NOW + 60_000L, snapshot.validUntilEpochMs());
    }

    @Test
    public void createsDurableProductQuoteThenReadsItForConfirmation() throws Exception {
        final JSONObject request = new JSONObject()
            .put("schema", "mfp.checkout.validation.request.v1")
            .put("intent", intent())
            .put("channelId", "WALK_IN")
            .put("tenderId", JSONObject.NULL)
            .put("studentDiscountIntent", JSONObject.NULL);
        final FormalQuoteRoomProducer.CreatedQuote created = new FormalQuoteRoomProducer(
            coordinator,
            () -> NOW,
            60_000L
        ).create("MF01", request).get(5, TimeUnit.SECONDS);

        assertEquals("VALID", created.state());
        assertEquals(5_000L, created.quote().totalDueMinor());
        assertEquals(1L, database.storeKernelDao().readAggregate(
            "MF01", "FORMAL_QUOTE", created.quote().quoteRef()
        ).revision);
        final FormalCheckoutPaymentConfirmHandler.PricingSnapshot confirmation =
            new FormalCheckoutRoomPricingProducer(coordinator, () -> NOW)
                .validate(command(intent(), created.quote().quoteRef(), created.quote().revision().value()))
                .get(5, TimeUnit.SECONDS);
        assertEquals(created.quote().quoteRef(), confirmation.quote().quoteRef());
        assertEquals(5_000L, confirmation.quote().totalDueMinor());
        final JSONObject stored = new JSONObject(database.storeKernelDao().readAggregate(
            "MF01", "FORMAL_QUOTE", created.quote().quoteRef()
        ).stateJson);
        assertEquals(5_000L, stored.getLong("formalTotalDueMinor"));
        assertEquals(5_000L, stored.getJSONArray("lines").getJSONObject(0).getLong("formalUnitMinor"));
        assertEquals(1, stored.getJSONArray("acceptedTenderIds").length());
        assertEquals("CASH", stored.getJSONArray("acceptedTenderIds").getString(0));
        assertTrue(stored.getString("validatedIntentJson").contains("ADMIN-PRODUCT-BASE:DRINK-01"));
    }

    @Test
    public void nativeQuoteIgnoresBrowserPreviewMoney() throws Exception {
        final JSONObject forged = new JSONObject(intent().toString())
            .put("previewSubtotalMinor", 1);
        forged.getJSONArray("lines").getJSONObject(0)
            .put("previewUnitMinor", 1)
            .getJSONArray("materialPriceFacts").getJSONObject(0)
            .put("amountMinor", 1);

        final FormalQuoteRoomProducer.CreatedQuote created = createQuote(forged, JSONObject.NULL);

        assertEquals(5_000L, created.quote().subtotalMinor());
        assertEquals(5_000L, created.quote().lines().get(0).formalUnitMinor());
    }

    @Test
    public void nativeQuoteRejectsDisabledTenderAndUnsupportedOptions() throws Exception {
        assertCreateRejected("FORMAL_QUOTE_TENDER_NOT_ENABLED", intent(), "FPS");

        final JSONObject selectedOption = new JSONObject(intent().toString());
        selectedOption.getJSONArray("lines").getJSONObject(0)
            .getJSONArray("optionSelections").put(new JSONObject()
                .put("optionSetId", "MILK")
                .put("optionIds", new JSONArray().put("OAT")));
        assertCreateRejected("FORMAL_QUOTE_OPTIONS_UNSUPPORTED", selectedOption, JSONObject.NULL);
    }

    @Test
    public void nativeQuoteRejectsTenderPolicyRevisionDrift() throws Exception {
        final JSONObject drifted = new JSONObject(tenderPolicy()).put("revision", 4);
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "POS_TENDER_POLICY", "MF01", 5, 6,
            drifted.toString(), "tender-drift", "2026-12-01T00:00:00Z"
        ));

        assertCreateRejected("FORMAL_POS_TENDER_POLICY_REVISION_MISMATCH", intent(), JSONObject.NULL);
    }

    @Test
    public void rejectsBrowserIntentThatDoesNotMatchNativeQuoteClaim() throws Exception {
        final JSONObject changed = new JSONObject(intent().toString());
        changed.getJSONArray("lines").getJSONObject(0).put("quantity", 2);

        assertRejected("FORMAL_QUOTE_INTENT_MISMATCH", command(changed));
    }

    @Test
    public void rejectsQuoteWhenAdminRevisionHasAdvanced() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "ADMIN_ACTIVE_CONFIGURATION", "MF01", 3, 4,
            adminState(), "admin-advanced", "2026-12-01T00:00:00Z"
        ));

        assertRejected("FORMAL_QUOTE_ADMIN_CONFIG_STALE", command(intent()));
    }

    @Test
    public void rejectsQuoteAtExactExpiry() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "FORMAL_QUOTE", "QUOTE-1", 7, 8,
            quoteState(intent(), NOW, 3)
                .replace("\"revision\":7", "\"revision\":8")
                .replace("2026-12-01T00:00:00Z", "2026-11-30T23:59:59Z"),
            "quote-expired", "2026-12-01T00:00:00Z"
        ));

        assertRejected("FORMAL_QUOTE_EXPIRED", command(intent()));
    }

    @Test
    public void rejectsEmbeddedRoomRevisionDrift() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "FORMAL_QUOTE", "QUOTE-1", 7, 8,
            quoteState(intent(), NOW, 3).replace("\"revision\":8", "\"revision\":7"),
            "quote-drift", "2026-12-01T00:00:00Z"
        ));

        assertRejected("FORMAL_QUOTE_REVISION_MISMATCH", command(intent()));
    }

    @Test
    public void rejectsStudentQuoteWhileEligibilityPublicationIsUnbound() throws Exception {
        final JSONObject state = new JSONObject(quoteState(intent(), NOW + 60_000L, 3));
        state.getJSONObject("discountDecision").put("mode", "AUTO").put("confirmedStudentCount", 1);
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "FORMAL_QUOTE", "QUOTE-1", 7, 8,
            state.put("revision", 8).toString(), "student-unbound", "2026-12-01T00:00:00Z"
        ));

        assertRejected("FORMAL_STUDENT_DISCOUNT_POLICY_UNBOUND", command(intent()));
    }

    private void assertRejected(
        String code,
        FormalBusinessCommandContract.CommandEnvelope command
    ) throws Exception {
        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> new FormalCheckoutRoomPricingProducer(coordinator, () -> NOW)
                .validate(command)
                .get(5, TimeUnit.SECONDS)
        );
        assertEquals(code, error.getCause().getMessage());
    }

    private FormalQuoteRoomProducer.CreatedQuote createQuote(
        JSONObject clientIntent,
        Object tenderId
    ) throws Exception {
        return new FormalQuoteRoomProducer(coordinator, () -> NOW, 60_000L)
            .create("MF01", new JSONObject()
                .put("schema", "mfp.checkout.validation.request.v1")
                .put("intent", clientIntent)
                .put("channelId", "WALK_IN")
                .put("tenderId", tenderId)
                .put("studentDiscountIntent", JSONObject.NULL))
            .get(5, TimeUnit.SECONDS);
    }

    private void assertCreateRejected(
        String code,
        JSONObject clientIntent,
        Object tenderId
    ) throws Exception {
        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> createQuote(clientIntent, tenderId)
        );
        assertEquals(code, error.getCause().getMessage());
    }

    private void seed(String type, String id, long revision, String state) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01", type, id, revision, state, "hash-" + type, "2026-12-01T00:00:00Z"
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
                .put("storeSettings", new JSONObject().put("currency", "HKD")))
            .toString();
    }

    private static String tenderPolicy() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.pos-tender-policy.v1")
            .put("storeId", "MF01")
            .put("revision", 5)
            .put("tenders", new JSONArray()
                .put(new JSONObject()
                    .put("id", "CASH")
                    .put("label", "Cash")
                    .put("enabled", true)
                    .put("kind", "CASH"))
                .put(new JSONObject()
                    .put("id", "FPS")
                    .put("label", "FPS")
                    .put("enabled", false)
                    .put("kind", "NON_CASH")))
            .toString();
    }

    private static JSONObject intent() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.ordering.intent.draft.v1")
            .put("draftOnly", true)
            .put("pricing", "LOCAL_PREVIEW_FROM_PUBLISHED_FACTS")
            .put("serviceMode", "takeaway")
            .put("checkoutReady", true)
            .put("previewSubtotalMinor", 5_000)
            .put("lines", new JSONArray().put(new JSONObject()
                .put("cartLineId", "LINE-1")
                .put("kind", "PRODUCT")
                .put("productId", "DRINK-01")
                .put("comboId", JSONObject.NULL)
                .put("displayName", "Drink")
                .put("note", "")
                .put("quantity", 1)
                .put("serviceMode", "takeaway")
                .put("optionSelections", new JSONArray())
                .put("comboSelections", new JSONArray())
                .put("materialPriceFacts", new JSONArray().put(new JSONObject()
                    .put("factId", "PRICE-DRINK-01")
                    .put("amountMinor", 5_000)
                    .put("currency", "HKD")
                    .put("revision", 11)
                    .put("role", "PRODUCT_BASE")
                    .put("sourceId", "DRINK-01")))
                .put("previewUnitMinor", 5_000)
                .put("state", "READY")
                .put("issues", new JSONArray())
                .put("sourceProjection", new JSONObject()
                    .put("storeId", "MF01")
                    .put("port", "SMT")
                    .put("schemaVersion", 1)
                    .put("appliedSeq", 11)
                    .put("projectionHash", "ADMIN-11")
                    .put("appliedAt", "2026-12-01T00:00:00Z"))));
    }

    private static String quoteState(
        JSONObject clientIntent,
        long validUntilEpochMs,
        long adminConfigRevision
    ) throws Exception {
        final String validatedIntent = new JSONObject()
            .put("schema", "mfp.normalized-ordering-intent.v1")
            .put("storeId", "MF01")
            .put("serviceMode", "TAKEAWAY")
            .put("checkoutReady", true)
            .put("lines", new JSONArray().put(new JSONObject()
                .put("cartLineId", "LINE-1")
                .put("kind", "PRODUCT")
                .put("productId", "DRINK-01")
                .put("displayName", "Drink")
                .put("quantity", 1)
                .put("serviceMode", "takeaway")
                .put("optionSelections", new JSONArray())
                .put("comboSelections", new JSONArray())
                .put("materialPriceFacts", new JSONArray().put(new JSONObject()
                    .put("factId", "PRICE-DRINK-01")
                    .put("revision", 11)))))
            .toString();
        return new JSONObject()
            .put("schema", "mfp.formal-quote.v1")
            .put("storeId", "MF01")
            .put("quoteRef", "QUOTE-1")
            .put("revision", 7)
            .put("adminConfigRevision", adminConfigRevision)
            .put("adminSourceRevision", 11)
            .put("adminFingerprint", "ADMIN-11")
            .put("clientIntentHash", FormalCheckoutRoomPricingProducer.intentHash(clientIntent))
            .put("validatedIntentRef", "INTENT-1")
            .put("validatedIntentHash", StoreKernelContract.sha256(validatedIntent))
            .put("validatedIntentJson", validatedIntent)
            .put("channelId", "WALK_IN")
            .put("sourceIdentity", new JSONObject())
            .put("formalRevision", "QUOTE-REV-1")
            .put("currency", "HKD")
            .put("lines", new JSONArray().put(new JSONObject()
                .put("cartLineId", "LINE-1")
                .put("quantity", 1)
                .put("formalUnitMinor", 5_000)
                .put("formalLineTotalMinor", 5_000)
                .put("studentDiscountEligible", false)))
            .put("discounts", new JSONArray())
            .put("formalSubtotalMinor", 5_000)
            .put("formalDiscountMinor", 0)
            .put("formalTotalDueMinor", 5_000)
            .put("acceptedTenderIds", new JSONArray().put("CASH"))
            .put("validatedAt", "2026-12-01T00:00:00Z")
            .put("validUntilEpochMs", validUntilEpochMs)
            .put("discountDecision", new JSONObject()
                .put("decisionRef", "NO-STUDENT-1")
                .put("policyRevision", "STUDENT-POLICY-UNBOUND")
                .put("mode", "NONE")
                .put("confirmedStudentCount", 0)
                .put("selections", new JSONArray()))
            .toString();
    }

    private static FormalBusinessCommandContract.CommandEnvelope command(JSONObject intent) throws Exception {
        return command(intent, "QUOTE-1", "QUOTE-REV-1");
    }

    private static FormalBusinessCommandContract.CommandEnvelope command(
        JSONObject intent,
        String quoteRef,
        String formalRevision
    ) throws Exception {
        return FormalBusinessCommandContract.parseCommand(new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.command.v1")
            .put("schema", "mfp.store-kernel.command.v1")
            .put("requestId", "REQ-1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUB-1")
            .put("idempotencyKey", "IDEMP-1")
            .put("commandType", "CHECKOUT_PAYMENT_CONFIRM")
            .put("expectedRevision", formalRevision)
            .put("payload", new JSONObject()
                .put("intent", intent)
                .put("review", new JSONObject()
                    .put("channelId", "WALK_IN")
                    .put("tenderId", "CASH")
                    .put("quoteRef", quoteRef)
                    .put("formalRevision", formalRevision)
                    .put("formalTotalDueMinor", 5_000)
                    .put("formalDiscountMinor", 0)
                    .put("cashReceivedMinor", 5_000)
                    .put("changeMinor", 0)
                    .put("studentDiscountIntent", JSONObject.NULL)
                    .put("sourceIdentity", new JSONObject())))
            .put("createdAt", "2026-12-01T00:00:00Z")
            .toString());
    }
}
