package com.morefunos.smt.storekernel;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class StoreKernelContract {
    public static final int PROTOCOL_VERSION = 1;
    public static final int MAX_MESSAGE_BYTES = 262_144;
    public static final int MAX_MUTATIONS = 32;
    public static final int MAX_OUTBOX_EFFECTS = 64;
    public static final int MAX_AGGREGATE_SNAPSHOT_KEYS = 32;
    public static final int MAX_CLAIM_BATCH = 100;
    public static final long MAX_LEASE_DURATION_MS = 300_000L;

    public static final String COMMIT = "store.kernel.commit.v1";
    public static final String AGGREGATE_SNAPSHOT = "store.kernel.aggregate.snapshot.v1";
    public static final String COMMAND_RECEIPT_READ = "store.kernel.command.receipt.read.v1";
    public static final String INBOX_APPEND = "store.kernel.inbox.append.v1";
    public static final String OUTBOX_CLAIM = "store.kernel.outbox.claim.v1";
    public static final String OUTBOX_ACKNOWLEDGE = "store.kernel.outbox.ack.v1";
    public static final String OUTBOX_RELEASE = "store.kernel.outbox.release.v1";
    public static final String HEALTH = "store.kernel.health.v1";

    private static final Pattern SHA_256 = Pattern.compile("^[0-9a-f]{64}$");
    private static final Pattern ERROR_CODE = Pattern.compile("^[A-Z0-9_:-]{1,120}$");

    private StoreKernelContract() { }

    public static boolean isStoreKernelType(String type) {
        return COMMIT.equals(type)
            || AGGREGATE_SNAPSHOT.equals(type)
            || COMMAND_RECEIPT_READ.equals(type)
            || INBOX_APPEND.equals(type)
            || OUTBOX_CLAIM.equals(type)
            || OUTBOX_ACKNOWLEDGE.equals(type)
            || OUTBOX_RELEASE.equals(type)
            || HEALTH.equals(type);
    }

    public static JSONObject parseEnvelope(String rawMessage) throws JSONException {
        if (rawMessage == null || rawMessage.trim().isEmpty()) {
            throw new IllegalArgumentException("STORE_KERNEL_MESSAGE_REQUIRED");
        }
        if (rawMessage.getBytes(StandardCharsets.UTF_8).length > MAX_MESSAGE_BYTES) {
            throw new IllegalArgumentException("STORE_KERNEL_MESSAGE_TOO_LARGE");
        }
        final JSONObject request = new JSONObject(rawMessage);
        if (requiredInt(request, "protocolVersion") != PROTOCOL_VERSION) {
            throw new IllegalArgumentException("STORE_KERNEL_PROTOCOL_UNSUPPORTED");
        }
        requiredIdentifier(request, "requestId");
        final String type = requiredIdentifier(request, "type");
        if (!isStoreKernelType(type)) throw new IllegalArgumentException("STORE_KERNEL_OPERATION_UNSUPPORTED");
        return request;
    }

    public static CommitRequest parseCommit(JSONObject request) throws JSONException {
        requireType(request, COMMIT);
        final JSONArray rawMutations = requiredArray(request, "mutations");
        if (rawMutations.length() < 1 || rawMutations.length() > MAX_MUTATIONS) {
            throw new IllegalArgumentException("STORE_KERNEL_MUTATION_COUNT_INVALID");
        }
        final List<AggregateMutation> mutations = new ArrayList<>();
        for (int index = 0; index < rawMutations.length(); index++) {
            final JSONObject mutation = rawMutations.optJSONObject(index);
            if (mutation == null) throw new IllegalArgumentException("STORE_KERNEL_MUTATION_INVALID");
            final long expectedRevision = requiredLong(mutation, "expectedRevision");
            if (expectedRevision < 0 || expectedRevision == Long.MAX_VALUE) {
                throw new IllegalArgumentException("STORE_KERNEL_EXPECTED_REVISION_INVALID");
            }
            mutations.add(new AggregateMutation(
                requiredIdentifier(mutation, "aggregateType"),
                requiredIdentifier(mutation, "aggregateId"),
                expectedRevision,
                requiredJsonValue(mutation, "state")
            ));
        }

        final JSONArray rawOutbox = requiredArray(request, "outbox");
        if (rawOutbox.length() > MAX_OUTBOX_EFFECTS) {
            throw new IllegalArgumentException("STORE_KERNEL_OUTBOX_COUNT_INVALID");
        }
        final List<OutboxEffect> outbox = new ArrayList<>();
        for (int index = 0; index < rawOutbox.length(); index++) {
            final JSONObject effect = rawOutbox.optJSONObject(index);
            if (effect == null) throw new IllegalArgumentException("STORE_KERNEL_OUTBOX_EFFECT_INVALID");
            final long aggregateRevision = requiredLong(effect, "aggregateRevision");
            if (aggregateRevision < 1) throw new IllegalArgumentException("STORE_KERNEL_OUTBOX_REVISION_INVALID");
            outbox.add(new OutboxEffect(
                requiredIdentifier(effect, "eventId"),
                requiredIdentifier(effect, "aggregateType"),
                requiredIdentifier(effect, "aggregateId"),
                aggregateRevision,
                requiredIdentifier(effect, "eventType"),
                requiredTimestamp(effect, "occurredAt"),
                requiredJsonValue(effect, "payload")
            ));
        }

        InboxConsumption inbox = null;
        if (request.has("inbox") && request.opt("inbox") != JSONObject.NULL) {
            final JSONObject rawInbox = request.optJSONObject("inbox");
            if (rawInbox == null) throw new IllegalArgumentException("STORE_KERNEL_INBOX_REFERENCE_INVALID");
            inbox = new InboxConsumption(
                requiredIdentifier(rawInbox, "source"),
                requiredIdentifier(rawInbox, "sourceEventId"),
                requiredSha256(rawInbox, "payloadHash")
            );
        }

        return new CommitRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "commandId"),
            requiredIdentifier(request, "storeId"),
            requiredIdentifier(request, "operationId"),
            requiredIdentifier(request, "idempotencyKey"),
            requiredSha256(request, "requestFingerprint"),
            requiredJsonValue(request, "result"),
            requiredIdentifier(request, "traceId"),
            requiredTimestamp(request, "committedAt"),
            mutations,
            outbox,
            inbox
        );
    }

    public static AggregateSnapshotRequest parseAggregateSnapshot(JSONObject request) throws JSONException {
        requireType(request, AGGREGATE_SNAPSHOT);
        final JSONArray rawKeys = requiredArray(request, "keys");
        if (rawKeys.length() < 1 || rawKeys.length() > MAX_AGGREGATE_SNAPSHOT_KEYS) {
            throw new IllegalArgumentException("STORE_KERNEL_AGGREGATE_SNAPSHOT_KEYS_INVALID");
        }
        final List<AggregateKey> keys = new ArrayList<>();
        final Set<String> uniqueKeys = new HashSet<>();
        for (int index = 0; index < rawKeys.length(); index++) {
            final JSONObject rawKey = rawKeys.optJSONObject(index);
            if (rawKey == null) throw new IllegalArgumentException("STORE_KERNEL_AGGREGATE_SNAPSHOT_KEYS_INVALID");
            final String aggregateType = requiredIdentifier(rawKey, "aggregateType");
            final String aggregateId = requiredIdentifier(rawKey, "aggregateId");
            if (!uniqueKeys.add(aggregateType + "\u0000" + aggregateId)) {
                throw new IllegalArgumentException("STORE_KERNEL_AGGREGATE_SNAPSHOT_KEYS_INVALID");
            }
            keys.add(new AggregateKey(aggregateType, aggregateId));
        }
        return new AggregateSnapshotRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "storeId"),
            keys
        );
    }

    public static CommandReceiptReadRequest parseCommandReceiptRead(JSONObject request) throws JSONException {
        requireType(request, COMMAND_RECEIPT_READ);
        return new CommandReceiptReadRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "storeId"),
            requiredIdentifier(request, "operationId"),
            requiredIdentifier(request, "idempotencyKey"),
            requiredSha256(request, "requestFingerprint")
        );
    }

    public static InboxAppendRequest parseInboxAppend(JSONObject request) throws JSONException {
        requireType(request, INBOX_APPEND);
        return new InboxAppendRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "storeId"),
            requiredIdentifier(request, "source"),
            requiredIdentifier(request, "sourceEventId"),
            requiredJsonValue(request, "payload"),
            requiredIdentifier(request, "traceId"),
            requiredTimestamp(request, "receivedAt")
        );
    }

    public static OutboxClaimRequest parseOutboxClaim(JSONObject request) throws JSONException {
        requireType(request, OUTBOX_CLAIM);
        final long nowEpochMs = requiredLong(request, "nowEpochMs");
        final long leaseDurationMs = requiredLong(request, "leaseDurationMs");
        final int limit = requiredInt(request, "limit");
        if (nowEpochMs < 0) throw new IllegalArgumentException("STORE_KERNEL_NOW_INVALID");
        if (leaseDurationMs < 1 || leaseDurationMs > MAX_LEASE_DURATION_MS) {
            throw new IllegalArgumentException("STORE_KERNEL_LEASE_DURATION_INVALID");
        }
        if (limit < 1 || limit > MAX_CLAIM_BATCH) {
            throw new IllegalArgumentException("STORE_KERNEL_CLAIM_LIMIT_INVALID");
        }
        if (nowEpochMs > Long.MAX_VALUE - leaseDurationMs) {
            throw new IllegalArgumentException("STORE_KERNEL_LEASE_EXPIRY_INVALID");
        }
        return new OutboxClaimRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "storeId"),
            requiredIdentifier(request, "eventType"),
            requiredIdentifier(request, "leaseOwner"),
            nowEpochMs,
            leaseDurationMs,
            limit,
            requiredTimestamp(request, "observedAt")
        );
    }

    public static OutboxAcknowledgeRequest parseOutboxAcknowledge(JSONObject request) throws JSONException {
        requireType(request, OUTBOX_ACKNOWLEDGE);
        return new OutboxAcknowledgeRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "eventId"),
            requiredIdentifier(request, "leaseOwner"),
            requiredTimestamp(request, "acknowledgedAt")
        );
    }

    public static OutboxReleaseRequest parseOutboxRelease(JSONObject request) throws JSONException {
        requireType(request, OUTBOX_RELEASE);
        final String errorCode = requiredIdentifier(request, "errorCode");
        if (!ERROR_CODE.matcher(errorCode).matches()) {
            throw new IllegalArgumentException("STORE_KERNEL_ERROR_CODE_INVALID");
        }
        return new OutboxReleaseRequest(
            requiredIdentifier(request, "requestId"),
            requiredIdentifier(request, "eventId"),
            requiredIdentifier(request, "leaseOwner"),
            errorCode
        );
    }

    public static String requestId(JSONObject request) throws JSONException {
        return requiredIdentifier(request, "requestId");
    }

    public static String type(JSONObject request) throws JSONException {
        return requiredIdentifier(request, "type");
    }

    static String sha256(String value) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            final StringBuilder result = new StringBuilder(64);
            for (byte item : digest) result.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("STORE_KERNEL_SHA256_UNAVAILABLE", impossible);
        }
    }

    private static void requireType(JSONObject request, String expected) throws JSONException {
        if (requiredInt(request, "protocolVersion") != PROTOCOL_VERSION) {
            throw new IllegalArgumentException("STORE_KERNEL_PROTOCOL_UNSUPPORTED");
        }
        if (!expected.equals(requiredIdentifier(request, "type"))) {
            throw new IllegalArgumentException("STORE_KERNEL_OPERATION_MISMATCH");
        }
    }

    private static String requiredIdentifier(JSONObject object, String name) throws JSONException {
        final Object raw = object.opt(name);
        if (!(raw instanceof String)) throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        final String rawValue = (String) raw;
        final String value = rawValue.trim();
        if (!rawValue.equals(value) || value.isEmpty() || value.length() > 160) {
            throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) {
                throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
            }
        }
        return value;
    }

    private static String requiredTimestamp(JSONObject object, String name) throws JSONException {
        final String value = requiredIdentifier(object, name);
        if (value.length() > 64) throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        return value;
    }

    private static String requiredSha256(JSONObject object, String name) throws JSONException {
        final String value = requiredIdentifier(object, name);
        if (!SHA_256.matcher(value).matches()) {
            throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        }
        return value;
    }

    private static int requiredInt(JSONObject object, String name) throws JSONException {
        final long value = requiredLong(object, name);
        if (value < Integer.MIN_VALUE || value > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        }
        return (int) value;
    }

    private static long requiredLong(JSONObject object, String name) throws JSONException {
        final Object raw = object.opt(name);
        if (!(raw instanceof Number)) throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        try {
            return new BigDecimal(raw.toString()).longValueExact();
        } catch (ArithmeticException | NumberFormatException error) {
            throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        }
    }

    private static JSONArray requiredArray(JSONObject object, String name) throws JSONException {
        final JSONArray value = object.optJSONArray(name);
        if (value == null) throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        return value;
    }

    private static String requiredJsonValue(JSONObject object, String name) throws JSONException {
        final Object value = object.opt(name);
        if (!(value instanceof JSONObject) && !(value instanceof JSONArray)) {
            throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_INVALID");
        }
        final String json = value.toString();
        if (json.getBytes(StandardCharsets.UTF_8).length > 131_072) {
            throw new IllegalArgumentException("STORE_KERNEL_" + codeName(name) + "_TOO_LARGE");
        }
        return json;
    }

    private static String codeName(String value) {
        return value.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase(Locale.ROOT);
    }

    public static final class AggregateMutation {
        public final String aggregateType;
        public final String aggregateId;
        public final long expectedRevision;
        public final String stateJson;

        AggregateMutation(String aggregateType, String aggregateId, long expectedRevision, String stateJson) {
            this.aggregateType = aggregateType;
            this.aggregateId = aggregateId;
            this.expectedRevision = expectedRevision;
            this.stateJson = stateJson;
        }

        public long newRevision() { return expectedRevision + 1; }
    }

    public static final class AggregateKey {
        public final String aggregateType;
        public final String aggregateId;

        AggregateKey(String aggregateType, String aggregateId) {
            this.aggregateType = aggregateType;
            this.aggregateId = aggregateId;
        }
    }

    public static final class AggregateSnapshotRequest {
        public final String requestId;
        public final String storeId;
        public final List<AggregateKey> keys;

        AggregateSnapshotRequest(String requestId, String storeId, List<AggregateKey> keys) {
            this.requestId = requestId;
            this.storeId = storeId;
            this.keys = Collections.unmodifiableList(new ArrayList<>(keys));
        }
    }

    public static final class CommandReceiptReadRequest {
        public final String requestId;
        public final String storeId;
        public final String operationId;
        public final String idempotencyKey;
        public final String requestFingerprint;

        CommandReceiptReadRequest(
            String requestId,
            String storeId,
            String operationId,
            String idempotencyKey,
            String requestFingerprint
        ) {
            this.requestId = requestId;
            this.storeId = storeId;
            this.operationId = operationId;
            this.idempotencyKey = idempotencyKey;
            this.requestFingerprint = requestFingerprint;
        }
    }

    public static final class OutboxEffect {
        public final String eventId;
        public final String aggregateType;
        public final String aggregateId;
        public final long aggregateRevision;
        public final String eventType;
        public final String occurredAt;
        public final String payloadJson;

        OutboxEffect(
            String eventId,
            String aggregateType,
            String aggregateId,
            long aggregateRevision,
            String eventType,
            String occurredAt,
            String payloadJson
        ) {
            this.eventId = eventId;
            this.aggregateType = aggregateType;
            this.aggregateId = aggregateId;
            this.aggregateRevision = aggregateRevision;
            this.eventType = eventType;
            this.occurredAt = occurredAt;
            this.payloadJson = payloadJson;
        }
    }

    public static final class InboxConsumption {
        public final String source;
        public final String sourceEventId;
        public final String payloadHash;

        InboxConsumption(String source, String sourceEventId, String payloadHash) {
            this.source = source;
            this.sourceEventId = sourceEventId;
            this.payloadHash = payloadHash;
        }
    }

    public static final class CommitRequest {
        public final String requestId;
        public final String commandId;
        public final String storeId;
        public final String operationId;
        public final String idempotencyKey;
        public final String requestFingerprint;
        public final String resultJson;
        public final String traceId;
        public final String committedAt;
        public final List<AggregateMutation> mutations;
        public final List<OutboxEffect> outbox;
        public final InboxConsumption inbox;

        CommitRequest(
            String requestId,
            String commandId,
            String storeId,
            String operationId,
            String idempotencyKey,
            String requestFingerprint,
            String resultJson,
            String traceId,
            String committedAt,
            List<AggregateMutation> mutations,
            List<OutboxEffect> outbox,
            InboxConsumption inbox
        ) {
            this.requestId = requestId;
            this.commandId = commandId;
            this.storeId = storeId;
            this.operationId = operationId;
            this.idempotencyKey = idempotencyKey;
            this.requestFingerprint = requestFingerprint;
            this.resultJson = resultJson;
            this.traceId = traceId;
            this.committedAt = committedAt;
            this.mutations = Collections.unmodifiableList(new ArrayList<>(mutations));
            this.outbox = Collections.unmodifiableList(new ArrayList<>(outbox));
            this.inbox = inbox;
        }
    }

    public static final class InboxAppendRequest {
        public final String requestId;
        public final String storeId;
        public final String source;
        public final String sourceEventId;
        public final String payloadJson;
        public final String traceId;
        public final String receivedAt;

        InboxAppendRequest(
            String requestId,
            String storeId,
            String source,
            String sourceEventId,
            String payloadJson,
            String traceId,
            String receivedAt
        ) {
            this.requestId = requestId;
            this.storeId = storeId;
            this.source = source;
            this.sourceEventId = sourceEventId;
            this.payloadJson = payloadJson;
            this.traceId = traceId;
            this.receivedAt = receivedAt;
        }
    }

    public static final class OutboxClaimRequest {
        public final String requestId;
        public final String storeId;
        public final String eventType;
        public final String leaseOwner;
        public final long nowEpochMs;
        public final long leaseDurationMs;
        public final int limit;
        public final String observedAt;

        OutboxClaimRequest(
            String requestId,
            String storeId,
            String eventType,
            String leaseOwner,
            long nowEpochMs,
            long leaseDurationMs,
            int limit,
            String observedAt
        ) {
            this.requestId = requestId;
            this.storeId = storeId;
            this.eventType = eventType;
            this.leaseOwner = leaseOwner;
            this.nowEpochMs = nowEpochMs;
            this.leaseDurationMs = leaseDurationMs;
            this.limit = limit;
            this.observedAt = observedAt;
        }
    }

    public static final class OutboxAcknowledgeRequest {
        public final String requestId;
        public final String eventId;
        public final String leaseOwner;
        public final String acknowledgedAt;

        OutboxAcknowledgeRequest(String requestId, String eventId, String leaseOwner, String acknowledgedAt) {
            this.requestId = requestId;
            this.eventId = eventId;
            this.leaseOwner = leaseOwner;
            this.acknowledgedAt = acknowledgedAt;
        }
    }

    public static final class OutboxReleaseRequest {
        public final String requestId;
        public final String eventId;
        public final String leaseOwner;
        public final String errorCode;

        OutboxReleaseRequest(String requestId, String eventId, String leaseOwner, String errorCode) {
            this.requestId = requestId;
            this.eventId = eventId;
            this.leaseOwner = leaseOwner;
            this.errorCode = errorCode;
        }
    }
}
