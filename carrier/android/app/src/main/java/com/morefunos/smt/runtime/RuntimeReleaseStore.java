package com.morefunos.smt.runtime;

import android.content.Context;
import android.util.AtomicFile;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public final class RuntimeReleaseStore {
    private static final String RUNTIME_ROOT = "runtime";
    private static final String RELEASES_DIRECTORY = "runtime/releases";
    private static final String ACTIVATION_FILE = "activation.json";
    public static final String PACKAGED_BASELINE_VERSION = "packaged-baseline";

    public static final class BootSelection {
        public final String releaseId;
        public final File directory;
        public final boolean candidateBoot;
        public final String fallbackReason;
        public final String rejectedReleaseId;

        BootSelection(String releaseId, File directory, boolean candidateBoot,
                      String fallbackReason, String rejectedReleaseId) {
            this.releaseId = releaseId;
            this.directory = directory;
            this.candidateBoot = candidateBoot;
            this.fallbackReason = fallbackReason;
            this.rejectedReleaseId = rejectedReleaseId;
        }

        public boolean packagedBaseline() {
            return directory == null;
        }

        public String runtimeVersion() {
            return releaseId == null ? PACKAGED_BASELINE_VERSION : releaseId;
        }
    }

    private final File runtimeRoot;
    private final File releasesDirectory;
    private final AtomicFile activationFile;

    public RuntimeReleaseStore(Context context) {
        this.runtimeRoot = new File(context.getFilesDir(), RUNTIME_ROOT);
        this.releasesDirectory = new File(context.getFilesDir(), RELEASES_DIRECTORY);
        this.activationFile = new AtomicFile(new File(runtimeRoot, ACTIVATION_FILE));
    }

    public synchronized File releaseDirectory(String releaseId) {
        return new File(releasesDirectory, requireReleaseId(releaseId));
    }

    public synchronized RuntimeActivationState snapshot() throws IOException {
        return readState();
    }

    public synchronized RuntimeActivationState stageCandidate(String releaseId) throws IOException {
        final String safeId = requireReleaseId(releaseId);
        final File directory = releaseDirectory(safeId);
        if (!new File(directory, "index.html").isFile()) throw new IOException("RUNTIME_CANDIDATE_ENTRYPOINT_MISSING");
        final RuntimeActivationState current = readState();
        final RuntimeActivationState next = new RuntimeActivationState(
            current.currentReleaseId,
            current.previousReleaseId,
            safeId,
            null,
            false
        );
        writeState(next);
        pruneUnreferencedReleases(next);
        return next;
    }

    public synchronized RuntimeActivationState requestCandidateActivation() throws IOException {
        final RuntimeActivationState current = readState();
        if (current.candidateReleaseId == null) throw new IOException("RUNTIME_CANDIDATE_REQUIRED");
        final RuntimeActivationState next = new RuntimeActivationState(
            current.currentReleaseId,
            current.previousReleaseId,
            current.candidateReleaseId,
            null,
            true
        );
        writeState(next);
        return next;
    }

    public synchronized BootSelection prepareBoot() throws IOException {
        RuntimeActivationState state = readState();
        String fallbackReason = null;
        String rejectedReleaseId = null;

        if (state.bootingReleaseId != null) {
            rejectedReleaseId = state.bootingReleaseId;
            fallbackReason = state.bootingReleaseId.equals(state.candidateReleaseId)
                ? "RUNTIME_FALLBACK_CANDIDATE_NOT_READY"
                : "RUNTIME_FALLBACK_BOOT_STATE_INVALID";
            state = withoutCandidate(state);
            writeState(state);
        }

        if (state.activationRequested) {
            if (state.candidateReleaseId != null) {
                final File candidateDirectory = usableReleaseDirectory(state.candidateReleaseId);
                if (candidateDirectory != null) {
                    final RuntimeActivationState booting = new RuntimeActivationState(
                        state.currentReleaseId,
                        state.previousReleaseId,
                        state.candidateReleaseId,
                        state.candidateReleaseId,
                        false
                    );
                    writeState(booting);
                    pruneUnreferencedReleases(booting);
                    return new BootSelection(state.candidateReleaseId, candidateDirectory, true, null, null);
                }
                rejectedReleaseId = state.candidateReleaseId;
                fallbackReason = "RUNTIME_FALLBACK_CANDIDATE_UNAVAILABLE";
            } else {
                fallbackReason = "RUNTIME_FALLBACK_ACTIVATION_STATE_INVALID";
            }
            state = withoutCandidate(state);
            writeState(state);
        }

        return selectionForStable(state, fallbackReason, rejectedReleaseId);
    }

    public synchronized RuntimeActivationState confirmRuntimeReady(String releaseId) throws IOException {
        final String safeId = requireReleaseId(releaseId);
        final RuntimeActivationState state = readState();
        if (state.bootingReleaseId == null) return state;
        if (!safeId.equals(state.bootingReleaseId)) throw new IOException("RUNTIME_READY_RELEASE_MISMATCH");
        final String previousReleaseId = safeId.equals(state.currentReleaseId) ? state.previousReleaseId : state.currentReleaseId;
        final RuntimeActivationState next = new RuntimeActivationState(safeId, previousReleaseId, null, null, false);
        writeState(next);
        pruneUnreferencedReleases(next);
        return next;
    }

    public synchronized RuntimeActivationState resetToPackagedBaseline() throws IOException {
        activationFile.delete();
        if (releasesDirectory.exists()) {
            RuntimeBundleVerifier.deleteRecursively(releasesDirectory);
            if (releasesDirectory.exists()) throw new IOException("RUNTIME_RELEASES_RESET_FAILED");
        }
        return RuntimeActivationState.empty();
    }

    public synchronized RuntimeActivationState rollback() throws IOException {
        final RuntimeActivationState state = readState();
        if (state.previousReleaseId == null) throw new IOException("RUNTIME_PREVIOUS_RELEASE_REQUIRED");
        final File previousDirectory = usableReleaseDirectory(state.previousReleaseId);
        if (previousDirectory == null) throw new IOException("RUNTIME_PREVIOUS_RELEASE_UNAVAILABLE");
        final RuntimeActivationState next = new RuntimeActivationState(
            state.previousReleaseId,
            state.currentReleaseId,
            null,
            null,
            false
        );
        writeState(next);
        pruneUnreferencedReleases(next);
        return next;
    }

    private BootSelection selectionForStable(RuntimeActivationState state, String fallbackReason,
                                              String rejectedReleaseId) throws IOException {
        if (state.currentReleaseId != null) {
            final File currentDirectory = usableReleaseDirectory(state.currentReleaseId);
            if (currentDirectory != null) {
                pruneUnreferencedReleases(state);
                return new BootSelection(
                    state.currentReleaseId,
                    currentDirectory,
                    false,
                    fallbackReason,
                    rejectedReleaseId
                );
            }
            if (fallbackReason == null) fallbackReason = "RUNTIME_FALLBACK_CURRENT_UNAVAILABLE";
            if (rejectedReleaseId == null) rejectedReleaseId = state.currentReleaseId;
        }

        if (state.previousReleaseId != null) {
            final File previousDirectory = usableReleaseDirectory(state.previousReleaseId);
            if (previousDirectory != null) {
                final RuntimeActivationState recovered = new RuntimeActivationState(
                    state.previousReleaseId,
                    null,
                    state.candidateReleaseId,
                    null,
                    false
                );
                writeState(recovered);
                pruneUnreferencedReleases(recovered);
                return new BootSelection(
                    recovered.currentReleaseId,
                    previousDirectory,
                    false,
                    fallbackReason == null ? "RUNTIME_FALLBACK_PREVIOUS_SELECTED" : fallbackReason,
                    rejectedReleaseId
                );
            }
            if (fallbackReason == null) fallbackReason = "RUNTIME_FALLBACK_PREVIOUS_UNAVAILABLE";
            if (rejectedReleaseId == null) rejectedReleaseId = state.previousReleaseId;
        }

        final RuntimeActivationState baseline = new RuntimeActivationState(
            null,
            null,
            state.candidateReleaseId,
            null,
            false
        );
        if (state.currentReleaseId != null || state.previousReleaseId != null
            || state.bootingReleaseId != null || state.activationRequested) writeState(baseline);
        pruneUnreferencedReleases(baseline);
        return new BootSelection(null, null, false, fallbackReason, rejectedReleaseId);
    }

    private static RuntimeActivationState withoutCandidate(RuntimeActivationState state) {
        return new RuntimeActivationState(
            state.currentReleaseId,
            state.previousReleaseId,
            null,
            null,
            false
        );
    }

    private File usableReleaseDirectory(String releaseId) {
        final File directory = releaseDirectory(releaseId);
        return new File(directory, "index.html").isFile() ? directory : null;
    }

    private void pruneUnreferencedReleases(RuntimeActivationState state) {
        if (!releasesDirectory.isDirectory()) return;
        final Set<String> retained = new HashSet<>();
        retain(retained, state.currentReleaseId);
        retain(retained, state.previousReleaseId);
        retain(retained, state.candidateReleaseId);
        retain(retained, state.bootingReleaseId);
        final File[] children = releasesDirectory.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (child.isDirectory() && !retained.contains(child.getName())) RuntimeBundleVerifier.deleteRecursively(child);
        }
    }

    private static void retain(Set<String> retained, String releaseId) {
        if (releaseId != null && !releaseId.trim().isEmpty()) retained.add(releaseId);
    }

    private RuntimeActivationState readState() throws IOException {
        if (!activationFile.getBaseFile().isFile()) return RuntimeActivationState.empty();
        try (FileInputStream input = activationFile.openRead(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            final byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            final String raw = bytes.toString(StandardCharsets.UTF_8.name());
            return RuntimeActivationState.fromJson(new JSONObject(raw));
        } catch (JSONException error) {
            return RuntimeActivationState.empty();
        }
    }

    private void writeState(RuntimeActivationState state) throws IOException {
        if (!runtimeRoot.exists() && !runtimeRoot.mkdirs()) throw new IOException("RUNTIME_ROOT_UNAVAILABLE");
        if (!releasesDirectory.exists() && !releasesDirectory.mkdirs()) throw new IOException("RUNTIME_RELEASES_DIRECTORY_UNAVAILABLE");
        FileOutputStream output = null;
        try {
            output = activationFile.startWrite();
            output.write(state.toJson().toString().getBytes(StandardCharsets.UTF_8));
            activationFile.finishWrite(output);
        } catch (IOException | JSONException error) {
            if (output != null) activationFile.failWrite(output);
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("RUNTIME_ACTIVATION_ENCODING_FAILED", error);
        }
    }

    private static String requireReleaseId(String releaseId) {
        if (releaseId == null || !releaseId.matches("[A-Za-z0-9._-]{1,96}")) {
            throw new IllegalArgumentException("RUNTIME_RELEASE_ID_INVALID");
        }
        return releaseId;
    }
}
