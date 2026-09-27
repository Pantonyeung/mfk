package com.morefunos.smt.runtime;

public final class RuntimeBundleMetadata {
    public final String releaseId;
    public final String runtimeVersion;
    public final String channel;
    public final int minCarrierVersionCode;
    public final int bridgeVersion;
    public final String archiveSha256;

    public RuntimeBundleMetadata(
        String releaseId,
        String runtimeVersion,
        String channel,
        int minCarrierVersionCode,
        int bridgeVersion,
        String archiveSha256
    ) {
        this.releaseId = releaseId;
        this.runtimeVersion = runtimeVersion;
        this.channel = channel;
        this.minCarrierVersionCode = minCarrierVersionCode;
        this.bridgeVersion = bridgeVersion;
        this.archiveSha256 = archiveSha256;
    }
}
