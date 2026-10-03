package com.morefunos.smt.storekernel.business;

import java.time.Instant;
import java.math.BigDecimal;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Pure native-side transition proposal over trusted canonical reads. No persistence, no router
 * registration, no Order/payment admission, and no COMMITTED result. Maps are value mappings of
 * the existing A6 read contract, not browser-authoritative state. See the integration proposal.
 */
public final class DiningTransitionPlanner {
    private static final String READ_INVALID="DINING_CANONICAL_READ_INVALID";
    private static final Set<String> TABLE_IDS=Collections.unmodifiableSet(new LinkedHashSet<>(
        Arrays.asList("T01","T02","T03","T04","T05","T06","T07","T08","OUTDOOR")));
    private DiningTransitionPlanner() { }

    public static final class Plan {
        public final String commandType, storeId, waitingRemoveId;
        /** Assertion only. The coordinator/serializer owns the eventual next revision. */
        public final Object diningRevision;
        public final Map<String,Object> waitingCreate, orderDining;
        /** Table values exclude revision. Order patch includes only identity + dining metadata. */
        public final List<Map<String,Object>> tableChanges, readSet;
        private Plan(String commandType, String storeId, Object diningRevision, String waitingRemoveId,
                    Map<String,Object> waitingCreate, Map<String,Object> orderDining,
                    List<Map<String,Object>> tableChanges, List<Map<String,Object>> readSet) {
            this.commandType=commandType; this.storeId=storeId; this.diningRevision=diningRevision;
            this.waitingRemoveId=waitingRemoveId;
            this.waitingCreate=waitingCreate==null?null:freeze(waitingCreate);
            this.orderDining=orderDining==null?null:freeze(orderDining);
            this.tableChanges=freezeRows(tableChanges); this.readSet=freezeRows(readSet);
        }
    }

    /**
     * canonicalRead: storeId, revision (dining), waiting[], tables[], orders[]. The last list is
     * canonical Order facts, never a converted browser draft. nativeContext: storeId, occurredAt;
     * waiting creation also requires native-allocated waitingId and displayNumber.
     */
    public static Plan plan(String commandType, Object expectedRevision, Map<String,Object> payload,
                            Map<String,Object> canonicalRead, Map<String,Object> nativeContext) {
        if("DINING_FORMAL_ADMIT".equals(commandType))throw error("DINING_CANONICAL_ADMISSION_DEPENDENCY_MISSING");
        if("DINING_ITEMS_ADD".equals(commandType))throw error("DINING_CANONICAL_ADDITION_DEPENDENCY_MISSING");
        if(!"DINING_WAITING_CREATE".equals(commandType)&&!"DINING_TABLE_ASSIGN".equals(commandType)
            &&!"DINING_TABLE_TRANSFER".equals(commandType))throw error("DINING_COMMAND_UNSUPPORTED");
        if(payload==null||nativeContext==null)throw error("DINING_INPUT_REQUIRED");
        final Read read=new Read(canonicalRead);
        if(!read.storeId.equals(text(nativeContext.get("storeId"),"DINING_STORE_IDENTITY_MISMATCH")))
            throw error("DINING_STORE_IDENTITY_MISMATCH");
        final String now=instant(nativeContext.get("occurredAt"),"DINING_NATIVE_TIME_INVALID");
        final Object asserted=revision(expectedRevision,"DINING_REVISION_INVALID");
        final List<Map<String,Object>> reads=new ArrayList<>();
        reads.add(dependency("DINING",read.storeId,read.revision));
        if("DINING_WAITING_CREATE".equals(commandType)) {
            fields(payload,"partySize","customerDisplayName","note");
            sameRevision(asserted,read.revision,"DINING_EXPECTED_REVISION_STALE");
            final String waitingId=text(nativeContext.get("waitingId"),"DINING_NATIVE_WAITING_ID_REQUIRED");
            if(read.waiting.containsKey(waitingId))throw error("DINING_WAITING_ID_CONFLICT");
            final Map<String,Object> created=values("waitingId",waitingId,
                "displayNumber",text(nativeContext.get("displayNumber"),"DINING_NATIVE_WAITING_DISPLAY_REQUIRED"),
                "partySize",positive(payload.get("partySize"),"DINING_PARTY_SIZE_INVALID"),"createdAt",now);
            if(payload.containsKey("customerDisplayName"))created.put("customerDisplayName",optionalText(payload.get("customerDisplayName")));
            // Existing payload has note; proposed native record retains it without exposing a new UI field.
            if(payload.containsKey("note"))created.put("note",optionalText(payload.get("note")));
            return new Plan(commandType,read.storeId,read.revision,null,created,null,Collections.emptyList(),reads);
        }
        if("DINING_TABLE_ASSIGN".equals(commandType)) {
            fields(payload,"waitingId","tableId","expectedTableRevision","orderId");
            sameRevision(asserted,read.revision,"DINING_EXPECTED_REVISION_STALE");
            final String waitingId=text(payload.get("waitingId"),"DINING_WAITING_ID_REQUIRED");
            final Map<String,Object> waiting=read.waiting.get(waitingId);
            if(waiting==null)throw error("DINING_WAITING_NOT_FOUND");
            final Map<String,Object> target=read.table(payload.get("tableId"));
            targetAvailable(target,payload.get("expectedTableRevision"));
            final Object orderId=waiting.get("orderId");
            if(orderId==null)throw error("DINING_EMPTY_WAIT_SEATING_SCHEMA_UNBOUND");
            if(payload.containsKey("orderId")&&!orderId.equals(text(payload.get("orderId"),"DINING_ORDER_ID_REQUIRED")))
                throw error("DINING_ORDER_IDENTITY_MISMATCH");
            final Map<String,Object> order=read.activeOrder(orderId);
            int waitingReferences=0;
            for(Map<String,Object> row:read.waiting.values())if(orderId.equals(row.get("orderId")))waitingReferences++;
            if(waitingReferences!=1)throw error("DINING_ORDER_IDENTITY_MISMATCH");
            rejectConflictingClaims(read,(String)orderId,waitingId,
                Collections.singleton((String)target.get("tableId")),"DINING_ORDER_IDENTITY_MISMATCH");
            final Map<String,Object> link=object(order.get("dining"),READ_INVALID);
            if(!waitingId.equals(link.get("waitingId"))||link.get("tableId")!=null
                ||positive(waiting.get("partySize"),READ_INVALID)!=positive(link.get("partySize"),READ_INVALID))
                throw error("DINING_ORDER_IDENTITY_MISMATCH");
            for(Map<String,Object> table:read.tables.values())if(orderId.equals(table.get("orderId")))
                throw error("DINING_ORDER_IDENTITY_MISMATCH");
            final String seatedAt=link.get("seatedAt")==null?now:instant(link.get("seatedAt"),READ_INVALID);
            final long partySize=positive(link.get("partySize"),READ_INVALID);
            reads.add(dependency("TABLE",(String)target.get("tableId"),target.get("revision")));
            reads.add(dependency("ORDER",(String)orderId,order.get("revision")));
            return new Plan(commandType,read.storeId,read.revision,waitingId,null,
                orderLink((String)orderId,(String)target.get("tableId"),partySize,seatedAt,link),
                Collections.singletonList(occupied(target,order,partySize,seatedAt)),reads);
        }
        fields(payload,"orderId","fromTableId","toTableId","expectedTableRevision");
        final Map<String,Object> order=read.activeOrder(payload.get("orderId"));
        sameRevision(asserted,order.get("revision"),"DINING_EXPECTED_REVISION_STALE");
        final String orderId=(String)order.get("orderId");
        final Map<String,Object> source=read.table(payload.get("fromTableId"));
        final Map<String,Object> target=read.table(payload.get("toTableId"));
        final Map<String,Object> link=object(order.get("dining"),READ_INVALID);
        if(!"OCCUPIED".equals(source.get("state"))||!orderId.equals(source.get("orderId"))
            ||!source.get("tableId").equals(link.get("tableId"))
            ||!Objects.equals(source.get("seatedAt"),link.get("seatedAt"))
            ||(source.get("displayNumber")!=null&&!Objects.equals(source.get("displayNumber"),order.get("displayNumber")))
            ||(source.get("partySize")!=null&&positive(source.get("partySize"),READ_INVALID)!=positive(link.get("partySize"),READ_INVALID)))
            throw error("DINING_SOURCE_IDENTITY_MISMATCH");
        for(Map<String,Object> waiting:read.waiting.values())if(orderId.equals(waiting.get("orderId")))
            throw error("DINING_SOURCE_IDENTITY_MISMATCH");
        rejectConflictingClaims(read,orderId,null,
            new HashSet<>(Arrays.asList((String)source.get("tableId"),(String)target.get("tableId"))),
            "DINING_SOURCE_IDENTITY_MISMATCH");
        targetAvailable(target,payload.get("expectedTableRevision"));
        final String seatedAt=instant(link.get("seatedAt"),READ_INVALID);
        final long partySize=positive(link.get("partySize"),READ_INVALID);
        reads.add(dependency("TABLE",(String)source.get("tableId"),source.get("revision")));
        reads.add(dependency("TABLE",(String)target.get("tableId"),target.get("revision")));
        reads.add(dependency("ORDER",orderId,order.get("revision")));
        return new Plan(commandType,read.storeId,read.revision,null,null,
            orderLink(orderId,(String)target.get("tableId"),partySize,seatedAt,link),
            Arrays.asList(tableValue(source,"AVAILABLE"),occupied(target,order,partySize,seatedAt)),reads);
    }

    private static final class Read {
        final String storeId;
        final Object revision;
        final Map<String,Map<String,Object>> tables,waiting,orders;
        Read(Map<String,Object> read) {
            if(read==null)throw error(READ_INVALID);
            storeId=text(read.get("storeId"),READ_INVALID);
            revision=revision(read.get("revision"),READ_INVALID);
            tables=index(read.get("tables"),"tableId"); waiting=index(read.get("waiting"),"waitingId");orders=index(read.get("orders"),"orderId");
            if(!tables.keySet().equals(TABLE_IDS))throw error(READ_INVALID);
            final Set<String> seatedOrderIds=new HashSet<>();
            for(Map<String,Object> table:tables.values()) {
                revision(table.get("revision"),READ_INVALID);text(table.get("label"),READ_INVALID);
                if(!Objects.equals("OUTDOOR".equals(table.get("tableId"))?"OUTDOOR":"INDOOR",table.get("location")))throw error(READ_INVALID);
                if("OCCUPIED".equals(table.get("state"))) {
                    if(!seatedOrderIds.add(text(table.get("orderId"),READ_INVALID)))throw error(READ_INVALID);
                    if(table.get("displayNumber")!=null)text(table.get("displayNumber"),READ_INVALID);
                    if(table.get("partySize")!=null)positive(table.get("partySize"),READ_INVALID);
                    instant(table.get("seatedAt"),READ_INVALID);
                } else if(!"AVAILABLE".equals(table.get("state"))||table.get("orderId")!=null||table.get("seatedAt")!=null
                    ||table.get("partySize")!=null||table.get("displayNumber")!=null)throw error(READ_INVALID);
            }
            for(Map<String,Object> item:waiting.values()) {
                text(item.get("displayNumber"),READ_INVALID);positive(item.get("partySize"),READ_INVALID);instant(item.get("createdAt"),READ_INVALID);
                if(item.get("orderId")!=null)text(item.get("orderId"),READ_INVALID);
            }
            for(Map<String,Object> order:orders.values()) {revision(order.get("revision"),READ_INVALID);text(order.get("displayNumber"),READ_INVALID);}
        }
        Map<String,Object> table(Object id) {
            final Map<String,Object> value=tables.get(text(id,"DINING_TABLE_ID_REQUIRED"));
            if(value==null)throw error("DINING_TABLE_NOT_FOUND");return value;
        }
        Map<String,Object> activeOrder(Object id) {
            final Map<String,Object> value=orders.get(text(id,"DINING_ORDER_ID_REQUIRED"));
            if(value==null)throw error("DINING_CANONICAL_ORDER_NOT_FOUND");
            if(!isActiveDiningOrder(value))throw error("DINING_ORDER_NOT_ACTIVE");
            return value;
        }
    }
    private static boolean isActiveDiningOrder(Map<String,Object> order) {
        final Object lifecycle=order.get("lifecycleState"),fulfillment=order.get("fulfillmentState");
        return "DINE_IN".equals(order.get("serviceMode"))&&(lifecycle==null||"ACTIVE".equals(lifecycle))
            &&("IN_PROGRESS".equals(fulfillment)||"READY".equals(fulfillment));
    }
    /**
     * Negative membership reads rely on the DINING read guard: every native change to live
     * Order.dining membership MUST also CAS/bump that same dining aggregate. See integration gate.
     */
    private static void rejectConflictingClaims(Read read,String selectedOrderId,String waitingId,
                                                Set<String> tableIds,String code) {
        for(Map<String,Object> other:read.orders.values()) {
            if(selectedOrderId.equals(other.get("orderId"))||!isActiveDiningOrder(other)||other.get("dining")==null)continue;
            final Map<String,Object> link=object(other.get("dining"),READ_INVALID);
            if((waitingId!=null&&waitingId.equals(link.get("waitingId")))||tableIds.contains(link.get("tableId")))throw error(code);
        }
    }
    private static Map<String,Object> tableValue(Map<String,Object> table,String state) {
        return values("tableId",table.get("tableId"),"label",table.get("label"),"location",table.get("location"),"state",state);
    }
    private static Map<String,Object> occupied(Map<String,Object> target,Map<String,Object> order,long partySize,String seatedAt) {
        final Map<String,Object> value=tableValue(target,"OCCUPIED");
        value.putAll(values("orderId",order.get("orderId"),"displayNumber",order.get("displayNumber"),"partySize",partySize,"seatedAt",seatedAt));return value;
    }
    private static Map<String,Object> orderLink(String orderId,String tableId,long partySize,String seatedAt,Map<String,Object> priorLink) {
        final Map<String,Object> result=values("orderId",orderId,"tableId",tableId,"partySize",partySize,"seatedAt",seatedAt);
        // A6-26 explicitly retains waiting identity on a seated Order; queue membership is separate.
        if(priorLink.get("waitingId")!=null)result.put("waitingId",text(priorLink.get("waitingId"),READ_INVALID));
        return result;
    }
    private static Map<String,Object> dependency(String kind,String id,Object revision) {
        return values("kind",kind,"id",id,"revision",revision(revision,READ_INVALID));
    }
    private static void targetAvailable(Map<String,Object> target,Object asserted) {
        sameRevision(revision(asserted,"DINING_REVISION_INVALID"),target.get("revision"),"DINING_TABLE_REVISION_STALE");
        if(!"AVAILABLE".equals(target.get("state")))throw error("DINING_TABLE_OCCUPIED");
    }
    private static void sameRevision(Object actual,Object expected,String code) {
        if(!Objects.equals(revision(actual,"DINING_REVISION_INVALID"),revision(expected,READ_INVALID)))throw error(code);
    }
    private static Object revision(Object value,String code) {
        if(value instanceof String)return text(value,code);
        final long number=integer(value,code);if(number<0)throw error(code);return number;
    }
    private static long positive(Object value,String code) {final long n=integer(value,code);if(n<1)throw error(code);return n;}
    private static long integer(Object value,String code) {
        if(!(value instanceof Number))throw error(code);
        try {
            final long n=new BigDecimal(value.toString()).longValueExact();
            if(n < -9_007_199_254_740_991L || n > 9_007_199_254_740_991L)throw error(code);
            return n;
        } catch(NumberFormatException | ArithmeticException invalid) {throw error(code);}
    }
    private static String text(Object value,String code) {
        if(!(value instanceof String))throw error(code);
        final String s=(String)value;if(s.isEmpty()||!s.equals(s.trim())||s.length()>240)throw error(code);return s;
    }
    private static String optionalText(Object value) {
        if(!(value instanceof String)||((String)value).length()>262_144)throw error("DINING_PAYLOAD_TEXT_INVALID");return (String)value;
    }
    private static String instant(Object value,String code) {
        final String s=text(value,code);try{Instant.parse(s);}catch(DateTimeParseException e){throw error(code);}return s;
    }
    private static void fields(Map<String,Object> value,String... allowed) {
        final Set<String> names=new HashSet<>(Arrays.asList(allowed));
        for(String key:value.keySet())if(!names.contains(key))throw error("DINING_PAYLOAD_FIELD_UNSUPPORTED");
    }
    private static Map<String,Map<String,Object>> index(Object value,String idKey) {
        if(!(value instanceof List))throw error(READ_INVALID);
        final Map<String,Map<String,Object>> result=new LinkedHashMap<>();
        for(Object item:(List<?>)value) {final Map<String,Object> row=object(item,READ_INVALID);
            if(result.put(text(row.get(idKey),READ_INVALID),row)!=null)throw error(READ_INVALID);}
        return result;
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> object(Object value,String code) {
        if(!(value instanceof Map))throw error(code);return (Map<String,Object>)value;
    }
    private static Map<String,Object> values(Object... pairs) {
        final Map<String,Object> result=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]);return result;
    }
    private static Map<String,Object> freeze(Map<String,Object> value) {
        // All generated values are scalar. No caller-owned nested containers enter a Plan.
        return Collections.unmodifiableMap(new LinkedHashMap<>(value));
    }
    private static List<Map<String,Object>> freezeRows(List<Map<String,Object>> values) {
        final List<Map<String,Object>> copy=new ArrayList<>();for(Map<String,Object> value:values)copy.add(freeze(value));
        return Collections.unmodifiableList(copy);
    }
    private static IllegalArgumentException error(String code) {return new IllegalArgumentException(code);}
}
