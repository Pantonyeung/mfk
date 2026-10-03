package com.morefunos.smt.storekernel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/** Synthetic wire-contract fixtures, not a claim of physical device acceptance. */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class StoreKernelA9DiagnosticsContractTest {
    @Test
    public void parsesExactHealthEnvelopeAlsoAssertedByTheTypeScriptAdapter() throws Exception {
        final String raw = fixture("a9-store-kernel-health-request.json");
        final JSONObject request = StoreKernelContract.parseEnvelope(raw);
        assertEquals(StoreKernelContract.PROTOCOL_VERSION, request.getInt("protocolVersion"));
        assertEquals(StoreKernelContract.HEALTH, request.getString("type"));
        assertEquals("mfp-v3-diagnostic-contract", request.getString("requestId"));
    }

    @Test
    public void rejectsTheAuditedMissingVersionEnvelope() throws Exception {
        final JSONObject request = new JSONObject(fixture("a9-store-kernel-health-request.json"));
        request.remove("protocolVersion");
        expectCode(request.toString(), "STORE_KERNEL_PROTOCOL_VERSION_INVALID");
    }

    @Test
    public void nativeBridgeParserRejectionHasNoCorrelatedRequestId() throws Exception {
        final JSONObject request = new JSONObject(fixture("a9-store-kernel-health-request.json"));
        request.remove("protocolVersion");
        // Parsing must fail before a coordinator call or asynchronous notification.
        final StoreKernelBridgeController controller = new StoreKernelBridgeController(null,
            ignored -> fail("Parser rejection must not notify a completed operation"));
        final JSONObject response = new JSONObject(controller.handle(request.toString()));
        assertEquals("store.kernel.error.v1", response.getString("type"));
        assertEquals("failed", response.getString("status"));
        assertEquals("STORE_KERNEL_PROTOCOL_VERSION_INVALID", response.getString("errorCode"));
        assertFalse(response.has("requestId"));
    }

    @Test
    public void rejectsUnsupportedProtocolWithoutChangingNativeValidation() throws Exception {
        final JSONObject request = new JSONObject(fixture("a9-store-kernel-health-request.json"));
        request.put("protocolVersion", 2);
        expectCode(request.toString(), "STORE_KERNEL_PROTOCOL_UNSUPPORTED");
    }

    @Test
    public void actualHealthDtoMatchesTheSharedCheckCenterFixture() throws Exception {
        final StoreKernelTransactionCoordinator.HealthResult result = new StoreKernelTransactionCoordinator.HealthResult(
            "fixture-writer", 1, "wal", 2, 0, 0, 0, 0, 0
        );
        assertJsonEquals(new JSONObject(fixture("a9-store-kernel-health-response.json")),
            result.toJson("mfp-v3-diagnostic-contract"));
    }

    private static String fixture(String name) throws Exception {
        try (InputStream input = StoreKernelA9DiagnosticsContractTest.class.getResourceAsStream("/" + name)) {
            assertNotNull("Missing shared fixture: " + name, input);
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void expectCode(String raw, String expected) throws Exception {
        try {
            StoreKernelContract.parseEnvelope(raw);
            fail("Expected " + expected);
        } catch (IllegalArgumentException error) {
            assertEquals(expected, error.getMessage());
        }
    }

    private static Set<String> keys(JSONObject value) {
        final Set<String> keys = new HashSet<>();
        for (Iterator<String> iterator = value.keys(); iterator.hasNext();) keys.add(iterator.next());
        return keys;
    }

    private static void assertJsonEquals(JSONObject expected, JSONObject actual) throws Exception {
        assertEquals(keys(expected), keys(actual));
        for (String key : keys(expected)) {
            final Object left = expected.get(key);
            final Object right = actual.get(key);
            if (left instanceof JSONObject) {
                assertTrue("Object expected at " + key, right instanceof JSONObject);
                assertJsonEquals((JSONObject) left, (JSONObject) right);
            } else if (left instanceof Number) {
                assertTrue("Number expected at " + key, right instanceof Number);
                assertEquals(left.toString(), right.toString());
            } else {
                assertEquals(left, right);
            }
        }
    }
}
