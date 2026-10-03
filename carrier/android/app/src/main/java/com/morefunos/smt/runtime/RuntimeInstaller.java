package com.morefunos.smt.runtime;

import android.content.Context;

import java.io.BufferedInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;

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
        return stageSignedBundle(bundle, expectedArchiveSha256, null);
    }

    public synchronized RuntimeBundleMetadata stageSignedBundle(
        File bundle,
        String expectedArchiveSha256,
        RuntimeBundleMetadata expectedMetadata
    ) throws IOException {
        if (!stagingRoot.exists() && !stagingRoot.mkdirs()) throw new IOException("RUNTIME_STAGING_ROOT_UNAVAILABLE");
        final File stagingDirectory = new File(stagingRoot, "incoming");
        try {
            final RuntimeBundleVerifier.VerifiedRuntimeBundle verified = verifier.verifyAndExtract(
                bundle,
                expectedArchiveSha256,
                stagingDirectory
            );
            if (expectedMetadata != null && !metadataMatches(expectedMetadata, verified.metadata)) {
                throw new IOException("RUNTIME_UPDATE_MANIFEST_BUNDLE_MISMATCH");
            }
            writeVerificationReceipt(stagingDirectory, verified.metadata);

            synchronized (releaseStore.sharedStateLock()) {
                final File target = releaseStore.releaseDirectory(verified.metadata.releaseId);
                final File parent = target.getParentFile();
                if (parent == null || (!parent.exists() && !parent.mkdirs())) {
                    throw new IOException("RUNTIME_RELEASES_DIRECTORY_UNAVAILABLE");
                }
                if (target.exists()) {
                    if (!sameTree(stagingDirectory, target)) {
                        throw new IOException("RUNTIME_RELEASE_ALREADY_EXISTS");
                    }
                    final RuntimeActivationState state = releaseStore.snapshot();
                    final String releaseId = verified.metadata.releaseId;
                    if (!releaseId.equals(state.currentReleaseId)
                        && !releaseId.equals(state.candidateReleaseId)
                        && !releaseId.equals(state.bootingReleaseId)) {
                        releaseStore.stageCandidate(releaseId);
                    }
                    return verified.metadata;
                }
                if (!stagingDirectory.renameTo(target)) {
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
        } finally {
            RuntimeBundleVerifier.deleteRecursively(stagingDirectory);
        }
    }

    private static boolean metadataMatches(RuntimeBundleMetadata expected, RuntimeBundleMetadata actual) {
        return expected.releaseId.equals(actual.releaseId)
            && expected.runtimeVersion.equals(actual.runtimeVersion)
            && expected.channel.equals(actual.channel)
            && expected.minCarrierVersionCode == actual.minCarrierVersionCode
            && expected.bridgeVersion == actual.bridgeVersion
            && expected.archiveSha256.equalsIgnoreCase(actual.archiveSha256);
    }

    private static void writeVerificationReceipt(File directory, RuntimeBundleMetadata metadata) throws IOException {
        final File receiptDirectory = new File(directory, "META-INF");
        if (!receiptDirectory.mkdir()) throw new IOException("RUNTIME_VERIFICATION_RECEIPT_UNAVAILABLE");
        try (FileOutputStream file = new FileOutputStream(
                 new File(receiptDirectory, "morefun-runtime-verification"));
             DataOutputStream output = new DataOutputStream(file)) {
            output.writeUTF("MORE_FUN_VERIFIED_RUNTIME_V1");
            output.writeUTF(metadata.releaseId);
            output.writeUTF(metadata.runtimeVersion);
            output.writeUTF(metadata.channel);
            output.writeInt(metadata.minCarrierVersionCode);
            output.writeInt(metadata.bridgeVersion);
            output.writeUTF(metadata.archiveSha256);
            output.flush();
            file.getFD().sync();
        }
    }

    private static boolean sameTree(File expected, File actual) throws IOException {
        if (expected.isDirectory()) {
            if (!actual.isDirectory()) return false;
            final String[] expectedNames = expected.list();
            final String[] actualNames = actual.list();
            if (expectedNames == null || actualNames == null) return false;
            Arrays.sort(expectedNames);
            Arrays.sort(actualNames);
            if (!Arrays.equals(expectedNames, actualNames)) return false;
            final File actualCanonical = actual.getCanonicalFile();
            for (String name : expectedNames) {
                final File child = new File(actual, name);
                if (!child.getCanonicalFile().equals(new File(actualCanonical, name))) return false;
                if (!sameTree(new File(expected, name), child)) return false;
            }
            return true;
        }
        if (!expected.isFile() || !actual.isFile() || expected.length() != actual.length()) return false;
        try (BufferedInputStream left = new BufferedInputStream(new FileInputStream(expected));
             BufferedInputStream right = new BufferedInputStream(new FileInputStream(actual))) {
            int value;
            while ((value = left.read()) != -1) {
                if (value != right.read()) return false;
            }
            return right.read() == -1;
        }
    }
}
