package com.morefunos.smt.print.gateway;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.util.Base64;

import com.morefunos.smt.PrintCommandController;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.SQLiteMode;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
@SQLiteMode(SQLiteMode.Mode.NATIVE)
public final class NativePrintReliabilityTest {
    private static final String HELLO_SHA256 =
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

    private Context context;
    private ServiceController<NativePrintGatewayService> controller;
    private NativePrintGatewayService gateway;
    private PrintGatewayStore store;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        context.deleteDatabase("morefun_print_gateway.db");
        controller = Robolectric.buildService(NativePrintGatewayService.class).create();
        gateway = controller.get();
        store = new PrintGatewayStore(context);
    }

    @After
    public void tearDown() {
        if (store != null) store.close();
        if (controller != null) controller.destroy();
        context.deleteDatabase("morefun_print_gateway.db");
    }

    @Test
    public void completionCarriesDispatchAttemptIdentity() throws Exception {
        final AtomicReference<String> notification = new AtomicReference<>();
        final PrintCommandController print = new PrintCommandController(context, notification::set);
        try {
            final Method completion = PrintCommandController.class.getDeclaredMethod(
                "notifyCompletion",
                String.class,
                String.class,
                String.class,
                String.class,
                String.class,
                String.class
            );
            completion.setAccessible(true);
            completion.invoke(print, "print.lan.dispatch.completed", "request-1", "ACKNOWLEDGED",
                null, null, "attempt-1");

            assertNotNull(notification.get());
            final JSONObject event = new JSONObject(notification.get());
            assertEquals("attempt-1", event.getString("dispatchAttemptId"));
            assertEquals("native-print:attempt-1", event.getString("evidenceId"));
        } finally {
            print.close();
        }
    }

    @Test
    public void persistedSameAttemptReplaysWithoutDispatchingAgain() throws Exception {
        final JSONObject target = lanTarget("not-configured");
        store.insert("local-1", "print-job-1", "attempt-1", target, helloBase64(),
            HELLO_SHA256, "2026-10-03T00:00:00.000Z");

        final JSONObject response = gateway.handle(enqueue(
            "request-2", "print-job-1", "attempt-1", target, helloBase64()
        ));

        assertEquals("accepted", response.getString("status"));
        assertEquals("local-1", response.getString("localJobId"));
        assertEquals("PERSISTED", response.getString("state"));
        final JSONObject snapshot = store.latestSnapshot().getJSONObject("lastJob");
        assertEquals("PERSISTED", snapshot.getString("state"));
        assertFalse(snapshot.has("lastCode") && !snapshot.isNull("lastCode"));
    }

    @Test
    public void completedSameAttemptReturnsDurableOutcome() throws Exception {
        final JSONObject target = lanTarget("not-configured");
        store.insert("local-2", "print-job-2", "attempt-2", target, helloBase64(),
            HELLO_SHA256, "2026-10-03T00:00:00.000Z");
        store.update("attempt-2", "ACKNOWLEDGED", "ACKNOWLEDGED", null,
            "2026-10-03T00:00:01.000Z", true);

        final JSONObject response = gateway.handle(enqueue(
            "request-3", "print-job-2", "attempt-2", target, helloBase64()
        ));

        assertEquals("accepted", response.getString("status"));
        assertEquals("ACKNOWLEDGED", response.getString("state"));
        assertEquals("ACKNOWLEDGED", response.getString("outcome"));
        assertEquals("attempt-2", response.getString("dispatchAttemptId"));
    }

    @Test
    public void sameAttemptWithDifferentFingerprintIsUnknown() throws Exception {
        final JSONObject target = lanTarget("printer-a");
        store.insert("local-3", "print-job-3", "attempt-3", target, helloBase64(),
            HELLO_SHA256, "2026-10-03T00:00:00.000Z");

        final JSONObject response = gateway.handle(enqueue(
            "request-4", "different-print-job", "attempt-3", target, helloBase64()
        ));

        assertEquals("OUTCOME_UNKNOWN", response.getString("outcome"));
        assertEquals("PRINT_GATEWAY_ATTEMPT_CONFLICT", response.getString("failureCode"));
        assertEquals("attempt-3", response.getString("dispatchAttemptId"));
        assertEquals("PERSISTED", response.getString("state"));
        assertTrue(store.latestSnapshot().getInt("queueDepth") == 1);
    }

    private static JSONObject enqueue(String requestId, String printJobId, String attemptId,
                                      JSONObject target, String payloadBase64) throws Exception {
        return new JSONObject()
            .put("type", "print.gateway.enqueue")
            .put("requestId", requestId)
            .put("canonicalPrintJobId", printJobId)
            .put("dispatchAttemptId", attemptId)
            .put("target", target)
            .put("payloadBase64", payloadBase64);
    }

    private static JSONObject lanTarget(String endpointId) throws Exception {
        return new JSONObject().put("kind", "LAN").put("endpointId", endpointId);
    }

    private static String helloBase64() {
        return Base64.encodeToString("hello".getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
    }
}
