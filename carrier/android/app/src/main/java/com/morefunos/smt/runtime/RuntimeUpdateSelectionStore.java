package com.morefunos.smt.runtime;

import android.content.Context;
import android.util.AtomicFile;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class RuntimeUpdateSelectionStore {
    private static final String RUNTIME_ROOT = "runtime";
    private static final String SELECTION_FILE = "ota-selection.json";

    private final File runtimeRoot;
    private final AtomicFile selectionFile;

    public RuntimeUpdateSelectionStore(Context context) {
        final Context app = context.getApplicationContext();
        this.runtimeRoot = new File(app.getFilesDir(), RUNTIME_ROOT);
        this.selectionFile = new AtomicFile(new File(runtimeRoot, SELECTION_FILE));
    }

    public synchronized void select(String releaseId) throws IOException {
        final String safeId = requireReleaseId(releaseId);
        if (!runtimeRoot.exists() && !runtimeRoot.mkdirs()) throw new IOException("RUNTIME_UPDATE_SELECTION_ROOT_UNAVAILABLE");
        FileOutputStream output = null;
        try {
            final JSONObject value = new JSONObject();
            value.put("releaseId", safeId);
            output = selectionFile.startWrite();
            output.write(value.toString().getBytes(StandardCharsets.UTF_8));
            selectionFile.finishWrite(output);
        } catch (IOException | JSONException error) {
            if (output != null) selectionFile.failWrite(output);
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("RUNTIME_UPDATE_SELECTION_ENCODING_FAILED", error);
        }
    }

    public synchronized String selectedReleaseId() throws IOException {
        if (!selectionFile.getBaseFile().isFile()) return null;
        try (FileInputStream input = selectionFile.openRead(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            final byte[] buffer = new byte[1024];
            int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            try {
                final JSONObject value = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
                return requireReleaseId(value.optString("releaseId", null));
            } catch (JSONException | IllegalArgumentException error) {
                clear();
                throw new IOException("RUNTIME_UPDATE_SELECTION_INVALID", error);
            }
        }
    }

    public synchronized void clear() {
        selectionFile.delete();
    }

    private static String requireReleaseId(String releaseId) {
        if (releaseId == null || !releaseId.matches("[A-Za-z0-9._-]{1,96}")) throw new IllegalArgumentException("RUNTIME_RELEASE_ID_INVALID");
        return releaseId;
    }
}
