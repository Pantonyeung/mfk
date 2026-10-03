package com.morefunos.smt.storekernel.business;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Currency;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Pure implementation detail of the native quote authority. Never consumes browser money facts. */
final class FormalQuoteSelectionResolver {
    private FormalQuoteSelectionResolver() { }
    private static final int LIMIT = 1000;
    private static final String CATALOG = "FORMAL_QUOTE_CATALOG_INVALID";
    private static final String INTENT = "FORMAL_QUOTE_INTENT_INVALID";

    record ResolvedLine(String kind, String entityId, String name, long quantity,
        long unitMinor, long lineTotalMinor, List<Map<String, Object>> optionSelections,
        List<Map<String, Object>> comboSelections, List<String> materialFactIds) { }

    static ResolvedLine resolve(Map<String, Object> catalog, Map<String, Object> center,
        String currency, Map<String, Object> line, String serviceMode) {
        try {
            if (Currency.getInstance(currency).getDefaultFractionDigits() != 2) throw new IllegalArgumentException();
        } catch (RuntimeException invalid) { throw fail("FORMAL_QUOTE_CURRENCY_UNBOUND"); }
        if (!"takeaway".equals(serviceMode) && !"dine-in".equals(serviceMode)) throw fail("FORMAL_QUOTE_SERVICE_MODE_UNSUPPORTED");
        if (!serviceMode.equals(line.get("serviceMode"))) throw fail("FORMAL_QUOTE_SERVICE_MODE_MISMATCH");
        long quantity = integer(line.get("quantity"), 1, 999, INTENT);
        String kind = text(line.get("kind"), INTENT);
        List<Map<String, Object>> options = new ArrayList<>();
        List<Map<String, Object>> combos = new ArrayList<>();
        Set<String> facts = new LinkedHashSet<>();
        Map<String, Object> entity;
        long adjustment;
        String id;
        if ("PRODUCT".equals(kind)) {
            id = text(line.get("productId"), INTENT);
            entity = product(catalog, id);
            empty(line.get("comboSelections"), "FORMAL_QUOTE_COMBOS_UNSUPPORTED");
            adjustment = options(catalog, center, entity, line.get("optionSelections"), options, facts);
        } else if ("COMBO".equals(kind)) {
            id = text(line.get("comboId"), INTENT);
            entity = lookup(catalog.get("combos"), id, "FORMAL_QUOTE_COMBO_NOT_FOUND");
            available(entity, true, "FORMAL_QUOTE_COMBO_UNAVAILABLE");
            empty(line.get("optionSelections"), "FORMAL_QUOTE_OPTIONS_UNSUPPORTED");
            adjustment = combos(catalog, center, entity, line.get("comboSelections"), combos, facts);
        } else { throw fail("FORMAL_QUOTE_UNSUPPORTED_LINE_KIND"); }
        long base = price(entity, "basePrice", true, false);
        long service = serviceAdjustment(entity, serviceMode, "COMBO".equals(kind));
        // Existing plain-product identity stays stable; compound identities are length-delimited hashes.
        List<String> material = new ArrayList<>();
        material.add(singleFact(kind + "-BASE", id));
        if (service != 0) material.add(singleFact("PRODUCT".equals(kind) ? "SERVICE-MODE" : "COMBO-SERVICE-MODE", id));
        material.addAll(facts);
        long unit = add(add(base, service), adjustment);
        if (unit < 0) throw fail("FORMAL_QUOTE_MONEY_INVALID");
        long total;
        try { total = FormalCheckoutSourceContracts.safeMultiply(unit, quantity); }
        catch (RuntimeException invalid) { throw fail("FORMAL_QUOTE_MONEY_INVALID"); }
        return new ResolvedLine(kind, id, text(entity.get("name"), CATALOG), quantity, unit, total,
            List.copyOf(options), List.copyOf(combos), List.copyOf(material));
    }

    private static long options(Map<String, Object> catalog, Map<String, Object> center,
        Map<String, Object> product, Object rawSelections, List<Map<String, Object>> normalized, Set<String> facts) {
        List<Map<String, Object>> links = links(center, product);
        Map<String, Map<String, Object>> requested = new LinkedHashMap<>();
        for (Object value : rows(rawSelections, INTENT)) {
            Map<String, Object> selected = object(value, INTENT);
            keys(selected, Set.of("optionSetId", "optionIds"));
            String id = text(selected.get("optionSetId"), INTENT);
            if (requested.put(id, selected) != null) throw fail("FORMAL_QUOTE_SELECTION_DUPLICATE");
        }
        Set<String> attached = new HashSet<>();
        for (Map<String, Object> link : links) attached.add(text(link.get("setId"), CATALOG));
        if (!attached.containsAll(requested.keySet())) throw fail("FORMAL_QUOTE_OPTION_NOT_LINKED");
        long amount = 0;
        for (Map<String, Object> link : links) {
            String setId = text(link.get("setId"), CATALOG);
            Map<String, Object> set = lookup(center.get("sets"), setId, "FORMAL_QUOTE_OPTIONS_UNBOUND");
            available(set, true, "FORMAL_QUOTE_OPTION_UNAVAILABLE");
            String selection = text(set.get("selection"), CATALOG);
            if (!Set.of("SINGLE", "MULTI").contains(selection)) throw fail(CATALOG);
            boolean allowQuantities = bool(set.get("allowQuantities"), CATALOG);
            long[] bounds = bounds(set);
            if ("SINGLE".equals(selection) && (bounds[1] != 1 || allowQuantities)) throw fail(CATALOG);
            List<String> defaults = ids(link.get("defaultOptionIds"), CATALOG);
            if (defaults.size() > bounds[1]) throw fail("FORMAL_QUOTE_OPTION_CARDINALITY");
            // Malformed defaults cannot be hidden by an explicit override.
            for (String optionId : defaults) lookup(set.get("options"), optionId, "FORMAL_QUOTE_OPTION_NOT_FOUND");
            List<String> selected = requested.containsKey(setId)
                ? ids(requested.get(setId).get("optionIds"), INTENT) : defaults;
            if (selected.size() < bounds[0] || selected.size() > bounds[1]) throw fail("FORMAL_QUOTE_OPTION_CARDINALITY");
            for (String optionId : selected) {
                Map<String, Object> option = lookup(set.get("options"), optionId, "FORMAL_QUOTE_OPTION_NOT_FOUND");
                available(option, true, "FORMAL_QUOTE_OPTION_UNAVAILABLE");
                amount = add(amount, price(option, "priceAdjustment", false, false));
                facts.add(fact("OPTION", text(product.get("id"), CATALOG), setId, optionId));
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("optionSetId", setId); out.put("optionIds", List.copyOf(selected));
            normalized.add(Collections.unmodifiableMap(out));
        }
        return amount;
    }

    private static List<Map<String, Object>> links(Map<String, Object> center, Map<String, Object> product) {
        String productId = text(product.get("id"), CATALOG);
        List<String> legacy = product.containsKey("modifierGroupIds") ? ids(product.get("modifierGroupIds"), CATALOG) : List.of();
        if (center == null) {
            if (!legacy.isEmpty()) throw fail("FORMAL_QUOTE_OPTIONS_UNBOUND");
            return List.of();
        }
        rows(center.get("sets"), CATALOG);
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Object raw : rows(center.get("productLinks"), CATALOG)) {
            Map<String, Object> link = object(raw, CATALOG);
            if (!productId.equals(text(link.get("productId"), CATALOG))) continue;
            if (!seen.add(text(link.get("setId"), CATALOG))) throw fail(CATALOG);
            result.add(link);
        }
        if (product.containsKey("modifierGroupIds") && !seen.equals(new HashSet<>(legacy))) throw fail("FORMAL_QUOTE_OPTIONS_UNBOUND");
        return result;
    }

    private static long combos(Map<String, Object> catalog, Map<String, Object> center,
        Map<String, Object> combo, Object rawSelections, List<Map<String, Object>> normalized, Set<String> facts) {
        Map<String, Map<String, Object>> pools = new LinkedHashMap<>();
        String main = optionalText(combo.get("mainPoolId"), CATALOG);
        List<String> addons = ids(combo.get("addonPoolIds"), CATALOG);
        if (main != null) {
            Map<String, Object> pool = lookup(catalog.get("comboPools"), main, "FORMAL_QUOTE_COMBO_NOT_LINKED");
            if (!"MAIN_COURSE".equals(pool.get("kind"))) throw fail(CATALOG);
            pools.put(main, pool);
        }
        for (String id : addons) {
            Map<String, Object> pool = lookup(catalog.get("comboPools"), id, "FORMAL_QUOTE_COMBO_NOT_LINKED");
            if (!"ADDON".equals(pool.get("kind")) || pools.put(id, pool) != null) throw fail(CATALOG);
        }
        String linkedProduct = optionalText(combo.get("productId"), CATALOG);
        if (linkedProduct != null) product(catalog, linkedProduct);
        Map<List<String>, List<Map<String, Object>>> selectedByGroup = new LinkedHashMap<>();
        Set<List<String>> seen = new HashSet<>();
        for (Object value : rows(rawSelections, INTENT)) {
            Map<String, Object> selected = object(value, INTENT);
            keys(selected, Set.of("poolId", "groupId", "subPoolId", "choiceId", "choiceType", "productId"));
            String poolId = text(selected.get("poolId"), INTENT);
            String groupId = text(selected.get("groupId"), INTENT);
            String bandId = text(selected.get("subPoolId"), INTENT);
            String choiceId = text(selected.get("choiceId"), INTENT);
            if (!seen.add(List.of(poolId, groupId, bandId, choiceId))) throw fail("FORMAL_QUOTE_SELECTION_DUPLICATE");
            if (!pools.containsKey(poolId)) throw fail("FORMAL_QUOTE_COMBO_NOT_LINKED");
            lookup(pools.get(poolId).get("groups"), groupId, "FORMAL_QUOTE_COMBO_NOT_LINKED");
            selectedByGroup.computeIfAbsent(List.of(poolId, groupId), ignored -> new ArrayList<>()).add(selected);
        }
        long amount = 0;
        for (Map.Entry<String, Map<String, Object>> entry : pools.entrySet()) {
            String poolId = entry.getKey();
            Map<String, Object> pool = entry.getValue();
            available(pool, true, "FORMAL_QUOTE_COMBO_UNAVAILABLE");
            Set<String> groupIds = new HashSet<>();
            for (Object raw : rows(pool.get("groups"), CATALOG)) {
                Map<String, Object> group = object(raw, CATALOG);
                String groupId = text(group.get("id"), CATALOG);
                if (!groupIds.add(groupId)) throw fail(CATALOG);
                long[] bounds = bounds(group);
                List<Map<String, Object>> selected = selectedByGroup.getOrDefault(List.of(poolId, groupId), List.of());
                if (selected.size() < bounds[0] || selected.size() > bounds[1]) throw fail("FORMAL_QUOTE_COMBO_CARDINALITY");
                for (Map<String, Object> selection : selected) {
                    String bandId = text(selection.get("subPoolId"), INTENT);
                    String choiceId = text(selection.get("choiceId"), INTENT);
                    Map<String, Object> choice = lookup(group.get("choices"), choiceId, "FORMAL_QUOTE_COMBO_NOT_LINKED");
                    if (!bandId.equals(choice.get("bandId"))) throw fail("FORMAL_QUOTE_COMBO_IDENTITY_MISMATCH");
                    Map<String, Object> band = lookup(group.get("bands"), bandId, "FORMAL_QUOTE_COMBO_NOT_LINKED");
                    available(band, true, "FORMAL_QUOTE_COMBO_UNAVAILABLE");
                    available(choice, true, "FORMAL_QUOTE_COMBO_UNAVAILABLE");
                    String type = text(choice.get("choiceType"), CATALOG);
                    if (!Set.of("PRODUCT", "LABEL", "NONE").contains(type) || !type.equals(selection.get("choiceType"))) throw fail("FORMAL_QUOTE_COMBO_IDENTITY_MISMATCH");
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("poolId", poolId); out.put("groupId", groupId); out.put("subPoolId", bandId);
                    out.put("choiceId", choiceId); out.put("choiceType", type);
                    if ("PRODUCT".equals(type)) {
                        String productId = text(choice.get("productId"), CATALOG);
                        if (!productId.equals(selection.get("productId"))) throw fail("FORMAL_QUOTE_COMBO_IDENTITY_MISMATCH");
                        Map<String, Object> component = product(catalog, productId);
                        if (!links(center, component).isEmpty()) throw fail("FORMAL_QUOTE_COMBO_COMPONENT_OPTIONS_UNSUPPORTED");
                        out.put("productId", productId);
                    } else if (selection.get("productId") != null || choice.get("productId") != null) {
                        throw fail("FORMAL_QUOTE_COMBO_IDENTITY_MISMATCH");
                    }
                    amount = add(amount, price(band, "priceAdjustment", false, true));
                    amount = add(amount, price(choice, "priceAdjustment", false, true));
                    facts.add(fact("COMBO-BAND", poolId, groupId, bandId));
                    facts.add(fact("COMBO-CHOICE", poolId, groupId, bandId, choiceId));
                    normalized.add(Collections.unmodifiableMap(out));
                }
            }
        }
        return amount;
    }

    private static Map<String, Object> product(Map<String, Object> catalog, String id) {
        Map<String, Object> value = lookup(catalog.get("products"), id, "FORMAL_QUOTE_PRODUCT_NOT_FOUND");
        available(value, false, "FORMAL_QUOTE_PRODUCT_UNAVAILABLE");
        Map<String, Object> category = lookup(catalog.get("categories"), text(value.get("categoryId"), CATALOG), "FORMAL_QUOTE_PRODUCT_UNAVAILABLE");
        available(category, false, "FORMAL_QUOTE_PRODUCT_UNAVAILABLE");
        return value;
    }
    private static long serviceAdjustment(Map<String, Object> row, String mode, boolean explicitComboPolicy) {
        if (!"takeaway".equals(mode)) return 0;
        if (explicitComboPolicy) {
            long amount = price(row, "takeawayAdjustment", false, false);
            return bool(row.get("takeawaySurchargeEnabled"), CATALOG) ? add(amount, 100) : amount;
        }
        long amount = 0;
        if (row.get("takeawayAdjustment") != null && !"".equals(row.get("takeawayAdjustment"))) amount = price(row, "takeawayAdjustment", false, false);
        if (row.get("takeawaySurchargeEnabled") != null && bool(row.get("takeawaySurchargeEnabled"), CATALOG)) amount = add(amount, 100);
        return amount;
    }
    private static long price(Map<String, Object> row, String key, boolean nonnegative, boolean requireReady) {
        Object status = row.get("priceStatus");
        if ((requireReady || status != null) && !"READY".equals(status)) throw fail("FORMAL_QUOTE_PRICE_UNBOUND");
        try {
            long value = FormalCheckoutSourceContracts.exactMinor(text(row.get(key), "FORMAL_QUOTE_PRICE_UNBOUND"));
            if (nonnegative && value < 0) throw fail("FORMAL_QUOTE_PRICE_UNBOUND");
            return value;
        } catch (RuntimeException invalid) { throw fail("FORMAL_QUOTE_PRICE_UNBOUND"); }
    }
    private static long add(long a, long b) {
        try { return FormalCheckoutSourceContracts.safeAdd(a, b); }
        catch (RuntimeException invalid) { throw fail("FORMAL_QUOTE_MONEY_INVALID"); }
    }
    private static long[] bounds(Map<String, Object> row) {
        long min = integer(row.get("min"), 0, 999, CATALOG), max = integer(row.get("max"), 0, 999, CATALOG);
        boolean required = bool(row.get("required"), CATALOG);
        if (max < min || (required && min < 1)) throw fail(CATALOG);
        return new long[]{min, max};
    }
    private static void available(Map<String, Object> row, boolean required, String code) {
        Object active = row.get("active");
        if (active == null && !required) return;
        if (!bool(active, CATALOG)) throw fail(code);
    }
    private static boolean bool(Object raw, String code) { if (!(raw instanceof Boolean)) throw fail(code); return (Boolean) raw; }
    private static long integer(Object raw, long min, long max, String code) {
        if (!(raw instanceof Number)) throw fail(code);
        try { long value = new BigDecimal(raw.toString()).longValueExact(); if (value < min || value > max) throw fail(code); return value; }
        catch (ArithmeticException | NumberFormatException invalid) { throw fail(code); }
    }
    private static Map<String, Object> lookup(Object values, String id, String code) {
        Map<String, Object> found = null;
        Set<String> seen = new HashSet<>();
        for (Object raw : rows(values, CATALOG)) {
            Map<String, Object> row = object(raw, CATALOG);
            String candidate = text(row.get("id"), CATALOG);
            if (!seen.add(candidate)) throw fail(CATALOG);
            if (id.equals(candidate)) found = row;
        }
        if (found == null) throw fail(code);
        return found;
    }
    private static List<String> ids(Object raw, String code) {
        List<String> result = new ArrayList<>(); Set<String> seen = new HashSet<>();
        for (Object value : rows(raw, code)) { String id = text(value, code); if (!seen.add(id)) throw fail("FORMAL_QUOTE_SELECTION_DUPLICATE"); result.add(id); }
        return result;
    }
    private static String optionalText(Object raw, String code) { return raw == null ? null : text(raw, code); }
    private static String text(Object raw, String code) {
        if (!(raw instanceof String)) throw fail(code);
        String value = (String) raw;
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > 160) throw fail(code);
        for (int i=0; i<value.length(); i++) if (Character.isISOControl(value.charAt(i))) throw fail(code);
        return value;
    }
    @SuppressWarnings("unchecked") private static Map<String, Object> object(Object value, String code) {
        if (!(value instanceof Map<?, ?>)) throw fail(code); return (Map<String, Object>) value;
    }
    private static List<?> rows(Object value, String code) {
        if (!(value instanceof List<?>) || ((List<?>) value).size() > LIMIT) throw fail(code); return (List<?>) value;
    }
    private static void empty(Object value, String code) { if (!rows(value, code).isEmpty()) throw fail(code); }
    private static void keys(Map<String, Object> row, Set<String> allowed) { if (!allowed.containsAll(row.keySet())) throw fail(INTENT); }
    private static String singleFact(String role, String id) {
        String value = "ADMIN-" + role + ":" + id;
        return value.length() <= 160 ? value : fact(role, id);
    }
    private static String fact(String role, String... ids) {
        StringBuilder input = new StringBuilder(); for (String id : ids) input.append(id.length()).append(':').append(id);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder encoded = new StringBuilder(); for (byte value : digest) encoded.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            return "ADMIN-" + role + ":" + encoded;
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private static IllegalStateException fail(String code) { return new IllegalStateException(code); }
}
