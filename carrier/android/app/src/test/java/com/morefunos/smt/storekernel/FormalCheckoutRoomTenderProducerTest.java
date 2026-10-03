package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalBusinessCommandContract;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords;
import com.morefunos.smt.storekernel.business.FormalCheckoutRoomTenderProducer;

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
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalCheckoutRoomTenderProducerTest {
    private static final long DEADLINE = 1_796_083_260_000L;

    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;

    @Before
    public void setUp() throws Exception {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01", "POS_TENDER_POLICY", "MF01", 5, policy().toString(),
            "policy-hash", "2026-12-01T00:00:00Z"
        ));
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void validatesCashFromCanonicalPolicyAndExactCountedChange() throws Exception {
        final FormalCheckoutPaymentConfirmHandler.TenderSnapshot snapshot = producer()
            .validate(command("CASH", 5_500L, 500L), pricing(List.of("CASH", "FPS")))
            .get(5, TimeUnit.SECONDS);

        assertEquals("CASH", snapshot.tender().tenderId());
        assertEquals(FormalCheckoutRecords.TenderKind.CASH, snapshot.tender().kind());
        assertEquals(FormalCheckoutRecords.SettlementEvidenceMode.CASH_COUNTED,
            snapshot.tender().evidenceMode());
        assertEquals(Long.valueOf(5_500L), snapshot.tender().cashReceivedMinor());
        assertEquals(Long.valueOf(500L), snapshot.tender().changeMinor());
        assertEquals(1, snapshot.dependencies().size());
        assertEquals(5L, snapshot.dependencies().get(0).expectedRevision);
        assertEquals(DEADLINE, snapshot.validUntilEpochMs());
    }

    @Test
    public void validatesElectronicAsStaffConfirmedWithoutProviderOrScreenshotClaim() throws Exception {
        final FormalCheckoutPaymentConfirmHandler.TenderSnapshot snapshot = producer()
            .validate(command("FPS", JSONObject.NULL, JSONObject.NULL), pricing(List.of("CASH", "FPS")))
            .get(5, TimeUnit.SECONDS);

        assertEquals(FormalCheckoutRecords.TenderKind.NON_CASH, snapshot.tender().kind());
        assertEquals(FormalCheckoutRecords.SettlementEvidenceMode.STAFF_CONFIRMED,
            snapshot.tender().evidenceMode());
        assertNull(snapshot.tender().cashReceivedMinor());
        assertNull(snapshot.tender().changeMinor());
    }

    @Test
    public void rejectsDisabledOrQuoteExcludedTender() throws Exception {
        assertRejected(
            "FORMAL_CHECKOUT_TENDER_DISABLED",
            command("PAYME", JSONObject.NULL, JSONObject.NULL),
            pricing(List.of("CASH", "FPS", "PAYME"))
        );
        assertRejected(
            "FORMAL_CHECKOUT_TENDER_NOT_IN_QUOTE",
            command("FPS", JSONObject.NULL, JSONObject.NULL),
            pricing(List.of("CASH"))
        );
    }

    @Test
    public void rejectsForgedCashArithmeticAndElectronicCashFields() throws Exception {
        assertRejected(
            "FORMAL_CHECKOUT_CASH_MISMATCH",
            command("CASH", 5_500L, 400L),
            pricing(List.of("CASH", "FPS"))
        );
        assertRejected(
            "FORMAL_CHECKOUT_ELECTRONIC_CASH_FIELDS_FORBIDDEN",
            command("FPS", 5_000L, 0L),
            pricing(List.of("CASH", "FPS"))
        );
    }

    @Test
    public void rejectsEmbeddedPolicyRevisionDrift() throws Exception {
        final JSONObject drifted = policy().put("revision", 4);
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "POS_TENDER_POLICY", "MF01", 5, 6,
            drifted.toString(), "drift", "2026-12-01T00:00:01Z"
        ));

        assertRejected(
            "FORMAL_POS_TENDER_POLICY_REVISION_MISMATCH",
            command("CASH", 5_000L, 0L),
            pricing(List.of("CASH"))
        );
    }

    private FormalCheckoutRoomTenderProducer producer() {
        return new FormalCheckoutRoomTenderProducer(coordinator);
    }

    private void assertRejected(
        String code,
        FormalBusinessCommandContract.CommandEnvelope command,
        FormalCheckoutPaymentConfirmHandler.PricingSnapshot pricing
    ) throws Exception {
        final ExecutionException error = assertThrows(
            ExecutionException.class,
            () -> producer().validate(command, pricing).get(5, TimeUnit.SECONDS)
        );
        assertEquals(code, error.getCause().getMessage());
    }

    private static JSONObject policy() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.pos-tender-policy.v1")
            .put("storeId", "MF01")
            .put("revision", 5)
            .put("tenders", new JSONArray()
                .put(tender("CASH", true, "CASH"))
                .put(tender("FPS", true, "NON_CASH"))
                .put(tender("PAYME", false, "NON_CASH")));
    }

    private static JSONObject tender(String id, boolean enabled, String kind) throws Exception {
        return new JSONObject()
            .put("id", id)
            .put("label", id)
            .put("enabled", enabled)
            .put("kind", kind);
    }

    private static FormalCheckoutPaymentConfirmHandler.PricingSnapshot pricing(
        List<String> acceptedTenders
    ) {
        return new FormalCheckoutPaymentConfirmHandler.PricingSnapshot(
            "INTENT-1",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "{\"schema\":\"mfp.normalized-ordering-intent.v1\"}",
            "WALK_IN",
            new FormalCheckoutRecords.SourceIdentity(null, null, null),
            new FormalCheckoutRecords.Quote(
                "QUOTE-1",
                FormalCheckoutRecords.Revision.text("QUOTE-REV-1"),
                "HKD",
                List.of(new FormalCheckoutRecords.Line("LINE-1", 1, 5_000L, 5_000L, false)),
                List.of(),
                5_000L,
                0L,
                5_000L,
                acceptedTenders,
                Instant.parse("2026-12-01T00:00:00Z")
            ),
            new FormalCheckoutRecords.DiscountDecision(
                "NO-DISCOUNT",
                FormalCheckoutRecords.Revision.text("STUDENT-POLICY-UNBOUND"),
                FormalCheckoutRecords.DiscountMode.NONE,
                0L,
                List.of()
            ),
            List.of(),
            DEADLINE
        );
    }

    private static FormalBusinessCommandContract.CommandEnvelope command(
        String tenderId,
        Object cashReceived,
        Object change
    ) throws Exception {
        return FormalBusinessCommandContract.parseCommand(new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.command.v1")
            .put("schema", "mfp.store-kernel.command.v1")
            .put("requestId", "REQ-TENDER")
            .put("storeId", "MF01")
            .put("deviceId", "PHONE-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUB-1")
            .put("idempotencyKey", "IDEMP-1")
            .put("commandType", "CHECKOUT_PAYMENT_CONFIRM")
            .put("expectedRevision", "QUOTE-REV-1")
            .put("payload", new JSONObject()
                .put("intent", new JSONObject())
                .put("review", new JSONObject()
                    .put("channelId", "WALK_IN")
                    .put("tenderId", tenderId)
                    .put("quoteRef", "QUOTE-1")
                    .put("formalRevision", "QUOTE-REV-1")
                    .put("formalTotalDueMinor", 5_000L)
                    .put("formalDiscountMinor", 0L)
                    .put("cashReceivedMinor", cashReceived)
                    .put("changeMinor", change)
                    .put("studentDiscountIntent", JSONObject.NULL)
                    .put("sourceIdentity", new JSONObject())))
            .put("createdAt", "2026-12-01T00:00:00Z")
            .toString());
    }
}
