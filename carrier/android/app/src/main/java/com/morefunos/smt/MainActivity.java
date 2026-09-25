package com.morefunos.smt;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.morefunos.smt.diagnostics.CarrierRecoveryActivity;
import com.morefunos.smt.runtime.RuntimeReleaseStore;
import com.morefunos.smt.print.gateway.NativePrintGatewayService;
import com.morefunos.smt.storekernel.StoreKernelBridgeController;
import com.morefunos.smt.storekernel.StoreKernelContract;
import com.morefunos.smt.smm.SmmLanHost;
import com.morefunos.smt.smm.SmmTrustedDeviceStore;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public final class MainActivity extends Activity {
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String BRIDGE_NAME = "moreFunNative";
    private static final String EMPTY_RUNTIME_DIRECTORY = "runtime/empty";
    private static final String RUNTIME_ENTRY = "/runtime/index.html";
    private static final String BASELINE_ENTRY = "/baseline/index.html";
    private static final int BRIDGE_VERSION = 1;
    private static final int RECOVERY_TAP_COUNT = 5;
    private static final long RECOVERY_TAP_WINDOW_MS = 3_000L;
    private static final float RECOVERY_HOTSPOT_DP = 72f;

    private WebView webView;
    private RuntimeReleaseStore runtimeReleaseStore;
    private RuntimeReleaseStore.BootSelection bootSelection;
    private CarrierCommandController carrierCommands;
    private PrintCommandController printCommands;
    private StoreKernelBridgeController storeKernelCommands;
    private SmmLanHost smmLanHost;
    private SmmTrustedDeviceStore smmTrustedDevices;
    private NativePrintGatewayService printGateway;
    private boolean printGatewayBound;
    private final ServiceConnection printGatewayConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            final NativePrintGatewayService.LocalBinder binder = (NativePrintGatewayService.LocalBinder) service;
            printGateway = binder.service();
            printGateway.setNotifier(MainActivity.this::postTrustedWebMessage);
            printGatewayBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printGatewayBound = false;
            printGateway = null;
        }
    };
    private FrontlineFaultJournal faultJournal;
    private Thread.UncaughtExceptionHandler previousUncaughtExceptionHandler;
    private boolean destroying;
    private long recoveryTapWindowStartedAtMs;
    private int recoveryTapCounter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            showFatal("NATIVE_WEB_MESSAGE_LISTENER_UNSUPPORTED");
            return;
        }

        faultJournal = new FrontlineFaultJournal(this);
        previousUncaughtExceptionHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            if (faultJournal != null) {
                final JSONObject detail = new JSONObject();
                try {
                    detail.put("thread", thread == null ? "" : thread.getName());
                    detail.put("exceptionClass", error == null ? "" : error.getClass().getName());
                    detail.put("stack", error == null ? "" : android.util.Log.getStackTraceString(error));
                } catch (JSONException ignored) { }
                faultJournal.record("ANDROID", "UNCAUGHT_EXCEPTION", error == null ? "" : error.getMessage(), detail);
            }
            if (previousUncaughtExceptionHandler != null) previousUncaughtExceptionHandler.uncaughtException(thread, error);
        });
        runtimeReleaseStore = new RuntimeReleaseStore(this);
        try {
            bootSelection = runtimeReleaseStore.prepareBoot();
        } catch (IOException error) {
            final String code = error.getMessage();
            showFatal(code == null || code.trim().isEmpty() ? "NATIVE_RUNTIME_STATE_UNAVAILABLE" : code);
            return;
        }
        recordBootFallback();

        final File runtimeDirectory = bootSelection == null || bootSelection.packagedBaseline()
            ? new File(getFilesDir(), EMPTY_RUNTIME_DIRECTORY)
            : bootSelection.directory;
        if (!runtimeDirectory.exists() && !runtimeDirectory.mkdirs()) {
            showFatal("NATIVE_RUNTIME_DIRECTORY_UNAVAILABLE");
            return;
        }

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/runtime/", new WebViewAssetLoader.InternalStoragePathHandler(this, runtimeDirectory))
            .addPathHandler("/baseline/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        configureWebView(webView, assetLoader);
        setContentView(webView);
        applyImmersiveMode();

        carrierCommands = new CarrierCommandController(this, () -> {
            final WebView current = webView;
            if (current != null) current.post(this::recreate);
        }, this::postTrustedWebMessage);
        printCommands = new PrintCommandController(this, this::postTrustedWebMessage);
        try {
            storeKernelCommands = StoreKernelBridgeController.open(this, this::postTrustedWebMessage);
        } catch (RuntimeException error) {
            if (faultJournal != null) {
                faultJournal.record("STORE_KERNEL", "STORE_KERNEL_INITIALIZATION_FAILED", error.getMessage(), null);
            }
        }
        bindService(
            new Intent(this, NativePrintGatewayService.class),
            printGatewayConnection,
            Context.BIND_AUTO_CREATE
        );
        registerNativeMessageBridge(webView);
        smmTrustedDevices = new SmmTrustedDeviceStore(this);
        smmLanHost = new SmmLanHost(smmTrustedDevices, this::forwardSmmLanMessage);
        try {
            smmLanHost.start();
        } catch (IOException error) {
            if (faultJournal != null) faultJournal.record("SMM_LAN", "SMM_LAN_HOST_START_FAILED", error.getMessage(), null);
        }
        webView.loadUrl(startUrl());
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveMode();
        ensureCanonicalRuntimeNavigation();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveMode();
    }

    private void ensureCanonicalRuntimeNavigation() {
        if (destroying || webView == null) return;
        final String currentUrl = webView.getUrl();
        if (currentUrl == null || currentUrl.trim().isEmpty()) return;
        if (!isCanonicalStartUri(Uri.parse(currentUrl))) webView.loadUrl(startUrl());
    }

    private boolean isCanonicalStartUri(Uri current) {
        if (current == null) return false;
        final Uri expected = Uri.parse(startUrl());
        return sameValue(expected.getScheme(), current.getScheme())
            && sameValue(expected.getHost(), current.getHost())
            && expected.getPort() == current.getPort()
            && sameValue(expected.getPath(), current.getPath())
            && sameValue(expected.getQueryParameter("releaseId"), current.getQueryParameter("releaseId"))
            && sameValue(expected.getQueryParameter("runtimeVersion"), current.getQueryParameter("runtimeVersion"))
            && sameValue(expected.getQueryParameter("runtimeChannel"), current.getQueryParameter("runtimeChannel"))
            && sameValue(expected.getQueryParameter("devProfile"), current.getQueryParameter("devProfile"));
    }

    private static boolean sameValue(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        observeRecoveryGesture(event);
        return super.dispatchTouchEvent(event);
    }

    private void observeRecoveryGesture(MotionEvent event) {
        if (event == null || event.getActionMasked() != MotionEvent.ACTION_UP) return;

        final float hotspotPx = RECOVERY_HOTSPOT_DP * getResources().getDisplayMetrics().density;
        if (event.getX() < 0f || event.getY() < 0f || event.getX() > hotspotPx || event.getY() > hotspotPx) {
            resetRecoveryGesture();
            return;
        }

        final long eventTimeMs = event.getEventTime();
        if (recoveryTapWindowStartedAtMs == 0L
            || eventTimeMs < recoveryTapWindowStartedAtMs
            || eventTimeMs - recoveryTapWindowStartedAtMs > RECOVERY_TAP_WINDOW_MS) {
            recoveryTapWindowStartedAtMs = eventTimeMs;
            recoveryTapCounter = 1;
        } else {
            recoveryTapCounter += 1;
        }

        if (recoveryTapCounter >= RECOVERY_TAP_COUNT) {
            resetRecoveryGesture();
            startActivity(new Intent(this, CarrierRecoveryActivity.class));
        }
    }

    private void resetRecoveryGesture() {
        recoveryTapWindowStartedAtMs = 0L;
        recoveryTapCounter = 0;
    }

    private String startUrl() {
        final Uri.Builder builder;
        if (bootSelection == null || bootSelection.packagedBaseline()) {
            builder = Uri.parse(APP_ORIGIN + BASELINE_ENTRY).buildUpon()
                .appendQueryParameter("runtimeVersion", RuntimeReleaseStore.PACKAGED_BASELINE_VERSION)
                .appendQueryParameter("runtimeChannel", "stable");
        } else {
            builder = Uri.parse(APP_ORIGIN + RUNTIME_ENTRY).buildUpon()
                .appendQueryParameter("releaseId", bootSelection.releaseId)
                .appendQueryParameter("runtimeVersion", bootSelection.releaseId)
                .appendQueryParameter("runtimeChannel", bootSelection.candidateBoot ? "candidate" : "stable");
        }
        if (BuildConfig.DEBUG) builder.appendQueryParameter("devProfile", "AUTH_DEFERRED");
        return builder.build().toString();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView view, WebViewAssetLoader assetLoader) {
        final WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                if (message != null && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR && faultJournal != null) {
                    final JSONObject detail = new JSONObject();
                    try {
                        detail.put("lineNumber", message.lineNumber());
                        detail.put("sourceId", message.sourceId());
                    } catch (JSONException ignored) { }
                    faultJournal.record("WEBVIEW_CONSOLE", "JS_CONSOLE_ERROR", message.message(), detail);
                }
                return super.onConsoleMessage(message);
            }
        });

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView webView, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                return !isTrustedAppUri(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView webView, String url) {
                return !isTrustedAppUri(Uri.parse(url));
            }

            @Override
            public void onReceivedError(WebView webView, WebResourceRequest request, WebResourceError error) {
                if (faultJournal != null && request != null && request.isForMainFrame()) {
                    final JSONObject detail = new JSONObject();
                    try {
                        detail.put("url", request.getUrl() == null ? "" : request.getUrl().toString());
                        detail.put("errorCode", error == null ? 0 : error.getErrorCode());
                    } catch (JSONException ignored) { }
                    faultJournal.record("WEBVIEW", "MAIN_FRAME_LOAD_ERROR", error == null ? "" : String.valueOf(error.getDescription()), detail);
                }
                super.onReceivedError(webView, request, error);
            }

            @Override
            @androidx.annotation.RequiresApi(api = Build.VERSION_CODES.O)
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (faultJournal != null) {
                    final JSONObject faultDetail = new JSONObject();
                    try {
                        faultDetail.put("didCrash", detail != null && detail.didCrash());
                        faultDetail.put("rendererPriorityAtExit", detail == null ? -1 : detail.rendererPriorityAtExit());
                        faultDetail.put("url", view == null || view.getUrl() == null ? "" : view.getUrl());
                    } catch (JSONException ignored) { }
                    faultJournal.record(
                        "WEBVIEW",
                        detail != null && detail.didCrash() ? "WEBVIEW_RENDERER_CRASH" : "WEBVIEW_RENDERER_KILLED",
                        "WebView renderer process terminated",
                        faultDetail
                    );
                }
                if (view != null) {
                    final android.view.ViewParent parent = view.getParent();
                    if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(view);
                    view.destroy();
                    if (webView == view) webView = null;
                }
                if (!destroying) {
                    final String code = detail != null && detail.didCrash() ? "WEBVIEW_RENDERER_CRASH" : "WEBVIEW_RENDERER_KILLED";
                    runOnUiThread(() -> showNativeFaultScreen(code));
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView webView, String url) {
                if (destroying) return;
                final Uri current = Uri.parse(url == null ? "" : url);
                if (!isCanonicalStartUri(current)) webView.loadUrl(startUrl());
            }
        });
    }

    @SuppressLint("RequiresFeature")
    private void registerNativeMessageBridge(WebView view) {
        WebViewCompat.addWebMessageListener(
            view,
            BRIDGE_NAME,
            Collections.singleton(APP_ORIGIN),
            new WebViewCompat.WebMessageListener() {
                @Override
                public void onPostMessage(WebView webView, WebMessageCompat message, Uri sourceOrigin,
                                          boolean isMainFrame, JavaScriptReplyProxy replyProxy) {
                    if (!isMainFrame || !isTrustedAppUri(sourceOrigin)) {
                        replyProxy.postMessage(errorResponse(null, "NATIVE_MESSAGE_ORIGIN_REJECTED"));
                        return;
                    }
                    replyProxy.postMessage(handleBridgeMessage(message.getData()));
                }
            }
        );
    }

    private String forwardSmmLanMessage(String deviceId, String rawPayload) {
        final WebView current=webView;
        if(current==null)return errorResponse(null,"SMM_RUNTIME_UNAVAILABLE");
        final CountDownLatch latch=new CountDownLatch(1);
        final AtomicReference<String> result=new AtomicReference<>();
        final String script="window.__MFK_SMM_LAN_HANDLE__?window.__MFK_SMM_LAN_HANDLE__("
            +JSONObject.quote(deviceId)+","+JSONObject.quote(rawPayload)+"):null";
        current.post(()->current.evaluateJavascript(script,value->{
            try{
                if(value!=null&&!"null".equals(value)){
                    final org.json.JSONArray wrapper=new org.json.JSONArray("["+value+"]");
                    result.set(wrapper.optString(0,null));
                }
            }catch(JSONException ignored){}
            latch.countDown();
        }));
        try{
            if(!latch.await(4,TimeUnit.SECONDS))return errorResponse(null,"SMM_RUNTIME_TIMEOUT");
        }catch(InterruptedException error){
            Thread.currentThread().interrupt();
            return errorResponse(null,"SMM_RUNTIME_INTERRUPTED");
        }
        final String response=result.get();
        return response==null||response.trim().isEmpty()?errorResponse(null,"SMM_RUNTIME_NO_RESPONSE"):response;
    }

    private String handleBridgeMessage(String rawMessage) {
        String requestId = null;
        try {
            final JSONObject request = new JSONObject(rawMessage == null ? "{}" : rawMessage);
            requestId = request.optString("requestId", "").trim();
            final String type = request.optString("type", "").trim();
            if (StoreKernelContract.isStoreKernelType(type) || type.startsWith("store.kernel.")) {
                if (storeKernelCommands == null) return errorResponse(requestId, "STORE_KERNEL_UNAVAILABLE");
                return storeKernelCommands.handle(rawMessage);
            }
            if ("runtime.ready".equals(type)) return handleRuntimeReady(request, requestId).toString();
            if ("diagnostics.action.record".equals(type)) {
                if (faultJournal != null) faultJournal.setLastAction(request.optString("action", ""), request.optString("route", ""));
                return acceptedResponse("diagnostics.action.record.result", requestId).toString();
            }
            if ("diagnostics.fault.record".equals(type)) {
                final JSONObject fault = request.optJSONObject("fault");
                if (faultJournal != null && fault != null) {
                    final JSONObject detail = new JSONObject();
                    try {
                        detail.put("port", fault.optString("port", "SMT"));
                        detail.put("route", fault.optString("route", ""));
                        detail.put("stack", fault.optString("stack", ""));
                    } catch (JSONException ignored) { }
                    faultJournal.record(
                        fault.optString("source", "BROWSER"),
                        fault.optString("code", "JS_RUNTIME_FAULT"),
                        fault.optString("message", ""),
                        detail
                    );
                }
                return acceptedResponse("diagnostics.fault.record.result", requestId).toString();
            }
            if ("diagnostics.faults.read".equals(type)) {
                final JSONObject response = acceptedResponse("diagnostics.faults.read.result", requestId);
                response.put("value", faultJournal == null ? new org.json.JSONArray() : faultJournal.readRecent());
                return response.toString();
            }
            if ("carrier.health".equals(type)
                || "runtime.update.endpoint.test".equals(type)
                || "runtime.update.endpoint.apply".equals(type)
                || "runtime.update.endpoint.previous".equals(type)
                || "runtime.update.endpoint.default".equals(type)
                || "runtime.update.check".equals(type)
                || "runtime.update.download".equals(type)
                || "runtime.update.activate".equals(type)
                || "runtime.rollback".equals(type)) {
                if (carrierCommands == null) return errorResponse(requestId, "CARRIER_CONTROLLER_UNAVAILABLE");
                final JSONObject response = carrierCommands.handle(request);
                if ("carrier.health".equals(type)) putBootRuntimeInfo(response);
                return response.toString();
            }
            if ("print.gateway.enqueue".equals(type)
                || "print.gateway.snapshot".equals(type)) {
                if (!printGatewayBound || printGateway == null) return errorResponse(requestId, "PRINT_GATEWAY_UNAVAILABLE");
                return printGateway.handle(request).toString();
            }
            if ("print.sunmi.dispatch".equals(type)
                || "print.lan.dispatch".equals(type)
                || "print.lan.endpoint.apply".equals(type)
                || "print.lan.endpoint.test".equals(type)
                || "print.lan.endpoint.probe".equals(type)
                || "print.sunmi.test".equals(type)) {
                if (printCommands == null) return errorResponse(requestId, "PRINT_CONTROLLER_UNAVAILABLE");
                return printCommands.handle(request).toString();
            }
            return errorResponse(requestId.isEmpty() ? null : requestId, "NATIVE_CAPABILITY_UNSUPPORTED");
        } catch (JSONException error) {
            if (faultJournal != null) faultJournal.record("NATIVE_BRIDGE", "NATIVE_MESSAGE_INVALID", error.getMessage(), null);
            return errorResponse(requestId, "NATIVE_MESSAGE_INVALID");
        } catch (IOException | IllegalArgumentException | IllegalStateException error) {
            final String code = error.getMessage() == null ? "NATIVE_CAPABILITY_FAILED" : error.getMessage();
            if (faultJournal != null) faultJournal.record("NATIVE_BRIDGE", code, error.getClass().getSimpleName(), null);
            return errorResponse(requestId, code);
        }
    }

    private JSONObject handleRuntimeReady(JSONObject request, String requestId) throws JSONException {
        if (request.optInt("bridgeVersion", -1) != BRIDGE_VERSION) return errorObject(requestId, "RUNTIME_BRIDGE_INCOMPATIBLE");
        final String releaseId = request.optString("releaseId", "").trim();
        if (bootSelection != null && bootSelection.candidateBoot) {
            if (releaseId.isEmpty()) return errorObject(requestId, "RUNTIME_READY_RELEASE_REQUIRED");
            try {
                runtimeReleaseStore.confirmRuntimeReady(releaseId);
                bootSelection = runtimeReleaseStore.prepareBoot();
            } catch (IOException | IllegalArgumentException error) {
                return errorObject(requestId, "RUNTIME_READY_REJECTED");
            }
        }
        final JSONObject response = acceptedResponse("runtime.ready.result", requestId);
        response.put("bridgeVersion", BRIDGE_VERSION);
        if (!releaseId.isEmpty()) response.put("releaseId", releaseId);
        return response;
    }

    private void putBootRuntimeInfo(JSONObject response) throws JSONException {
        if (bootSelection == null) return;
        if (bootSelection.releaseId == null) response.put("bootedReleaseId", JSONObject.NULL);
        else response.put("bootedReleaseId", bootSelection.releaseId);
        response.put("bootedRuntimeVersion", bootSelection.runtimeVersion());
        response.put("bootedRuntimeChannel", bootSelection.candidateBoot ? "candidate" : "stable");
        if (bootSelection.fallbackReason != null) response.put("runtimeFallbackReason", bootSelection.fallbackReason);
    }

    private void recordBootFallback() {
        if (faultJournal == null || bootSelection == null || bootSelection.fallbackReason == null) return;
        final JSONObject detail = new JSONObject();
        try {
            detail.put("fallbackReason", bootSelection.fallbackReason);
            detail.put("bootedRuntimeVersion", bootSelection.runtimeVersion());
            if (bootSelection.releaseId == null) detail.put("bootedReleaseId", JSONObject.NULL);
            else detail.put("bootedReleaseId", bootSelection.releaseId);
            if (bootSelection.rejectedReleaseId != null) {
                detail.put("rejectedReleaseId", bootSelection.rejectedReleaseId);
            }
        } catch (JSONException ignored) { }
        faultJournal.record("CARRIER", "RUNTIME_BOOT_FALLBACK", bootSelection.fallbackReason, detail);
    }

    @SuppressLint("RequiresFeature")
    private void postTrustedWebMessage(String json) {
        final WebView current = webView;
        if (current == null || !WebViewFeature.isFeatureSupported(WebViewFeature.POST_WEB_MESSAGE)) return;
        current.post(() -> {
            try { WebViewCompat.postWebMessage(current, new WebMessageCompat(json), Uri.parse(APP_ORIGIN)); }
            catch (RuntimeException error) {
                if (faultJournal != null) faultJournal.record("NATIVE_TO_WEB", "POST_WEB_MESSAGE_FAILED", error.getMessage(), null);
            }
        });
    }

    private static JSONObject acceptedResponse(String type, String requestId) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("type", type);
        response.put("status", "accepted");
        if (requestId != null && !requestId.isEmpty()) response.put("requestId", requestId);
        return response;
    }

    private static JSONObject errorObject(String requestId, String errorCode) throws JSONException {
        final JSONObject response = new JSONObject();
        response.put("type", "carrier.error");
        response.put("status", "failed");
        response.put("errorCode", errorCode == null || errorCode.trim().isEmpty() ? "NATIVE_CAPABILITY_FAILED" : errorCode);
        if (requestId != null && !requestId.isEmpty()) response.put("requestId", requestId);
        return response;
    }

    private static String errorResponse(String requestId, String errorCode) {
        try { return errorObject(requestId, errorCode).toString(); }
        catch (JSONException impossible) {
            return "{\"type\":\"carrier.error\",\"status\":\"failed\",\"errorCode\":\"NATIVE_RESPONSE_ENCODING_FAILED\"}";
        }
    }

    private static boolean isTrustedAppUri(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void applyImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            final WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            }
            return;
        }
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @SuppressLint("SetTextI18n")
    private void showNativeFaultScreen(String code) {
        final LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(32, 32, 32, 32);

        final TextView title = new TextView(this);
        title.setText("SMT 發生故障，但已截住");
        title.setTextSize(22f);
        content.addView(title);

        final TextView summary = new TextView(this);
        summary.setText("故障代碼：" + code + "\n以下係最近持久故障 JSON。");
        summary.setTextSize(16f);
        summary.setPadding(0, 20, 0, 20);
        content.addView(summary);

        final Button retry = new Button(this);
        retry.setText("重新載入 App");
        retry.setOnClickListener(view -> recreate());
        content.addView(retry);

        final Button recovery = new Button(this);
        recovery.setText("打開 Recovery / 診斷工具");
        recovery.setOnClickListener(view -> startActivity(new Intent(this, CarrierRecoveryActivity.class)));
        content.addView(recovery);

        final TextView json = new TextView(this);
        final String faultJson = faultJournal == null ? "[]" : faultJournal.readRecent().toString();
        json.setText(faultJson);
        json.setTextIsSelectable(true);
        json.setTextSize(13f);
        json.setPadding(0, 24, 0, 24);
        content.addView(json);

        final ScrollView scroll = new ScrollView(this);
        scroll.addView(content);
        setContentView(scroll);
        applyImmersiveMode();
    }

    private void showFatal(String code) {
        if (faultJournal != null) faultJournal.record("CARRIER", code, "Fatal carrier state", null);
        showNativeFaultScreen(code);
    }

    @Override
    protected void onDestroy() {
        destroying = true;
        resetRecoveryGesture();
        if (printGatewayBound) {
            try { unbindService(printGatewayConnection); }
            catch (IllegalArgumentException ignored) { }
        }
        printGatewayBound = false;
        printGateway = null;
        if (printCommands != null) printCommands.close();
        printCommands = null;
        if (carrierCommands != null) carrierCommands.close();
        carrierCommands = null;
        if (smmLanHost != null) smmLanHost.close();
        smmLanHost = null;
        smmTrustedDevices = null;
        if (storeKernelCommands != null) storeKernelCommands.close();
        storeKernelCommands = null;
        if (webView != null) webView.destroy();
        webView = null;
        if (Thread.getDefaultUncaughtExceptionHandler() != previousUncaughtExceptionHandler) {
            Thread.setDefaultUncaughtExceptionHandler(previousUncaughtExceptionHandler);
        }
        previousUncaughtExceptionHandler = null;
        super.onDestroy();
    }
}
