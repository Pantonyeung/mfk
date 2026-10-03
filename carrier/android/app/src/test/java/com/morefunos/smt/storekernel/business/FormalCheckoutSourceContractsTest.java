package com.morefunos.smt.storekernel.business;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FormalCheckoutSourceContractsTest {
    @Test
    public void convertsDecimalMoneyExactlyWithinSharedSafeIntegerRange() {
        assertEquals(125L, FormalCheckoutSourceContracts.exactMinor("1.25"));
        assertEquals(-5L, FormalCheckoutSourceContracts.exactMinor("-0.05"));
        assertEquals(9_007_199_254_740_991L, FormalCheckoutSourceContracts.exactMinor("90071992547409.91"));
        for (String value : List.of("0.001", "1e2", "NaN", "Infinity", " 1.00", "90071992547409.92")) {
            assertThrows(IllegalArgumentException.class, () -> FormalCheckoutSourceContracts.exactMinor(value));
        }
        assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutSourceContracts.safeAdd(9_007_199_254_740_991L, 1)
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutSourceContracts.safeMultiply(9_007_199_254_740_991L, 2)
        );
    }

    @Test
    public void extractsImmutableAdminFactsWithoutPromotingMissingPolicy() {
        final Map<String, Object> envelope = envelope();
        final FormalCheckoutSourceContracts.SourceFacts source =
            FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("MF01", 42, envelope);

        assertEquals(42L, source.provenance().kernelRevision());
        assertEquals(2L, source.provenance().adminSourceRevision());
        assertEquals("HKD", source.currency().require());
        assertEquals("Asia/Hong_Kong", source.timezone().require().getId());
        assertEquals(LocalTime.of(5, 0), source.businessDayCutoff().require());
        assertFalse(source.posTenderPolicy().bound());
        assertEquals("FORMAL_POS_TENDER_POLICY_UNBOUND", source.posTenderPolicy().code());
        assertFalse(source.studentEligibilityPolicy().bound());
        assertEquals("FORMAL_STUDENT_ELIGIBILITY_POLICY_UNBOUND", source.studentEligibilityPolicy().code());
        assertEquals(
            125L,
            source.moneyFacts().get("/snapshot/catalog/products/0/basePrice").require().amountMinor()
        );
        assertFalse(source.moneyFacts()
            .get("/snapshot/catalog/comboPools/0/groups/0/bands/0/priceAdjustment")
            .bound());
        assertEquals(
            "OWNER_VALUE_REQUIRED",
            source.moneyFacts().get("/snapshot/catalog/comboPools/0/groups/0/bands/0/priceAdjustment").code()
        );
        assertEquals("ADMIN_ACTIVE_CONFIGURATION", source.provenance().aggregateType());
        assertThrows(UnsupportedOperationException.class, () -> source.catalog().put("products", List.of()));
        assertThrows(
            UnsupportedOperationException.class,
            () -> object(((List<?>) source.catalog().get("products")).get(0)).put("basePrice", "9.99")
        );

        final Map<String, Object> settings = object(snapshot(envelope).get("storeSettings"));
        settings.remove("currency");
        assertEquals("HKD", source.currency().require());
        assertFalse(FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("MF01", 43, envelope).currency().bound());
        settings.put("currency", "JPY");
        assertFalse(FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("MF01", 43, envelope)
            .moneyFacts().get("/snapshot/catalog/products/0/basePrice").bound());
        settings.put("currency", "HKD");
        object(((List<?>) object(snapshot(envelope).get("catalog")).get("products")).get(0)).put("basePrice", 1.25);
        assertFalse(FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("MF01", 43, envelope)
            .moneyFacts().get("/snapshot/catalog/products/0/basePrice").bound());
    }

    @Test
    public void rejectsWrongStoreRevisionOrMalformedConsumedGraph() {
        assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("OTHER", 42, envelope())
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("MF01", 0, envelope())
        );
        final Map<String, Object> malformed = envelope();
        object(snapshot(malformed).get("catalog")).put("products", "not-an-array");
        assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutSourceContracts.fromDecodedValidatedEnvelope("MF01", 42, malformed)
        );
    }

    private static Map<String, Object> envelope() {
        return map(
            "schema", "MFK_ADMIN_CONFIG_SYNC_V1",
            "storeId", "MF01",
            "revision", 2L,
            "publishedAt", "2026-10-02T12:00:00Z",
            "adminFingerprint", "published-admin-fingerprint",
            "fingerprint", "fnv1a32:12345678",
            "snapshot", map(
                "storeSettings", map(
                    "currency", "HKD",
                    "timezone", "Asia/Hong_Kong",
                    "paymentRefs", List.of("CASH"),
                    "customerPaymentChannels", List.of(map("id", "ALIPAY", "name", "AlipayHK", "enabled", true))
                ),
                "businessDay", map("cutoff", "05:00"),
                "catalog", map(
                    "categories", List.of(),
                    "products", new ArrayList<>(List.of(map("id", "p1", "basePrice", "1.25", "takeawayAdjustment", "-0.05"))),
                    "combos", List.of(),
                    "comboPools", List.of(map(
                        "id", "pool",
                        "groups", List.of(map(
                            "id", "g",
                            "bands", List.of(map(
                                "id", "b",
                                "priceAdjustment", "0.00",
                                "priceStatus", "OWNER_VALUE_REQUIRED"
                            )),
                            "choices", List.of()
                        ))
                    ))
                ),
                "optionCenter", map("sets", List.of(), "productLinks", List.of()),
                "pricingPromotions", map(
                    "riceballDrink", map("active", true, "drinks", List.of(map("productId", "p1", "promoPrice", "1.00")))
                )
            )
        );
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value) {
        return (Map<String, Object>) value;
    }

    private static Map<String, Object> snapshot(Map<String, Object> envelope) {
        return object(envelope.get("snapshot"));
    }

    private static Map<String, Object> map(Object... pairs) {
        final Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            result.put((String) pairs[index], pairs[index + 1]);
        }
        return result;
    }
}
