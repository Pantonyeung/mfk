package com.morefunos.smt.storekernel;

import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

@Entity(
    tableName = "store_kernel_outbox",
    indices = {
        @Index(value = {"status", "lease_expires_at_epoch_ms", "occurred_at"}),
        @Index(value = {"store_id", "aggregate_type", "aggregate_id", "aggregate_revision"})
    }
)
public final class StoreKernelOutboxEntity {
    @PrimaryKey @NonNull @ColumnInfo(name = "event_id") public final String eventId;
    @NonNull @ColumnInfo(name = "store_id") public final String storeId;
    @NonNull @ColumnInfo(name = "aggregate_type") public final String aggregateType;
    @NonNull @ColumnInfo(name = "aggregate_id") public final String aggregateId;
    @ColumnInfo(name = "aggregate_revision") public final long aggregateRevision;
    @NonNull @ColumnInfo(name = "event_type") public final String eventType;
    @NonNull @ColumnInfo(name = "occurred_at") public final String occurredAt;
    @NonNull @ColumnInfo(name = "payload_json") public final String payloadJson;
    @NonNull @ColumnInfo(name = "payload_hash") public final String payloadHash;
    @NonNull @ColumnInfo(name = "status") public final String status;
    @ColumnInfo(name = "attempt_count") public final int attemptCount;
    @ColumnInfo(name = "lease_owner") public final String leaseOwner;
    @ColumnInfo(name = "lease_expires_at_epoch_ms") public final long leaseExpiresAtEpochMs;
    @ColumnInfo(name = "last_attempt_at") public final String lastAttemptAt;
    @ColumnInfo(name = "last_error") public final String lastError;
    @ColumnInfo(name = "acknowledged_at") public final String acknowledgedAt;

    public StoreKernelOutboxEntity(
        @NonNull String eventId,
        @NonNull String storeId,
        @NonNull String aggregateType,
        @NonNull String aggregateId,
        long aggregateRevision,
        @NonNull String eventType,
        @NonNull String occurredAt,
        @NonNull String payloadJson,
        @NonNull String payloadHash,
        @NonNull String status,
        int attemptCount,
        String leaseOwner,
        long leaseExpiresAtEpochMs,
        String lastAttemptAt,
        String lastError,
        String acknowledgedAt
    ) {
        this.eventId = eventId;
        this.storeId = storeId;
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.aggregateRevision = aggregateRevision;
        this.eventType = eventType;
        this.occurredAt = occurredAt;
        this.payloadJson = payloadJson;
        this.payloadHash = payloadHash;
        this.status = status;
        this.attemptCount = attemptCount;
        this.leaseOwner = leaseOwner;
        this.leaseExpiresAtEpochMs = leaseExpiresAtEpochMs;
        this.lastAttemptAt = lastAttemptAt;
        this.lastError = lastError;
        this.acknowledgedAt = acknowledgedAt;
    }
}
