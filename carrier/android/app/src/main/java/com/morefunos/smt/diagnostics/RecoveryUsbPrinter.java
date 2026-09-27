package com.morefunos.smt.diagnostics;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public final class RecoveryUsbPrinter {
    public static final String ACTION_USB_PERMISSION = "com.morefunos.smt.USB_PRINTER_PERMISSION";

    private static final int TIMEOUT_MS = 5_000;
    private final Context context;
    private final UsbManager manager;

    public RecoveryUsbPrinter(Context context) {
        this.context = context.getApplicationContext();
        this.manager = (UsbManager) this.context.getSystemService(Context.USB_SERVICE);
        if (manager == null) throw new IllegalStateException("PRINTER_USB_MANAGER_UNAVAILABLE");
    }

    public JSONObject listDevices() throws JSONException {
        final JSONArray devices = new JSONArray();
        for (UsbDevice device : manager.getDeviceList().values()) {
            devices.put(deviceJson(device));
        }
        return new JSONObject()
            .put("status", "accepted")
            .put("count", devices.length())
            .put("devices", devices);
    }

    public JSONObject requestPermission(String deviceName) throws IOException, JSONException {
        final UsbDevice device = requireDevice(deviceName);
        if (manager.hasPermission(device)) {
            return new JSONObject()
                .put("status", "accepted")
                .put("state", "already-granted")
                .put("device", deviceJson(device));
        }
        final Intent intent = new Intent(ACTION_USB_PERMISSION)
            .setPackage(context.getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
        final PendingIntent pending = PendingIntent.getBroadcast(context, 7001, intent, flags);
        manager.requestPermission(device, pending);
        return new JSONObject()
            .put("status", "accepted")
            .put("state", "permission-requested")
            .put("device", deviceJson(device));
    }

    public JSONObject probe(String deviceName) throws IOException, JSONException {
        final UsbDevice device = requireDevice(deviceName);
        final JSONObject result = new JSONObject()
            .put("device", deviceJson(device))
            .put("permissionGranted", manager.hasPermission(device));
        if (!manager.hasPermission(device)) {
            return result.put("status", "failed").put("errorCode", "PRINTER_USB_PERMISSION_REQUIRED");
        }
        final Selection selection = selectBulkOut(device);
        if (selection == null) {
            return result.put("status", "failed").put("errorCode", "PRINTER_USB_BULK_OUT_ENDPOINT_MISSING");
        }
        UsbDeviceConnection connection = null;
        boolean claimed = false;
        try {
            connection = manager.openDevice(device);
            if (connection == null) return result.put("status", "failed").put("errorCode", "PRINTER_USB_OPEN_FAILED");
            claimed = connection.claimInterface(selection.usbInterface, true);
            if (!claimed) return result.put("status", "failed").put("errorCode", "PRINTER_USB_CLAIM_FAILED");
            return result
                .put("status", "accepted")
                .put("delivery", "ready")
                .put("interfaceId", selection.usbInterface.getId())
                .put("endpointAddress", selection.endpoint.getAddress());
        } finally {
            if (connection != null) {
                if (claimed) connection.releaseInterface(selection.usbInterface);
                connection.close();
            }
        }
    }

    public JSONObject printReceipt(String deviceName) throws IOException, JSONException {
        final byte[] text = ("MoreFunOS 1.0 Recovery\n"
            + "USB Receipt Test\n"
            + "PASS candidate\n\n\n").getBytes(StandardCharsets.UTF_8);
        final byte[] payload = new byte[text.length + 2];
        payload[0] = 0x1B;
        payload[1] = 0x40;
        System.arraycopy(text, 0, payload, 2, text.length);
        return transmit(deviceName, payload, "receipt-escpos");
    }

    public JSONObject printLabel(String deviceName) throws IOException, JSONException {
        final String command = "SIZE 40 mm,30 mm\r\n"
            + "GAP 2 mm,0 mm\r\n"
            + "CLS\r\n"
            + "TEXT 20,20,\"3\",0,1,1,\"MoreFunOS 1.0 Recovery\"\r\n"
            + "TEXT 20,60,\"3\",0,1,1,\"USB Label Test\"\r\n"
            + "PRINT 1\r\n";
        return transmit(deviceName, command.getBytes(StandardCharsets.US_ASCII), "label-tspl");
    }

    private JSONObject transmit(String deviceName, byte[] payload, String preset) throws IOException, JSONException {
        final UsbDevice device = requireDevice(deviceName);
        if (!manager.hasPermission(device)) throw new IOException("PRINTER_USB_PERMISSION_REQUIRED");
        final Selection selection = selectBulkOut(device);
        if (selection == null) throw new IOException("PRINTER_USB_BULK_OUT_ENDPOINT_MISSING");
        UsbDeviceConnection connection = null;
        boolean claimed = false;
        int written = 0;
        try {
            connection = manager.openDevice(device);
            if (connection == null) throw new IOException("PRINTER_USB_OPEN_FAILED");
            claimed = connection.claimInterface(selection.usbInterface, true);
            if (!claimed) throw new IOException("PRINTER_USB_CLAIM_FAILED");
            int offset = 0;
            while (offset < payload.length) {
                final int count = connection.bulkTransfer(
                    selection.endpoint,
                    payload,
                    offset,
                    payload.length - offset,
                    TIMEOUT_MS
                );
                if (count <= 0) throw new IOException("PRINTER_USB_TRANSFER_FAILED");
                offset += count;
                written += count;
            }
            return new JSONObject()
                .put("status", "accepted")
                .put("delivery", "sent")
                .put("preset", preset)
                .put("bytesWritten", written)
                .put("device", deviceJson(device));
        } finally {
            if (connection != null) {
                if (claimed) connection.releaseInterface(selection.usbInterface);
                connection.close();
            }
        }
    }

    private UsbDevice requireDevice(String deviceName) throws IOException {
        final String key = deviceName == null ? "" : deviceName.trim();
        final Map<String, UsbDevice> devices = manager.getDeviceList();
        if (!key.isEmpty()) {
            final UsbDevice exact = devices.get(key);
            if (exact != null) return exact;
        }
        if (devices.size() == 1) return devices.values().iterator().next();
        if (devices.isEmpty()) throw new IOException("PRINTER_USB_DEVICE_NOT_FOUND");
        throw new IOException("PRINTER_USB_DEVICE_NAME_REQUIRED");
    }

    private JSONObject deviceJson(UsbDevice device) throws JSONException {
        return new JSONObject()
            .put("deviceName", device.getDeviceName())
            .put("deviceId", device.getDeviceId())
            .put("vendorId", device.getVendorId())
            .put("productId", device.getProductId())
            .put("deviceClass", device.getDeviceClass())
            .put("permissionGranted", manager.hasPermission(device));
    }

    private static final class Selection {
        final UsbInterface usbInterface;
        final UsbEndpoint endpoint;
        Selection(UsbInterface usbInterface, UsbEndpoint endpoint) {
            this.usbInterface = usbInterface;
            this.endpoint = endpoint;
        }
    }

    private static Selection selectBulkOut(UsbDevice device) {
        Selection fallback = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            final UsbInterface usbInterface = device.getInterface(i);
            for (int j = 0; j < usbInterface.getEndpointCount(); j++) {
                final UsbEndpoint endpoint = usbInterface.getEndpoint(j);
                if (endpoint.getDirection() != UsbConstants.USB_DIR_OUT
                    || endpoint.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                final Selection selection = new Selection(usbInterface, endpoint);
                if (usbInterface.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return selection;
                if (fallback == null) fallback = selection;
            }
        }
        return fallback;
    }
}
