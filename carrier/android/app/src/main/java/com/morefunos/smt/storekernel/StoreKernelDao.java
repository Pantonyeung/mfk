package com.morefunos.smt.storekernel;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

@Dao
interface StoreKernelDao {
    @Query("SELECT * FROM store_kernel_aggregate WHERE store_id = :storeId AND aggregate_type = :aggregateType AND aggregate_id = :aggregateId LIMIT 1")
    StoreKernelAggregateEntity readAggregate(String storeId, String aggregateType, String aggregateId);

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insertAggregate(StoreKernelAggregateEntity aggregate);

    @Query(
        "UPDATE store_kernel_aggregate " +
        "SET revision = :newRevision, state_json = :stateJson, state_hash = :stateHash, updated_at = :updatedAt " +
        "WHERE store_id = :storeId AND aggregate_type = :aggregateType AND aggregate_id = :aggregateId AND revision = :expectedRevision"
    )
    int compareAndSetAggregate(
        String storeId,
        String aggregateType,
        String aggregateId,
        long expectedRevision,
        long newRevision,
        String stateJson,
        String stateHash,
        String updatedAt
    );

    @Query("SELECT * FROM store_kernel_command_receipt WHERE store_id = :storeId AND operation_id = :operationId AND idempotency_key = :idempotencyKey LIMIT 1")
    StoreKernelCommandReceiptEntity readReceipt(String storeId, String operationId, String idempotencyKey);

    @Insert(onConflict = OnConflictStrategy.ABORT)
    void insertReceipt(StoreKernelCommandReceiptEntity receipt);

    @Query("SELECT COALESCE(MAX(commit_sequence), 0) + 1 FROM store_kernel_command_receipt")
    long nextCommitSequence();

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insertInbox(StoreKernelInboxEntity inbox);

    @Query("SELECT * FROM store_kernel_inbox WHERE store_id = :storeId AND source = :source AND source_event_id = :sourceEventId LIMIT 1")
    StoreKernelInboxEntity readInbox(String storeId, String source, String sourceEventId);

    @Query(
        "UPDATE store_kernel_inbox " +
        "SET status = 'APPLIED', applied_command_id = :commandId, applied_at = :appliedAt " +
        "WHERE store_id = :storeId AND source = :source AND source_event_id = :sourceEventId " +
        "AND status = 'RECEIVED' AND payload_hash = :payloadHash"
    )
    int markInboxApplied(
        String storeId,
        String source,
        String sourceEventId,
        String payloadHash,
        String commandId,
        String appliedAt
    );

    @Insert(onConflict = OnConflictStrategy.ABORT)
    void insertOutbox(StoreKernelOutboxEntity outbox);

    @Query("SELECT * FROM store_kernel_outbox WHERE event_id = :eventId LIMIT 1")
    StoreKernelOutboxEntity readOutbox(String eventId);

    @Query(
        "SELECT * FROM store_kernel_outbox " +
        "WHERE store_id = :storeId AND event_type = :eventType " +
        "AND (status = 'PENDING' OR (status = 'PROCESSING' AND lease_expires_at_epoch_ms <= :nowEpochMs)) " +
        "ORDER BY occurred_at ASC, event_id ASC LIMIT :limit"
    )
    List<StoreKernelOutboxEntity> readClaimableOutbox(
        String storeId,
        String eventType,
        long nowEpochMs,
        int limit
    );

    @Query(
        "UPDATE store_kernel_outbox SET status = 'PROCESSING', attempt_count = attempt_count + 1, " +
        "lease_owner = :leaseOwner, lease_expires_at_epoch_ms = :leaseExpiresAtEpochMs, " +
        "last_attempt_at = :attemptedAt, last_error = NULL " +
        "WHERE event_id = :eventId AND " +
        "(status = 'PENDING' OR (status = 'PROCESSING' AND lease_expires_at_epoch_ms <= :nowEpochMs))"
    )
    int claimOutbox(
        String eventId,
        String leaseOwner,
        long nowEpochMs,
        long leaseExpiresAtEpochMs,
        String attemptedAt
    );

    @Query(
        "UPDATE store_kernel_outbox SET status = 'ACKNOWLEDGED', lease_owner = NULL, " +
        "lease_expires_at_epoch_ms = 0, acknowledged_at = :acknowledgedAt, last_error = NULL " +
        "WHERE event_id = :eventId AND status = 'PROCESSING' AND lease_owner = :leaseOwner"
    )
    int acknowledgeOutbox(String eventId, String leaseOwner, String acknowledgedAt);

    @Query(
        "UPDATE store_kernel_outbox SET status = 'PENDING', lease_owner = NULL, " +
        "lease_expires_at_epoch_ms = 0, last_error = :errorCode " +
        "WHERE event_id = :eventId AND status = 'PROCESSING' AND lease_owner = :leaseOwner"
    )
    int releaseOutbox(String eventId, String leaseOwner, String errorCode);

    @Query("SELECT * FROM store_kernel_outbox ORDER BY occurred_at ASC, event_id ASC")
    List<StoreKernelOutboxEntity> readAllOutbox();

    @Insert(onConflict = OnConflictStrategy.ABORT)
    void insertJournal(StoreKernelJournalEntity checkpoint);

    @Query("SELECT * FROM store_kernel_diagnostic_journal WHERE trace_id = :traceId ORDER BY sequence ASC")
    List<StoreKernelJournalEntity> readJournal(String traceId);

    @Query("SELECT COUNT(*) FROM store_kernel_aggregate")
    long aggregateCount();

    @Query("SELECT COUNT(*) FROM store_kernel_command_receipt")
    long receiptCount();

    @Query("SELECT COUNT(*) FROM store_kernel_inbox")
    long inboxCount();

    @Query("SELECT COUNT(*) FROM store_kernel_outbox")
    long outboxCount();

    @Query("SELECT COUNT(*) FROM store_kernel_diagnostic_journal")
    long journalCount();
}
