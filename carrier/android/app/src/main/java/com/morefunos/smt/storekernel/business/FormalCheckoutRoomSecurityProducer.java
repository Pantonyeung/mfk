package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler.SecuritySnapshot;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SecurityEvidence;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Context;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.DeviceStatus;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Observation;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.OwnerAuthorizationStatus;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.ParentAuthorization;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Revision;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Role;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Scope;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.SessionRecord;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.SessionState;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.StaffStatus;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.function.LongSupplier;

/**
 * Native-only security reader backed by the existing Store Kernel Room database.
 * It verifies device, device-local Owner admission, and staff session in one final snapshot.
 */
public final class FormalCheckoutRoomSecurityProducer
    implements FormalSecurityAuthority, FormalCheckoutPaymentConfirmHandler.SecurityPort {
    public static final String DEVICE_AGGREGATE_TYPE = "DEVICE_AUTHORIZATION";
    public static final String OWNER_AGGREGATE_TYPE = "OWNER_AUTHORIZATION";
    public static final String SESSION_AGGREGATE_TYPE = "STAFF_SESSION";
    public static final String DEVICE_SCHEMA = "mfp.device-authorization.v1";
    public static final String OWNER_SCHEMA = "mfp.owner-authorization.v1";
    public static final String SESSION_SCHEMA = "mfp.staff-session.v1";

    private static final long MAX_SAFE_INTEGER = 9_007_199_254_740_991L;

    private final StoreKernelTransactionCoordinator coordinator;
    private final LongSupplier clock;

    public FormalCheckoutRoomSecurityProducer(
        StoreKernelTransactionCoordinator coordinator,
        LongSupplier clock
    ) {
        this.coordinator = Objects.requireNonNull(coordinator, "MFP_SECURITY_COORDINATOR_REQUIRED");
        this.clock = Objects.requireNonNull(clock, "MFP_SECURITY_CLOCK_REQUIRED");
    }

    @Override
    public CompletableFuture<SecuritySnapshot> read(
        FormalBusinessCommandContract.CommandEnvelope command
    ) {
        Objects.requireNonNull(command, "MFP_SECURITY_COMMAND_REQUIRED");
        return readAdmission(command.storeId, command.deviceId, command.staffSessionRef);
    }

    @Override
    public CompletableFuture<Decision> authorize(
        FormalBusinessCommandContract.CommandEnvelope command
    ) {
        if (command == null) return CompletableFuture.completedFuture(Decision.rejected("MFP_SECURITY_COMMAND_REQUIRED"));
        return authorize(command.storeId, command.deviceId, command.staffSessionRef);
    }

    @Override
    public CompletableFuture<Decision> authorizeReadback(
        FormalBusinessCommandContract.SubmissionReadRequest request
    ) {
        if (request == null) return CompletableFuture.completedFuture(Decision.rejected("MFP_SECURITY_READBACK_REQUIRED"));
        return authorize(request.storeId, request.deviceId, request.staffSessionRef);
    }

    private CompletableFuture<Decision> authorize(String storeId, String deviceId, String sessionRef) {
        try {
            return readAdmission(storeId, deviceId, sessionRef).handle((ignored, error) -> error == null
                ? Decision.allowed()
                : Decision.rejected(stableCode(error)));
        } catch (RuntimeException error) {
            return CompletableFuture.completedFuture(Decision.rejected(stableCode(error)));
        }
    }

    CompletableFuture<SecuritySnapshot> readAdmission(
        String storeId,
        String deviceId,
        String sessionRef
    ) {
        final String acceptedStoreId = requiredIdentity(storeId, "STORE_MISMATCH");
        final String acceptedDeviceId = requiredIdentity(deviceId, "DEVICE_MISMATCH");
        final String acceptedSessionRef = requiredIdentity(sessionRef, "SESSION_REF_MISMATCH");

        return coordinator.snapshot(snapshotRequest(
            "MFP-SECURITY-SESSION-READ",
            acceptedStoreId,
            new Key(SESSION_AGGREGATE_TYPE, acceptedSessionRef)
        )).thenCompose(initial -> {
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem initialItem = onlyItem(
                initial,
                SESSION_AGGREGATE_TYPE,
                acceptedSessionRef
            );
            if (!initialItem.found) return failed("SESSION_MISSING");
            final ParsedSession seed = parseSession(
                initialItem,
                acceptedStoreId,
                acceptedDeviceId,
                acceptedSessionRef
            );
            return coordinator.snapshot(snapshotRequest(
                "MFP-SECURITY-CANONICAL-READ",
                acceptedStoreId,
                new Key(DEVICE_AGGREGATE_TYPE, acceptedDeviceId),
                new Key(OWNER_AGGREGATE_TYPE, seed.ownerAuthorizationRef),
                new Key(SESSION_AGGREGATE_TYPE, acceptedSessionRef)
            )).thenApply(snapshot -> validateSnapshot(
                snapshot,
                acceptedStoreId,
                acceptedDeviceId,
                acceptedSessionRef,
                seed.ownerAuthorizationRef
            ));
        });
    }

    private SecuritySnapshot validateSnapshot(
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot,
        String storeId,
        String deviceId,
        String sessionRef,
        String ownerAuthorizationRef
    ) {
        if (snapshot.items.size() != 3) throw failure("MFP_SECURITY_SNAPSHOT_INVALID");
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem deviceItem = item(
            snapshot, 0, DEVICE_AGGREGATE_TYPE, deviceId
        );
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem ownerItem = item(
            snapshot, 1, OWNER_AGGREGATE_TYPE, ownerAuthorizationRef
        );
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem sessionItem = item(
            snapshot, 2, SESSION_AGGREGATE_TYPE, sessionRef
        );
        if (!deviceItem.found) throw failure("DEVICE_MISSING");
        if (!ownerItem.found) throw failure("OWNER_AUTHORIZATION_MISSING");
        if (!sessionItem.found) throw failure("SESSION_MISSING");

        final ParsedDevice device = parseDevice(deviceItem, storeId, deviceId);
        final ParsedOwner owner = parseOwner(ownerItem, storeId, ownerAuthorizationRef, deviceId);
        final ParsedSession session = parseSession(sessionItem, storeId, deviceId, sessionRef);
        if (!ownerAuthorizationRef.equals(session.ownerAuthorizationRef)) {
            throw failure("OWNER_AUTHORIZATION_REF_MISMATCH");
        }

        final ParentAuthorization currentParent = new ParentAuthorization(
            owner.ownerAuthorizationRef,
            numericRevision(ownerItem.revision),
            owner.deviceId
        );
        final Context context = new Context(
            sessionRef,
            deviceId,
            storeId,
            session.staffId,
            numericRevision(sessionItem.revision),
            currentParent
        );
        final ParentAuthorization admittedParent = new ParentAuthorization(
            session.ownerAuthorizationRef,
            numericRevision(session.ownerAuthorizationRevision),
            session.ownerAuthorizationDeviceId
        );
        final SessionRecord record = new SessionRecord(
            session.state,
            sessionRef,
            session.staffId,
            session.displayName,
            session.role,
            session.scope,
            session.permissions,
            session.issuedAtEpochMs,
            session.expiresAtEpochMs,
            deviceId,
            storeId,
            numericRevision(sessionItem.revision),
            admittedParent
        );
        final Observation observation = FormalStaffSessionRecords.validate(
            record,
            context,
            device.status,
            owner.status,
            session.staffStatus,
            clock.getAsLong()
        );
        if (observation.code() != FormalStaffSessionRecords.Code.VALID_AT_OBSERVATION) {
            throw failure(observation.code().name());
        }

        final List<StoreKernelContract.AggregateReadDependency> dependencies = List.of(
            dependency(deviceItem),
            dependency(ownerItem),
            dependency(sessionItem)
        );
        return new SecuritySnapshot(
            new SecurityEvidence(
                deviceId,
                FormalCheckoutRecords.Revision.numeric(deviceItem.revision),
                sessionRef,
                FormalCheckoutRecords.Revision.numeric(sessionItem.revision),
                session.staffId,
                ownerAuthorizationRef,
                FormalCheckoutRecords.Revision.numeric(ownerItem.revision)
            ),
            dependencies,
            session.expiresAtEpochMs
        );
    }

    private static ParsedDevice parseDevice(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item,
        String storeId,
        String deviceId
    ) {
        final JSONObject state = object(item.stateJson, "DEVICE_UNKNOWN");
        requireSchema(state, DEVICE_SCHEMA, "DEVICE_UNKNOWN");
        requireEqual(storeId, text(state, "storeId", "STORE_MISMATCH"), "STORE_MISMATCH");
        requireEqual(deviceId, text(state, "deviceId", "DEVICE_MISMATCH"), "DEVICE_MISMATCH");
        requireRevision(state, item.revision, "DEVICE_UNKNOWN");
        return new ParsedDevice(enumValue(
            DeviceStatus.class,
            text(state, "status", "DEVICE_UNKNOWN"),
            "DEVICE_UNKNOWN"
        ));
    }

    private static ParsedOwner parseOwner(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item,
        String storeId,
        String ownerAuthorizationRef,
        String deviceId
    ) {
        final JSONObject state = object(item.stateJson, "OWNER_AUTHORIZATION_UNKNOWN");
        requireSchema(state, OWNER_SCHEMA, "OWNER_AUTHORIZATION_UNKNOWN");
        requireEqual(storeId, text(state, "storeId", "STORE_MISMATCH"), "STORE_MISMATCH");
        requireEqual(
            ownerAuthorizationRef,
            text(state, "ownerAuthorizationRef", "OWNER_AUTHORIZATION_REF_MISMATCH"),
            "OWNER_AUTHORIZATION_REF_MISMATCH"
        );
        final String storedDeviceId = text(
            state,
            "deviceId",
            "OWNER_AUTHORIZATION_DEVICE_MISMATCH"
        );
        requireEqual(deviceId, storedDeviceId, "OWNER_AUTHORIZATION_DEVICE_MISMATCH");
        requireRevision(state, item.revision, "OWNER_AUTHORIZATION_UNKNOWN");
        return new ParsedOwner(
            ownerAuthorizationRef,
            storedDeviceId,
            enumValue(
                OwnerAuthorizationStatus.class,
                text(state, "status", "OWNER_AUTHORIZATION_UNKNOWN"),
                "OWNER_AUTHORIZATION_UNKNOWN"
            )
        );
    }

    private static ParsedSession parseSession(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item,
        String storeId,
        String deviceId,
        String sessionRef
    ) {
        final JSONObject state = object(item.stateJson, "SESSION_INVALID");
        requireSchema(state, SESSION_SCHEMA, "SESSION_INVALID");
        requireEqual(storeId, text(state, "storeId", "STORE_MISMATCH"), "STORE_MISMATCH");
        requireEqual(deviceId, text(state, "deviceId", "DEVICE_MISMATCH"), "DEVICE_MISMATCH");
        requireEqual(
            sessionRef,
            text(state, "staffSessionRef", "SESSION_REF_MISMATCH"),
            "SESSION_REF_MISMATCH"
        );
        requireRevision(state, item.revision, "SESSION_REVISION_MISMATCH");
        return new ParsedSession(
            text(state, "staffId", "SESSION_INVALID"),
            textValue(state, "displayName", "SESSION_INVALID"),
            enumValue(SessionState.class, text(state, "state", "SESSION_INVALID"), "SESSION_INVALID"),
            enumValue(Role.class, text(state, "role", "SESSION_INVALID"), "SESSION_INVALID"),
            enumValue(Scope.class, text(state, "scope", "SESSION_INVALID"), "SESSION_INVALID"),
            strings(state, "permissions", "SESSION_INVALID"),
            enumValue(
                StaffStatus.class,
                text(state, "staffStatus", "STAFF_MISSING"),
                "STAFF_MISSING"
            ),
            exactLong(state.opt("issuedAtEpochMs"), "SESSION_INVALID"),
            exactLong(state.opt("expiresAtEpochMs"), "SESSION_INVALID"),
            text(state, "ownerAuthorizationRef", "OWNER_AUTHORIZATION_MISSING"),
            exactLong(state.opt("ownerAuthorizationRevision"), "OWNER_AUTHORIZATION_MISSING"),
            text(state, "ownerAuthorizationDeviceId", "OWNER_AUTHORIZATION_MISSING")
        );
    }

    private static StoreKernelContract.AggregateSnapshotRequest snapshotRequest(
        String requestId,
        String storeId,
        Key... keys
    ) {
        try {
            final JSONArray encodedKeys = new JSONArray();
            for (Key key : keys) {
                encodedKeys.put(new JSONObject()
                    .put("aggregateType", key.aggregateType)
                    .put("aggregateId", key.aggregateId));
            }
            return StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", requestId)
                .put("storeId", storeId)
                .put("keys", encodedKeys));
        } catch (JSONException impossible) {
            throw new IllegalStateException("MFP_SECURITY_SNAPSHOT_ENCODING_FAILED", impossible);
        }
    }

    private static StoreKernelTransactionCoordinator.AggregateSnapshotItem onlyItem(
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot,
        String aggregateType,
        String aggregateId
    ) {
        if (snapshot.items.size() != 1) throw failure("MFP_SECURITY_SNAPSHOT_INVALID");
        return item(snapshot, 0, aggregateType, aggregateId);
    }

    private static StoreKernelTransactionCoordinator.AggregateSnapshotItem item(
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot,
        int index,
        String aggregateType,
        String aggregateId
    ) {
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem item = snapshot.items.get(index);
        if (!aggregateType.equals(item.aggregateType) || !aggregateId.equals(item.aggregateId)) {
            throw failure("MFP_SECURITY_SNAPSHOT_IDENTITY_MISMATCH");
        }
        return item;
    }

    private static StoreKernelContract.AggregateReadDependency dependency(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item
    ) {
        return new StoreKernelContract.AggregateReadDependency(
            item.aggregateType,
            item.aggregateId,
            item.revision
        );
    }

    private static Revision numericRevision(long value) {
        if (value < 1 || value > MAX_SAFE_INTEGER) throw failure("MFP_SECURITY_REVISION_INVALID");
        return new Revision(null, value);
    }

    private static void requireRevision(JSONObject state, long expected, String code) {
        if (expected < 1 || expected > MAX_SAFE_INTEGER
            || exactLong(state.opt("revision"), code) != expected) {
            throw failure(code);
        }
    }

    private static long exactLong(Object value, String code) {
        if (!(value instanceof Number)) throw failure(code);
        try {
            final BigDecimal decimal = new BigDecimal(value.toString());
            final long result = decimal.longValueExact();
            if (result < 0 || result > MAX_SAFE_INTEGER) throw failure(code);
            return result;
        } catch (ArithmeticException | NumberFormatException invalid) {
            throw failure(code);
        }
    }

    private static JSONObject object(String raw, String code) {
        if (raw == null) throw failure(code);
        try {
            return new JSONObject(raw);
        } catch (JSONException invalid) {
            throw failure(code);
        }
    }

    private static void requireSchema(JSONObject state, String expected, String code) {
        requireEqual(expected, text(state, "schema", code), code);
    }

    private static String text(JSONObject state, String key, String code) {
        final Object value = state.opt(key);
        if (!(value instanceof String)) throw failure(code);
        return requiredIdentity((String) value, code);
    }

    private static List<String> strings(JSONObject state, String key, String code) {
        final JSONArray values = state.optJSONArray(key);
        if (values == null) throw failure(code);
        final List<String> result = new ArrayList<>();
        for (int index = 0; index < values.length(); index++) {
            final Object value = values.opt(index);
            if (!(value instanceof String)) throw failure(code);
            result.add(requiredText((String) value, code));
        }
        return result;
    }

    private static <T extends Enum<T>> T enumValue(
        Class<T> type,
        String value,
        String code
    ) {
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException invalid) {
            throw failure(code);
        }
    }

    private static String requiredIdentity(String value, String code) {
        if (value == null || value.isEmpty() || !value.equals(value.trim()) || value.length() > 160) {
            throw failure(code);
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw failure(code);
        }
        return value;
    }

    private static String textValue(JSONObject state, String key, String code) {
        final Object value = state.opt(key);
        if (!(value instanceof String)) throw failure(code);
        return requiredText((String) value, code);
    }

    private static String requiredText(String value, String code) {
        if (value == null || value.isEmpty() || !value.equals(value.trim()) || value.length() > 240) {
            throw failure(code);
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw failure(code);
        }
        return value;
    }

    private static void requireEqual(String expected, String actual, String code) {
        if (!expected.equals(actual)) throw failure(code);
    }

    private static String stableCode(Throwable error) {
        final Throwable cause = unwrap(error);
        final String message = cause.getMessage();
        return message != null && message.matches("^[A-Z0-9_:-]{1,160}$")
            ? message
            : "MFP_SECURITY_READ_FAILED";
    }

    private static Throwable unwrap(Throwable error) {
        Throwable current = error;
        while ((current instanceof CompletionException || current instanceof ExecutionException)
            && current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }

    private static IllegalStateException failure(String code) {
        return new IllegalStateException(code);
    }

    private static <T> CompletableFuture<T> failed(String code) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(failure(code));
        return future;
    }

    private record Key(String aggregateType, String aggregateId) { }
    private record ParsedDevice(DeviceStatus status) { }
    private record ParsedOwner(
        String ownerAuthorizationRef,
        String deviceId,
        OwnerAuthorizationStatus status
    ) { }
    private record ParsedSession(
        String staffId,
        String displayName,
        SessionState state,
        Role role,
        Scope scope,
        List<String> permissions,
        StaffStatus staffStatus,
        long issuedAtEpochMs,
        long expiresAtEpochMs,
        String ownerAuthorizationRef,
        long ownerAuthorizationRevision,
        String ownerAuthorizationDeviceId
    ) { }
}
