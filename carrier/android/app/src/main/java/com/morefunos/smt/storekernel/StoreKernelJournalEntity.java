package com.morefunos.smt.storekernel;

import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;

@Entity(
    tableName = "store_kernel_diagnostic_journal",
    primaryKeys = {"trace_id", "checkpoint_id"},
    indices = {
        @Index(value = {"command_id"}),
        @Index(value = {"trace_id", "sequence"}, unique = true)
    }
)
public final class StoreKernelJournalEntity {
    @NonNull @ColumnInfo(name = "trace_id") public final String traceId;
    @NonNull @ColumnInfo(name = "checkpoint_id") public final String checkpointId;
    @NonNull @ColumnInfo(name = "command_id") public final String commandId;
    @ColumnInfo(name = "sequence") public final int sequence;
    @NonNull @ColumnInfo(name = "stage") public final String stage;
    @NonNull @ColumnInfo(name = "outcome") public final String outcome;
    @ColumnInfo(name = "code") public final String code;
    @NonNull @ColumnInfo(name = "detail_json") public final String detailJson;
    @NonNull @ColumnInfo(name = "observed_at") public final String observedAt;

    public StoreKernelJournalEntity(
        @NonNull String traceId,
        @NonNull String checkpointId,
        @NonNull String commandId,
        int sequence,
        @NonNull String stage,
        @NonNull String outcome,
        String code,
        @NonNull String detailJson,
        @NonNull String observedAt
    ) {
        this.traceId = traceId;
        this.checkpointId = checkpointId;
        this.commandId = commandId;
        this.sequence = sequence;
        this.stage = stage;
        this.outcome = outcome;
        this.code = code;
        this.detailJson = detailJson;
        this.observedAt = observedAt;
    }
}
