package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.room.Room;

import com.morefunos.smt.storekernel.business.FormalBusinessCommandContract;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler;
import com.morefunos.smt.storekernel.business.FormalCheckoutRoomSecurityProducer;
import com.morefunos.smt.storekernel.business.FormalSecurityAuthority;

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
public final class FormalCheckoutRoomSecurityProducerTest {
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
        seed("DEVICE_AUTHORIZATION", "PAD-01", 1, device("AUTHORIZED", 1));
        seed("OWNER_AUTHORIZATION", "OWNER-AUTH-1", 1, owner(
            "OWNER-AUTH-1", "PAD-01", "AUTHORIZED", 1
        ));
        seed("STAFF_SESSION", "SESSION-01", 1, session());
    }

    @After
    public void tearDown() {
        coordinator.close();
        database.closeStoreKernel();
    }

    @Test
    public void readsThreeCanonicalDependenciesAndAuthorizesFrontlineStaff() throws Exception {
        final FormalCheckoutRoomSecurityProducer producer =
            new FormalCheckoutRoomSecurityProducer(coordinator, () -> NOW);
        final FormalBusinessCommandContract.CommandEnvelope command = command();

        final FormalCheckoutPaymentConfirmHandler.SecuritySnapshot snapshot = producer
            .read(command)
            .get(5, TimeUnit.SECONDS);
        assertEquals("PAD-01", snapshot.evidence().deviceId());
        assertEquals("SESSION-01", snapshot.evidence().staffSessionRef());
        assertEquals("STAFF-01", snapshot.evidence().staffId());
        assertEquals("OWNER-AUTH-1", snapshot.evidence().ownerAuthorizationRef());
        assertEquals(3, snapshot.dependencies().size());
        assertEquals("DEVICE_AUTHORIZATION", snapshot.dependencies().get(0).aggregateType);
        assertEquals("OWNER_AUTHORIZATION", snapshot.dependencies().get(1).aggregateType);
        assertEquals("STAFF_SESSION", snapshot.dependencies().get(2).aggregateType);
        assertEquals(1, snapshot.dependencies().get(0).expectedRevision);
        assertEquals(1, snapshot.dependencies().get(1).expectedRevision);
        assertEquals(1, snapshot.dependencies().get(2).expectedRevision);
        assertEquals(NOW + 60_000L, snapshot.validUntilEpochMs());
        assertTrue(producer.authorize(command).get(5, TimeUnit.SECONDS).authorized);
        assertTrue(producer.authorizeReadback(readRequest()).get(5, TimeUnit.SECONDS).authorized);
    }

    @Test
    public void deviceLocalOwnerRevocationFailsClosedWithoutAffectingAnotherRecord() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "OWNER_AUTHORIZATION", "OWNER-AUTH-1", 1, 2,
            owner("OWNER-AUTH-1", "PAD-01", "REVOKED", 2),
            "owner-revoked", "2026-12-01T00:00:00Z"
        ));
        seed("OWNER_AUTHORIZATION", "OWNER-AUTH-B", 1, owner(
            "OWNER-AUTH-B", "PAD-02", "AUTHORIZED", 1
        ));
        final FormalCheckoutRoomSecurityProducer producer =
            new FormalCheckoutRoomSecurityProducer(coordinator, () -> NOW);

        final FormalSecurityAuthority.Decision decision = producer
            .authorize(command())
            .get(5, TimeUnit.SECONDS);
        assertFalse(decision.authorized);
        assertEquals("OWNER_AUTHORIZATION_REVOKED", decision.rejectionCode);
        final ExecutionException readError = assertThrows(
            ExecutionException.class,
            () -> producer.read(command()).get(5, TimeUnit.SECONDS)
        );
        assertEquals("OWNER_AUTHORIZATION_REVOKED", readError.getCause().getMessage());
        assertEquals("AUTHORIZED", new JSONObject(database.storeKernelDao().readAggregate(
            "MF01", "OWNER_AUTHORIZATION", "OWNER-AUTH-B"
        ).stateJson).getString("status"));
    }

    @Test
    public void rejectsAuthorizedOwnerRevisionNotHeldBySession() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "OWNER_AUTHORIZATION", "OWNER-AUTH-1", 1, 2,
            owner("OWNER-AUTH-1", "PAD-01", "AUTHORIZED", 2),
            "owner-refreshed", "2026-12-01T00:00:00Z"
        ));
        final FormalSecurityAuthority.Decision decision = new FormalCheckoutRoomSecurityProducer(
            coordinator,
            () -> NOW
        ).authorize(command()).get(5, TimeUnit.SECONDS);

        assertFalse(decision.authorized);
        assertEquals("OWNER_AUTHORIZATION_REVISION_MISMATCH", decision.rejectionCode);
    }

    @Test
    public void rejectsExpiredSessionAtExactDeadline() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "STAFF_SESSION", "SESSION-01", 1, 2,
            session("AUTHENTICATED", 2, 1, NOW - 60_000L, NOW),
            "session-expired", "2026-12-01T00:00:00Z"
        ));
        final FormalSecurityAuthority.Decision decision = new FormalCheckoutRoomSecurityProducer(
            coordinator,
            () -> NOW
        ).authorizeReadback(readRequest()).get(5, TimeUnit.SECONDS);

        assertFalse(decision.authorized);
        assertEquals("SESSION_EXPIRED", decision.rejectionCode);
    }

    @Test
    public void rejectsEmbeddedDeviceRevisionDrift() throws Exception {
        assertEquals(1, database.storeKernelDao().compareAndSetAggregate(
            "MF01", "DEVICE_AUTHORIZATION", "PAD-01", 1, 2,
            device("AUTHORIZED", 1), "device-drift", "2026-12-01T00:00:00Z"
        ));
        final FormalSecurityAuthority.Decision decision = new FormalCheckoutRoomSecurityProducer(
            coordinator,
            () -> NOW
        ).authorize(command()).get(5, TimeUnit.SECONDS);

        assertFalse(decision.authorized);
        assertEquals("DEVICE_UNKNOWN", decision.rejectionCode);
    }

    private void seed(String type, String id, long revision, String state) {
        database.storeKernelDao().insertAggregate(new StoreKernelAggregateEntity(
            "MF01", type, id, revision, state, "hash-" + type + "-" + id, "2026-12-01T00:00:00Z"
        ));
    }

    private static String device(String status, long revision) throws Exception {
        return new JSONObject()
            .put("schema", "mfp.device-authorization.v1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("revision", revision)
            .put("status", status)
            .toString();
    }

    private static String owner(
        String ownerAuthorizationRef,
        String deviceId,
        String status,
        long revision
    ) throws Exception {
        return new JSONObject()
            .put("schema", "mfp.owner-authorization.v1")
            .put("storeId", "MF01")
            .put("ownerAuthorizationRef", ownerAuthorizationRef)
            .put("deviceId", deviceId)
            .put("revision", revision)
            .put("status", status)
            .toString();
    }

    private static String session() throws Exception {
        return session("AUTHENTICATED", 1, 1, NOW - 60_000L, NOW + 60_000L);
    }

    private static String session(
        String state,
        long revision,
        long ownerRevision,
        long issuedAtEpochMs,
        long expiresAtEpochMs
    ) throws Exception {
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
            .put("state", state)
            .put("staffStatus", "ACTIVE")
            .put("issuedAtEpochMs", issuedAtEpochMs)
            .put("expiresAtEpochMs", expiresAtEpochMs)
            .put("revision", revision)
            .put("ownerAuthorizationRef", "OWNER-AUTH-1")
            .put("ownerAuthorizationRevision", ownerRevision)
            .put("ownerAuthorizationDeviceId", "PAD-01")
            .toString();
    }

    private static FormalBusinessCommandContract.CommandEnvelope command() throws Exception {
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
            .put("expectedRevision", "QUOTE-1")
            .put("payload", new JSONObject()
                .put("intent", new JSONObject())
                .put("review", new JSONObject()))
            .put("createdAt", "2026-12-01T00:00:00Z")
            .toString());
    }

    private static FormalBusinessCommandContract.SubmissionReadRequest readRequest() throws Exception {
        return FormalBusinessCommandContract.parseSubmissionRead(new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.submission.read.v1")
            .put("requestId", "READ-1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUB-1")
            .toString());
    }
}
