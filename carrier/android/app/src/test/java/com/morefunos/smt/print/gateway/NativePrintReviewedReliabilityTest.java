package com.morefunos.smt.print.gateway;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import android.content.Context;

import com.morefunos.smt.PrintCommandController;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.SQLiteMode;

import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicReference;

/** Additional reviewed native SQLite/control-flow fixtures. */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
@SQLiteMode(SQLiteMode.Mode.NATIVE)
public final class NativePrintReviewedReliabilityTest {
    private static final String HELLO_SHA256 =
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

    private Context context;
    private NativePrintGatewayService gateway;
    private PrintGatewayStore store;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        context.deleteDatabase("morefun_print_gateway.db");
        gateway = Robolectric.buildService(NativePrintGatewayService.class).create().get();
        store = new PrintGatewayStore(context);
    }

    @After
    public void tearDown() {
        if (gateway != null) gateway.onDestroy();
        if (store != null) store.close();
        context.deleteDatabase("morefun_print_gateway.db");
    }

    @Test
    public void completionCorrelatesAndPersistsAckThroughReopen() throws Exception {
        seed("a1", "DISPATCHING");
        final Method receive = NativePrintGatewayService.class.getDeclaredMethod("onDriverEvent", String.class);
        receive.setAccessible(true);
        final AtomicReference<JSONObject> event = new AtomicReference<>();
        final PrintCommandController controller = new PrintCommandController(context, raw -> {
            try {
                event.set(new JSONObject(raw));
                receive.invoke(gateway, raw);
            } catch (Exception error) {
                throw new AssertionError(error);
            }
        });
        try {
            final Method complete = PrintCommandController.class.getDeclaredMethod(
                "notifyCompletion",
                String.class,
                String.class,
                String.class,
                String.class,
                String.class,
                String.class
            );
            complete.setAccessible(true);
            complete.invoke(
                controller,
                "print.sunmi.dispatch.completed",
                "request-a1",
                "ACKNOWLEDGED",
                null,
                null,
                "a1"
            );
        } finally {
            controller.close();
        }
        assertNotNull(event.get());
        assertEquals("a1", event.get().getString("dispatchAttemptId"));
        assertEquals("ACKNOWLEDGED", store.findByDispatchAttemptId("a1").getString("state"));
        assertEquals(0, store.queueDepth());
        store.close();
        gateway.onDestroy();
        gateway = Robolectric.buildService(NativePrintGatewayService.class).create().get();
        store = new PrintGatewayStore(context);
        assertEquals("ACKNOWLEDGED", store.findByDispatchAttemptId("a1").getString("state"));
        assertEquals(0, store.recoverableJobs().length());
    }

    @Test
    public void retryReplaysEveryStoredStateWithoutInsertingAnotherAttempt() throws Exception {
        for (String state : new String[]{
            "PERSISTED", "DISPATCHING", "FAILED_BEFORE_SEND", "AMBIGUOUS_AFTER_SEND", "ACKNOWLEDGED"
        }) {
            final String attempt = "attempt-" + state;
            seed(attempt, state);
            final JSONObject response = gateway.handle(request(attempt));
            assertEquals("accepted", response.getString("status"));
            assertEquals(state, response.getString("state"));
            assertEquals("local-" + attempt, response.getString("localJobId"));
            assertEquals(state, store.findByDispatchAttemptId(attempt).getString("state"));
            if ("ACKNOWLEDGED".equals(state)) assertEquals("ACKNOWLEDGED", response.getString("outcome"));
            if ("AMBIGUOUS_AFTER_SEND".equals(state)) {
                assertEquals("OUTCOME_UNKNOWN", response.getString("outcome"));
            }
        }
    }

    @Test
    public void changedPayloadOrTargetCannotReusePrintedAttempt() throws Exception {
        seed("a1", "ACKNOWLEDGED");
        final JSONObject payloadConflict = gateway.handle(request("a1").put("payloadBase64", "Ynl0ZXM="));
        assertEquals("PRINT_GATEWAY_ATTEMPT_CONFLICT", payloadConflict.getString("failureCode"));
        assertEquals("OUTCOME_UNKNOWN", payloadConflict.getString("outcome"));
        final JSONObject targetConflict = gateway.handle(request("a1").put(
            "target", new JSONObject().put("kind", "LAN").put("endpointId", "other")
        ));
        assertEquals("PRINT_GATEWAY_ATTEMPT_CONFLICT", targetConflict.getString("failureCode"));
        assertEquals("ACKNOWLEDGED", store.findByDispatchAttemptId("a1").getString("state"));
    }

    @Test
    public void restartPreservesAmbiguityForUnacknowledgedDispatch() throws Exception {
        seed("a1", "DISPATCHING");
        gateway.onDestroy();
        gateway = Robolectric.buildService(NativePrintGatewayService.class).create().get();
        assertEquals("AMBIGUOUS_AFTER_SEND", store.findByDispatchAttemptId("a1").getString("state"));
        assertEquals("OUTCOME_UNKNOWN", gateway.handle(request("a1")).getString("outcome"));
    }

    private void seed(String attempt, String state) throws Exception {
        store.insert(
            "local-" + attempt,
            "job-1",
            attempt,
            request(attempt).getJSONObject("target"),
            "aGVsbG8=",
            HELLO_SHA256,
            "2026-10-03T00:00:00.000Z"
        );
        store.update(
            attempt,
            state,
            "FIXTURE",
            null,
            "2026-10-03T00:00:00.001Z",
            !"PERSISTED".equals(state)
        );
    }

    private JSONObject request(String attempt) throws Exception {
        return new JSONObject()
            .put("type", "print.gateway.enqueue")
            .put("requestId", "request-" + attempt)
            .put("canonicalPrintJobId", "job-1")
            .put("dispatchAttemptId", attempt)
            .put("payloadBase64", "aGVsbG8=")
            .put("target", new JSONObject().put("kind", "SUNMI_INTERNAL"));
    }
}
