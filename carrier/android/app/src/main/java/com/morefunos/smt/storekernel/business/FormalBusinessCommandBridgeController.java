package com.morefunos.smt.storekernel.business;

import android.content.Context;

import androidx.annotation.NonNull;

import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.storekernel.StoreKernelTransactionCoordinator;

import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

public final class FormalBusinessCommandBridgeController implements AutoCloseable {
    public interface Notifier {
        void post(String json);
    }

    private final FormalBusinessCommandRouter router;
    private final Notifier notifier;
    private final StoreKernelTransactionCoordinator coordinator;

    public static FormalBusinessCommandBridgeController open(@NonNull Context context, @NonNull Notifier notifier) {
        final StoreKernelTransactionCoordinator coordinator = StoreKernelTransactionCoordinator.open(context);
        final CoordinatorGateway gateway = new CoordinatorGateway(coordinator);
        return new FormalBusinessCommandBridgeController(
            new FormalBusinessCommandRouter(
                gateway,
                FormalSecurityAuthority.unbound(),
                FormalBusinessCommandRouter.blockedHandlers()
            ),
            notifier,
            coordinator
        );
    }

    public FormalBusinessCommandBridgeController(FormalBusinessCommandRouter router, Notifier notifier) {
        this(router, notifier, null);
    }

    private FormalBusinessCommandBridgeController(
        FormalBusinessCommandRouter router,
        Notifier notifier,
        StoreKernelTransactionCoordinator coordinator
    ) {
        this.router = router;
        this.notifier = notifier;
        this.coordinator = coordinator;
    }

    public String handle(String rawMessage) {
        String requestId = null;
        String submissionId = null;
        try {
            final JSONObject raw = new JSONObject(rawMessage == null ? "{}" : rawMessage);
            requestId = raw.optString("requestId", "").trim();
            submissionId = raw.optString("submissionId", "").trim();
            final String type = raw.optString("type", "").trim();
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
