package com.morefunos.smt.storekernel;

import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;

@Entity(
    tableName = "store_kernel_aggregate",
    primaryKeys = {"store_id", "aggregate_type", "aggregate_id"},
    indices = {@Index(value = {"store_id", "aggregate_type"})}
)
public final class StoreKernelAggregateEntity {
    @NonNull @ColumnInfo(name = "store_id") public final String storeId;
    @NonNull @ColumnInfo(name = "aggregate_type") public final String aggregateType;
    @NonNull @ColumnInfo(name = "aggregate_id") public final String aggregateId;
    @ColumnInfo(name = "revision") public final long revision;
    @NonNull @ColumnInfo(name = "state_json") public final String stateJson;
    @NonNull @ColumnInfo(name = "state_hash") public final String stateHash;
    @NonNull @ColumnInfo(name = "updated_at") public final String updatedAt;

    public StoreKernelAggregateEntity(
        @NonNull String storeId,
        @NonNull String aggregateType,
        @NonNull String aggregateId,
        long revision,
        @NonNull String stateJson,
        @NonNull String stateHash,
        @NonNull String updatedAt
    ) {
        this.storeId = storeId;
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.revision = revision;
        this.stateJson = stateJson;
        this.stateHash = stateHash;
        this.updatedAt = updatedAt;
    }
}
