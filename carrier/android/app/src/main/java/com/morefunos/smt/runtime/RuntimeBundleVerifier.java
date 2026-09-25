package com.morefunos.smt.runtime;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.cert.Certificate;
import java.security.cert.CertificateEncodingException;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.jar.Attributes;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.jar.Manifest;

public final class RuntimeBundleVerifier {
    private static final String ATTR_RELEASE_ID = "MoreFun-Release-Id";
    private static final String ATTR_RUNTIME_VERSION = "MoreFun-Runtime-Version";
    private static final String ATTR_CHANNEL = "MoreFun-Channel";
    private static final String ATTR_MIN_CARRIER = "MoreFun-Min-Carrier-Version-Code";
    private static final String ATTR_BRIDGE_VERSION = "MoreFun-Bridge-Version";
    private static final int MAX_PAYLOAD_ENTRIES = 4096;
    private static final long MAX_ENTRY_BYTES = 32L * 1024L * 1024L;
    private static final long MAX_EXTRACTED_BYTES = 128L * 1024L * 1024L;

    public static final class VerifiedRuntimeBundle {
        public final RuntimeBundleMetadata metadata;
        public final File extractedDirectory;

        VerifiedRuntimeBundle(RuntimeBundleMetadata metadata, File extractedDirectory) {
            this.metadata = metadata;
            this.extractedDirectory = extractedDirectory;
        }
    }

    private final Context context;
    private final int carrierVersionCode;
    private final int bridgeVersion;

    public RuntimeBundleVerifier(Context context, int carrierVersionCode, int bridgeVersion) {
        this.context = context.getApplicationContext();
        this.carrierVersionCode = carrierVersionCode;
        this.bridgeVersion = bridgeVersion;
    }

    public VerifiedRuntimeBundle verifyAndExtract(File bundle, String expectedArchiveSha256, File stagingDirectory) throws IOException {
        if (bundle == null || !bundle.isFile()) throw new IOException("RUNTIME_BUNDLE_FILE_REQUIRED");
        final String archiveSha256 = sha256(bundle);
        if (expectedArchiveSha256 != null && !expectedArchiveSha256.trim().isEmpty()) {
            final String normalized = expectedArchiveSha256.trim().toLowerCase(Locale.US);
            if (!normalized.matches("[0-9a-f]{64}")) throw new IOException("RUNTIME_EXPECTED_HASH_INVALID");
            if (!normalized.equals(archiveSha256)) throw new IOException("RUNTIME_PACKAGE_HASH_MISMATCH");
        }

        final String trustedSigner = installedAppSignerSha256();
        deleteRecursively(stagingDirectory);
        if (!stagingDirectory.mkdirs()) throw new IOException("RUNTIME_STAGING_DIRECTORY_UNAVAILABLE");

        boolean entrypointFound = false;
        int payloadEntries = 0;
        long extractedBytes = 0;
        final Set<String> seenPaths = new HashSet<>();
        try (JarFile jar = new JarFile(bundle, true)) {
            final Manifest manifest = jar.getManifest();
            if (manifest == null) throw new IOException("RUNTIME_JAR_MANIFEST_REQUIRED");
            final RuntimeBundleMetadata metadata = metadataFromManifest(manifest, archiveSha256);
            assertCompatibility(metadata);

            final Enumeration<JarEntry> entries = jar.entries();
            while (entries.hasMoreElements()) {
                final JarEntry entry = entries.nextElement();
                if (entry.isDirectory()) continue;
                final String path = entry.getName();
                if (path.startsWith("META-INF/")) continue;
                payloadEntries += 1;
                if (payloadEntries > MAX_PAYLOAD_ENTRIES) throw new IOException("RUNTIME_PACKAGE_ENTRIES_LIMIT_EXCEEDED");
                if (entry.getSize() > MAX_ENTRY_BYTES) throw new IOException("RUNTIME_PACKAGE_ENTRY_TOO_LARGE");
                assertSafePath(path);
                if (!seenPaths.add(path)) throw new IOException("RUNTIME_PACKAGE_ENTRY_DUPLICATE");

                final File output = new File(stagingDirectory, path);
                final String root = stagingDirectory.getCanonicalPath() + File.separator;
                if (!output.getCanonicalPath().startsWith(root)) throw new IOException("RUNTIME_PACKAGE_PATH_INVALID");
                final File parent = output.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("RUNTIME_PACKAGE_DIRECTORY_UNAVAILABLE");

                long entryBytes = 0;
                try (
                    BufferedInputStream input = new BufferedInputStream(jar.getInputStream(entry));
                    BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(output))
                ) {
                    final byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        entryBytes += count;
                        extractedBytes += count;
                        if (entryBytes > MAX_ENTRY_BYTES) throw new IOException("RUNTIME_PACKAGE_ENTRY_TOO_LARGE");
                        if (extractedBytes > MAX_EXTRACTED_BYTES) throw new IOException("RUNTIME_PACKAGE_EXTRACTED_TOO_LARGE");
                        out.write(buffer, 0, count);
                    }
                } catch (SecurityException error) {
                    throw new IOException("RUNTIME_BUNDLE_SIGNATURE_INVALID", error);
                }

                assertEntrySignedByTrustedSigner(entry, trustedSigner);
                if ("index.html".equals(path)) entrypointFound = true;
            }

            if (!entrypointFound) throw new IOException("RUNTIME_PACKAGE_ENTRYPOINT_MISSING");
            return new VerifiedRuntimeBundle(metadata, stagingDirectory);
        } catch (IOException | RuntimeException error) {
            deleteRecursively(stagingDirectory);
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("RUNTIME_BUNDLE_VERIFICATION_FAILED", error);
        }
    }

    private RuntimeBundleMetadata metadataFromManifest(Manifest manifest, String archiveSha256) throws IOException {
        final Attributes attrs = manifest.getMainAttributes();
        final String releaseId = requireText(attrs.getValue(ATTR_RELEASE_ID), "RUNTIME_RELEASE_ID_REQUIRED");
        if (!releaseId.matches("[A-Za-z0-9._-]{1,96}")) throw new IOException("RUNTIME_RELEASE_ID_INVALID");
        final String runtimeVersion = requireText(attrs.getValue(ATTR_RUNTIME_VERSION), "RUNTIME_VERSION_REQUIRED");
        final String channel = requireText(attrs.getValue(ATTR_CHANNEL), "RUNTIME_CHANNEL_REQUIRED");
        if (!channel.equals("stable") && !channel.equals("candidate") && !channel.equals("dev")) throw new IOException("RUNTIME_CHANNEL_INVALID");
        final int minCarrier = parsePositiveInt(attrs.getValue(ATTR_MIN_CARRIER), "RUNTIME_MIN_CARRIER_INVALID");
        final int requiredBridge = parsePositiveInt(attrs.getValue(ATTR_BRIDGE_VERSION), "RUNTIME_BRIDGE_VERSION_INVALID");
        return new RuntimeBundleMetadata(releaseId, runtimeVersion, channel, minCarrier, requiredBridge, archiveSha256);
    }

    private void assertCompatibility(RuntimeBundleMetadata metadata) throws IOException {
        if (carrierVersionCode < metadata.minCarrierVersionCode) throw new IOException("RUNTIME_CARRIER_INCOMPATIBLE");
        if (bridgeVersion != metadata.bridgeVersion) throw new IOException("RUNTIME_BRIDGE_INCOMPATIBLE");
    }

    private void assertEntrySignedByTrustedSigner(JarEntry entry, String trustedSigner) throws IOException {
        final Certificate[] certificates = entry.getCertificates();
        if (certificates == null || certificates.length == 0) throw new IOException("RUNTIME_BUNDLE_ENTRY_UNSIGNED");
        for (Certificate certificate : certificates) {
            try {
                if (trustedSigner.equals(sha256(certificate.getEncoded()))) return;
            } catch (CertificateEncodingException error) {
                throw new IOException("RUNTIME_BUNDLE_CERTIFICATE_INVALID", error);
            }
        }
        throw new IOException("RUNTIME_BUNDLE_SIGNER_MISMATCH");
    }

    @SuppressWarnings("deprecation")
    private String installedAppSignerSha256() throws IOException {
        try {
            final PackageManager packageManager = context.getPackageManager();
            final PackageInfo packageInfo;
            final Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo = packageManager.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                if (packageInfo.signingInfo == null) throw new IOException("APP_SIGNING_INFO_UNAVAILABLE");
                signatures = packageInfo.signingInfo.hasMultipleSigners()
                    ? packageInfo.signingInfo.getApkContentsSigners()
                    : packageInfo.signingInfo.getSigningCertificateHistory();
            } else {
                packageInfo = packageManager.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
                signatures = packageInfo.signatures;
            }
            if (signatures == null || signatures.length == 0) throw new IOException("APP_SIGNER_UNAVAILABLE");
            return sha256(signatures[0].toByteArray());
        } catch (PackageManager.NameNotFoundException error) {
            throw new IOException("APP_PACKAGE_IDENTITY_UNAVAILABLE", error);
        }
    }

    private static void assertSafePath(String path) throws IOException {
        if (path == null || path.isEmpty() || path.startsWith("/") || path.contains("\\")) throw new IOException("RUNTIME_PACKAGE_PATH_INVALID");
        final String[] segments = path.split("/", -1);
        for (String segment : segments) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) throw new IOException("RUNTIME_PACKAGE_PATH_INVALID");
        }
    }

    private static String requireText(String value, String code) throws IOException {
        if (value == null || value.trim().isEmpty()) throw new IOException(code);
        return value.trim();
    }

    private static int parsePositiveInt(String value, String code) throws IOException {
        try {
            final int parsed = Integer.parseInt(requireText(value, code));
            if (parsed <= 0) throw new IOException(code);
            return parsed;
        } catch (NumberFormatException error) {
            throw new IOException(code, error);
        }
    }

    private static String sha256(File file) throws IOException {
        try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(file))) {
            final MessageDigest digest = MessageDigest.getInstance("SHA-256");
            final byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            return hex(digest.digest());
        } catch (NoSuchAlgorithmException error) {
            throw new IOException("SHA256_UNAVAILABLE", error);
        }
    }

    private static String sha256(byte[] bytes) throws IOException {
        try {
            return hex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IOException("SHA256_UNAVAILABLE", error);
        }
    }

    private static String hex(byte[] bytes) {
        final StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value & 0xff));
        return builder.toString();
    }

    static void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            final File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        if (!file.delete() && file.exists()) file.deleteOnExit();
    }
}
