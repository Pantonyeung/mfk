package com.morefunos.smt.runtime;

import android.content.Context;

import com.morefunos.smt.BuildConfig;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class RuntimeUpdateClient {
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 20_000;
    private static final int MAX_MANIFEST_BYTES = 64 * 1024;
    private static final long MAX_BUNDLE_BYTES = 64L * 1024L * 1024L;
    private static final int BRIDGE_VERSION = 1;

    public static final class UpdateDescriptor {
        public final String releaseId;
        public final String runtimeVersion;
        public final String channel;
        public final int minCarrierVersionCode;
        public final int bridgeVersion;
        public final URI bundleUri;
        public final String archiveSha256;

        UpdateDescriptor(String releaseId, String runtimeVersion, String channel, int minCarrierVersionCode, int bridgeVersion, URI bundleUri, String archiveSha256) {
            this.releaseId = releaseId;
            this.runtimeVersion = runtimeVersion;
            this.channel = channel;
            this.minCarrierVersionCode = minCarrierVersionCode;
            this.bridgeVersion = bridgeVersion;
            this.bundleUri = bundleUri;
            this.archiveSha256 = archiveSha256;
        }

        public JSONObject toJson() throws JSONException {
            final JSONObject value = new JSONObject();
            value.put("releaseId", releaseId);
            value.put("runtimeVersion", runtimeVersion);
            value.put("channel", channel);
            value.put("minCarrierVersionCode", minCarrierVersionCode);
            value.put("bridgeVersion", bridgeVersion);
            return value;
        }
    }

    private final Context context;
    private final RuntimeInstaller installer;
    private final RuntimeUpdateEndpointStore endpointStore;

    public RuntimeUpdateClient(Context context) {
        this.context = context.getApplicationContext();
        this.installer = new RuntimeInstaller(context, BuildConfig.VERSION_CODE, BRIDGE_VERSION);
        this.endpointStore = new RuntimeUpdateEndpointStore(context);
    }

    public UpdateDescriptor checkForUpdate() throws IOException {
        return checkForUpdate(manifestUri(endpointStore.effectiveEndpoint()));
    }

    public UpdateDescriptor checkForUpdate(String rawEndpoint) throws IOException {
        return checkForUpdate(manifestUri(endpointStore.validateCandidate(rawEndpoint)));
    }

    private UpdateDescriptor checkForUpdate(URI manifestUri) throws IOException {
        final JSONObject descriptor = fetchJson(manifestUri.toURL());
        final String releaseId = requireReleaseId(descriptor.optString("releaseId", null));
        final String runtimeVersion = requireText(descriptor.optString("runtimeVersion", null), "RUNTIME_VERSION_REQUIRED");
        final String channel = requireChannel(descriptor.optString("channel", null));
        final int minCarrierVersionCode = requirePositiveInt(descriptor, "minCarrierVersionCode", "RUNTIME_MIN_CARRIER_VERSION_REQUIRED");
        final int bridgeVersion = requirePositiveInt(descriptor, "bridgeVersion", "RUNTIME_BRIDGE_VERSION_REQUIRED");
        if (BuildConfig.VERSION_CODE < minCarrierVersionCode) throw new IOException("RUNTIME_CARRIER_INCOMPATIBLE");
        if (bridgeVersion != BRIDGE_VERSION) throw new IOException("RUNTIME_BRIDGE_INCOMPATIBLE");

        final String bundleUrl = requireText(descriptor.optString("bundleUrl", null), "RUNTIME_BUNDLE_URL_REQUIRED");
        final String archiveSha256 = requireSha256(descriptor.optString("archiveSha256", null));
        final URI bundleUri;
        try { bundleUri = manifestUri.resolve(bundleUrl); }
        catch (IllegalArgumentException error) { throw new IOException("RUNTIME_BUNDLE_URL_INVALID", error); }
        assertHttps(bundleUri, "RUNTIME_BUNDLE_URL_INVALID");
        if (!sameOrigin(manifestUri, bundleUri)) throw new IOException("RUNTIME_BUNDLE_ORIGIN_REJECTED");
        return new UpdateDescriptor(releaseId, runtimeVersion, channel, minCarrierVersionCode, bridgeVersion, bundleUri, archiveSha256);
    }

    public RuntimeBundleMetadata downloadAndStage(UpdateDescriptor descriptor) throws IOException {
        if (descriptor == null) throw new IOException("RUNTIME_UPDATE_DESCRIPTOR_REQUIRED");
        assertHttps(descriptor.bundleUri, "RUNTIME_BUNDLE_URL_INVALID");
        final File download = new File(context.getCacheDir(), "morefun-runtime-update.mfos");
        try {
            download(descriptor.bundleUri.toURL(), download);
            final RuntimeBundleMetadata staged = installer.stageSignedBundle(download, descriptor.archiveSha256);
            if (!descriptor.releaseId.equals(staged.releaseId)
                || !descriptor.runtimeVersion.equals(staged.runtimeVersion)
                || !descriptor.channel.equals(staged.channel)
                || descriptor.minCarrierVersionCode != staged.minCarrierVersionCode
                || descriptor.bridgeVersion != staged.bridgeVersion) throw new IOException("RUNTIME_UPDATE_MANIFEST_BUNDLE_MISMATCH");
            return staged;
        } finally {
            if (download.exists() && !download.delete()) download.deleteOnExit();
        }
    }

    public boolean isConfigured() {
        try { endpointStore.effectiveEndpoint(); return true; }
        catch (IOException error) { return false; }
    }

    private static URI manifestUri(String raw) throws IOException {
        final String accepted = raw == null ? "" : raw.trim();
        if (accepted.isEmpty()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_NOT_CONFIGURED");
        try {
            final URI uri = new URI(accepted);
            assertHttps(uri, "RUNTIME_UPDATE_ENDPOINT_INVALID");
            if (uri.getUserInfo() != null || uri.getFragment() != null) throw new IOException("RUNTIME_UPDATE_ENDPOINT_INVALID");
            return uri;
        } catch (URISyntaxException error) {
            throw new IOException("RUNTIME_UPDATE_ENDPOINT_INVALID", error);
        }
    }

    private static JSONObject fetchJson(URL url) throws IOException {
        final HttpURLConnection connection = open(url);
        try {
            final int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException("RUNTIME_UPDATE_MANIFEST_HTTP_" + status);
            final long length = connection.getContentLengthLong();
            if (length > MAX_MANIFEST_BYTES) throw new IOException("RUNTIME_UPDATE_MANIFEST_TOO_LARGE");
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream()); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                final byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > MAX_MANIFEST_BYTES) throw new IOException("RUNTIME_UPDATE_MANIFEST_TOO_LARGE");
                    bytes.write(buffer, 0, count);
                }
                try { return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())); }
                catch (JSONException error) { throw new IOException("RUNTIME_UPDATE_MANIFEST_INVALID", error); }
            }
        } finally { connection.disconnect(); }
    }

    private static void download(URL url, File target) throws IOException {
        final HttpURLConnection connection = open(url);
        try {
            final int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException("RUNTIME_BUNDLE_HTTP_" + status);
            final long length = connection.getContentLengthLong();
            if (length > MAX_BUNDLE_BYTES) throw new IOException("RUNTIME_BUNDLE_TOO_LARGE");
            long written = 0;
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(target, false)) {
                final byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    written += count;
                    if (written > MAX_BUNDLE_BYTES) throw new IOException("RUNTIME_BUNDLE_TOO_LARGE");
                    output.write(buffer, 0, count);
                }
                output.getFD().sync();
            } catch (IOException error) {
                if (target.exists()) target.delete();
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
        connection.setRequestProperty("Accept", "application/json, application/octet-stream;q=0.9");
        return connection;
    }

    static boolean sameOrigin(URI left, URI right) {
        return left.getScheme() != null
            && right.getScheme() != null
            && left.getScheme().equalsIgnoreCase(right.getScheme())
            && left.getHost() != null
            && right.getHost() != null
            && left.getHost().equalsIgnoreCase(right.getHost())
            && normalizedPort(left) == normalizedPort(right);
    }

    private static int normalizedPort(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }

    private static void assertHttps(URI uri, String code) throws IOException {
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getHost().trim().isEmpty()) throw new IOException(code);
    }

    private static String requireReleaseId(String value) throws IOException {
        final String accepted = requireText(value, "RUNTIME_RELEASE_ID_REQUIRED");
        if (!accepted.matches("[A-Za-z0-9._-]{1,96}")) throw new IOException("RUNTIME_RELEASE_ID_INVALID");
        return accepted;
    }

    private static String requireChannel(String value) throws IOException {
        final String accepted = requireText(value, "RUNTIME_CHANNEL_REQUIRED");
        if (!accepted.equals("stable") && !accepted.equals("candidate") && !accepted.equals("dev")) throw new IOException("RUNTIME_CHANNEL_INVALID");
        return accepted;
    }

    private static int requirePositiveInt(JSONObject descriptor, String key, String code) throws IOException {
        if (!descriptor.has(key) || descriptor.isNull(key)) throw new IOException(code);
        final int value = descriptor.optInt(key, -1);
        if (value <= 0) throw new IOException(code);
        return value;
    }

    private static String requireSha256(String value) throws IOException {
        final String accepted = requireText(value, "RUNTIME_ARCHIVE_SHA256_REQUIRED").toLowerCase(Locale.US);
        if (!accepted.matches("[0-9a-f]{64}")) throw new IOException("RUNTIME_ARCHIVE_SHA256_INVALID");
        return accepted;
    }

    private static String requireText(String value, String code) throws IOException {
        if (value == null || value.trim().isEmpty()) throw new IOException(code);
        return value.trim();
    }
}
