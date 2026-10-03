package com.morefunos.smt.runtime;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowPackageManager;

import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 24)
public final class RuntimeNativeReliabilityTest {
    private static final String VALID_SHA256 =
        "195ed7bc955c0fd3c72ac6855b821794d197e4473161bf9f11da52f60201a15e";
    private static final String TEST_CERTIFICATE =
        "MIIDZzCCAk+gAwIBAgIIXvuIgNTrJnIwDQYJKoZIhvcNAQEMBQAwYTELMAkGA1UEBhMCSEsxEjAQBgNVBAcTCUhvbmcgS29uZzEQMA4GA1UEChMHTW9yZUZ1bjENMAsGA1UECxMEVGVzdDEdMBsGA1UEAxMUTW9yZUZ1biBSdW50aW1lIFRlc3QwIBcNMjYxMDAzMDQwMzAyWhgPMjEyNjA5MDkwNDAzMDJaMGExCzAJBgNVBAYTAkhLMRIwEAYDVQQHEwlIb25nIEtvbmcxEDAOBgNVBAoTB01vcmVGdW4xDTALBgNVBAsTBFRlc3QxHTAbBgNVBAMTFE1vcmVGdW4gUnVudGltZSBUZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs0VNykAxdAMWge6aBizqDmp14p83PomndfPJtPg7FF4i38Dm7/uipw3hPf0hlOqkK8g0xL/HoWkGwAcwudO5T2xC1OpGdJqrCm/s6H4HnghdXszoGnPD5wnHd2XW8AKnKAz6bmaoDRR+vR71icJ0qTi5r/XLNh3nEuReC/Gfcnqly55L8QZB9n7eMTSL2jGkpkguPztZb7WyxcVhXqKUGjsS7SJ9BPuqXd13Rz8nMjwcRL50w2aGXrDIJvVlUbEyzJY8DC7FgZbK+WPxcNRzV8YzVrncZjdyy0Zjhnz2QEEleZlx7iTPhSSpvbOwyg+x4g6PPz+Mlmx/ugp+ym/wYwIDAQABoyEwHzAdBgNVHQ4EFgQUnyKoRHlgZxlL3wC69Q6n4eeMMXYwDQYJKoZIhvcNAQEMBQADggEBAD4kOnmjRBhBuVXO0ifN6bcLfbdiF2I51stU2MRuMGnpi0uIiZ0RVYy3CHjJv7SziuIj4Yp9If7F+uEoZs6Fu0SuAUYVLouFiGfuC7eHYDm0Ym+rgq1tQkFRLDxAjUICaNCpZ0VWiFpd15OOfj1F7sLcW118qESfzVqTCwnG10CO7QtcBEhzBk5+W6udgzc6O/nEGD9nCIK5WQ7bMu6e7Br2rciZcQO412jmmpGRIa3GcE/ir7X67VaTFlDSaw0qz5rj7W/OReBnk52COgQoFK6aBSKLhaSQutuk9antqvGhFZaRKlZ6R/9huekKa+y433Y3uT/Eb8YyXE8EjyMRQ0c=";
    private static final String VALID_BUNDLE =
        "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";

    private Context context;
    private File runtimeRoot;
    private File bundle;

    @Before
    public void setUp() throws Exception {
        context = RuntimeEnvironment.getApplication();
        runtimeRoot = new File(context.getFilesDir(), "runtime");
        RuntimeBundleVerifier.deleteRecursively(runtimeRoot);
        assertTrue(runtimeRoot.mkdirs());
        bundle = new File(context.getCacheDir(), "valid-runtime.mfos");
        writeBytes(bundle, Base64.getDecoder().decode(VALID_BUNDLE));
        assertEquals(VALID_SHA256, sha256(bundle));

        final ShadowPackageManager packages = Shadows.shadowOf(context.getPackageManager());
        final PackageInfo packageInfo = packages.getInternalMutablePackageInfo(context.getPackageName());
        assertNotNull(packageInfo);
        packageInfo.signatures = new Signature[]{
            new Signature(Base64.getDecoder().decode(TEST_CERTIFICATE))
        };
    }

    @After
    public void tearDown() {
        RuntimeBundleVerifier.deleteRecursively(runtimeRoot);
        if (bundle != null && bundle.exists()) assertTrue(bundle.delete());
    }

    @Test
    public void manifestMismatchIsRejectedBeforeReleaseOrStatePersistence() throws Exception {
        final RuntimeInstaller installer = installer();
        final RuntimeBundleMetadata expected = new RuntimeBundleMetadata(
            "different-release", "1.0.0", "stable", 1, 1, VALID_SHA256
        );
        final Method checkedStage = RuntimeInstaller.class.getMethod(
            "stageSignedBundle", File.class, String.class, RuntimeBundleMetadata.class
        );

        try {
            checkedStage.invoke(installer, bundle, VALID_SHA256, expected);
            fail("expected manifest/bundle mismatch");
        } catch (InvocationTargetException error) {
            assertIOExceptionCode(error.getCause(), "RUNTIME_UPDATE_MANIFEST_BUNDLE_MISMATCH");
        }

        assertFalse(new File(runtimeRoot, "releases/release-valid").exists());
        assertNull(new RuntimeReleaseStore(context).snapshot().candidateReleaseId);
    }

    @Test
    public void conflictingBytesForSameReleaseIdAreRejected() throws Exception {
        final RuntimeInstaller installer = installer();
        installer.stageSignedBundle(bundle, VALID_SHA256);
        final File installedIndex = new File(runtimeRoot, "releases/release-valid/index.html");
        writeBytes(installedIndex, "tampered".getBytes(StandardCharsets.UTF_8));

        try {
            installer.stageSignedBundle(bundle, VALID_SHA256);
            fail("expected release content conflict");
        } catch (IOException error) {
            assertEquals("RUNTIME_RELEASE_ALREADY_EXISTS", error.getMessage());
        }

        assertEquals("tampered", new String(Files.readAllBytes(installedIndex.toPath()), StandardCharsets.UTF_8));
        assertEquals("release-valid", new RuntimeReleaseStore(context).snapshot().candidateReleaseId);
    }

    @Test
    public void identicalVerifiedRetryPreservesActivationStateAndReceipt() throws Exception {
        final RuntimeInstaller installer = installer();
        installer.stageSignedBundle(bundle, VALID_SHA256);
        final File receipt = new File(runtimeRoot,
            "releases/release-valid/META-INF/morefun-runtime-verification");
        assertTrue(receipt.isFile());
        try (DataInputStream input = new DataInputStream(new FileInputStream(receipt))) {
            assertEquals("MORE_FUN_VERIFIED_RUNTIME_V1", input.readUTF());
            assertEquals("release-valid", input.readUTF());
            assertEquals("1.0.0", input.readUTF());
            assertEquals("stable", input.readUTF());
            assertEquals(1, input.readInt());
            assertEquals(1, input.readInt());
            assertEquals(VALID_SHA256, input.readUTF());
            assertEquals(-1, input.read());
        }

        final RuntimeReleaseStore store = new RuntimeReleaseStore(context);
        store.requestCandidateActivation();
        assertTrue(store.snapshot().activationRequested);

        installer.stageSignedBundle(bundle, VALID_SHA256);

        final RuntimeActivationState afterRetry = store.snapshot();
        assertEquals("release-valid", afterRetry.candidateReleaseId);
        assertTrue(afterRetry.activationRequested);
        assertTrue(receipt.isFile());
    }

    @Test
    public void existingReleaseSymlinkIsRejectedEvenWhenBytesMatch() throws Exception {
        final RuntimeInstaller installer = installer();
        installer.stageSignedBundle(bundle, VALID_SHA256);
        final File installedIndex = new File(runtimeRoot, "releases/release-valid/index.html");
        final byte[] original = Files.readAllBytes(installedIndex.toPath());
        assertTrue(installedIndex.delete());
        final File outside = new File(context.getCacheDir(), "runtime-index-outside.html");
        writeBytes(outside, original);
        Files.createSymbolicLink(installedIndex.toPath(), outside.toPath());
        try {
            installer.stageSignedBundle(bundle, VALID_SHA256);
            fail("expected symlink conflict");
        } catch (IOException error) {
            assertEquals("RUNTIME_RELEASE_ALREADY_EXISTS", error.getMessage());
        } finally {
            Files.deleteIfExists(installedIndex.toPath());
            assertTrue(outside.delete());
        }
    }

    @Test
    public void traversalReleaseIdsAreRejected() {
        final RuntimeReleaseStore store = new RuntimeReleaseStore(context);
        for (String releaseId : new String[]{".", ".."}) {
            try {
                store.releaseDirectory(releaseId);
                fail("expected rejection for " + releaseId);
            } catch (IllegalArgumentException error) {
                assertEquals("RUNTIME_RELEASE_ID_INVALID", error.getMessage());
            }
        }
    }

    @Test
    public void separateStoreInstancesShareAtomicFileLockAndRetainCurrentCandidate() throws Exception {
        final RuntimeReleaseStore first = new RuntimeReleaseStore(context);
        final RuntimeReleaseStore second = new RuntimeReleaseStore(context);
        final Field lock = RuntimeReleaseStore.class.getDeclaredField("stateLock");
        lock.setAccessible(true);
        assertSame(lock.get(first), lock.get(second));

        createRelease("release-current");
        first.stageCandidate("release-current");
        second.requestCandidateActivation();
        assertEquals("release-current", first.prepareBoot().releaseId);
        second.confirmRuntimeReady("release-current");
        createRelease("release-candidate");

        final ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            final Callable<Void> stage = () -> {
                for (int index = 0; index < 100; index += 1) first.stageCandidate("release-candidate");
                return null;
            };
            final Callable<Void> read = () -> {
                for (int index = 0; index < 100; index += 1) second.snapshot();
                return null;
            };
            final Future<Void> staged = executor.submit(stage);
            final Future<Void> readBack = executor.submit(read);
            staged.get();
            readBack.get();
        } finally {
            executor.shutdownNow();
        }

        final RuntimeActivationState state = second.snapshot();
        assertEquals("release-current", state.currentReleaseId);
        assertEquals("release-candidate", state.candidateReleaseId);
        assertTrue(new File(runtimeRoot, "releases/release-current/index.html").isFile());
        assertTrue(new File(runtimeRoot, "releases/release-candidate/index.html").isFile());
        assertFalse(new File(runtimeRoot, "activation.json.bak").exists());
    }

    private RuntimeInstaller installer() {
        return new RuntimeInstaller(context, 107, 1);
    }

    private void createRelease(String releaseId) throws Exception {
        final File index = new File(runtimeRoot, "releases/" + releaseId + "/index.html");
        writeBytes(index, releaseId.getBytes(StandardCharsets.UTF_8));
    }

    private static void assertIOExceptionCode(Throwable error, String code) {
        assertTrue(error instanceof IOException);
        assertEquals(code, error.getMessage());
    }

    private static String sha256(File file) throws Exception {
        final MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            final byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        final StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }

    private static void writeBytes(File file, byte[] bytes) throws Exception {
        final File parent = file.getParentFile();
        if (parent != null && !parent.exists()) assertTrue(parent.mkdirs());
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(bytes);
            output.getFD().sync();
        }
    }
}
