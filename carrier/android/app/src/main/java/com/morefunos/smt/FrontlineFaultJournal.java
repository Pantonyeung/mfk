package com.morefunos.smt;

import android.annotation.SuppressLint;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class FrontlineFaultJournal {
    private static final String PREFS = "morefunos.frontline.fault-journal.v1";
    private static final String KEY_FAULTS = "faults";
    private static final String KEY_LAST_ACTION = "last_action";
    private static final int MAX_FAULTS = 50;

    private final SharedPreferences preferences;

    FrontlineFaultJournal(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized void setLastAction(String action, String route) {
        final JSONObject value = new JSONObject();
        try {
            value.put("action", bounded(action, 160));
            value.put("route", bounded(route, 240));
            value.put("observedAtEpochMs", System.currentTimeMillis());
        } catch (JSONException ignored) { }
        preferences.edit().putString(KEY_LAST_ACTION, value.toString()).apply();
    }

    synchronized void record(String source, String code, String message, JSONObject detail) {
        final JSONArray existing = readArray();
        final JSONObject event = new JSONObject();
        try {
            event.put("observedAtEpochMs", System.currentTimeMillis());
            event.put("source", bounded(source, 80));
            event.put("code", bounded(code, 120));
            event.put("message", bounded(message, 500));
            final JSONObject lastAction = readLastAction();
            if (lastAction != null) event.put("lastAction", lastAction);
            if (detail != null) event.put("detail", detail);
        } catch (JSONException ignored) { }

        final JSONArray next = new JSONArray();
        final int start = Math.max(0, existing.length() - (MAX_FAULTS - 1));
        for (int index = start; index < existing.length(); index += 1) {
            final Object value = existing.opt(index);
            if (value != null) next.put(value);
        }
        next.put(event);
        preferences.edit().putString(KEY_FAULTS, next.toString()).commit();
    }

    synchronized JSONArray readRecent() {
        return readArray();
    }

    private JSONArray readArray() {
        final String raw = preferences.getString(KEY_FAULTS, "[]");
        try { return new JSONArray(raw == null ? "[]" : raw); }
        catch (JSONException ignored) { return new JSONArray(); }
    }

    private JSONObject readLastAction() {
        final String raw = preferences.getString(KEY_LAST_ACTION, null);
        if (raw == null || raw.trim().isEmpty()) return null;
        try { return new JSONObject(raw); }
        catch (JSONException ignored) { return null; }
    }

    private static String bounded(String value, int max) {
        final String safe = value == null ? "" : value;
        return safe.length() <= max ? safe : safe.substring(0, max);
    }
}
