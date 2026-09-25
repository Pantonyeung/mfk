package com.morefunos.smt.boot;

import android.annotation.SuppressLint;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

@SuppressLint("ApplySharedPref")
public final class BootEvidenceStore {
    private static final String PREFS = "boot-evidence";
    private static final String KEY_LAST = "last-boot-completed";
    private final SharedPreferences preferences;

    public BootEvidenceStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized JSONObject recordBootCompleted(String status, String errorCode) {
        final JSONObject receipt = new JSONObject();
        try {
            receipt.put("event", "BOOT_COMPLETED");
            receipt.put("timestampMs", System.currentTimeMillis());
            receipt.put("status", status == null || status.trim().isEmpty() ? "unknown" : status.trim());
            if (errorCode == null || errorCode.trim().isEmpty()) receipt.put("errorCode", JSONObject.NULL);
            else receipt.put("errorCode", errorCode.trim());
        } catch (JSONException error) {
            throw new IllegalStateException("BOOT_EVIDENCE_ENCODING_FAILED", error);
        }
        if (!preferences.edit().putString(KEY_LAST, receipt.toString()).commit()) {
            throw new IllegalStateException("BOOT_EVIDENCE_PERSIST_FAILED");
        }
        return receipt;
    }

    public synchronized JSONObject lastBootCompleted() {
        final String raw = preferences.getString(KEY_LAST, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException error) {
            throw new IllegalStateException("BOOT_EVIDENCE_CORRUPT", error);
        }
    }
}
