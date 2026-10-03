package com.morefunos.smt.storekernel.business;

import static com.morefunos.smt.storekernel.business.FormalCheckoutRecords.MAX_SAFE_INTEGER;
import static com.morefunos.smt.storekernel.business.FormalCheckoutRecords.map;
import static com.morefunos.smt.storekernel.business.FormalCheckoutRecords.reconcile;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.BusinessDay;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountDecision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountMode;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountRow;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountSelection;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Facts;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Line;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Mapping;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.OutboxBinding;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Phase;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.ProposedPayment;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Quote;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Revision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.RevisionKind;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SecurityEvidence;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SourceIdentity;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Submission;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Tender;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.TenderKind;

import org.junit.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public final class FormalCheckoutRecordsTest {
    @Test
    public void mapsValidatedFactsToLinkedDeterministicRecordsButKeepsOutboxUnbound() {
        final Facts facts = sample("store-1", "submission-1");
        final Mapping mapped = map(facts);

        assertEquals(facts, mapped.order().facts());
        assertEquals("POS", mapped.order().source());
        assertEquals("CONFIRMED", mapped.order().lifecycle());
        assertEquals("CONFIRMED", mapped.payment().status());
        assertEquals(mapped.order().orderId(), mapped.payment().orderId());
        assertEquals(1_500, mapped.payment().amountMinor());
        assertEquals(facts.tender(), mapped.payment().tender());
        assertEquals(facts.day(), mapped.payment().day());
        assertEquals(mapped.order().orderId(), map(facts).order().orderId());
        assertFalse(mapped.order().orderId().equals(mapped.payment().paymentId()));
        assertFalse(mapped.order().orderId().equals(map(sample("store-2", "submission-1")).order().orderId()));
        assertFalse(map(sample("ab", "c")).order().orderId().equals(map(sample("a", "bc")).order().orderId()));
        assertSame(mapped, reconcile(mapped, facts));
        assertEquals(OutboxBinding.UNBOUND, mapped.outboxBinding());
        assertTrue(mapped.generatedOutboxEffects().isEmpty());
        expectCode("CHECKOUT_RECORD_SCHEMA_AND_OUTBOX_UNBOUND", mapped::requireProductionReady);
    }

    @Test
    public void rejectsWrongPhaseTotalsOverflowAndMalformedQuote() {
        final Facts facts = sample("store-1", "submission-1");
        final Quote quote = facts.quote();
        expectCode("VALIDATED_PAYMENT_CONFIRM_REQUIRED", () -> map(withPhase(facts, Phase.FINAL_REVIEW)));
        expectCode("VALIDATED_PAYMENT_CONFIRM_REQUIRED", () -> map(withPhase(facts, Phase.UNKNOWN)));
        expectCode("INCONSISTENT_TOTALS", () -> map(withQuote(facts, quote("q", 2_001, 500, 1_501))));
        expectCode("INCONSISTENT_TOTALS", () -> map(withQuote(facts, quote("q", 2_000, 500, 1_501))));
        expectCode("INCONSISTENT_TOTALS", () -> map(withQuote(facts, quote("q", 2_000, 501, 1_499))));
        expectCode("MINOR_INVALID", () -> map(withQuote(facts, quote("q", -1, 500, 1_500))));
        expectCode("MINOR_INVALID", () -> map(withQuote(facts, quote("q", MAX_SAFE_INTEGER + 1, 500, 1_500))));
        expectCode("MINOR_OVERFLOW", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD",
            List.of(new Line("L", MAX_SAFE_INTEGER, MAX_SAFE_INTEGER, 0, false)),
            List.of(), 0, 0, 0, List.of("CASH"), quote.validatedAt()
        ))));
        expectCode("MINOR_OVERFLOW", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD",
            List.of(
                new Line("L1", 1, MAX_SAFE_INTEGER, MAX_SAFE_INTEGER, false),
                new Line("L2", 1, 1, 1, false)
            ),
            List.of(), MAX_SAFE_INTEGER, 0, MAX_SAFE_INTEGER, List.of("CASH"), quote.validatedAt()
        ))));
        expectCode("DUPLICATE_LINE", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", List.of(quote.lines().get(0), quote.lines().get(0)),
            quote.discounts(), 4_000, 500, 3_500, quote.acceptedTenderIds(), quote.validatedAt()
        ))));
        expectCode("EMPTY_QUOTE", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", List.of(), List.of(), 0, 0, 0, List.of("CASH"), quote.validatedAt()
        ))));
        expectCode("MINOR_OVERFLOW", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", quote.lines(),
            List.of(
                new DiscountRow("A", MAX_SAFE_INTEGER, null, null),
                new DiscountRow("B", 1, null, null)
            ),
            2_000, 0, 2_000, quote.acceptedTenderIds(), quote.validatedAt()
        ))));
    }

    @Test
    public void rejectsTenderDiscountIdentityAndRevisionConflicts() {
        final Facts facts = sample("store-1", "submission-1");
        final Quote quote = facts.quote();
        expectCode("TENDER_NOT_IN_FORMAL_QUOTE", () -> map(withTender(
            facts, new Tender("OTHER", TenderKind.NON_CASH, "e", 1_500, null, null)
        )));
        expectCode("SETTLEMENT_MISMATCH", () -> map(withTender(
            facts, new Tender("CASH", TenderKind.CASH, "e", 1_500, 1_000L, 0L)
        )));
        expectCode("SETTLEMENT_MISMATCH", () -> map(withTender(
            facts, new Tender("CASH", TenderKind.CASH, "e", 1_500, 2_000L, 400L)
        )));
        expectCode("SETTLEMENT_MISMATCH", () -> map(withTender(
            facts, new Tender("CASH", TenderKind.CASH, "e", 1_600, 2_000L, 400L)
        )));
        expectCode("SETTLEMENT_MISMATCH", () -> map(withTender(
            facts, new Tender("CASH", TenderKind.NON_CASH, "e", 1_500, 2_000L, 500L)
        )));
        expectCode("IDENTIFIER_INVALID", () -> map(sample("bad\u0000store", "s")));
        expectCode("IDENTIFIER_INVALID", () -> map(sample("bad\ud800store", "s")));
        expectCode("DISCOUNT_LINE_UNKNOWN", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", quote.lines(),
            List.of(new DiscountRow("STUDENT", 500, "unknown", 1L)),
            2_000, 500, 1_500, quote.acceptedTenderIds(), quote.validatedAt()
        ))));
        expectCode("DISCOUNT_QUANTITY_WITHOUT_LINE", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", quote.lines(),
            List.of(new DiscountRow("STUDENT", 500, null, 1L)),
            2_000, 500, 1_500, quote.acceptedTenderIds(), quote.validatedAt()
        ))));
        expectCode("DUPLICATE_TENDER", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", quote.lines(), quote.discounts(),
            2_000, 500, 1_500, List.of("CASH", "CASH"), quote.validatedAt()
        ))));
        expectCode("DISCOUNT_DECISION_INVALID", () -> map(withQuote(facts, new Quote(
            "q", quote.revision(), "HKD", List.of(new Line("line-1", 2, 1_000, 2_000, false)),
            quote.discounts(), 2_000, 500, 1_500, quote.acceptedTenderIds(), quote.validatedAt()
        ))));
        assertFalse(Revision.numeric(1).equals(Revision.text("1")));
        expectCode("REVISION_INVALID", () -> Revision.numeric(-1));
        expectCode("REVISION_INVALID", () -> map(withQuote(facts, new Quote(
            "q", new Revision(RevisionKind.NUMBER, "01"), "HKD", quote.lines(), quote.discounts(),
            2_000, 500, 1_500, quote.acceptedTenderIds(), quote.validatedAt()
        ))));
    }

    @Test
    public void preservesImmutableSecurityAndSubmissionEvidenceAcrossReplay() {
        final Facts facts = sample("store-1", "submission-1");
        final Quote quote = facts.quote();
        final ArrayList<Line> mutable = new ArrayList<>(quote.lines());
        final Quote immutable = new Quote(
            "q", quote.revision(), "HKD", mutable, quote.discounts(),
            2_000, 500, 1_500, quote.acceptedTenderIds(), quote.validatedAt()
        );
        mutable.clear();
        assertEquals(1, immutable.lines().size());
        assertThrows(UnsupportedOperationException.class, immutable.lines()::clear);

        final Mapping mapped = map(facts);
        final Facts nonCash = withTender(
            facts,
            new Tender("FPS", TenderKind.NON_CASH, "native-record-ref", 1_500, null, null)
        );
        assertEquals("FPS", map(nonCash).payment().tender().tenderId());
        final Facts changed = withQuote(facts, quote("changed-quote", 2_000, 500, 1_500));
        assertEquals(mapped.order().orderId(), map(changed).order().orderId());
        expectCode("SUBMISSION_FACTS_CONFLICT", () -> reconcile(mapped, nonCash));
        expectCode("SUBMISSION_IDENTITY_MISMATCH", () -> reconcile(mapped, sample("store-1", "submission-2")));
        expectCode("SUBMISSION_FACTS_CONFLICT", () -> reconcile(mapped, new Facts(
            facts.phase(),
            new Submission("store-1", "submission-1", "other-idempotency", "a".repeat(64), "confirmation-1", facts.submission().confirmedAt()),
            facts.security(), facts.validatedIntentRef(), facts.validatedIntentHash(), facts.channelId(), facts.sourceIdentity(),
            quote, facts.discountDecision(), facts.tender(), facts.day()
        )));
        final SecurityEvidence changedOwner = new SecurityEvidence(
            facts.security().deviceId(), facts.security().deviceRevision(), facts.security().staffSessionRef(),
            facts.security().sessionRevision(), facts.security().staffId(), "other-owner-auth", Revision.numeric(2)
        );
        expectCode("SUBMISSION_FACTS_CONFLICT", () -> reconcile(mapped, new Facts(
            facts.phase(), facts.submission(), changedOwner, facts.validatedIntentRef(), facts.validatedIntentHash(),
            facts.channelId(), facts.sourceIdentity(), quote, facts.discountDecision(), facts.tender(), facts.day()
        )));
        expectCode("SUBMISSION_FACTS_CONFLICT", () -> reconcile(mapped, new Facts(
            facts.phase(), facts.submission(), facts.security(), facts.validatedIntentRef(), facts.validatedIntentHash(),
            facts.channelId(), facts.sourceIdentity(), quote, facts.discountDecision(), facts.tender(),
            new BusinessDay("day-2", facts.day().businessDate(), facts.day().revision(), facts.day().classificationEvidenceRef())
        )));
        final ProposedPayment wrongPayment = map(sample("store-2", "submission-1")).payment();
        expectCode("STORED_MAPPING_INCONSISTENT", () -> reconcile(new Mapping(mapped.order(), wrongPayment), facts));
    }

    @Test
    public void preservesValidZeroAndMaximumMinorValuesWithoutProviderInference() {
        final Facts facts = sample("store-1", "submission-1");
        for (long amount : new long[] {0L, 1L, MAX_SAFE_INTEGER}) {
            final Quote edge = new Quote(
                "edge", Revision.numeric(0), "HKD",
                List.of(new Line("line-1", 1, amount, amount, false)),
                List.of(), amount, 0, amount, List.of("FUTURE_NATIVE_TENDER"), facts.quote().validatedAt()
            );
            final Facts edgeFacts = new Facts(
                facts.phase(), facts.submission(), facts.security(), facts.validatedIntentRef(), facts.validatedIntentHash(),
                facts.channelId(), facts.sourceIdentity(), edge,
                new DiscountDecision("no-discount-decision", Revision.text("policy"), DiscountMode.NONE, 0, List.of()),
                new Tender("FUTURE_NATIVE_TENDER", TenderKind.NON_CASH, "native-evidence", amount, null, null),
                facts.day()
            );
            assertEquals(amount, map(edgeFacts).payment().amountMinor());
        }
    }

    private static Facts sample(String store, String submission) {
        return new Facts(
            Phase.VALIDATED_PAYMENT_CONFIRM,
            new Submission(
                store, submission, "idem-1", "a".repeat(64), "confirmation-1",
                Instant.parse("2026-10-02T16:00:00Z")
            ),
            new SecurityEvidence(
                "device-1", Revision.numeric(2), "staff-session-1", Revision.numeric(3), "staff-1",
                "owner-authorization-1", Revision.numeric(4)
            ),
            "validated-intent-1",
            "b".repeat(64),
            "WALK_IN",
            new SourceIdentity(null, null, null),
            quote("quote-1", 2_000, 500, 1_500),
            new DiscountDecision(
                "decision-1", Revision.text("policy-4"), DiscountMode.MANUAL, 1,
                List.of(new DiscountSelection("line-1", 1))
            ),
            new Tender("CASH", TenderKind.CASH, "settlement-evidence-1", 1_500, 2_000L, 500L),
            new BusinessDay(
                "day-1", LocalDate.parse("2026-10-03"), Revision.numeric(8), "classification-evidence-1"
            )
        );
    }

    private static Quote quote(String reference, long subtotal, long discount, long total) {
        return new Quote(
            reference,
            Revision.text("price-3"),
            "HKD",
            List.of(new Line("line-1", 2, 1_000, 2_000, true)),
            List.of(new DiscountRow("STUDENT", 500, "line-1", 1L)),
            subtotal,
            discount,
            total,
            List.of("CASH", "FPS"),
            Instant.parse("2026-10-02T15:59:00Z")
        );
    }

    private static Facts withQuote(Facts facts, Quote quote) {
        return copy(facts, facts.phase(), quote, facts.tender());
    }

    private static Facts withTender(Facts facts, Tender tender) {
        return copy(facts, facts.phase(), facts.quote(), tender);
    }

    private static Facts withPhase(Facts facts, Phase phase) {
        return copy(facts, phase, facts.quote(), facts.tender());
    }

    private static Facts copy(Facts facts, Phase phase, Quote quote, Tender tender) {
        return new Facts(
            phase, facts.submission(), facts.security(), facts.validatedIntentRef(), facts.validatedIntentHash(),
            facts.channelId(), facts.sourceIdentity(), quote, facts.discountDecision(), tender, facts.day()
        );
    }

    private static void expectCode(String code, Runnable action) {
        final RuntimeException error = assertThrows(RuntimeException.class, action::run);
        assertEquals(code, error.getMessage());
    }
}
