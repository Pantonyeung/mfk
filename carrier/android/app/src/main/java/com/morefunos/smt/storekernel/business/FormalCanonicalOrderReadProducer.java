package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/**
 * Read-only native projection of one canonical Store Kernel Order.
 * It neither enumerates Orders nor owns Dining state or mutations.
 */
public final class FormalCanonicalOrderReadProducer {
    public static final String AGGREGATE_TYPE = "ORDER";
    public static final String SCHEMA = "mfp.canonical-order.v1";

    public record Revision(String text, Long number) {
        public Revision {
            if ((text == null) == (number == null)) throw invalid("MFP_ORDER_READBACK_INVALID");
            if (text != null) requiredText(text);
            if (number != null) safeNonnegative(number);
        }
    }

    public record Item(
        String lineId,
        String productId,
        String name,
        long quantity,
        Long settledQuantity,
        long unitMinor,
        List<String> options,
        String combo,
        String note
    ) {
        public Item {
            options = options == null ? null : immutable(options);
        }
    }

    public record Adjustment(
        String adjustmentId,
        String type,
        String status,
        Long amountMinor,
        String tenderId,
        String originalReportId,
        String cashMovementRef,
        String occurredAt
    ) { }

    public record Dining(String waitingId, String tableId, long partySize, String seatedAt) { }
    public record Eta(Revision policyRevision, long minutes, String readyAt) { }

    /** Exact immutable shape consumed by the retained MfpCanonicalOrder contract. */
    public record CanonicalOrder(
        String orderId,
        String displayNumber,
        String source,
        String externalOrderNumber,
        String customerDisplayName,
        String pickupCode,
        String createdAt,
        long revision,
        String lifecycleState,
        String fulfillmentState,
        String effectiveTenderId,
        List<String> tenderAudit,
        long recognizedAmountMinor,
        long outstandingAmountMinor,
        Long refundableAmountMinor,
        String serviceMode,
        List<Item> items,
        List<Adjustment> adjustments,
        Dining dining,
        Eta eta,
        String modificationState,
        Boolean productionDispatched,
        String cancelNoticeIntent,
        Boolean humanCommunicationRequired,
        Boolean correctionPrintIntent
    ) {
        public CanonicalOrder {
            tenderAudit = tenderAudit == null ? null : immutable(tenderAudit);
            items = immutable(items);
            adjustments = immutable(adjustments);
        }
    }

    private final StoreKernelTransactionCoordinator coordinator;
    private final String storeId;

    public FormalCanonicalOrderReadProducer(
        StoreKernelTransactionCoordinator coordinator,
        String storeId
    ) {
        this.coordinator = Objects.requireNonNull(coordinator, "MFP_ORDER_READ_COORDINATOR_REQUIRED");
        this.storeId = requiredText(storeId);
    }

    /** Returns null only when the canonical Order aggregate does not exist. */
    public CompletableFuture<CanonicalOrder> readOrder(String orderId) {
        final String acceptedOrderId = requiredText(orderId);
        final StoreKernelContract.AggregateSnapshotRequest request;
        try {
            request = StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", "MFP-ORDER-READ")
                .put("storeId", storeId)
                .put("keys", new JSONArray().put(new JSONObject()
                    .put("aggregateType", AGGREGATE_TYPE)
                    .put("aggregateId", acceptedOrderId))));
        } catch (JSONException impossible) {
            throw new IllegalStateException("MFP_ORDER_READ_REQUEST_ENCODING_FAILED", impossible);
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("MFP_ORDER_READ_IDENTITY_INVALID", invalid);
        }
        return coordinator.snapshot(request).thenApply(result -> {
            if (result.items.size() != 1) throw invalid("MFP_ORDER_READBACK_INVALID");
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem item = result.items.get(0);
            if (!AGGREGATE_TYPE.equals(item.aggregateType)
                || !acceptedOrderId.equals(item.aggregateId)) {
                throw invalid("MFP_ORDER_READBACK_IDENTITY_MISMATCH");
            }
            if (!item.found) return null;
            return parse(storeId, acceptedOrderId, item.revision, item.stateJson);
        });
    }

    static CanonicalOrder parse(
        String expectedStoreId,
        String expectedOrderId,
        long kernelRevision,
        String stateJson
    ) {
        safePositive(kernelRevision);
        try {
            final JSONObject state = new JSONObject(stateJson);
            if (!SCHEMA.equals(requiredText(state.opt("schema")))) {
                throw invalid("MFP_ORDER_READBACK_SCHEMA_INVALID");
            }
            if (!requiredText(expectedStoreId).equals(requiredText(state.opt("storeId")))) {
                throw invalid("MFP_ORDER_READBACK_IDENTITY_MISMATCH");
            }
            final String orderId = requiredText(state.opt("orderId"));
            if (!requiredText(expectedOrderId).equals(orderId)) {
                throw invalid("MFP_ORDER_READBACK_IDENTITY_MISMATCH");
            }
            if (exactLong(state.opt("revision"), false) != kernelRevision) {
                throw invalid("MFP_ORDER_READBACK_REVISION_MISMATCH");
            }

            final String lifecycle = optionalText(state, "lifecycleState");
            if (lifecycle != null && !Set.of("ACTIVE", "COMPLETED", "CANCELLED").contains(lifecycle)) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }
            final String fulfillment = requiredText(state.opt("fulfillmentState"));
            if (!Set.of("IN_PROGRESS", "READY", "PICKED_UP", "CANCELLED").contains(fulfillment)) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }
            final String serviceMode = requiredText(state.opt("serviceMode"));
            if (!Set.of("TAKEAWAY", "DINE_IN").contains(serviceMode)) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }

            final JSONObject sourceIdentity = optionalObject(state, "sourceIdentity");
            final List<Item> items = items(requiredArray(state, "items"));
            if (items.isEmpty()) throw invalid("MFP_ORDER_READBACK_INVALID");

            final String modificationState = optionalText(state, "modificationState");
            if (modificationState != null
                && !Set.of("NONE", "CUSTOMER_CONFIRMATION_REQUIRED", "CONFIRMED", "REJECTED")
                    .contains(modificationState)) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }
            final String cancelNoticeIntent = optionalText(state, "cancelNoticeIntent");
            if (cancelNoticeIntent != null
                && !Set.of("NOT_REQUIRED", "CANCEL_NOTICE_REQUIRED").contains(cancelNoticeIntent)) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }
            final Boolean correctionPrintIntent = optionalBoolean(state, "correctionPrintIntent");
            if (Boolean.TRUE.equals(correctionPrintIntent)) throw invalid("MFP_ORDER_READBACK_INVALID");

            return new CanonicalOrder(
                orderId,
                requiredText(state.opt("displayNumber")),
                requiredText(state.opt("source")),
                aliasedText(state, "externalOrderNumber", sourceIdentity, "externalOrderNo"),
                optionalText(state, "customerDisplayName"),
                aliasedText(state, "pickupCode", sourceIdentity, "pickupCode"),
                instant(state.opt("createdAt")),
                kernelRevision,
                lifecycle,
                fulfillment,
                requiredText(state.opt("effectiveTenderId")),
                optionalStrings(state, "tenderAudit"),
                exactLong(state.opt("recognizedAmountMinor"), false),
                exactLong(state.opt("outstandingAmountMinor"), false),
                optionalLong(state, "refundableAmountMinor", false),
                serviceMode,
                items,
                adjustments(requiredArray(state, "adjustments")),
                dining(optionalObject(state, "dining")),
                eta(optionalObject(state, "eta")),
                modificationState,
                optionalBoolean(state, "productionDispatched"),
                cancelNoticeIntent,
                optionalBoolean(state, "humanCommunicationRequired"),
                correctionPrintIntent
            );
        } catch (JSONException | NullPointerException error) {
            throw invalid("MFP_ORDER_READBACK_INVALID", error);
        }
    }

    private static List<Item> items(JSONArray input) throws JSONException {
        final List<Item> output = new ArrayList<>();
        final Set<String> lineIds = new HashSet<>();
        for (int index = 0; index < input.length(); index++) {
            final JSONObject item = input.optJSONObject(index);
            if (item == null) throw invalid("MFP_ORDER_READBACK_INVALID");
            final String lineId = requiredText(item.opt("lineId"));
            if (!lineIds.add(lineId)) throw invalid("MFP_ORDER_READBACK_INVALID");
            final long quantity = exactLong(item.opt("quantity"), true);
            final Long settled = optionalLong(item, "settledQuantity", false);
            if (settled != null && settled > quantity) throw invalid("MFP_ORDER_READBACK_INVALID");
            output.add(new Item(
                lineId,
                optionalText(item, "productId"),
                requiredText(item.opt("name")),
                quantity,
                settled,
                exactLong(item.opt("unitMinor"), false),
                optionalStrings(item, "options"),
                optionalText(item, "combo"),
                optionalText(item, "note")
            ));
        }
        return output;
    }

    private static List<Adjustment> adjustments(JSONArray input) throws JSONException {
        final List<Adjustment> output = new ArrayList<>();
        final Set<String> ids = new HashSet<>();
        for (int index = 0; index < input.length(); index++) {
            final JSONObject value = input.optJSONObject(index);
            if (value == null) throw invalid("MFP_ORDER_READBACK_INVALID");
            final String adjustmentId = requiredText(value.opt("adjustmentId"));
            if (!ids.add(adjustmentId)) throw invalid("MFP_ORDER_READBACK_INVALID");
            final String type = requiredText(value.opt("type"));
            final String status = requiredText(value.opt("status"));
            if (!Set.of("PAYMENT_CORRECTION", "REFUND", "MODIFICATION").contains(type)
                || !Set.of("PENDING", "COMMITTED", "REJECTED").contains(status)) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }
            output.add(new Adjustment(
                adjustmentId,
                type,
                status,
                optionalLong(value, "amountMinor", false),
                optionalText(value, "tenderId"),
                optionalText(value, "originalReportId"),
                optionalText(value, "cashMovementRef"),
                instant(value.opt("occurredAt"))
            ));
        }
        return output;
    }

    private static Dining dining(JSONObject value) {
        if (value == null) return null;
        return new Dining(
            optionalText(value, "waitingId"),
            optionalText(value, "tableId"),
            exactLong(value.opt("partySize"), true),
            optionalInstant(value, "seatedAt")
        );
    }

    private static Eta eta(JSONObject value) {
        if (value == null) return null;
        return new Eta(
            revision(value.opt("policyRevision")),
            exactLong(value.opt("minutes"), true),
            instant(value.opt("readyAt"))
        );
    }

    private static Revision revision(Object raw) {
        if (raw instanceof String) return new Revision(requiredText(raw), null);
        return new Revision(null, exactLong(raw, false));
    }

    private static JSONArray requiredArray(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (!(raw instanceof JSONArray)) throw invalid("MFP_ORDER_READBACK_INVALID");
        return (JSONArray) raw;
    }

    private static JSONObject optionalObject(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (raw == null || raw == JSONObject.NULL) return null;
        if (!(raw instanceof JSONObject)) throw invalid("MFP_ORDER_READBACK_INVALID");
        return (JSONObject) raw;
    }

    private static String aliasedText(
        JSONObject primary,
        String primaryField,
        JSONObject fallback,
        String fallbackField
    ) {
        final String first = optionalText(primary, primaryField);
        final String second = fallback == null ? null : optionalText(fallback, fallbackField);
        if (first != null && second != null && !first.equals(second)) {
            throw invalid("MFP_ORDER_READBACK_INVALID");
        }
        return first == null ? second : first;
    }

    private static String optionalText(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (raw == null || raw == JSONObject.NULL) return null;
        return requiredText(raw);
    }

    private static String requiredText(Object raw) {
        if (!(raw instanceof String)) throw invalid("MFP_ORDER_READBACK_INVALID");
        final String value = (String) raw;
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > 240) {
            throw invalid("MFP_ORDER_READBACK_INVALID");
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) {
                throw invalid("MFP_ORDER_READBACK_INVALID");
            }
        }
        return value;
    }

    private static String instant(Object raw) {
        final String value = requiredText(raw);
        try {
            Instant.parse(value);
            return value;
        } catch (DateTimeParseException error) {
            throw invalid("MFP_ORDER_READBACK_INVALID", error);
        }
    }

    private static String optionalInstant(JSONObject value, String field) {
        final Object raw = value.opt(field);
        return raw == null || raw == JSONObject.NULL ? null : instant(raw);
    }

    private static long exactLong(Object raw, boolean positive) {
        if (!(raw instanceof Number)) throw invalid("MFP_ORDER_READBACK_INVALID");
        try {
            final long value = new BigDecimal(raw.toString()).longValueExact();
            if (positive) safePositive(value);
            else safeNonnegative(value);
            return value;
        } catch (ArithmeticException error) {
            throw invalid("MFP_ORDER_READBACK_INVALID", error);
        }
    }

    private static Long optionalLong(JSONObject value, String field, boolean positive) {
        final Object raw = value.opt(field);
        return raw == null || raw == JSONObject.NULL ? null : exactLong(raw, positive);
    }

    private static Boolean optionalBoolean(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (raw == null || raw == JSONObject.NULL) return null;
        if (!(raw instanceof Boolean)) throw invalid("MFP_ORDER_READBACK_INVALID");
        return (Boolean) raw;
    }

    private static List<String> optionalStrings(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (raw == null || raw == JSONObject.NULL) return null;
        if (!(raw instanceof JSONArray)) throw invalid("MFP_ORDER_READBACK_INVALID");
        final JSONArray array = (JSONArray) raw;
        final List<String> output = new ArrayList<>();
        for (int index = 0; index < array.length(); index++) {
            output.add(requiredText(array.opt(index)));
        }
        return output;
    }

    private static long safePositive(long value) {
        if (value < 1 || value > FormalCheckoutRecords.MAX_SAFE_INTEGER) {
            throw invalid("MFP_ORDER_READBACK_INVALID");
        }
        return value;
    }

    private static long safeNonnegative(long value) {
        if (value < 0 || value > FormalCheckoutRecords.MAX_SAFE_INTEGER) {
            throw invalid("MFP_ORDER_READBACK_INVALID");
        }
        return value;
    }

    private static <T> List<T> immutable(List<T> input) {
        if (input == null) throw invalid("MFP_ORDER_READBACK_INVALID");
        return Collections.unmodifiableList(new ArrayList<>(input));
    }

    private static IllegalArgumentException invalid(String code) {
        return new IllegalArgumentException(code);
    }

    private static IllegalArgumentException invalid(String code, Throwable cause) {
        if (cause instanceof IllegalArgumentException
            && code.equals(cause.getMessage())) return (IllegalArgumentException) cause;
        return new IllegalArgumentException(code, cause);
    }
}
