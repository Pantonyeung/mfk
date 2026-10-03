import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const domain=read('./print-hardware-domain.ts');
const runtime=read('./print-hardware-runtime.tsx');
const workspace=read('./print-hardware-workspace.tsx');
const operations=read('./order-operations-workspace.tsx');
const operationsRuntime=read('./order-operations-runtime.tsx');
const state=read('./state-authority.ts');
const checkout=read('./checkout-domain.ts')+read('./checkout-runtime.ts')+read('./checkout-workspace.tsx');
const printSource=domain+runtime+workspace;
const gateway=read('../../carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/NativePrintGatewayService.java');
const gatewayStore=read('../../carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/PrintGatewayStore.java');
const carrierBindings=read('../../carrier/android/app/src/main/java/com/morefunos/smt/print/SitePrinterBindingStore.java');
const workflow=read('../../.github/workflows/v3smt-a0-foundation.yml');

type Gate=readonly [number,string,()=>void];
const has=(id:number,name:string,source:string,...tokens:string[]):Gate=>[id,name,()=>tokens.forEach(token=>expect(source).toContain(token))];
const lacks=(id:number,name:string,source:string,pattern:RegExp):Gate=>[id,name,()=>expect(source).not.toMatch(pattern)];

const gates:readonly Gate[]=[
  has(1,'persisted-before-send recovery keeps one canonical job',gateway+gatewayStore,'recoverDurableQueue()','"PERSISTED"','canonicalPrintJobId'),
  has(2,'DISPATCHING restart becomes AMBIGUOUS',gateway,'"DISPATCHING".equals(state)','"AMBIGUOUS_AFTER_SEND"','PRINT_GATEWAY_PROCESS_RESTART_OUTCOME_UNKNOWN'),
  has(3,'ambiguous job has no automatic redispatch',gateway,'if ("DISPATCHING".equals(state))','continue;'),
  has(4,'acknowledged job is outside restart recovery',gatewayStore,"WHERE state IN ('PERSISTED','DISPATCHING')"),
  lacks(5,'UNKNOWN cannot become DONE',domain,/UNKNOWN.{0,80}DONE|DONE.{0,80}UNKNOWN/s),
  has(6,'UNKNOWN cannot become failed-before-send',domain,"if(value==='UNKNOWN')return'AMBIGUOUS_AFTER_SEND'"),
  has(7,'human reprint requires a new identity',domain,'MFP_REPRINT_IDENTITY_REUSED','humanConfirmed:true'),
  has(8,'canonical PrintJob identity comes from readback',domain,'MFP_PRINT_READ_SCHEMA','canonicalPrintJobId'),
  lacks(9,'UI cannot manufacture a canonical PrintJob',workspace,/canonicalPrintJobId\s*:/),
  has(10,'component mount only reads print state',runtime,'queryFn:session.read','refetchInterval:false'),
  has(11,'duplicate click coalesces one formal request',domain,'const inflight=new Map','runOnce(request.requestId'),
  has(12,'job and order linkage are preserved',domain,'readonly orderId?:string','item.job.orderId!==request.orderId'),
  has(13,'canonical id reaches gateway',domain,'canonicalPrintJobId:job.canonicalPrintJobId'),
  has(14,'dispatch attempt stays stable',domain,'dispatchAttemptId','snapshot.lastJob?.dispatchAttemptId===dispatchAttemptId'),
  has(15,'payload digest identity is preserved',domain,'MFP_PRINT_PAYLOAD_DIGEST_MISMATCH','payloadDigest'),
  has(16,'missing or corrupt physical target fails before send',domain,'MFP_PRINT_BINDING_MISSING','MFP_PRINTER_ENDPOINT_INVALID'),
  has(17,'browser timeout remains uncertain',domain,'MFP_PRINT_GATEWAY_READBACK_UNCONFIRMED','AMBIGUOUS_AFTER_SEND'),
  lacks(18,'print readback has no periodic polling',printSource,/setInterval\s*\(|refetchInterval\s*:\s*[1-9]/),
  has(19,'physical binding is read from durable carrier',domain+carrierBindings,'readEndpointBindings','SharedPreferences'),
  has(20,'invalid host and port fail closed',domain,'MFP_PRINTER_ENDPOINT_INVALID','port!>65535'),
  lacks(21,'local binding cannot define product routing',domain,/productIds?|categoryIds?/),
  has(22,'test and probe stay gateway-only',domain,'probeEndpoint:(bindingId:string)=>binding.gateway.probeEndpoint','testEndpoint:(bindingId:string)=>binding.gateway.testEndpoint'),
  has(23,'reachability is not paper proof',workspace,'Transport Evidence ≠ Physical Paper Proof','不代表實體已出紙'),
  has(24,'first output requires formal Print authority',domain,'authority.authorizeDispatch(canonicalPrintJobId)'),
  lacks(25,'opening Order Detail creates no initial print job',operations,/OrderDetail[\s\S]{0,180}dispatchCanonical/),
  has(26,'restart deduplicates same attempt',domain,'snapshot.lastJob?.dispatchAttemptId===dispatchAttemptId'),
  has(27,'Reprint lives in Order Detail',operations,'Order Detail → Reprint','>重印</button>'),
  has(28,'receipt uses whole-ticket reprint',workspace,"kind:'WHOLE_TICKET'",'RECEIPT'),
  has(29,'production uses whole-ticket reprint',workspace,"kind:'WHOLE_TICKET'",'PRODUCTION'),
  has(30,'packing uses whole-ticket reprint',workspace,"kind:'WHOLE_TICKET'",'PACKING'),
  has(31,'labels select a route',workspace,'Label Route','setRoute'),
  has(32,'labels support all-select',workspace,'All Select','routeJobs.map'),
  has(33,'labels support multi-select',workspace,'selectedLabels','type="checkbox"'),
  has(34,'labels support partial selection',domain+workspace,'selectMfpLabelJobs','重印已選'),
  has(35,'one label route cannot affect another',domain,'job.logicalDestinationId===routeId','MFP_REPRINT_LABEL_SELECTION_INVALID'),
  has(36,'reprint preserves Order truth',domain,'item.job.orderId!==request.orderId'),
  lacks(37,'reprint cannot charge Payment',domain,/requestReprint[\s\S]{0,900}(charge|submitPayment|CHECKOUT_PAYMENT_CONFIRM)/),
  has(38,'reprint suppresses drawer',domain,"item.job.purpose!=='REPRINT'||item.job.kickDrawer"),
  lacks(39,'reprint cannot replay production admission',domain,/requestReprint[\s\S]{0,900}(ADMIT_DINING_ORDER|ORDER_CREATE)/),
  has(40,'unpaid table ticket is a print type, not payment truth',domain+workspace,"'TABLE_TICKET'",'Printed ≠ Paid ≠ Completed'),
  has(41,'Dining initial print uses the shared authority',operations+domain,'context="DINING"','authorizeDispatch'),
  lacks(42,'waiting-to-table transfer does not dispatch print',operations.slice(operations.indexOf("kind:'TRANSFER_TABLE'"),operations.indexOf("kind:'TRANSFER_TABLE'")+500),/dispatch|print/i),
  has(43,'Dining addition requires material delta refs',domain,'DINING_ADDITION','MFP_PRINT_DELTA_ITEMS_REQUIRED','materialItemRefs'),
  has(44,'Dining payment receipt requires canonical payment ref',domain,'PAYMENT_RECEIPT','MFP_PRINT_PAYMENT_REF_REQUIRED'),
  has(45,'Dining labels retain per-label selection',workspace,'context===\'DINING\'','labelIds:selectedLabels'),
  has(46,'cancel creates or observes one formal notice',domain+operationsRuntime,'ensureCancelNotice','CANCEL_NOTICE_REQUIRED','MFP-A7-CANCEL-'),
  has(47,'duplicate cancel observes existing notice',domain,"job.jobType==='CANCEL_NOTICE'","if(existing)"),
  has(48,'modification creates no auto correction print',operations,'不會自動補印更正單'),
  lacks(49,'Checkout open has no drawer pulse',checkout,/kickDrawer|drawerPin|DRAWER/),
  lacks(50,'tender selection has no drawer pulse',checkout,/kickDrawer|drawerPin|DRAWER/),
  lacks(51,'Final Review has no drawer pulse',checkout,/kickDrawer|drawerPin|DRAWER/),
  lacks(52,'Payment Correction has no drawer pulse',operations.slice(operations.indexOf("setForm('PAYMENT')"),operations.indexOf("setForm('PAYMENT')")+300),/drawer|kick/i),
  has(53,'Reprint has no drawer pulse',domain,'MFP_PRINT_DRAWER_POLICY_INVALID','MFP_REPRINT_POLICY_INVALID'),
  has(54,'failed or UNKNOWN payment cannot pulse drawer',domain,"row.jobType!=='RECEIPT'||row.purpose!=='PAYMENT_RECEIPT'"),
  has(55,'formal cash receipt may carry one drawer request',domain,'readonly kickDrawer:boolean','PAYMENT_RECEIPT'),
  has(56,'duplicate drawer readback cannot enqueue twice',domain,'snapshot.lastJob?.dispatchAttemptId===dispatchAttemptId'),
  has(57,'failed-before-send is distinct in UI',workspace,"FAILED_BEFORE_SEND:'送出前失敗'",'正式安全重試'),
  has(58,'ambiguous-after-send is distinct in UI',workspace,"AMBIGUOUS_AFTER_SEND:'結果未能確認'",'無普通 Retry'),
  has(59,'missing binding is visible',domain+workspace,'MISSING_BINDING','Missing Binding'),
  has(60,'unknown job requires human action',domain+workspace,"kind:'HUMAN_CHECK'",'人工檢查'),
  lacks(61,'UNKNOWN has no blind retry button',workspace.slice(workspace.lastIndexOf("job.transportState==='AMBIGUOUS_AFTER_SEND'"),workspace.lastIndexOf("job.transportState==='AMBIGUOUS_AFTER_SEND'")+350),/onClick=\{\(\)=>void retry/),
  has(62,'browser reload reconstructs from readback',runtime+domain,'queryFn:session.read','readGatewaySnapshot','readEndpointBindings'),
  has(63,'carrier restart recovery semantics remain intact',gateway,'recoverDurableQueue()','AMBIGUOUS_AFTER_SEND'),
  lacks(64,'local print has no unrelated cloud fetch',printSource,/\bfetch\s*\(|XMLHttpRequest|WebSocket/),
  lacks(65,'printer failure cannot freeze transaction UI',operationsRuntime,/await\s+printSession|throw\s+new Error\([^)]*PRINT/),
  has(66,'binding corruption fails visibly',domain+workspace,'bindingError','Invalid Config'),
  has(67,'A1 Store Kernel remains canonical',read('./store-kernel-port.ts'),'createMfpSurfacePorts','readSubmission'),
  has(68,'A2 security remains fail-closed',read('./security-port.ts'),'precheckFrontlineAction','submitFrontlineFormalCommand'),
  has(69,'A3 sync remains atomic and event-driven',read('./sync-port.ts')+read('./sync-runtime.ts'),'commitAtomically(candidate)','sync.resumed()'),
  has(70,'A4 ordering remains draft-only',read('./ordering-domain.ts'),"draftOnly:true","pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS'"),
  has(71,'A5 checkout and money remain canonical',checkout+read('./money-domain.ts'),"commandType:'CHECKOUT_PAYMENT_CONFIRM'","reportVersion:'1.0'"),
  has(72,'A6 order operations remain canonical',read('./order-operations-domain.ts'),'createMfpOrderOperationSession','submitFrontlineFormalCommand'),
  lacks(73,'A7 imports no v2 client state',printSource,/v2local|v2smm|localStorage|sessionStorage/),
  lacks(74,'A7 creates no SMM authority',printSource,/SMM_INTENT_STORE|HeadSeq|x-mfk-smm-session|mfk-smm-web/),
  lacks(75,'A7 creates no second business engine',printSource,/class\s+\w*(?:Print|Order|Payment|Pricing)(?:Engine|Authority)/),
  lacks(76,'browser does not own DurablePrintJob',printSource+state,/Dexie.*Print|printJobs!:\s*Table|durablePrint/i),
  has(77,'A7 contains no production deploy config',workflow,"wrangler_paths=$(find v3smt -iname 'wrangler*' -print)","reject_matches grep -RInE --exclude='*.test.ts' --exclude='*.test.tsx' 'wrangler deploy|cloudflare deploy|workers_dev' v3smt/src","reject_matches grep -RInE 'wrangler deploy|cloudflare deploy|workers_dev' \"$deploy_path\""),
  has(78,'Pad and Mobile share one Print Hardware contract',workspace,'SHARED_PAD_MOBILE',"surface==='MFP_MOBILE'"),
];

describe('MFP V3 A7 handoff acceptance gates',()=>{
  it('keeps the handoff gate list exact',()=>expect(gates.map(([id])=>id)).toEqual(Array.from({length:78},(_,index)=>index+1)));
  it.each(gates)('A7-%i %s',(_id,_name,assertGate)=>assertGate());
});
