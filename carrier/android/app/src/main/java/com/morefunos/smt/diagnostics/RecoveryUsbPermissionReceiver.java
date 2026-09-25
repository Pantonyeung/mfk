package com.morefunos.smt.diagnostics;

import android.annotation.SuppressLint;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import org.json.JSONException;
import org.json.JSONObject;

@SuppressLint("ApplySharedPref")
public final class RecoveryUsbPermissionReceiver extends BroadcastReceiver {
    private static final String PREFS = "morefun_recovery_usb";
    private static final String KEY_LAST = "last_permission_result";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null || !RecoveryUsbPrinter.ACTION_USB_PERMISSION.equals(intent.getAction())) return;
        @SuppressWarnings("deprecation")
        final UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
        final boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
        final JSONObject result = new JSONObject();
        try {
            result.put("event", "USB_PERMISSION");
            result.put("timestampMs", System.currentTimeMillis());
            result.put("granted", granted);
            result.put("deviceName", device == null ? JSONObject.NULL : device.getDeviceName());
            result.put("vendorId", device == null ? JSONObject.NULL : device.getVendorId());
            result.put("productId", device == null ? JSONObject.NULL : device.getProductId());
        } catch (JSONException ignored) { }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST, result.toString())
            .commit();
    }
}
