package com.morefunos.smt.runtime;

import android.content.Context;
import android.content.SharedPreferences;

import com.morefunos.smt.BuildConfig;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public final class RuntimeUpdateEndpointStore {
    private static final String PREFS_NAME = "morefun_runtime_update_endpoint";
    private static final String KEY_ACTIVE_ENDPOINT = "active_endpoint";
    private static final String KEY_PREVIOUS_ENDPOINT = "previous_endpoint";
    private static final String LEGACY_V1_MARKER = "morefunos-v1-ota";

    public static final class EndpointInfo {
        public final String activeEndpoint;
        public final String builtInDefaultEndpoint;
        public final String previousEndpoint;

        EndpointInfo(String activeEndpoint, String builtInDefaultEndpoint, String previousEndpoint) {
            this.activeEndpoint = activeEndpoint;
            this.builtInDefaultEndpoint = builtInDefaultEndpoint;
            this.previousEndpoint = previousEndpoint;
        }
    }

    private final SharedPreferences preferences;
    private final String builtInDefault;

    public RuntimeUpdateEndpointStore(Context context) {
        this(context, BuildConfig.RUNTIME_UPDATE_MANIFEST_URL);
    }

    RuntimeUpdateEndpointStore(Context context, String builtInDefault) {
        this.preferences = context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.builtInDefault = builtInDefault == null ? "" : builtInDefault;
    }

    public synchronized String effectiveEndpoint() throws IOException {
        final String active = preferences.getString(KEY_ACTIVE_ENDPOINT, null);
        if (active != null && !active.trim().isEmpty()) {
            try {
                final String accepted = validateCandidate(active);
                if (!isLegacyV1Endpoint(accepted)) return accepted;
                return migrateLegacyActiveEndpoint(accepted);
            } catch (IOException invalidActive) {
                if (isLegacyV1Endpoint(active)) return migrateLegacyActiveEndpoint(active);
            }
        }
        return builtInDefaultEndpoint();
    }

    public synchronized String previousEndpoint() throws IOException {
        final String previous = preferences.getString(KEY_PREVIOUS_ENDPOINT, null);
        if (previous == null || previous.trim().isEmpty()) return null;
        return validateCandidate(previous);
    }

    public String builtInDefaultEndpoint() throws IOException {
        return validateCandidate(builtInDefault);
    }

    public synchronized EndpointInfo endpointInfo() throws IOException {
        return new EndpointInfo(effectiveEndpoint(), builtInDefaultEndpoint(), previousEndpoint());
    }

    public String validateCandidate(String raw) throws IOException {
        final String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_NOT_CONFIGURED");
        try {
            final URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                || uri.getHost() == null
                || uri.getHost().trim().isEmpty()
                || uri.getUserInfo() != null
                || uri.getFragment() != null) throw new IOException("RUNTIME_UPDATE_ENDPOINT_INVALID");
            return uri.toString();
        } catch (URISyntaxException error) {
            throw new IOException("RUNTIME_UPDATE_ENDPOINT_INVALID", error);
        }
    }

    public synchronized String applyValidatedCandidate(String raw) throws IOException {
        final String candidate = validateCandidate(raw);
        if (isLegacyV1Endpoint(candidate)) throw new IOException("RUNTIME_UPDATE_ENDPOINT_LEGACY_REJECTED");
        final String current;
        try { current = effectiveEndpoint(); }
        catch (IOException noDefault) {
            if (!preferences.edit().putString(KEY_ACTIVE_ENDPOINT, candidate).commit()) {
                throw new IOException("RUNTIME_UPDATE_ENDPOINT_PERSIST_FAILED");
            }
            return effectiveEndpoint();
        }
        if (candidate.equals(current)) return current;
        final SharedPreferences.Editor editor = preferences.edit().putString(KEY_PREVIOUS_ENDPOINT, current);
        if (candidate.equals(builtInDefaultEndpoint())) editor.remove(KEY_ACTIVE_ENDPOINT);
        else editor.putString(KEY_ACTIVE_ENDPOINT, candidate);
        if (!editor.commit()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_PERSIST_FAILED");
        return effectiveEndpoint();
    }

    public synchronized String restorePrevious() throws IOException {
        final String previous = previousEndpoint();
        if (previous == null) throw new IOException("RUNTIME_UPDATE_PREVIOUS_ENDPOINT_NOT_AVAILABLE");
        if (isLegacyV1Endpoint(previous)) throw new IOException("RUNTIME_UPDATE_PREVIOUS_ENDPOINT_LEGACY_REJECTED");
        final String current = effectiveEndpoint();
        final SharedPreferences.Editor editor = preferences.edit().putString(KEY_PREVIOUS_ENDPOINT, current);
        if (previous.equals(builtInDefaultEndpoint())) editor.remove(KEY_ACTIVE_ENDPOINT);
        else editor.putString(KEY_ACTIVE_ENDPOINT, previous);
        if (!editor.commit()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_PERSIST_FAILED");
        return effectiveEndpoint();
    }

    public synchronized String restoreDefault() throws IOException {
        final String target = builtInDefaultEndpoint();
        final String current = effectiveEndpoint();
        if (target.equals(current)) return current;
        if (!preferences.edit()
            .putString(KEY_PREVIOUS_ENDPOINT, current)
            .remove(KEY_ACTIVE_ENDPOINT)
            .commit()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_PERSIST_FAILED");
        return effectiveEndpoint();
    }

    private String migrateLegacyActiveEndpoint(String legacy) throws IOException {
        final String target = builtInDefaultEndpoint();
        final String safeLegacy = validateCandidate(legacy);
        if (!preferences.edit()
            .putString(KEY_PREVIOUS_ENDPOINT, safeLegacy)
            .remove(KEY_ACTIVE_ENDPOINT)
            .commit()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_PERSIST_FAILED");
        return target;
    }

    private static boolean isLegacyV1Endpoint(String raw) {
        if (raw == null || raw.trim().isEmpty()) return false;
        try {
            final URI uri = new URI(raw.trim());
            final String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            final String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.ROOT);
            return host.contains(LEGACY_V1_MARKER) || path.contains(LEGACY_V1_MARKER);
        } catch (URISyntaxException ignored) {
            return raw.toLowerCase(Locale.ROOT).contains(LEGACY_V1_MARKER);
        }
    }
}
