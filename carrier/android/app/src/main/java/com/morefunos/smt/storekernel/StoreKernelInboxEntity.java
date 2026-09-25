package com.morefunos.smt.storekernel;

import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;

@Entity(
    tableName = "store_kernel_inbox",
    primaryKeys = {"store_id", "source", "source_event_id"},
    indices = {
        @Index(value = {"status", "received_at"}),
        @Index(value = {"trace_id"})
    }
)
public final class StoreKernelInboxEntity {
    @NonNull @ColumnInfo(name = "store_id") public final String storeId;
    @NonNull @ColumnInfo(name = "source") public final String source;
    @NonNull @ColumnInfo(name = "source_event_id") public final String sourceEventId;
    @NonNull @ColumnInfo(name = "payload_json") public final String payloadJson;
    @NonNull @ColumnInfo(name = "payload_hash") public final String payloadHash;
    @NonNull @ColumnInfo(name = "status") public final String status;
    @NonNull @ColumnInfo(name = "trace_id") public final String traceId;
    @NonNull @ColumnInfo(name = "received_at") public final String receivedAt;
    @ColumnInfo(name = "applied_command_id") public final String appliedCommandId;
    @ColumnInfo(name = "applied_at") public final String appliedAt;

    public StoreKernelInboxEntity(
        @NonNull String storeId,
        @NonNull String source,
        @NonNull String sourceEventId,
        @NonNull String payloadJson,
        @NonNull String payloadHash,
        @NonNull String status,
        @NonNull String traceId,
        @NonNull String receivedAt,
        String appliedCommandId,
        String appliedAt
    ) {
        this.storeId = storeId;
        this.source = source;
        this.sourceEventId = sourceEventId;
        this.payloadJson = payloadJson;
        this.payloadHash = payloadHash;
        this.status = status;
        this.traceId = traceId;
        this.receivedAt = receivedAt;
        this.appliedCommandId = appliedCommandId;
        this.appliedAt = appliedAt;
    }
}
