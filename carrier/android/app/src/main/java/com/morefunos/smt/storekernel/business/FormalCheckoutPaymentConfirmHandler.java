package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.BusinessDay;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.DiscountDecision;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Facts;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Mapping;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Phase;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Quote;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SecurityEvidence;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.SourceIdentity;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Submission;
import com.morefunos.smt.storekernel.business.FormalCheckoutRecords.Tender;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Native CHECKOUT_PAYMENT_CONFIRM assembler. Every port is a trusted native producer;
 * browser payload is used only as a claim that must match these freshly read facts.
 */
public final class FormalCheckoutPaymentConfirmHandler implements FormalBusinessCommandRouter.Handler {
    @FunctionalInterface
    public interface SecurityPort {
        CompletableFuture<SecuritySnapshot> read(FormalBusinessCommandContract.CommandEnvelope command);
    }

    @FunctionalInterface
    public interface PricingPort {
        CompletableFuture<PricingSnapshot> validate(FormalBusinessCommandContract.CommandEnvelope command);
    }

    @FunctionalInterface
    public interface TenderPort {
        CompletableFuture<TenderSnapshot> validate(
            FormalBusinessCommandContract.CommandEnvelope command,
            PricingSnapshot pricing
        );
    }

    @FunctionalInterface
    public interface BusinessDayPort {
        CompletableFuture<BusinessDaySnapshot> readActive(FormalBusinessCommandContract.CommandEnvelope command);
    }

    public interface Clock {
        long epochMillis();
        Instant instant();
    }

    public record SecuritySnapshot(
        SecurityEvidence evidence,
        List<StoreKernelContract.AggregateReadDependency> dependencies,
        long validUntilEpochMs
    ) {
        public SecuritySnapshot {
            Objects.requireNonNull(evidence, "FORMAL_CHECKOUT_SECURITY_FACTS_REQUIRED");
            dependencies = immutableDependencies(dependencies);
            validUntilEpochMs = positiveDeadline(validUntilEpochMs);
        }
    }

    public record PricingSnapshot(
        String validatedIntentRef,
        String validatedIntentHash,
        String validatedIntentJson,
        String channelId,
        SourceIdentity sourceIdentity,
        Quote quote,
        DiscountDecision discountDecision,
        List<StoreKernelContract.AggregateReadDependency> dependencies,
        long validUntilEpochMs
    ) {
        public PricingSnapshot {
            Objects.requireNonNull(sourceIdentity, "FORMAL_CHECKOUT_SOURCE_IDENTITY_REQUIRED");
            Objects.requireNonNull(quote, "FORMAL_CHECKOUT_QUOTE_REQUIRED");
            Objects.requireNonNull(discountDecision, "FORMAL_CHECKOUT_DISCOUNT_REQUIRED");
            dependencies = immutableDependencies(dependencies);
            validUntilEpochMs = positiveDeadline(validUntilEpochMs);
        }
    }

    public record TenderSnapshot(
        Tender tender,
        String confirmationEvidenceRef,
        List<StoreKernelContract.AggregateReadDependency> dependencies,
        long validUntilEpochMs
    ) {
        public TenderSnapshot {
            Objects.requireNonNull(tender, "FORMAL_CHECKOUT_TENDER_REQUIRED");
            dependencies = immutableDependencies(dependencies);
            validUntilEpochMs = positiveDeadline(validUntilEpochMs);
        }
    }

    public record BusinessDaySnapshot(
        BusinessDay day,
        List<StoreKernelContract.AggregateReadDependency> dependencies,
        long validUntilEpochMs
    ) {
        public BusinessDaySnapshot {
            Objects.requireNonNull(day, "FORMAL_CHECKOUT_BUSINESS_DAY_REQUIRED");
            dependencies = immutableDependencies(dependencies);
            validUntilEpochMs = positiveDeadline(validUntilEpochMs);
        }
    }

    private record Partial(
        SecuritySnapshot security,
        PricingSnapshot pricing,
        TenderSnapshot tender
    ) { }

    private record Prepared(Partial partial, BusinessDaySnapshot day) { }

    private final SecurityPort security;
    private final PricingPort pricing;
    private final TenderPort tender;
    private final BusinessDayPort businessDay;
    private final Clock clock;

    public FormalCheckoutPaymentConfirmHandler(
        SecurityPort security,
        PricingPort pricing,
        TenderPort tender,
        BusinessDayPort businessDay,
        Clock clock
    ) {
        this.security = Objects.requireNonNull(security, "FORMAL_CHECKOUT_SECURITY_PORT_REQUIRED");
        this.pricing = Objects.requireNonNull(pricing, "FORMAL_CHECKOUT_PRICING_PORT_REQUIRED");
        this.tender = Objects.requireNonNull(tender, "FORMAL_CHECKOUT_TENDER_PORT_REQUIRED");
        this.businessDay = Objects.requireNonNull(businessDay, "FORMAL_CHECKOUT_BUSINESS_DAY_PORT_REQUIRED");
        this.clock = Objects.requireNonNull(clock, "FORMAL_CHECKOUT_CLOCK_REQUIRED");
    }

    @Override
    public CompletableFuture<FormalBusinessCommandRouter.Outcome> prepare(
        FormalBusinessCommandContract.CommandEnvelope command
    ) {
        if (command == null || !"CHECKOUT_PAYMENT_CONFIRM".equals(command.commandType)) {
            return CompletableFuture.completedFuture(FormalBusinessCommandRouter.Outcome.rejected(
                "FORMAL_CHECKOUT_COMMAND_TYPE_INVALID"
            ));
        }
        final long preparedAtEpochMs;
        final Instant confirmedAt;
        try {
            preparedAtEpochMs = clock.epochMillis();
            confirmedAt = Objects.requireNonNull(clock.instant(), "FORMAL_CHECKOUT_CLOCK_INVALID");
            if (preparedAtEpochMs < 0 || Math.abs(confirmedAt.toEpochMilli() - preparedAtEpochMs) > 1_000L) {
                throw new IllegalStateException("FORMAL_CHECKOUT_CLOCK_INVALID");
            }
        } catch (RuntimeException error) {
            return failed(error);
        }

        final CompletableFuture<SecuritySnapshot> securityFuture;
        final CompletableFuture<PricingSnapshot> pricingFuture;
        final CompletableFuture<BusinessDaySnapshot> dayFuture;
        try {
            securityFuture = requireFuture(security.read(command));
            pricingFuture = requireFuture(pricing.validate(command));
            dayFuture = requireFuture(businessDay.readActive(command));
        } catch (RuntimeException error) {
            return failed(error);
        }

        return pricingFuture.thenCompose(pricingSnapshot -> {
            try {
                return requireFuture(tender.validate(command, pricingSnapshot))
                    .thenCombine(securityFuture, (tenderSnapshot, securitySnapshot) ->
                        new Partial(securitySnapshot, pricingSnapshot, tenderSnapshot));
            } catch (RuntimeException error) {
                return failed(error);
            }
        }).thenCombine(dayFuture, Prepared::new).thenApply(prepared -> {
            final Partial partial = prepared.partial();
            final long deadline = Math.min(
                Math.min(partial.security().validUntilEpochMs(), partial.pricing().validUntilEpochMs()),
                Math.min(partial.tender().validUntilEpochMs(), prepared.day().validUntilEpochMs())
            );
            if (preparedAtEpochMs >= deadline) {
                return FormalBusinessCommandRouter.Outcome.rejected("FORMAL_CHECKOUT_FRESHNESS_EXPIRED");
            }
            final PricingSnapshot price = partial.pricing();
            final Facts facts = new Facts(
                Phase.VALIDATED_PAYMENT_CONFIRM,
                new Submission(
                    command.storeId,
                    command.submissionId,
                    command.idempotencyKey,
                    command.requestFingerprint,
                    partial.tender().confirmationEvidenceRef(),
                    confirmedAt
                ),
                partial.security().evidence(),
                price.validatedIntentRef(),
                price.validatedIntentHash(),
                price.validatedIntentJson(),
                price.channelId(),
                price.sourceIdentity(),
                price.quote(),
                price.discountDecision(),
                partial.tender().tender(),
                prepared.day().day()
            );
            final Mapping mapping = FormalCheckoutRecords.map(facts);
            final List<StoreKernelContract.AggregateReadDependency> dependencies = mergeDependencies(
                partial.security().dependencies(),
                price.dependencies(),
                partial.tender().dependencies(),
                prepared.day().dependencies()
            );
            return FormalBusinessCommandRouter.Outcome.commit(
                FormalCheckoutCommitFactory.create(command, mapping, dependencies, deadline)
            );
        });
    }

    private static <T> CompletableFuture<T> requireFuture(CompletableFuture<T> value) {
        if (value == null) throw new IllegalStateException("FORMAL_CHECKOUT_PORT_RESULT_INVALID");
        return value;
    }

    private static <T> CompletableFuture<T> failed(Throwable error) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private static List<StoreKernelContract.AggregateReadDependency> immutableDependencies(
        List<StoreKernelContract.AggregateReadDependency> input
    ) {
        if (input == null) throw new IllegalArgumentException("FORMAL_CHECKOUT_READ_SET_INVALID");
        final List<StoreKernelContract.AggregateReadDependency> output = new ArrayList<>();
        for (StoreKernelContract.AggregateReadDependency dependency : input) {
            output.add(Objects.requireNonNull(dependency, "FORMAL_CHECKOUT_READ_SET_INVALID"));
        }
        return Collections.unmodifiableList(output);
    }

    @SafeVarargs
    private static List<StoreKernelContract.AggregateReadDependency> mergeDependencies(
        List<StoreKernelContract.AggregateReadDependency>... sources
    ) {
        final Map<String, StoreKernelContract.AggregateReadDependency> merged = new LinkedHashMap<>();
        for (List<StoreKernelContract.AggregateReadDependency> source : sources) {
            for (StoreKernelContract.AggregateReadDependency dependency : source) {
                final String key = dependency.aggregateType + "\u0000" + dependency.aggregateId;
                final StoreKernelContract.AggregateReadDependency prior = merged.putIfAbsent(key, dependency);
                if (prior != null && prior.expectedRevision != dependency.expectedRevision) {
                    throw new IllegalStateException("FORMAL_CHECKOUT_SOURCE_REVISION_MISMATCH");
                }
            }
        }
        return new ArrayList<>(merged.values());
    }

    private static long positiveDeadline(long value) {
        if (value < 1) throw new IllegalArgumentException("FORMAL_CHECKOUT_FRESHNESS_INVALID");
        return value;
    }
}
