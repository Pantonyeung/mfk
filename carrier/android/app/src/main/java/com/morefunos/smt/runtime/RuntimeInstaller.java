package com.morefunos.smt.runtime;

import android.content.Context;

import java.io.File;
import java.io.IOException;

public final class RuntimeInstaller {
    private final File stagingRoot;
    private final RuntimeReleaseStore releaseStore;
    private final RuntimeBundleVerifier verifier;

    public RuntimeInstaller(Context context, int carrierVersionCode, int bridgeVersion) {
        this.stagingRoot = new File(context.getFilesDir(), "runtime/staging");
        this.releaseStore = new RuntimeReleaseStore(context);
        this.verifier = new RuntimeBundleVerifier(context, carrierVersionCode, bridgeVersion);
    }

    public synchronized RuntimeBundleMetadata stageSignedBundle(File bundle, String expectedArchiveSha256) throws IOException {
        if (!stagingRoot.exists() && !stagingRoot.mkdirs()) throw new IOException("RUNTIME_STAGING_ROOT_UNAVAILABLE");
        final File stagingDirectory = new File(stagingRoot, "incoming");
        final RuntimeBundleVerifier.VerifiedRuntimeBundle verified = verifier.verifyAndExtract(
            bundle,
            expectedArchiveSha256,
            stagingDirectory
        );

        final File target = releaseStore.releaseDirectory(verified.metadata.releaseId);
        final File parent = target.getParentFile();
        if (parent == null || (!parent.exists() && !parent.mkdirs())) {
            RuntimeBundleVerifier.deleteRecursively(stagingDirectory);
            throw new IOException("RUNTIME_RELEASES_DIRECTORY_UNAVAILABLE");
        }
        if (target.exists()) {
            if (!new File(target, "index.html").isFile()) {
                RuntimeBundleVerifier.deleteRecursively(stagingDirectory);
                throw new IOException("RUNTIME_RELEASE_ALREADY_EXISTS_UNUSABLE");
            }
            RuntimeBundleVerifier.deleteRecursively(stagingDirectory);
            releaseStore.stageCandidate(verified.metadata.releaseId);
            return verified.metadata;
        }
        if (!stagingDirectory.renameTo(target)) {
            RuntimeBundleVerifier.deleteRecursively(stagingDirectory);
            throw new IOException("RUNTIME_RELEASE_PROMOTION_FAILED");
        }
        try {
            releaseStore.stageCandidate(verified.metadata.releaseId);
        } catch (IOException | RuntimeException error) {
            RuntimeBundleVerifier.deleteRecursively(target);
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("RUNTIME_CANDIDATE_STAGE_FAILED", error);
        }
        return verified.metadata;
    }
}
