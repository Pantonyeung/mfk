package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler.PricingSnapshot;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler.TenderSnapshot;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SettlementEvidenceMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Tender;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.TenderKind;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/** Fresh Room-backed POS tender eligibility and staff-observation mapper. */
public final class FormalCheckoutRoomTenderProducer
    implements FormalCheckoutPaymentConfirmHandler.TenderPort {
    public static final String AGGREGATE_TYPE = FormalQuoteRoomProducer.TENDER_AGGREGATE_TYPE;
    public static final String SCHEMA = FormalQuoteRoomProducer.TENDER_SCHEMA;

    private final StoreKernelTransactionCoordinator coordinator;

    public FormalCheckoutRoomTenderProducer(StoreKernelTransactionCoordinator coordinator) {
        this.coordinator = Objects.requireNonNull(coordinator, "FORMAL_TENDER_COORDINATOR_REQUIRED");
    }

    @Override
    public CompletableFuture<TenderSnapshot> validate(
        FormalBusinessCommandContract.CommandEnvelope command,
        PricingSnapshot pricing
    ) {
        if (command == null || pricing == null) return failed("FORMAL_TENDER_INPUT_REQUIRED");
        final JSONObject review = command.payload.optJSONObject("review");
        if (review == null) return failed("FORMAL_CHECKOUT_REVIEW_INVALID");
        final String tenderId;
        try {
            tenderId = text(review, "tenderId", "FORMAL_CHECKOUT_TENDER_INVALID");
        } catch (RuntimeException invalid) {
            return failed(invalid);
        }
        return coordinator.snapshot(snapshotRequest(command.storeId)).thenApply(snapshot -> {
            if (snapshot.items.size() != 1) throw failure("FORMAL_TENDER_SNAPSHOT_INVALID");
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem item = snapshot.items.get(0);
            if (!AGGREGATE_TYPE.equals(item.aggregateType)
                || !command.storeId.equals(item.aggregateId)) {
                throw failure("FORMAL_TENDER_SNAPSHOT_INVALID");
            }
            if (!item.found) throw failure("FORMAL_POS_TENDER_POLICY_MISSING");
            final PolicyTender policy = policyTender(command.storeId, item, tenderId);
            if (!policy.enabled) throw failure("FORMAL_CHECKOUT_TENDER_DISABLED");
            if (!pricing.quote().acceptedTenderIds().contains(tenderId)) {
                throw failure("FORMAL_CHECKOUT_TENDER_NOT_IN_QUOTE");
            }
            final long amountMinor = pricing.quote().totalDueMinor();
            final Tender tender;
            if (policy.kind == TenderKind.CASH) {
                final long received = nonnegativeLong(
                    review.opt("cashReceivedMinor"),
                    "FORMAL_CHECKOUT_CASH_MISMATCH"
                );
                final long change = nonnegativeLong(
                    review.opt("changeMinor"),
                    "FORMAL_CHECKOUT_CASH_MISMATCH"
                );
                if (received < amountMinor || safeSubtract(received, amountMinor) != change) {
                    throw failure("FORMAL_CHECKOUT_CASH_MISMATCH");
                }
                tender = new Tender(
                    tenderId,
                    TenderKind.CASH,
                    SettlementEvidenceMode.CASH_COUNTED,
                    evidenceRef(command, tenderId),
                    amountMinor,
                    received,
                    change
                );
            } else {
                if (present(review, "cashReceivedMinor") || present(review, "changeMinor")) {
                    throw failure("FORMAL_CHECKOUT_ELECTRONIC_CASH_FIELDS_FORBIDDEN");
                }
                tender = new Tender(
                    tenderId,
                    TenderKind.NON_CASH,
                    SettlementEvidenceMode.STAFF_CONFIRMED,
                    evidenceRef(command, tenderId),
                    amountMinor,
                    null,
                    null
                );
            }
            return new TenderSnapshot(
                tender,
                tender.recordingEvidenceRef(),
                java.util.List.of(new StoreKernelContract.AggregateReadDependency(
                    item.aggregateType,
                    item.aggregateId,
                    item.revision
                )),
                pricing.validUntilEpochMs()
            );
        });
    }

    private static PolicyTender policyTender(
        String storeId,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item,
        String tenderId
    ) {
        final JSONObject state = object(item.stateJson, "FORMAL_POS_TENDER_POLICY_INVALID");
        equal(SCHEMA, text(state, "schema", "FORMAL_POS_TENDER_POLICY_INVALID"),
            "FORMAL_POS_TENDER_POLICY_INVALID");
        equal(storeId, text(state, "storeId", "FORMAL_POS_TENDER_POLICY_INVALID"),
            "FORMAL_POS_TENDER_POLICY_INVALID");
        if (positiveLong(state.opt("revision"), "FORMAL_POS_TENDER_POLICY_INVALID") != item.revision) {
            throw failure("FORMAL_POS_TENDER_POLICY_REVISION_MISMATCH");
        }
        final JSONArray tenders = state.optJSONArray("tenders");
        if (tenders == null) throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
        final Set<String> seen = new HashSet<>();
        PolicyTender selected = null;
        boolean anyEnabled = false;
        for (int index = 0; index < tenders.length(); index++) {
            final JSONObject row = object(tenders.opt(index), "FORMAL_POS_TENDER_POLICY_INVALID");
            final String id = text(row, "id", "FORMAL_POS_TENDER_POLICY_INVALID");
            if (!seen.add(id)) throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
            text(row, "label", "FORMAL_POS_TENDER_POLICY_INVALID");
            final Object enabled = row.opt("enabled");
            if (!(enabled instanceof Boolean)) throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
            final TenderKind kind = kind(text(row, "kind", "FORMAL_POS_TENDER_POLICY_INVALID"));
            if ((Boolean) enabled) anyEnabled = true;
            if (tenderId.equals(id)) selected = new PolicyTender((Boolean) enabled, kind);
        }
        if (!anyEnabled) throw failure("FORMAL_POS_TENDER_POLICY_EMPTY");
        if (selected == null) throw failure("FORMAL_CHECKOUT_TENDER_UNKNOWN");
        return selected;
    }

    private static TenderKind kind(String raw) {
        if ("CASH".equals(raw)) return TenderKind.CASH;
        if ("NON_CASH".equals(raw)) return TenderKind.NON_CASH;
        throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
    }

    private static StoreKernelContract.AggregateSnapshotRequest snapshotRequest(String storeId) {
        try {
            return StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", "MFP-FORMAL-TENDER-READ")
                .put("storeId", storeId)
                .put("keys", new JSONArray().put(new JSONObject()
                    .put("aggregateType", AGGREGATE_TYPE)
                    .put("aggregateId", storeId))));
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_TENDER_SNAPSHOT_ENCODING_FAILED", impossible);
        }
    }

    private static boolean present(JSONObject value, String key) {
        final Object raw = value.opt(key);
        return raw != null && raw != JSONObject.NULL;
    }

    private static String evidenceRef(
        FormalBusinessCommandContract.CommandEnvelope command,
        String tenderId
    ) {
        return "PAYMENT-CONFIRM-" + sha256(
            command.storeId + "\n" + command.submissionId + "\n" + command.requestFingerprint
                + "\n" + tenderId
        ).substring(0, 32);
    }

    private static long safeSubtract(long left, long right) {
        try {
            final long result = Math.subtractExact(left, right);
            if (result < 0 || result > FormalCheckoutRecords.MAX_SAFE_INTEGER) {
                throw failure("FORMAL_CHECKOUT_CASH_MISMATCH");
            }
            return result;
        } catch (ArithmeticException invalid) {
            throw failure("FORMAL_CHECKOUT_CASH_MISMATCH");
        }
    }

    private static long positiveLong(Object value, String code) {
        final long result = nonnegativeLong(value, code);
        if (result < 1) throw failure(code);
        return result;
    }

    private static long nonnegativeLong(Object value, String code) {
        if (!(value instanceof Number)) throw failure(code);
        try {
            final long result = new BigDecimal(value.toString()).longValueExact();
            if (result < 0 || result > FormalCheckoutRecords.MAX_SAFE_INTEGER) throw failure(code);
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

    private static JSONObject object(Object value, String code) {
        if (!(value instanceof JSONObject)) throw failure(code);
        return (JSONObject) value;
    }

    private static String text(JSONObject value, String key, String code) {
        final Object raw = value.opt(key);
        if (!(raw instanceof String)) throw failure(code);
        final String result = (String) raw;
        if (result.isEmpty() || !result.equals(result.trim()) || result.length() > 160) {
            throw failure(code);
        }
        for (int index = 0; index < result.length(); index++) {
            if (Character.isISOControl(result.charAt(index))) throw failure(code);
        }
        return result;
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
            throw new IllegalStateException("FORMAL_TENDER_HASH_UNAVAILABLE", impossible);
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

    private record PolicyTender(boolean enabled, TenderKind kind) { }
}
