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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/**
 * Read-only native projection of Dining state and an explicitly named canonical Order set.
 * Every aggregate is read by one Store Kernel snapshot transaction. This class neither discovers
 * Orders nor owns mutation, receipt, routing, security, or lifecycle policy.
 */
public final class FormalDiningReadProducer {
    public static final String AGGREGATE_TYPE = "MFP_DINING_OPERATIONAL_STATE";
    public static final String SCHEMA = "mfp.dining.operational-state.v1";

    private static final List<String> TABLE_IDS = List.of(
        "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "OUTDOOR"
    );

    public record Revision(String text, Long number) {
        public Revision {
            if ((text == null) == (number == null)) throw invalid();
            if (text != null) requiredText(text);
            if (number != null) safeNonnegative(number);
        }
    }

    public record Waiting(
        String waitingId,
        String displayNumber,
        long partySize,
        String createdAt,
        String customerDisplayName,
        String orderId
    ) { }

    public record Table(
        String tableId,
        String label,
        String location,
        Revision revision,
        String state,
        String orderId,
        String displayNumber,
        Long partySize,
        String seatedAt
    ) { }

    public record Snapshot(
        String storeId,
        long revision,
        List<Waiting> waiting,
        List<Table> tables,
        List<FormalCanonicalOrderReadProducer.CanonicalOrder> orders
    ) {
        public Snapshot {
            waiting = immutable(waiting);
            tables = immutable(tables);
            orders = immutable(orders);
        }
    }

    private final StoreKernelTransactionCoordinator coordinator;
    private final String storeId;

    public FormalDiningReadProducer(
        StoreKernelTransactionCoordinator coordinator,
        String storeId
    ) {
        this.coordinator = Objects.requireNonNull(coordinator, "MFP_DINING_READ_COORDINATOR_REQUIRED");
        this.storeId = requiredText(storeId);
    }

    /**
     * Reads one Dining aggregate plus at most 31 exact canonical Order identities atomically.
     * Returns null only when the Dining aggregate does not exist. Order discovery must come from
     * an approved native canonical index; this method never treats a partial set as complete.
     */
    public CompletableFuture<Snapshot> readSnapshot(List<String> canonicalOrderIds) {
        if (canonicalOrderIds == null) throw invalid("MFP_DINING_ORDER_IDENTITIES_REQUIRED");
        final List<String> orderIds = new ArrayList<>(canonicalOrderIds);
        if (orderIds.size() > StoreKernelContract.MAX_AGGREGATE_SNAPSHOT_KEYS - 1) {
            throw invalid("MFP_DINING_ORDER_IDENTITY_COUNT_INVALID");
        }
        final Set<String> uniqueOrderIds = new LinkedHashSet<>();
        for (String orderId : orderIds) {
            final String accepted = requiredText(orderId);
            if (!uniqueOrderIds.add(accepted)) throw invalid("MFP_DINING_ORDER_IDENTITIES_INVALID");
        }

        final StoreKernelContract.AggregateSnapshotRequest request;
        try {
            final JSONArray keys = new JSONArray().put(new JSONObject()
                .put("aggregateType", AGGREGATE_TYPE)
                .put("aggregateId", storeId));
            for (String orderId : orderIds) {
                keys.put(new JSONObject()
                    .put("aggregateType", FormalCanonicalOrderReadProducer.AGGREGATE_TYPE)
                    .put("aggregateId", orderId));
            }
            request = StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", "MFP-DINING-READ")
                .put("storeId", storeId)
                .put("keys", keys));
        } catch (JSONException impossible) {
            throw new IllegalStateException("MFP_DINING_READ_REQUEST_ENCODING_FAILED", impossible);
        } catch (IllegalArgumentException error) {
            throw invalid("MFP_DINING_READ_IDENTITY_INVALID", error);
        }

        return coordinator.snapshot(request).thenApply(result -> parseSnapshot(result, orderIds));
    }

    private Snapshot parseSnapshot(
        StoreKernelTransactionCoordinator.AggregateSnapshotResult result,
        List<String> orderIds
    ) {
        if (result.items.size() != orderIds.size() + 1) throw invalid();
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem diningItem = result.items.get(0);
        if (!AGGREGATE_TYPE.equals(diningItem.aggregateType)
            || !storeId.equals(diningItem.aggregateId)) {
            throw invalid("MFP_DINING_READBACK_IDENTITY_MISMATCH");
        }
        if (!diningItem.found) return null;

        final List<FormalCanonicalOrderReadProducer.CanonicalOrder> orders = new ArrayList<>();
        for (int index = 0; index < orderIds.size(); index++) {
            final String orderId = orderIds.get(index);
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem item = result.items.get(index + 1);
            if (!FormalCanonicalOrderReadProducer.AGGREGATE_TYPE.equals(item.aggregateType)
                || !orderId.equals(item.aggregateId)) {
                throw invalid("MFP_DINING_READBACK_IDENTITY_MISMATCH");
            }
            if (!item.found) throw invalid("MFP_DINING_ORDER_READBACK_REQUIRED");
            orders.add(FormalCanonicalOrderReadProducer.parse(
                storeId,
                orderId,
                item.revision,
                item.stateJson
            ));
        }
        return parseDining(diningItem.revision, diningItem.stateJson, orders);
    }

    private Snapshot parseDining(
        long kernelRevision,
        String stateJson,
        List<FormalCanonicalOrderReadProducer.CanonicalOrder> orders
    ) {
        safePositive(kernelRevision);
        try {
            final JSONObject state = new JSONObject(stateJson);
            if (!SCHEMA.equals(requiredText(state.opt("schema")))) {
                throw invalid("MFP_DINING_READBACK_SCHEMA_INVALID");
            }
            if (!storeId.equals(requiredText(state.opt("storeId")))) {
                throw invalid("MFP_DINING_READBACK_IDENTITY_MISMATCH");
            }
            if (exactLong(state.opt("revision"), false) != kernelRevision) {
                throw invalid("MFP_DINING_READBACK_REVISION_MISMATCH");
            }

            final List<Waiting> waiting = waiting(requiredArray(state, "waiting"));
            final List<Table> tables = tables(requiredArray(state, "tables"));
            final Set<String> availableOrderIds = new HashSet<>();
            for (FormalCanonicalOrderReadProducer.CanonicalOrder order : orders) {
                if (!availableOrderIds.add(order.orderId())) throw invalid();
            }
            for (Waiting row : waiting) {
                if (row.orderId() != null && !availableOrderIds.contains(row.orderId())) {
                    throw invalid("MFP_DINING_ORDER_READBACK_REQUIRED");
                }
            }
            for (Table table : tables) {
                if (table.orderId() != null && !availableOrderIds.contains(table.orderId())) {
                    throw invalid("MFP_DINING_ORDER_READBACK_REQUIRED");
                }
            }
            return new Snapshot(storeId, kernelRevision, waiting, tables, orders);
        } catch (JSONException | NullPointerException error) {
            throw invalid("MFP_DINING_READBACK_INVALID", error);
        }
    }

    private static List<Waiting> waiting(JSONArray source) throws JSONException {
        final List<Waiting> output = new ArrayList<>();
        final Set<String> ids = new HashSet<>();
        for (int index = 0; index < source.length(); index++) {
            final JSONObject row = source.optJSONObject(index);
            if (row == null) throw invalid();
            final String waitingId = requiredText(row.opt("waitingId"));
            if (!ids.add(waitingId)) throw invalid();
            output.add(new Waiting(
                waitingId,
                requiredText(row.opt("displayNumber")),
                exactLong(row.opt("partySize"), true),
                instant(row.opt("createdAt")),
                optionalText(row, "customerDisplayName"),
                optionalText(row, "orderId")
            ));
        }
        return output;
    }

    private static List<Table> tables(JSONArray source) throws JSONException {
        final List<Table> output = new ArrayList<>();
        final Set<String> ids = new LinkedHashSet<>();
        for (int index = 0; index < source.length(); index++) {
            final JSONObject row = source.optJSONObject(index);
            if (row == null) throw invalid();
            final String tableId = requiredText(row.opt("tableId"));
            if (!ids.add(tableId)) throw invalid();
            final String expectedLocation = "OUTDOOR".equals(tableId) ? "OUTDOOR" : "INDOOR";
            final String location = requiredText(row.opt("location"));
            if (!expectedLocation.equals(location)) throw invalid();
            final String state = requiredText(row.opt("state"));
            final String orderId = optionalText(row, "orderId");
            final String displayNumber = optionalText(row, "displayNumber");
            final Long partySize = optionalLong(row, "partySize", true);
            final String seatedAt = optionalInstant(row, "seatedAt");
            if ("AVAILABLE".equals(state)) {
                if (orderId != null || displayNumber != null || partySize != null || seatedAt != null) {
                    throw invalid();
                }
            } else if (!"OCCUPIED".equals(state) || orderId == null || seatedAt == null) {
                throw invalid();
            }
            output.add(new Table(
                tableId,
                requiredText(row.opt("label")),
                location,
                revision(row.opt("revision")),
                state,
                orderId,
                displayNumber,
                partySize,
                seatedAt
            ));
        }
        if (!ids.equals(new LinkedHashSet<>(TABLE_IDS))) throw invalid("MFP_DINING_TABLE_REGISTRY_INVALID");
        return output;
    }

    private static Revision revision(Object raw) {
        if (raw instanceof String) return new Revision(requiredText(raw), null);
        return new Revision(null, exactLong(raw, false));
    }

    private static JSONArray requiredArray(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (!(raw instanceof JSONArray)) throw invalid();
        return (JSONArray) raw;
    }

    private static String optionalText(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (raw == null || raw == JSONObject.NULL) return null;
        return requiredText(raw);
    }

    private static String requiredText(Object raw) {
        if (!(raw instanceof String)) throw invalid();
        final String value = (String) raw;
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > 240) throw invalid();
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw invalid();
        }
        return value;
    }

    private static String instant(Object raw) {
        final String value = requiredText(raw);
        try {
            Instant.parse(value);
            return value;
        } catch (DateTimeParseException error) {
            throw invalid("MFP_DINING_READBACK_INVALID", error);
        }
    }

    private static String optionalInstant(JSONObject value, String field) {
        final Object raw = value.opt(field);
        return raw == null || raw == JSONObject.NULL ? null : instant(raw);
    }

    private static long exactLong(Object raw, boolean positive) {
        if (!(raw instanceof Number)) throw invalid();
        try {
            final long value = new BigDecimal(raw.toString()).longValueExact();
            if (positive) safePositive(value);
            else safeNonnegative(value);
            return value;
        } catch (ArithmeticException | NumberFormatException error) {
            throw invalid("MFP_DINING_READBACK_INVALID", error);
        }
    }

    private static Long optionalLong(JSONObject value, String field, boolean positive) {
        final Object raw = value.opt(field);
        return raw == null || raw == JSONObject.NULL ? null : exactLong(raw, positive);
    }

    private static long safePositive(long value) {
        if (value < 1 || value > FormalCheckoutRecords.MAX_SAFE_INTEGER) throw invalid();
        return value;
    }

    private static long safeNonnegative(long value) {
        if (value < 0 || value > FormalCheckoutRecords.MAX_SAFE_INTEGER) throw invalid();
        return value;
    }

    private static <T> List<T> immutable(List<T> input) {
        if (input == null) throw invalid();
        return Collections.unmodifiableList(new ArrayList<>(input));
    }

    private static IllegalArgumentException invalid() {
        return invalid("MFP_DINING_READBACK_INVALID");
    }

    private static IllegalArgumentException invalid(String code) {
        return new IllegalArgumentException(code);
    }

    private static IllegalArgumentException invalid(String code, Throwable cause) {
        if (cause instanceof IllegalArgumentException && code.equals(cause.getMessage())) {
            return (IllegalArgumentException) cause;
        }
        return new IllegalArgumentException(code, cause);
    }
}
