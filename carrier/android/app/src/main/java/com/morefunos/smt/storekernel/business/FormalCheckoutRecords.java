package com.morefunos.smt.storekernel.business;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Native-only ORDER/PAYMENT values. No parser or browser may construct these facts.
 */
public final class FormalCheckoutRecords {
    private FormalCheckoutRecords() { }

    public static final long MAX_SAFE_INTEGER = 9_007_199_254_740_991L;
    public enum Phase { FINAL_REVIEW, UNKNOWN, VALIDATED_PAYMENT_CONFIRM }
    public enum TenderKind { CASH, NON_CASH }
    public enum SettlementEvidenceMode { CASH_COUNTED, STAFF_CONFIRMED }
    public enum DiscountMode { NONE, MANUAL, AUTO }
    public enum OutboxBinding { CANONICAL_V1 }
    public enum RevisionKind { TEXT, NUMBER }

    public record Revision(RevisionKind kind, String value) {
        public Revision {
            Objects.requireNonNull(kind);
            Objects.requireNonNull(value);
        }

        public static Revision text(String value) {
            return new Revision(RevisionKind.TEXT, value);
        }

        public static Revision numeric(long value) {
            if (value < 0 || value > MAX_SAFE_INTEGER) throw invalid("REVISION_INVALID");
            return new Revision(RevisionKind.NUMBER, Long.toString(value));
        }
    }

    public record Submission(
        String storeId,
        String submissionId,
        String idempotencyKey,
        String requestFingerprint,
        String confirmationEvidenceRef,
        Instant confirmedAt
    ) { }

    /** Exact native admission lineage, including the parent Owner authorization. */
    public record SecurityEvidence(
        String deviceId,
        Revision deviceRevision,
        String staffSessionRef,
        Revision sessionRevision,
        String staffId,
        String ownerAuthorizationRef,
        Revision ownerAuthorizationRevision
    ) { }

    public record SourceIdentity(String customerPhone, String pickupCode, String externalOrderNo) { }
    public record Line(
        String cartLineId,
        long quantity,
        long formalUnitMinor,
        long formalLineTotalMinor,
        boolean studentDiscountEligible
    ) { }
    public record DiscountRow(String code, long amountMinor, String cartLineId, Long quantity) { }

    public record Quote(
        String quoteRef,
        Revision revision,
        String currency,
        List<Line> lines,
        List<DiscountRow> discounts,
        long subtotalMinor,
        long discountMinor,
        long totalDueMinor,
        List<String> acceptedTenderIds,
        Instant validatedAt
    ) {
        public Quote {
            lines = immutable(lines);
            discounts = immutable(discounts);
            acceptedTenderIds = immutable(acceptedTenderIds);
        }
    }

    public record DiscountSelection(String cartLineId, long quantity) { }

    /** Preserves an upstream policy result; it does not compute eligibility or percentage. */
    public record DiscountDecision(
        String decisionRef,
        Revision policyRevision,
        DiscountMode mode,
        long confirmedStudentCount,
        List<DiscountSelection> selections
    ) {
        public DiscountDecision {
            selections = immutable(selections);
        }
    }

    /** Staff confirmation is an observation, never an electronic-provider settlement claim. */
    public record Tender(
        String tenderId,
        TenderKind kind,
        SettlementEvidenceMode evidenceMode,
        String recordingEvidenceRef,
        long amountMinor,
        Long cashReceivedMinor,
        Long changeMinor
    ) { }

    /** Supplied by native cutoff/timezone classification, never inferred from local midnight. */
    public record BusinessDay(
        String businessDayId,
        LocalDate businessDate,
        Revision revision,
        String classificationEvidenceRef,
        String displayNumber,
        String orderSequenceAggregateId,
        long orderSequenceExpectedRevision,
        long allocatedOrderSequence
    ) { }

    public record Facts(
        Phase phase,
        Submission submission,
        SecurityEvidence security,
        String validatedIntentRef,
        String validatedIntentHash,
        String validatedIntentJson,
        String channelId,
        SourceIdentity sourceIdentity,
        Quote quote,
        DiscountDecision discountDecision,
        Tender tender,
        BusinessDay day
    ) { }

    public record ProposedOrder(String orderId, String source, String lifecycle, Facts facts) { }
    public record ProposedPayment(
        String paymentId,
        String orderId,
        String status,
        Submission submission,
        String quoteRef,
        Revision formalRevision,
        String currency,
        long amountMinor,
        Tender tender,
        BusinessDay day
    ) { }

    public record ProposedOutboxEffect(
        String eventId,
        String aggregateType,
        String aggregateId,
        long aggregateRevision,
        String eventType
    ) { }

    public record Mapping(ProposedOrder order, ProposedPayment payment) {
        public OutboxBinding outboxBinding() {
            return OutboxBinding.CANONICAL_V1;
        }

        public List<ProposedOutboxEffect> generatedOutboxEffects() {
            final Submission submission = order.facts().submission();
            final List<ProposedOutboxEffect> effects = new ArrayList<>();
            effects.add(new ProposedOutboxEffect(
                identity("order-committed-event-v1", submission),
                "ORDER",
                order.orderId(),
                1,
                "MFP_ORDER_COMMITTED_V1"
            ));
            effects.add(new ProposedOutboxEffect(
                identity("payment-confirmed-event-v1", submission),
                "PAYMENT",
                payment.paymentId(),
                1,
                "MFP_PAYMENT_CONFIRMED_V1"
            ));
            return immutable(effects);
        }

        public void requireProductionReady() {
            final List<ProposedOutboxEffect> effects = generatedOutboxEffects();
            if (effects.size() != 2
                || !"ORDER".equals(effects.get(0).aggregateType())
                || !order.orderId().equals(effects.get(0).aggregateId())
                || effects.get(0).aggregateRevision() != 1
                || !"MFP_ORDER_COMMITTED_V1".equals(effects.get(0).eventType())
                || !"PAYMENT".equals(effects.get(1).aggregateType())
                || !payment.paymentId().equals(effects.get(1).aggregateId())
                || effects.get(1).aggregateRevision() != 1
                || !"MFP_PAYMENT_CONFIRMED_V1".equals(effects.get(1).eventType())) {
                throw new IllegalStateException("CHECKOUT_RECORD_SCHEMA_AND_OUTBOX_INVALID");
            }
        }
    }

    public static Mapping map(Facts facts) {
        validate(facts);
        final String orderId = identity("proposed-order-v1", facts.submission());
        final String paymentId = identity("proposed-payment-v1", facts.submission());
        final Quote quote = facts.quote();
        return new Mapping(
            new ProposedOrder(orderId, facts.channelId(), "ACTIVE", facts),
            new ProposedPayment(
                paymentId,
                orderId,
                "CONFIRMED",
                facts.submission(),
                quote.quoteRef(),
                quote.revision(),
                quote.currency(),
                quote.totalDueMinor(),
                facts.tender(),
                facts.day()
            )
        );
    }

    /** Pure conflict check. Durable receipt-first replay remains the Store Kernel's responsibility. */
    public static Mapping reconcile(Mapping existing, Facts facts) {
        Objects.requireNonNull(existing);
        Objects.requireNonNull(facts);
        final Submission prior = existing.order().facts().submission();
        final Submission next = Objects.requireNonNull(facts.submission());
        if (!Objects.equals(prior.storeId(), next.storeId())
            || !Objects.equals(prior.submissionId(), next.submissionId())) {
            throw invalid("SUBMISSION_IDENTITY_MISMATCH");
        }
        if (!existing.order().facts().equals(facts)) throw invalid("SUBMISSION_FACTS_CONFLICT");
        if (!existing.equals(map(facts))) throw invalid("STORED_MAPPING_INCONSISTENT");
        return existing;
    }

    private static void validate(Facts facts) {
        Objects.requireNonNull(facts);
        if (facts.phase() != Phase.VALIDATED_PAYMENT_CONFIRM) {
            throw invalid("VALIDATED_PAYMENT_CONFIRM_REQUIRED");
        }
        final Submission submission = Objects.requireNonNull(facts.submission());
        identifier(submission.storeId());
        identifier(submission.submissionId());
        identifier(submission.idempotencyKey());
        hash(submission.requestFingerprint());
        identifier(submission.confirmationEvidenceRef());
        Objects.requireNonNull(submission.confirmedAt());

        final SecurityEvidence security = Objects.requireNonNull(facts.security());
        identifier(security.deviceId());
        revision(security.deviceRevision());
        identifier(security.staffSessionRef());
        revision(security.sessionRevision());
        identifier(security.staffId());
        identifier(security.ownerAuthorizationRef());
        revision(security.ownerAuthorizationRevision());

        identifier(facts.validatedIntentRef());
        hash(facts.validatedIntentHash());
        if (facts.validatedIntentJson() == null
            || facts.validatedIntentJson().isEmpty()
            || facts.validatedIntentJson().getBytes(StandardCharsets.UTF_8).length > 131_072
            || !facts.validatedIntentHash().equals(sha256(facts.validatedIntentJson()))) {
            throw invalid("VALIDATED_INTENT_INVALID");
        }
        identifier(facts.channelId());
        final SourceIdentity source = Objects.requireNonNull(facts.sourceIdentity());
        optionalIdentifier(source.customerPhone());
        optionalIdentifier(source.pickupCode());
        optionalIdentifier(source.externalOrderNo());

        final Quote quote = Objects.requireNonNull(facts.quote());
        identifier(quote.quoteRef());
        revision(quote.revision());
        identifier(quote.currency());
        Objects.requireNonNull(quote.validatedAt());
        minor(quote.subtotalMinor());
        minor(quote.discountMinor());
        minor(quote.totalDueMinor());
        if (quote.lines().isEmpty()) throw invalid("EMPTY_QUOTE");

        final Map<String, Line> lines = new HashMap<>();
        long subtotal = 0;
        for (Line line : quote.lines()) {
            Objects.requireNonNull(line);
            identifier(line.cartLineId());
            quantity(line.quantity());
            minor(line.formalUnitMinor());
            minor(line.formalLineTotalMinor());
            if (lines.put(line.cartLineId(), line) != null) throw invalid("DUPLICATE_LINE");
            if (multiply(line.formalUnitMinor(), line.quantity()) != line.formalLineTotalMinor()) {
                throw invalid("INCONSISTENT_TOTALS");
            }
            subtotal = add(subtotal, line.formalLineTotalMinor());
        }

        long discounts = 0;
        for (DiscountRow row : quote.discounts()) {
            Objects.requireNonNull(row);
            identifier(row.code());
            minor(row.amountMinor());
            if (row.cartLineId() != null) {
                identifier(row.cartLineId());
                final Line line = lines.get(row.cartLineId());
                if (line == null) throw invalid("DISCOUNT_LINE_UNKNOWN");
                if (row.quantity() != null) {
                    quantity(row.quantity());
                    if (row.quantity() > line.quantity()) throw invalid("DISCOUNT_QUANTITY_INVALID");
                }
            } else if (row.quantity() != null) {
                throw invalid("DISCOUNT_QUANTITY_WITHOUT_LINE");
            }
            discounts = add(discounts, row.amountMinor());
        }
        if (subtotal != quote.subtotalMinor()
            || discounts != quote.discountMinor()
            || discounts > subtotal
            || subtract(subtotal, discounts) != quote.totalDueMinor()) {
            throw invalid("INCONSISTENT_TOTALS");
        }

        final Set<String> accepted = new HashSet<>();
        for (String id : quote.acceptedTenderIds()) {
            identifier(id);
            if (!accepted.add(id)) throw invalid("DUPLICATE_TENDER");
        }

        final DiscountDecision decision = Objects.requireNonNull(facts.discountDecision());
        identifier(decision.decisionRef());
        revision(decision.policyRevision());
        Objects.requireNonNull(decision.mode());
        if (decision.confirmedStudentCount() < 0 || decision.confirmedStudentCount() > MAX_SAFE_INTEGER) {
            throw invalid("DISCOUNT_DECISION_INVALID");
        }
        final Set<String> selections = new HashSet<>();
        long selectedUnits = 0;
        for (DiscountSelection selection : decision.selections()) {
            Objects.requireNonNull(selection);
            identifier(selection.cartLineId());
            quantity(selection.quantity());
            final Line line = lines.get(selection.cartLineId());
            if (line == null
                || !line.studentDiscountEligible()
                || selection.quantity() > line.quantity()
                || !selections.add(selection.cartLineId())) {
                throw invalid("DISCOUNT_DECISION_INVALID");
            }
            selectedUnits = add(selectedUnits, selection.quantity());
        }
        if (selectedUnits > decision.confirmedStudentCount()) throw invalid("DISCOUNT_DECISION_INVALID");
        if (decision.mode() == DiscountMode.NONE
            && (decision.confirmedStudentCount() != 0
                || !decision.selections().isEmpty()
                || quote.discountMinor() != 0
                || !quote.discounts().isEmpty())) {
            throw invalid("DISCOUNT_DECISION_INVALID");
        }

        final Tender tender = Objects.requireNonNull(facts.tender());
        identifier(tender.tenderId());
        identifier(tender.recordingEvidenceRef());
        Objects.requireNonNull(tender.kind());
        if (tender.evidenceMode() == null) throw invalid("SETTLEMENT_EVIDENCE_INVALID");
        minor(tender.amountMinor());
        if (!accepted.contains(tender.tenderId())) throw invalid("TENDER_NOT_IN_FORMAL_QUOTE");
        if (tender.amountMinor() != quote.totalDueMinor()) throw invalid("SETTLEMENT_MISMATCH");
        if (tender.kind() == TenderKind.CASH) {
            if (tender.evidenceMode() != SettlementEvidenceMode.CASH_COUNTED) {
                throw invalid("SETTLEMENT_EVIDENCE_INVALID");
            }
            if (tender.cashReceivedMinor() == null || tender.changeMinor() == null) {
                throw invalid("SETTLEMENT_MISMATCH");
            }
            minor(tender.cashReceivedMinor());
            minor(tender.changeMinor());
            if (tender.cashReceivedMinor() < tender.amountMinor()
                || subtract(tender.cashReceivedMinor(), tender.amountMinor()) != tender.changeMinor()) {
                throw invalid("SETTLEMENT_MISMATCH");
            }
        } else {
            if (tender.evidenceMode() != SettlementEvidenceMode.STAFF_CONFIRMED) {
                throw invalid("SETTLEMENT_EVIDENCE_INVALID");
            }
            if (tender.cashReceivedMinor() != null || tender.changeMinor() != null) {
                throw invalid("SETTLEMENT_MISMATCH");
            }
        }

        final BusinessDay day = Objects.requireNonNull(facts.day());
        identifier(day.businessDayId());
        Objects.requireNonNull(day.businessDate());
        revision(day.revision());
        identifier(day.classificationEvidenceRef());
        identifier(day.displayNumber());
        identifier(day.orderSequenceAggregateId());
        if (day.orderSequenceExpectedRevision() < 0
            || day.orderSequenceExpectedRevision() >= MAX_SAFE_INTEGER
            || day.allocatedOrderSequence() < 1
            || day.allocatedOrderSequence() > MAX_SAFE_INTEGER) {
            throw invalid("ORDER_DISPLAY_ALLOCATION_INVALID");
        }
    }

    private static void revision(Revision revision) {
        Objects.requireNonNull(revision);
        if (revision.kind() == RevisionKind.TEXT) {
            identifier(revision.value());
            return;
        }
        try {
            final long parsed = Long.parseLong(revision.value());
            if (parsed < 0
                || parsed > MAX_SAFE_INTEGER
                || !Long.toString(parsed).equals(revision.value())) throw invalid("REVISION_INVALID");
        } catch (NumberFormatException invalid) {
            throw invalid("REVISION_INVALID");
        }
    }

    private static void hash(String value) {
        if (value == null || !value.matches("[0-9a-f]{64}")) throw invalid("HASH_INVALID");
    }

    private static void optionalIdentifier(String value) {
        if (value != null) identifier(value);
    }

    private static void identifier(String value) {
        if (value == null || value.isEmpty() || value.length() > 160 || !value.equals(value.trim())) {
            throw invalid("IDENTIFIER_INVALID");
        }
        for (int index = 0; index < value.length(); index++) {
            final char character = value.charAt(index);
            if (Character.isISOControl(character)) throw invalid("IDENTIFIER_INVALID");
            if (Character.isHighSurrogate(character)) {
                if (++index >= value.length() || !Character.isLowSurrogate(value.charAt(index))) {
                    throw invalid("IDENTIFIER_INVALID");
                }
            } else if (Character.isLowSurrogate(character)) {
                throw invalid("IDENTIFIER_INVALID");
            }
        }
    }

    private static void quantity(long value) {
        if (value < 1 || value > MAX_SAFE_INTEGER) throw invalid("QUANTITY_INVALID");
    }

    private static long minor(long value) {
        if (value < 0 || value > MAX_SAFE_INTEGER) throw invalid("MINOR_INVALID");
        return value;
    }

    private static long checkedResult(long value) {
        if (value < 0 || value > MAX_SAFE_INTEGER) throw invalid("MINOR_OVERFLOW");
        return value;
    }

    private static long add(long left, long right) {
        try {
            return checkedResult(Math.addExact(left, right));
        } catch (ArithmeticException invalid) {
            throw invalid("MINOR_OVERFLOW");
        }
    }

    private static long multiply(long left, long right) {
        try {
            return checkedResult(Math.multiplyExact(left, right));
        } catch (ArithmeticException invalid) {
            throw invalid("MINOR_OVERFLOW");
        }
    }

    private static long subtract(long left, long right) {
        try {
            return checkedResult(Math.subtractExact(left, right));
        } catch (ArithmeticException invalid) {
            throw invalid("MINOR_OVERFLOW");
        }
    }

    private static String identity(String domain, Submission submission) {
        try {
            final MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String part : new String[] {domain, submission.storeId(), submission.submissionId()}) {
                final byte[] bytes = part.getBytes(StandardCharsets.UTF_8);
                final int length = bytes.length;
                digest.update(new byte[] {
                    (byte) (length >>> 24),
                    (byte) (length >>> 16),
                    (byte) (length >>> 8),
                    (byte) length
                });
                digest.update(bytes);
            }
            final StringBuilder result = new StringBuilder(domain).append('-');
            for (byte item : digest.digest()) {
                result.append(Character.forDigit((item >>> 4) & 15, 16));
                result.append(Character.forDigit(item & 15, 16));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA256_UNAVAILABLE", impossible);
        }
    }

    private static String sha256(String value) {
        try {
            final MessageDigest digest = MessageDigest.getInstance("SHA-256");
            final StringBuilder result = new StringBuilder(64);
            for (byte item : digest.digest(value.getBytes(StandardCharsets.UTF_8))) {
                result.append(Character.forDigit((item >>> 4) & 15, 16));
                result.append(Character.forDigit(item & 15, 16));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA256_UNAVAILABLE", impossible);
        }
    }

    private static <T> List<T> immutable(List<T> values) {
        if (values == null) throw new NullPointerException("CHECKOUT_RECORD_LIST_REQUIRED");
        return Collections.unmodifiableList(new ArrayList<>(values));
    }

    private static IllegalArgumentException invalid(String code) {
        return new IllegalArgumentException(code);
    }
}
