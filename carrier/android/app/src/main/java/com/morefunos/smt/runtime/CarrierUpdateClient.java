package com.morefunos.smt.runtime;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.morefunos.smt.BuildConfig;
import com.morefunos.smt.diagnostics.CarrierInstallResultReceiver;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;

public final class CarrierUpdateClient {
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 20_000;
    private static final int MAX_MANIFEST_BYTES = 64 * 1024;
    private static final long MAX_APK_BYTES = 256L * 1024L * 1024L;

    public static final class Descriptor {
        public final int versionCode;
        public final String versionName;
        public final String packageName;
        public final URI apkUri;
        public final String apkSha256;

        Descriptor(int versionCode, String versionName, String packageName, URI apkUri, String apkSha256) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.packageName = packageName;
            this.apkUri = apkUri;
            this.apkSha256 = apkSha256;
        }

        public JSONObject toJson() throws JSONException {
            return new JSONObject()
                .put("versionCode", versionCode)
                .put("versionName", versionName)
                .put("packageName", packageName)
                .put("apkSha256", apkSha256);
        }
    }

    private final Context context;
    private final RuntimeUpdateEndpointStore endpointStore;

    public CarrierUpdateClient(Context context) {
        this.context = context.getApplicationContext();
        this.endpointStore = new RuntimeUpdateEndpointStore(context);
    }

    public Descriptor checkForUpdate() throws IOException {
        final URI manifestUri = carrierManifestUri(endpointStore.effectiveEndpoint());
        final JSONObject json = fetchJson(manifestUri.toURL());
        final int versionCode = json.optInt("versionCode", -1);
        if (versionCode <= 0) throw new IOException("CARRIER_VERSION_CODE_REQUIRED");
        final String versionName = requireText(json.optString("versionName", null), "CARRIER_VERSION_NAME_REQUIRED");
        final String packageName = requireText(json.optString("packageName", null), "CARRIER_PACKAGE_NAME_REQUIRED");
        if (!context.getPackageName().equals(packageName)) throw new IOException("CARRIER_PACKAGE_IDENTITY_MISMATCH");
        final String apkUrl = requireText(json.optString("apkUrl", null), "CARRIER_APK_URL_REQUIRED");
        final String apkSha256 = requireSha256(json.optString("apkSha256", null));
        final URI apkUri;
        try { apkUri = manifestUri.resolve(apkUrl); }
        catch (IllegalArgumentException error) { throw new IOException("CARRIER_APK_URL_INVALID", error); }
        assertHttps(apkUri, "CARRIER_APK_URL_INVALID");
        if (!RuntimeUpdateClient.sameOrigin(manifestUri, apkUri)) throw new IOException("CARRIER_APK_ORIGIN_REJECTED");
        return new Descriptor(versionCode, versionName, packageName, apkUri, apkSha256);
    }

    public File downloadAndVerify(Descriptor descriptor) throws IOException {
        if (descriptor == null) throw new IOException("CARRIER_UPDATE_DESCRIPTOR_REQUIRED");
        final File apk = new File(context.getCacheDir(), "morefun-carrier-update.apk");
        download(descriptor.apkUri.toURL(), apk);
        if (!descriptor.apkSha256.equals(sha256(apk))) {
            apk.delete();
            throw new IOException("CARRIER_APK_SHA256_MISMATCH");
        }
        verifyPackageAndSignature(apk, descriptor);
        return apk;
    }

    public void requestInstall(File apk) throws IOException {
        if (apk == null || !apk.isFile()) throw new IOException("CARRIER_APK_FILE_REQUIRED");
        if (Build.VERSION.SDK_INT >= 26 && !context.getPackageManager().canRequestPackageInstalls()) {
            throw new IOException("CARRIER_INSTALL_PERMISSION_REQUIRED");
        }
        final PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        final PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName());
        params.setSize(apk.length());
        final int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (FileInputStream input = new FileInputStream(apk);
                 OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
                final byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                session.fsync(output);
            }
            final Intent result = new Intent(context, CarrierInstallResultReceiver.class)
                .setAction(CarrierInstallResultReceiver.ACTION_INSTALL_RESULT)
                .putExtra("sessionId", sessionId);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            final PendingIntent pending = PendingIntent.getBroadcast(context, sessionId, result, flags);
            session.commit(pending.getIntentSender());
        } catch (IOException | RuntimeException error) {
            installer.abandonSession(sessionId);
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("CARRIER_PACKAGE_INSTALL_REQUEST_FAILED", error);
        }
    }

    public Intent unknownSourceSettingsIntent() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + context.getPackageName()));
        }
        return new Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS);
    }

    private void verifyPackageAndSignature(File apk, Descriptor descriptor) throws IOException {
        final PackageManager pm = context.getPackageManager();
        final PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        if (archive == null) throw new IOException("CARRIER_APK_PACKAGE_UNREADABLE");
        if (!descriptor.packageName.equals(archive.packageName)) throw new IOException("CARRIER_APK_PACKAGE_MISMATCH");
        if (archive.versionCode != descriptor.versionCode) throw new IOException("CARRIER_APK_VERSION_MISMATCH");
        if (archive.signatures == null || archive.signatures.length == 0) throw new IOException("CARRIER_APK_SIGNATURE_MISSING");
        try {
            final PackageInfo installed = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
            if (installed.signatures == null || installed.signatures.length == 0) throw new IOException("CARRIER_INSTALLED_SIGNATURE_MISSING");
            final byte[][] left = signatureBytes(installed);
            final byte[][] right = signatureBytes(archive);
            sort(left);
            sort(right);
            if (!Arrays.deepEquals(left, right)) throw new IOException("CARRIER_APK_SIGNATURE_MISMATCH");
        } catch (PackageManager.NameNotFoundException error) {
            throw new IOException("CARRIER_INSTALLED_PACKAGE_NOT_FOUND", error);
        }
    }

    private static byte[][] signatureBytes(PackageInfo info) {
        final byte[][] out = new byte[info.signatures.length][];
        for (int i = 0; i < info.signatures.length; i++) out[i] = info.signatures[i].toByteArray();
        return out;
    }

    private static void sort(byte[][] values) {
        Arrays.sort(values, (a, b) -> {
            final int limit = Math.min(a.length, b.length);
            for (int i = 0; i < limit; i++) {
                final int av = a[i] & 0xff;
                final int bv = b[i] & 0xff;
                if (av != bv) return Integer.compare(av, bv);
            }
            return Integer.compare(a.length, b.length);
        });
    }

    private static URI carrierManifestUri(String runtimeEndpoint) throws IOException {
        try {
            final URI runtime = new URI(runtimeEndpoint);
            assertHttps(runtime, "CARRIER_UPDATE_ENDPOINT_INVALID");
            return runtime.resolve("carrier-update.json");
        } catch (URISyntaxException error) {
            throw new IOException("CARRIER_UPDATE_ENDPOINT_INVALID", error);
        }
    }

    private static JSONObject fetchJson(URL url) throws IOException {
        final HttpURLConnection connection = open(url);
        try {
            final int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException("CARRIER_UPDATE_MANIFEST_HTTP_" + status);
            final long length = connection.getContentLengthLong();
            if (length > MAX_MANIFEST_BYTES) throw new IOException("CARRIER_UPDATE_MANIFEST_TOO_LARGE");
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                final byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > MAX_MANIFEST_BYTES) throw new IOException("CARRIER_UPDATE_MANIFEST_TOO_LARGE");
                    bytes.write(buffer, 0, count);
                }
                try { return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())); }
                catch (JSONException error) { throw new IOException("CARRIER_UPDATE_MANIFEST_INVALID", error); }
            }
        } finally { connection.disconnect(); }
    }

    private static void download(URL url, File target) throws IOException {
        final HttpURLConnection connection = open(url);
        try {
            final int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException("CARRIER_APK_HTTP_" + status);
            final long length = connection.getContentLengthLong();
            if (length > MAX_APK_BYTES) throw new IOException("CARRIER_APK_TOO_LARGE");
            long written = 0;
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(target, false)) {
                final byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    written += count;
                    if (written > MAX_APK_BYTES) throw new IOException("CARRIER_APK_TOO_LARGE");
                    output.write(buffer, 0, count);
                }
                output.getFD().sync();
            } catch (IOException error) {
                target.delete();
                throw error;
            }
        } finally { connection.disconnect(); }
    }

    private static HttpURLConnection open(URL url) throws IOException {
        final HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod("GET");
        return connection;
    }

    private static String sha256(File file) throws IOException {
        try {
            final MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(file)) {
                final byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            }
            final StringBuilder out = new StringBuilder(64);
            for (byte b : digest.digest()) out.append(String.format(Locale.US, "%02x", b & 0xff));
            return out.toString();
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IOException("CARRIER_SHA256_UNAVAILABLE", error);
        }
    }

    private static void assertHttps(URI uri, String code) throws IOException {
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getHost().trim().isEmpty()) throw new IOException(code);
    }

    private static String requireSha256(String value) throws IOException {
        final String accepted = requireText(value, "CARRIER_APK_SHA256_REQUIRED").toLowerCase(Locale.US);
        if (!accepted.matches("[0-9a-f]{64}")) throw new IOException("CARRIER_APK_SHA256_INVALID");
        return accepted;
    }

    private static String requireText(String value, String code) throws IOException {
        if (value == null || value.trim().isEmpty()) throw new IOException(code);
        return value.trim();
    }
}
