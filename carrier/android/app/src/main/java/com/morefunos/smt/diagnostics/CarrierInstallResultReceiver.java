package com.morefunos.smt.diagnostics;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

public final class CarrierInstallResultReceiver extends BroadcastReceiver {
    public static final String ACTION_INSTALL_RESULT = "com.morefunos.smt.CARRIER_INSTALL_RESULT";
    private static final String PREFS = "morefun_carrier_install";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_INSTALL_RESULT.equals(intent.getAction())) return;
        final int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        final String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putInt("status", status)
            .putString("message", message == null ? "" : message)
            .apply();

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            final Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirm);
            }
            return;
        }

        final String text = status == PackageInstaller.STATUS_SUCCESS
            ? "MoreFunOS Carrier 更新完成"
            : "Carrier 更新失敗：" + (message == null ? String.valueOf(status) : message);
        Toast.makeText(context, text, Toast.LENGTH_LONG).show();
    }
}
