package com.morefunos.smt.smm;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import org.json.JSONArray;
import org.json.JSONException;

import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Set;

/**
 * Minimal persistent pairing registry for the local SMM ingress.
 *
 * Discovery never implies trust. A device must present a token previously
 * paired on this SMT. Tokens are generated locally and never leave the store
 * except through the explicit pairing flow.
 */
public final class SmmTrustedDeviceStore {
    private static final String PREFS = "mfk.smm.trusted.v1";
    private static final String DEVICES = "devices";
    private static final String PAIRING_TOKEN = "pairing_token";
    private final SharedPreferences preferences;
    private final SecureRandom random = new SecureRandom();

    public SmmTrustedDeviceStore(@NonNull Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @NonNull
    public synchronized String pairingToken() {
        String token = preferences.getString(PAIRING_TOKEN, "");
        if (token != null && !token.isEmpty()) return token;
        final byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        final StringBuilder builder = new StringBuilder();
        for (byte value : bytes) builder.append(String.format("%02x", value & 0xff));
        token = builder.toString();
        preferences.edit().putString(PAIRING_TOKEN, token).commit();
        return token;
    }

    public synchronized boolean pair(@NonNull String deviceId, @NonNull String token) {
        final String id = deviceId.trim();
        if (id.isEmpty() || id.length() > 120 || !pairingToken().equals(token)) return false;
        final Set<String> devices = read();
        devices.add(id);
        write(devices);
        return true;
    }

    public synchronized boolean trusted(@NonNull String deviceId) {
        return read().contains(deviceId.trim());
    }

    @NonNull
    public synchronized JSONArray snapshot() {
        final JSONArray array = new JSONArray();
        for (String id : read()) array.put(id);
        return array;
    }

    private Set<String> read() {
        final Set<String> result = new HashSet<>();
        final String raw = preferences.getString(DEVICES, "[]");
        try {
            final JSONArray array = new JSONArray(raw == null ? "[]" : raw);
            for (int i = 0; i < array.length(); i++) {
                final String value = array.optString(i, "").trim();
                if (!value.isEmpty()) result.add(value);
            }
        } catch (JSONException ignored) { }
        return result;
    }

    private void write(Set<String> devices) {
        final JSONArray array = new JSONArray();
        for (String id : devices) array.put(id);
        preferences.edit().putString(DEVICES, array.toString()).commit();
    }
}
