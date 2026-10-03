package com.morefunos.smt.storekernel.business;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Currency;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Read-only adapter over validated ADMIN_ACTIVE_CONFIGURATION state in the existing Store Kernel.
 * This is source evidence, not envelope authentication, a quote, tender, discount, or settlement authority.
 */
public final class FormalCheckoutSourceContracts {
    private FormalCheckoutSourceContracts() { }

    public static final String AGGREGATE_TYPE = FormalAdminConfigProducer.AGGREGATE_TYPE;
    public static final String ADAPTER_VERSION = "mfp.checkout.source-contracts.v1";
    public static final long MAX_SAFE_MINOR = 9_007_199_254_740_991L;

    @FunctionalInterface
    public interface JsonObjectDecoder {
        Map<String, Object> decodeObject(String stateJson);
    }

    public record Binding<T>(T value, String code, String sourcePath) {
        public Binding {
            Objects.requireNonNull(code);
            Objects.requireNonNull(sourcePath);
            if ((value != null) != "BOUND".equals(code)) throw new IllegalArgumentException("BINDING_INVALID");
        }

        public boolean bound() {
            return value != null;
        }

        public T require() {
            if (!bound()) throw new IllegalStateException(code + ":" + sourcePath);
            return value;
        }
    }

    public record Provenance(
        String aggregateType,
        String aggregateId,
        long kernelRevision,
        long adminSourceRevision,
        String publishedAt,
        String adminFingerprint,
        String envelopeFingerprint,
        String adapterVersion
    ) { }

    public record MoneyFact(long amountMinor, String currency, String sourcePath, Provenance provenance) { }

    public record SourceFacts(
        Provenance provenance,
        Binding<String> currency,
        Binding<ZoneId> timezone,
        Binding<LocalTime> businessDayCutoff,
        Map<String, Object> catalog,
        Binding<Map<String, Object>> optionCenter,
        Binding<Map<String, Object>> pricingPromotions,
        Binding<List<Object>> customerPaymentChannels,
        Map<String, Binding<MoneyFact>> moneyFacts,
        Binding<String> posTenderPolicy,
        Binding<String> studentEligibilityPolicy
    ) { }

    public static SourceFacts fromValidatedStateJson(
        String storeId,
        long kernelRevision,
        String stateJson,
        JsonObjectDecoder decoder
    ) {
        if (stateJson == null || stateJson.trim().isEmpty()) throw new IllegalArgumentException("ADMIN_STATE_MISSING");
        return fromDecodedValidatedEnvelope(
            storeId,
            kernelRevision,
            Objects.requireNonNull(decoder, "ADMIN_STATE_DECODER_REQUIRED").decodeObject(stateJson)
        );
    }

    static SourceFacts fromDecodedValidatedEnvelope(
        String storeId,
        long kernelRevision,
        Map<String, Object> input
    ) {
        if (kernelRevision < 1) throw new IllegalArgumentException("KERNEL_REVISION_INVALID");
        final Map<String, Object> root = object(freeze(input));
        if (!FormalAdminConfigProducer.SCHEMA.equals(root.get("schema"))) {
            throw new IllegalArgumentException("ADMIN_SCHEMA_INVALID");
        }
        if (!requiredText(root.get("storeId")).equals(requiredText(storeId))) {
            throw new IllegalArgumentException("ADMIN_STORE_MISMATCH");
        }
        final Provenance source = new Provenance(
            AGGREGATE_TYPE,
            storeId,
            kernelRevision,
            safePositiveInteger(root.get("revision")),
            requiredText(root.get("publishedAt")),
            requiredText(root.get("adminFingerprint")),
            requiredText(root.get("fingerprint")),
            ADAPTER_VERSION
        );
        final Map<String, Object> snapshot = object(root.get("snapshot"));
        final Map<String, Object> catalog = object(snapshot.get("catalog"));
        final Map<String, Object> settings = optionalObject(snapshot.get("storeSettings"));
        final Binding<String> currency = textBinding(settings.get("currency"), "/snapshot/storeSettings/currency");

        final Binding<ZoneId> timezone = timezoneBinding(settings.get("timezone"));
        final Binding<LocalTime> cutoff = cutoffBinding(optionalObject(snapshot.get("businessDay")).get("cutoff"));

        final Binding<Map<String, Object>> options = objectBinding(
            snapshot.get("optionCenter"),
            "/snapshot/optionCenter"
        );
        final Binding<Map<String, Object>> promotions = objectBinding(
            snapshot.get("pricingPromotions"),
            "/snapshot/pricingPromotions"
        );
        final Map<String, Binding<MoneyFact>> facts = new LinkedHashMap<>();
        collectBase(catalog.get("products"), "/snapshot/catalog/products", currency, source, facts);
        collectBase(catalog.get("combos"), "/snapshot/catalog/combos", currency, source, facts);
        if (options.bound()) {
            each(options.value().get("sets"), "/snapshot/optionCenter/sets", (set, path) ->
                each(set.get("options"), path + "/options", (option, optionPath) ->
                    price(option, "priceAdjustment", optionPath, currency, source, facts, false)
                )
            );
        }
        each(catalog.get("comboPools"), "/snapshot/catalog/comboPools", (pool, path) ->
            each(pool.get("groups"), path + "/groups", (group, groupPath) -> {
                each(group.get("bands"), groupPath + "/bands", (band, bandPath) ->
                    price(band, "priceAdjustment", bandPath, currency, source, facts, false)
                );
                each(group.get("choices"), groupPath + "/choices", (choice, choicePath) ->
                    price(choice, "priceAdjustment", choicePath, currency, source, facts, false)
                );
            })
        );

        final Binding<List<Object>> customer = settings.get("customerPaymentChannels") instanceof List<?>
            ? bound(immutableList((List<?>) settings.get("customerPaymentChannels")), "/snapshot/storeSettings/customerPaymentChannels")
            : unbound("CUSTOMER_CHANNELS_UNBOUND", "/snapshot/storeSettings/customerPaymentChannels");

        return new SourceFacts(
            source,
            currency,
            timezone,
            cutoff,
            catalog,
            options,
            promotions,
            customer,
            Collections.unmodifiableMap(facts),
            unbound("FORMAL_POS_TENDER_POLICY_UNBOUND", "/snapshot"),
            unbound("FORMAL_STUDENT_ELIGIBILITY_POLICY_UNBOUND", "/snapshot")
        );
    }

    private static void collectBase(
        Object rows,
        String path,
        Binding<String> currency,
        Provenance source,
        Map<String, Binding<MoneyFact>> output
    ) {
        each(rows, path, (row, rowPath) -> {
            price(row, "basePrice", rowPath, currency, source, output, true);
            price(row, "takeawayAdjustment", rowPath, currency, source, output, false);
        });
    }

    private static void price(
        Map<String, Object> row,
        String key,
        String path,
        Binding<String> currency,
        Provenance source,
        Map<String, Binding<MoneyFact>> output,
        boolean nonnegative
    ) {
        final String field = path + "/" + key;
        if ("OWNER_VALUE_REQUIRED".equals(row.get("priceStatus"))) {
            output.put(field, unbound("OWNER_VALUE_REQUIRED", field));
            return;
        }
        if (row.containsKey("priceStatus") && !"READY".equals(row.get("priceStatus"))) {
            output.put(field, unbound("PRICE_STATUS_UNSUPPORTED", field));
            return;
        }
        try {
            final String currencyCode = currency.require();
            if (Currency.getInstance(currencyCode).getDefaultFractionDigits() != 2) {
                throw new IllegalArgumentException();
            }
            final long amount = exactMinor(requiredText(row.get(key)));
            if (nonnegative && amount < 0) throw new IllegalArgumentException();
            output.put(field, bound(new MoneyFact(amount, currencyCode, field, source), field));
        } catch (RuntimeException invalid) {
            output.put(field, unbound("PUBLISHED_MONEY_UNREPRESENTABLE", field));
        }
    }

    public static long exactMinor(String decimal) {
        if (decimal == null || !decimal.matches("-?[0-9]{1,14}(?:\\.[0-9]{1,2})?")) {
            throw new IllegalArgumentException("DECIMAL_MONEY_INVALID");
        }
        try {
            return safe(new BigDecimal(decimal).movePointRight(2).longValueExact());
        } catch (ArithmeticException invalid) {
            throw new IllegalArgumentException("MINOR_OUT_OF_RANGE", invalid);
        }
    }

    public static long safeAdd(long left, long right) {
        safe(left);
        safe(right);
        try {
            return safe(Math.addExact(left, right));
        } catch (ArithmeticException invalid) {
            throw new IllegalArgumentException("MINOR_OUT_OF_RANGE", invalid);
        }
    }

    public static long safeMultiply(long left, long right) {
        safe(left);
        safe(right);
        try {
            return safe(Math.multiplyExact(left, right));
        } catch (ArithmeticException invalid) {
            throw new IllegalArgumentException("MINOR_OUT_OF_RANGE", invalid);
        }
    }

    private static long safe(long value) {
        if (value < -MAX_SAFE_MINOR || value > MAX_SAFE_MINOR) {
            throw new IllegalArgumentException("MINOR_OUT_OF_RANGE");
        }
        return value;
    }

    private static long safePositiveInteger(Object value) {
        if (!(value instanceof Number)) throw new IllegalArgumentException("SOURCE_REVISION_INVALID");
        try {
            final long number = new BigDecimal(value.toString()).longValueExact();
            if (number < 1) throw new IllegalArgumentException();
            return safe(number);
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("SOURCE_REVISION_INVALID", invalid);
        }
    }

    private static String requiredText(Object raw) {
        if (!(raw instanceof String)) throw new IllegalArgumentException("SOURCE_TEXT_INVALID");
        final String value = (String) raw;
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > 240) {
            throw new IllegalArgumentException("SOURCE_TEXT_INVALID");
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) throw new IllegalArgumentException("SOURCE_TEXT_INVALID");
        }
        return value;
    }

    private static Binding<String> textBinding(Object value, String path) {
        try {
            return bound(requiredText(value), path);
        } catch (RuntimeException invalid) {
            return unbound("SOURCE_FIELD_UNBOUND", path);
        }
    }

    private static Binding<ZoneId> timezoneBinding(Object value) {
        final String path = "/snapshot/storeSettings/timezone";
        try {
            final String zone = requiredText(value);
            if (!ZoneId.getAvailableZoneIds().contains(zone)) throw new IllegalArgumentException();
            return bound(ZoneId.of(zone), path);
        } catch (RuntimeException invalid) {
            return unbound("TIMEZONE_UNBOUND", path);
        }
    }

    private static Binding<LocalTime> cutoffBinding(Object value) {
        final String path = "/snapshot/businessDay/cutoff";
        try {
            final String text = requiredText(value);
            if (!text.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) throw new IllegalArgumentException();
            return bound(LocalTime.parse(text), path);
        } catch (RuntimeException invalid) {
            return unbound("BUSINESS_DAY_CUTOFF_UNBOUND", path);
        }
    }

    private static Binding<Map<String, Object>> objectBinding(Object value, String path) {
        return value instanceof Map<?, ?>
            ? bound(object(value), path)
            : unbound("SOURCE_FIELD_UNBOUND", path);
    }

    private static <T> Binding<T> bound(T value, String path) {
        return new Binding<>(value, "BOUND", path);
    }

    private static <T> Binding<T> unbound(String code, String path) {
        return new Binding<>(null, code, path);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value) {
        if (!(value instanceof Map<?, ?>)) throw new IllegalArgumentException("SOURCE_OBJECT_INVALID");
        return (Map<String, Object>) value;
    }

    private static Map<String, Object> optionalObject(Object value) {
        return value instanceof Map<?, ?> ? object(value) : Collections.emptyMap();
    }

    private interface RowConsumer {
        void accept(Map<String, Object> row, String path);
    }

    private static void each(Object value, String path, RowConsumer consumer) {
        if (value == null) return;
        if (!(value instanceof List<?>)) throw new IllegalArgumentException("SOURCE_ARRAY_INVALID:" + path);
        final List<?> rows = (List<?>) value;
        for (int index = 0; index < rows.size(); index++) {
            consumer.accept(object(rows.get(index)), path + "/" + index);
        }
    }

    private static List<Object> immutableList(List<?> input) {
        final List<Object> output = new ArrayList<>();
        for (Object value : input) output.add(freeze(value));
        return Collections.unmodifiableList(output);
    }

    private static Object freeze(Object value) {
        if (value instanceof Map<?, ?>) {
            final Map<String, Object> output = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                if (!(entry.getKey() instanceof String)) throw new IllegalArgumentException("SOURCE_KEY_INVALID");
                output.put((String) entry.getKey(), freeze(entry.getValue()));
            }
            return Collections.unmodifiableMap(output);
        }
        if (value instanceof List<?>) return immutableList((List<?>) value);
        if (value == null || value instanceof String || value instanceof Boolean || value instanceof Number) return value;
        throw new IllegalArgumentException("SOURCE_JSON_TYPE_INVALID");
    }
}
