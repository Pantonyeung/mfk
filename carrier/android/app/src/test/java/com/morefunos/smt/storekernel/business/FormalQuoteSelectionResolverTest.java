package com.morefunos.smt.storekernel.business;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Dependency-free vectors, using the Admin V3 formal-option-center/formal-combo field shapes. */
public final class FormalQuoteSelectionResolverTest {
    private static int checks;

    public static void main(String[] args) {
        plainAndDefaultOptions();
        optionMembershipAndCardinality();
        comboSelectionsAndIdentity();
        pricesAndQuantities();
        preservesIdentifierBounds();
        unsupportedFieldsAndSharedBands();
        serviceFactsKeepEntityNamespace();
        System.out.println("PASS " + checks + " native selection resolver assertions; no Room/Android/live data execution");
    }

    private static void plainAndDefaultOptions() {
        Map<String, Object> root = fixture();
        equal(5000L, resolve(root, product("plain", 1), "dine-in").unitMinor());
        var defaulted = resolve(root, product("p1", 2), "dine-in");
        equal(5200L, defaulted.unitMinor());
        equal(10400L, defaulted.lineTotalMinor());
        equal(List.of(map("optionSetId", "milk", "optionIds", List.of("oat"))), defaulted.optionSelections());
        var overridden = product("p1", 1);
        overridden.put("optionSelections", List.of(selection("milk", "soy")));
        equal(5300L, resolve(root, overridden, "dine-in").unitMinor());
        equal(5500L, resolve(root, product("p1", 1), "takeaway").unitMinor());
        equal(5000L, resolve(root, product("plain", 1), "takeaway").unitMinor());
        overridden.put("previewUnitMinor", 1);
        overridden.put("materialPriceFacts", List.of(map("amountMinor", 1)));
        equal(5300L, resolve(root, overridden, "dine-in").unitMinor());
    }

    private static void optionMembershipAndCardinality() {
        var root = fixture();
        var line = product("p1", 1);
        line.put("optionSelections", List.of(selection("milk")));
        rejects("FORMAL_QUOTE_OPTION_CARDINALITY", () -> resolve(root, line, "dine-in"));
        line.put("optionSelections", List.of(selection("foreign", "x")));
        rejects("FORMAL_QUOTE_OPTION_NOT_LINKED", () -> resolve(root, line, "dine-in"));
        line.put("optionSelections", List.of(selection("milk", "foreign")));
        rejects("FORMAL_QUOTE_OPTION_NOT_FOUND", () -> resolve(root, line, "dine-in"));
        line.put("optionSelections", List.of(selection("milk", "oat", "soy")));
        rejects("FORMAL_QUOTE_OPTION_CARDINALITY", () -> resolve(root, line, "dine-in"));
        line.put("optionSelections", List.of(selection("milk", "oat", "oat")));
        rejects("FORMAL_QUOTE_SELECTION_DUPLICATE", () -> resolve(root, line, "dine-in"));
        line.put("optionSelections", List.of(selection("milk", "oat"), selection("milk", "soy")));
        rejects("FORMAL_QUOTE_SELECTION_DUPLICATE", () -> resolve(root, line, "dine-in"));
        var disabled = fixture();
        object(list(object(disabled.get("optionCenter")).get("sets")).get(0)).put("active", false);
        rejects("FORMAL_QUOTE_OPTION_UNAVAILABLE", () -> resolve(disabled, product("p1", 1), "dine-in"));
        var sold = fixture();
        option(sold, 0).put("active", false);
        rejects("FORMAL_QUOTE_OPTION_UNAVAILABLE", () -> resolve(sold, product("p1", 1), "dine-in"));
        var legacy = fixture(); legacy.remove("optionCenter");
        rejects("FORMAL_QUOTE_OPTIONS_UNBOUND", () -> resolve(legacy, product("p1", 1), "dine-in"));
        equal(5000L, resolve(legacy, product("plain", 1), "dine-in").unitMinor());
        var brokenDefaults = fixture();
        object(list(object(brokenDefaults.get("optionCenter")).get("productLinks")).get(0))
            .put("defaultOptionIds", List.of("missing"));
        rejects("FORMAL_QUOTE_OPTION_NOT_FOUND", () -> resolve(brokenDefaults, product("p1", 1), "dine-in"));
        var multi = fixture();
        var set = object(list(object(multi.get("optionCenter")).get("sets")).get(0));
        set.put("selection", "MULTI"); set.put("max", 2); set.put("allowQuantities", true);
        line.put("optionSelections", List.of(selection("milk", "oat", "soy")));
        equal(5500L, resolve(multi, line, "dine-in").unitMinor());
    }

    private static void comboSelectionsAndIdentity() {
        var root = fixture();
        var line = combo(2);
        var resolved = resolve(root, line, "dine-in");
        equal(5600L, resolved.unitMinor());
        equal(11200L, resolved.lineTotalMinor());
        equal(2, resolved.comboSelections().size()); // same product and local IDs, distinct pools
        equal(5, resolved.materialFactIds().size()); // base plus two band and two choice identities
        equal(5, new java.util.HashSet<>(resolved.materialFactIds()).size());
        equal(5700L, resolve(root, line, "takeaway").unitMinor());
        line.put("comboSelections", List.of(choice("main")));
        rejects("FORMAL_QUOTE_COMBO_CARDINALITY", () -> resolve(root, line, "dine-in"));
        line.put("comboSelections", List.of(choice("main"), choice("main"), choice("addon")));
        rejects("FORMAL_QUOTE_SELECTION_DUPLICATE", () -> resolve(root, line, "dine-in"));
        line.put("comboSelections", List.of(choice("main"), choice("foreign")));
        rejects("FORMAL_QUOTE_COMBO_NOT_LINKED", () -> resolve(root, line, "dine-in"));
        var forged = choice("addon"); forged.put("productId", "p1");
        line.put("comboSelections", List.of(choice("main"), forged));
        rejects("FORMAL_QUOTE_COMBO_IDENTITY_MISMATCH", () -> resolve(root, line, "dine-in"));
        var wrongBand = choice("addon"); wrongBand.put("subPoolId", "other");
        line.put("comboSelections", List.of(choice("main"), wrongBand));
        rejects("FORMAL_QUOTE_COMBO_IDENTITY_MISMATCH", () -> resolve(root, line, "dine-in"));
        var unready = fixture(); band(unready, 0).put("priceStatus", "OWNER_VALUE_REQUIRED");
        rejects("FORMAL_QUOTE_PRICE_UNBOUND", () -> resolve(unready, combo(1), "dine-in"));
        var unavailable = fixture(); productRow(unavailable, 1).put("active", false);
        rejects("FORMAL_QUOTE_PRODUCT_UNAVAILABLE", () -> resolve(unavailable, combo(1), "dine-in"));
        var nested = fixture();
        for (Object pool : list(catalog(nested).get("comboPools"))) {
            object(list(object(list(object(pool).get("groups")).get(0)).get("choices")).get(0)).put("productId", "p1");
        }
        var nestedLine = combo(1);
        for (Object selected : list(nestedLine.get("comboSelections"))) object(selected).put("productId", "p1");
        rejects("FORMAL_QUOTE_COMBO_COMPONENT_OPTIONS_UNSUPPORTED", () -> resolve(nested, nestedLine, "dine-in"));
    }

    private static void pricesAndQuantities() {
        for (Object invalid : List.of("NaN", "Infinity", "1.001", "", 50, "-1.00", "90071992547409.92")) {
            var root = fixture(); productRow(root, 1).put("basePrice", invalid);
            rejects("FORMAL_QUOTE_PRICE_UNBOUND", () -> resolve(root, product("plain", 1), "dine-in"));
        }
        for (Object quantity : List.of(0, -1, 1.5, 1000, "2")) {
            var line = product("plain", 1); line.put("quantity", quantity);
            rejects("FORMAL_QUOTE_INTENT_INVALID", () -> resolve(fixture(), line, "dine-in"));
        }
        var huge = fixture(); productRow(huge, 1).put("basePrice", "90071992547409.91");
        rejects("FORMAL_QUOTE_MONEY_INVALID", () -> resolve(huge, product("plain", 2), "dine-in"));
        var negative = fixture(); option(negative, 0).put("priceAdjustment", "-51.00");
        rejects("FORMAL_QUOTE_MONEY_INVALID", () -> resolve(negative, product("p1", 1), "dine-in"));
        option(negative, 0).put("priceAdjustment", "-1.00");
        equal(4900L, resolve(negative, product("p1", 1), "dine-in").unitMinor());
        var unknownCurrency = fixture();
        rejects("FORMAL_QUOTE_CURRENCY_UNBOUND", () -> FormalQuoteSelectionResolver.resolve(
            catalog(unknownCurrency), object(unknownCurrency.get("optionCenter")), "JPY", product("plain", 1), "dine-in"));
    }

    private static void serviceFactsKeepEntityNamespace() {
        var root = fixture();
        object(list(catalog(root).get("combos")).get(0)).put("id", "p1");
        var combo = combo(1); combo.put("comboId", "p1");
        var product = resolve(root, product("p1", 1), "takeaway");
        var meal = resolve(root, combo, "takeaway");
        equal(false, product.materialFactIds().get(1).equals(meal.materialFactIds().get(1)));
    }

    private static void unsupportedFieldsAndSharedBands() {
        var line = product("p1", 1);
        var selection = selection("milk", "oat"); selection.put("quantity", 2);
        line.put("optionSelections", List.of(selection));
        rejects("FORMAL_QUOTE_INTENT_INVALID", () -> resolve(fixture(), line, "dine-in"));
        var root = fixture();
        var combo = object(list(catalog(root).get("combos")).get(0));
        combo.remove("takeawayAdjustment");
        rejects("FORMAL_QUOTE_PRICE_UNBOUND", () -> resolve(root, combo(1), "takeaway"));
        var shared = fixture();
        object(list(catalog(shared).get("combos")).get(0)).put("addonPoolIds", List.of());
        var group = object(list(object(list(catalog(shared).get("comboPools")).get(0)).get("groups")).get(0));
        group.put("max", 2);
        var choices = new ArrayList<>(list(group.get("choices")));
        choices.add(map("id", "none", "choiceType", "NONE", "bandId", "b1", "active", true,
            "priceStatus", "READY", "priceAdjustment", "-1.00"));
        group.put("choices", choices);
        var sameBand = combo(1);
        sameBand.put("comboSelections", List.of(choice("main"), map("poolId", "main", "groupId", "g1",
            "subPoolId", "b1", "choiceId", "none", "choiceType", "NONE")));
        var resolved = resolve(shared, sameBand, "dine-in");
        equal(5400L, resolved.unitMinor()); // each chosen component charges its published band once
        equal(4, resolved.materialFactIds().size()); // shared source band evidence is unique
        equal(2, resolved.comboSelections().size());
        for (Object invalid : List.of("NaN", "Infinity", "0.001", 2)) {
            var malformed = fixture(); option(malformed, 0).put("priceAdjustment", invalid);
            rejects("FORMAL_QUOTE_PRICE_UNBOUND", () -> resolve(malformed, product("p1", 1), "dine-in"));
        }
        var fractional = fixture();
        object(list(object(fractional.get("optionCenter")).get("sets")).get(0)).put("min", 1.5);
        rejects("FORMAL_QUOTE_CATALOG_INVALID", () -> resolve(fractional, product("p1", 1), "dine-in"));
    }

    private static void preservesIdentifierBounds() {
        var root = fixture();
        var row = productRow(root, 1);
        String id = "P".repeat(150), name = "N".repeat(160);
        row.put("id", id); row.put("name", name); row.put("takeawayAdjustment", "1.00");
        var resolved = resolve(root, product(id, 1), "takeaway");
        equal(name, resolved.name());
        equal(id, resolved.entityId());
        equal(5100L, resolved.unitMinor());
        for (String fact : resolved.materialFactIds()) equal(true, fact.length() <= 160);
    }

    private static FormalQuoteSelectionResolver.ResolvedLine resolve(Map<String,Object> root, Map<String,Object> line, String mode) {
        line.put("serviceMode", mode);
        return FormalQuoteSelectionResolver.resolve(catalog(root), root.containsKey("optionCenter") ? object(root.get("optionCenter")) : null, "HKD", line, mode);
    }
    public static Map<String,Object> fixture() {
        return map("catalog", map(
            "categories", List.of(map("id", "food", "active", true)),
            "products", List.of(
                map("id", "p1", "name", "P1", "categoryId", "food", "active", true, "basePrice", "50.00", "takeawayAdjustment", "2.00", "takeawaySurchargeEnabled", true, "modifierGroupIds", List.of("milk")),
                map("id", "plain", "name", "Plain", "categoryId", "food", "active", true, "basePrice", "50.00", "modifierGroupIds", List.of())),
            "combos", List.of(map("id", "c1", "name", "Combo", "active", true, "basePrice", "50.00", "takeawayAdjustment", "1.00", "takeawaySurchargeEnabled", false, "mainPoolId", "main", "addonPoolIds", List.of("addon"))),
            "comboPools", List.of(pool("main", "MAIN_COURSE"), pool("addon", "ADDON"))),
            "optionCenter", map("sets", List.of(map("id", "milk", "name", "Milk", "required", true, "selection", "SINGLE", "min", 1, "max", 1, "allowQuantities", false, "active", true,
                "options", List.of(map("id", "oat", "name", "Oat", "active", true, "priceAdjustment", "2.00"), map("id", "soy", "name", "Soy", "active", true, "priceAdjustment", "3.00")))),
                "productLinks", List.of(map("productId", "p1", "setId", "milk", "defaultOptionIds", List.of("oat")))));
    }
    private static Map<String,Object> pool(String id, String kind) {
        return map("id", id, "kind", kind, "active", true, "groups", List.of(map("id", "g1", "required", true, "min", 1, "max", 1,
            "bands", List.of(map("id", "b1", "active", true, "priceStatus", "READY", "priceAdjustment", "2.00")),
            "choices", List.of(map("id", "ch1", "choiceType", "PRODUCT", "productId", "plain", "bandId", "b1", "active", true, "priceStatus", "READY", "priceAdjustment", "1.00")))));
    }
    public static Map<String,Object> product(String id, int quantity) { return map("kind", "PRODUCT", "productId", id, "quantity", quantity, "optionSelections", List.of(), "comboSelections", List.of()); }
    public static Map<String,Object> combo(int quantity) { return map("kind", "COMBO", "comboId", "c1", "quantity", quantity, "optionSelections", List.of(), "comboSelections", List.of(choice("main"), choice("addon"))); }
    private static Map<String,Object> choice(String pool) { return map("poolId", pool, "groupId", "g1", "subPoolId", "b1", "choiceId", "ch1", "choiceType", "PRODUCT", "productId", "plain"); }
    private static Map<String,Object> selection(String set, String... ids) { return map("optionSetId", set, "optionIds", List.of(ids)); }
    private static Map<String,Object> catalog(Map<String,Object> root) { return object(root.get("catalog")); }
    private static Map<String,Object> productRow(Map<String,Object> root, int i) { return object(list(catalog(root).get("products")).get(i)); }
    private static Map<String,Object> option(Map<String,Object> root, int i) { return object(list(object(list(object(root.get("optionCenter")).get("sets")).get(0)).get("options")).get(i)); }
    private static Map<String,Object> band(Map<String,Object> root, int i) { return object(list(object(list(object(list(catalog(root).get("comboPools")).get(i)).get("groups")).get(0)).get("bands")).get(0)); }
    @SuppressWarnings("unchecked") static Map<String,Object> object(Object raw) { return (Map<String,Object>) raw; }
    @SuppressWarnings("unchecked") private static List<Object> list(Object raw) { return (List<Object>) raw; }
    static Map<String,Object> map(Object... pairs) { Map<String,Object> out = new LinkedHashMap<>(); for (int i=0;i<pairs.length;i+=2) out.put((String)pairs[i],pairs[i+1]); return out; }
    private static void equal(Object expected,Object actual) { if(!Objects.equals(expected,actual)) throw new AssertionError(expected+" != "+actual); checks++; }
    private static void rejects(String code,Runnable operation) { try { operation.run(); } catch(IllegalStateException e) { equal(code,e.getMessage()); return; } throw new AssertionError("Expected "+code); }
}
