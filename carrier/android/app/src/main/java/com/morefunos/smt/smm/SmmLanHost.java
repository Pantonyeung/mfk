package com.morefunos.smt.smm;

import androidx.annotation.NonNull;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Narrow store-LAN host. It does not implement Order/Pricing authority.
 * It authenticates a paired SMM device and forwards one JSON envelope to the
 * active SMT runtime bridge, which remains responsible for canonical handling.
 */
public final class SmmLanHost implements Closeable {
    public interface Handler {
        @NonNull String handle(@NonNull String deviceId, @NonNull String json);
    }

    public static final int DEFAULT_PORT = 17831;
    private final SmmTrustedDeviceStore trustedDevices;
    private final Handler handler;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private volatile ServerSocket server;
    private volatile boolean running;

    public SmmLanHost(@NonNull SmmTrustedDeviceStore trustedDevices, @NonNull Handler handler) {
        this.trustedDevices = trustedDevices;
        this.handler = handler;
    }

    public synchronized void start() throws IOException {
        if (running) return;
        final ServerSocket socket = new ServerSocket(DEFAULT_PORT, 16, InetAddress.getByName("0.0.0.0"));
        socket.setReuseAddress(true);
        server = socket;
        running = true;
        executor.execute(this::acceptLoop);
    }

    private void acceptLoop() {
        while (running) {
            try {
                final Socket socket = server.accept();
                executor.execute(() -> serve(socket));
            } catch (IOException error) {
                if (running) running = false;
            }
        }
    }

    private void serve(Socket socket) {
        try (Socket client = socket;
             BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(client.getOutputStream(), StandardCharsets.UTF_8))) {
            client.setSoTimeout(5_000);
            final String raw = reader.readLine();
            final JSONObject envelope = new JSONObject(raw == null ? "{}" : raw);
            final String deviceId = envelope.optString("deviceId", "").trim();
            final String action = envelope.optString("action", "").trim();

            final String response;
            if ("health".equals(action)) {
                response = json(true, "SMM_LAN_HOST_READY").toString();
            } else if ("pair".equals(action)) {
                final boolean paired = trustedDevices.pair(deviceId, envelope.optString("pairingToken", ""));
                response = json(paired, paired ? "SMM_DEVICE_PAIRED" : "SMM_PAIRING_REJECTED").toString();
            } else if (!trustedDevices.trusted(deviceId)) {
                response = json(false, "SMM_DEVICE_NOT_TRUSTED").toString();
            } else {
                final Object payload = envelope.opt("payload");
                if (!(payload instanceof JSONObject)) response = json(false, "SMM_PAYLOAD_REQUIRED").toString();
                else response = handler.handle(deviceId, payload.toString());
            }
            writer.write(response);
            writer.write("\n");
            writer.flush();
        } catch (IOException | JSONException | RuntimeException ignored) { }
    }

    private static JSONObject json(boolean ok, String code) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("ok", ok);
        response.put("code", code);
        response.put("protocolVersion", 1);
        return response;
    }

    @Override
    public synchronized void close() {
        running = false;
        if (server != null) {
            try { server.close(); } catch (IOException ignored) { }
            server = null;
        }
        executor.shutdownNow();
    }
}
