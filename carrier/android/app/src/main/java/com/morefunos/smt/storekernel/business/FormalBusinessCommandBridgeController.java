package com.morefunos.smt.storekernel.business;

import android.content.Context;

import androidx.annotation.NonNull;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;

import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.LongSupplier;

public final class FormalBusinessCommandBridgeController implements AutoCloseable {
    public interface Notifier {
        void post(String json);
    }

    private final FormalBusinessCommandRouter router;
    private final Notifier notifier;
    private final StoreKernelTransactionCoordinator coordinator;
    private final FormalCheckoutRoomSecurityProducer checkoutSecurity;
    private final FormalQuoteRoomProducer quoteProducer;

    private static final long DEFAULT_QUOTE_TTL_MS = 120_000L;

    public static FormalBusinessCommandBridgeController open(@NonNull Context context, @NonNull Notifier notifier) {
        final StoreKernelTransactionCoordinator coordinator = StoreKernelTransactionCoordinator.open(context);
        return createBound(coordinator, notifier, System::currentTimeMillis, DEFAULT_QUOTE_TTL_MS, coordinator);
    }

    public static FormalBusinessCommandBridgeController createBound(
        StoreKernelTransactionCoordinator coordinator,
        Notifier notifier,
        LongSupplier clock,
        long quoteTtlMs
    ) {
        return createBound(coordinator, notifier, clock, quoteTtlMs, null);
    }

    private static FormalBusinessCommandBridgeController createBound(
        StoreKernelTransactionCoordinator coordinator,
        Notifier notifier,
        LongSupplier clock,
        long quoteTtlMs,
        StoreKernelTransactionCoordinator ownedCoordinator
    ) {
        final FormalCheckoutRoomSecurityProducer security = new FormalCheckoutRoomSecurityProducer(
            coordinator,
            clock
        );
        final FormalCheckoutPaymentConfirmHandler.Clock checkoutClock = new FormalCheckoutPaymentConfirmHandler.Clock() {
            @Override public long epochMillis() { return clock.getAsLong(); }
            @Override public Instant instant() { return Instant.ofEpochMilli(clock.getAsLong()); }
        };
        final FormalCheckoutPaymentConfirmHandler checkout = new FormalCheckoutPaymentConfirmHandler(
            security,
            new FormalCheckoutRoomPricingProducer(coordinator, clock),
            new FormalCheckoutRoomTenderProducer(coordinator),
            new FormalCheckoutRoomBusinessDayProducer(coordinator, clock),
            checkoutClock
        );
        final Map<String, FormalBusinessCommandRouter.Handler> handlers = new LinkedHashMap<>(
            FormalBusinessCommandRouter.blockedHandlers()
        );
        handlers.put("CHECKOUT_PAYMENT_CONFIRM", checkout);
        return new FormalBusinessCommandBridgeController(
            new FormalBusinessCommandRouter(new CoordinatorGateway(coordinator), security, handlers),
            notifier,
            ownedCoordinator,
            security,
            new FormalQuoteRoomProducer(coordinator, clock, quoteTtlMs)
        );
    }

    public FormalBusinessCommandBridgeController(FormalBusinessCommandRouter router, Notifier notifier) {
        this(router, notifier, null, null, null);
    }

    private FormalBusinessCommandBridgeController(
        FormalBusinessCommandRouter router,
        Notifier notifier,
        StoreKernelTransactionCoordinator coordinator,
        FormalCheckoutRoomSecurityProducer checkoutSecurity,
        FormalQuoteRoomProducer quoteProducer
    ) {
        this.router = router;
        this.notifier = notifier;
        this.coordinator = coordinator;
        this.checkoutSecurity = checkoutSecurity;
        this.quoteProducer = quoteProducer;
    }

    public String handle(String rawMessage) {
        String requestId = null;
        String submissionId = null;
        try {
            final JSONObject raw = new JSONObject(rawMessage == null ? "{}" : rawMessage);
            requestId = raw.optString("requestId", "").trim();
            submissionId = raw.optString("submissionId", "").trim();
            final String type = raw.optString("type", "").trim();
            if (FormalBusinessCommandContract.CHECKOUT_VALIDATION.equals(type)) {
                if (checkoutSecurity == null || quoteProducer == null) {
                    return error(requestId, "FORMAL_CHECKOUT_VALIDATION_UNBOUND");
                }
                final FormalBusinessCommandContract.CheckoutValidationRequest request =
                    FormalBusinessCommandContract.parseCheckoutValidation(rawMessage);
                completeQuote(
                    checkoutSecurity.readAdmission(
                        request.storeId,
                        request.deviceId,
                        request.staffSessionRef
                    ).thenCompose(ignored -> {
                        try {
                            return quoteProducer.create(request.storeId, request.producerRequest());
                        } catch (JSONException invalid) {
                            return failedFuture(invalid);
                        }
                    }),
                    request.requestId
                );
                return accepted(request.requestId);
            }
            if (FormalBusinessCommandContract.COMMAND.equals(type)) {
                final FormalBusinessCommandContract.CommandEnvelope command = FormalBusinessCommandContract.parseCommand(rawMessage);
                complete(router.submit(command), command.requestId, command.submissionId);
                return accepted(command.requestId);
            }
            if (FormalBusinessCommandContract.SUBMISSION_READ.equals(type)) {
                final FormalBusinessCommandContract.SubmissionReadRequest request = FormalBusinessCommandContract.parseSubmissionRead(rawMessage);
                complete(router.read(request), request.requestId, request.submissionId);
                return accepted(request.requestId);
            }
            return error(requestId, "FORMAL_BUSINESS_OPERATION_UNSUPPORTED");
        } catch (JSONException error) {
            return error(requestId, "FORMAL_COMMAND_MESSAGE_INVALID");
        } catch (IllegalArgumentException error) {
            final String code = stableCode(error, "FORMAL_COMMAND_REJECTED");
            if (submissionId != null && !submissionId.isEmpty()) {
                try {
                    return FormalBusinessCommandContract.Result.rejected(submissionId, code).toJson(requestId).toString();
                } catch (JSONException ignored) { }
            }
            return error(requestId, code);
        }
    }

    private void completeQuote(
        CompletableFuture<FormalQuoteRoomProducer.CreatedQuote> future,
        String requestId
    ) {
        future.whenComplete((result, failure) -> {
            try {
                if (failure == null) {
                    notifier.post(quoteResult(requestId, result).toString());
                    return;
                }
                final String code = stableCode(failure, "");
                notifier.post(knownQuoteRejection(code)
                    ? quoteRejected(requestId, code).toString()
                    : quoteUnknown(requestId).toString());
            } catch (JSONException encodingError) {
                notifier.post(error(requestId, "FORMAL_CHECKOUT_VALIDATION_ENCODING_FAILED"));
            }
        });
    }

    private static JSONObject quoteResult(
        String requestId,
        FormalQuoteRoomProducer.CreatedQuote result
    ) throws JSONException {
        final FormalCheckoutRecords.Quote quote = result.quote();
        final org.json.JSONArray lines = new org.json.JSONArray();
        for (FormalCheckoutRecords.Line line : quote.lines()) {
            lines.put(new JSONObject()
                .put("cartLineId", line.cartLineId())
                .put("quantity", line.quantity())
                .put("formalUnitMinor", line.formalUnitMinor())
                .put("formalLineTotalMinor", line.formalLineTotalMinor())
                .put("studentDiscountEligible", line.studentDiscountEligible()));
        }
        final org.json.JSONArray discounts = new org.json.JSONArray();
        for (FormalCheckoutRecords.DiscountRow discount : quote.discounts()) {
            final JSONObject row = new JSONObject()
                .put("code", discount.code())
                .put("amountMinor", discount.amountMinor());
            if (discount.cartLineId() != null) row.put("cartLineId", discount.cartLineId());
            if (discount.quantity() != null) row.put("quantity", discount.quantity());
            discounts.put(row);
        }
        final org.json.JSONArray acceptedTenderIds = new org.json.JSONArray();
        for (String tenderId : quote.acceptedTenderIds()) acceptedTenderIds.put(tenderId);
        final org.json.JSONArray tenders = new org.json.JSONArray();
        for (FormalQuoteRoomProducer.TenderOption tender : result.enabledTenders()) {
            tenders.put(new JSONObject()
                .put("id", tender.id())
                .put("label", tender.label())
                .put("enabled", true)
                .put("kind", tender.kind()));
        }
        return quoteBase(requestId)
            .put("state", "VALID")
            .put("tenders", tenders)
            .put("quote", new JSONObject()
                .put("quoteRef", quote.quoteRef())
                .put("formalRevision", revisionValue(quote.revision()))
                .put("currency", quote.currency())
                .put("lines", lines)
                .put("discounts", discounts)
                .put("formalSubtotalMinor", quote.subtotalMinor())
                .put("formalDiscountMinor", quote.discountMinor())
                .put("formalTotalDueMinor", quote.totalDueMinor())
                .put("acceptedTenderIds", acceptedTenderIds)
                .put("validatedAt", quote.validatedAt().toString()));
    }

    private static Object revisionValue(FormalCheckoutRecords.Revision revision) {
        return revision.kind() == FormalCheckoutRecords.RevisionKind.NUMBER
            ? Long.parseLong(revision.value())
            : revision.value();
    }

    private static JSONObject quoteRejected(String requestId, String code) throws JSONException {
        return quoteBase(requestId).put("state", "REJECTED").put("rejectionCode", code);
    }

    private static JSONObject quoteUnknown(String requestId) throws JSONException {
        return quoteBase(requestId).put("state", "UNKNOWN").put("readbackRequired", true);
    }

    private static JSONObject quoteBase(String requestId) throws JSONException {
        return new JSONObject()
            .put("protocolVersion", FormalBusinessCommandContract.PROTOCOL_VERSION)
            .put("type", FormalBusinessCommandContract.CHECKOUT_VALIDATION_RESULT)
            .put("schema", FormalBusinessCommandContract.CHECKOUT_VALIDATION_RESULT)
            .put("requestId", requestId);
    }

    private static boolean knownQuoteRejection(String code) {
        if (code == null || !code.matches("^[A-Z0-9_:-]{1,160}$") || code.startsWith("STORE_KERNEL_")) {
            return false;
        }
        return !code.endsWith("_ENCODING_FAILED")
            && !code.endsWith("_HASH_UNAVAILABLE")
            && !code.endsWith("_CLOCK_INVALID")
            && !code.endsWith("_SNAPSHOT_INVALID");
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private void complete(
        CompletableFuture<FormalBusinessCommandContract.Result> future,
        String requestId,
        String submissionId
    ) {
        future.whenComplete((result, failure) -> {
            try {
                notifier.post((failure == null
                    ? result
                    : FormalBusinessCommandContract.Result.unknown(submissionId)).toJson(requestId).toString());
            } catch (JSONException error) {
                notifier.post(error(requestId, "FORMAL_RESULT_ENCODING_FAILED"));
            }
        });
    }

    private static String accepted(String requestId) {
        try {
            return new JSONObject()
                .put("protocolVersion", FormalBusinessCommandContract.PROTOCOL_VERSION)
                .put("type", "mfp.store-kernel.request.accepted.v1")
                .put("status", "accepted")
                .put("requestId", requestId)
                .toString();
        } catch (JSONException impossible) {
            throw new IllegalStateException("FORMAL_RESULT_ENCODING_FAILED", impossible);
        }
    }

    private static String error(String requestId, String code) {
        try {
            final JSONObject value = new JSONObject()
                .put("protocolVersion", FormalBusinessCommandContract.PROTOCOL_VERSION)
                .put("type", "mfp.store-kernel.formal.error.v1")
                .put("status", "failed")
                .put("errorCode", code);
            if (requestId != null && !requestId.isEmpty()) value.put("requestId", requestId);
            return value.toString();
        } catch (JSONException impossible) {
            return "{\"protocolVersion\":1,\"type\":\"mfp.store-kernel.formal.error.v1\",\"status\":\"failed\",\"errorCode\":\"FORMAL_RESULT_ENCODING_FAILED\"}";
        }
    }

    private static String stableCode(Throwable error, String fallback) {
        Throwable current = error;
        while (current instanceof CompletionException && current.getCause() != null) current = current.getCause();
        final String message = current.getMessage();
        return message != null && message.matches("^[A-Z0-9_:-]{1,160}$") ? message : fallback;
    }

    @Override
    public void close() {
        if (coordinator != null) coordinator.close();
    }

    private static final class CoordinatorGateway implements FormalBusinessCommandRouter.Gateway {
        private final StoreKernelTransactionCoordinator coordinator;

        CoordinatorGateway(StoreKernelTransactionCoordinator coordinator) {
            this.coordinator = coordinator;
        }

        @Override
        public CompletableFuture<FormalBusinessCommandRouter.StoredResult> read(String storeId, String submissionId) {
            return coordinator.readCommandReceiptByCommandId("FORMAL-READ-" + submissionId, storeId, submissionId)
                .thenApply(result -> result.found ? stored(result) : null);
        }

        @Override
        public CompletableFuture<FormalBusinessCommandRouter.StoredResult> recordRejected(
            FormalBusinessCommandContract.CommandEnvelope command,
            FormalBusinessCommandContract.Result result
        ) {
            final StoreKernelContract.CommandResultRequest request = new StoreKernelContract.CommandResultRequest(
                command.requestId,
                command.submissionId,
                command.storeId,
                FormalBusinessCommandRouter.OPERATION_ID,
                command.idempotencyKey,
                command.requestFingerprint,
                result.toStoredJson(),
                "formal:" + command.requestFingerprint,
                Instant.now().toString()
            );
            return coordinator.recordCommandResult(request).thenApply(CoordinatorGateway::stored);
        }

        @Override
        public CompletableFuture<FormalBusinessCommandRouter.StoredResult> commit(
            FormalBusinessCommandContract.CommandEnvelope command,
            StoreKernelContract.CommitRequest request
        ) {
            return coordinator.commit(request).thenApply(result -> {
                try {
                    return new FormalBusinessCommandRouter.StoredResult(
                        command.requestFingerprint,
                        FormalBusinessCommandContract.Result.fromStoredJson(result.resultJson),
                        true
                    );
                } catch (JSONException error) {
                    throw new CompletionException(error);
                }
            });
        }

        private static FormalBusinessCommandRouter.StoredResult stored(
            StoreKernelTransactionCoordinator.CommandReceiptReadResult receipt
        ) {
            try {
                return new FormalBusinessCommandRouter.StoredResult(
                    receipt.requestFingerprint,
                    FormalBusinessCommandContract.Result.fromStoredJson(receipt.resultJson),
                    true
                );
            } catch (JSONException error) {
                throw new CompletionException(error);
            }
        }
    }
}
