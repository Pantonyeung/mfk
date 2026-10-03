package com.morefunos.smt.storekernel.business;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Decodes an already validated Store Kernel Admin envelope without scalar coercion. */
public final class FormalCheckoutOrgJsonDecoder implements FormalCheckoutSourceContracts.JsonObjectDecoder {
    @Override
    public Map<String, Object> decodeObject(String stateJson) {
        try {
            final JSONTokener tokens = new JSONTokener(stateJson);
            final Object root = tokens.nextValue();
            if (!(root instanceof JSONObject) || tokens.nextClean() != 0) {
                throw new IllegalArgumentException("ADMIN_STATE_JSON_INVALID");
            }
            return object((JSONObject) root);
        } catch (JSONException failure) {
            throw new IllegalArgumentException("ADMIN_STATE_JSON_INVALID", failure);
        }
    }

    private static Map<String, Object> object(JSONObject input) throws JSONException {
        final Map<String, Object> output = new LinkedHashMap<>();
        final Iterator<String> keys = input.keys();
        while (keys.hasNext()) {
            final String key = keys.next();
            output.put(key, value(input.get(key)));
        }
        return output;
    }

    private static Object value(Object input) throws JSONException {
        if (input == JSONObject.NULL) return null;
        if (input instanceof JSONObject) return object((JSONObject) input);
        if (input instanceof JSONArray) {
            final JSONArray array = (JSONArray) input;
            final List<Object> output = new ArrayList<>();
            for (int index = 0; index < array.length(); index++) output.add(value(array.get(index)));
            return output;
        }
        return input;
    }
}
