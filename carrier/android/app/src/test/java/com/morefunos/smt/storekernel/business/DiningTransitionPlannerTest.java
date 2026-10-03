package com.morefunos.smt.storekernel.business;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class DiningTransitionPlannerTest {
    static final String NOW="2026-10-03T01:20:00Z", FIRST="2026-10-03T01:00:00Z";
    static int passed,failed;
    public static void main(String[] args) throws Exception {
        passed=0; failed=0;
        test("waiting creates no Order/table/print/money mutation",()->{
            DiningTransitionPlanner.Plan p=create(snapshot());
            eq("W2",p.waitingCreate.get("waitingId")); eq("Q002",p.waitingCreate.get("displayNumber"));
            eq(3L,p.waitingCreate.get("partySize")); eq(NOW,p.waitingCreate.get("createdAt"));
            eq("窗邊",p.waitingCreate.get("note")); eq(null,p.waitingCreate.get("orderId"));
            eq(null,p.orderDining); eq(0,p.tableChanges.size()); eq(null,p.waitingRemoveId); eq(1,p.readSet.size());
        });
        test("waiting uses canonical native identity/time, never browser identity",()->{
            Map<String,Object> payload=map("partySize",3,"waitingId","evil");
            reject("DINING_PAYLOAD_FIELD_UNSUPPORTED",()->plan("DINING_WAITING_CREATE",10,payload,snapshot()));
        });
        test("waiting stale dining revision rejected",()->reject("DINING_EXPECTED_REVISION_STALE",()->plan("DINING_WAITING_CREATE",9,map("partySize",3),snapshot())));
        test("waiting duplicate identity rejected",()->{
            Map<String,Object> s=snapshot(); rows(s,"waiting").add(wait("W2",null));
            reject("DINING_WAITING_ID_CONFLICT",()->create(s));
        });
        test("waiting partySize invalid rejected",()->{
            for(Object n:Arrays.asList(0,-1,1.5,"3",Double.NaN,9007199254740992L))
                reject("DINING_PARTY_SIZE_INVALID",()->plan("DINING_WAITING_CREATE",10,map("partySize",n),snapshot()));
        });
        test("ordered waiting assignment preserves same Order/display and real seating time",()->{
            DiningTransitionPlanner.Plan p=assign(snapshot());
            eq("W1",p.waitingRemoveId); eq(null,p.waitingCreate); eq("O1",p.orderDining.get("orderId"));
            eq("0001",p.tableChanges.get(0).get("displayNumber")); eq("T01",p.orderDining.get("tableId"));
            eq(NOW,p.orderDining.get("seatedAt")); eq(3,p.readSet.size());
            eq("W1",p.orderDining.get("waitingId")); eq(Set.of("orderId","waitingId","tableId","partySize","seatedAt"),p.orderDining.keySet());
        });
        test("assignment does not trust optional client orderId",()->reject("DINING_ORDER_IDENTITY_MISMATCH",()->plan("DINING_TABLE_ASSIGN",10,map("waitingId","W1","tableId","T01","expectedTableRevision",4,"orderId","OTHER"),snapshot())));
        test("assignment optional orderId is resolved from canonical waiting",()->eq("O1",assign(snapshot()).orderDining.get("orderId")));
        test("assignment stale destination revision rejected",()->reject("DINING_TABLE_REVISION_STALE",()->plan("DINING_TABLE_ASSIGN",10,map("waitingId","W1","tableId","T01","expectedTableRevision",3),snapshot())));
        test("assignment occupied target rejected",()->{
            Map<String,Object> s=snapshot(); occupied(s,"T01","O2",FIRST);
            reject("DINING_TABLE_OCCUPIED",()->assign(s));
        });
        test("assignment empty wait explicitly blocked without manufacturing Order",()->{
            Map<String,Object> s=snapshot(); rows(s,"waiting").set(0,wait("W1",null));
            reject("DINING_EMPTY_WAIT_SEATING_SCHEMA_UNBOUND",()->assign(s));
        });
        test("assignment absent waiting rejected",()->{Map<String,Object>s=snapshot();rows(s,"waiting").clear();reject("DINING_WAITING_NOT_FOUND",()->assign(s));});
        test("assignment preserves prior seatedAt on existing canonical dining link",()->{
            Map<String,Object>s=snapshot(); obj(order(s,"O1").get("dining")).put("seatedAt",FIRST);
            eq(FIRST,assign(s).orderDining.get("seatedAt"));
        });
        test("transfer clears source, occupies destination, preserves same Order and first seatedAt",()->{
            Map<String,Object>s=seated(); Map<String,Object> before=deep(s);
            DiningTransitionPlanner.Plan p=transfer(s);
            eq(2,p.tableChanges.size()); eq("AVAILABLE",p.tableChanges.get(0).get("state"));
            eq(null,p.tableChanges.get(0).get("orderId")); eq("OCCUPIED",p.tableChanges.get(1).get("state"));
            eq("O1",p.tableChanges.get(1).get("orderId")); eq("0001",p.tableChanges.get(1).get("displayNumber"));
            eq(FIRST,p.tableChanges.get(1).get("seatedAt")); eq("T02",p.orderDining.get("tableId"));
            eq(4,p.readSet.size()); eq(before,s);
        });
        test("transfer expectedRevision is Order revision, not dining revision",()->reject("DINING_EXPECTED_REVISION_STALE",()->plan("DINING_TABLE_TRANSFER",10,movePayload(),seated())));
        test("transfer stale destination rejected",()->{Map<String,Object>p=movePayload();p.put("expectedTableRevision",3);reject("DINING_TABLE_REVISION_STALE",()->plan("DINING_TABLE_TRANSFER",7,p,seated()));});
        test("transfer occupied destination rejected without source release",()->{Map<String,Object>s=seated();occupied(s,"T02","O2",FIRST);Map<String,Object>b=deep(s);reject("DINING_TABLE_OCCUPIED",()->transfer(s));eq(b,s);});
        test("transfer wrong source fails closed",()->{Map<String,Object>p=movePayload();p.put("fromTableId","T03");reject("DINING_SOURCE_IDENTITY_MISMATCH",()->plan("DINING_TABLE_TRANSFER",7,p,seated()));});
        test("transfer requires available destination even when source equals target",()->{Map<String,Object>p=movePayload();p.put("toTableId","T01");reject("DINING_TABLE_OCCUPIED",()->plan("DINING_TABLE_TRANSFER",7,p,seated()));});
        test("transfer rejects completed/cancelled/non-dining Order",()->{
            for(String state:List.of("COMPLETED","CANCELLED")){Map<String,Object>s=seated();order(s,"O1").put("lifecycleState",state);reject("DINING_ORDER_NOT_ACTIVE",()->transfer(s));}
            Map<String,Object>s=seated();order(s,"O1").put("serviceMode","TAKEAWAY");reject("DINING_ORDER_NOT_ACTIVE",()->transfer(s));
        });
        test("inconsistent source/table/Order seating facts fail closed",()->{
            Map<String,Object>s=seated();obj(order(s,"O1").get("dining")).put("seatedAt",NOW);reject("DINING_SOURCE_IDENTITY_MISMATCH",()->transfer(s));
        });
        test("revision strings remain opaque, numeric string is not numeric revision",()->{
            Map<String,Object>s=snapshot();s.put("revision","R10");
            eq("R10",plan("DINING_WAITING_CREATE","R10",map("partySize",2),s).diningRevision);
            reject("DINING_EXPECTED_REVISION_STALE",()->plan("DINING_WAITING_CREATE","10",map("partySize",2),snapshot()));
        });
        test("canonical read and plan are isolated from mutable caller containers",()->{
            Map<String,Object>s=snapshot();DiningTransitionPlanner.Plan p=assign(s);table(s,"T01").put("label","CHANGED");
            eq("Table 1",p.tableChanges.get(0).get("label"));
            expectUnsupported(()->p.tableChanges.get(0).put("state","AVAILABLE"));expectUnsupported(()->p.readSet.clear());
            expectUnsupported(()->p.orderDining.put("tableId","T08"));
        });
        test("duplicate table registry or duplicated canonical Order identity rejected",()->{
            Map<String,Object>s=snapshot();rows(s,"tables").set(1,deep(table(s,"T01")));reject("DINING_CANONICAL_READ_INVALID",()->assign(s));
            Map<String,Object>t=snapshot();rows(t,"orders").add(deep(order(t,"O1")));reject("DINING_CANONICAL_READ_INVALID",()->assign(t));
        });
        test("cross-store native context rejected",()->{
            Map<String,Object>ctx=context();ctx.put("storeId","OTHER");reject("DINING_STORE_IDENTITY_MISMATCH",()->DiningTransitionPlanner.plan("DINING_WAITING_CREATE",10,map("partySize",2),snapshot(),ctx));
        });
        test("admission and additions expose dependencies and never mint a paid Order",()->{
            reject("DINING_CANONICAL_ADMISSION_DEPENDENCY_MISSING",()->plan("DINING_FORMAL_ADMIT",10,map(),snapshot()));
            reject("DINING_CANONICAL_ADDITION_DEPENDENCY_MISSING",()->plan("DINING_ITEMS_ADD",7,map(),seated()));
        });
        test("open/close/release and financial commands unsupported even for unresolved Order",()->{
            for(String c:List.of("DINING_TABLE_CLOSE","DINING_TABLE_OPEN","DINING_TABLE_RELEASE","ORDER_CANCEL","ORDER_REFUND"))
                reject("DINING_COMMAND_UNSUPPORTED",()->plan(c,7,map(),seated()));
        });
        test("unknown payload fields cannot smuggle state or paid values",()->{
            for(String key:List.of("aggregateType","stateJson","recognizedAmountMinor","mutations","createdAt")){
                Map<String,Object>p=movePayload();p.put(key,"forged");reject("DINING_PAYLOAD_FIELD_UNSUPPORTED",()->plan("DINING_TABLE_TRANSFER",7,p,seated()));
            }
        });
        test("Stage 6 transition changes only dining metadata, never payment/items",()->{
            MemoryCas integration=new MemoryCas(snapshot()); Map<String,Object>originalOrder=deep(order(integration.state,"O1"));
            integration.commit("assign","hash-assign",assign(integration.state));
            eq(8L,order(integration.state,"O1").get("revision"));
            DiningTransitionPlanner.Plan move=plan("DINING_TABLE_TRANSFER",8,movePayload(),integration.state);
            integration.commit("move","hash-move",move);
            eq("T02",obj(order(integration.state,"O1").get("dining")).get("tableId"));
            for(String key:List.of("displayNumber","items","recognizedAmountMinor","outstandingAmountMinor","effectiveTenderId","adjustments"))eq(originalOrder.get(key),order(integration.state,"O1").get(key));
            eq(1,rows(integration.state,"orders").size());eq(0,rows(integration.state,"waiting").size());eq(2,integration.commits);
        });
        test("test-only CAS rejects source/order/target/dining drift after plan",()->{
            for(String scope:List.of("DINING","TABLE_SOURCE","TABLE_TARGET","ORDER")){
                MemoryCas cas=new MemoryCas(seated());DiningTransitionPlanner.Plan p=transfer(cas.state);
                if(scope.equals("DINING"))cas.state.put("revision",11L);
                else if(scope.equals("ORDER"))order(cas.state,"O1").put("revision",8L);
                else table(cas.state,scope.equals("TABLE_SOURCE")?"T01":"T02").put("revision",5L);
                reject("TEST_CAS_STALE",()->cas.commit("move","hash",p));eq(0,cas.commits);
            }
        });
        test("test-only competing destination plans commit at most one",()->{
            MemoryCas cas=new MemoryCas(seated());DiningTransitionPlanner.Plan a=transfer(cas.state),b=transfer(cas.state);
            CountDownLatch start=new CountDownLatch(1);AtomicInteger good=new AtomicInteger(),stale=new AtomicInteger();
            ExecutorService pool=Executors.newFixedThreadPool(2);List<Future<?>>fs=new ArrayList<>();
            for(int i=0;i<2;i++){final int n=i;fs.add(pool.submit(()->{try{start.await();cas.commit("m"+n,"h"+n,n==0?a:b);good.incrementAndGet();}catch(IllegalArgumentException e){if(!e.getMessage().equals("TEST_CAS_STALE"))throw e;stale.incrementAndGet();}catch(InterruptedException e){throw new RuntimeException(e);}}));}
            start.countDown();for(Future<?>f:fs)f.get();pool.shutdown();eq(1,good.get());eq(1,stale.get());eq(1,cas.commits);
        });
        test("test-only receipt-first repeat replays once and fingerprint mismatch fails",()->{
            MemoryCas cas=new MemoryCas(seated());DiningTransitionPlanner.Plan p=transfer(cas.state);
            String receipt=cas.commit("move","hash",p);eq(receipt,cas.commit("move","hash",p));eq(1,cas.commits);
            reject("TEST_FINGERPRINT_CONFLICT",()->cas.commit("move","other",p));eq(1,cas.commits);
        });
        test("exact numeric input rejects fraction hidden by floating point rounding",()->{
            reject("DINING_PARTY_SIZE_INVALID",()->plan("DINING_WAITING_CREATE",10,map("partySize",new java.math.BigDecimal("1.00000000000000000001")),snapshot()));
        });
        test("waiting-linked Order cannot be transferred while still in queue",()->{
            Map<String,Object>s=seated();rows(s,"waiting").add(wait("W1","O1"));
            reject("DINING_SOURCE_IDENTITY_MISMATCH",()->transfer(s));
        });
        test("optional occupied table display and party fields derive from canonical Order",()->{
            Map<String,Object>s=seated();table(s,"T01").remove("displayNumber");table(s,"T01").remove("partySize");
            DiningTransitionPlanner.Plan p=transfer(s);eq("0001",p.tableChanges.get(1).get("displayNumber"));eq(2L,p.tableChanges.get(1).get("partySize"));
        });
        test("historical waiting identity survives transfer without a live queue row",()->{
            Map<String,Object>s=seated();obj(order(s,"O1").get("dining")).put("waitingId","W1");
            eq("W1",transfer(s).orderDining.get("waitingId"));
        });
        test("duplicate live waiting rows for one Order fail closed",()->{
            Map<String,Object>s=snapshot();rows(s,"waiting").add(wait("W3","O1"));
            reject("DINING_ORDER_IDENTITY_MISMATCH",()->assign(s));
        });
        test("another active Order cannot claim assignment waiting or destination",()->{
            for(String key:List.of("waitingId","tableId")){
                Map<String,Object>s=snapshot(),other=deep(order(s,"O1"));other.put("orderId","O2");other.put("displayNumber","0002");
                other.put("dining",map(key,key.equals("waitingId")?"W1":"T01","partySize",2L));rows(s,"orders").add(other);
                reject("DINING_ORDER_IDENTITY_MISMATCH",()->assign(s));
            }
        });
        test("another active Order cannot claim transfer source or destination",()->{
            for(String id:List.of("T01","T02")){
                Map<String,Object>s=seated(),other=deep(order(s,"O1"));other.put("orderId","O2");other.put("displayNumber","0002");
                other.put("dining",map("tableId",id,"partySize",2L,"seatedAt",FIRST));rows(s,"orders").add(other);
                reject("DINING_SOURCE_IDENTITY_MISMATCH",()->transfer(s));
            }
        });
        test("completed historical Order table links do not claim present occupancy",()->{
            Map<String,Object>s=seated(),other=deep(order(s,"O1"));other.put("orderId","O2");other.put("lifecycleState","COMPLETED");
            other.put("dining",map("tableId","T02","partySize",2L,"seatedAt",FIRST));rows(s,"orders").add(other);
            eq("T02",transfer(s).orderDining.get("tableId"));
        });
        System.out.println("TOTAL: "+passed+" passed, "+failed+" failed"); if(failed>0)throw new AssertionError("Dining planner scenario failures: "+failed);
    }
    interface Checked {void run() throws Exception;}
    static void test(String n,Checked r){try{r.run();passed++;System.out.println("PASS "+n);}catch(Throwable e){failed++;System.out.println("FAIL "+n+": "+e);}}
    static void eq(Object a,Object b){if(!Objects.equals(a,b))throw new AssertionError("expected "+a+" but got "+b);}
    static void reject(String code,Checked r){try{r.run();throw new AssertionError("expected "+code);}catch(IllegalArgumentException e){eq(code,e.getMessage());}catch(Exception e){throw new RuntimeException(e);}}
    static void expectUnsupported(Checked r){try{r.run();throw new AssertionError("mutable plan");}catch(UnsupportedOperationException ok){}catch(Exception e){throw new RuntimeException(e);}}
    static Map<String,Object>map(Object...xs){Map<String,Object>m=new LinkedHashMap<>();for(int i=0;i<xs.length;i+=2)m.put((String)xs[i],xs[i+1]);return m;}
    @SuppressWarnings("unchecked")static Map<String,Object>obj(Object o){return (Map<String,Object>)o;}
    @SuppressWarnings("unchecked")static List<Map<String,Object>>rows(Map<String,Object>s,String key){return (List<Map<String,Object>>)s.get(key);}
    static Map<String,Object>deep(Map<String,Object>m){Map<String,Object>r=new LinkedHashMap<>();m.forEach((k,v)->r.put(k,copy(v)));return r;}
    static Object copy(Object o){if(o instanceof Map)return deep(obj(o));if(o instanceof List){List<Object>r=new ArrayList<>();for(Object v:(List<?>)o)r.add(copy(v));return r;}return o;}
    static Map<String,Object>context(){return map("storeId","MF01","waitingId","W2","displayNumber","Q002","occurredAt",NOW);}
    static Map<String,Object>wait(String id,String order){Map<String,Object>w=map("waitingId",id,"displayNumber","Q001","partySize",2L,"createdAt",FIRST);if(order!=null)w.put("orderId",order);return w;}
    static Map<String,Object>snapshot(){
        List<Map<String,Object>>tables=new ArrayList<>();for(int i=1;i<=9;i++)tables.add(map("tableId",i==9?"OUTDOOR":String.format("T%02d",i),"label","Table "+i,"location",i==9?"OUTDOOR":"INDOOR","revision",4L,"state","AVAILABLE"));
        Map<String,Object>o=map("orderId","O1","displayNumber","0001","revision",7L,"lifecycleState","ACTIVE","fulfillmentState","IN_PROGRESS","serviceMode","DINE_IN","dining",map("waitingId","W1","partySize",2L),"items",List.of(map("lineId","L1","quantity",2)),"recognizedAmountMinor",1200L,"outstandingAmountMinor",1300L,"effectiveTenderId","FPS","adjustments",List.of());
        return map("storeId","MF01","revision",10L,"waiting",new ArrayList<>(List.of(wait("W1","O1"))),"tables",tables,"orders",new ArrayList<>(List.of(o)));
    }
    static Map<String,Object>table(Map<String,Object>s,String id){return rows(s,"tables").stream().filter(t->id.equals(t.get("tableId"))).findFirst().orElseThrow();}
    static Map<String,Object>order(Map<String,Object>s,String id){return rows(s,"orders").stream().filter(t->id.equals(t.get("orderId"))).findFirst().orElseThrow();}
    static void occupied(Map<String,Object>s,String table,String order,String time){table(s,table).putAll(map("state","OCCUPIED","orderId",order,"displayNumber","0001","partySize",2L,"seatedAt",time));}
    static Map<String,Object>seated(){Map<String,Object>s=snapshot();rows(s,"waiting").clear();occupied(s,"T01","O1",FIRST);order(s,"O1").put("dining",map("tableId","T01","partySize",2L,"seatedAt",FIRST));return s;}
    static Map<String,Object>movePayload(){return map("orderId","O1","fromTableId","T01","toTableId","T02","expectedTableRevision",4L);}
    static DiningTransitionPlanner.Plan plan(String c,Object r,Map<String,Object>p,Map<String,Object>s){return DiningTransitionPlanner.plan(c,r,p,s,context());}
    static DiningTransitionPlanner.Plan create(Map<String,Object>s){return plan("DINING_WAITING_CREATE",10,map("partySize",3,"customerDisplayName","May","note","窗邊"),s);}
    static DiningTransitionPlanner.Plan assign(Map<String,Object>s){return plan("DINING_TABLE_ASSIGN",10,map("waitingId","W1","tableId","T01","expectedTableRevision",4),s);}
    static DiningTransitionPlanner.Plan transfer(Map<String,Object>s){return plan("DINING_TABLE_TRANSFER",7,movePayload(),s);}
    /** Explicit test-only integration model, not StoreKernel/Room or production authority. */
    static final class MemoryCas {
        Map<String,Object>state;int commits;Map<String,String>fingerprints=new HashMap<>(),receipts=new HashMap<>();
        MemoryCas(Map<String,Object>s){state=deep(s);}
        synchronized String commit(String id,String fingerprint,DiningTransitionPlanner.Plan p){
            if(receipts.containsKey(id)){if(!fingerprint.equals(fingerprints.get(id)))throw new IllegalArgumentException("TEST_FINGERPRINT_CONFLICT");return receipts.get(id);}
            for(Map<String,Object>d:p.readSet){Object rev;
                switch((String)d.get("kind")){case "DINING":rev=state.get("revision");break;case "TABLE":rev=table(state,(String)d.get("id")).get("revision");break;case "ORDER":rev=order(state,(String)d.get("id")).get("revision");break;default:throw new AssertionError(d);}
                if(!Objects.equals(rev,d.get("revision")))throw new IllegalArgumentException("TEST_CAS_STALE");
            }
            Map<String,Object>next=deep(state);if(p.waitingCreate!=null)rows(next,"waiting").add(deep(p.waitingCreate));if(p.waitingRemoveId!=null)rows(next,"waiting").removeIf(w->p.waitingRemoveId.equals(w.get("waitingId")));
            for(Map<String,Object>change:p.tableChanges){Map<String,Object>t=table(next,(String)change.get("tableId"));long rev=((Number)t.get("revision")).longValue();t.clear();t.putAll(deep(change));t.put("revision",rev+1);}
            if(p.orderDining!=null){Map<String,Object>o=order(next,(String)p.orderDining.get("orderId")),link=deep(p.orderDining);link.remove("orderId");o.put("dining",link);o.put("revision",((Number)o.get("revision")).longValue()+1);}
            next.put("revision",((Number)next.get("revision")).longValue()+1);state=next;commits++;String receipt="RECEIPT-"+commits;receipts.put(id,receipt);fingerprints.put(id,fingerprint);return receipt;
        }
    }
}
