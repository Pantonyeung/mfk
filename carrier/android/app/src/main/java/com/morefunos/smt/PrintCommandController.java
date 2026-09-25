package com.morefunos.smt;

import android.content.Context;
import android.os.RemoteException;
import android.util.Base64;

import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.InnerResultCallback;
import com.sunmi.peripheral.printer.SunmiPrinterService;
import com.morefunos.smt.print.SitePrinterBindingStore;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public final class PrintCommandController {
    private static final int MAX_PAYLOAD_BYTES = 512 * 1024;
    private static final int LAN_CONNECT_TIMEOUT_MS = 3000;
    private static final int LAN_WRITE_TIMEOUT_MS = 5000;

    private final Context appContext;
    private final ExecutorService ioExecutor;
    private final Map<String, ExecutorService> lanPrintExecutors;
    private final ScheduledExecutorService timeoutExecutor;
    private final Consumer<String> webNotifier;
    private final SitePrinterBindingStore bindingStore;
    private volatile SunmiPrinterService sunmiPrinterService;
    private volatile boolean sunmiBindingAvailable;

    private final InnerPrinterCallback sunmiPrinterCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            sunmiPrinterService = service;
            try {
                sunmiBindingAvailable = InnerPrinterManager.getInstance().hasPrinter(service);
            } catch (InnerPrinterException error) {
                sunmiBindingAvailable = false;
            }
        }

        @Override
        protected void onDisconnected() {
            sunmiPrinterService = null;
            sunmiBindingAvailable = false;
        }
    };

    public PrintCommandController(Context context, Consumer<String> webNotifier) {
        this.appContext = context.getApplicationContext();
        this.webNotifier = webNotifier;
        this.ioExecutor = Executors.newSingleThreadExecutor();
        this.lanPrintExecutors = new ConcurrentHashMap<>();
        this.timeoutExecutor = Executors.newSingleThreadScheduledExecutor();
        this.bindingStore = new SitePrinterBindingStore(appContext);
        migrateBuildTimeLanEndpoints();
        bindSunmiPrinter();
    }

    public JSONObject handle(JSONObject request) throws JSONException {
        final String type = request.optString("type", "").trim();
        final String requestId = request.optString("requestId", "").trim();
        if (requestId.isEmpty()) return rejected(null, "NATIVE_PRINT_REQUEST_ID_REQUIRED");

        if ("print.lan.endpoint.apply".equals(type)) return applyLanEndpoint(requestId, request);
        if ("print.lan.endpoint.test".equals(type)) return testLanEndpoint(requestId, request);
        if ("print.lan.endpoint.probe".equals(type)) return probeLanEndpoint(requestId, request);
        if ("print.sunmi.test".equals(type)) return testSunmiPrinter(requestId);

        final String dispatchAttemptId = request.optString("dispatchAttemptId", "").trim();
        if (dispatchAttemptId.isEmpty()) return rejected(requestId, "NATIVE_PRINT_DISPATCH_ATTEMPT_REQUIRED");

        final byte[] payload;
        try {
            payload = decodePayload(request.optString("payloadBase64", ""));
        } catch (IllegalArgumentException error) {
            return rejected(requestId, error.getMessage());
        }

        if ("print.sunmi.dispatch".equals(type)) {
            if (!sunmiBindingAvailable || sunmiPrinterService == null) return rejected(requestId, "SUNMI_PRINTER_UNAVAILABLE");
            ioExecutor.execute(() -> dispatchSunmi(requestId, dispatchAttemptId, payload));
            return accepted("print.sunmi.dispatch.result", requestId);
        }

        if ("print.lan.dispatch".equals(type)) {
            final String endpointId = request.optString("endpointId", "").trim();
            final SitePrinterBindingStore.Binding binding = bindingStore.get(endpointId);
            if (binding == null || !binding.enabled || !"tcp".equals(binding.transport)) return rejected(requestId, "LAN_ENDPOINT_NOT_CONFIGURED");
            lanPrintExecutor(endpointId).execute(() -> dispatchLan(requestId, dispatchAttemptId, binding, payload));
            return accepted("print.lan.dispatch.result", requestId);
        }

        return rejected(requestId, "NATIVE_PRINT_CAPABILITY_UNSUPPORTED");
    }

    private JSONObject applyLanEndpoint(String requestId, JSONObject request) throws JSONException {
        final String endpointId = request.optString("endpointId", "").trim();
        final String host = request.optString("host", "").trim();
        final int port = request.optInt("port", -1);
        if (endpointId.isEmpty()) return rejected(requestId, "LAN_ENDPOINT_ID_REQUIRED");
        if (host.isEmpty()) return rejected(requestId, "LAN_ENDPOINT_HOST_REQUIRED");
        if (port < 1 || port > 65535) return rejected(requestId, "LAN_ENDPOINT_PORT_INVALID");

        final SitePrinterBindingStore.Binding existing = bindingStore.get(endpointId);
        final String displayName = existing == null
            ? request.optString("displayName", endpointId).trim()
            : existing.displayName;
        final String model = existing == null
            ? request.optString("model", "SMT Canonical").trim()
            : existing.model;
        final String requestedCapability = request.optString("capability", "receipt-80mm/kitchen").trim();
        final String capability = existing == null ? requestedCapability : existing.capability;
        final int drawerPin = existing == null ? -1 : existing.drawerPin;
        try {
            bindingStore.save(new SitePrinterBindingStore.Binding(
                endpointId,
                displayName.isEmpty() ? endpointId : displayName,
                model.isEmpty() ? "SMT Canonical" : model,
                capability,
                "tcp",
                host,
                port,
                true,
                drawerPin
            ));
        } catch (IllegalArgumentException | IllegalStateException error) {
            return rejected(requestId, error.getMessage() == null ? "LAN_ENDPOINT_PERSIST_FAILED" : error.getMessage());
        }

        final JSONObject response = accepted("print.lan.endpoint.apply.result", requestId);
        response.put("status", "success");
        response.put("endpointId", endpointId);
        response.put("host", host);
        response.put("port", port);
        return response;
    }

    private JSONObject testLanEndpoint(String requestId, JSONObject request) throws JSONException {
        final String endpointId = request.optString("endpointId", "").trim();
        final SitePrinterBindingStore.Binding binding = bindingStore.get(endpointId);
        if (endpointId.isEmpty() || binding == null || !binding.enabled || !"tcp".equals(binding.transport)) return rejected(requestId, "LAN_ENDPOINT_NOT_CONFIGURED");
        ioExecutor.execute(() -> {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(binding.host, binding.port), LAN_CONNECT_TIMEOUT_MS);
                notifyControlCompletion("print.lan.endpoint.test.completed", requestId, true, null, endpointId);
            } catch (IOException | RuntimeException error) {
                notifyControlCompletion("print.lan.endpoint.test.completed", requestId, false, "LAN_ENDPOINT_CONNECT_FAILED", endpointId);
            }
        });
        return accepted("print.lan.endpoint.test.result", requestId);
    }

    private JSONObject probeLanEndpoint(String requestId, JSONObject request) throws JSONException {
        final String host = request.optString("host", "").trim();
        final int port = request.optInt("port", -1);
        if (host.isEmpty()) return rejected(requestId, "PRINTER_ENDPOINT_HOST_REQUIRED");
        if (port < 1 || port > 65535) return rejected(requestId, "PRINTER_ENDPOINT_PORT_INVALID");
        ioExecutor.execute(() -> {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), LAN_CONNECT_TIMEOUT_MS);
                notifyControlCompletion("print.lan.endpoint.probe.completed", requestId, true, null, host + ":" + port);
            } catch (IOException | RuntimeException error) {
                notifyControlCompletion("print.lan.endpoint.probe.completed", requestId, false, "LAN_ENDPOINT_CONNECT_FAILED", host + ":" + port);
            }
        });
        return accepted("print.lan.endpoint.probe.result", requestId);
    }

    private JSONObject testSunmiPrinter(String requestId) throws JSONException {
        final JSONObject response = accepted("print.sunmi.test.result", requestId);
        if (sunmiBindingAvailable && sunmiPrinterService != null) {
            response.put("status", "success");
        } else {
            response.put("status", "failed");
            response.put("failureCode", "SUNMI_PRINTER_UNAVAILABLE");
        }
        return response;
    }

    private void notifyControlCompletion(String type, String requestId, boolean success, String failureCode, String endpointId) {
        if (webNotifier == null) return;
        try {
            final JSONObject result = new JSONObject();
            result.put("type", type);
            result.put("requestId", requestId);
            result.put("status", success ? "success" : "failed");
            result.put("endpointId", endpointId);
            if (failureCode != null) result.put("failureCode", failureCode);
            webNotifier.accept(result.toString());
        } catch (JSONException ignored) { }
    }

    private void migrateBuildTimeLanEndpoints() {
        final Map<String, LanEndpoint> legacy = parseLegacyLanEndpoints(BuildConfig.LAN_PRINTER_ENDPOINTS_JSON);
        for (LanEndpoint endpoint : legacy.values()) {
            if (bindingStore.get(endpoint.endpointId) != null) continue;
            try {
                bindingStore.save(new SitePrinterBindingStore.Binding(
                    endpoint.endpointId,
                    endpoint.endpointId,
                    "Legacy BuildConfig",
                    "receipt-80mm/kitchen",
                    "tcp",
                    endpoint.host,
                    endpoint.port,
                    true,
                    -1
                ));
            } catch (IllegalArgumentException | IllegalStateException ignored) { }
        }
    }

    private static Map<String, LanEndpoint> parseLegacyLanEndpoints(String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) return Collections.emptyMap();
        try {
            final JSONArray source = new JSONArray(rawJson);
            final Map<String, LanEndpoint> endpoints = new HashMap<>();
            for (int index = 0; index < source.length(); index += 1) {
                final JSONObject item = source.getJSONObject(index);
                final String endpointId = item.optString("endpointId", "").trim();
                final String host = item.optString("host", "").trim();
                final int port = item.optInt("port", -1);
                if (endpointId.isEmpty() || host.isEmpty() || port < 1 || port > 65535 || endpoints.containsKey(endpointId)) return Collections.emptyMap();
                endpoints.put(endpointId, new LanEndpoint(endpointId, host, port));
            }
            return Collections.unmodifiableMap(endpoints);
        } catch (JSONException | RuntimeException error) {
            return Collections.emptyMap();
        }
    }

    static final class LanEndpoint {
        final String endpointId;
        final String host;
        final int port;
        LanEndpoint(String endpointId, String host, int port) {
            this.endpointId = endpointId;
            this.host = host;
            this.port = port;
        }
    }

    private void bindSunmiPrinter() {
        try {
            sunmiBindingAvailable = InnerPrinterManager.getInstance().bindService(appContext, sunmiPrinterCallback);
        } catch (InnerPrinterException | RuntimeException error) {
            sunmiBindingAvailable = false;
            sunmiPrinterService = null;
        }
    }

    private void dispatchSunmi(String requestId, String dispatchAttemptId, byte[] payload) {
        final SunmiPrinterService service = sunmiPrinterService;
        if (!sunmiBindingAvailable || service == null) {
            notifyCompletion("print.sunmi.dispatch.completed", requestId, "REJECTED_BEFORE_SEND", "SUNMI_PRINTER_UNAVAILABLE", null, dispatchAttemptId);
            return;
        }

        final AtomicBoolean completed = new AtomicBoolean(false);
        try {
            service.enterPrinterBuffer(true);
            service.sendRAWData(payload, null);
            service.exitPrinterBufferWithCallback(true, new InnerResultCallback() {
                @Override
                public void onRunResult(boolean isSuccess) throws RemoteException {
                    if (!isSuccess && completed.compareAndSet(false, true)) {
                        notifyCompletion("print.sunmi.dispatch.completed", requestId, "OUTCOME_UNKNOWN", null,
                            "SUNMI_COMMAND_EXECUTION_FAILED_AFTER_BUFFER_ENTRY", dispatchAttemptId);
                    }
                }

                @Override
                public void onReturnString(String result) throws RemoteException { }

                @Override
                public void onRaiseException(int code, String msg) throws RemoteException {
                    if (completed.compareAndSet(false, true)) {
                        notifyCompletion("print.sunmi.dispatch.completed", requestId, "OUTCOME_UNKNOWN", null,
                            "SUNMI_TRANSACTION_EXCEPTION_" + code, dispatchAttemptId);
                    }
                }

                @Override
                public void onPrintResult(int code, String msg) throws RemoteException {
                    if (!completed.compareAndSet(false, true)) return;
                    if (code == 0) {
                        notifyCompletion("print.sunmi.dispatch.completed", requestId, "ACKNOWLEDGED", null, null, dispatchAttemptId);
                    } else {
                        notifyCompletion("print.sunmi.dispatch.completed", requestId, "OUTCOME_UNKNOWN", null,
                            "SUNMI_TRANSACTION_PRINT_FAILED_" + code, dispatchAttemptId);
                    }
                }
            });
        } catch (RemoteException | RuntimeException error) {
            if (completed.compareAndSet(false, true)) {
                notifyCompletion("print.sunmi.dispatch.completed", requestId, "OUTCOME_UNKNOWN", null,
                    "SUNMI_TRANSACTION_DISPATCH_EXCEPTION", dispatchAttemptId);
            }
        }
    }

    private ExecutorService lanPrintExecutor(String endpointId) {
        return lanPrintExecutors.computeIfAbsent(endpointId, ignored -> Executors.newSingleThreadExecutor());
    }

    private void dispatchLan(String requestId, String dispatchAttemptId, SitePrinterBindingStore.Binding endpoint, byte[] payload) {
        boolean writeStarted = false;
        final AtomicBoolean ioFinished = new AtomicBoolean(false);
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(endpoint.host, endpoint.port), LAN_CONNECT_TIMEOUT_MS);
            final ScheduledFuture<?> watchdog = timeoutExecutor.schedule(() -> {
                if (ioFinished.get()) return;
                try {
                    socket.close();
                } catch (IOException ignored) { }
            }, LAN_WRITE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            try {
                try (OutputStream output = socket.getOutputStream()) {
                    writeStarted = true;
                    output.write(payload);
                    output.flush();
                    socket.shutdownOutput();
                }
                ioFinished.set(true);
                watchdog.cancel(false);
                notifyCompletion("print.lan.dispatch.completed", requestId, "WRITE_COMPLETED_NO_DEVICE_ACK", null, null, dispatchAttemptId);
            } finally {
                ioFinished.set(true);
                watchdog.cancel(false);
            }
        } catch (IOException | RuntimeException error) {
            if (writeStarted) {
                notifyCompletion("print.lan.dispatch.completed", requestId, "OUTCOME_UNKNOWN", null,
                    "LAN_SOCKET_WRITE_TIMEOUT_OR_UNKNOWN", dispatchAttemptId);
            } else {
                notifyCompletion("print.lan.dispatch.completed", requestId, "REJECTED_BEFORE_SEND",
                    "LAN_SOCKET_CONNECT_OR_OPEN_FAILED", null, dispatchAttemptId);
            }
        }
    }

    private void notifyCompletion(String type, String requestId, String outcome, String failureCode,
                                  String uncertaintyCode, String dispatchAttemptId) {
        if (webNotifier == null) return;
        try {
            final JSONObject result = new JSONObject();
            result.put("type", type);
            result.put("requestId", requestId);
            result.put("status", "accepted");
            result.put("outcome", outcome);
            result.put("observedAt", now());
            result.put("evidenceId", "native-print:" + dispatchAttemptId);
            if (failureCode != null) result.put("failureCode", failureCode);
            if (uncertaintyCode != null) result.put("uncertaintyCode", uncertaintyCode);
            webNotifier.accept(result.toString());
        } catch (JSONException ignored) { }
    }

    private static JSONObject accepted(String type, String requestId) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("type", type);
        response.put("status", "accepted");
        response.put("state", "dispatching");
        response.put("requestId", requestId);
        return response;
    }

    private static JSONObject rejected(String requestId, String failureCode) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("type", "carrier.error");
        response.put("status", "failed");
        response.put("outcome", "REJECTED_BEFORE_SEND");
        response.put("observedAt", now());
        response.put("failureCode", failureCode == null || failureCode.trim().isEmpty() ? "NATIVE_PRINT_REJECTED" : failureCode);
        if (requestId != null && !requestId.isEmpty()) response.put("requestId", requestId);
        return response;
    }

    private static byte[] decodePayload(String base64) {
        if (base64 == null || base64.trim().isEmpty()) throw new IllegalArgumentException("NATIVE_PRINT_PAYLOAD_REQUIRED");
        final byte[] payload;
        try {
            payload = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("NATIVE_PRINT_PAYLOAD_INVALID", error);
        }
        if (payload.length < 1) throw new IllegalArgumentException("NATIVE_PRINT_PAYLOAD_REQUIRED");
        if (payload.length > MAX_PAYLOAD_BYTES) throw new IllegalArgumentException("NATIVE_PRINT_PAYLOAD_TOO_LARGE");
        return payload;
    }

    private static String now() {
        final SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new java.util.Date());
    }

    public void close() {
        ioExecutor.shutdownNow();
        for (ExecutorService executor : lanPrintExecutors.values()) executor.shutdownNow();
        lanPrintExecutors.clear();
        timeoutExecutor.shutdownNow();
        try {
            InnerPrinterManager.getInstance().unBindService(appContext, sunmiPrinterCallback);
        } catch (InnerPrinterException | RuntimeException ignored) { }
        sunmiPrinterService = null;
        sunmiBindingAvailable = false;
    }


}
