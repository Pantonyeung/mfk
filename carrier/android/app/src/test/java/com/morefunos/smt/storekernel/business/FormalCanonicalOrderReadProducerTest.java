package com.morefunos.smt.storekernel.business;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalCanonicalOrderReadProducerTest {
    @Test
    public void projectsFullRetainedConsumerShapeWithoutInventingDiningState() throws Exception {
        final FormalCanonicalOrderReadProducer.CanonicalOrder order =
            FormalCanonicalOrderReadProducer.parse("MF01", "ORDER-1", 3, full().toString());

        assertEquals("KEETA-88", order.externalOrderNumber());
        assertEquals("P088", order.pickupCode());
        assertEquals("T01", order.dining().tableId());
        assertEquals("2026-10-03T01:00:00Z", order.dining().seatedAt());
        assertEquals("ETA-2", order.eta().policyRevision().text());
        assertEquals(20L, order.eta().minutes());
        assertEquals("REFUND", order.adjustments().get(0).type());
        assertEquals(Long.valueOf(500), order.adjustments().get(0).amountMinor());
        assertEquals("LESS_ICE", order.items().get(0).options().get(0));
        assertThrows(UnsupportedOperationException.class, order.adjustments()::clear);
        assertThrows(UnsupportedOperationException.class, order.items().get(0).options()::clear);
    }

    @Test
    public void rejectsIdentityMoneyLineAndUnsupportedIntentCorruption() throws Exception {
        expect("MFP_ORDER_READBACK_IDENTITY_MISMATCH", changed("storeId", "MF02"));
        expect("MFP_ORDER_READBACK_IDENTITY_MISMATCH", changed("orderId", "ORDER-2"));
        expect("MFP_ORDER_READBACK_REVISION_MISMATCH", changed("revision", 2));
        expect("MFP_ORDER_READBACK_SCHEMA_INVALID", changed("schema", "old.order"));
        expect("MFP_ORDER_READBACK_INVALID", changed("recognizedAmountMinor", -1));
        expect("MFP_ORDER_READBACK_INVALID", changed("recognizedAmountMinor", 9_007_199_254_740_992L));
        expect("MFP_ORDER_READBACK_INVALID", changed("correctionPrintIntent", true));

        final JSONObject duplicateLine = full();
        duplicateLine.getJSONArray("items").put(new JSONObject(
            duplicateLine.getJSONArray("items").getJSONObject(0).toString()
        ));
        expect("MFP_ORDER_READBACK_INVALID", duplicateLine);

        final JSONObject overSettled = full();
        overSettled.getJSONArray("items").getJSONObject(0).put("settledQuantity", 2);
        expect("MFP_ORDER_READBACK_INVALID", overSettled);

        final JSONObject conflictingExternalIdentity = full().put("externalOrderNumber", "OTHER");
        expect("MFP_ORDER_READBACK_INVALID", conflictingExternalIdentity);
    }

    private static JSONObject changed(String field, Object value) throws Exception {
        return new JSONObject(full().toString()).put(field, value);
    }

    private static void expect(String code, JSONObject state) {
        final IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> FormalCanonicalOrderReadProducer.parse("MF01", "ORDER-1", 3, state.toString())
        );
        assertEquals(code, error.getMessage());
    }

    private static JSONObject full() throws Exception {
        return new JSONObject()
            .put("schema", "mfp.canonical-order.v1")
            .put("storeId", "MF01")
            .put("orderId", "ORDER-1")
            .put("displayNumber", "K088")
            .put("source", "KEETA")
            .put("sourceIdentity", new JSONObject()
                .put("externalOrderNo", "KEETA-88")
                .put("pickupCode", "P088"))
            .put("customerDisplayName", "Guest")
            .put("createdAt", "2026-10-03T00:59:00Z")
            .put("revision", 3)
            .put("lifecycleState", "ACTIVE")
            .put("fulfillmentState", "IN_PROGRESS")
            .put("effectiveTenderId", "FPS")
            .put("tenderAudit", new JSONArray().put("FPS"))
            .put("recognizedAmountMinor", 5_000)
            .put("outstandingAmountMinor", 0)
            .put("refundableAmountMinor", 4_500)
            .put("serviceMode", "DINE_IN")
            .put("items", new JSONArray().put(new JSONObject()
                .put("lineId", "LINE-1")
                .put("productId", "DRINK-1")
                .put("name", "Drink")
                .put("quantity", 1)
                .put("settledQuantity", 0)
                .put("unitMinor", 5_000)
                .put("options", new JSONArray().put("LESS_ICE"))
                .put("note", "No straw")))
            .put("adjustments", new JSONArray().put(new JSONObject()
                .put("adjustmentId", "REFUND-1")
                .put("type", "REFUND")
                .put("status", "COMMITTED")
                .put("amountMinor", 500)
                .put("tenderId", "FPS")
                .put("occurredAt", "2026-10-03T01:30:00Z")))
            .put("dining", new JSONObject()
                .put("tableId", "T01")
                .put("partySize", 2)
                .put("seatedAt", "2026-10-03T01:00:00Z"))
            .put("eta", new JSONObject()
                .put("policyRevision", "ETA-2")
                .put("minutes", 20)
                .put("readyAt", "2026-10-03T01:19:00Z"))
            .put("modificationState", "NONE")
            .put("productionDispatched", true)
            .put("cancelNoticeIntent", "NOT_REQUIRED")
            .put("humanCommunicationRequired", false)
            .put("correctionPrintIntent", false);
    }
}
