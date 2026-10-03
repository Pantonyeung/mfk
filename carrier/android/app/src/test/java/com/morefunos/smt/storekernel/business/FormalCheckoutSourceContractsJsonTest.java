package com.morefunos.smt.storekernel.business;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class FormalCheckoutSourceContractsJsonTest {
    private static final String STATE = "{\"schema\":\"MFK_ADMIN_CONFIG_SYNC_V1\",\"storeId\":\"MF01\",\"revision\":2,"
        + "\"publishedAt\":\"2026-10-02T12:00:00Z\",\"adminFingerprint\":\"fixture\","
        + "\"fingerprint\":\"fnv1a32:12345678\",\"snapshot\":{\"catalog\":{\"products\":[{\"id\":\"p1\","
        + "\"basePrice\":\"1.25\",\"takeawayAdjustment\":\"0.00\"}]},\"storeSettings\":{\"currency\":\"HKD\","
        + "\"timezone\":\"Asia/Hong_Kong\"},\"businessDay\":{\"cutoff\":\"05:00\"}}}";

    @Test
    public void parsesRealJsonWithoutCoercingMoney() {
        final FormalCheckoutSourceContracts.SourceFacts facts = FormalCheckoutSourceContracts.fromValidatedStateJson(
            "MF01", 42, STATE, new FormalCheckoutOrgJsonDecoder()
        );
        assertEquals(42, facts.provenance().kernelRevision());
        assertEquals(2, facts.provenance().adminSourceRevision());
        assertEquals(125, facts.moneyFacts().get("/snapshot/catalog/products/0/basePrice").require().amountMinor());

        final FormalCheckoutSourceContracts.SourceFacts numeric = FormalCheckoutSourceContracts.fromValidatedStateJson(
            "MF01", 42, STATE.replace("\"1.25\"", "1.25"), new FormalCheckoutOrgJsonDecoder()
        );
        assertFalse(numeric.moneyFacts().get("/snapshot/catalog/products/0/basePrice").bound());
    }

    @Test
    public void rejectsTrailingDocumentAndNonObjectRoot() {
        assertThrows(
            IllegalArgumentException.class,
            () -> FormalCheckoutSourceContracts.fromValidatedStateJson(
                "MF01", 42, STATE + "{}", new FormalCheckoutOrgJsonDecoder()
            )
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> new FormalCheckoutOrgJsonDecoder().decodeObject("[]")
        );
    }

    @Test
    public void customerAndPromotionHintsRemainNonAuthorizing() {
        final FormalCheckoutSourceContracts.SourceFacts facts = FormalCheckoutSourceContracts.fromValidatedStateJson(
            "MF01", 42, STATE, new FormalCheckoutOrgJsonDecoder()
        );
        assertFalse(facts.posTenderPolicy().bound());
        assertFalse(facts.studentEligibilityPolicy().bound());
    }
}
