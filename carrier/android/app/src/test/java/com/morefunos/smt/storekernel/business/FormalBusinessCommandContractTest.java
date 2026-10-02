package com.morefunos.smt.storekernel.business;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalBusinessCommandContractTest {
    @Test
    public void parsesValidFormalEnvelopeAndCreatesStableFingerprint() throws Exception {
        final JSONObject payload = new JSONObject().put("review", new JSONObject().put("quoteRef", "QUOTE-1"));
        final FormalBusinessCommandContract.CommandEnvelope first = FormalBusinessCommandContract.parseCommand(command(payload));
        final JSONObject reordered = new JSONObject().put("review", new JSONObject().put("quoteRef", "QUOTE-1"));
        final FormalBusinessCommandContract.CommandEnvelope second = FormalBusinessCommandContract.parseCommand(command(reordered));

        assertEquals("CHECKOUT_PAYMENT_CONFIRM", first.commandType);
        assertEquals(first.requestFingerprint, second.requestFingerprint);
        assertTrue(first.requestFingerprint.matches("^[0-9a-f]{64}$"));
    }

    @Test
    public void rejectsUnknownCommand() throws Exception {
        expectCode(command(new JSONObject()).replace("CHECKOUT_PAYMENT_CONFIRM", "ORDER_CREATE"), "FORMAL_COMMAND_TYPE_UNSUPPORTED");
    }

    @Test
    public void rejectsMissingIdentityAndInvalidExpectedRevision() throws Exception {
        final JSONObject missingDevice = new JSONObject(command(new JSONObject()));
        missingDevice.remove("deviceId");
        expectCode(missingDevice.toString(), "FORMAL_COMMAND_DEVICE_ID_INVALID");

        final JSONObject fractionalRevision = new JSONObject(command(new JSONObject())).put("expectedRevision", 1.5d);
        expectCode(fractionalRevision.toString(), "FORMAL_COMMAND_EXPECTED_REVISION_INVALID");

        final JSONObject invalidTime = new JSONObject(command(new JSONObject())).put("createdAt", "2026-99-99T99:99:99Z");
        expectCode(invalidTime.toString(), "FORMAL_COMMAND_CREATED_AT_INVALID");
    }

    @Test
    public void rejectsRawAggregateAndCanonicalStateInjection() throws Exception {
        for (String field : Arrays.asList(
            "aggregateType",
            "aggregateId",
            "mutations",
            "stateJson",
            "canonicalState",
            "aggregateState",
            "orderState",
            "paymentState",
            "finalState",
            "canonicalOrderState",
            "canonicalPaymentState",
            "finalCanonicalAggregateState"
        )) {
            final JSONObject payload = new JSONObject().put(field, field.equals("mutations") ? new org.json.JSONArray() : "FORGED");
            expectCode(command(payload), "FORMAL_AGGREGATE_INJECTION_REJECTED");
        }
    }

    @Test
    public void registryCoversEveryKnownV3Command() {
        final Set<String> expected = new LinkedHashSet<>(Arrays.asList(
            "CHECKOUT_PAYMENT_CONFIRM",
            "ORDER_FULFILLMENT_SET",
            "ORDER_MODIFICATION_REQUEST",
            "ORDER_PAYMENT_CORRECTION",
            "ORDER_REFUND",
            "ORDER_CANCEL",
            "DINING_FORMAL_ADMIT",
            "DINING_WAITING_CREATE",
            "DINING_TABLE_ASSIGN",
            "DINING_TABLE_TRANSFER",
            "DINING_ITEMS_ADD",
            "RUNTIME_AVAILABILITY_SET",
            "CAPACITY_POOL_CORRECT",
            "CAPACITY_OVERRIDE_CREATE",
            "CUSTOMER_NEW_ORDER_ACCEPTANCE_SET",
            "ORDER_MODIFICATION_CUSTOMER_DECISION",
            "EXTERNAL_KEETA_LIFECYCLE_APPLY",
            "EXTERNAL_CUSTOMER_ORDER_ADMIT",
            "EXTERNAL_KEETA_ORDER_ADMIT"
        ));

        assertEquals(expected, FormalBusinessCommandContract.commandTypes());
        assertTrue(FormalBusinessCommandContract.commandTypes().contains("CHECKOUT_PAYMENT_CONFIRM"));
    }

    static String command(JSONObject payload) throws Exception {
        return new JSONObject()
            .put("protocolVersion", 1)
            .put("type", "mfp.store-kernel.command.v1")
            .put("schema", "mfp.store-kernel.command.v1")
            .put("requestId", "REQ-1")
            .put("storeId", "MF01")
            .put("deviceId", "PAD-01")
            .put("staffSessionRef", "SESSION-01")
            .put("submissionId", "SUB-01")
            .put("idempotencyKey", "IDEMP-01")
            .put("commandType", "CHECKOUT_PAYMENT_CONFIRM")
            .put("expectedRevision", "PRICE-8")
            .put("payload", payload)
            .put("createdAt", "2026-10-02T06:02:00.000Z")
            .toString();
    }

    private static void expectCode(String raw, String code) throws Exception {
        try {
            FormalBusinessCommandContract.parseCommand(raw);
            fail("Expected " + code);
        } catch (IllegalArgumentException error) {
            assertEquals(code, error.getMessage());
        }
    }
}
