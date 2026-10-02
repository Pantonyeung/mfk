package com.morefunos.smt.storekernel.business;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public final class FormalBusinessCommandContract {
    public static final int PROTOCOL_VERSION = 1;
    public static final int MAX_MESSAGE_BYTES = 262_144;
    public static final String COMMAND = "mfp.store-kernel.command.v1";
    public static final String SUBMISSION_READ = "mfp.store-kernel.submission.read.v1";
    public static final String RESULT = "mfp.store-kernel.submission.result.v1";
    public static final String PRICING_DEPENDENCY_MISSING = "FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING";
    public static final String TENDER_DEPENDENCY_MISSING = "FORMAL_TENDER_AUTHORITY_DEPENDENCY_MISSING";

    private static final Pattern STABLE_CODE = Pattern.compile("^[A-Z0-9_:-]{1,160}$");
    private static final Set<String> FORBIDDEN_AGGREGATE_FIELDS;
    private static final Set<String> COMMAND_FIELDS;
    private static final Set<String> READ_FIELDS;
    private static final Map<String, String> COMMAND_DEPENDENCIES;

    static {
        final Set<String> forbidden = new LinkedHashSet<>();
        Collections.addAll(forbidden,
            "aggregateType", "aggregateId", "mutations", "stateJson", "canonicalState",
            "aggregateState", "orderState", "paymentState", "finalState",
            "canonicalAggregateState", "canonicalOrderState", "canonicalPaymentState",
            "finalCanonicalAggregateState", "outbox", "inbox"
        );
        FORBIDDEN_AGGREGATE_FIELDS = Collections.unmodifiableSet(forbidden);

        final Set<String> commandFields = new LinkedHashSet<>();
        Collections.addAll(commandFields,
            "protocolVersion", "type", "schema", "requestId", "storeId", "deviceId",
            "staffSessionRef", "submissionId", "idempotencyKey", "commandType",
            "expectedRevision", "payload", "createdAt"
        );
        COMMAND_FIELDS = Collections.unmodifiableSet(commandFields);

        final Set<String> readFields = new LinkedHashSet<>();
        Collections.addAll(readFields,
            "protocolVersion", "type", "requestId", "storeId", "deviceId",
            "staffSessionRef", "submissionId"
        );
        READ_FIELDS = Collections.unmodifiableSet(readFields);

        final Map<String, String> commands = new LinkedHashMap<>();
        commands.put("CHECKOUT_PAYMENT_CONFIRM", PRICING_DEPENDENCY_MISSING);
        commands.put("ORDER_FULFILLMENT_SET", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("ORDER_MODIFICATION_REQUEST", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("ORDER_PAYMENT_CORRECTION", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("ORDER_REFUND", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("ORDER_CANCEL", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("DINING_FORMAL_ADMIT", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("DINING_WAITING_CREATE", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("DINING_TABLE_ASSIGN", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("DINING_TABLE_TRANSFER", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("DINING_ITEMS_ADD", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("RUNTIME_AVAILABILITY_SET", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("CAPACITY_POOL_CORRECT", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("CAPACITY_OVERRIDE_CREATE", "MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING");
        commands.put("CUSTOMER_NEW_ORDER_ACCEPTANCE_SET", "MFP_CUSTOMER_PRODUCTION_BINDING_MISSING");
        commands.put("ORDER_MODIFICATION_CUSTOMER_DECISION", "MFP_CUSTOMER_PRODUCTION_BINDING_MISSING");
        commands.put("EXTERNAL_KEETA_LIFECYCLE_APPLY", "MFP_KEETA_PRODUCTION_BINDING_MISSING");
        commands.put("EXTERNAL_CUSTOMER_ORDER_ADMIT", "MFP_CUSTOMER_PRODUCTION_BINDING_MISSING");
        commands.put("EXTERNAL_KEETA_ORDER_ADMIT", "MFP_KEETA_PRODUCTION_BINDING_MISSING");
        COMMAND_DEPENDENCIES = Collections.unmodifiableMap(commands);
    }

    private FormalBusinessCommandContract() { }

    public static boolean isFormalType(String type) {
        return COMMAND.equals(type) || SUBMISSION_READ.equals(type);
    }

    public static Set<String> commandTypes() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(COMMAND_DEPENDENCIES.keySet()));
    }

    static String dependencyCode(String commandType) {
        return COMMAND_DEPENDENCIES.get(commandType);
    }

    public static CommandEnvelope parseCommand(String rawMessage) throws JSONException {
        final JSONObject request = parseEnvelope(rawMessage);
        rejectAggregateInjection(request);
        requireExactFields(request, COMMAND_FIELDS, "FORMAL_COMMAND_FIELD_UNSUPPORTED");
        requireProtocolAndType(request, COMMAND);
        if (!COMMAND.equals(requiredIdentifier(request, "schema", "FORMAL_COMMAND_SCHEMA_INVALID"))) {
            throw new IllegalArgumentException("FORMAL_COMMAND_SCHEMA_INVALID");
        }
        final String commandType = requiredIdentifier(request, "commandType", "FORMAL_COMMAND_TYPE_INVALID");
        if (!COMMAND_DEPENDENCIES.containsKey(commandType)) throw new IllegalArgumentException("FORMAL_COMMAND_TYPE_UNSUPPORTED");
        final Object expectedRevision = expectedRevision(request.opt("expectedRevision"));
        final JSONObject payload = request.optJSONObject("payload");
        if (payload == null) throw new IllegalArgumentException("FORMAL_COMMAND_PAYLOAD_INVALID");
        final String createdAt = requiredIdentifier(request, "createdAt", "FORMAL_COMMAND_CREATED_AT_INVALID");
        try { Instant.parse(createdAt); }
        catch (DateTimeParseException error) { throw new IllegalArgumentException("FORMAL_COMMAND_CREATED_AT_INVALID"); }
        return new CommandEnvelope(
            requiredIdentifier(request, "requestId", "FORMAL_COMMAND_REQUEST_ID_INVALID"),
            requiredIdentifier(request, "storeId", "FORMAL_COMMAND_STORE_ID_INVALID"),
            requiredIdentifier(request, "deviceId", "FORMAL_COMMAND_DEVICE_ID_INVALID"),
            requiredIdentifier(request, "staffSessionRef", "FORMAL_COMMAND_STAFF_SESSION_INVALID"),
            requiredIdentifier(request, "submissionId", "FORMAL_COMMAND_SUBMISSION_ID_INVALID"),
            requiredIdentifier(request, "idempotencyKey", "FORMAL_COMMAND_IDEMPOTENCY_KEY_INVALID"),
            commandType,
            expectedRevision,
            new JSONObject(payload.toString()),
            createdAt,
            fingerprint(request)
        );
    }

    public static SubmissionReadRequest parseSubmissionRead(String rawMessage) throws JSONException {
        final JSONObject request = parseEnvelope(rawMessage);
        rejectAggregateInjection(request);
        requireExactFields(request, READ_FIELDS, "FORMAL_SUBMISSION_READ_FIELD_UNSUPPORTED");
        requireProtocolAndType(request, SUBMISSION_READ);
        return new SubmissionReadRequest(
            requiredIdentifier(request, "requestId", "FORMAL_SUBMISSION_READ_REQUEST_ID_INVALID"),
            requiredIdentifier(request, "storeId", "FORMAL_SUBMISSION_READ_STORE_ID_INVALID"),
            requiredIdentifier(request, "deviceId", "FORMAL_SUBMISSION_READ_DEVICE_ID_INVALID"),
            requiredIdentifier(request, "staffSessionRef", "FORMAL_SUBMISSION_READ_STAFF_SESSION_INVALID"),
            requiredIdentifier(request, "submissionId", "FORMAL_SUBMISSION_READ_SUBMISSION_ID_INVALID")
        );
    }

    private static JSONObject parseEnvelope(String rawMessage) throws JSONException {
        if (rawMessage == null || rawMessage.trim().isEmpty()) throw new IllegalArgumentException("FORMAL_COMMAND_MESSAGE_REQUIRED");
        if (rawMessage.getBytes(StandardCharsets.UTF_8).length > MAX_MESSAGE_BYTES) {
            throw new IllegalArgumentException("FORMAL_COMMAND_MESSAGE_TOO_LARGE");
        }
        return new JSONObject(rawMessage);
    }

    private static void requireProtocolAndType(JSONObject request, String type) {
        if (requiredLong(request, "protocolVersion", "FORMAL_COMMAND_PROTOCOL_INVALID") != PROTOCOL_VERSION) {
            throw new IllegalArgumentException("FORMAL_COMMAND_PROTOCOL_UNSUPPORTED");
        }
        if (!type.equals(requiredIdentifier(request, "type", "FORMAL_COMMAND_TYPE_INVALID"))) {
            throw new IllegalArgumentException("FORMAL_BUSINESS_OPERATION_UNSUPPORTED");
        }
    }

    private static void requireExactFields(JSONObject value, Set<String> expected, String code) {
        final Iterator<String> keys = value.keys();
        while (keys.hasNext()) if (!expected.contains(keys.next())) throw new IllegalArgumentException(code);
        for (String field : expected) if (!value.has(field)) throw new IllegalArgumentException(fieldCode(field));
    }

    private static String fieldCode(String field) {
        return "FORMAL_COMMAND_" + field.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase(Locale.ROOT) + "_INVALID";
    }

    private static void rejectAggregateInjection(Object value) throws JSONException {
        if (value instanceof JSONObject) {
            final JSONObject object = (JSONObject) value;
            final Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                final String key = keys.next();
                if (FORBIDDEN_AGGREGATE_FIELDS.contains(key)) throw new IllegalArgumentException("FORMAL_AGGREGATE_INJECTION_REJECTED");
                rejectAggregateInjection(object.opt(key));
            }
        } else if (value instanceof JSONArray) {
            final JSONArray array = (JSONArray) value;
            for (int index = 0; index < array.length(); index++) rejectAggregateInjection(array.opt(index));
        }
    }

    private static String requiredIdentifier(JSONObject value, String name, String code) {
        final Object raw = value.opt(name);
        if (!(raw instanceof String)) throw new IllegalArgumentException(code);
        final String text = (String) raw;
        if (text.isEmpty() || !text.equals(text.trim()) || text.length() > 160) throw new IllegalArgumentException(code);
        for (int index = 0; index < text.length(); index++) if (Character.isISOControl(text.charAt(index))) throw new IllegalArgumentException(code);
        return text;
    }

    private static long requiredLong(JSONObject value, String name, String code) {
        final Object raw = value.opt(name);
        if (!(raw instanceof Number)) throw new IllegalArgumentException(code);
        try {
            return new BigDecimal(raw.toString()).longValueExact();
        } catch (ArithmeticException | NumberFormatException error) {
            throw new IllegalArgumentException(code);
        }
    }

    private static Object expectedRevision(Object raw) {
        if (raw == null || raw == JSONObject.NULL) return null;
        if (raw instanceof String) {
            final String value = (String) raw;
            if (!value.isEmpty() && value.equals(value.trim()) && value.length() <= 240) return value;
        } else if (raw instanceof Number) {
            try {
                final long value = new BigDecimal(raw.toString()).longValueExact();
                if (value >= 0) return value;
            } catch (ArithmeticException | NumberFormatException ignored) { }
        }
        throw new IllegalArgumentException("FORMAL_COMMAND_EXPECTED_REVISION_INVALID");
    }

    private static String fingerprint(JSONObject request) throws JSONException {
        final JSONObject material = new JSONObject();
        for (String field : new String[] {
            "schema", "storeId", "deviceId", "staffSessionRef", "submissionId",
            "idempotencyKey", "commandType", "expectedRevision", "payload"
        }) material.put(field, request.opt(field));
        return sha256(canonicalJson(material));
    }

    private static String canonicalJson(Object value) throws JSONException {
        if (value == null || value == JSONObject.NULL) return "null";
        if (value instanceof String) return JSONObject.quote((String) value);
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Number) return JSONObject.numberToString((Number) value);
        if (value instanceof JSONArray) {
            final JSONArray array = (JSONArray) value;
            final List<String> items = new ArrayList<>();
            for (int index = 0; index < array.length(); index++) items.add(canonicalJson(array.opt(index)));
            return "[" + join(items) + "]";
        }
        if (value instanceof JSONObject) {
            final JSONObject object = (JSONObject) value;
            final List<String> keys = new ArrayList<>();
            final Iterator<String> iterator = object.keys();
            while (iterator.hasNext()) keys.add(iterator.next());
            Collections.sort(keys);
            final List<String> fields = new ArrayList<>();
            for (String key : keys) fields.add(JSONObject.quote(key) + ":" + canonicalJson(object.opt(key)));
            return "{" + join(fields) + "}";
        }
        throw new IllegalArgumentException("FORMAL_COMMAND_PAYLOAD_INVALID");
    }

    private static String join(List<String> values) {
        final StringBuilder result = new StringBuilder();
        for (int index = 0; index < values.size(); index++) {
            if (index > 0) result.append(',');
            result.append(values.get(index));
        }
        return result.toString();
    }

    private static String sha256(String value) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            final StringBuilder result = new StringBuilder(64);
            for (byte item : digest) result.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("FORMAL_COMMAND_SHA256_UNAVAILABLE", impossible);
        }
    }

    public static final class CommandEnvelope {
        public final String requestId;
        public final String storeId;
        public final String deviceId;
        public final String staffSessionRef;
        public final String submissionId;
        public final String idempotencyKey;
        public final String commandType;
        public final Object expectedRevision;
        public final JSONObject payload;
        public final String createdAt;
        public final String requestFingerprint;

        CommandEnvelope(String requestId, String storeId, String deviceId, String staffSessionRef, String submissionId,
                        String idempotencyKey, String commandType, Object expectedRevision, JSONObject payload,
                        String createdAt, String requestFingerprint) {
            this.requestId = requestId;
            this.storeId = storeId;
            this.deviceId = deviceId;
            this.staffSessionRef = staffSessionRef;
            this.submissionId = submissionId;
            this.idempotencyKey = idempotencyKey;
            this.commandType = commandType;
            this.expectedRevision = expectedRevision;
            this.payload = payload;
            this.createdAt = createdAt;
            this.requestFingerprint = requestFingerprint;
        }
    }

    public static final class SubmissionReadRequest {
        public final String requestId;
        public final String storeId;
        public final String deviceId;
        public final String staffSessionRef;
        public final String submissionId;

        SubmissionReadRequest(String requestId, String storeId, String deviceId, String staffSessionRef, String submissionId) {
            this.requestId = requestId;
            this.storeId = storeId;
            this.deviceId = deviceId;
            this.staffSessionRef = staffSessionRef;
            this.submissionId = submissionId;
        }
    }

    public static final class Result {
        public final String submissionId;
        public final String state;
        public final String commitId;
        public final Object canonicalRevision;
        public final String orderRef;
        public final String rejectionCode;
        public final boolean readbackRequired;
        public final boolean retryPermitted;

        private Result(String submissionId, String state, String commitId, Object canonicalRevision, String orderRef,
                       String rejectionCode, boolean readbackRequired, boolean retryPermitted) {
            this.submissionId = submissionId;
            this.state = state;
            this.commitId = commitId;
            this.canonicalRevision = canonicalRevision;
            this.orderRef = orderRef;
            this.rejectionCode = rejectionCode;
            this.readbackRequired = readbackRequired;
            this.retryPermitted = retryPermitted;
        }

        public static Result committed(String submissionId, String commitId, Object canonicalRevision, String orderRef) {
            requireText(submissionId, "FORMAL_RESULT_SUBMISSION_ID_INVALID");
            requireText(commitId, "FORMAL_RESULT_COMMIT_ID_INVALID");
            if (!(canonicalRevision instanceof String) && !(canonicalRevision instanceof Number)) {
                throw new IllegalArgumentException("FORMAL_RESULT_CANONICAL_REVISION_INVALID");
            }
            if (orderRef != null) requireText(orderRef, "FORMAL_RESULT_ORDER_REF_INVALID");
            return new Result(submissionId, "COMMITTED", commitId, canonicalRevision, orderRef, null, false, false);
        }

        public static Result rejected(String submissionId, String rejectionCode) {
            requireText(submissionId, "FORMAL_RESULT_SUBMISSION_ID_INVALID");
            if (rejectionCode == null || !STABLE_CODE.matcher(rejectionCode).matches()) {
                throw new IllegalArgumentException("FORMAL_RESULT_REJECTION_CODE_INVALID");
            }
            return new Result(submissionId, "REJECTED", null, null, null, rejectionCode, false, false);
        }

        public static Result unknown(String submissionId) {
            requireText(submissionId, "FORMAL_RESULT_SUBMISSION_ID_INVALID");
            return new Result(submissionId, "UNKNOWN", null, null, null, null, true, false);
        }

        public static Result fromStoredJson(String raw) throws JSONException {
            final Object parsed = new JSONTokener(raw).nextValue();
            if (!(parsed instanceof JSONObject)) throw new IllegalArgumentException("FORMAL_RESULT_INVALID");
            final JSONObject value = (JSONObject) parsed;
            if (!RESULT.equals(value.optString("schema", ""))) throw new IllegalArgumentException("FORMAL_RESULT_SCHEMA_INVALID");
            final String submissionId = requireText(value.optString("submissionId", ""), "FORMAL_RESULT_SUBMISSION_ID_INVALID");
            final String state = value.optString("state", "");
            if ("COMMITTED".equals(state)) return committed(
                submissionId,
                value.optString("commitId", ""),
                expectedRevision(value.opt("canonicalRevision")),
                value.has("orderRef") ? value.optString("orderRef", "") : null
            );
            if ("REJECTED".equals(state)) return rejected(submissionId, value.optString("rejectionCode", ""));
            if ("UNKNOWN".equals(state) && value.optBoolean("readbackRequired", false) && !value.optBoolean("retryPermitted", true)) {
                return unknown(submissionId);
            }
            throw new IllegalArgumentException("FORMAL_RESULT_STATE_INVALID");
        }

        public String toStoredJson() {
            try {
                final JSONObject value = new JSONObject();
                value.put("schema", RESULT);
                value.put("submissionId", submissionId);
                value.put("state", state);
                if ("COMMITTED".equals(state)) {
                    value.put("commitId", commitId);
                    value.put("canonicalRevision", canonicalRevision);
                    if (orderRef != null) value.put("orderRef", orderRef);
                } else if ("REJECTED".equals(state)) {
                    value.put("rejectionCode", rejectionCode);
                } else {
                    value.put("readbackRequired", true);
                    value.put("retryPermitted", false);
                }
                return value.toString();
            } catch (JSONException impossible) {
                throw new IllegalStateException("FORMAL_RESULT_ENCODING_FAILED", impossible);
            }
        }

        public JSONObject toJson(String requestId) throws JSONException {
            final JSONObject value = new JSONObject(toStoredJson());
            value.put("protocolVersion", PROTOCOL_VERSION);
            value.put("type", RESULT);
            value.put("requestId", requestId);
            return value;
        }

        private static String requireText(String value, String code) {
            if (value == null || value.isEmpty() || !value.equals(value.trim()) || value.length() > 160) {
                throw new IllegalArgumentException(code);
            }
            return value;
        }
    }
}
