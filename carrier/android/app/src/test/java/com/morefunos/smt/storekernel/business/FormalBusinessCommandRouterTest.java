package com.morefunos.smt.storekernel.business;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.morefunos.smt.storekernel.StoreKernelContract;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalBusinessCommandRouterTest {
    @Test
    public void productionSkeletonFailsClosedAtFormalSecuritySeam() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            FormalSecurityAuthority.unbound(),
            FormalBusinessCommandRouter.blockedHandlers()
        );

        final FormalBusinessCommandContract.Result result = await(router.submit(command()));

        assertEquals("REJECTED", result.state);
        assertEquals("MFP_SECURITY_PRODUCTION_BINDING_MISSING", result.rejectionCode);
        assertEquals(0, gateway.commitCount.get());
        assertEquals(result.toStoredJson(), await(router.submit(command())).toStoredJson());
    }

    @Test
    public void checkoutStopsAtMissingFormalPricingAuthorityWithoutCommit() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            allowedSecurity(),
            FormalBusinessCommandRouter.blockedHandlers()
        );

        final FormalBusinessCommandContract.Result result = await(router.submit(command()));

        assertEquals("REJECTED", result.state);
        assertEquals("FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING", result.rejectionCode);
        assertEquals(0, gateway.commitCount.get());
    }

    @Test
    public void validatesSecurityAndHandlerBeforeStoreKernelCommit() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        final AtomicInteger handled = new AtomicInteger();
        final Map<String, FormalBusinessCommandRouter.Handler> handlers = new HashMap<>();
        handlers.put("CHECKOUT_PAYMENT_CONFIRM", value -> {
            gateway.trace.add("handle");
            handled.incrementAndGet();
            return CompletableFuture.completedFuture(FormalBusinessCommandRouter.Outcome.commit(commitRequest(value)));
        });
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(gateway, allowedSecurity(gateway.trace), handlers);

        final FormalBusinessCommandContract.Result result = await(router.submit(command()));

        assertEquals("COMMITTED", result.state);
        assertEquals(1, handled.get());
        assertEquals(1, gateway.commitCount.get());
        assertEquals(List.of("read", "authorize", "handle", "commit"), gateway.trace);
    }

    @Test
    public void sameSubmissionReplaysAndFingerprintConflictNeverMutatesTwice() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        final Map<String, FormalBusinessCommandRouter.Handler> handlers = Map.of(
            "CHECKOUT_PAYMENT_CONFIRM",
            value -> CompletableFuture.completedFuture(FormalBusinessCommandRouter.Outcome.commit(commitRequest(value)))
        );
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(gateway, allowedSecurity(), handlers);

        final FormalBusinessCommandContract.Result first = await(router.submit(command()));
        final FormalBusinessCommandContract.Result replay = await(router.submit(command()));
        final FormalBusinessCommandContract.CommandEnvelope changed = FormalBusinessCommandContract.parseCommand(
            FormalBusinessCommandContractTest.command(new JSONObject().put("review", new JSONObject().put("quoteRef", "QUOTE-CHANGED")))
        );
        final FormalBusinessCommandContract.Result conflict = await(router.submit(changed));

        assertEquals(first.toStoredJson(), replay.toStoredJson());
        assertEquals("REJECTED", conflict.state);
        assertEquals("FORMAL_SUBMISSION_FINGERPRINT_CONFLICT", conflict.rejectionCode);
        assertEquals(1, gateway.commitCount.get());
    }

    @Test
    public void unknownNeverClaimsCommittedAndNextAttemptReadsBackFirst() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        gateway.failCommit = true;
        final Map<String, FormalBusinessCommandRouter.Handler> handlers = Map.of(
            "CHECKOUT_PAYMENT_CONFIRM",
            value -> CompletableFuture.completedFuture(FormalBusinessCommandRouter.Outcome.commit(commitRequest(value)))
        );
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(gateway, allowedSecurity(), handlers);

        final FormalBusinessCommandContract.Result first = await(router.submit(command()));
        gateway.failCommit = false;
        final int beforeRetry = gateway.trace.size();
        final FormalBusinessCommandContract.Result second = await(router.submit(command()));

        assertEquals("UNKNOWN", first.state);
        assertTrue(first.readbackRequired);
        assertFalse(first.retryPermitted);
        assertEquals("read", gateway.trace.get(beforeRetry));
        assertEquals("COMMITTED", second.state);
    }

    @Test
    public void lostCommitReplyReadsBackDurableReceiptBeforeReturningUnknown() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        gateway.persistThenFailCommit = true;
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            allowedSecurity(),
            Map.of("CHECKOUT_PAYMENT_CONFIRM", value -> CompletableFuture.completedFuture(
                FormalBusinessCommandRouter.Outcome.commit(commitRequest(value))
            ))
        );

        final FormalBusinessCommandContract.Result result = await(router.submit(command()));

        assertEquals("COMMITTED", result.state);
        assertEquals("ORDER-1", result.orderRef);
        assertEquals(1, gateway.commitCount.get());
        assertEquals(0, gateway.recordRejectedCount.get());
    }

    @Test
    public void knownPrewriteConflictWithoutReceiptBecomesDurableRejection() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        gateway.failCommit = true;
        gateway.failCommitCode = "STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT";
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            allowedSecurity(),
            Map.of("CHECKOUT_PAYMENT_CONFIRM", value -> CompletableFuture.completedFuture(
                FormalBusinessCommandRouter.Outcome.commit(commitRequest(value))
            ))
        );

        final FormalBusinessCommandContract.Result first = await(router.submit(command()));
        final FormalBusinessCommandContract.Result replay = await(router.submit(command()));

        assertEquals("REJECTED", first.state);
        assertEquals("STORE_KERNEL_READ_DEPENDENCY_REVISION_CONFLICT", first.rejectionCode);
        assertEquals(first.toStoredJson(), replay.toStoredJson());
        assertEquals(1, gateway.commitCount.get());
        assertEquals(1, gateway.recordRejectedCount.get());
    }

    @Test
    public void committedRequiresReceiptEvidence() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        gateway.receiptPresent = false;
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            allowedSecurity(),
            Map.of("CHECKOUT_PAYMENT_CONFIRM", value -> CompletableFuture.completedFuture(
                FormalBusinessCommandRouter.Outcome.commit(commitRequest(value))
            ))
        );

        final FormalBusinessCommandContract.Result result = await(router.submit(command()));

        assertEquals("UNKNOWN", result.state);
        assertEquals(1, gateway.commitCount.get());
    }

    @Test
    public void boundedBridgeRejectsLowLevelStoreKernelOperation() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            allowedSecurity(),
            FormalBusinessCommandRouter.blockedHandlers()
        );
        final List<String> notifications = new ArrayList<>();
        final FormalBusinessCommandBridgeController bridge = new FormalBusinessCommandBridgeController(router, notifications::add);

        final String raw = new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "store.kernel.commit.v1")
            .put("requestId", "REQ-LOW")
            .put("mutations", new JSONArray())
            .toString();
        final JSONObject response = new JSONObject(bridge.handle(raw));

        assertEquals("FORMAL_BUSINESS_OPERATION_UNSUPPORTED", response.getString("errorCode"));
        assertEquals(0, gateway.commitCount.get());
        assertTrue(notifications.isEmpty());
    }

    @Test
    public void boundedBridgeRejectsRawAggregateInjectionBeforeMutation() throws Exception {
        final FakeGateway gateway = new FakeGateway();
        final FormalBusinessCommandRouter router = new FormalBusinessCommandRouter(
            gateway,
            allowedSecurity(),
            FormalBusinessCommandRouter.blockedHandlers()
        );
        final FormalBusinessCommandBridgeController bridge = new FormalBusinessCommandBridgeController(router, ignored -> { });
        final JSONObject forged = new JSONObject(FormalBusinessCommandContractTest.command(new JSONObject()))
            .put("mutations", new JSONArray());

        final JSONObject response = new JSONObject(bridge.handle(forged.toString()));

        assertEquals("REJECTED", response.getString("state"));
        assertEquals("FORMAL_AGGREGATE_INJECTION_REJECTED", response.getString("rejectionCode"));
        assertEquals(0, gateway.commitCount.get());
    }

    private static FormalBusinessCommandContract.CommandEnvelope command() throws Exception {
        return FormalBusinessCommandContract.parseCommand(
            FormalBusinessCommandContractTest.command(new JSONObject().put("review", new JSONObject().put("quoteRef", "QUOTE-1")))
        );
    }

    private static FormalSecurityAuthority allowedSecurity() {
        return allowedSecurity(null);
    }

    private static FormalSecurityAuthority allowedSecurity(List<String> trace) {
        return new FormalSecurityAuthority() {
            @Override
            public CompletableFuture<Decision> authorize(FormalBusinessCommandContract.CommandEnvelope command) {
                if (trace != null) trace.add("authorize");
                return CompletableFuture.completedFuture(Decision.allowed());
            }

            @Override
            public CompletableFuture<Decision> authorizeReadback(FormalBusinessCommandContract.SubmissionReadRequest request) {
                return CompletableFuture.completedFuture(Decision.allowed());
            }
        };
    }

    private static StoreKernelContract.CommitRequest commitRequest(FormalBusinessCommandContract.CommandEnvelope command) {
        try {
            final FormalBusinessCommandContract.Result committed = FormalBusinessCommandContract.Result.committed(
                command.submissionId,
                "COMMIT-1",
                1,
                "ORDER-1"
            );
            final JSONObject raw = new JSONObject()
                .put("protocolVersion", 1)
                .put("type", "store.kernel.commit.v1")
                .put("requestId", command.requestId)
                .put("commandId", command.submissionId)
                .put("storeId", command.storeId)
                .put("operationId", FormalBusinessCommandRouter.OPERATION_ID)
                .put("idempotencyKey", command.idempotencyKey)
                .put("requestFingerprint", command.requestFingerprint)
                .put("result", new JSONObject(committed.toStoredJson()))
                .put("traceId", "TRACE-" + command.submissionId)
                .put("committedAt", command.createdAt)
                .put("mutations", new JSONArray().put(new JSONObject()
                    .put("aggregateType", "ORDER")
                    .put("aggregateId", "ORDER-1")
                    .put("expectedRevision", 0)
                    .put("state", new JSONObject().put("orderId", "ORDER-1"))))
                .put("outbox", new JSONArray());
            return StoreKernelContract.parseCommit(raw);
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }

    private static FormalBusinessCommandContract.Result await(CompletableFuture<FormalBusinessCommandContract.Result> future) throws Exception {
        return future.get(5, TimeUnit.SECONDS);
    }

    private static final class FakeGateway implements FormalBusinessCommandRouter.Gateway {
        final Map<String, FormalBusinessCommandRouter.StoredResult> results = new HashMap<>();
        final AtomicInteger commitCount = new AtomicInteger();
        final AtomicInteger recordRejectedCount = new AtomicInteger();
        final List<String> trace = new ArrayList<>();
        boolean failCommit;
        boolean persistThenFailCommit;
        String failCommitCode = "TIMEOUT";
        boolean receiptPresent = true;

        @Override
        public CompletableFuture<FormalBusinessCommandRouter.StoredResult> read(String storeId, String submissionId) {
            trace.add("read");
            return CompletableFuture.completedFuture(results.get(storeId + "\u0000" + submissionId));
        }

        @Override
        public CompletableFuture<FormalBusinessCommandRouter.StoredResult> recordRejected(
            FormalBusinessCommandContract.CommandEnvelope command,
            FormalBusinessCommandContract.Result result
        ) {
            recordRejectedCount.incrementAndGet();
            final FormalBusinessCommandRouter.StoredResult stored = new FormalBusinessCommandRouter.StoredResult(
                command.requestFingerprint,
                result,
                true
            );
            results.put(command.storeId + "\u0000" + command.submissionId, stored);
            return CompletableFuture.completedFuture(stored);
        }

        @Override
        public CompletableFuture<FormalBusinessCommandRouter.StoredResult> commit(
            FormalBusinessCommandContract.CommandEnvelope command,
            StoreKernelContract.CommitRequest request
        ) {
            trace.add("commit");
            commitCount.incrementAndGet();
            if (failCommit) return CompletableFuture.failedFuture(new IllegalStateException(failCommitCode));
            try {
                final FormalBusinessCommandContract.Result result = FormalBusinessCommandContract.Result.fromStoredJson(request.resultJson);
                final FormalBusinessCommandRouter.StoredResult stored = new FormalBusinessCommandRouter.StoredResult(
                    command.requestFingerprint,
                    result,
                    receiptPresent
                );
                if (receiptPresent) results.put(command.storeId + "\u0000" + command.submissionId, stored);
                if (persistThenFailCommit) {
                    return CompletableFuture.failedFuture(new IllegalStateException("TRANSPORT_REPLY_LOST"));
                }
                return CompletableFuture.completedFuture(stored);
            } catch (Exception error) {
                return CompletableFuture.failedFuture(error);
            }
        }
    }
}
