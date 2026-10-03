package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalBusinessCommandContract;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler;
import com.morefunos.smt.storekernel.business.FormalCheckoutRoomBusinessDayProducer;

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
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalCheckoutRoomBusinessDayProducerTest {
    private static final long AFTER_CUTOFF = Instant.parse("2026-12-01T03:00:00Z").toEpochMilli();
    private static final long BEFORE_CUTOFF = Instant.parse("2026-12-01T18:00:00Z").toEpochMilli();

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
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void createsCanonicalDayFromAdminCutoffAndAllocatesFirstDisplayNumber() throws Exception {
        final FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot snapshot = producer(AFTER_CUTOFF)
            .readActive(command()).get(5, TimeUnit.SECONDS);

        assertEquals("BUSINESS-DAY-2026-12-01", snapshot.day().businessDayId());
        assertEquals(LocalDate.parse("2026-12-01"), snapshot.day().businessDate());
        assertEquals("0001", snapshot.day().displayNumber());
        assertEquals(0L, snapshot.day().orderSequenceExpectedRevision());
        assertEquals(1L, snapshot.day().allocatedOrderSequence());
        assertEquals(2, snapshot.dependencies().size());
        assertEquals("ADMIN_ACTIVE_CONFIGURATION", snapshot.dependencies().get(0).aggregateType);
        assertEquals("BUSINESS_DAY", snapshot.dependencies().get(1).aggregateType);
        assertEquals(Instant.parse("2026-12-01T20:00:00Z").toEpochMilli(), snapshot.validUntilEpochMs());
        final StoreKernelAggregateEntity day = database.storeKernelDao().readAggregate(
            "MF01", "BUSINESS_DAY", "BUSINESS-DAY-2026-12-01"
        );
        assertEquals(1L, day.revision);
        assertTrue(day.stateJson.contains("\"cutoff\":\"04:00\""));
        assertTrue(day.stateJson.contains("\"adminConfigRevision\":3"));
    }

    @Test
    public void classifiesPreCutoffTimeIntoPreviousBusinessDate() throws Exception {
        final FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot snapshot = producer(BEFORE_CUTOFF)
            .readActive(command()).get(5, TimeUnit.SECONDS);

        assertEquals(LocalDate.parse("2026-12-01"), snapshot.day().businessDate());
        assertEquals(Instant.parse("2026-12-01T20:00:00Z").toEpochMilli(), snapshot.validUntilEpochMs());
    }

    @Test
    public void readsExistingSequenceAndAllocatesNextWithoutMutatingIt() throws Exception {
        final FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot first = producer(AFTER_CUTOFF)
            .readActive(command()).get(5, TimeUnit.SECONDS);
        seed("ORDER_DISPLAY_SEQUENCE", first.day().businessDayId(), 7, new JSONObject()
            .put("schema", "mfp.order-display-sequence.v1")
            .put("storeId", "MF01")
            .put("businessDayId", first.day().businessDayId())
            .put("businessDate", "2026-12-01")
            .put("lastAllocatedSequence", 7)
            .put("lastDisplayNumber", "0007")
            .put("lastOrderId", "ORDER-7")
            .put("lastSubmissionId", "SUB-7")
            .put("updatedAt", "2026-12-01T03:00:00Z")
            .toString());

        final FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot next = producer(AFTER_CUTOFF)
            .readActive(command()).get(5, TimeUnit.SECONDS);

        assertEquals(7L, next.day().orderSequenceExpectedRevision());
        assertEquals(8L, next.day().allocatedOrderSequence());
        assertEquals("0008", next.day().displayNumber());
        assertEquals(7L, database.storeKernelDao().readAggregate(
            "MF01", "ORDER_DISPLAY_SEQUENCE", first.day().businessDayId()
        ).revision);
    }

    @Test
    public void refreshesTamperedDayAgainstCurrentCanonicalAdmin() throws Exception {
        producer(AFTER_CUTOFF).readActive(command()).get(5, TimeUnit.SECONDS);
        final StoreKernelAggregateEntity day = database.storeKernelDao().readAggregate(
            "MF01", "BUSINESS_DAY", "BUSINESS-DAY-2026-12-01"
        );
        final JSONObject stale = new JSONObject(day.stateJson).put("adminConfigRevision", 2);
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "BUSINESS_DAY", day.aggregateId, 1, 2,
            stale.put("revision", 2).toString(), "stale", "2026-12-01T03:01:00Z"
        ));

        final FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot refreshed = producer(AFTER_CUTOFF)
            .readActive(command()).get(5, TimeUnit.SECONDS);
        assertEquals(3L, Long.parseLong(refreshed.day().revision().value()));
        final JSONObject refreshedState = new JSONObject(database.storeKernelDao().readAggregate(
            "MF01", "BUSINESS_DAY", day.aggregateId
        ).stateJson);
        assertEquals(3L, refreshedState.getLong("adminConfigRevision"));
    }

    private FormalCheckoutRoomBusinessDayProducer producer(long now) {
        return new FormalCheckoutRoomBusinessDayProducer(coordinator, () -> now);
    }

    private void seed(String type, String id, long revision, String state) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01", type, id, revision, state, "hash-" + type, "2026-12-01T03:00:00Z"
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
                    .put("categories", new JSONArray())
                    .put("products", new JSONArray()))
                .put("storeSettings", new JSONObject()
                    .put("currency", "HKD")
                    .put("timezone", "Asia/Hong_Kong"))
                .put("businessDay", new JSONObject().put("cutoff", "04:00")))
            .toString();
    }

    private static FormalBusinessCommandContract.CommandEnvelope command() throws Exception {
        return FormalBusinessCommandContract.parseCommand(new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.command.v1")
            .put("schema", "mfp.store-kernel.command.v1")
            .put("requestId", "REQ-DAY")
            .put("storeId", "MF01")
            .put("deviceId", "PHONE-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUB-1")
            .put("idempotencyKey", "IDEMP-1")
            .put("commandType", "CHECKOUT_PAYMENT_CONFIRM")
            .put("expectedRevision", "QUOTE-REV-1")
            .put("payload", new JSONObject()
                .put("intent", new JSONObject())
                .put("review", new JSONObject()))
            .put("createdAt", "2026-12-01T03:00:00Z")
            .toString());
    }
}
