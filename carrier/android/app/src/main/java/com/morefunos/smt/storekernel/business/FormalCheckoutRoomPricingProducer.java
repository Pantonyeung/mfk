package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;
import com.morefunos.smt.storekernel.business.FormalCheckoutPaymentConfirmHandler.PricingSnapshot;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountDecision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountRow;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountSelection;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Line;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Quote;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Revision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SourceIdentity;

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
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.LongSupplier;

/**
 * Read-only confirmation-time adapter for a previously created native formal quote.
 * Quote creation remains a separate production capability; browser claims never become prices.
 */
public final class FormalCheckoutRoomPricingProducer
    implements FormalCheckoutPaymentConfirmHandler.PricingPort {
    public static final String QUOTE_AGGREGATE_TYPE = "FORMAL_QUOTE";
    public static final String QUOTE_SCHEMA = "mfp.formal-quote.v1";

    private static final long MAX_SAFE_INTEGER = FormalCheckoutRecords.MAX_SAFE_INTEGER;
    private static final int MAX_LINES = 1_000;

    private final StoreKernelTransactionCoordinator coordinator;
    private final LongSupplier clock;

    public FormalCheckoutRoomPricingProducer(
        StoreKernelTransactionCoordinator coordinator,
        LongSupplier clock
    ) {
        this.coordinator = Objects.requireNonNull(coordinator, "FORMAL_PRICING_COORDINATOR_REQUIRED");
        this.clock = Objects.requireNonNull(clock, "FORMAL_PRICING_CLOCK_REQUIRED");
    }

    @Override
    public CompletableFuture<PricingSnapshot> validate(
        FormalBusinessCommandContract.CommandEnvelope command
    ) {
        Objects.requireNonNull(command, "FORMAL_PRICING_COMMAND_REQUIRED");
        final JSONObject intent = command.payload.optJSONObject("intent");
        final JSONObject review = command.payload.optJSONObject("review");
        if (intent == null || review == null) return failed("FORMAL_CHECKOUT_PAYLOAD_INVALID");
        final String quoteRef;
        try {
            quoteRef = text(review, "quoteRef", "FORMAL_QUOTE_REF_INVALID");
        } catch (RuntimeException invalid) {
            return failed(invalid);
        }

        return coordinator.snapshot(snapshotRequest(command.storeId, quoteRef)).thenApply(snapshot -> {
            if (snapshot.items.size() != 2) throw failure("FORMAL_PRICING_SNAPSHOT_INVALID");
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem admin = item(
                snapshot,
                0,
                FormalAdminConfigProducer.AGGREGATE_TYPE,
                command.storeId
            );
            final StoreKernelTransactionCoordinator.AggregateSnapshotItem quote = item(
                snapshot,
                1,
                QUOTE_AGGREGATE_TYPE,
                quoteRef
            );
            if (!admin.found) throw failure("ADMIN_CONFIG_SOURCE_MISSING");
            if (!quote.found) throw failure("FORMAL_QUOTE_MISSING");
            final FormalCheckoutSourceContracts.SourceFacts source;
            try {
                source = FormalCheckoutSourceContracts.fromValidatedStateJson(
                    command.storeId,
                    admin.revision,
                    admin.stateJson,
                    new FormalCheckoutOrgJsonDecoder()
                );
            } catch (RuntimeException invalid) {
                throw failure("ADMIN_CONFIG_STORED_STATE_INVALID");
            }
            return parse(command, intent, source, admin, quote);
        });
    }

    private PricingSnapshot parse(
        FormalBusinessCommandContract.CommandEnvelope command,
        JSONObject clientIntent,
        FormalCheckoutSourceContracts.SourceFacts source,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem adminItem,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem quoteItem
    ) {
        final JSONObject state = object(quoteItem.stateJson, "FORMAL_QUOTE_INVALID");
        equal(QUOTE_SCHEMA, text(state, "schema", "FORMAL_QUOTE_SCHEMA_INVALID"), "FORMAL_QUOTE_SCHEMA_INVALID");
        equal(command.storeId, text(state, "storeId", "FORMAL_QUOTE_IDENTITY_MISMATCH"), "FORMAL_QUOTE_IDENTITY_MISMATCH");
        final String quoteRef = text(state, "quoteRef", "FORMAL_QUOTE_IDENTITY_MISMATCH");
        equal(quoteItem.aggregateId, quoteRef, "FORMAL_QUOTE_IDENTITY_MISMATCH");
        if (positiveLong(state.opt("revision"), "FORMAL_QUOTE_REVISION_MISMATCH") != quoteItem.revision) {
            throw failure("FORMAL_QUOTE_REVISION_MISMATCH");
        }
        if (positiveLong(state.opt("adminConfigRevision"), "FORMAL_QUOTE_ADMIN_CONFIG_STALE") != adminItem.revision
            || positiveLong(state.opt("adminSourceRevision"), "FORMAL_QUOTE_ADMIN_CONFIG_STALE")
                != source.provenance().adminSourceRevision()
            || !source.provenance().adminFingerprint().equals(
                text(state, "adminFingerprint", "FORMAL_QUOTE_ADMIN_CONFIG_STALE")
            )) {
            throw failure("FORMAL_QUOTE_ADMIN_CONFIG_STALE");
        }
        equal(
            intentHash(clientIntent),
            hash(state, "clientIntentHash", "FORMAL_QUOTE_INTENT_MISMATCH"),
            "FORMAL_QUOTE_INTENT_MISMATCH"
        );

        final long now = clock.getAsLong();
        if (now < 0) throw failure("FORMAL_PRICING_CLOCK_INVALID");
        final Instant validatedAt = instant(state, "validatedAt", "FORMAL_QUOTE_INVALID");
        final long validUntil = positiveLong(state.opt("validUntilEpochMs"), "FORMAL_QUOTE_FRESHNESS_INVALID");
        if (validatedAt.toEpochMilli() > now || validUntil <= validatedAt.toEpochMilli()) {
            throw failure("FORMAL_QUOTE_FRESHNESS_INVALID");
        }
        if (now >= validUntil) throw failure("FORMAL_QUOTE_EXPIRED");

        final String validatedIntentJson = textValue(
            state,
            "validatedIntentJson",
            "FORMAL_QUOTE_INTENT_INVALID",
            131_072
        );
        equal(
            sha256(validatedIntentJson),
            hash(state, "validatedIntentHash", "FORMAL_QUOTE_INTENT_INVALID"),
            "FORMAL_QUOTE_INTENT_INVALID"
        );
        validateNormalizedIntent(validatedIntentJson, command.storeId);

        final Revision formalRevision = revision(state.opt("formalRevision"), "FORMAL_QUOTE_REVISION_INVALID");
        final List<Line> lines = lines(array(state, "lines", "FORMAL_QUOTE_INVALID"));
        final List<DiscountRow> discounts = discounts(array(state, "discounts", "FORMAL_QUOTE_INVALID"));
        final DiscountDecision decision = discountDecision(object(
            state.opt("discountDecision"),
            "FORMAL_QUOTE_DISCOUNT_INVALID"
        ));
        if (decision.mode() != DiscountMode.NONE
            || decision.confirmedStudentCount() != 0
            || !decision.selections().isEmpty()
            || lines.stream().anyMatch(Line::studentDiscountEligible)
            || !discounts.isEmpty()) {
            throw failure("FORMAL_STUDENT_DISCOUNT_POLICY_UNBOUND");
        }

        final Quote formalQuote = new Quote(
            quoteRef,
            formalRevision,
            text(state, "currency", "FORMAL_QUOTE_INVALID"),
            lines,
            discounts,
            nonnegativeLong(state.opt("formalSubtotalMinor"), "FORMAL_QUOTE_INVALID"),
            nonnegativeLong(state.opt("formalDiscountMinor"), "FORMAL_QUOTE_INVALID"),
            nonnegativeLong(state.opt("formalTotalDueMinor"), "FORMAL_QUOTE_INVALID"),
            uniqueTexts(array(state, "acceptedTenderIds", "FORMAL_QUOTE_INVALID"), "FORMAL_QUOTE_INVALID"),
            validatedAt
        );
        final JSONObject rawIdentity = object(state.opt("sourceIdentity"), "FORMAL_QUOTE_SOURCE_IDENTITY_INVALID");
        return new PricingSnapshot(
            text(state, "validatedIntentRef", "FORMAL_QUOTE_INTENT_INVALID"),
            sha256(validatedIntentJson),
            validatedIntentJson,
            text(state, "channelId", "FORMAL_QUOTE_CHANNEL_INVALID"),
            new SourceIdentity(
                optionalText(rawIdentity, "customerPhone", "FORMAL_QUOTE_SOURCE_IDENTITY_INVALID"),
                optionalText(rawIdentity, "pickupCode", "FORMAL_QUOTE_SOURCE_IDENTITY_INVALID"),
                optionalText(rawIdentity, "externalOrderNo", "FORMAL_QUOTE_SOURCE_IDENTITY_INVALID")
            ),
            formalQuote,
            decision,
            List.of(dependency(adminItem), dependency(quoteItem)),
            validUntil
        );
    }

    /** Stable cross-runtime fingerprint for the browser intent claim; prices are not trusted. */
    public static String intentHash(JSONObject intent) {
        if (intent == null) throw failure("FORMAL_QUOTE_INTENT_INVALID");
        return sha256(canonical(intent));
    }

    private static StoreKernelContract.AggregateSnapshotRequest snapshotRequest(
        String storeId,
        String quoteRef
    ) {
        try {
            return StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", "MFP-FORMAL-PRICING-READ")
                .put("storeId", storeId)
                .put("keys", new JSONArray()
                    .put(new JSONObject()
                        .put("aggregateType", FormalAdminConfigProducer.AGGREGATE_TYPE)
                        .put("aggregateId", storeId))
                    .put(new JSONObject()
                        .put("aggregateType", QUOTE_AGGREGATE_TYPE)
                        .put("aggregateId", quoteRef))));
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_PRICING_SNAPSHOT_ENCODING_FAILED", impossible);
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
            throw failure("FORMAL_PRICING_SNAPSHOT_IDENTITY_MISMATCH");
        }
        return item;
    }

    private static StoreKernelContract.AggregateReadDependency dependency(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item
    ) {
        if (item.revision < 1) throw failure("FORMAL_PRICING_DEPENDENCY_INVALID");
        return new StoreKernelContract.AggregateReadDependency(
            item.aggregateType,
            item.aggregateId,
            item.revision
        );
    }

    private static List<Line> lines(JSONArray values) {
        if (values.length() < 1 || values.length() > MAX_LINES) throw failure("FORMAL_QUOTE_INVALID");
        final List<Line> result = new ArrayList<>();
        final Set<String> ids = new HashSet<>();
        for (int index = 0; index < values.length(); index++) {
            final JSONObject row = object(values.opt(index), "FORMAL_QUOTE_INVALID");
            final String cartLineId = text(row, "cartLineId", "FORMAL_QUOTE_INVALID");
            if (!ids.add(cartLineId)) throw failure("FORMAL_QUOTE_INVALID");
            final Object eligible = row.opt("studentDiscountEligible");
            if (!(eligible instanceof Boolean)) throw failure("FORMAL_QUOTE_INVALID");
            result.add(new Line(
                cartLineId,
                positiveLong(row.opt("quantity"), "FORMAL_QUOTE_INVALID"),
                nonnegativeLong(row.opt("formalUnitMinor"), "FORMAL_QUOTE_INVALID"),
                nonnegativeLong(row.opt("formalLineTotalMinor"), "FORMAL_QUOTE_INVALID"),
                (Boolean) eligible
            ));
        }
        return result;
    }

    private static List<DiscountRow> discounts(JSONArray values) {
        final List<DiscountRow> result = new ArrayList<>();
        for (int index = 0; index < values.length(); index++) {
            final JSONObject row = object(values.opt(index), "FORMAL_QUOTE_DISCOUNT_INVALID");
            final String cartLineId = optionalText(row, "cartLineId", "FORMAL_QUOTE_DISCOUNT_INVALID");
            result.add(new DiscountRow(
                text(row, "code", "FORMAL_QUOTE_DISCOUNT_INVALID"),
                nonnegativeLong(row.opt("amountMinor"), "FORMAL_QUOTE_DISCOUNT_INVALID"),
                cartLineId,
                row.has("quantity")
                    ? positiveLong(row.opt("quantity"), "FORMAL_QUOTE_DISCOUNT_INVALID")
                    : null
            ));
        }
        return result;
    }

    private static DiscountDecision discountDecision(JSONObject value) {
        final List<DiscountSelection> selections = new ArrayList<>();
        final JSONArray rawSelections = array(value, "selections", "FORMAL_QUOTE_DISCOUNT_INVALID");
        for (int index = 0; index < rawSelections.length(); index++) {
            final JSONObject row = object(rawSelections.opt(index), "FORMAL_QUOTE_DISCOUNT_INVALID");
            selections.add(new DiscountSelection(
                text(row, "cartLineId", "FORMAL_QUOTE_DISCOUNT_INVALID"),
                positiveLong(row.opt("quantity"), "FORMAL_QUOTE_DISCOUNT_INVALID")
            ));
        }
        final DiscountMode mode;
        try {
            mode = DiscountMode.valueOf(text(value, "mode", "FORMAL_QUOTE_DISCOUNT_INVALID"));
        } catch (IllegalArgumentException invalid) {
            throw failure("FORMAL_QUOTE_DISCOUNT_INVALID");
        }
        return new DiscountDecision(
            text(value, "decisionRef", "FORMAL_QUOTE_DISCOUNT_INVALID"),
            revision(value.opt("policyRevision"), "FORMAL_QUOTE_DISCOUNT_INVALID"),
            mode,
            nonnegativeLong(value.opt("confirmedStudentCount"), "FORMAL_QUOTE_DISCOUNT_INVALID"),
            selections
        );
    }

    private static Revision revision(Object value, String code) {
        if (value instanceof String) return Revision.text(requiredText((String) value, code, 160));
        return Revision.numeric(nonnegativeLong(value, code));
    }

    private static void validateNormalizedIntent(String raw, String storeId) {
        try {
            final JSONTokener parser = new JSONTokener(raw);
            final Object parsed = parser.nextValue();
            if (!(parsed instanceof JSONObject) || parser.nextClean() != 0) {
                throw failure("FORMAL_QUOTE_INTENT_INVALID");
            }
            final JSONObject intent = (JSONObject) parsed;
            equal(
                FormalCheckoutCommitFactory.NORMALIZED_INTENT_SCHEMA,
                text(intent, "schema", "FORMAL_QUOTE_INTENT_INVALID"),
                "FORMAL_QUOTE_INTENT_INVALID"
            );
            equal(storeId, text(intent, "storeId", "FORMAL_QUOTE_INTENT_INVALID"), "FORMAL_QUOTE_INTENT_INVALID");
            if (!Boolean.TRUE.equals(intent.opt("checkoutReady"))) throw failure("FORMAL_QUOTE_INTENT_INVALID");
        } catch (JSONException invalid) {
            throw failure("FORMAL_QUOTE_INTENT_INVALID");
        }
    }

    private static List<String> uniqueTexts(JSONArray values, String code) {
        if (values.length() < 1) throw failure(code);
        final List<String> result = new ArrayList<>();
        final Set<String> unique = new HashSet<>();
        for (int index = 0; index < values.length(); index++) {
            final Object value = values.opt(index);
            if (!(value instanceof String)) throw failure(code);
            final String text = requiredText((String) value, code, 160);
            if (!unique.add(text)) throw failure(code);
            result.add(text);
        }
        return result;
    }

    private static String canonical(Object value) {
        if (value == null || value == JSONObject.NULL) return "null";
        if (value instanceof String) return JSONObject.quote((String) value);
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Number) {
            final double number = ((Number) value).doubleValue();
            if (!Double.isFinite(number)) throw failure("FORMAL_QUOTE_INTENT_INVALID");
            return value.toString();
        }
        if (value instanceof JSONArray) {
            final JSONArray values = (JSONArray) value;
            final StringBuilder output = new StringBuilder("[");
            for (int index = 0; index < values.length(); index++) {
                if (index > 0) output.append(',');
                output.append(canonical(values.opt(index)));
            }
            return output.append(']').toString();
        }
        if (value instanceof JSONObject) {
            final JSONObject values = (JSONObject) value;
            final List<String> keys = new ArrayList<>();
            final Iterator<String> iterator = values.keys();
            while (iterator.hasNext()) keys.add(iterator.next());
            Collections.sort(keys);
            final StringBuilder output = new StringBuilder("{");
            for (int index = 0; index < keys.size(); index++) {
                if (index > 0) output.append(',');
                final String key = keys.get(index);
                output.append(JSONObject.quote(key)).append(':').append(canonical(values.opt(key)));
            }
            return output.append('}').toString();
        }
        throw failure("FORMAL_QUOTE_INTENT_INVALID");
    }

    private static String sha256(String value) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            final StringBuilder output = new StringBuilder(digest.length * 2);
            for (byte item : digest) output.append(String.format("%02x", item & 0xff));
            return output.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("FORMAL_QUOTE_HASH_UNAVAILABLE", impossible);
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

    private static JSONArray array(JSONObject value, String key, String code) {
        final JSONArray result = value.optJSONArray(key);
        if (result == null) throw failure(code);
        return result;
    }

    private static String text(JSONObject value, String key, String code) {
        final Object raw = value.opt(key);
        if (!(raw instanceof String)) throw failure(code);
        return requiredText((String) raw, code, 160);
    }

    private static String textValue(JSONObject value, String key, String code, int max) {
        final Object raw = value.opt(key);
        if (!(raw instanceof String)) throw failure(code);
        return requiredText((String) raw, code, max);
    }

    private static String optionalText(JSONObject value, String key, String code) {
        final Object raw = value.opt(key);
        if (raw == null || raw == JSONObject.NULL) return null;
        if (!(raw instanceof String)) throw failure(code);
        return requiredText((String) raw, code, 160);
    }

    private static String requiredText(String value, String code, int max) {
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > max) throw failure(code);
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw failure(code);
        }
        return value;
    }

    private static String hash(JSONObject value, String key, String code) {
        final String result = text(value, key, code);
        if (!result.matches("^[0-9a-f]{64}$")) throw failure(code);
        return result;
    }

    private static Instant instant(JSONObject value, String key, String code) {
        try {
            return Instant.parse(text(value, key, code));
        } catch (DateTimeParseException invalid) {
            throw failure(code);
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
            if (result < 0 || result > MAX_SAFE_INTEGER) throw failure(code);
            return result;
        } catch (ArithmeticException | NumberFormatException invalid) {
            throw failure(code);
        }
    }

    private static void equal(String expected, String actual, String code) {
        if (!expected.equals(actual)) throw failure(code);
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
}
