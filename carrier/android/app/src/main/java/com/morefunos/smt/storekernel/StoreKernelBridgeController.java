package com.morefunos.smt.storekernel;

import android.content.Context;

import androidx.annotation.NonNull;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

public final class StoreKernelBridgeController implements AutoCloseable {
    public interface Notifier {
        void post(String json);
    }

    private final StoreKernelTransactionCoordinator coordinator;
    private final Notifier notifier;

    public static StoreKernelBridgeController open(@NonNull Context context, @NonNull Notifier notifier) {
        return new StoreKernelBridgeController(StoreKernelTransactionCoordinator.open(context), notifier);
    }

    StoreKernelBridgeController(StoreKernelTransactionCoordinator coordinator, Notifier notifier) {
        this.coordinator = coordinator;
        this.notifier = notifier;
    }

    public String handle(String rawMessage) {
        String requestId = null;
        try {
            final JSONObject request = StoreKernelContract.parseEnvelope(rawMessage);
            requestId = StoreKernelContract.requestId(request);
            final String correlatedRequestId = requestId;
            final String type = StoreKernelContract.type(request);
            if (StoreKernelContract.COMMIT.equals(type)) {
                complete(coordinator.commit(StoreKernelContract.parseCommit(request)), correlatedRequestId,
                    StoreKernelTransactionCoordinator.CommitResult::toJson);
            } else if (StoreKernelContract.COMMAND_RECEIPT_READ.equals(type)) {
                complete(coordinator.readCommandReceipt(StoreKernelContract.parseCommandReceiptRead(request)), correlatedRequestId,
                    StoreKernelTransactionCoordinator.CommandReceiptReadResult::toJson);
            } else if (StoreKernelContract.AGGREGATE_SNAPSHOT.equals(type)) {
                complete(coordinator.snapshot(StoreKernelContract.parseAggregateSnapshot(request)), correlatedRequestId,
                    StoreKernelTransactionCoordinator.AggregateSnapshotResult::toJson);
            } else if (StoreKernelContract.INBOX_APPEND.equals(type)) {
                complete(coordinator.appendInbox(StoreKernelContract.parseInboxAppend(request)), correlatedRequestId,
                    StoreKernelTransactionCoordinator.InboxAppendResult::toJson);
            } else if (StoreKernelContract.OUTBOX_CLAIM.equals(type)) {
                complete(coordinator.claimOutbox(StoreKernelContract.parseOutboxClaim(request)), correlatedRequestId,
                    value -> StoreKernelTransactionCoordinator.outboxClaimJson(correlatedRequestId, value));
            } else if (StoreKernelContract.OUTBOX_ACKNOWLEDGE.equals(type)) {
                complete(coordinator.acknowledgeOutbox(StoreKernelContract.parseOutboxAcknowledge(request)), correlatedRequestId,
                    ignored -> StoreKernelTransactionCoordinator.simpleCompletion(
                        "store.kernel.outbox.ack.completed.v1",
                        correlatedRequestId
                    ));
            } else if (StoreKernelContract.OUTBOX_RELEASE.equals(type)) {
                complete(coordinator.releaseOutbox(StoreKernelContract.parseOutboxRelease(request)), correlatedRequestId,
                    ignored -> StoreKernelTransactionCoordinator.simpleCompletion(
                        "store.kernel.outbox.release.completed.v1",
                        correlatedRequestId
                    ));
            } else if (StoreKernelContract.HEALTH.equals(type)) {
                complete(coordinator.health(), correlatedRequestId, value -> value.toJson(correlatedRequestId));
            } else {
                return errorJson(requestId, "STORE_KERNEL_OPERATION_UNSUPPORTED");
            }
            return acceptedJson(correlatedRequestId);
        } catch (JSONException | IllegalArgumentException error) {
            return errorJson(requestId, stableCode(error, "STORE_KERNEL_MESSAGE_INVALID"));
        } catch (RuntimeException error) {
            return errorJson(requestId, stableCode(error, "STORE_KERNEL_REQUEST_REJECTED"));
        }
    }

    private <T> void complete(
        CompletableFuture<T> future,
        String requestId,
        JsonEncoder<T> encoder
    ) {
        future.whenComplete((value, error) -> {
            if (error != null) {
                notifier.post(errorJson(requestId, stableCode(error, "STORE_KERNEL_OPERATION_FAILED")));
                return;
            }
            try {
                notifier.post(encoder.encode(value).toString());
            } catch (JSONException | RuntimeException encodingError) {
                notifier.post(errorJson(requestId, "STORE_KERNEL_RESPONSE_ENCODING_FAILED"));
            }
        });
    }

    private static String acceptedJson(String requestId) {
        try {
            final JSONObject response = new JSONObject();
            response.put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION);
            response.put("type", "store.kernel.request.accepted.v1");
            response.put("status", "accepted");
            response.put("requestId", requestId);
            return response.toString();
        } catch (JSONException impossible) {
            throw new IllegalStateException("STORE_KERNEL_RESPONSE_ENCODING_FAILED", impossible);
        }
    }

    private static String errorJson(String requestId, String errorCode) {
        try {
            final JSONObject response = new JSONObject();
            response.put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION);
            response.put("type", "store.kernel.error.v1");
            response.put("status", "failed");
            if (requestId != null && !requestId.isEmpty()) response.put("requestId", requestId);
            response.put("errorCode", errorCode);
            return response.toString();
        } catch (JSONException impossible) {
            return "{\"protocolVersion\":1,\"type\":\"store.kernel.error.v1\",\"status\":\"failed\",\"errorCode\":\"STORE_KERNEL_RESPONSE_ENCODING_FAILED\"}";
        }
    }

    private static String stableCode(Throwable error, String fallback) {
        Throwable current = error;
        while ((current instanceof CompletionException || current instanceof java.util.concurrent.ExecutionException)
            && current.getCause() != null) {
            current = current.getCause();
        }
        if (current instanceof StoreKernelTransactionCoordinator.StoreKernelFailure) {
            return ((StoreKernelTransactionCoordinator.StoreKernelFailure) current).code;
        }
        final String message = current.getMessage();
        if (message != null && message.matches("^[A-Z0-9_:-]{1,160}$")) return message;
        return fallback;
    }

    @Override
    public void close() {
        coordinator.close();
    }

    private interface JsonEncoder<T> {
        JSONObject encode(T value) throws JSONException;
    }
}
