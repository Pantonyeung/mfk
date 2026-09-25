package com.morefunos.smt.diagnostics;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.morefunos.smt.BuildConfig;
import com.morefunos.smt.MainActivity;
import com.morefunos.smt.PrintCommandController;
import com.morefunos.smt.R;
import com.morefunos.smt.boot.BootEvidenceStore;
import com.morefunos.smt.runtime.CarrierUpdateClient;
import com.morefunos.smt.runtime.RuntimeActivationState;
import com.morefunos.smt.runtime.RuntimeBundleMetadata;
import com.morefunos.smt.runtime.RuntimeReleaseStore;
import com.morefunos.smt.runtime.RuntimeUpdateClient;
import com.morefunos.smt.runtime.RuntimeUpdateEndpointStore;
import com.morefunos.smt.runtime.CarrierUpdateEndpointStore;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@SuppressLint("SetTextI18n")
public final class CarrierRecoveryActivity extends Activity {
    private static final int BG = Color.rgb(242, 242, 247);
    private static final int CARD = Color.WHITE;
    private static final int TEXT = Color.rgb(28, 28, 30);
    private static final int MUTED = Color.rgb(99, 99, 102);

    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private RuntimeReleaseStore releaseStore;
    private RuntimeUpdateClient runtimeUpdateClient;
    private RuntimeUpdateClient.UpdateDescriptor pendingRuntimeUpdate;
    private CarrierUpdateClient carrierUpdateClient;
    private CarrierUpdateClient.Descriptor pendingCarrierUpdate;
    private PrintCommandController printCommands;
    private RecoveryUsbPrinter usbPrinter;
    private RuntimeUpdateEndpointStore runtimeEndpointStore;
    private CarrierUpdateEndpointStore carrierEndpointStore;
    private EditText runtimeOtaUrl;
    private EditText carrierOtaUrl;
    private BootEvidenceStore bootEvidenceStore;

    private TextView runtimeStatus;
    private TextView otaStatus;
    private TextView carrierStatus;
    private TextView printStatus;
    private TextView usbStatus;
    private EditText endpointId;
    private EditText displayName;
    private EditText host;
    private EditText port;
    private EditText capability;
    private EditText usbDeviceName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        releaseStore = new RuntimeReleaseStore(this);
        runtimeUpdateClient = new RuntimeUpdateClient(this);
        carrierUpdateClient = new CarrierUpdateClient(this);
        runtimeEndpointStore = new RuntimeUpdateEndpointStore(this);
        carrierEndpointStore = new CarrierUpdateEndpointStore(this);
        printCommands = new PrintCommandController(this, this::onNativePrintEvent);
        bootEvidenceStore = new BootEvidenceStore(this);
        try { usbPrinter = new RecoveryUsbPrinter(this); }
        catch (RuntimeException error) { usbPrinter = null; }
        setContentView(buildContent());
        refreshRuntimeStatus();
        refreshUsbDevices();
    }

    private View buildContent() {
        final ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);

        final LinearLayout body = vertical();
        body.setPadding(dp(28), dp(24), dp(28), dp(36));
        scroll.addView(body, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        body.addView(buildHeader());
        body.addView(buildOtaEndpointCard());
        body.addView(buildRuntimeCard());
        body.addView(buildCarrierCard());
        body.addView(buildUsbPrinterCard());
        body.addView(buildLanPrinterCard());
        body.addView(buildSunmiCard());
        return scroll;
    }

    private View buildHeader() {
        final LinearLayout card = card();
        card.addView(text("MOREFUN OS 1.0 · NATIVE RECOVERY", 13, MUTED, Typeface.BOLD));
        card.addView(text(getString(R.string.recovery_title), 30, TEXT, Typeface.BOLD));
        card.addView(text(
            "呢個入口完全獨立於 SMT WebView / Runtime。主介面死咗、Runtime 起唔到、打印鏈失效，都必須可以由 Recovery 救返。",
            16, MUTED, Typeface.NORMAL
        ));
        card.addView(button("返回 SMT", false, v -> restartMain()));
        return card;
    }

    private View buildOtaEndpointCard() {
        final LinearLayout card=card();
        card.addView(text("OTA 更新來源",22,TEXT,Typeface.BOLD));
        card.addView(text("日後 MFK OTA 地址改變，只需要喺呢度更新，唔需要為改 URL 再出 Carrier。",14,MUTED,Typeface.NORMAL));
        try {
            runtimeOtaUrl=field(card,"Runtime OTA URL","runtime-update.json",runtimeEndpointStore.effectiveEndpoint(),InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
            carrierOtaUrl=field(card,"Carrier OTA URL","carrier-update.json",carrierEndpointStore.effectiveEndpoint(),InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
        } catch(Exception error) {
            runtimeOtaUrl=field(card,"Runtime OTA URL","runtime-update.json","",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
            carrierOtaUrl=field(card,"Carrier OTA URL","carrier-update.json","",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
        }
        card.addView(button("測試 Runtime OTA URL",false,v->testRuntimeOtaUrl()));
        card.addView(button("保存 Runtime OTA URL",false,v->saveRuntimeOtaUrl()));
        card.addView(button("Runtime URL 恢復預設",false,v->restoreRuntimeOtaDefault()));
        card.addView(button("測試 Carrier OTA URL",false,v->testCarrierOtaUrl()));
        card.addView(button("保存 Carrier OTA URL",false,v->saveCarrierOtaUrl()));
        card.addView(button("Carrier URL 恢復預設",false,v->restoreCarrierOtaDefault()));
        return card;
    }

    private void testRuntimeOtaUrl(){
        otaStatusSafe("測試 Runtime OTA URL 中…");
        io.execute(()->{
            try{
                final String endpoint=runtimeEndpointStore.validateCandidate(runtimeOtaUrl.getText().toString());
                final RuntimeUpdateClient.UpdateDescriptor descriptor=runtimeUpdateClient.checkForUpdate(endpoint);
                showAsync(otaStatus,new JSONObject().put("state","reachable").put("endpoint",endpoint).put("releaseId",descriptor.releaseId).toString(2));
            }catch(Exception error){showAsync(otaStatus,jsonFailure("RUNTIME_OTA_URL_TEST_FAILED",error));}
        });
    }
    private void saveRuntimeOtaUrl(){
        try{runtimeEndpointStore.applyValidatedCandidate(runtimeOtaUrl.getText().toString());refreshOtaEndpointFields();otaStatusSafe("Runtime OTA URL 已保存");}
        catch(Exception error){otaStatusSafe(jsonFailure("RUNTIME_OTA_URL_SAVE_FAILED",error));}
    }
    private void restoreRuntimeOtaDefault(){
        try{runtimeEndpointStore.restoreDefault();refreshOtaEndpointFields();otaStatusSafe("Runtime OTA URL 已恢復預設");}
        catch(Exception error){otaStatusSafe(jsonFailure("RUNTIME_OTA_URL_DEFAULT_FAILED",error));}
    }
    private void testCarrierOtaUrl(){
        carrierStatusSafe("測試 Carrier OTA URL 中…");
        io.execute(()->{
            try{
                final String endpoint=carrierEndpointStore.validateCandidate(carrierOtaUrl.getText().toString());
                final String previous=carrierEndpointStore.effectiveEndpoint();
                carrierEndpointStore.applyValidatedCandidate(endpoint);
                try{
                    final CarrierUpdateClient.Descriptor descriptor=carrierUpdateClient.checkForUpdate();
                    showAsync(carrierStatus,new JSONObject().put("state","reachable").put("endpoint",endpoint).put("versionName",descriptor.versionName).put("versionCode",descriptor.versionCode).toString(2));
                } finally { carrierEndpointStore.applyValidatedCandidate(previous); }
            }catch(Exception error){showAsync(carrierStatus,jsonFailure("CARRIER_OTA_URL_TEST_FAILED",error));}
        });
    }
    private void saveCarrierOtaUrl(){
        try{carrierEndpointStore.applyValidatedCandidate(carrierOtaUrl.getText().toString());refreshOtaEndpointFields();carrierStatusSafe("Carrier OTA URL 已保存");}
        catch(Exception error){carrierStatusSafe(jsonFailure("CARRIER_OTA_URL_SAVE_FAILED",error));}
    }
    private void restoreCarrierOtaDefault(){
        try{carrierEndpointStore.restoreDefault();refreshOtaEndpointFields();carrierStatusSafe("Carrier OTA URL 已恢復預設");}
        catch(Exception error){carrierStatusSafe(jsonFailure("CARRIER_OTA_URL_DEFAULT_FAILED",error));}
    }
    private void refreshOtaEndpointFields(){
        try{runtimeOtaUrl.setText(runtimeEndpointStore.effectiveEndpoint());}catch(Exception ignored){}
        try{carrierOtaUrl.setText(carrierEndpointStore.effectiveEndpoint());}catch(Exception ignored){}
    }
    private void otaStatusSafe(String value){if(otaStatus!=null)otaStatus.setText(value);}
    private void carrierStatusSafe(String value){if(carrierStatus!=null)carrierStatus.setText(value);}

    private View buildRuntimeCard() {
        final LinearLayout card = card();
        card.addView(text("Runtime / OTA 救援", 22, TEXT, Typeface.BOLD));
        runtimeStatus = valueBox();
        otaStatus = valueBox();
        card.addView(runtimeStatus);
        card.addView(otaStatus);
        card.addView(button("刷新 Runtime 狀態", false, v -> refreshRuntimeStatus()));
        card.addView(button("檢查 Runtime OTA", false, v -> checkRuntimeUpdate()));
        card.addView(button("下載／驗證／啟用 Runtime OTA", true, v -> installRuntimeUpdate()));
        card.addView(button("回滾上一個 Runtime", false, v -> rollbackRuntime()));
        card.addView(button("回到 APK 內建安全版本", false, v -> confirmResetToPackagedBaseline()));
        card.addView(text(
            "Runtime OTA 直接由 Native Recovery 執行，唔需要先入 SMT 主介面。",
            14, MUTED, Typeface.NORMAL
        ));
        return card;
    }

    private View buildCarrierCard() {
        final LinearLayout card = card();
        card.addView(text("Carrier / APK 更新", 22, TEXT, Typeface.BOLD));
        carrierStatus = valueBox();
        card.addView(carrierStatus);
        card.addView(button("檢查 Carrier APK 更新", false, v -> checkCarrierUpdate()));
        card.addView(button("下載／驗證／安裝 Carrier APK", true, v -> installCarrierUpdate()));
        card.addView(text(
            "APK 必須同 package、簽章、SHA-256 一致；Android 系統安裝確認仍然保留，Recovery 唔會繞過平台安全。",
            14, MUTED, Typeface.NORMAL
        ));
        return card;
    }

    private View buildUsbPrinterCard() {
        final LinearLayout card = card();
        card.addView(text("USB 打印救援", 22, TEXT, Typeface.BOLD));
        card.addView(text(
            "直接檢查 Android USB host、permission、bulk-out endpoint，同埋真實傳送測試 bytes。呢度只做硬件救援測試，唔建立第二套 Print Core。",
            14, MUTED, Typeface.NORMAL
        ));
        usbDeviceName = field(card, "USB deviceName", "留空時只插一部 USB 裝置可自動選取", "", InputType.TYPE_CLASS_TEXT);
        usbStatus = valueBox();
        usbStatus.setText("等待 USB 掃描");
        card.addView(usbStatus);
        card.addView(button("刷新 USB 裝置", false, v -> refreshUsbDevices()));
        card.addView(button("USB 授權", false, v -> requestUsbPermission()));
        card.addView(button("檢查 USB 通道", false, v -> probeUsbPrinter()));
        card.addView(button("USB 試打小票", true, v -> testUsbReceipt()));
        card.addView(button("USB 試打 Label", true, v -> testUsbLabel()));
        return card;
    }

    private View buildLanPrinterCard() {
        final LinearLayout card = card();
        card.addView(text("LAN 打印機測試", 22, TEXT, Typeface.BOLD));
        endpointId = field(card, "Endpoint ID", "例如 kitchen-1", "recovery-lan-1", InputType.TYPE_CLASS_TEXT);
        displayName = field(card, "打印機名稱", "例如 製作單打印機", "Recovery LAN Printer", InputType.TYPE_CLASS_TEXT);
        host = field(card, "IP / Host", "例如 192.168.1.88", "", InputType.TYPE_CLASS_PHONE);
        port = field(card, "Port", "通常 9100", "9100", InputType.TYPE_CLASS_NUMBER);
        capability = field(card, "Capability", "receipt-80mm/kitchen 或 label", "receipt-80mm/kitchen", InputType.TYPE_CLASS_TEXT);

        printStatus = valueBox();
        printStatus.setText("等待操作");
        card.addView(printStatus);

        card.addView(button("保存 IP 設定", false, v -> applyLanEndpoint()));
        card.addView(button("測試連線", false, v -> testLanEndpoint()));
        card.addView(button("試打一張測試紙", true, v -> testLanPrint()));
        return card;
    }

    private View buildSunmiCard() {
        final LinearLayout card = card();
        card.addView(text("SUNMI 內置打印機", 22, TEXT, Typeface.BOLD));
        card.addView(button("檢查 SUNMI Printer", false, v -> testSunmiAvailability()));
        card.addView(button("SUNMI 試打一張", true, v -> testSunmiPrint()));
        return card;
    }

    private void refreshRuntimeStatus() {
        try {
            final RuntimeActivationState state = releaseStore.snapshot();
            final String boot = state.currentReleaseId == null ? "APK packaged baseline" : state.currentReleaseId;
            final JSONObject bootEvidence = bootEvidenceStore.lastBootCompleted();
            runtimeStatus.setText(
                "Carrier: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")" +
                "\nBoot Runtime: " + boot +
                "\nCurrent: " + safe(state.currentReleaseId) +
                "\nCandidate: " + safe(state.candidateReleaseId) +
                "\nPrevious: " + safe(state.previousReleaseId) +
                "\nActivation Requested: " + state.activationRequested +
                "\nCold Boot: " + (bootEvidence == null ? "未有記錄" : bootEvidence.toString())
            );
            if (carrierStatus != null && carrierStatus.getText().length() == 0) {
                carrierStatus.setText("Current Carrier " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")");
            }
        } catch (Exception error) {
            runtimeStatus.setText(jsonFailure("RUNTIME_STATUS_FAILED", error));
        }
    }

    private void checkRuntimeUpdate() {
        otaStatus.setText("檢查 Runtime OTA 中…");
        io.execute(() -> {
            try {
                final RuntimeUpdateClient.UpdateDescriptor descriptor = runtimeUpdateClient.checkForUpdate();
                pendingRuntimeUpdate = descriptor;
                showAsync(otaStatus, descriptor.toJson().put("state", "update-metadata-ready").toString(2));
            } catch (Exception error) {
                showAsync(otaStatus, jsonFailure("RUNTIME_OTA_CHECK_FAILED", error));
            }
        });
    }

    private void installRuntimeUpdate() {
        otaStatus.setText("下載／驗證 Runtime OTA 中…");
        io.execute(() -> {
            try {
                RuntimeUpdateClient.UpdateDescriptor descriptor = pendingRuntimeUpdate;
                if (descriptor == null) descriptor = runtimeUpdateClient.checkForUpdate();
                final RuntimeBundleMetadata metadata = runtimeUpdateClient.downloadAndStage(descriptor);
                pendingRuntimeUpdate = null;
                releaseStore.requestCandidateActivation();
                showAsync(otaStatus, new JSONObject()
                    .put("state", "staged-and-activation-requested")
                    .put("releaseId", metadata.releaseId)
                    .toString(2));
                runOnUiThread(this::restartMain);
            } catch (Exception error) {
                showAsync(otaStatus, jsonFailure("RUNTIME_OTA_INSTALL_FAILED", error));
            }
        });
    }

    private void rollbackRuntime() {
        try {
            final RuntimeActivationState state = releaseStore.rollback();
            otaStatus.setText(new JSONObject()
                .put("state", "rolled-back")
                .put("currentReleaseId", state.currentReleaseId)
                .toString());
            restartMain();
        } catch (Exception error) {
            otaStatus.setText(jsonFailure("RUNTIME_ROLLBACK_FAILED", error));
        }
    }

    private void checkCarrierUpdate() {
        carrierStatus.setText("檢查 Carrier APK 中…");
        io.execute(() -> {
            try {
                final CarrierUpdateClient.Descriptor descriptor = carrierUpdateClient.checkForUpdate();
                pendingCarrierUpdate = descriptor;
                final JSONObject result = descriptor.toJson()
                    .put("currentVersionCode", BuildConfig.VERSION_CODE)
                    .put("updateAvailable", descriptor.versionCode > BuildConfig.VERSION_CODE);
                showAsync(carrierStatus, result.toString(2));
            } catch (Exception error) {
                showAsync(carrierStatus, jsonFailure("CARRIER_OTA_CHECK_FAILED", error));
            }
        });
    }

    private void installCarrierUpdate() {
        carrierStatus.setText("下載／驗證 Carrier APK 中…");
        io.execute(() -> {
            try {
                CarrierUpdateClient.Descriptor descriptor = pendingCarrierUpdate;
                if (descriptor == null) descriptor = carrierUpdateClient.checkForUpdate();
                if (descriptor.versionCode <= BuildConfig.VERSION_CODE) {
                    showAsync(carrierStatus, new JSONObject()
                        .put("state", "no-newer-carrier")
                        .put("currentVersionCode", BuildConfig.VERSION_CODE)
                        .put("remoteVersionCode", descriptor.versionCode)
                        .toString(2));
                    return;
                }
                final File apk = carrierUpdateClient.downloadAndVerify(descriptor);
                carrierUpdateClient.requestInstall(apk);
                showAsync(carrierStatus, new JSONObject()
                    .put("state", "android-installer-requested")
                    .put("versionName", descriptor.versionName)
                    .put("versionCode", descriptor.versionCode)
                    .toString(2));
            } catch (Exception error) {
                if ("CARRIER_INSTALL_PERMISSION_REQUIRED".equals(error.getMessage())) {
                    runOnUiThread(() -> {
                        carrierStatus.setText(jsonFailure("CARRIER_INSTALL_PERMISSION_REQUIRED", error));
                        startActivity(carrierUpdateClient.unknownSourceSettingsIntent());
                    });
                } else {
                    showAsync(carrierStatus, jsonFailure("CARRIER_OTA_INSTALL_FAILED", error));
                }
            }
        });
    }

    private void confirmResetToPackagedBaseline() {
        new AlertDialog.Builder(this)
            .setTitle("回到 APK 內建安全版本？")
            .setMessage("只會移除已下載 Runtime release 同 activation state。登入、可信裝置、打印機綁定同其他 App data 保留。")
            .setNegativeButton("取消", null)
            .setPositiveButton("確認", (value, which) -> resetToPackagedBaseline())
            .show();
    }

    private void resetToPackagedBaseline() {
        try {
            releaseStore.resetToPackagedBaseline();
            refreshRuntimeStatus();
            restartMain();
        } catch (Exception error) {
            otaStatus.setText(jsonFailure("RUNTIME_BASELINE_RESET_FAILED", error));
        }
    }

    private void refreshUsbDevices() {
        if (usbStatus == null) return;
        try {
            if (usbPrinter == null) throw new IllegalStateException("PRINTER_USB_MANAGER_UNAVAILABLE");
            usbStatus.setText(usbPrinter.listDevices().toString(2));
        } catch (Exception error) {
            usbStatus.setText(jsonFailure("USB_LIST_FAILED", error));
        }
    }

    private void requestUsbPermission() {
        try {
            if (usbPrinter == null) throw new IllegalStateException("PRINTER_USB_MANAGER_UNAVAILABLE");
            usbStatus.setText(usbPrinter.requestPermission(usbDeviceName.getText().toString()).toString(2));
        } catch (Exception error) {
            usbStatus.setText(jsonFailure("USB_PERMISSION_FAILED", error));
        }
    }

    private void probeUsbPrinter() {
        try {
            if (usbPrinter == null) throw new IllegalStateException("PRINTER_USB_MANAGER_UNAVAILABLE");
            usbStatus.setText(usbPrinter.probe(usbDeviceName.getText().toString()).toString(2));
        } catch (Exception error) {
            usbStatus.setText(jsonFailure("USB_PROBE_FAILED", error));
        }
    }

    private void testUsbReceipt() {
        io.execute(() -> {
            try {
                if (usbPrinter == null) throw new IllegalStateException("PRINTER_USB_MANAGER_UNAVAILABLE");
                showAsync(usbStatus, usbPrinter.printReceipt(usbDeviceName.getText().toString()).toString(2));
            } catch (Exception error) {
                showAsync(usbStatus, jsonFailure("USB_RECEIPT_TEST_FAILED", error));
            }
        });
    }

    private void testUsbLabel() {
        io.execute(() -> {
            try {
                if (usbPrinter == null) throw new IllegalStateException("PRINTER_USB_MANAGER_UNAVAILABLE");
                showAsync(usbStatus, usbPrinter.printLabel(usbDeviceName.getText().toString()).toString(2));
            } catch (Exception error) {
                showAsync(usbStatus, jsonFailure("USB_LABEL_TEST_FAILED", error));
            }
        });
    }

    private void applyLanEndpoint() {
        try {
            final JSONObject request = baseRequest("print.lan.endpoint.apply")
                .put("endpointId", required(endpointId, "Endpoint ID"))
                .put("displayName", displayName.getText().toString().trim())
                .put("host", required(host, "IP / Host"))
                .put("port", parsePort())
                .put("capability", capability.getText().toString().trim());
            showPrintResponse(printCommands.handle(request));
        } catch (Exception error) {
            printStatus.setText(jsonFailure("LAN_SAVE_FAILED", error));
        }
    }

    private void testLanEndpoint() {
        try {
            final JSONObject request = baseRequest("print.lan.endpoint.test")
                .put("endpointId", required(endpointId, "Endpoint ID"));
            showPrintResponse(printCommands.handle(request));
        } catch (Exception error) {
            printStatus.setText(jsonFailure("LAN_PROBE_FAILED", error));
        }
    }

    private void testLanPrint() {
        try {
            final byte[] payload = ("\nMoreFunOS 1.0 Recovery Test\nCarrier " + BuildConfig.VERSION_NAME + "\n\n\n")
                .getBytes(StandardCharsets.UTF_8);
            final JSONObject request = baseRequest("print.lan.dispatch")
                .put("dispatchAttemptId", "recovery-" + UUID.randomUUID())
                .put("endpointId", required(endpointId, "Endpoint ID"))
                .put("payloadBase64", Base64.encodeToString(payload, Base64.NO_WRAP));
            showPrintResponse(printCommands.handle(request));
        } catch (Exception error) {
            printStatus.setText(jsonFailure("LAN_PRINT_TEST_FAILED", error));
        }
    }

    private void testSunmiAvailability() {
        try {
            showPrintResponse(printCommands.handle(baseRequest("print.sunmi.test")));
        } catch (Exception error) {
            printStatus.setText(jsonFailure("SUNMI_PROBE_FAILED", error));
        }
    }

    private void testSunmiPrint() {
        try {
            final byte[] payload = ("\nMoreFunOS 1.0 SUNMI Recovery Test\n\n\n")
                .getBytes(StandardCharsets.UTF_8);
            final JSONObject request = baseRequest("print.sunmi.dispatch")
                .put("dispatchAttemptId", "recovery-sunmi-" + UUID.randomUUID())
                .put("payloadBase64", Base64.encodeToString(payload, Base64.NO_WRAP));
            showPrintResponse(printCommands.handle(request));
        } catch (Exception error) {
            printStatus.setText(jsonFailure("SUNMI_PRINT_TEST_FAILED", error));
        }
    }

    private JSONObject baseRequest(String type) throws JSONException {
        return new JSONObject()
            .put("type", type)
            .put("requestId", "recovery-" + UUID.randomUUID());
    }

    private void onNativePrintEvent(String json) {
        runOnUiThread(() -> printStatus.setText(json));
    }

    private void showPrintResponse(JSONObject response) {
        printStatus.setText(response.toString());
    }

    private void showAsync(TextView target, String value) {
        runOnUiThread(() -> target.setText(value));
    }

    private static String jsonFailure(String code, Throwable error) {
        final JSONObject json = new JSONObject();
        try {
            json.put("status", "failed");
            json.put("errorCode", code);
            json.put("message", safeMessage(error));
            json.put("exception", error == null ? JSONObject.NULL : error.getClass().getName());
        } catch (JSONException ignored) { }
        return json.toString();
    }

    private int parsePort() {
        final int value = Integer.parseInt(required(port, "Port"));
        if (value < 1 || value > 65535) throw new IllegalArgumentException("Port 必須係 1–65535");
        return value;
    }

    private static String required(EditText field, String name) {
        final String value = field.getText().toString().trim();
        if (value.isEmpty()) throw new IllegalArgumentException(name + " 不可留空");
        return value;
    }

    private void restartMain() {
        final Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private LinearLayout card() {
        final LinearLayout card = vertical();
        card.setPadding(dp(22), dp(22), dp(22), dp(22));
        card.setBackgroundColor(CARD);
        final LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(18));
        card.setLayoutParams(params);
        return card;
    }

    private LinearLayout vertical() {
        final LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private TextView text(String value, int sp, int color, int style) {
        final TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setPadding(0, 0, 0, dp(12));
        return view;
    }

    private TextView valueBox() {
        final TextView view = text("", 15, TEXT, Typeface.NORMAL);
        view.setBackgroundColor(Color.rgb(248, 248, 250));
        view.setPadding(dp(14), dp(14), dp(14), dp(14));
        view.setTextIsSelectable(true);
        return view;
    }

    private EditText field(LinearLayout parent, String label, String hint, String value, int inputType) {
        parent.addView(text(label, 14, MUTED, Typeface.BOLD));
        final EditText input = new EditText(this);
        input.setHint(hint);
        input.setText(value);
        input.setInputType(inputType);
        input.setSingleLine(true);
        input.setTextSize(16);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        parent.addView(input, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return input;
    }

    private Button button(String label, boolean primary, View.OnClickListener listener) {
        final Button button = new Button(this);
        button.setText(label);
        button.setTextSize(16);
        button.setAllCaps(false);
        button.setOnClickListener(listener);
        if (primary) {
            button.setTextColor(Color.WHITE);
            button.setBackgroundColor(Color.rgb(0, 122, 255));
        }
        final LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(54)
        );
        params.setMargins(0, dp(6), 0, dp(6));
        button.setLayoutParams(params);
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static String safe(String value) {
        return value == null || value.trim().isEmpty() ? "—" : value;
    }

    private static String safeMessage(Throwable error) {
        if (error == null) return "UNKNOWN";
        final String value = error.getMessage();
        return value == null || value.trim().isEmpty() ? error.getClass().getSimpleName() : value;
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        if (printCommands != null) printCommands.close();
        printCommands = null;
        super.onDestroy();
    }
}
