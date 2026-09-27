package com.morefunos.smt.storekernel;

import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;

@Entity(
    tableName = "store_kernel_command_receipt",
    primaryKeys = {"store_id", "operation_id", "idempotency_key"},
    indices = {
        @Index(value = {"commit_sequence"}, unique = true),
        @Index(value = {"trace_id"}, unique = true)
    }
)
public final class StoreKernelCommandReceiptEntity {
    @NonNull @ColumnInfo(name = "store_id") public final String storeId;
    @NonNull @ColumnInfo(name = "operation_id") public final String operationId;
    @NonNull @ColumnInfo(name = "idempotency_key") public final String idempotencyKey;
    @NonNull @ColumnInfo(name = "command_id") public final String commandId;
    @NonNull @ColumnInfo(name = "request_fingerprint") public final String requestFingerprint;
    @NonNull @ColumnInfo(name = "result_json") public final String resultJson;
    @NonNull @ColumnInfo(name = "result_hash") public final String resultHash;
    @NonNull @ColumnInfo(name = "trace_id") public final String traceId;
    @ColumnInfo(name = "commit_sequence") public final long commitSequence;
    @NonNull @ColumnInfo(name = "committed_at") public final String committedAt;

    public StoreKernelCommandReceiptEntity(
        @NonNull String storeId,
        @NonNull String operationId,
        @NonNull String idempotencyKey,
        @NonNull String commandId,
        @NonNull String requestFingerprint,
        @NonNull String resultJson,
        @NonNull String resultHash,
        @NonNull String traceId,
        long commitSequence,
        @NonNull String committedAt
    ) {
        this.storeId = storeId;
        this.operationId = operationId;
        this.idempotencyKey = idempotencyKey;
        this.commandId = commandId;
        this.requestFingerprint = requestFingerprint;
        this.resultJson = resultJson;
        this.resultHash = resultHash;
        this.traceId = traceId;
        this.commitSequence = commitSequence;
        this.committedAt = committedAt;
    }
}
