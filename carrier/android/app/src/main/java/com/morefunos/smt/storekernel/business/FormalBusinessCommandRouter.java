package com.morefunos.smt.storekernel.business;

import com.morefunos.smt.storekernel.StoreKernelContract;

import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class FormalBusinessCommandRouter {
    public static final String OPERATION_ID = "STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY";

    public interface Handler {
        CompletableFuture<Outcome> prepare(FormalBusinessCommandContract.CommandEnvelope command);
    }

    public interface Gateway {
        CompletableFuture<StoredResult> read(String storeId, String submissionId);

        CompletableFuture<StoredResult> recordRejected(
            FormalBusinessCommandContract.CommandEnvelope command,
            FormalBusinessCommandContract.Result result
        );

        CompletableFuture<StoredResult> commit(
            FormalBusinessCommandContract.CommandEnvelope command,
            StoreKernelContract.CommitRequest request
        );
    }

    public static final class StoredResult {
        public final String requestFingerprint;
        public final FormalBusinessCommandContract.Result result;
        public final boolean receiptPresent;

        public StoredResult(String requestFingerprint, FormalBusinessCommandContract.Result result, boolean receiptPresent) {
            this.requestFingerprint = requestFingerprint;
            this.result = result;
            this.receiptPresent = receiptPresent;
        }
    }

    public static final class Outcome {
        final StoreKernelContract.CommitRequest commitRequest;
        final String rejectionCode;

        private Outcome(StoreKernelContract.CommitRequest commitRequest, String rejectionCode) {
            this.commitRequest = commitRequest;
            this.rejectionCode = rejectionCode;
        }

        public static Outcome commit(StoreKernelContract.CommitRequest request) {
            if (request == null) throw new IllegalArgumentException("FORMAL_COMMIT_REQUEST_REQUIRED");
            return new Outcome(request, null);
        }

        public static Outcome rejected(String code) {
            return new Outcome(null, code);
        }
    }

    private static final class ActiveSubmission {
        final String fingerprint;
        final CompletableFuture<FormalBusinessCommandContract.Result> future;

        ActiveSubmission(String fingerprint, CompletableFuture<FormalBusinessCommandContract.Result> future) {
            this.fingerprint = fingerprint;
            this.future = future;
        }
    }

    private final Gateway gateway;
    private final FormalSecurityAuthority security;
    private final Map<String, Handler> handlers;
    private final Map<String, ActiveSubmission> inFlight = new HashMap<>();

    public FormalBusinessCommandRouter(Gateway gateway, FormalSecurityAuthority security, Map<String, Handler> handlers) {
        if (gateway == null || security == null || handlers == null) throw new IllegalArgumentException("FORMAL_ROUTER_DEPENDENCY_REQUIRED");
        this.gateway = gateway;
        this.security = security;
        this.handlers = Collections.unmodifiableMap(new HashMap<>(handlers));
    }

    public static Map<String, Handler> blockedHandlers() {
        final Map<String, Handler> result = new LinkedHashMap<>();
        for (String commandType : FormalBusinessCommandContract.commandTypes()) {
            final String code = FormalBusinessCommandContract.dependencyCode(commandType);
            result.put(commandType, ignored -> CompletableFuture.completedFuture(Outcome.rejected(code)));
        }
        return Collections.unmodifiableMap(result);
    }

    public CompletableFuture<FormalBusinessCommandContract.Result> submit(FormalBusinessCommandContract.CommandEnvelope command) {
        final String key = command.storeId + "\u0000" + command.submissionId;
        final CompletableFuture<FormalBusinessCommandContract.Result> target;
        synchronized (inFlight) {
            final ActiveSubmission active = inFlight.get(key);
            if (active != null) {
                return active.fingerprint.equals(command.requestFingerprint)
                    ? active.future
                    : CompletableFuture.completedFuture(FormalBusinessCommandContract.Result.rejected(
                        command.submissionId,
                        "FORMAL_SUBMISSION_FINGERPRINT_CONFLICT"
                    ));
            }
            target = new CompletableFuture<>();
            inFlight.put(key, new ActiveSubmission(command.requestFingerprint, target));
        }
        process(command).whenComplete((result, error) -> {
            target.complete(error == null ? result : FormalBusinessCommandContract.Result.unknown(command.submissionId));
            synchronized (inFlight) {
                final ActiveSubmission active = inFlight.get(key);
                if (active != null && active.future == target) inFlight.remove(key);
            }
        });
        return target;
    }

    public CompletableFuture<FormalBusinessCommandContract.Result> read(FormalBusinessCommandContract.SubmissionReadRequest request) {
        return security.authorizeReadback(request).thenCompose(decision -> {
            if (!decision.authorized) {
                return CompletableFuture.completedFuture(FormalBusinessCommandContract.Result.rejected(
                    request.submissionId,
                    decision.rejectionCode
                ));
            }
            return gateway.read(request.storeId, request.submissionId).thenApply(stored -> stored == null
                ? FormalBusinessCommandContract.Result.unknown(request.submissionId)
                : canonical(stored, request.submissionId));
        }).handle((result, error) -> error == null
            ? result
            : FormalBusinessCommandContract.Result.unknown(request.submissionId));
    }

    private CompletableFuture<FormalBusinessCommandContract.Result> process(FormalBusinessCommandContract.CommandEnvelope command) {
        return gateway.read(command.storeId, command.submissionId).thenCompose(stored -> {
            if (stored != null) {
                if (!command.requestFingerprint.equals(stored.requestFingerprint)) {
                    return CompletableFuture.completedFuture(FormalBusinessCommandContract.Result.rejected(
                        command.submissionId,
                        "FORMAL_SUBMISSION_FINGERPRINT_CONFLICT"
                    ));
                }
                return CompletableFuture.completedFuture(canonical(stored, command.submissionId));
            }
            return security.authorize(command).thenCompose(decision -> {
                if (!decision.authorized) return reject(command, decision.rejectionCode);
                final Handler handler = handlers.get(command.commandType);
                if (handler == null) return reject(command, "FORMAL_COMMAND_HANDLER_UNBOUND");
                return handler.prepare(command).thenCompose(outcome -> {
                    if (outcome == null) return reject(command, "FORMAL_COMMAND_HANDLER_INVALID");
                    if (outcome.rejectionCode != null) return reject(command, outcome.rejectionCode);
                    if (!validCommitIdentity(command, outcome.commitRequest)) {
                        return reject(command, "FORMAL_STORE_KERNEL_COMMIT_IDENTITY_INVALID");
                    }
                    return commitWithRecovery(command, outcome.commitRequest);
                });
            });
        }).handle((result, error) -> error == null
            ? result
            : FormalBusinessCommandContract.Result.unknown(command.submissionId));
    }

    private CompletableFuture<FormalBusinessCommandContract.Result> commitWithRecovery(
        FormalBusinessCommandContract.CommandEnvelope command,
        StoreKernelContract.CommitRequest request
    ) {
        return gateway.commit(command, request).thenApply(result -> {
            final FormalBusinessCommandContract.Result canonical = canonical(result, command.submissionId);
            return "COMMITTED".equals(canonical.state)
                ? canonical
                : FormalBusinessCommandContract.Result.unknown(command.submissionId);
        }).handle((result, error) -> error == null
                ? CompletableFuture.completedFuture(result)
                : recoverCommit(command, error)
            )
            .thenCompose(future -> future);
    }

    private CompletableFuture<FormalBusinessCommandContract.Result> recoverCommit(
        FormalBusinessCommandContract.CommandEnvelope command,
        Throwable commitError
    ) {
        return gateway.read(command.storeId, command.submissionId).thenCompose(stored -> {
            if (stored != null) {
                if (!command.requestFingerprint.equals(stored.requestFingerprint)) {
                    return CompletableFuture.completedFuture(FormalBusinessCommandContract.Result.rejected(
                        command.submissionId,
                        "FORMAL_SUBMISSION_FINGERPRINT_CONFLICT"
                    ));
                }
                return CompletableFuture.completedFuture(canonical(stored, command.submissionId));
            }
            final String rejectionCode = safePrewriteConflict(commitError);
            return rejectionCode == null
                ? CompletableFuture.completedFuture(FormalBusinessCommandContract.Result.unknown(command.submissionId))
                : reject(command, rejectionCode);
        });
    }

    private static String safePrewriteConflict(Throwable error) {
        Throwable current = error;
        while (current instanceof java.util.concurrent.CompletionException && current.getCause() != null) {
            current = current.getCause();
        }
        final String code = current.getMessage();
        if ("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT".equals(code)
            || "STORE_KERNEL_AGGREGATE_REVISION_CONFLICT".equals(code)) return code;
        return null;
    }

    private CompletableFuture<FormalBusinessCommandContract.Result> reject(
        FormalBusinessCommandContract.CommandEnvelope command,
        String code
    ) {
        final FormalBusinessCommandContract.Result rejected = FormalBusinessCommandContract.Result.rejected(command.submissionId, code);
        return gateway.recordRejected(command, rejected).thenApply(stored -> canonical(stored, command.submissionId));
    }

    private static FormalBusinessCommandContract.Result canonical(StoredResult stored, String submissionId) {
        if (stored == null || !stored.receiptPresent || stored.result == null || !submissionId.equals(stored.result.submissionId)) {
            return FormalBusinessCommandContract.Result.unknown(submissionId);
        }
        return stored.result;
    }

    private static boolean validCommitIdentity(
        FormalBusinessCommandContract.CommandEnvelope command,
        StoreKernelContract.CommitRequest request
    ) {
        if (request == null
            || !command.storeId.equals(request.storeId)
            || !command.submissionId.equals(request.commandId)
            || !OPERATION_ID.equals(request.operationId)
            || !command.idempotencyKey.equals(request.idempotencyKey)
            || !command.requestFingerprint.equals(request.requestFingerprint)) return false;
        try {
            final FormalBusinessCommandContract.Result result = FormalBusinessCommandContract.Result.fromStoredJson(request.resultJson);
            return "COMMITTED".equals(result.state) && command.submissionId.equals(result.submissionId);
        } catch (Exception error) {
            return false;
        }
    }
}
