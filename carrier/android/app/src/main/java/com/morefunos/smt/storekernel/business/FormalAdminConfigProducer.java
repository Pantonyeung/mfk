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
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

/** Applies the canonical Admin active envelope to the existing Store Kernel database. */
public final class FormalAdminConfigProducer {
    public static final String AGGREGATE_TYPE = "ADMIN_ACTIVE_CONFIGURATION";
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
                .put("keys", new JSONArray().put(new JSONObject()
                    .put("aggregateType", AGGREGATE_TYPE)
                    .put("aggregateId", storeId))));
        } catch (JSONException impossible) {
            throw new IllegalStateException("ADMIN_CONFIG_SNAPSHOT_REQUEST_ENCODING_FAILED", impossible);
        }
        return coordinator.snapshot(snapshotRequest).thenCompose(snapshot -> {
            if (snapshot.items.size() != 1) return failed("ADMIN_CONFIG_SNAPSHOT_INVALID");
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem current = snapshot.items.get(0);
            if (current.found) {
                final Envelope active;
                try {
                    active = parseEnvelope(current.stateJson, storeId);
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
                    return CompletableFuture.completedFuture(new ApplyResult(
                        envelope.sourceRevision,
                        envelope.fingerprint,
                        current.revision,
                        true
                    ));
                }
            }
            return commit(envelope, current.revision, observedAt).handle((result, error) -> {
                if (error == null) return CompletableFuture.completedFuture(result);
                if (remainingRetries > 0 && isAggregateRevisionConflict(error)) {
                    return applyEnvelope(envelope, observedAt, remainingRetries - 1);
                }
                return FormalAdminConfigProducer.<ApplyResult>failed(unwrap(error));
            }).thenCompose(future -> future);
        });
    }

    private CompletableFuture<ApplyResult> commit(Envelope envelope, long expectedRevision, String observedAt) {
        try {
            final long nextRevision = Math.addExact(expectedRevision, 1);
            final String commandId = "ADMIN-CONFIG-" + envelope.fingerprint;
            final JSONObject result = new JSONObject()
                .put("schema", "mfp.admin-config.apply.result.v1")
                .put("storeId", storeId)
                .put("sourceRevision", envelope.sourceRevision)
                .put("sourceFingerprint", envelope.fingerprint)
                .put("aggregateRevision", nextRevision);
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
                .put("mutations", new JSONArray().put(new JSONObject()
                    .put("aggregateType", AGGREGATE_TYPE)
                    .put("aggregateId", storeId)
                    .put("expectedRevision", expectedRevision)
                    .put("state", new JSONObject(envelope.normalizedJson))))
                .put("outbox", new JSONArray());
            final StoreKernelContract.CommitRequest request = StoreKernelContract.parseCommit(rawCommit);
            return coordinator.commit(request).thenApply(committed -> new ApplyResult(
                envelope.sourceRevision,
                envelope.fingerprint,
                nextRevision,
                committed.replayed
            ));
        } catch (ArithmeticException error) {
            return failed("ADMIN_CONFIG_AGGREGATE_REVISION_EXHAUSTED");
        } catch (JSONException error) {
            return failed("ADMIN_CONFIG_COMMIT_ENCODING_FAILED");
        }
    }

    private static Envelope parseEnvelope(String rawEnvelope, String expectedStoreId) {
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
            return new Envelope(revision, expectedFingerprint, normalized.toString());
        } catch (JSONException error) {
            throw new IllegalArgumentException("ADMIN_CONFIG_ENVELOPE_INVALID", error);
        }
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

        Envelope(long sourceRevision, String fingerprint, String normalizedJson) {
            this.sourceRevision = sourceRevision;
            this.fingerprint = fingerprint;
            this.normalizedJson = normalizedJson;
        }
    }

    public static final class ApplyResult {
        public final long sourceRevision;
        public final String sourceFingerprint;
        public final long aggregateRevision;
        public final boolean replayed;

        ApplyResult(long sourceRevision, String sourceFingerprint, long aggregateRevision, boolean replayed) {
            this.sourceRevision = sourceRevision;
            this.sourceFingerprint = sourceFingerprint;
            this.aggregateRevision = aggregateRevision;
            this.replayed = replayed;
        }
    }
}
