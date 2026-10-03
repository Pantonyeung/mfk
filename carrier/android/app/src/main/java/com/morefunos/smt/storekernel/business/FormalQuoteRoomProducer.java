package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountDecision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Line;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Quote;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Revision;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.LongSupplier;

/**
 * Creates the first native formal quote from canonical Admin catalog facts.
 *
 * <p>This bounded producer resolves supported published product options and combo selections. Unsupported
 * pricing shapes fail closed; client preview amounts are never consumed as prices.</p>
 */
public final class FormalQuoteRoomProducer {
    public static final String REQUEST_SCHEMA = "mfp.checkout.validation.request.v1";
    public static final String CLIENT_INTENT_SCHEMA = "mfp.ordering.intent.draft.v1";
    public static final String TENDER_AGGREGATE_TYPE = "POS_TENDER_POLICY";
    public static final String TENDER_SCHEMA = "mfp.pos-tender-policy.v1";

    private static final String OPERATION_ID = "FORMAL_QUOTE_CREATE";
    private static final long MAX_TTL_MS = 900_000L;
    private static final int MAX_LINES = 1_000;

    private final StoreKernelTransactionCoordinator coordinator;
    private final LongSupplier clock;
    private final long quoteTtlMs;

    public FormalQuoteRoomProducer(
        StoreKernelTransactionCoordinator coordinator,
        LongSupplier clock,
        long quoteTtlMs
    ) {
        this.coordinator = Objects.requireNonNull(coordinator, "FORMAL_QUOTE_COORDINATOR_REQUIRED");
        this.clock = Objects.requireNonNull(clock, "FORMAL_QUOTE_CLOCK_REQUIRED");
        if (quoteTtlMs < 1 || quoteTtlMs > MAX_TTL_MS) {
            throw failure("FORMAL_QUOTE_TTL_INVALID");
        }
        this.quoteTtlMs = quoteTtlMs;
    }

    public CompletableFuture<CreatedQuote> create(String storeId, JSONObject request) {
        final ParsedRequest parsed;
        try {
            parsed = parseRequest(storeId, request);
        } catch (RuntimeException invalid) {
            return failed(invalid);
        }
        return coordinator.snapshot(snapshotRequest(storeId)).thenCompose(snapshot -> {
            try {
                return createFromSnapshot(storeId, parsed, snapshot);
            } catch (JSONException invalid) {
                return failed(failure("FORMAL_QUOTE_ENCODING_FAILED"));
            } catch (RuntimeException invalid) {
                return failed(invalid);
            }
        });
    }

    private CompletableFuture<CreatedQuote> createFromSnapshot(
        String storeId,
        ParsedRequest request,
        StoreKernelTransactionCoordinator.AggregateSnapshotResult snapshot
    ) throws JSONException {
        if (snapshot.items.size() != 2) throw failure("FORMAL_QUOTE_SOURCE_SNAPSHOT_INVALID");
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem admin = item(
            snapshot, 0, FormalAdminConfigProducer.AGGREGATE_TYPE, storeId
        );
        final StoreKernelTransactionCoordinator.AggregateSnapshotItem tender = item(
            snapshot, 1, TENDER_AGGREGATE_TYPE, storeId
        );
        if (!admin.found) throw failure("ADMIN_CONFIG_SOURCE_MISSING");
        if (!tender.found) throw failure("FORMAL_POS_TENDER_POLICY_MISSING");

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
        final String currency;
        try {
            currency = source.currency().require();
        } catch (RuntimeException unbound) {
            throw failure("FORMAL_QUOTE_CURRENCY_UNBOUND");
        }
        final TenderPolicy tenderPolicy = enabledTenders(storeId, tender, request.tenderId);
        final List<String> acceptedTenders = tenderPolicy.enabledTenderIds();

        final long now = clock.getAsLong();
        if (now < 0) throw failure("FORMAL_QUOTE_CLOCK_INVALID");
        final long validUntil;
        try {
            validUntil = Math.addExact(now, quoteTtlMs);
        } catch (ArithmeticException invalid) {
            throw failure("FORMAL_QUOTE_CLOCK_INVALID");
        }

        final JSONArray normalizedLines = new JSONArray();
        final JSONArray quoteLines = new JSONArray();
        final List<Line> records = new ArrayList<>();
        final Set<String> lineIds = new HashSet<>();
        long subtotal = 0;
        final JSONArray lines = request.intent.getJSONArray("lines");
        for (int index = 0; index < lines.length(); index++) {
            final JSONObject clientLine = object(lines.opt(index), "FORMAL_QUOTE_INTENT_INVALID");
            final String cartLineId = text(clientLine, "cartLineId", "FORMAL_QUOTE_INTENT_INVALID");
            if (!lineIds.add(cartLineId)) throw failure("FORMAL_QUOTE_INTENT_INVALID");
            final FormalQuoteSelectionResolver.ResolvedLine resolved = FormalQuoteSelectionResolver.resolve(
                source.catalog(), source.optionCenter().bound() ? source.optionCenter().value() : null,
                currency, new FormalCheckoutOrgJsonDecoder().decodeObject(clientLine.toString()), request.serviceMode
            );
            try {
                subtotal = FormalCheckoutSourceContracts.safeAdd(subtotal, resolved.lineTotalMinor());
            } catch (RuntimeException invalid) {
                throw failure("FORMAL_QUOTE_MONEY_INVALID");
            }
            final JSONArray materialFacts = new JSONArray();
            for (String factId : resolved.materialFactIds()) materialFacts.put(new JSONObject()
                .put("factId", factId).put("revision", source.provenance().adminSourceRevision()));
            final JSONObject normalizedLine = new JSONObject()
                .put("cartLineId", cartLineId)
                .put("kind", resolved.kind())
                .put("PRODUCT".equals(resolved.kind()) ? "productId" : "comboId", resolved.entityId())
                .put("displayName", resolved.name())
                .put("quantity", resolved.quantity())
                .put("serviceMode", request.serviceMode)
                .put("optionSelections", new JSONArray(resolved.optionSelections()))
                .put("comboSelections", new JSONArray(resolved.comboSelections()))
                .put("materialPriceFacts", materialFacts);
            normalizedLines.put(normalizedLine);
            quoteLines.put(new JSONObject()
                .put("cartLineId", cartLineId)
                .put("quantity", resolved.quantity())
                .put("formalUnitMinor", resolved.unitMinor())
                .put("formalLineTotalMinor", resolved.lineTotalMinor())
                .put("studentDiscountEligible", false));
            records.add(new Line(cartLineId, resolved.quantity(), resolved.unitMinor(), resolved.lineTotalMinor(), false));
        }

        final JSONObject normalizedIntent = new JSONObject()
            .put("schema", FormalCheckoutCommitFactory.NORMALIZED_INTENT_SCHEMA)
            .put("storeId", storeId)
            .put("serviceMode", request.serviceMode.toUpperCase(Locale.ROOT).replace('-', '_'))
            .put("checkoutReady", true)
            .put("lines", normalizedLines);
        final String normalizedIntentJson = normalizedIntent.toString();
        final String normalizedHash = sha256(normalizedIntentJson);
        final String clientHash = FormalCheckoutRoomPricingProducer.intentHash(request.intent);
        final String identityHash = sha256(
            storeId + "\n" + admin.revision + "\n" + tender.revision + "\n" + clientHash
                + "\n" + request.channelId + "\n" + now
        );
        final String quoteRef = "QUOTE-" + identityHash.substring(0, 32);
        final String formalRevision = "QUOTE-REV-" + identityHash.substring(32, 56);
        final String validatedIntentRef = "INTENT-" + normalizedHash.substring(0, 32);
        final Instant validatedAt = Instant.ofEpochMilli(now);
        final JSONArray tenderIds = new JSONArray();
        for (String id : acceptedTenders) tenderIds.put(id);
        final JSONObject decision = new JSONObject()
            .put("decisionRef", "NO-STUDENT-" + identityHash.substring(0, 16))
            .put("policyRevision", "STUDENT-POLICY-UNBOUND")
            .put("mode", "NONE")
            .put("confirmedStudentCount", 0)
            .put("selections", new JSONArray());
        final JSONObject state = new JSONObject()
            .put("schema", FormalCheckoutRoomPricingProducer.QUOTE_SCHEMA)
            .put("storeId", storeId)
            .put("quoteRef", quoteRef)
            .put("revision", 1)
            .put("adminConfigRevision", admin.revision)
            .put("adminSourceRevision", source.provenance().adminSourceRevision())
            .put("adminFingerprint", source.provenance().adminFingerprint())
            .put("clientIntentHash", clientHash)
            .put("validatedIntentRef", validatedIntentRef)
            .put("validatedIntentHash", normalizedHash)
            .put("validatedIntentJson", normalizedIntentJson)
            .put("channelId", request.channelId)
            .put("sourceIdentity", new JSONObject())
            .put("formalRevision", formalRevision)
            .put("currency", currency)
            .put("lines", quoteLines)
            .put("discounts", new JSONArray())
            .put("formalSubtotalMinor", subtotal)
            .put("formalDiscountMinor", 0)
            .put("formalTotalDueMinor", subtotal)
            .put("acceptedTenderIds", tenderIds)
            .put("validatedAt", validatedAt.toString())
            .put("validUntilEpochMs", validUntil)
            .put("discountDecision", decision);
        final Quote quote = new Quote(
            quoteRef,
            Revision.text(formalRevision),
            currency,
            records,
            List.of(),
            subtotal,
            0,
            subtotal,
            acceptedTenders,
            validatedAt
        );
        final CreatedQuote created = new CreatedQuote(
            "VALID",
            quote,
            new DiscountDecision(
                decision.getString("decisionRef"),
                Revision.text("STUDENT-POLICY-UNBOUND"),
                DiscountMode.NONE,
                0,
                List.of()
            ),
            tenderPolicy.enabledTenders(),
            validUntil
        );
        final StoreKernelContract.CommitRequest commit = commit(
            storeId,
            state,
            admin,
            tender,
            identityHash,
            validatedAt.toString(),
            validUntil
        );
        return coordinator.commit(commit).thenApply(ignored -> created);
    }

    private static StoreKernelContract.CommitRequest commit(
        String storeId,
        JSONObject state,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem admin,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem tender,
        String identityHash,
        String committedAt,
        long deadline
    ) {
        try {
            final String commandId = "QUOTE-CREATE-" + identityHash.substring(0, 32);
            final JSONObject result = new JSONObject()
                .put("state", "VALID")
                .put("quoteRef", state.getString("quoteRef"))
                .put("formalRevision", state.getString("formalRevision"))
                .put("formalTotalDueMinor", state.getLong("formalTotalDueMinor"));
            final JSONObject raw = new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.COMMIT)
                .put("requestId", "REQ-" + commandId)
                .put("commandId", commandId)
                .put("storeId", storeId)
                .put("operationId", OPERATION_ID)
                .put("idempotencyKey", commandId)
                .put("requestFingerprint", sha256(state.toString()))
                .put("result", result)
                .put("traceId", "formal-quote:" + state.getString("quoteRef"))
                .put("committedAt", committedAt)
                .put("mutations", new JSONArray().put(new JSONObject()
                    .put("aggregateType", FormalCheckoutRoomPricingProducer.QUOTE_AGGREGATE_TYPE)
                    .put("aggregateId", state.getString("quoteRef"))
                    .put("expectedRevision", 0)
                    .put("state", state)))
                .put("outbox", new JSONArray());
            return StoreKernelContract.parseCommit(raw)
                .withReadDependencies(List.of(dependency(admin), dependency(tender)))
                .withCommitDeadlineEpochMs(deadline);
        } catch (JSONException invalid) {
            throw failure("FORMAL_QUOTE_COMMIT_ENCODING_FAILED");
        }
    }

    private static ParsedRequest parseRequest(String storeId, JSONObject request) {
        requiredText(storeId, "FORMAL_QUOTE_STORE_INVALID", 160);
        if (request == null) throw failure("FORMAL_QUOTE_REQUEST_INVALID");
        equal(REQUEST_SCHEMA, text(request, "schema", "FORMAL_QUOTE_REQUEST_INVALID"),
            "FORMAL_QUOTE_REQUEST_INVALID");
        final JSONObject intent = object(request.opt("intent"), "FORMAL_QUOTE_INTENT_INVALID");
        equal(CLIENT_INTENT_SCHEMA, text(intent, "schema", "FORMAL_QUOTE_INTENT_INVALID"),
            "FORMAL_QUOTE_INTENT_INVALID");
        if (!Boolean.TRUE.equals(intent.opt("draftOnly"))
            || !Boolean.TRUE.equals(intent.opt("checkoutReady"))) {
            throw failure("FORMAL_QUOTE_INTENT_INVALID");
        }
        equal("LOCAL_PREVIEW_FROM_PUBLISHED_FACTS",
            text(intent, "pricing", "FORMAL_QUOTE_INTENT_INVALID"),
            "FORMAL_QUOTE_INTENT_INVALID");
        final String serviceMode = text(intent, "serviceMode", "FORMAL_QUOTE_INTENT_INVALID");
        if (!"takeaway".equals(serviceMode) && !"dine-in".equals(serviceMode)) {
            throw failure("FORMAL_QUOTE_SERVICE_MODE_UNSUPPORTED");
        }
        final JSONArray lines = intent.optJSONArray("lines");
        if (lines == null || lines.length() < 1 || lines.length() > MAX_LINES) {
            throw failure("FORMAL_QUOTE_INTENT_INVALID");
        }
        final Object student = request.opt("studentDiscountIntent");
        if (student != null && student != JSONObject.NULL) {
            throw failure("FORMAL_STUDENT_DISCOUNT_POLICY_UNBOUND");
        }
        final String channelId = text(request, "channelId", "FORMAL_QUOTE_CHANNEL_INVALID");
        if (!"WALK_IN".equals(channelId)) throw failure("FORMAL_QUOTE_CHANNEL_UNSUPPORTED");
        final String tenderId = optionalText(request, "tenderId", "FORMAL_QUOTE_TENDER_INVALID");
        try {
            return new ParsedRequest(new JSONObject(intent.toString()), channelId, tenderId, serviceMode);
        } catch (JSONException impossible) {
            throw failure("FORMAL_QUOTE_INTENT_INVALID");
        }
    }

    private static TenderPolicy enabledTenders(
        String storeId,
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item,
        String selectedTenderId
    ) {
        final JSONObject state = object(item.stateJson, "FORMAL_POS_TENDER_POLICY_INVALID");
        equal(TENDER_SCHEMA, text(state, "schema", "FORMAL_POS_TENDER_POLICY_INVALID"),
            "FORMAL_POS_TENDER_POLICY_INVALID");
        equal(storeId, text(state, "storeId", "FORMAL_POS_TENDER_POLICY_INVALID"),
            "FORMAL_POS_TENDER_POLICY_INVALID");
        if (positiveLong(state.opt("revision"), "FORMAL_POS_TENDER_POLICY_INVALID") != item.revision) {
            throw failure("FORMAL_POS_TENDER_POLICY_REVISION_MISMATCH");
        }
        final JSONArray rows = state.optJSONArray("tenders");
        if (rows == null) throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
        final List<String> enabled = new ArrayList<>();
        final List<TenderOption> enabledOptions = new ArrayList<>();
        final Set<String> ids = new HashSet<>();
        for (int index = 0; index < rows.length(); index++) {
            final JSONObject row = object(rows.opt(index), "FORMAL_POS_TENDER_POLICY_INVALID");
            final String id = text(row, "id", "FORMAL_POS_TENDER_POLICY_INVALID");
            if (!ids.add(id)) throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
            final String label = text(row, "label", "FORMAL_POS_TENDER_POLICY_INVALID");
            final Object rawEnabled = row.opt("enabled");
            if (!(rawEnabled instanceof Boolean)) throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
            final String kind = text(row, "kind", "FORMAL_POS_TENDER_POLICY_INVALID");
            if (!"CASH".equals(kind) && !"NON_CASH".equals(kind)) {
                throw failure("FORMAL_POS_TENDER_POLICY_INVALID");
            }
            if ((Boolean) rawEnabled) {
                enabled.add(id);
                enabledOptions.add(new TenderOption(id, label, kind));
            }
        }
        if (enabled.isEmpty()) throw failure("FORMAL_POS_TENDER_POLICY_EMPTY");
        if (selectedTenderId != null && !enabled.contains(selectedTenderId)) {
            throw failure("FORMAL_QUOTE_TENDER_NOT_ENABLED");
        }
        return new TenderPolicy(List.copyOf(enabled), List.copyOf(enabledOptions));
    }

    private static StoreKernelContract.AggregateSnapshotRequest snapshotRequest(String storeId) {
        try {
            return StoreKernelContract.parseAggregateSnapshot(new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.AGGREGATE_SNAPSHOT)
                .put("requestId", "MFP-FORMAL-QUOTE-SOURCES")
                .put("storeId", storeId)
                .put("keys", new JSONArray()
                    .put(new JSONObject()
                        .put("aggregateType", FormalAdminConfigProducer.AGGREGATE_TYPE)
                        .put("aggregateId", storeId))
                    .put(new JSONObject()
                        .put("aggregateType", TENDER_AGGREGATE_TYPE)
                        .put("aggregateId", storeId))));
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_QUOTE_SNAPSHOT_ENCODING_FAILED", impossible);
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
            throw failure("FORMAL_QUOTE_SOURCE_SNAPSHOT_INVALID");
        }
        return item;
    }

    private static StoreKernelContract.AggregateReadDependency dependency(
        StoreKernelTransactionCoordinator.AggregateSnapshotItem item
    ) {
        if (!item.found || item.revision < 1) throw failure("FORMAL_QUOTE_SOURCE_DEPENDENCY_INVALID");
        return new StoreKernelContract.AggregateReadDependency(
            item.aggregateType,
            item.aggregateId,
            item.revision
        );
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
        return requiredText((String) raw, code, 160);
    }

    private static String optionalText(JSONObject value, String key, String code) {
        final Object raw = value.opt(key);
        if (raw == null || raw == JSONObject.NULL) return null;
        if (!(raw instanceof String)) throw failure(code);
        return requiredText((String) raw, code, 160);
    }

    private static String requiredText(String value, String code, int max) {
        if (value == null || value.isEmpty() || !value.equals(value.trim()) || value.length() > max) {
            throw failure(code);
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw failure(code);
        }
        return value;
    }

    private static long positiveLong(Object value, String code) {
        if (!(value instanceof Number)) throw failure(code);
        try {
            final long result = new BigDecimal(value.toString()).longValueExact();
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
            for (byte item : digest) output.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            return output.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("FORMAL_QUOTE_HASH_UNAVAILABLE", impossible);
        }
    }

    private static IllegalStateException failure(String code) {
        return new IllegalStateException(code);
    }

    private static <T> CompletableFuture<T> failed(RuntimeException error) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private record ParsedRequest(
        JSONObject intent,
        String channelId,
        String tenderId,
        String serviceMode
    ) { }

    private record TenderPolicy(
        List<String> enabledTenderIds,
        List<TenderOption> enabledTenders
    ) { }

    public record TenderOption(String id, String label, String kind) { }

    public record CreatedQuote(
        String state,
        Quote quote,
        DiscountDecision discountDecision,
        List<TenderOption> enabledTenders,
        long validUntilEpochMs
    ) {
        public CreatedQuote {
            enabledTenders = List.copyOf(enabledTenders);
        }
    }
}
