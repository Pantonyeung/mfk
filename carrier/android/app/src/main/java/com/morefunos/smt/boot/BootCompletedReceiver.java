package com.morefunos.smt.boot;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.morefunos.smt.MainActivity;

import java.util.Locale;

public final class BootCompletedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        final BootEvidenceStore evidence = new BootEvidenceStore(context);
        evidence.recordBootCompleted("launch-requested", null);
        final Intent launch = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            context.startActivity(launch);
            evidence.recordBootCompleted("launch-started", null);
        } catch (RuntimeException error) {
            final String code = error.getClass().getSimpleName().isEmpty()
                ? "BOOT_AUTO_START_FAILED"
                : "BOOT_AUTO_START_" + error.getClass().getSimpleName().toUpperCase(Locale.US);
            evidence.recordBootCompleted("launch-failed", code);
        }
    }
}
