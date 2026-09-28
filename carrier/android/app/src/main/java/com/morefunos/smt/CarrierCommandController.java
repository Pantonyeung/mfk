package com.morefunos.smt;

import android.content.Context;

import com.morefunos.smt.runtime.RuntimeActivationState;
import com.morefunos.smt.runtime.RuntimeBundleMetadata;
import com.morefunos.smt.runtime.RuntimeReleaseStore;
import com.morefunos.smt.runtime.RuntimeUpdateClient;
import com.morefunos.smt.runtime.RuntimeUpdateEndpointStore;
import com.morefunos.smt.runtime.RuntimeUpdateSelectionStore;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

public final class CarrierCommandController {
    private final RuntimeReleaseStore releaseStore;
    private final RuntimeUpdateClient updateClient;
    private final RuntimeUpdateSelectionStore updateSelection;
    private final RuntimeUpdateEndpointStore endpointStore;
    private final ExecutorService ioExecutor;
    private final Runnable restartAction;
    private final Consumer<String> webNotifier;

    public CarrierCommandController(Context context, Runnable restartAction, Consumer<String> webNotifier) {
        final Context app = context.getApplicationContext();
        this.releaseStore = new RuntimeReleaseStore(app);
        this.updateClient = new RuntimeUpdateClient(app);
        this.updateSelection = new RuntimeUpdateSelectionStore(app);
        this.endpointStore = new RuntimeUpdateEndpointStore(app);
        this.ioExecutor = Executors.newSingleThreadExecutor();
        this.restartAction = restartAction;
        this.webNotifier = webNotifier;
    }

    public JSONObject handle(JSONObject request) throws JSONException, IOException {
        final String type = request.optString("type", "").trim();
        final String requestId = request.optString("requestId", "").trim();
        final JSONObject response = new JSONObject();

        if ("carrier.health".equals(type)) {
            response.put("type", "carrier.health.result");
            response.put("status", "accepted");
            putRuntimeInfo(response);
        } else if ("runtime.update.endpoint.test".equals(type)) {
            final String endpoint = endpointStore.validateCandidate(request.optString("endpoint", ""));
            response.put("type", "runtime.update.endpoint.test.result");
            response.put("status", "accepted");
            response.put("state", "testing");
            ioExecutor.execute(() -> testEndpointInBackground(requestId, endpoint));
        } else if ("runtime.update.endpoint.apply".equals(type)) {
            endpointStore.applyValidatedCandidate(request.optString("endpoint", ""));
            response.put("type", "runtime.update.endpoint.apply.result");
            response.put("status", "accepted");
            putRuntimeInfo(response);
        } else if ("runtime.update.endpoint.previous".equals(type)) {
            endpointStore.restorePrevious();
            response.put("type", "runtime.update.endpoint.previous.result");
            response.put("status", "accepted");
            putRuntimeInfo(response);
        } else if ("runtime.update.endpoint.default".equals(type)) {
            endpointStore.restoreDefault();
            response.put("type", "runtime.update.endpoint.default.result");
            response.put("status", "accepted");
            putRuntimeInfo(response);
        } else if ("runtime.update.check".equals(type)) {
            if (!updateClient.isConfigured()) throw new IOException("RUNTIME_UPDATE_ENDPOINT_NOT_CONFIGURED");
            response.put("type", "runtime.update.check.result");
            response.put("status", "accepted");
            response.put("state", "checking");
            ioExecutor.execute(() -> checkUpdateInBackground(requestId));
        } else if ("runtime.update.download".equals(type)) {
            final String selectedReleaseId = updateSelection.selectedReleaseId();
            if (selectedReleaseId == null) throw new IOException("RUNTIME_UPDATE_DOWNLOAD_NOT_AVAILABLE");
            response.put("type", "runtime.update.download.result");
            response.put("status", "accepted");
            response.put("state", "downloading");
            ioExecutor.execute(() -> downloadUpdateInBackground(requestId, selectedReleaseId));
        } else if ("runtime.update.activate".equals(type)) {
            final RuntimeActivationState state = releaseStore.requestCandidateActivation();
            updateSelection.clear();
            response.put("type", "runtime.update.activate.result");
            response.put("status", "accepted");
            response.put("releaseId", state.candidateReleaseId);
            restartAction.run();
        } else if ("runtime.rollback".equals(type)) {
            final RuntimeActivationState state = releaseStore.rollback();
            updateSelection.clear();
            response.put("type", "runtime.rollback.result");
            response.put("status", "accepted");
            response.put("releaseId", state.currentReleaseId);
            restartAction.run();
        } else {
            throw new IOException("NATIVE_CAPABILITY_UNSUPPORTED");
        }

        if (!requestId.isEmpty()) response.put("requestId", requestId);
        return response;
    }

    private void putRuntimeInfo(JSONObject response) throws JSONException, IOException {
        final RuntimeActivationState state = releaseStore.snapshot();
        final RuntimeUpdateEndpointStore.EndpointInfo endpoint = endpointStore.endpointInfo();
        response.put("bridgeVersion", 1);
        response.put("carrierVersionCode", BuildConfig.VERSION_CODE);
        response.put("carrierVersionName", BuildConfig.VERSION_NAME);
        response.put("otaConfigured", updateClient.isConfigured());
        putNullable(response, "currentReleaseId", state.currentReleaseId);
        putNullable(response, "selectedReleaseId", updateSelection.selectedReleaseId());
        putNullable(response, "candidateReleaseId", state.candidateReleaseId);
        putNullable(response, "previousReleaseId", state.previousReleaseId);
        response.put("activeEndpoint", endpoint.activeEndpoint);
        response.put("builtInDefaultEndpoint", endpoint.builtInDefaultEndpoint);
        putNullable(response, "previousEndpoint", endpoint.previousEndpoint);
    }

    private static void putNullable(JSONObject response, String key, String value) throws JSONException {
        if (value == null || value.trim().isEmpty()) response.put(key, JSONObject.NULL);
        else response.put(key, value);
    }

    private void testEndpointInBackground(String requestId, String endpoint) {
        try {
            final RuntimeUpdateClient.UpdateDescriptor descriptor = updateClient.checkForUpdate(endpoint);
            notifyResult("runtime.update.endpoint.test.completed", requestId, "accepted", "reachable", descriptor, null);
        } catch (IOException | RuntimeException error) {
            notifyResult("runtime.update.endpoint.test.completed", requestId, "failed", "failed", null,
                error.getMessage() == null ? "RUNTIME_UPDATE_ENDPOINT_TEST_FAILED" : error.getMessage());
        }
    }

    private void checkUpdateInBackground(String requestId) {
        try {
            final RuntimeUpdateClient.UpdateDescriptor descriptor = updateClient.checkForUpdate();
            final RuntimeActivationState state = releaseStore.snapshot();
            if (descriptor.releaseId.equals(state.currentReleaseId)) {
                updateSelection.clear();
                notifyResult("runtime.update.check.completed", requestId, "accepted", "up-to-date", descriptor, null);
                return;
            }
            if (descriptor.releaseId.equals(state.candidateReleaseId)) {
                updateSelection.clear();
                notifyResult("runtime.update.check.completed", requestId, "accepted", "staged", descriptor, null);
                return;
            }
            updateSelection.select(descriptor.releaseId);
            notifyResult("runtime.update.check.completed", requestId, "accepted", "available", descriptor, null);
        } catch (IOException | RuntimeException error) {
            updateSelection.clear();
            notifyResult("runtime.update.check.completed", requestId, "failed", "failed", null,
                error.getMessage() == null ? "RUNTIME_UPDATE_CHECK_FAILED" : error.getMessage());
        }
    }

    private void downloadUpdateInBackground(String requestId, String selectedReleaseId) {
        try {
            final RuntimeUpdateClient.UpdateDescriptor descriptor = updateClient.checkForUpdate();
            if (!descriptor.releaseId.equals(selectedReleaseId)) {
                updateSelection.clear();
                notifyResult("runtime.update.download.completed", requestId, "failed", "failed", descriptor,
                    "RUNTIME_UPDATE_CHANGED_RECHECK_REQUIRED");
                return;
            }
            final RuntimeBundleMetadata metadata = updateClient.downloadAndStage(descriptor);
            updateSelection.clear();
            if (!metadata.releaseId.equals(descriptor.releaseId)) throw new IOException("RUNTIME_UPDATE_STAGE_IDENTITY_MISMATCH");
            notifyResult("runtime.update.download.completed", requestId, "accepted", "staged", descriptor, null);
        } catch (IOException | RuntimeException error) {
            notifyResult("runtime.update.download.completed", requestId, "failed", "failed", null,
                error.getMessage() == null ? "RUNTIME_UPDATE_DOWNLOAD_FAILED" : error.getMessage());
        }
    }

    private void notifyResult(String type, String requestId, String status, String state,
                              RuntimeUpdateClient.UpdateDescriptor descriptor, String errorCode) {
        if (webNotifier == null) return;
        try {
            final JSONObject result = new JSONObject();
            result.put("type", type);
            result.put("status", status);
            result.put("state", state);
            if (requestId != null && !requestId.isEmpty()) result.put("requestId", requestId);
            if (descriptor != null) result.put("update", descriptor.toJson());
            if (errorCode != null && !errorCode.isEmpty()) result.put("errorCode", errorCode);
            webNotifier.accept(result.toString());
        } catch (JSONException ignored) { }
    }

    public void close() {
        ioExecutor.shutdownNow();
    }
}
