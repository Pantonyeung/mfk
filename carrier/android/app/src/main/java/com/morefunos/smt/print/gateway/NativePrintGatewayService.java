package com.morefunos.smt.print.gateway;

import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.IBinder;
import android.util.Base64;

import com.morefunos.smt.PrintCommandController;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.function.Consumer;

public final class NativePrintGatewayService extends Service {
    public final class LocalBinder extends Binder {
        public NativePrintGatewayService service() {
            return NativePrintGatewayService.this;
        }
    }

    private final IBinder binder = new LocalBinder();
    private PrintGatewayStore store;
    private PrintCommandController driver;
    private volatile Consumer<String> notifier;

    @Override
    public void onCreate() {
        super.onCreate();
        store = new PrintGatewayStore(this);
        driver = new PrintCommandController(this, this::onDriverEvent);
        recoverDurableQueue();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    public void setNotifier(Consumer<String> notifier) {
        this.notifier = notifier;
    }

    public JSONObject handle(JSONObject request) throws JSONException {
        final String type = request.optString("type", "").trim();
        final String requestId = request.optString("requestId", "").trim();
        if (requestId.isEmpty()) return rejected(null, "PRINT_GATEWAY_REQUEST_ID_REQUIRED");

        if ("print.gateway.snapshot".equals(type)) return snapshot(requestId);
        if ("print.gateway.enqueue".equals(type)) return enqueue(requestId, request);
        return rejected(requestId, "PRINT_GATEWAY_CAPABILITY_UNSUPPORTED");
    }

    private JSONObject snapshot(String requestId) throws JSONException {
        final JSONObject response = accepted("print.gateway.snapshot.result", requestId);
        response.put("serviceReady", driver != null && store != null);
        response.put("value", store == null ? JSONObject.NULL : store.latestSnapshot());
        return response;
    }

    private JSONObject enqueue(String requestId, JSONObject request) throws JSONException {
        if (driver == null || store == null) return rejected(requestId, "PRINT_GATEWAY_UNAVAILABLE");

        final String canonicalPrintJobId = request.optString("canonicalPrintJobId", "").trim();
        final String dispatchAttemptId = request.optString("dispatchAttemptId", "").trim();
        final String payloadBase64 = request.optString("payloadBase64", "").trim();
        final JSONObject target = request.optJSONObject("target");
        if (canonicalPrintJobId.isEmpty()) return rejected(requestId, "PRINT_GATEWAY_CANONICAL_JOB_REQUIRED");
        if (dispatchAttemptId.isEmpty()) return rejected(requestId, "PRINT_GATEWAY_ATTEMPT_REQUIRED");
        if (payloadBase64.isEmpty()) return rejected(requestId, "PRINT_GATEWAY_PAYLOAD_REQUIRED");
        if (target == null) return rejected(requestId, "PRINT_TARGET_INVALID");

        final byte[] payload;
        try {
            payload = Base64.decode(payloadBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            return rejected(requestId, "PRINT_GATEWAY_PAYLOAD_INVALID");
        }
        if (payload.length < 1) return rejected(requestId, "PRINT_GATEWAY_PAYLOAD_REQUIRED");

        final String localJobId = "pgw-" + UUID.randomUUID();
        final String now = now();
        try {
            store.insert(
                localJobId,
                canonicalPrintJobId,
                dispatchAttemptId,
                target,
                payloadBase64,
                sha256(payload),
                now
            );
        } catch (RuntimeException error) {
            return rejected(requestId, "PRINT_GATEWAY_QUEUE_PERSIST_FAILED");
        }

        return dispatchPersisted(
            requestId,
            localJobId,
            canonicalPrintJobId,
            dispatchAttemptId,
            target,
            payloadBase64
        );
    }

    private JSONObject dispatchPersisted(
        String requestId,
        String localJobId,
        String canonicalPrintJobId,
        String dispatchAttemptId,
        JSONObject target,
        String payloadBase64
    ) throws JSONException {
        final String kind = target.optString("kind", "").trim();
        if ("LAN".equals(kind)) {
            final String endpointId = target.optString("endpointId", "").trim();
            if (endpointId.isEmpty()) {
                store.update(dispatchAttemptId, "FAILED_BEFORE_SEND", "TARGET_RESOLVED", "PRINT_TARGET_INVALID", now(), true);
                return rejected(requestId, "PRINT_TARGET_INVALID");
            }

            final JSONObject dispatch = new JSONObject();
            dispatch.put("type", "print.lan.dispatch");
            dispatch.put("requestId", requestId);
            dispatch.put("dispatchAttemptId", dispatchAttemptId);
            dispatch.put("endpointId", endpointId);
            dispatch.put("payloadBase64", payloadBase64);
            store.update(dispatchAttemptId, "DISPATCHING", "CONNECTING", null, now(), false);
            final JSONObject accepted = driver.handle(dispatch);
            if ("failed".equals(accepted.optString("status"))) {
                final String code = accepted.optString("failureCode", "PRINT_CONNECT_FAILED");
                store.update(dispatchAttemptId, "FAILED_BEFORE_SEND", "CONNECTING", code, now(), true);
                return rejected(requestId, code);
            }
            return gatewayAccepted(requestId, localJobId, canonicalPrintJobId, dispatchAttemptId);
        }

        if ("SUNMI_INTERNAL".equals(kind)) {
            final JSONObject dispatch = new JSONObject();
            dispatch.put("type", "print.sunmi.dispatch");
            dispatch.put("requestId", requestId);
            dispatch.put("dispatchAttemptId", dispatchAttemptId);
            dispatch.put("payloadBase64", payloadBase64);
            store.update(dispatchAttemptId, "DISPATCHING", "TARGET_RESOLVED", null, now(), false);
            final JSONObject accepted = driver.handle(dispatch);
            if ("failed".equals(accepted.optString("status"))) {
                final String code = accepted.optString("failureCode", "PRINT_SUNMI_UNAVAILABLE");
                store.update(dispatchAttemptId, "FAILED_BEFORE_SEND", "TARGET_RESOLVED", code, now(), true);
                return rejected(requestId, code);
            }
            return gatewayAccepted(requestId, localJobId, canonicalPrintJobId, dispatchAttemptId);
        }

        store.update(dispatchAttemptId, "FAILED_BEFORE_SEND", "TARGET_RESOLVED", "PRINT_TARGET_INVALID", now(), true);
        return rejected(requestId, "PRINT_TARGET_INVALID");
    }

    private void recoverDurableQueue() {
        if (store == null || driver == null) return;
        try {
            final JSONArray jobs = store.recoverableJobs();
            for (int index = 0; index < jobs.length(); index += 1) {
                final JSONObject job = jobs.optJSONObject(index);
                if (job == null) continue;
                final String attemptId = job.optString("dispatchAttemptId", "").trim();
                if (attemptId.isEmpty()) continue;
                final String state = job.optString("state", "").trim();
                if ("DISPATCHING".equals(state)) {
                    store.update(
                        attemptId,
                        "AMBIGUOUS_AFTER_SEND",
                        job.optString("lastStage", "WRITE_STARTED"),
                        "PRINT_GATEWAY_PROCESS_RESTART_OUTCOME_UNKNOWN",
                        now(),
                        true
                    );
                    continue;
                }
                if (!"PERSISTED".equals(state)) continue;
                final String payloadBase64 = job.optString("payloadBase64", "").trim();
                final JSONObject target = job.optJSONObject("target");
                if (payloadBase64.isEmpty() || target == null) {
                    store.update(
                        attemptId,
                        "FAILED_BEFORE_SEND",
                        "PERSISTED",
                        "PRINT_GATEWAY_RECOVERY_PAYLOAD_INVALID",
                        now(),
                        true
                    );
                    continue;
                }
                dispatchPersisted(
                    "recovery-" + UUID.randomUUID(),
                    job.optString("localJobId", ""),
                    job.optString("canonicalPrintJobId", ""),
                    attemptId,
                    target,
                    payloadBase64
                );
            }
        } catch (JSONException | RuntimeException ignored) { }
    }

    private void onDriverEvent(String raw) {
        try {
            final JSONObject event = new JSONObject(raw == null ? "{}" : raw);
            final String attemptId = event.optString("dispatchAttemptId", "").trim();
            final String outcome = event.optString("outcome", "").trim();
            if (!attemptId.isEmpty() && !outcome.isEmpty() && store != null) {
                if ("ACKNOWLEDGED".equals(outcome)) {
                    store.update(attemptId, "ACKNOWLEDGED", "ACKNOWLEDGED", null, now(), true);
                } else if ("WRITE_COMPLETED_NO_DEVICE_ACK".equals(outcome)) {
                    store.update(attemptId, "AMBIGUOUS_AFTER_SEND", "WRITE_COMPLETED", "PRINT_DEVICE_ACK_UNAVAILABLE", now(), true);
                } else if ("REJECTED_BEFORE_SEND".equals(outcome) || "NOT_PRINTED".equals(outcome)) {
                    store.update(
                        attemptId,
                        "FAILED_BEFORE_SEND",
                        "CONNECTING",
                        event.optString("failureCode", "PRINT_CONNECT_FAILED"),
                        now(),
                        true
                    );
                } else {
                    store.update(
                        attemptId,
                        "AMBIGUOUS_AFTER_SEND",
                        "WRITE_STARTED",
                        event.optString("uncertaintyCode", "PRINT_WRITE_OUTCOME_UNKNOWN"),
                        now(),
                        true
                    );
                }
            }
        } catch (JSONException | RuntimeException ignored) { }

        final Consumer<String> current = notifier;
        if (current != null) current.accept(raw);
    }

    private static JSONObject gatewayAccepted(
        String requestId,
        String localJobId,
        String canonicalPrintJobId,
        String dispatchAttemptId
    ) throws JSONException {
        final JSONObject response = accepted("print.gateway.enqueue.result", requestId);
        response.put("localJobId", localJobId);
        response.put("canonicalPrintJobId", canonicalPrintJobId);
        response.put("dispatchAttemptId", dispatchAttemptId);
        response.put("state", "DISPATCHING");
        return response;
    }

    private static JSONObject accepted(String type, String requestId) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("type", type);
        response.put("status", "accepted");
        response.put("requestId", requestId);
        return response;
    }

    private static JSONObject rejected(String requestId, String failureCode) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("type", "carrier.error");
        response.put("status", "failed");
        response.put("outcome", "REJECTED_BEFORE_SEND");
        response.put("observedAt", now());
        response.put("failureCode", failureCode);
        if (requestId != null && !requestId.isEmpty()) response.put("requestId", requestId);
        return response;
    }

    private static String sha256(byte[] payload) {
        try {
            final MessageDigest digest = MessageDigest.getInstance("SHA-256");
            final byte[] bytes = digest.digest(payload);
            final StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) result.append(String.format(Locale.US, "%02x", item & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("PRINT_GATEWAY_DIGEST_UNAVAILABLE", impossible);
        }
    }

    private static String now() {
        final SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new java.util.Date());
    }

    @Override
    public void onDestroy() {
        if (driver != null) driver.close();
        driver = null;
        if (store != null) store.close();
        store = null;
        notifier = null;
        super.onDestroy();
    }
}
