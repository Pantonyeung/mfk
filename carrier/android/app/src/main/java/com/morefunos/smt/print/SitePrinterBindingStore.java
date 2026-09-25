package com.morefunos.smt.print;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class SitePrinterBindingStore {
    private static final String PREFS = "site-printer-bindings";
    private final Context applicationContext;
    private final SharedPreferences preferences;

    public static final class Binding {
        public final String slotId;
        public final String displayName;
        public final String model;
        public final String capability;
        public final String transport;
        public final String host;
        public final int port;
        public final boolean enabled;
        public final int drawerPin;

        public Binding(
            String slotId,
            String displayName,
            String model,
            String capability,
            String transport,
            String host,
            int port,
            boolean enabled,
            int drawerPin
        ) {
            this.slotId = requireText(slotId, "PRINTER_BINDING_SLOT_REQUIRED");
            this.displayName = requireText(displayName, "PRINTER_BINDING_NAME_REQUIRED");
            this.model = requireText(model, "PRINTER_BINDING_MODEL_REQUIRED");
            this.capability = requireCapability(capability);
            this.transport = requireTransport(transport);
            this.host = "tcp".equals(this.transport) ? requireText(host, "PRINTER_TCP_HOST_REQUIRED") : null;
            this.port = "tcp".equals(this.transport) ? requirePort(port) : 0;
            this.enabled = enabled;
            this.drawerPin = requireDrawerPin(drawerPin);
        }

        JSONObject toJson() throws JSONException {
            final JSONObject json = new JSONObject();
            json.put("slotId", slotId);
            json.put("displayName", displayName);
            json.put("model", model);
            json.put("capability", capability);
            json.put("transport", transport);
            if (host == null) json.put("host", JSONObject.NULL); else json.put("host", host);
            json.put("port", port);
            json.put("enabled", enabled);
            if (drawerPin < 0) json.put("drawerPin", JSONObject.NULL); else json.put("drawerPin", drawerPin);
            return json;
        }

        static Binding fromJson(JSONObject json) {
            return new Binding(
                json.optString("slotId", null),
                json.optString("displayName", null),
                json.optString("model", null),
                json.optString("capability", null),
                json.optString("transport", null),
                json.optString("host", null),
                json.optInt("port", 0),
                json.optBoolean("enabled", true),
                json.has("drawerPin") && !json.isNull("drawerPin") ? json.optInt("drawerPin", -1) : -1
            );
        }
    }

    public SitePrinterBindingStore(Context context) {
        this.applicationContext = context.getApplicationContext();
        this.preferences = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    Context applicationContext() {
        return applicationContext;
    }

    public synchronized void save(Binding binding) {
        try {
            if (!preferences.edit().putString(binding.slotId, binding.toJson().toString()).commit()) {
                throw new IllegalStateException("PRINTER_BINDING_PERSIST_FAILED");
            }
        } catch (JSONException error) {
            throw new IllegalArgumentException("PRINTER_BINDING_ENCODING_FAILED", error);
        }
    }

    public synchronized Binding get(String slotId) {
        final String raw = preferences.getString(requireText(slotId, "PRINTER_BINDING_SLOT_REQUIRED"), null);
        if (raw == null) return null;
        try {
            return Binding.fromJson(new JSONObject(raw));
        } catch (JSONException | IllegalArgumentException error) {
            throw new IllegalStateException("PRINTER_BINDING_CORRUPT", error);
        }
    }

    public synchronized List<Binding> list() {
        final List<Binding> bindings = new ArrayList<>();
        for (Map.Entry<String, ?> entry : preferences.getAll().entrySet()) {
            if (!(entry.getValue() instanceof String)) continue;
            try {
                bindings.add(Binding.fromJson(new JSONObject((String) entry.getValue())));
            } catch (JSONException | IllegalArgumentException error) {
                throw new IllegalStateException("PRINTER_BINDING_CORRUPT:" + entry.getKey(), error);
            }
        }
        bindings.sort((left, right) -> left.slotId.compareTo(right.slotId));
        return bindings;
    }

    public synchronized boolean delete(String slotId) {
        final String safe = requireText(slotId, "PRINTER_BINDING_SLOT_REQUIRED");
        if (!preferences.contains(safe)) return false;
        return preferences.edit().remove(safe).commit();
    }

    private static String requireCapability(String value) {
        final String accepted = requireText(value, "PRINTER_BINDING_CAPABILITY_REQUIRED");
        if (!accepted.equals("receipt-80mm/kitchen") && !accepted.equals("label-58mm") && !accepted.equals("sunmi-built-in")) {
            throw new IllegalArgumentException("PRINTER_BINDING_CAPABILITY_INVALID");
        }
        return accepted;
    }

    private static String requireTransport(String value) {
        final String accepted = requireText(value, "PRINTER_BINDING_TRANSPORT_REQUIRED");
        if (!accepted.equals("tcp") && !accepted.equals("usb") && !accepted.equals("sunmi-built-in")) {
            throw new IllegalArgumentException("PRINTER_BINDING_TRANSPORT_INVALID");
        }
        return accepted;
    }

    private static int requirePort(int port) {
        if (port <= 0 || port > 65535) throw new IllegalArgumentException("PRINTER_TCP_PORT_INVALID");
        return port;
    }

    private static int requireDrawerPin(int drawerPin) {
        if (drawerPin != -1 && drawerPin != 0 && drawerPin != 1) {
            throw new IllegalArgumentException("PRINTER_DRAWER_PIN_INVALID");
        }
        return drawerPin;
    }

    private static String requireText(String value, String code) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(code);
        return value.trim();
    }
}
