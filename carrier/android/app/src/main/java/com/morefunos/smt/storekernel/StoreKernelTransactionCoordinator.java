package com.morefunos.smt.storekernel;

import android.content.Context;

import androidx.annotation.NonNull;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

public final class StoreKernelTransactionCoordinator implements AutoCloseable {
    enum FailurePoint {
        NONE,
        AFTER_IDEMPOTENCY_LOOKUP,
        AFTER_REVISION_VALIDATION,
        AFTER_AGGREGATE_MUTATION,
        AFTER_RECEIPT,
        AFTER_INBOX_MUTATION,
        AFTER_OUTBOX_MUTATION,
        AFTER_JOURNAL_MUTATION,
        BEFORE_TRANSACTION_RETURN,
        AFTER_INBOX_INSERT
    }

    private final StoreKernelDatabase database;
    private final StoreKernelDao dao;
    private final FailurePoint failurePoint;
    private final AtomicBoolean closed = new AtomicBoolean(false);

    public static StoreKernelTransactionCoordinator open(@NonNull Context context) {
        return new StoreKernelTransactionCoordinator(StoreKernelDatabase.open(context), FailurePoint.NONE);
    }

    StoreKernelTransactionCoordinator(StoreKernelDatabase database) {
        this(database, FailurePoint.NONE);
    }

    StoreKernelTransactionCoordinator(StoreKernelDatabase database, FailurePoint failurePoint) {
        this.database = database;
        this.dao = database.storeKernelDao();
        this.failurePoint = failurePoint;
    }

    public CompletableFuture<CommitResult> commit(StoreKernelContract.CommitRequest request) {
        return submit(() -> database.runInTransaction(() -> commitInTransaction(request)));
    }

    public CompletableFuture<AggregateSnapshotResult> snapshot(StoreKernelContract.AggregateSnapshotRequest request) {
        return submit(() -> database.runInTransaction(() -> snapshotInTransaction(request)));
    }

    public CompletableFuture<CommandReceiptReadResult> readCommandReceipt(StoreKernelContract.CommandReceiptReadRequest request) {
        return submit(() -> database.runInTransaction(() -> readCommandReceiptInTransaction(request)));
    }

    public CompletableFuture<InboxAppendResult> appendInbox(StoreKernelContract.InboxAppendRequest request) {
        return submit(() -> database.runInTransaction(() -> appendInboxInTransaction(request)));
    }

    public CompletableFuture<List<OutboxEnvelope>> claimOutbox(StoreKernelContract.OutboxClaimRequest request) {
        return submit(() -> database.runInTransaction(() -> claimOutboxInTransaction(request)));
    }

    public CompletableFuture<Void> acknowledgeOutbox(StoreKernelContract.OutboxAcknowledgeRequest request) {
        return submit(() -> database.runInTransaction(() -> {
            final int changed = dao.acknowledgeOutbox(request.eventId, request.leaseOwner, request.acknowledgedAt);
            if (changed != 1) throw failure("STORE_KERNEL_OUTBOX_LEASE_CONFLICT");
            return null;
        }));
    }

    public CompletableFuture<Void> releaseOutbox(StoreKernelContract.OutboxReleaseRequest request) {
        return submit(() -> database.runInTransaction(() -> {
            final int changed = dao.releaseOutbox(request.eventId, request.leaseOwner, request.errorCode);
            if (changed != 1) throw failure("STORE_KERNEL_OUTBOX_LEASE_CONFLICT");
            return null;
        }));
    }

    public CompletableFuture<HealthResult> health() {
        return submit(() -> {
            final String journalMode = database.journalModeReadback();
            final int synchronous = database.synchronousReadback();
            final int schemaVersion = database.schemaVersionReadback();
            if (!"wal".equals(journalMode) || synchronous != 2) {
                throw failure("STORE_KERNEL_DURABILITY_PRAGMA_MISMATCH");
            }
            if (schemaVersion != StoreKernelDatabase.SCHEMA_VERSION) {
                throw failure("STORE_KERNEL_SCHEMA_VERSION_MISMATCH");
            }
            return new HealthResult(
                Thread.currentThread().getName(),
                schemaVersion,
                journalMode,
                synchronous,
                dao.aggregateCount(),
                dao.receiptCount(),
                dao.inboxCount(),
                dao.outboxCount(),
                dao.journalCount()
            );
        });
    }

    private AggregateSnapshotResult snapshotInTransaction(StoreKernelContract.AggregateSnapshotRequest request) {
        final List<AggregateSnapshotItem> items = new ArrayList<>();
        for (StoreKernelContract.AggregateKey key : request.keys) {
            items.add(new AggregateSnapshotItem(key, dao.readAggregate(
                request.storeId,
                key.aggregateType,
                key.aggregateId
            )));
        }
        return new AggregateSnapshotResult(request.requestId, items);
    }

    private CommandReceiptReadResult readCommandReceiptInTransaction(StoreKernelContract.CommandReceiptReadRequest request) {
        final StoreKernelCommandReceiptEntity receipt = dao.readReceipt(
            request.storeId,
            request.operationId,
            request.idempotencyKey
        );
        if (receipt == null) return CommandReceiptReadResult.missing(request.requestId);
        if (!receipt.requestFingerprint.equals(request.requestFingerprint)) {
            throw failure("STORE_KERNEL_IDEMPOTENCY_FINGERPRINT_CONFLICT");
        }
        return CommandReceiptReadResult.found(request.requestId, receipt);
    }

    private CommitResult commitInTransaction(StoreKernelContract.CommitRequest request) {
        final StoreKernelCommandReceiptEntity prior = dao.readReceipt(
            request.storeId,
            request.operationId,
            request.idempotencyKey
        );
        trip(FailurePoint.AFTER_IDEMPOTENCY_LOOKUP);
        if (prior != null) {
            if (!prior.requestFingerprint.equals(request.requestFingerprint)) {
                throw failure("STORE_KERNEL_IDEMPOTENCY_FINGERPRINT_CONFLICT");
            }
            return CommitResult.replay(request.requestId, prior);
        }

        validateClosedCommit(request);
        final List<StoreKernelAggregateEntity> currentAggregates = new ArrayList<>();
        for (StoreKernelContract.AggregateMutation mutation : request.mutations) {
            final StoreKernelAggregateEntity current = dao.readAggregate(
                request.storeId,
                mutation.aggregateType,
                mutation.aggregateId
            );
            final long actualRevision = current == null ? 0 : current.revision;
            if (actualRevision != mutation.expectedRevision) {
                throw failure("STORE_KERNEL_AGGREGATE_REVISION_CONFLICT");
            }
            currentAggregates.add(current);
        }
        if (request.inbox != null) {
            final StoreKernelInboxEntity inbox = dao.readInbox(
                request.storeId,
                request.inbox.source,
                request.inbox.sourceEventId
            );
            if (inbox == null) throw failure("STORE_KERNEL_INBOX_NOT_DURABLE");
            if (!inbox.payloadHash.equals(request.inbox.payloadHash)) {
                throw failure("STORE_KERNEL_INBOX_FINGERPRINT_CONFLICT");
            }
            if (!"RECEIVED".equals(inbox.status)) throw failure("STORE_KERNEL_INBOX_ALREADY_APPLIED");
        }
        trip(FailurePoint.AFTER_REVISION_VALIDATION);

        for (int index = 0; index < request.mutations.size(); index++) {
            final StoreKernelContract.AggregateMutation mutation = request.mutations.get(index);
            final String stateHash = StoreKernelContract.sha256(mutation.stateJson);
            if (currentAggregates.get(index) == null) {
                final long inserted = dao.insertAggregate(new StoreKernelAggregateEntity(
                    request.storeId,
                    mutation.aggregateType,
                    mutation.aggregateId,
                    mutation.newRevision(),
                    mutation.stateJson,
                    stateHash,
                    request.committedAt
                ));
                if (inserted < 0) throw failure("STORE_KERNEL_AGGREGATE_REVISION_CONFLICT");
            } else {
                final int updated = dao.compareAndSetAggregate(
                    request.storeId,
                    mutation.aggregateType,
                    mutation.aggregateId,
                    mutation.expectedRevision,
                    mutation.newRevision(),
                    mutation.stateJson,
                    stateHash,
                    request.committedAt
                );
                if (updated != 1) throw failure("STORE_KERNEL_AGGREGATE_REVISION_CONFLICT");
            }
            trip(FailurePoint.AFTER_AGGREGATE_MUTATION);
        }

        final long commitSequence = dao.nextCommitSequence();
        final StoreKernelCommandReceiptEntity receipt = new StoreKernelCommandReceiptEntity(
            request.storeId,
            request.operationId,
            request.idempotencyKey,
            request.commandId,
            request.requestFingerprint,
            request.resultJson,
            StoreKernelContract.sha256(request.resultJson),
            request.traceId,
            commitSequence,
            request.committedAt
        );
        dao.insertReceipt(receipt);
        trip(FailurePoint.AFTER_RECEIPT);

        if (request.inbox != null) {
            final int changed = dao.markInboxApplied(
                request.storeId,
                request.inbox.source,
                request.inbox.sourceEventId,
                request.inbox.payloadHash,
                request.commandId,
                request.committedAt
            );
            if (changed != 1) throw failure("STORE_KERNEL_INBOX_CONSUME_CONFLICT");
            trip(FailurePoint.AFTER_INBOX_MUTATION);
        }

        for (StoreKernelContract.OutboxEffect effect : request.outbox) {
            dao.insertOutbox(new StoreKernelOutboxEntity(
                effect.eventId,
                request.storeId,
                effect.aggregateType,
                effect.aggregateId,
                effect.aggregateRevision,
                effect.eventType,
                effect.occurredAt,
                effect.payloadJson,
                StoreKernelContract.sha256(effect.payloadJson),
                "PENDING",
                0,
                null,
                0,
                null,
                null,
                null
            ));
            trip(FailurePoint.AFTER_OUTBOX_MUTATION);
        }

        insertJournal(request.traceId, request.commandId, 1, "RECEIVED", request.committedAt, commitSequence);
        insertJournal(request.traceId, request.commandId, 2, "VALIDATED", request.committedAt, commitSequence);
        insertJournal(request.traceId, request.commandId, 3, "LOCAL_TX_COMMITTED", request.committedAt, commitSequence);
        trip(FailurePoint.AFTER_JOURNAL_MUTATION);
        trip(FailurePoint.BEFORE_TRANSACTION_RETURN);
        return CommitResult.committed(request.requestId, receipt);
    }

    private InboxAppendResult appendInboxInTransaction(StoreKernelContract.InboxAppendRequest request) {
        final String payloadHash = StoreKernelContract.sha256(request.payloadJson);
        final StoreKernelInboxEntity existing = dao.readInbox(request.storeId, request.source, request.sourceEventId);
        if (existing != null) {
            if (!existing.payloadHash.equals(payloadHash)) {
                throw failure("STORE_KERNEL_INBOX_FINGERPRINT_CONFLICT");
            }
            return new InboxAppendResult(request.requestId, existing, true);
        }
        final StoreKernelInboxEntity inbox = new StoreKernelInboxEntity(
            request.storeId,
            request.source,
            request.sourceEventId,
            request.payloadJson,
            payloadHash,
            "RECEIVED",
            request.traceId,
            request.receivedAt,
            null,
            null
        );
        if (dao.insertInbox(inbox) < 0) throw failure("STORE_KERNEL_INBOX_CONFLICT");
        trip(FailurePoint.AFTER_INBOX_INSERT);
        insertJournal(request.traceId, "inbox:" + request.sourceEventId, 1, "RECEIVED", request.receivedAt, 0);
        insertJournal(request.traceId, "inbox:" + request.sourceEventId, 2, "LOCAL_TX_COMMITTED", request.receivedAt, 0);
        trip(FailurePoint.AFTER_JOURNAL_MUTATION);
        return new InboxAppendResult(request.requestId, inbox, false);
    }

    private List<OutboxEnvelope> claimOutboxInTransaction(StoreKernelContract.OutboxClaimRequest request) {
        final long expiry = request.nowEpochMs + request.leaseDurationMs;
        final List<StoreKernelOutboxEntity> candidates = dao.readClaimableOutbox(
            request.storeId,
            request.eventType,
            request.nowEpochMs,
            request.limit
        );
        final List<OutboxEnvelope> claimed = new ArrayList<>();
        for (StoreKernelOutboxEntity candidate : candidates) {
            final int changed = dao.claimOutbox(
                candidate.eventId,
                request.leaseOwner,
                request.nowEpochMs,
                expiry,
                request.observedAt
            );
            if (changed == 1) {
                final StoreKernelOutboxEntity current = dao.readOutbox(candidate.eventId);
                if (current == null) throw failure("STORE_KERNEL_OUTBOX_CLAIM_LOST");
                claimed.add(new OutboxEnvelope(current));
            }
        }
        return claimed;
    }

    private void validateClosedCommit(StoreKernelContract.CommitRequest request) {
        final Set<String> aggregateKeys = new HashSet<>();
        final Set<String> aggregateRevisions = new HashSet<>();
        for (StoreKernelContract.AggregateMutation mutation : request.mutations) {
            final String key = mutation.aggregateType + "\u0000" + mutation.aggregateId;
            if (!aggregateKeys.add(key)) throw failure("STORE_KERNEL_DUPLICATE_AGGREGATE_MUTATION");
            aggregateRevisions.add(key + "\u0000" + mutation.newRevision());
        }
        final Set<String> eventIds = new HashSet<>();
        for (StoreKernelContract.OutboxEffect effect : request.outbox) {
            if (!eventIds.add(effect.eventId)) throw failure("STORE_KERNEL_DUPLICATE_OUTBOX_EVENT");
            final String ownerRevision = effect.aggregateType + "\u0000" + effect.aggregateId + "\u0000" + effect.aggregateRevision;
            if (!aggregateRevisions.contains(ownerRevision)) {
                throw failure("STORE_KERNEL_OUTBOX_REVISION_NOT_COMMITTED");
            }
        }
    }

    private void insertJournal(
        String traceId,
        String commandId,
        int sequence,
        String stage,
        String observedAt,
        long commitSequence
    ) {
        final JSONObject detail = new JSONObject();
        try {
            detail.put("commitSequence", commitSequence);
            detail.put("database", StoreKernelDatabase.DATABASE_NAME);
        } catch (JSONException impossible) {
            throw new IllegalStateException("STORE_KERNEL_JOURNAL_ENCODING_FAILED", impossible);
        }
        dao.insertJournal(new StoreKernelJournalEntity(
            traceId,
            traceId + ":" + sequence,
            commandId,
            sequence,
            stage,
            "OK",
            null,
            detail.toString(),
            observedAt
        ));
    }

    private void trip(FailurePoint point) {
        if (failurePoint == point) throw failure("STORE_KERNEL_TEST_FAILURE_" + point.name());
    }

    private <T> CompletableFuture<T> submit(Callable<T> operation) {
        final CompletableFuture<T> result = new CompletableFuture<>();
        if (closed.get()) {
            result.completeExceptionally(failure("STORE_KERNEL_COORDINATOR_CLOSED"));
            return result;
        }
        try {
            database.serialWriter().execute(() -> {
                if (closed.get()) {
                    result.completeExceptionally(failure("STORE_KERNEL_COORDINATOR_CLOSED"));
                    return;
                }
                try {
                    result.complete(operation.call());
                } catch (Throwable error) {
                    result.completeExceptionally(error);
                }
            });
        } catch (RejectedExecutionException error) {
            result.completeExceptionally(failure("STORE_KERNEL_COORDINATOR_CLOSED"));
        }
        return result;
    }

    private static StoreKernelFailure failure(String code) {
        return new StoreKernelFailure(code);
    }

    @Override
    public void close() {
        closed.set(true);
    }

    public static final class StoreKernelFailure extends IllegalStateException {
        public final String code;

        StoreKernelFailure(String code) {
            super(code);
            this.code = code;
        }
    }

    public static final class CommitResult {
        public final String requestId;
        public final String commandId;
        public final String traceId;
        public final long commitSequence;
        public final String committedAt;
        public final String resultJson;
        public final boolean replayed;

        private CommitResult(String requestId, StoreKernelCommandReceiptEntity receipt, boolean replayed) {
            this.requestId = requestId;
            this.commandId = receipt.commandId;
            this.traceId = receipt.traceId;
            this.commitSequence = receipt.commitSequence;
            this.committedAt = receipt.committedAt;
            this.resultJson = receipt.resultJson;
            this.replayed = replayed;
        }

        static CommitResult committed(String requestId, StoreKernelCommandReceiptEntity receipt) {
            return new CommitResult(requestId, receipt, false);
        }

        static CommitResult replay(String requestId, StoreKernelCommandReceiptEntity receipt) {
            return new CommitResult(requestId, receipt, true);
        }

        public JSONObject toJson() throws JSONException {
            final JSONObject value = baseResponse("store.kernel.commit.completed.v1", requestId, "committed");
            value.put("commandId", commandId);
            value.put("traceId", traceId);
            value.put("commitSequence", commitSequence);
            value.put("committedAt", committedAt);
            value.put("replayed", replayed);
            value.put("result", new JSONTokener(resultJson).nextValue());
            return value;
        }
    }

    public static final class CommandReceiptReadResult {
        public final String requestId;
        public final boolean found;
        public final String commandId;
        public final String requestFingerprint;
        public final String resultHash;
        public final String resultJson;
        public final String traceId;
        public final long commitSequence;
        public final String committedAt;

        private CommandReceiptReadResult(String requestId, StoreKernelCommandReceiptEntity receipt) {
            this.requestId = requestId;
            this.found = receipt != null;
            this.commandId = receipt == null ? null : receipt.commandId;
            this.requestFingerprint = receipt == null ? null : receipt.requestFingerprint;
            this.resultHash = receipt == null ? null : receipt.resultHash;
            this.resultJson = receipt == null ? null : receipt.resultJson;
            this.traceId = receipt == null ? null : receipt.traceId;
            this.commitSequence = receipt == null ? 0 : receipt.commitSequence;
            this.committedAt = receipt == null ? null : receipt.committedAt;
        }

        static CommandReceiptReadResult found(String requestId, StoreKernelCommandReceiptEntity receipt) {
            return new CommandReceiptReadResult(requestId, receipt);
        }

        static CommandReceiptReadResult missing(String requestId) {
            return new CommandReceiptReadResult(requestId, null);
        }

        public JSONObject toJson() throws JSONException {
            final JSONObject value = baseResponse("store.kernel.command.receipt.read.completed.v1", requestId, "ok");
            value.put("found", found);
            if (found) {
                value.put("commandId", commandId);
                value.put("requestFingerprint", requestFingerprint);
                value.put("resultHash", resultHash);
                value.put("result", new JSONTokener(resultJson).nextValue());
                value.put("traceId", traceId);
                value.put("commitSequence", commitSequence);
                value.put("committedAt", committedAt);
            }
            return value;
        }
    }

    public static final class AggregateSnapshotItem {
        public final boolean found;
        public final String aggregateType;
        public final String aggregateId;
        public final long revision;
        public final String stateJson;
        public final String stateHash;

        AggregateSnapshotItem(StoreKernelContract.AggregateKey key, StoreKernelAggregateEntity entity) {
            this.found = entity != null;
            this.aggregateType = key.aggregateType;
            this.aggregateId = key.aggregateId;
            this.revision = entity == null ? 0 : entity.revision;
            this.stateJson = entity == null ? null : entity.stateJson;
            this.stateHash = entity == null ? null : entity.stateHash;
        }

        JSONObject toJson() throws JSONException {
            final JSONObject value = new JSONObject();
            value.put("found", found);
            value.put("aggregateType", aggregateType);
            value.put("aggregateId", aggregateId);
            value.put("revision", revision);
            value.put("state", found ? new JSONTokener(stateJson).nextValue() : JSONObject.NULL);
            value.put("stateHash", found ? stateHash : JSONObject.NULL);
            return value;
        }
    }

    public static final class AggregateSnapshotResult {
        public final String requestId;
        public final List<AggregateSnapshotItem> items;

        AggregateSnapshotResult(String requestId, List<AggregateSnapshotItem> items) {
            this.requestId = requestId;
            this.items = java.util.Collections.unmodifiableList(new ArrayList<>(items));
        }

        public JSONObject toJson() throws JSONException {
            final JSONObject value = baseResponse("store.kernel.aggregate.snapshot.completed.v1", requestId, "ok");
            final JSONArray rows = new JSONArray();
            for (AggregateSnapshotItem item : items) rows.put(item.toJson());
            value.put("items", rows);
            return value;
        }
    }

    public static final class InboxAppendResult {
        public final String requestId;
        public final String sourceEventId;
        public final String payloadHash;
        public final String status;
        public final boolean replayed;

        InboxAppendResult(String requestId, StoreKernelInboxEntity inbox, boolean replayed) {
            this.requestId = requestId;
            this.sourceEventId = inbox.sourceEventId;
            this.payloadHash = inbox.payloadHash;
            this.status = inbox.status;
            this.replayed = replayed;
        }

        public JSONObject toJson() throws JSONException {
            final JSONObject value = baseResponse("store.kernel.inbox.append.completed.v1", requestId, "committed");
            value.put("sourceEventId", sourceEventId);
            value.put("payloadHash", payloadHash);
            value.put("inboxStatus", status);
            value.put("replayed", replayed);
            return value;
        }
    }

    public static final class OutboxEnvelope {
        public final String eventId;
        public final String storeId;
        public final String aggregateType;
        public final String aggregateId;
        public final long aggregateRevision;
        public final String eventType;
        public final String occurredAt;
        public final String payloadJson;
        public final String payloadHash;
        public final int attemptCount;
        public final String leaseOwner;
        public final long leaseExpiresAtEpochMs;

        OutboxEnvelope(StoreKernelOutboxEntity entity) {
            this.eventId = entity.eventId;
            this.storeId = entity.storeId;
            this.aggregateType = entity.aggregateType;
            this.aggregateId = entity.aggregateId;
            this.aggregateRevision = entity.aggregateRevision;
            this.eventType = entity.eventType;
            this.occurredAt = entity.occurredAt;
            this.payloadJson = entity.payloadJson;
            this.payloadHash = entity.payloadHash;
            this.attemptCount = entity.attemptCount;
            this.leaseOwner = entity.leaseOwner;
            this.leaseExpiresAtEpochMs = entity.leaseExpiresAtEpochMs;
        }

        JSONObject toJson() throws JSONException {
            final JSONObject value = new JSONObject();
            value.put("eventId", eventId);
            value.put("storeId", storeId);
            value.put("aggregateType", aggregateType);
            value.put("aggregateId", aggregateId);
            value.put("aggregateRevision", aggregateRevision);
            value.put("eventType", eventType);
            value.put("occurredAt", occurredAt);
            value.put("payload", new JSONTokener(payloadJson).nextValue());
            value.put("payloadHash", payloadHash);
            value.put("attemptCount", attemptCount);
            value.put("leaseOwner", leaseOwner);
            value.put("leaseExpiresAtEpochMs", leaseExpiresAtEpochMs);
            return value;
        }
    }

    public static final class HealthResult {
        public final String writerThread;
        public final int schemaVersion;
        public final String journalMode;
        public final int synchronous;
        public final long aggregateCount;
        public final long receiptCount;
        public final long inboxCount;
        public final long outboxCount;
        public final long journalCount;

        HealthResult(
            String writerThread,
            int schemaVersion,
            String journalMode,
            int synchronous,
            long aggregateCount,
            long receiptCount,
            long inboxCount,
            long outboxCount,
            long journalCount
        ) {
            this.writerThread = writerThread;
            this.schemaVersion = schemaVersion;
            this.journalMode = journalMode;
            this.synchronous = synchronous;
            this.aggregateCount = aggregateCount;
            this.receiptCount = receiptCount;
            this.inboxCount = inboxCount;
            this.outboxCount = outboxCount;
            this.journalCount = journalCount;
        }

        public JSONObject toJson(String requestId) throws JSONException {
            final JSONObject value = baseResponse("store.kernel.health.completed.v1", requestId, "ok");
            value.put("schemaVersion", schemaVersion);
            value.put("databaseName", StoreKernelDatabase.DATABASE_NAME);
            value.put("writerThread", writerThread);
            value.put("journalMode", journalMode);
            value.put("synchronous", synchronous);
            final JSONObject counts = new JSONObject();
            counts.put("aggregates", aggregateCount);
            counts.put("receipts", receiptCount);
            counts.put("inbox", inboxCount);
            counts.put("outbox", outboxCount);
            counts.put("journal", journalCount);
            value.put("counts", counts);
            return value;
        }
    }

    static JSONObject outboxClaimJson(String requestId, List<OutboxEnvelope> envelopes) throws JSONException {
        final JSONObject value = baseResponse("store.kernel.outbox.claim.completed.v1", requestId, "claimed");
        final JSONArray items = new JSONArray();
        for (OutboxEnvelope envelope : envelopes) items.put(envelope.toJson());
        value.put("items", items);
        return value;
    }

    static JSONObject simpleCompletion(String type, String requestId) throws JSONException {
        return baseResponse(type, requestId, "committed");
    }

    private static JSONObject baseResponse(String type, String requestId, String status) throws JSONException {
        final JSONObject value = new JSONObject();
        value.put("protocolVersion", StoreKernelContract.PROTOCOL_VERSION);
        value.put("type", type);
        value.put("requestId", requestId);
        value.put("status", status);
        return value;
    }
}
