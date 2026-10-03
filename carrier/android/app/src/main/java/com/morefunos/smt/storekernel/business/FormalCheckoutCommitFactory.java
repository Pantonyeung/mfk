package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.BusinessDay;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountDecision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountRow;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountSelection;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Facts;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Line;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Mapping;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.ProposedOutboxEffect;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Quote;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Revision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.RevisionKind;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SecurityEvidence;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SourceIdentity;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Tender;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.TenderKind;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Builds the one closed Store Kernel commit for a trusted, freshly validated checkout. */
public final class FormalCheckoutCommitFactory {
    public static final String ORDER_SCHEMA = "mfp.canonical-order.v1";
    public static final String PAYMENT_SCHEMA = "mfp.canonical-payment.v1";
    public static final String NORMALIZED_INTENT_SCHEMA = "mfp.normalized-ordering-intent.v1";
    private static final long NEW_AGGREGATE_REVISION = 1L;

    private FormalCheckoutCommitFactory() { }

    public static StoreKernelContract.CommitRequest create(
        FormalBusinessCommandContract.CommandEnvelope command,
        Mapping mapping,
        List<StoreKernelContract.AggregateReadDependency> dependencies,
        long commitDeadlineEpochMs
    ) {
        Objects.requireNonNull(command, "FORMAL_CHECKOUT_COMMAND_REQUIRED");
        Objects.requireNonNull(mapping, "FORMAL_CHECKOUT_MAPPING_REQUIRED");
        mapping.requireProductionReady();
        final Facts facts = mapping.order().facts();
        validateIdentity(command, facts);
        validateReview(command, facts);
        validateDependencies(facts, dependencies);
        if (commitDeadlineEpochMs <= 0) throw invalid("FORMAL_CHECKOUT_DEADLINE_INVALID");

        try {
            final JSONObject normalizedIntent = normalizedIntent(facts);
            final JSONObject orderState = orderState(mapping, normalizedIntent);
            final JSONObject paymentState = paymentState(mapping);
            final FormalBusinessCommandContract.Result result = FormalBusinessCommandContract.Result.committed(
                command.submissionId,
                "checkout:" + mapping.order().orderId(),
                NEW_AGGREGATE_REVISION,
                mapping.order().orderId()
            );
            final JSONArray mutations = new JSONArray()
                .put(mutation(
                    "ORDER_DISPLAY_SEQUENCE",
                    facts.day().orderSequenceAggregateId(),
                    facts.day().orderSequenceExpectedRevision(),
                    orderDisplaySequenceState(mapping)
                ))
                .put(mutation("ORDER", mapping.order().orderId(), orderState))
                .put(mutation("PAYMENT", mapping.payment().paymentId(), paymentState));
            final JSONArray outbox = new JSONArray();
            for (ProposedOutboxEffect effect : mapping.generatedOutboxEffects()) {
                outbox.put(outbox(effect, mapping));
            }
            final JSONObject raw = new JSONObject()
                .put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION)
                .put("type", StoreKernelContract.COMMIT)
                .put("requestId", command.requestId)
                .put("commandId", command.submissionId)
                .put("storeId", command.storeId)
                .put("operationId", FormalBusinessCommandRouter.OPERATION_ID)
                .put("idempotencyKey", command.idempotencyKey)
                .put("requestFingerprint", command.requestFingerprint)
                .put("result", new JSONObject(result.toStoredJson()))
                .put("traceId", "formal-checkout:" + mapping.order().orderId())
                .put("committedAt", facts.submission().confirmedAt().toString())
                .put("mutations", mutations)
                .put("outbox", outbox);
            return StoreKernelContract.parseCommit(raw)
                .withReadDependencies(dependencies)
                .withCommitDeadlineEpochMs(commitDeadlineEpochMs);
        } catch (JSONException error) {
            throw new IllegalArgumentException("FORMAL_CHECKOUT_ENCODING_INVALID", error);
        }
    }

    private static void validateIdentity(FormalBusinessCommandContract.CommandEnvelope command, Facts facts) {
        if (!"CHECKOUT_PAYMENT_CONFIRM".equals(command.commandType)) {
            throw invalid("FORMAL_CHECKOUT_COMMAND_TYPE_INVALID");
        }
        if (!command.storeId.equals(facts.submission().storeId())
            || !command.submissionId.equals(facts.submission().submissionId())
            || !command.idempotencyKey.equals(facts.submission().idempotencyKey())
            || !command.requestFingerprint.equals(facts.submission().requestFingerprint())
            || !command.deviceId.equals(facts.security().deviceId())
            || !command.staffSessionRef.equals(facts.security().staffSessionRef())) {
            throw invalid("FORMAL_CHECKOUT_TRUSTED_IDENTITY_MISMATCH");
        }
    }

    private static void validateReview(FormalBusinessCommandContract.CommandEnvelope command, Facts facts) {
        final JSONObject review = command.payload.optJSONObject("review");
        if (review == null || command.payload.optJSONObject("intent") == null) {
            throw invalid("FORMAL_CHECKOUT_PAYLOAD_INVALID");
        }
        final Quote quote = facts.quote();
        final Tender tender = facts.tender();
        if (!quote.quoteRef().equals(text(review, "quoteRef"))
            || !revisionMatches(command.expectedRevision, quote.revision())
            || !revisionMatches(review.opt("formalRevision"), quote.revision())
            || !facts.channelId().equals(text(review, "channelId"))
            || !tender.tenderId().equals(text(review, "tenderId"))
            || exactLong(review, "formalTotalDueMinor") != quote.totalDueMinor()
            || exactLong(review, "formalDiscountMinor") != quote.discountMinor()) {
            throw invalid("FORMAL_CHECKOUT_REVIEW_STALE");
        }
        if (facts.discountDecision().mode() != DiscountMode.NONE
            || (review.has("studentDiscountIntent") && review.opt("studentDiscountIntent") != JSONObject.NULL)) {
            throw invalid("FORMAL_STUDENT_DISCOUNT_POLICY_UNBOUND");
        }
        if (tender.kind() == TenderKind.CASH) {
            if (exactLong(review, "cashReceivedMinor") != tender.cashReceivedMinor()
                || exactLong(review, "changeMinor") != tender.changeMinor()) {
                throw invalid("FORMAL_CHECKOUT_REVIEW_STALE");
            }
        } else if ((review.has("cashReceivedMinor") && review.opt("cashReceivedMinor") != JSONObject.NULL)
            || (review.has("changeMinor") && review.opt("changeMinor") != JSONObject.NULL)) {
            throw invalid("FORMAL_CHECKOUT_REVIEW_STALE");
        }
        final JSONObject source = review.optJSONObject("sourceIdentity");
        if (source == null || !sourceIdentityMatches(source, facts.sourceIdentity())) {
            throw invalid("FORMAL_CHECKOUT_REVIEW_STALE");
        }
    }

    private static boolean sourceIdentityMatches(JSONObject raw, SourceIdentity expected) {
        return optionalText(raw, "customerPhone").equals(optional(expected.customerPhone()))
            && optionalText(raw, "pickupCode").equals(optional(expected.pickupCode()))
            && optionalText(raw, "externalOrderNo").equals(optional(expected.externalOrderNo()));
    }

    private static String optional(String value) {
        return value == null ? "" : value;
    }

    private static String optionalText(JSONObject value, String field) {
        final Object raw = value.opt(field);
        return raw == null || raw == JSONObject.NULL ? "" : raw instanceof String ? (String) raw : "\u0000";
    }

    private static void validateDependencies(
        Facts facts,
        List<StoreKernelContract.AggregateReadDependency> dependencies
    ) {
        if (dependencies == null) throw invalid("FORMAL_CHECKOUT_READ_SET_INVALID");
        final Map<String, StoreKernelContract.AggregateReadDependency> indexed = new HashMap<>();
        for (StoreKernelContract.AggregateReadDependency dependency : dependencies) {
            if (dependency == null || dependency.expectedRevision < 1) {
                throw invalid("FORMAL_CHECKOUT_READ_SET_INVALID");
            }
            final String key = dependency.aggregateType + "\u0000" + dependency.aggregateId;
            if (indexed.put(key, dependency) != null) throw invalid("FORMAL_CHECKOUT_READ_SET_INVALID");
        }
        requireDependency(indexed, "DEVICE_AUTHORIZATION", facts.security().deviceId(), facts.security().deviceRevision());
        requireDependency(indexed, "OWNER_AUTHORIZATION", facts.security().ownerAuthorizationRef(), facts.security().ownerAuthorizationRevision());
        requireDependency(indexed, "STAFF_SESSION", facts.security().staffSessionRef(), facts.security().sessionRevision());
        requireDependency(indexed, "ADMIN_ACTIVE_CONFIGURATION", facts.submission().storeId());
        requireDependency(indexed, "FORMAL_QUOTE", facts.quote().quoteRef());
        requireDependency(indexed, "POS_TENDER_POLICY", facts.submission().storeId());
        requireDependency(indexed, "BUSINESS_DAY", facts.day().businessDayId(), facts.day().revision());
        if (indexed.size() != 7) throw invalid("FORMAL_CHECKOUT_READ_SET_INVALID");
    }

    private static void requireDependency(
        Map<String, StoreKernelContract.AggregateReadDependency> indexed,
        String type,
        String id
    ) {
        if (!indexed.containsKey(type + "\u0000" + id)) throw invalid("FORMAL_CHECKOUT_READ_SET_INCOMPLETE");
    }

    private static void requireDependency(
        Map<String, StoreKernelContract.AggregateReadDependency> indexed,
        String type,
        String id,
        Revision revision
    ) {
        requireDependency(indexed, type, id);
        if (revision.kind() != RevisionKind.NUMBER
            || indexed.get(type + "\u0000" + id).expectedRevision != Long.parseLong(revision.value())) {
            throw invalid("FORMAL_CHECKOUT_READ_SET_REVISION_MISMATCH");
        }
    }

    private static JSONObject normalizedIntent(Facts facts) throws JSONException {
        final JSONTokener parser = new JSONTokener(facts.validatedIntentJson());
        final Object parsed = parser.nextValue();
        if (parser.nextClean() != 0) throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
        if (!(parsed instanceof JSONObject)) throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
        final JSONObject intent = (JSONObject) parsed;
        if (!NORMALIZED_INTENT_SCHEMA.equals(intent.optString("schema", null))
            || !facts.submission().storeId().equals(intent.optString("storeId", null))
            || !Boolean.TRUE.equals(intent.opt("checkoutReady"))) {
            throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
        }
        final JSONArray lines = intent.optJSONArray("lines");
        if (lines == null || lines.length() < 1) throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
        final Map<String, Long> quoteLines = new HashMap<>();
        for (Line line : facts.quote().lines()) quoteLines.put(line.cartLineId(), line.quantity());
        final Set<String> seen = new HashSet<>();
        for (int index = 0; index < lines.length(); index++) {
            final JSONObject line = lines.optJSONObject(index);
            if (line == null) throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
            final String lineId = intentText(line, "cartLineId");
            final Long expectedQuantity = quoteLines.get(lineId);
            if (expectedQuantity == null
                || !seen.add(lineId)
                || exactLong(line, "quantity") != expectedQuantity
                || line.optJSONArray("optionSelections") == null
                || line.optJSONArray("comboSelections") == null
                || !validMaterialPriceFacts(line.optJSONArray("materialPriceFacts"))) {
                throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
            }
            final String kind = intentText(line, "kind");
            intentText(line, "displayName");
            if (("PRODUCT".equals(kind) && !hasText(line, "productId"))
                || ("COMBO".equals(kind) && !hasText(line, "comboId"))
                || (!"PRODUCT".equals(kind) && !"COMBO".equals(kind))) {
                throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
            }
        }
        if (seen.size() != quoteLines.size()) throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
        return new JSONObject(intent.toString());
    }

    private static boolean validMaterialPriceFacts(JSONArray facts) {
        if (facts == null || facts.length() < 1) return false;
        final Set<String> ids = new HashSet<>();
        for (int index = 0; index < facts.length(); index++) {
            final JSONObject fact = facts.optJSONObject(index);
            if (fact == null) return false;
            try {
                if (!ids.add(intentText(fact, "factId")) || !validRawRevision(fact.opt("revision"))) return false;
            } catch (RuntimeException invalid) {
                return false;
            }
        }
        return true;
    }

    private static boolean validRawRevision(Object raw) {
        if (raw instanceof String) {
            final String value = (String) raw;
            return !value.isEmpty() && value.equals(value.trim()) && value.length() <= 160;
        }
        if (!(raw instanceof Number)) return false;
        try {
            final long value = new BigDecimal(raw.toString()).longValueExact();
            return value >= 0 && value <= FormalCheckoutRecords.MAX_SAFE_INTEGER;
        } catch (RuntimeException invalid) {
            return false;
        }
    }

    private static String intentText(JSONObject value, String field) {
        try {
            return text(value, field);
        } catch (RuntimeException error) {
            throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
        }
    }

    private static JSONObject orderState(Mapping mapping, JSONObject normalizedIntent) throws JSONException {
        final Facts facts = mapping.order().facts();
        final String confirmedAt = facts.submission().confirmedAt().toString();
        return new JSONObject()
            .put("schema", ORDER_SCHEMA)
            .put("orderId", mapping.order().orderId())
            .put("storeId", facts.submission().storeId())
            .put("source", mapping.order().source())
            .put("sourcePlatform", "POS")
            .put("displayNumber", facts.day().displayNumber())
            .put("revision", NEW_AGGREGATE_REVISION)
            .put("lifecycleState", mapping.order().lifecycle())
            .put("fulfillmentState", "IN_PROGRESS")
            .put("submissionId", facts.submission().submissionId())
            .put("idempotencyKey", facts.submission().idempotencyKey())
            .put("createdAt", confirmedAt)
            .put("confirmedAt", confirmedAt)
            .put("channelId", facts.channelId())
            .put("effectiveTenderId", facts.tender().tenderId())
            .put("tenderAudit", new JSONArray().put(facts.tender().tenderId()))
            .put("recognizedAmountMinor", facts.quote().totalDueMinor())
            .put("outstandingAmountMinor", 0)
            .put("refundableAmountMinor", facts.quote().totalDueMinor())
            .put("serviceMode", canonicalServiceMode(normalizedIntent))
            .put("items", canonicalItems(facts.quote(), normalizedIntent))
            .put("adjustments", new JSONArray())
            .put("sourceIdentity", sourceIdentity(facts.sourceIdentity()))
            .put("validatedIntentRef", facts.validatedIntentRef())
            .put("validatedIntentHash", facts.validatedIntentHash())
            .put("normalizedIntent", normalizedIntent)
            .put("quote", quote(facts.quote()))
            .put("discountDecision", discount(facts.discountDecision()))
            .put("tender", tender(facts.tender()))
            .put("businessDay", day(facts.day()))
            .put("security", security(facts.security()));
    }

    private static JSONObject orderDisplaySequenceState(Mapping mapping) throws JSONException {
        final BusinessDay day = mapping.order().facts().day();
        return new JSONObject()
            .put("schema", "mfp.order-display-sequence.v1")
            .put("storeId", mapping.order().facts().submission().storeId())
            .put("businessDayId", day.businessDayId())
            .put("businessDate", day.businessDate().toString())
            .put("lastAllocatedSequence", day.allocatedOrderSequence())
            .put("lastDisplayNumber", day.displayNumber())
            .put("lastOrderId", mapping.order().orderId())
            .put("lastSubmissionId", mapping.order().facts().submission().submissionId())
            .put("updatedAt", mapping.order().facts().submission().confirmedAt().toString());
    }

    private static String canonicalServiceMode(JSONObject normalizedIntent) {
        final String mode = intentText(normalizedIntent, "serviceMode");
        if ("takeaway".equalsIgnoreCase(mode)) return "TAKEAWAY";
        if ("dine-in".equalsIgnoreCase(mode) || "dine_in".equalsIgnoreCase(mode)) return "DINE_IN";
        throw invalid("FORMAL_CHECKOUT_INTENT_INVALID");
    }

    private static JSONArray canonicalItems(Quote quote, JSONObject normalizedIntent) throws JSONException {
        final Map<String, Line> quoteLines = new HashMap<>();
        for (Line line : quote.lines()) quoteLines.put(line.cartLineId(), line);
        final JSONArray source = normalizedIntent.getJSONArray("lines");
        final JSONArray items = new JSONArray();
        for (int index = 0; index < source.length(); index++) {
            final JSONObject line = source.getJSONObject(index);
            final String lineId = intentText(line, "cartLineId");
            final Line formal = quoteLines.get(lineId);
            final JSONObject item = new JSONObject()
                .put("lineId", lineId)
                .put("name", intentText(line, "displayName"))
                .put("quantity", formal.quantity())
                .put("unitMinor", formal.formalUnitMinor());
            if ("PRODUCT".equals(line.optString("kind"))) item.put("productId", intentText(line, "productId"));
            else item.put("combo", intentText(line, "comboId"));
            items.put(item);
        }
        return items;
    }

    private static JSONObject paymentState(Mapping mapping) throws JSONException {
        final Facts facts = mapping.order().facts();
        return new JSONObject()
            .put("schema", PAYMENT_SCHEMA)
            .put("paymentId", mapping.payment().paymentId())
            .put("orderId", mapping.order().orderId())
            .put("storeId", facts.submission().storeId())
            .put("status", mapping.payment().status())
            .put("submissionId", facts.submission().submissionId())
            .put("quoteRef", facts.quote().quoteRef())
            .put("formalRevision", revision(facts.quote().revision()))
            .put("currency", facts.quote().currency())
            .put("amountMinor", facts.quote().totalDueMinor())
            .put("confirmedAt", facts.submission().confirmedAt().toString())
            .put("tender", tender(facts.tender()))
            .put("businessDay", day(facts.day()))
            .put("security", security(facts.security()));
    }

    private static JSONObject mutation(String type, String id, JSONObject state) throws JSONException {
        return mutation(type, id, 0, state);
    }

    private static JSONObject mutation(String type, String id, long expectedRevision, JSONObject state) throws JSONException {
        return new JSONObject()
            .put("aggregateType", type)
            .put("aggregateId", id)
            .put("expectedRevision", expectedRevision)
            .put("state", state);
    }

    private static JSONObject outbox(ProposedOutboxEffect effect, Mapping mapping) throws JSONException {
        final JSONObject payload = new JSONObject()
            .put("schema", "MFP_ORDER_COMMITTED_V1".equals(effect.eventType())
                ? "mfp.order-committed.event.v1"
                : "mfp.payment-confirmed.event.v1")
            .put("storeId", mapping.order().facts().submission().storeId())
            .put("submissionId", mapping.order().facts().submission().submissionId())
            .put("orderId", mapping.order().orderId())
            .put("paymentId", mapping.payment().paymentId());
        if ("MFP_ORDER_COMMITTED_V1".equals(effect.eventType())) {
            payload.put("displayNumber", mapping.order().facts().day().displayNumber());
        }
        return new JSONObject()
            .put("eventId", effect.eventId())
            .put("aggregateType", effect.aggregateType())
            .put("aggregateId", effect.aggregateId())
            .put("aggregateRevision", effect.aggregateRevision())
            .put("eventType", effect.eventType())
            .put("occurredAt", mapping.order().facts().submission().confirmedAt().toString())
            .put("payload", payload);
    }

    private static JSONObject sourceIdentity(SourceIdentity value) throws JSONException {
        final JSONObject result = new JSONObject();
        if (value.customerPhone() != null) result.put("customerPhone", value.customerPhone());
        if (value.pickupCode() != null) result.put("pickupCode", value.pickupCode());
        if (value.externalOrderNo() != null) result.put("externalOrderNo", value.externalOrderNo());
        return result;
    }

    private static JSONObject quote(Quote value) throws JSONException {
        final JSONArray lines = new JSONArray();
        for (Line line : value.lines()) lines.put(new JSONObject()
            .put("cartLineId", line.cartLineId())
            .put("quantity", line.quantity())
            .put("formalUnitMinor", line.formalUnitMinor())
            .put("formalLineTotalMinor", line.formalLineTotalMinor())
            .put("studentDiscountEligible", line.studentDiscountEligible()));
        final JSONArray discounts = new JSONArray();
        for (DiscountRow row : value.discounts()) {
            final JSONObject item = new JSONObject()
                .put("code", row.code())
                .put("amountMinor", row.amountMinor());
            if (row.cartLineId() != null) item.put("cartLineId", row.cartLineId());
            if (row.quantity() != null) item.put("quantity", row.quantity());
            discounts.put(item);
        }
        return new JSONObject()
            .put("quoteRef", value.quoteRef())
            .put("formalRevision", revision(value.revision()))
            .put("currency", value.currency())
            .put("lines", lines)
            .put("discounts", discounts)
            .put("formalSubtotalMinor", value.subtotalMinor())
            .put("formalDiscountMinor", value.discountMinor())
            .put("formalTotalDueMinor", value.totalDueMinor())
            .put("acceptedTenderIds", new JSONArray(value.acceptedTenderIds()))
            .put("validatedAt", value.validatedAt().toString());
    }

    private static JSONObject discount(DiscountDecision value) throws JSONException {
        final JSONArray selections = new JSONArray();
        for (DiscountSelection selection : value.selections()) selections.put(new JSONObject()
            .put("cartLineId", selection.cartLineId())
            .put("quantity", selection.quantity()));
        return new JSONObject()
            .put("decisionRef", value.decisionRef())
            .put("policyRevision", revision(value.policyRevision()))
            .put("mode", value.mode().name())
            .put("confirmedStudentCount", value.confirmedStudentCount())
            .put("selections", selections);
    }

    private static JSONObject tender(Tender value) throws JSONException {
        final JSONObject result = new JSONObject()
            .put("tenderId", value.tenderId())
            .put("kind", value.kind().name())
            .put("recordingEvidenceRef", value.recordingEvidenceRef())
            .put("amountMinor", value.amountMinor());
        if (value.cashReceivedMinor() != null) result.put("cashReceivedMinor", value.cashReceivedMinor());
        if (value.changeMinor() != null) result.put("changeMinor", value.changeMinor());
        return result;
    }

    private static JSONObject day(BusinessDay value) throws JSONException {
        return new JSONObject()
            .put("businessDayId", value.businessDayId())
            .put("businessDate", value.businessDate().toString())
            .put("revision", revision(value.revision()))
            .put("classificationEvidenceRef", value.classificationEvidenceRef())
            .put("displayNumber", value.displayNumber())
            .put("orderSequenceAggregateId", value.orderSequenceAggregateId())
            .put("orderSequenceExpectedRevision", value.orderSequenceExpectedRevision())
            .put("allocatedOrderSequence", value.allocatedOrderSequence());
    }

    private static JSONObject security(SecurityEvidence value) throws JSONException {
        return new JSONObject()
            .put("deviceId", value.deviceId())
            .put("deviceRevision", revision(value.deviceRevision()))
            .put("staffSessionRef", value.staffSessionRef())
            .put("sessionRevision", revision(value.sessionRevision()))
            .put("staffId", value.staffId())
            .put("ownerAuthorizationRef", value.ownerAuthorizationRef())
            .put("ownerAuthorizationRevision", revision(value.ownerAuthorizationRevision()));
    }

    private static Object revision(Revision value) {
        return value.kind() == RevisionKind.NUMBER ? Long.parseLong(value.value()) : value.value();
    }

    private static boolean revisionMatches(Object raw, Revision expected) {
        if (expected.kind() == RevisionKind.TEXT) return raw instanceof String && expected.value().equals(raw);
        if (!(raw instanceof Number)) return false;
        try {
            return new BigDecimal(raw.toString()).longValueExact() == Long.parseLong(expected.value());
        } catch (RuntimeException invalid) {
            return false;
        }
    }

    private static String text(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (!(raw instanceof String)) throw invalid("FORMAL_CHECKOUT_REVIEW_INVALID");
        final String text = (String) raw;
        if (text.isEmpty() || !text.equals(text.trim()) || text.length() > 160) {
            throw invalid("FORMAL_CHECKOUT_REVIEW_INVALID");
        }
        return text;
    }

    private static boolean hasText(JSONObject value, String field) {
        try {
            text(value, field);
            return true;
        } catch (RuntimeException invalid) {
            return false;
        }
    }

    private static long exactLong(JSONObject value, String field) {
        final Object raw = value.opt(field);
        if (!(raw instanceof Number)) throw invalid("FORMAL_CHECKOUT_REVIEW_INVALID");
        try {
            final long result = new BigDecimal(raw.toString()).longValueExact();
            if (result < 0 || result > FormalCheckoutRecords.MAX_SAFE_INTEGER) throw new ArithmeticException();
            return result;
        } catch (ArithmeticException | NumberFormatException invalid) {
            throw invalid("FORMAL_CHECKOUT_REVIEW_INVALID");
        }
    }

    private static IllegalArgumentException invalid(String code) {
        return new IllegalArgumentException(code);
    }
}
