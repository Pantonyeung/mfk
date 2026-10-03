package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler.BusinessDaySnapshot;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.BusinessDay;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Revision;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.LongSupplier;

/**
 * Classifies the active Business Day from canonical Admin timezone/cutoff facts and allocates
 * the next display-number claim without mutating the sequence before checkout commit.
 */
public final class FormalCheckoutRoomBusinessDayProducer
    implements FormalCheckoutPaymentConfirmHandler.BusinessDayPort {
    public static final String DAY_AGGREGATE_TYPE = "BUSINESS_DAY";
    public static final String DAY_SCHEMA = "mfp.business-day.v1";
    public static final String SEQUENCE_AGGREGATE_TYPE = "ORDER_DISPLAY_SEQUENCE";
    public static final String SEQUENCE_SCHEMA = "mfp.order-display-sequence.v1";

    private static final String OPERATION_ID = "FORMAL_BUSINESS_DAY_CLASSIFY";

    private final StoreKernelTransactionCoordinator coordinator;
    private final LongSupplier clock;

    public FormalCheckoutRoomBusinessDayProducer(
        StoreKernelTransactionCoordinator coordinator,
        LongSupplier clock
    ) {
        this.coordinator = Objects.requireNonNull(coordinator, "FORMAL_BUSINESS_DAY_COORDINATOR_REQUIRED");
        this.clock = Objects.requireNonNull(clock, "FORMAL_BUSINESS_DAY_CLOCK_REQUIRED");
    }

    @Override
    public CompletableFuture<BusinessDaySnapshot> readActive(
        FormalBusinessCommandContract.CommandEnvelope command
    ) {
        if (command == null) return failed("FORMAL_BUSINESS_DAY_COMMAND_REQUIRED");
        return coordinator.snapshot(adminSnapshot(command.storeId)).thenCompose(snapshot -> {
            try {
                final Classification classification = classify(command.storeId, snapshot);
                return ensureDay(classification).thenCompose(ignored ->
                    coordinator.snapshot(finalSnapshot(command.storeId, classification.dayId))
                ).thenApply(finalState -> project(classification, finalState));
            } catch (RuntimeException invalid) {
                return failed(invalid);
            }
        });
    }

    private CompletableFuture<Void> ensureDay(Classification classification) {
        return coordinator.snapshot(daySnapshot(classification.storeId, classification.dayId))
            .thenCompose(snapshot -> {
                if (snapshot.items.size() != 1) return failed("FORMAL_BUSINESS_DAY_SNAPSHOT_INVALID");
                final StoreKernelTransactionCoordinator.AggregateSnapshotItem day = snapshot.items.get(0);
                if (!DAY_AGGREGATE_TYPE.equals(day.aggregateType)
                    || !classification.dayId.equals(day.aggregateId)) {
                    return failed("FORMAL_BUSINESS_DAY_SNAPSHOT_INVALID");
                }
                try {
                    if (day.found && currentDay(classification, day)) {
                        return CompletableFuture.completedFuture(null);
                    }
                    final long expectedRevision = day.found ? day.revision : 0;
                    final long nextRevision = Math.addExact(expectedRevision, 1);
                    final JSONObject state = dayState(classification, nextRevision);
                    final StoreKernelContract.CommitRequest request = dayCommit(
                        classification,
                        expectedRevision,
                        state
                    );
                    return coordinator.commit(request).thenApply(ignored -> null);
                } catch (RuntimeException invalid) {
                    return failed(invalid);
                }
            });
    }

    private BusinessDaySnapshot project(
        Classification classification,
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot
    ) {
        if (snapshot.items.size() != 3) throw failure("FORMAL_BUSINESS_DAY_SNAPSHOT_INVALID");
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem admin = item(
            snapshot, 0, FormalAdminConfigProducer.AGGREGATE_TYPE, classification.storeId
        );
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem day = item(
            snapshot, 1, DAY_AGGREGATE_TYPE, classification.dayId
        );
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem sequence = item(
            snapshot, 2, SEQUENCE_AGGREGATE_TYPE, classification.dayId
        );
        if (!admin.found || admin.revision != classification.adminRevision
            || !Objects.equals(admin.stateHash, classification.adminStateHash)) {
            throw failure("FORMAL_BUSINESS_DAY_SOURCE_CHANGED");
        }
        if (!day.found || !currentDay(classification, day)) {
            throw failure("FORMAL_BUSINESS_DAY_INVALID");
        }
        final long expectedSequenceRevision;
        final long allocatedSequence;
        if (!sequence.found) {
            expectedSequenceRevision = 0;
            allocatedSequence = 1;
        } else {
            final JSONObject state = object(sequence.stateJson, "FORMAL_DISPLAY_SEQUENCE_INVALID");
            equal(SEQUENCE_SCHEMA, text(state, "schema", "FORMAL_DISPLAY_SEQUENCE_INVALID"),
                "FORMAL_DISPLAY_SEQUENCE_INVALID");
            equal(classification.storeId,
                text(state, "storeId", "FORMAL_DISPLAY_SEQUENCE_INVALID"),
                "FORMAL_DISPLAY_SEQUENCE_INVALID");
            equal(classification.dayId,
                text(state, "businessDayId", "FORMAL_DISPLAY_SEQUENCE_INVALID"),
                "FORMAL_DISPLAY_SEQUENCE_INVALID");
            equal(classification.businessDate.toString(),
                text(state, "businessDate", "FORMAL_DISPLAY_SEQUENCE_INVALID"),
                "FORMAL_DISPLAY_SEQUENCE_INVALID");
            final long last = positiveLong(
                state.opt("lastAllocatedSequence"),
                "FORMAL_DISPLAY_SEQUENCE_INVALID"
            );
            if (last != sequence.revision) throw failure("FORMAL_DISPLAY_SEQUENCE_REVISION_MISMATCH");
            equal(displayNumber(last),
                text(state, "lastDisplayNumber", "FORMAL_DISPLAY_SEQUENCE_INVALID"),
                "FORMAL_DISPLAY_SEQUENCE_INVALID");
            expectedSequenceRevision = sequence.revision;
            try {
                allocatedSequence = Math.addExact(last, 1);
            } catch (ArithmeticException exhausted) {
                throw failure("FORMAL_DISPLAY_SEQUENCE_EXHAUSTED");
            }
            if (allocatedSequence > FormalCheckoutRecords.MAX_SAFE_INTEGER) {
                throw failure("FORMAL_DISPLAY_SEQUENCE_EXHAUSTED");
            }
        }
        final JSONObject dayState = object(day.stateJson, "FORMAL_BUSINESS_DAY_INVALID");
        final String evidenceRef = text(
            dayState,
            "classificationEvidenceRef",
            "FORMAL_BUSINESS_DAY_INVALID"
        );
        return new BusinessDaySnapshot(
            new BusinessDay(
                classification.dayId,
                classification.businessDate,
                Revision.numeric(day.revision),
                evidenceRef,
                displayNumber(allocatedSequence),
                classification.dayId,
                expectedSequenceRevision,
                allocatedSequence
            ),
            List.of(dependency(admin), dependency(day)),
            classification.validUntilEpochMs
        );
    }

    private Classification classify(
        String storeId,
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot
    ) {
        if (snapshot.items.size() != 1) throw failure("FORMAL_BUSINESS_DAY_SNAPSHOT_INVALID");
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem admin = item(
            snapshot, 0, FormalAdminConfigProducer.AGGREGATE_TYPE, storeId
        );
        if (!admin.found) throw failure("ADMIN_CONFIG_SOURCE_MISSING");
        final FormalCheckoutSourceContracts.SourceFacts source;
        try {
            source = FormalCheckoutSourceContracts.fromValidatedStateJson(
                storeId,
                admin.revision,
                admin.stateJson,
                new FormalCheckoutOrgJsonDecoder()
            );
        } catch (RuntimeException invalid) {
            throw failure("ADMIN_CONFIG_STORED_STATE_INVALID");
        }
        final ZoneId zone;
        final LocalTime cutoff;
        try {
            zone = source.timezone().require();
            cutoff = source.businessDayCutoff().require();
        } catch (RuntimeException unbound) {
            throw failure("FORMAL_BUSINESS_DAY_POLICY_UNBOUND");
        }
        final long now = clock.getAsLong();
        if (now < 0) throw failure("FORMAL_BUSINESS_DAY_CLOCK_INVALID");
        final ZonedDateTime local = Instant.ofEpochMilli(now).atZone(zone);
        final boolean beforeCutoff = local.toLocalTime().isBefore(cutoff);
        final LocalDate businessDate = beforeCutoff
            ? local.toLocalDate().minusDays(1)
            : local.toLocalDate();
        final LocalDate boundaryDate = beforeCutoff
            ? local.toLocalDate()
            : local.toLocalDate().plusDays(1);
        final long validUntil = boundaryDate.atTime(cutoff).atZone(zone).toInstant().toEpochMilli();
        if (validUntil <= now) throw failure("FORMAL_BUSINESS_DAY_CLOCK_INVALID");
        final String dayId = "BUSINESS-DAY-" + businessDate;
        final String evidenceRef = "DAY-CLASSIFICATION-" + sha256(
            storeId + "\n" + businessDate + "\n" + zone.getId() + "\n" + cutoff
                + "\n" + admin.revision + "\n" + source.provenance().adminFingerprint()
        ).substring(0, 32);
        return new Classification(
            storeId,
            dayId,
            businessDate,
            zone,
            cutoff,
            now,
            validUntil,
            admin.revision,
            admin.stateHash,
            source.provenance().adminSourceRevision(),
            source.provenance().adminFingerprint(),
            evidenceRef
        );
    }

    private static boolean currentDay(
        Classification classification,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem day
    ) {
        final JSONObject state = object(day.stateJson, "FORMAL_BUSINESS_DAY_INVALID");
        if (!DAY_SCHEMA.equals(state.opt("schema"))
            || !classification.storeId.equals(state.opt("storeId"))
            || !classification.dayId.equals(state.opt("businessDayId"))
            || !classification.businessDate.toString().equals(state.opt("businessDate"))) {
            return false;
        }
        return positiveLong(state.opt("revision"), "FORMAL_BUSINESS_DAY_INVALID") == day.revision
            && positiveLong(state.opt("adminConfigRevision"), "FORMAL_BUSINESS_DAY_INVALID")
                == classification.adminRevision
            && positiveLong(state.opt("adminSourceRevision"), "FORMAL_BUSINESS_DAY_INVALID")
                == classification.adminSourceRevision
            && classification.adminFingerprint.equals(state.opt("adminFingerprint"))
            && classification.zone.getId().equals(state.opt("timezone"))
            && classification.cutoff.toString().equals(state.opt("cutoff"))
            && classification.evidenceRef.equals(state.opt("classificationEvidenceRef"));
    }

    private static JSONObject dayState(Classification value, long revision) {
        try {
            return new JSONObject()
                .put("schema", DAY_SCHEMA)
                .put("storeId", value.storeId)
                .put("businessDayId", value.dayId)
                .put("businessDate", value.businessDate.toString())
                .put("revision", revision)
                .put("timezone", value.zone.getId())
                .put("cutoff", value.cutoff.toString())
                .put("adminConfigRevision", value.adminRevision)
                .put("adminSourceRevision", value.adminSourceRevision)
                .put("adminFingerprint", value.adminFingerprint)
                .put("classificationEvidenceRef", value.evidenceRef)
                .put("classifiedAt", Instant.ofEpochMilli(value.classifiedAtEpochMs).toString());
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_BUSINESS_DAY_ENCODING_FAILED", impossible);
        }
    }

    private static StoreKernelContract.CommitRequest dayCommit(
        Classification classification,
        long expectedRevision,
        JSONObject state
    ) {
        try {
            final String stateHash = sha256(state.toString());
            final String commandId = "DAY-CLASSIFY-" + stateHash.substring(0, 32);
            final JSONObject result = new JSONObject()
                .put("state", "CLASSIFIED")
                .put("businessDayId", classification.dayId)
                .put("businessDate", classification.businessDate.toString())
                .put("revision", expectedRevision + 1);
            final JSONObject raw = new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.COMMIT)
                .put("requestId", "REQ-" + commandId)
                .put("commandId", commandId)
                .put("storeId", classification.storeId)
                .put("operationId", OPERATION_ID)
                .put("idempotencyKey", commandId)
                .put("requestFingerprint", stateHash)
                .put("result", result)
                .put("traceId", "business-day:" + classification.dayId + ":" + (expectedRevision + 1))
                .put("committedAt", Instant.ofEpochMilli(classification.classifiedAtEpochMs).toString())
                .put("mutations", new JSONArray().put(new JSONObject()
                    .put("aggregateType", DAY_AGGREGATE_TYPE)
                    .put("aggregateId", classification.dayId)
                    .put("expectedRevision", expectedRevision)
                    .put("state", state)))
                .put("outbox", new JSONArray());
            return StoreKernelContract.parseCommit(raw)
                .withReadDependencies(List.of(new StoreKernelContract.AggregateReadDependency(
                    FormalAdminConfigProducer.AGGREGATE_TYPE,
                    classification.storeId,
                    classification.adminRevision
                )))
                .withCommitDeadlineEpochMs(classification.validUntilEpochMs);
        } catch (JSONException invalid) {
            throw failure("FORMAL_BUSINESS_DAY_ENCODING_FAILED");
        }
    }

    private static StoreKernelContract.AggregateSnapshotRequest adminSnapshot(String storeId) {
        return snapshot("MFP-BUSINESS-DAY-ADMIN", storeId, new JSONArray()
            .put(key(FormalAdminConfigProducer.AGGREGATE_TYPE, storeId)));
    }

    private static StoreKernelContract.AggregateSnapshotRequest daySnapshot(
        String storeId,
        String dayId
    ) {
        return snapshot("MFP-BUSINESS-DAY-EXISTING", storeId, new JSONArray()
            .put(key(DAY_AGGREGATE_TYPE, dayId)));
    }

    private static StoreKernelContract.AggregateSnapshotRequest finalSnapshot(
        String storeId,
        String dayId
    ) {
        return snapshot("MFP-BUSINESS-DAY-FINAL", storeId, new JSONArray()
            .put(key(FormalAdminConfigProducer.AGGREGATE_TYPE, storeId))
            .put(key(DAY_AGGREGATE_TYPE, dayId))
            .put(key(SEQUENCE_AGGREGATE_TYPE, dayId)));
    }

    private static StoreKernelContract.AggregateSnapshotRequest snapshot(
        String requestId,
        String storeId,
        JSONArray keys
    ) {
        try {
            return StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", requestId)
                .put("storeId", storeId)
                .put("keys", keys));
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_BUSINESS_DAY_SNAPSHOT_ENCODING_FAILED", impossible);
        }
    }

    private static JSONObject key(String type, String id) {
        try {
            return new JSONObject().put("aggregateType", type).put("aggregateId", id);
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_BUSINESS_DAY_SNAPSHOT_ENCODING_FAILED", impossible);
        }
    }

    private static StoreKernelTransactionCoordinator.AggregateSnapshotItem item(
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot,
        int index,
        String type,
        String id
    ) {
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem item = snapshot.items.get(index);
        if (!type.equals(item.aggregateType) || !id.equals(item.aggregateId)) {
            throw failure("FORMAL_BUSINESS_DAY_SNAPSHOT_INVALID");
        }
        return item;
    }

    private static StoreKernelContract.AggregateReadDependency dependency(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item
    ) {
        if (!item.found || item.revision < 1) throw failure("FORMAL_BUSINESS_DAY_DEPENDENCY_INVALID");
        return new StoreKernelContract.AggregateReadDependency(
            item.aggregateType,
            item.aggregateId,
            item.revision
        );
    }

    private static String displayNumber(long sequence) {
        if (sequence < 1 || sequence > FormalCheckoutRecords.MAX_SAFE_INTEGER) {
            throw failure("FORMAL_DISPLAY_SEQUENCE_INVALID");
        }
        return String.format(Locale.ROOT, "%04d", sequence);
    }

    private static JSONObject object(String raw, String code) {
        if (raw == null) throw failure(code);
        try {
            return new JSONObject(raw);
        } catch (JSONException invalid) {
            throw failure(code);
        }
    }

    private static String text(JSONObject value, String key, String code) {
        final Object raw = value.opt(key);
        if (!(raw instanceof String)) throw failure(code);
        final String result = (String) raw;
        if (result.isEmpty() || !result.equals(result.trim()) || result.length() > 160) {
            throw failure(code);
        }
        return result;
    }

    private static long positiveLong(Object value, String code) {
        if (!(value instanceof Number)) throw failure(code);
        try {
            final long result = new java.math.BigDecimal(value.toString()).longValueExact();
            if (result < 1 || result > FormalCheckoutRecords.MAX_SAFE_INTEGER) throw failure(code);
            return result;
        } catch (ArithmeticException | NumberFormatException invalid) {
            throw failure(code);
        }
    }

    private static void equal(String expected, String actual, String code) {
        if (!expected.equals(actual)) throw failure(code);
    }

    private static String sha256(String value) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            final StringBuilder output = new StringBuilder(64);
            for (byte item : digest) {
                final String hex = Integer.toHexString(item & 0xff);
                if (hex.length() == 1) output.append('0');
                output.append(hex);
            }
            return output.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("FORMAL_BUSINESS_DAY_HASH_UNAVAILABLE", impossible);
        }
    }

    private static IllegalStateException failure(String code) {
        return new IllegalStateException(code);
    }

    private static <T> CompletableFuture<T> failed(String code) {
        return failed(failure(code));
    }

    private static <T> CompletableFuture<T> failed(RuntimeException error) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private record Classification(
        String storeId,
        String dayId,
        LocalDate businessDate,
        ZoneId zone,
        LocalTime cutoff,
        long classifiedAtEpochMs,
        long validUntilEpochMs,
        long adminRevision,
        String adminStateHash,
        long adminSourceRevision,
        String adminFingerprint,
        String evidenceRef
    ) { }
}
