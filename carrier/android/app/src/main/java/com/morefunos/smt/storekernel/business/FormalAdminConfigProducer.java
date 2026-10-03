package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

/** Applies the canonical Admin active envelope to the existing Store Kernel database. */
public final class FormalAdminConfigProducer {
    public static final String AGGREGATE_TYPE = "ADMIN_ACTIVE_CONFIGURATION";
    public static final String TENDER_POLICY_AGGREGATE_TYPE = "POS_TENDER_POLICY";
    public static final String TENDER_POLICY_SCHEMA = "mfp.pos-tender-policy.v1";
    public static final String SCHEMA = "MFK_ADMIN_CONFIG_SYNC_V1";

    private static final String OPERATION_ID = "STORE_KERNEL_ADMIN_CONFIG_PRODUCER";
    private static final int MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;

    private final StoreKernelTransactionCoordinator coordinator;
    private final String storeId;

    public FormalAdminConfigProducer(StoreKernelTransactionCoordinator coordinator, String storeId) {
        if (coordinator == null) throw new IllegalArgumentException("ADMIN_CONFIG_COORDINATOR_REQUIRED");
        this.storeId = identifier(storeId, "ADMIN_CONFIG_STORE_ID_INVALID", 64);
        this.coordinator = coordinator;
    }

    public CompletableFuture<ApplyResult> apply(String rawEnvelope, String observedAt) {
        final Envelope envelope = parseEnvelope(rawEnvelope, storeId);
        final String acceptedObservedAt = instant(observedAt, "ADMIN_CONFIG_OBSERVED_AT_INVALID");
        return applyEnvelope(envelope, acceptedObservedAt, 1);
    }

    private CompletableFuture<ApplyResult> applyEnvelope(Envelope envelope, String observedAt, int remainingRetries) {
        final String requestId = "ADMIN-CONFIG-READ-" + envelope.fingerprint;
        final StoreKernelContract.AggregateSnapshotRequest snapshotRequest;
        try {
            snapshotRequest = StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", requestId)
                .put("storeId", storeId)
                .put("keys", new JSONArray()
                    .put(new JSONObject()
                        .put("aggregateType", AGGREGATE_TYPE)
                        .put("aggregateId", storeId))
                    .put(new JSONObject()
                        .put("aggregateType", TENDER_POLICY_AGGREGATE_TYPE)
                        .put("aggregateId", storeId))));
        } catch (JSONException impossible) {
            throw new IllegalStateException("ADMIN_CONFIG_SNAPSHOT_REQUEST_ENCODING_FAILED", impossible);
        }
        return coordinator.snapshot(snapshotRequest).thenCompose(snapshot -> {
            if (snapshot.items.size() != 2) return failed("ADMIN_CONFIG_SNAPSHOT_INVALID");
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem current = snapshot.items.get(0);
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem currentTender = snapshot.items.get(1);
            boolean activeEnvelopeAlreadyStored = false;
            if (current.found) {
                final Envelope active;
                try {
                    active = parseEnvelope(current.stateJson, storeId, false);
                } catch (RuntimeException error) {
                    return failed("ADMIN_CONFIG_STORED_STATE_INVALID");
                }
                if (envelope.sourceRevision < active.sourceRevision) {
                    return failed("ADMIN_CONFIG_SOURCE_REVISION_ROLLBACK");
                }
                if (envelope.sourceRevision == active.sourceRevision) {
                    if (!envelope.fingerprint.equals(active.fingerprint)) {
                        return failed("ADMIN_CONFIG_SOURCE_REVISION_CONFLICT");
                    }
                    activeEnvelopeAlreadyStored = true;
                    if (tenderProjectionCurrent(currentTender, envelope)) {
                        return CompletableFuture.completedFuture(new ApplyResult(
                            envelope.sourceRevision,
                            envelope.fingerprint,
                            current.revision,
                            currentTender.revision,
                            true
                        ));
                    }
                }
            }
            validateTenderPolicyTransition(currentTender, envelope);
            return commit(
                envelope,
                current.revision,
                currentTender.revision,
                !activeEnvelopeAlreadyStored,
                observedAt
            ).handle((result, error) -> {
                if (error == null) return CompletableFuture.completedFuture(result);
                if (remainingRetries > 0 && isAggregateRevisionConflict(error)) {
                    return applyEnvelope(envelope, observedAt, remainingRetries - 1);
                }
                return FormalAdminConfigProducer.<ApplyResult>failed(unwrap(error));
            }).thenCompose(future -> future);
        });
    }

    private CompletableFuture<ApplyResult> commit(
        Envelope envelope,
        long expectedRevision,
        long expectedTenderRevision,
        boolean writeAdminEnvelope,
        String observedAt
    ) {
        try {
            final long nextRevision = writeAdminEnvelope
                ? Math.addExact(expectedRevision, 1)
                : expectedRevision;
            final long nextTenderRevision = Math.addExact(expectedTenderRevision, 1);
            final String commandId = "ADMIN-CONFIG-POS-TENDER-" + envelope.fingerprint;
            final JSONObject result = new JSONObject()
                .put("schema", "mfp.admin-config.apply.result.v1")
                .put("storeId", storeId)
                .put("sourceRevision", envelope.sourceRevision)
                .put("sourceFingerprint", envelope.fingerprint)
                .put("aggregateRevision", nextRevision)
                .put("tenderPolicyAggregateRevision", nextTenderRevision);
            final JSONArray mutations = new JSONArray();
            if (writeAdminEnvelope) {
                mutations.put(new JSONObject()
                    .put("aggregateType", AGGREGATE_TYPE)
                    .put("aggregateId", storeId)
                    .put("expectedRevision", expectedRevision)
                    .put("state", new JSONObject(envelope.normalizedJson)));
            }
            mutations.put(new JSONObject()
                .put("aggregateType", TENDER_POLICY_AGGREGATE_TYPE)
                .put("aggregateId", storeId)
                .put("expectedRevision", expectedTenderRevision)
                .put("state", projectedTenderPolicy(envelope, nextTenderRevision)));
            final JSONObject rawCommit = new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.COMMIT)
                .put("requestId", "REQ-" + commandId)
                .put("commandId", commandId)
                .put("storeId", storeId)
                .put("operationId", OPERATION_ID)
                .put("idempotencyKey", commandId)
                .put("requestFingerprint", sha256(envelope.normalizedJson))
                .put("result", result)
                .put("traceId", "TRACE-" + commandId)
                .put("committedAt", observedAt)
                .put("mutations", mutations)
                .put("outbox", new JSONArray());
            final StoreKernelContract.CommitRequest request = StoreKernelContract.parseCommit(rawCommit);
            return coordinator.commit(request).thenApply(committed -> new ApplyResult(
                envelope.sourceRevision,
                envelope.fingerprint,
                nextRevision,
                nextTenderRevision,
                committed.replayed
            ));
        } catch (ArithmeticException error) {
            return failed("ADMIN_CONFIG_AGGREGATE_REVISION_EXHAUSTED");
        } catch (JSONException error) {
            return failed("ADMIN_CONFIG_COMMIT_ENCODING_FAILED");
        }
    }

    private static Envelope parseEnvelope(String rawEnvelope, String expectedStoreId) {
        return parseEnvelope(rawEnvelope, expectedStoreId, true);
    }

    private static Envelope parseEnvelope(
        String rawEnvelope,
        String expectedStoreId,
        boolean tenderPolicyRequired
    ) {
        if (rawEnvelope == null || rawEnvelope.trim().isEmpty()) {
            throw new IllegalArgumentException("ADMIN_CONFIG_ENVELOPE_INVALID");
        }
        if (rawEnvelope.getBytes(StandardCharsets.UTF_8).length > MAX_ENVELOPE_BYTES) {
            throw new IllegalArgumentException("ADMIN_CONFIG_ENVELOPE_TOO_LARGE");
        }
        try {
            final JSONObject input = new JSONObject(rawEnvelope);
            if (!SCHEMA.equals(input.optString("schema", null))) {
                throw new IllegalArgumentException("ADMIN_CONFIG_SCHEMA_UNSUPPORTED");
            }
            final String storeId = identifier(input.opt("storeId"), "ADMIN_CONFIG_STORE_ID_INVALID", 64);
            if (!expectedStoreId.equals(storeId)) {
                throw new IllegalArgumentException("ADMIN_CONFIG_STORE_ID_MISMATCH");
            }
            final long revision = positiveLong(input.opt("revision"), "ADMIN_CONFIG_REVISION_INVALID");
            final String publishedAt = instant(input.opt("publishedAt"), "ADMIN_CONFIG_PUBLISHED_AT_INVALID");
            final String adminFingerprint = identifier(
                input.opt("adminFingerprint"),
                "ADMIN_CONFIG_ADMIN_FINGERPRINT_INVALID",
                128
            );
            final JSONObject rawSnapshot = input.optJSONObject("snapshot");
            if (rawSnapshot == null || rawSnapshot.optJSONObject("catalog") == null) {
                throw new IllegalArgumentException("ADMIN_CONFIG_CATALOG_REQUIRED");
            }
            final JSONObject snapshot = new JSONObject(rawSnapshot.toString());
            final Object rawTenderPolicy = snapshot.opt("posTenders");
            final TenderPolicy tenderPolicy = rawTenderPolicy == null && !tenderPolicyRequired
                ? new TenderPolicy(0, new JSONArray())
                : parseTenderPolicy(rawTenderPolicy);
            final JSONObject base = new JSONObject()
                .put("schema", SCHEMA)
                .put("storeId", storeId)
                .put("revision", revision)
                .put("publishedAt", publishedAt)
                .put("adminFingerprint", adminFingerprint)
                .put("snapshot", snapshot);
            final String expectedFingerprint = "fnv1a32:" + fnv1a32(javascriptJson(base));
            if (!expectedFingerprint.equals(input.optString("fingerprint", null))) {
                throw new IllegalArgumentException("ADMIN_CONFIG_FINGERPRINT_MISMATCH");
            }
            final JSONObject normalized = new JSONObject(base.toString()).put("fingerprint", expectedFingerprint);
            return new Envelope(
                revision,
                expectedFingerprint,
                normalized.toString(),
                tenderPolicy.sourceRevision,
                tenderPolicy.tenders
            );
        } catch (JSONException error) {
            throw new IllegalArgumentException("ADMIN_CONFIG_ENVELOPE_INVALID", error);
        }
    }

    private static TenderPolicy parseTenderPolicy(Object raw) throws JSONException {
        if (!(raw instanceof JSONObject)) {
            throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_POLICY_REQUIRED");
        }
        final JSONObject policy = (JSONObject) raw;
        if (!"MFK_POS_TENDER_POLICY_V1".equals(policy.optString("schema", null))) {
            throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_SCHEMA_UNSUPPORTED");
        }
        final long sourceRevision = positiveLong(
            policy.opt("revision"),
            "ADMIN_CONFIG_POS_TENDER_REVISION_INVALID"
        );
        final JSONArray rawTenders = policy.optJSONArray("tenders");
        if (rawTenders == null || rawTenders.length() > 64) {
            throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDERS_INVALID");
        }
        final JSONArray tenders = new JSONArray();
        final Set<String> ids = new HashSet<>();
        for (int index = 0; index < rawTenders.length(); index++) {
            final JSONObject row = rawTenders.optJSONObject(index);
            if (row == null) throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_INVALID");
            final String id = identifier(row.opt("id"), "ADMIN_CONFIG_POS_TENDER_ID_INVALID", 64);
            if (!id.matches("[A-Z][A-Z0-9_]{0,63}")) {
                throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_ID_INVALID");
            }
            if (!ids.add(id)) throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_ID_DUPLICATE");
            final String label = identifier(row.opt("label"), "ADMIN_CONFIG_POS_TENDER_LABEL_INVALID", 80);
            final Object enabled = row.opt("enabled");
            if (!(enabled instanceof Boolean)) {
                throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_ENABLED_INVALID");
            }
            final String kind = identifier(row.opt("kind"), "ADMIN_CONFIG_POS_TENDER_KIND_INVALID", 16);
            if (!"CASH".equals(kind) && !"NON_CASH".equals(kind)) {
                throw new IllegalArgumentException("ADMIN_CONFIG_POS_TENDER_KIND_INVALID");
            }
            tenders.put(new JSONObject()
                .put("id", id)
                .put("label", label)
                .put("enabled", enabled)
                .put("kind", kind));
        }
        return new TenderPolicy(sourceRevision, tenders);
    }

    private static JSONObject projectedTenderPolicy(Envelope envelope, long aggregateRevision) throws JSONException {
        return new JSONObject()
            .put("schema", TENDER_POLICY_SCHEMA)
            .put("storeId", new JSONObject(envelope.normalizedJson).getString("storeId"))
            .put("revision", aggregateRevision)
            .put("adminSourceRevision", envelope.sourceRevision)
            .put("adminSourceFingerprint", envelope.fingerprint)
            .put("adminPolicyRevision", envelope.tenderPolicySourceRevision)
            .put("tenders", new JSONArray(envelope.tenderRows.toString()));
    }

    private static boolean tenderProjectionCurrent(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item,
        Envelope envelope
    ) {
        if (!item.found) return false;
        try {
            final JSONObject state = new JSONObject(item.stateJson);
            return TENDER_POLICY_SCHEMA.equals(state.optString("schema", null))
                && storeIdFromEnvelope(envelope).equals(state.optString("storeId", null))
                && state.optLong("revision", -1) == item.revision
                && state.optLong("adminSourceRevision", -1) == envelope.sourceRevision
                && envelope.fingerprint.equals(state.optString("adminSourceFingerprint", null))
                && state.optLong("adminPolicyRevision", -1) == envelope.tenderPolicySourceRevision
                && envelope.tenderRows.toString().equals(state.optJSONArray("tenders").toString());
        } catch (Exception error) {
            return false;
        }
    }

    private static void validateTenderPolicyTransition(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem current,
        Envelope incoming
    ) {
        if (!current.found) return;
        final JSONObject state;
        final TenderPolicy stored;
        try {
            state = new JSONObject(current.stateJson);
            if (!state.has("adminPolicyRevision")) return;
            if (!TENDER_POLICY_SCHEMA.equals(state.optString("schema", null))
                || !storeIdFromEnvelope(incoming).equals(state.optString("storeId", null))
                || state.optLong("revision", -1) != current.revision) {
                throw new IllegalArgumentException("invalid stored policy identity");
            }
            stored = parseTenderPolicy(new JSONObject()
                .put("schema", "MFK_POS_TENDER_POLICY_V1")
                .put("revision", state.opt("adminPolicyRevision"))
                .put("tenders", state.opt("tenders")));
        } catch (Exception invalid) {
            throw new IllegalStateException("ADMIN_CONFIG_STORED_POS_TENDER_POLICY_INVALID");
        }
        if (incoming.tenderPolicySourceRevision < stored.sourceRevision) {
            throw new IllegalStateException("ADMIN_CONFIG_POS_TENDER_SOURCE_REVISION_ROLLBACK");
        }
        if (incoming.tenderPolicySourceRevision == stored.sourceRevision
            && !incoming.tenderRows.toString().equals(stored.tenders.toString())) {
            throw new IllegalStateException("ADMIN_CONFIG_POS_TENDER_SOURCE_REVISION_CONFLICT");
        }
    }

    private static String storeIdFromEnvelope(Envelope envelope) throws JSONException {
        return new JSONObject(envelope.normalizedJson).getString("storeId");
    }

    private static String identifier(Object raw, String code, int maxLength) {
        if (!(raw instanceof String)) throw new IllegalArgumentException(code);
        final String value = (String) raw;
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > maxLength) {
            throw new IllegalArgumentException(code);
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw new IllegalArgumentException(code);
        }
        return value;
    }

    private static long positiveLong(Object raw, String code) {
        if (!(raw instanceof Number)) throw new IllegalArgumentException(code);
        try {
            final long value = new BigDecimal(raw.toString()).longValueExact();
            if (value < 1) throw new IllegalArgumentException(code);
            return value;
        } catch (ArithmeticException | NumberFormatException error) {
            throw new IllegalArgumentException(code);
        }
    }

    private static String instant(Object raw, String code) {
        final String value = identifier(raw, code, 64);
        try {
            Instant.parse(value);
            return value;
        } catch (DateTimeParseException error) {
            throw new IllegalArgumentException(code);
        }
    }

    private static String fnv1a32(String value) {
        long hash = 0x811c9dc5L;
        for (int index = 0; index < value.length(); index++) {
            hash ^= value.charAt(index);
            hash = (hash * 0x01000193L) & 0xffffffffL;
        }
        return String.format(Locale.ROOT, "%08x", hash);
    }

    private static String javascriptJson(Object value) throws JSONException {
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
        if (value instanceof JSONObject) {
            final JSONObject object = (JSONObject) value;
            final List<String> fields = new ArrayList<>();
            final Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                final String key = keys.next();
                fields.add(javascriptString(key) + ":" + javascriptJson(object.opt(key)));
            }
            return "{" + String.join(",", fields) + "}";
        }
        throw new IllegalArgumentException("ADMIN_CONFIG_VALUE_INVALID");
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
                    if (Character.isHighSurrogate(character)
                        && index + 1 < value.length()
                        && Character.isLowSurrogate(value.charAt(index + 1))) {
                        output.append(character).append(value.charAt(++index));
                    } else if (character <= 0x1f || Character.isSurrogate(character)) {
                        output.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    } else {
                        output.append(character);
                    }
            }
        }
        return output.append('"').toString();
    }

    private static boolean isAggregateRevisionConflict(Throwable error) {
        return "STORE_KERNEL_AGGREGATE_REVISION_CONFLICT".equals(unwrap(error).getMessage());
    }

    private static Throwable unwrap(Throwable error) {
        Throwable current = error;
        while (current instanceof CompletionException && current.getCause() != null) current = current.getCause();
        return current;
    }

    private static String sha256(String value) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            final StringBuilder output = new StringBuilder(64);
            for (byte item : digest) output.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            return output.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("ADMIN_CONFIG_SHA256_UNAVAILABLE", impossible);
        }
    }

    private static <T> CompletableFuture<T> failed(String code) {
        return failed(new IllegalStateException(code));
    }

    private static <T> CompletableFuture<T> failed(Throwable error) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private static final class Envelope {
        final long sourceRevision;
        final String fingerprint;
        final String normalizedJson;
        final long tenderPolicySourceRevision;
        final JSONArray tenderRows;

        Envelope(
            long sourceRevision,
            String fingerprint,
            String normalizedJson,
            long tenderPolicySourceRevision,
            JSONArray tenderRows
        ) {
            this.sourceRevision = sourceRevision;
            this.fingerprint = fingerprint;
            this.normalizedJson = normalizedJson;
            this.tenderPolicySourceRevision = tenderPolicySourceRevision;
            this.tenderRows = tenderRows;
        }
    }

    private static final class TenderPolicy {
        final long sourceRevision;
        final JSONArray tenders;

        TenderPolicy(long sourceRevision, JSONArray tenders) {
            this.sourceRevision = sourceRevision;
            this.tenders = tenders;
        }
    }

    public static final class ApplyResult {
        public final long sourceRevision;
        public final String sourceFingerprint;
        public final long aggregateRevision;
        public final long tenderPolicyAggregateRevision;
        public final boolean replayed;

        ApplyResult(long sourceRevision, String sourceFingerprint, long aggregateRevision, boolean replayed) {
            this(sourceRevision, sourceFingerprint, aggregateRevision, 0, replayed);
        }

        ApplyResult(
            long sourceRevision,
            String sourceFingerprint,
            long aggregateRevision,
            long tenderPolicyAggregateRevision,
            boolean replayed
        ) {
            this.sourceRevision = sourceRevision;
            this.sourceFingerprint = sourceFingerprint;
            this.aggregateRevision = aggregateRevision;
            this.tenderPolicyAggregateRevision = tenderPolicyAggregateRevision;
            this.replayed = replayed;
        }
    }
}
