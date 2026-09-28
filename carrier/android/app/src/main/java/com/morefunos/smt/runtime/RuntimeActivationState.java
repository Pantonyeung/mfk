package com.morefunos.smt.runtime;

import org.json.JSONException;
import org.json.JSONObject;

public final class RuntimeActivationState {
    public final String currentReleaseId;
    public final String previousReleaseId;
    public final String candidateReleaseId;
    public final String bootingReleaseId;
    public final boolean activationRequested;

    public RuntimeActivationState(
        String currentReleaseId,
        String previousReleaseId,
        String candidateReleaseId,
        String bootingReleaseId,
        boolean activationRequested
    ) {
        this.currentReleaseId = normalize(currentReleaseId);
        this.previousReleaseId = normalize(previousReleaseId);
        this.candidateReleaseId = normalize(candidateReleaseId);
        this.bootingReleaseId = normalize(bootingReleaseId);
        this.activationRequested = activationRequested;
    }

    public static RuntimeActivationState empty() {
        return new RuntimeActivationState(null, null, null, null, false);
    }

    public JSONObject toJson() throws JSONException {
        final JSONObject json = new JSONObject();
        json.put("schemaVersion", 1);
        putNullable(json, "currentReleaseId", currentReleaseId);
        putNullable(json, "previousReleaseId", previousReleaseId);
        putNullable(json, "candidateReleaseId", candidateReleaseId);
        putNullable(json, "bootingReleaseId", bootingReleaseId);
        json.put("activationRequested", activationRequested);
        return json;
    }

    public static RuntimeActivationState fromJson(JSONObject json) throws JSONException {
        if (json.optInt("schemaVersion", -1) != 1) throw new JSONException("RUNTIME_ACTIVATION_SCHEMA_UNSUPPORTED");
        return new RuntimeActivationState(
            optionalText(json, "currentReleaseId"),
            optionalText(json, "previousReleaseId"),
            optionalText(json, "candidateReleaseId"),
            optionalText(json, "bootingReleaseId"),
            json.optBoolean("activationRequested", false)
        );
    }

    private static String optionalText(JSONObject json, String key) {
        if (!json.has(key) || json.isNull(key)) return null;
        return normalize(json.optString(key, null));
    }

    private static String normalize(String value) {
        if (value == null) return null;
        final String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static void putNullable(JSONObject json, String key, String value) throws JSONException {
        if (value == null) json.put(key, JSONObject.NULL);
        else json.put(key, value);
    }
}
