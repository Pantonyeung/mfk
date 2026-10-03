package com.morefunos.smt.runtime;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.robolectric.Shadows.shadowOf;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Locale;

/** Real signed-JAR verification and Android AtomicFile using only the public test signer fixture. */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 27)
public final class RuntimeInstallReliabilityTest {
    private Context context;
    private RuntimeInstaller installer;
    private RuntimeReleaseStore store;

    @Before
    @SuppressWarnings("deprecation")
    public void setUp() throws Exception {
        context = RuntimeEnvironment.getApplication();
        RuntimeBundleVerifier.deleteRecursively(new File(context.getFilesDir(), "runtime"));
        final PackageInfo info = new PackageInfo();
        info.packageName = context.getPackageName();
        info.signatures = new Signature[]{new Signature(resource("test-signer.cer"))};
        shadowOf(context.getPackageManager()).installPackage(info);
        installer = new RuntimeInstaller(context, 100, 1);
        store = new RuntimeReleaseStore(context);
    }

    @After
    public void tearDown() {
        RuntimeBundleVerifier.deleteRecursively(new File(context.getFilesDir(), "runtime"));
    }

    @Test
    public void verifiedCandidateActivatesAndConfirmsNormally() throws Exception {
        stage("valid");
        assertEquals("release1", store.snapshot().candidateReleaseId);
        store.requestCandidateActivation();
        assertTrue(store.prepareBoot().candidateBoot);
        store.confirmRuntimeReady("release1");
        assertEquals("release1", store.snapshot().currentReleaseId);
        assertNull(store.snapshot().candidateReleaseId);
    }

    @Test
    public void existingReleaseRejectsNewMetadataAndPreservesActiveBytes() throws Exception {
        stage("valid");
        store.requestCandidateActivation();
        store.prepareBoot();
        store.confirmRuntimeReady("release1");
        reject("collision", "RUNTIME_RELEASE_ALREADY_EXISTS");
        reject("metadata-only", "RUNTIME_RELEASE_ALREADY_EXISTS");
        reject("repacked", "RUNTIME_RELEASE_ALREADY_EXISTS");
        assertEquals("release1", store.snapshot().currentReleaseId);
        assertNull(store.snapshot().candidateReleaseId);
        assertEquals(
            "GOOD",
            new String(
                Files.readAllBytes(new File(store.releaseDirectory("release1"), "index.html").toPath()),
                StandardCharsets.UTF_8
            )
        );
    }

    @Test
    public void manifestMismatchCannotReplaceExistingCandidateOrPruneItsBytes() throws Exception {
        stage("valid");
        store.requestCandidateActivation();
        store.prepareBoot();
        store.confirmRuntimeReady("release1");
        stage("candidate");
        final File bundle = fixture("mismatch");
        final String digest = hash(bundle);
        try {
            installer.stageSignedBundle(
                bundle,
                digest,
                new RuntimeBundleMetadata("expected", "v3", "stable", 1, 1, digest)
            );
            fail("Manifest mismatch accepted");
        } catch (IOException error) {
            assertEquals("RUNTIME_UPDATE_MANIFEST_BUNDLE_MISMATCH", error.getMessage());
        }
        assertEquals("release1", store.snapshot().currentReleaseId);
        assertEquals("candidate", store.snapshot().candidateReleaseId);
        assertTrue(new File(store.releaseDirectory("candidate"), "index.html").isFile());
        assertFalse(store.releaseDirectory("unexpected").exists());
        assertFalse(new File(context.getFilesDir(), "runtime/staging/incoming").exists());
    }

    @Test
    public void identicalRetryPreservesCandidateActivationBootingAndActiveState() throws Exception {
        for (String phase : new String[]{"candidate", "activation-requested", "booting", "current"}) {
            store.resetToPackagedBaseline();
            stage("valid");
            if (!"candidate".equals(phase)) store.requestCandidateActivation();
            if ("booting".equals(phase) || "current".equals(phase)) store.prepareBoot();
            if ("current".equals(phase)) store.confirmRuntimeReady("release1");
            final RuntimeActivationState before = store.snapshot();
            stage("valid");
            final RuntimeActivationState after = store.snapshot();
            assertEquals(before.currentReleaseId, after.currentReleaseId);
            assertEquals(before.previousReleaseId, after.previousReleaseId);
            assertEquals(before.candidateReleaseId, after.candidateReleaseId);
            assertEquals(before.bootingReleaseId, after.bootingReleaseId);
            assertEquals(before.activationRequested, after.activationRequested);
        }
    }

    @Test
    public void retryRecoversPromotedTreeWithoutActivationRecord() throws Exception {
        stage("valid");
        Files.delete(new File(context.getFilesDir(), "runtime/activation.json").toPath());
        assertNull(store.snapshot().candidateReleaseId);
        stage("valid");
        assertEquals("release1", store.snapshot().candidateReleaseId);
    }

    @Test
    public void retryRejectsChangedStoredBytesAndLegacyUnverifiableDirectory() throws Exception {
        stage("valid");
        Files.write(
            new File(store.releaseDirectory("release1"), "index.html").toPath(),
            "CHANGED".getBytes(StandardCharsets.UTF_8)
        );
        reject("valid", "RUNTIME_RELEASE_ALREADY_EXISTS");
        store.resetToPackagedBaseline();
        final File legacy = store.releaseDirectory("release1");
        assertTrue(legacy.mkdirs());
        Files.write(new File(legacy, "index.html").toPath(), "GOOD".getBytes(StandardCharsets.UTF_8));
        reject("valid", "RUNTIME_RELEASE_ALREADY_EXISTS");
        assertNull(store.snapshot().candidateReleaseId);
    }

    @Test
    public void packageAuthenticationAndCompatibilityGuardsRemainClosed() throws Exception {
        reject("unsigned", "RUNTIME_BUNDLE_ENTRY_UNSIGNED");
        reject("other-signer", "RUNTIME_BUNDLE_SIGNER_MISMATCH");
        reject("tampered", "RUNTIME_BUNDLE_SIGNATURE_INVALID");
        reject("carrier", "RUNTIME_CARRIER_INCOMPATIBLE");
        reject("bridge", "RUNTIME_BRIDGE_INCOMPATIBLE");
        reject("dot", "RUNTIME_RELEASE_ID_INVALID");
        final File bundle = fixture("valid");
        try {
            installer.stageSignedBundle(bundle, "0".repeat(64));
            fail("Wrong hash accepted");
        } catch (IOException error) {
            assertEquals("RUNTIME_PACKAGE_HASH_MISMATCH", error.getMessage());
        }
        assertNull(store.snapshot().candidateReleaseId);
    }

    @Test
    public void releasePathsRejectDotTraversalAndEscapingSymlink() throws Exception {
        for (String id : new String[]{".", "..", "../outside", "x/y", "x\\y", "/absolute"}) {
            try {
                store.releaseDirectory(id);
                fail("Unsafe release ID accepted: " + id);
            } catch (IllegalArgumentException error) {
                assertEquals("RUNTIME_RELEASE_ID_INVALID", error.getMessage());
            }
        }
        final File releases = new File(context.getFilesDir(), "runtime/releases");
        assertTrue(releases.mkdirs());
        final File outside = Files.createTempDirectory("release-symlink-test-").toFile();
        final File link = new File(releases, "release-link");
        try {
            Files.createSymbolicLink(link.toPath(), outside.toPath());
            try {
                store.releaseDirectory("release-link");
                fail("Escaping symlink accepted");
            } catch (IllegalArgumentException error) {
                assertEquals("RUNTIME_RELEASE_ID_INVALID", error.getMessage());
            }
        } finally {
            Files.deleteIfExists(link.toPath());
            Files.deleteIfExists(outside.toPath());
        }
    }

    private void stage(String name) throws Exception {
        final File file = fixture(name);
        installer.stageSignedBundle(file, hash(file));
    }

    private void reject(String name, String code) throws Exception {
        try {
            stage(name);
            fail("Expected " + code);
        } catch (IOException error) {
            assertEquals(code, error.getMessage());
        }
    }

    private File fixture(String name) throws Exception {
        final File file = new File(context.getCacheDir(), name + ".mfos");
        Files.write(file.toPath(), resource(name + ".mfos"));
        return file;
    }

    private byte[] resource(String name) throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/native-runtime/" + name)) {
            assertNotNull("Missing signed fixture " + name, input);
            return input.readAllBytes();
        }
    }

    private String hash(File file) throws Exception {
        final StringBuilder hex = new StringBuilder();
        final byte[] digest = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file.toPath()));
        for (byte value : digest) hex.append(String.format(Locale.US, "%02x", value & 255));
        return hex.toString();
    }
}
