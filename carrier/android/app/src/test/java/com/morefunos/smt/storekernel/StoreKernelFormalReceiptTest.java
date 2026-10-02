package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

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
public final class StoreKernelFormalReceiptTest {
    private StoreKernelDatabase database;
    private StoreKernelTransactionCoordinator coordinator;

    @Before
    public void setUp() {
        final Context context = RuntimeEnvironment.getApplication();
        database = StoreKernelDatabase.configure(
            Room.inMemoryDatabaseBuilder(context, StoreKernelDatabase.class).allowMainThreadQueries()
        ).build();
        coordinator = new StoreKernelTransactionCoordinator(database);
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void rejectedResultIsDurableAndReplaysBySubmissionIdentity() throws Exception {
        final StoreKernelContract.CommandResultRequest request = resultRequest("a".repeat(64), "MFP_CHECKOUT_PRODUCTION_BINDING_MISSING");

        final StoreKernelTransactionCoordinator.CommandReceiptReadResult first = coordinator.recordCommandResult(request).get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult replay = coordinator.recordCommandResult(request).get(5, TimeUnit.SECONDS);
        final StoreKernelTransactionCoordinator.CommandReceiptReadResult readback = coordinator
            .readCommandReceiptByCommandId("READ-1", "MF01", "SUB-01")
            .get(5, TimeUnit.SECONDS);

        assertTrue(first.found);
        assertEquals(first.resultJson, replay.resultJson);
        assertEquals(first.resultJson, readback.resultJson);
        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().aggregateCount());
    }

    @Test
    public void sameSubmissionWithDifferentFingerprintConflictsWithoutSecondReceipt() throws Exception {
        coordinator.recordCommandResult(resultRequest("a".repeat(64), "BLOCKED")).get(5, TimeUnit.SECONDS);

        try {
            coordinator.recordCommandResult(resultRequest("b".repeat(64), "BLOCKED")).get(5, TimeUnit.SECONDS);
        } catch (ExecutionException error) {
            assertEquals("STORE_KERNEL_IDEMPOTENCY_FINGERPRINT_CONFLICT", error.getCause().getMessage());
        }

        assertEquals(1, database.storeKernelDao().receiptCount());
        assertEquals(0, database.storeKernelDao().aggregateCount());
    }

    private static StoreKernelContract.CommandResultRequest resultRequest(String fingerprint, String rejectionCode) throws Exception {
        final String result = new JSONObject()
            .put("schema", "mfp.store-kernel.submission.result.v1")
            .put("submissionId", "SUB-01")
            .put("state", "REJECTED")
            .put("rejectionCode", rejectionCode)
            .toString();
        return new StoreKernelContract.CommandResultRequest(
            "REQ-1",
            "SUB-01",
            "MF01",
            "STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY",
            "IDEMP-01",
            fingerprint,
            result,
            "TRACE-SUB-01",
            "2026-10-02T06:02:00.000Z"
        );
    }
}
