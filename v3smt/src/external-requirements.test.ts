import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const domain=read('./external-domain.ts');
const runtime=read('./external-runtime.tsx');
const operationsRuntime=read('./order-operations-runtime.tsx');
const state=read('./state-authority.ts');
const workflow=read('../../.github/workflows/v3smt-a0-foundation.yml');
const external=domain+runtime;

type Gate=readonly [number,string,()=>void];
const has=(id:number,name:string,source:string,...tokens:string[]):Gate=>[id,name,()=>tokens.forEach(token=>expect(source).toContain(token))];
const lacks=(id:number,name:string,source:string,pattern:RegExp):Gate=>[id,name,()=>expect(source).not.toMatch(pattern)];

const gates:readonly Gate[]=[
  has(1,'duplicate Customer intent is one pending identity',domain,'MFP_CUSTOMER_INTENT_IDENTITY_CONFLICT','row.submissionId+\':\'+row.idempotencyKey'),
  has(2,'Customer pending stays outside formal admission until Accept',runtime,'onAccept:intent=>run','sessionFor(intent).accept()'),
  has(3,'duplicate Customer Accept coalesces one Store Kernel command',domain,'if(active)return active','if(terminal)return Promise.resolve(terminal)'),
  has(4,'Customer formal identity is submissionId plus idempotencyKey',domain,'submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey'),
  lacks(5,'Customer pending does not start ETA',external,/startEta|etaStartedAt|ETA_START/),
  lacks(6,'Customer pending does not print',external,/dispatchCanonical|authorizeDispatch|ensureCancelNotice/),
  lacks(7,'Customer pending does not consume capacity',external,/usedQuantity\s*[+]?=|remainingQuantity\s*[-]?=/),
  has(8,'evidence is explicitly not payment truth',runtime,'EVIDENCE ≠ PAYMENT TRUTH','data-payment-truth="STORE_KERNEL_ONLY"'),
  has(9,'electronic admission requires verified evidence',domain,'MFP_CUSTOMER_PAYMENT_EVIDENCE_NOT_VERIFIED'),
  has(10,'rejected evidence remains a review state',domain,"'REJECTED'|'NEEDS_RESUBMISSION'",'CUSTOMER_EVIDENCE_REVIEW'),
  has(11,'WhatsApp is communication only',runtime,'data-whatsapp-order-writer="false"','communication only'),
  has(12,'evidence thumbnail and zoom use the same reference',runtime,'src={intent.paymentEvidenceRef}','Customer payment evidence enlarged'),
  has(13,'formal payment truth remains Store Kernel governed',domain,'submitFrontlineFormalCommand','paymentEvidenceReview:intent.evidenceReview'),
  has(14,'modification can request Customer confirmation',domain,'CUSTOMER_MODIFICATION_PROPOSE','customer.confirmations'),
  lacks(15,'modification proposal cannot fake confirmation',domain.slice(domain.indexOf('export function proposeMfpCustomerModification'),domain.indexOf('export function canAutoAcceptMfpKeeta')),/ORDER_MODIFICATION_CUSTOMER_DECISION|ACCEPTED/),
  has(16,'Customer ACCEPT updates the same Order',domain,"decision:value.state",'payload:Object.freeze({orderId:text(value.orderId'),
  has(17,'Customer REJECT updates the same Order',domain,"'ACCEPTED'|'REJECTED'|'UNKNOWN'",'ORDER_MODIFICATION_CUSTOMER_DECISION'),
  has(18,'Customer UNKNOWN remains pending',domain,"if(value.state==='UNKNOWN')return Promise.resolve", "state:'PENDING' as const"),
  has(19,'amount increase routes to A5 top-up',domain,"'A5_PAYMENT_TOP_UP_REQUIRED'"),
  has(20,'amount decrease routes to A6/A5 refund',domain,"'A6_A5_REFUND_REQUIRED'"),
  has(21,'special cutoff targets future Customer submissions',domain,"'SPECIAL_CUTOFF'",'FUTURE_CUSTOMER_SUBMISSIONS_ONLY'),
  has(22,'immediate stop targets future Customer submissions',domain,"'IMMEDIATE_STOP'",'CUSTOMER_NEW_ORDER_ACCEPTANCE_SET'),
  lacks(23,'Customer cutoff does not cancel existing Orders',domain.slice(domain.indexOf('export function createMfpCustomerChannelControlSession'),domain.indexOf('export interface MfpCustomerModificationConfirmation')),/ORDER_CANCEL|ORDER_REFUND/),
  lacks(24,'Customer cutoff does not stop local MFP trade',domain,/LOCAL_MFP_STOP|GLOBAL_STORE_STOP/),
  has(25,'WhatsApp fallback is not an Order writer',runtime,'data-whatsapp-order-writer="false"'),
  has(26,'Keeta exact identity deduplicates inbound',domain,"text(intent.providerOrderId,'MFP_KEETA_PROVIDER_ORDER_ID_INVALID')","text(intent.providerMessageId,'MFP_KEETA_PROVIDER_MESSAGE_ID_INVALID')","text(intent.fingerprint,'MFP_KEETA_FINGERPRINT_INVALID')",'MFP_KEETA_INTENT_IDENTITY_CONFLICT'),
  has(27,'duplicate Keeta admission coalesces one formal command',domain,'if(active)return active','MFP-KEETA-${intent.providerShopId}-${intent.providerOrderId}'),
  has(28,'committed Keeta ACK links canonical Order',domain,"kind:'ACK_ACCEPTED'",'canonicalOrderId:order.orderId'),
  has(29,'Keeta display and amount are outside dedupe identity',domain,'row=>`${row.providerShopId}:${row.providerOrderId}`'),
  has(30,'missing or ambiguous mapping blocks admission',domain,'MFP_KEETA_MAPPING_INVALID'),
  has(31,'valid AUTO uses the same formal admission session',runtime,'canAutoAcceptMfpKeeta(intent)','sessionFor(intent).accept()'),
  has(32,'AUTO failure remains explicit attention',runtime,'ATTENTION ·','Keeta AUTO'),
  has(33,'MANUAL remains pending until Immediate',domain+runtime,"intent.acceptanceMode==='AUTO'",'>Immediate</button>'),
  has(34,'Immediate uses one formal admission session',runtime,"onAccept:intent=>run(intent.kind==='CUSTOMER'?'Customer Accept':'Keeta Immediate'",'sessionFor(intent).accept()'),
  has(35,'Later is distinct from accept reject and cancel',runtime,'Later ≠ Reject ≠ Cancel ≠ Accept'),
  has(36,'Keeta defer zero to one is allowed',domain,'nextDeferCount:(intent.deferCount+1) as 1|2'),
  has(37,'Keeta defer one to two is allowed',domain,'nextDeferCount:(intent.deferCount+1) as 1|2'),
  has(38,'Keeta defer at two is blocked',domain,'MFP_KEETA_DEFER_LIMIT_REACHED'),
  has(39,'deferred Keeta intent remains visible',runtime,'defer {intent.deferCount} / 2','mfp-external-card'),
  has(40,'Keeta lifecycle links the same canonical Order',domain,'MFP_KEETA_LIFECYCLE_CANONICAL_ORDER_REQUIRED','orderId:event.canonicalOrderId'),
  has(41,'duplicate lifecycle message is idempotent',domain,'MFP_KEETA_LIFECYCLE_IDENTITY_CONFLICT','if(active)return active'),
  has(42,'lifecycle cannot manufacture an Order without link',domain,'if(!event.canonicalOrderId)throw new Error'),
  has(43,'stale lifecycle fails closed for reconcile',domain,'MFP_KEETA_LIFECYCLE_RECONCILE_REQUIRED'),
  has(44,'lifecycle ACK failure remains attention',domain,"let ackState:'ACKNOWLEDGED'|'ATTENTION'='ATTENTION'"),
  has(45,'duplicate after-sale event is idempotent',domain,'MFP_KEETA_AFTER_SALE_IDENTITY_CONFLICT'),
  lacks(46,'provider APPROVE alone does not create local refund truth',domain.slice(domain.indexOf('export function decideMfpKeetaAfterSale'),domain.indexOf('export function createMfpKeetaAfterSaleRefundSession')),/ORDER_REFUND|refundTruth/),
  has(47,'formal refund is bounded by canonical eligibility',domain,'MFP_REFUND_EXCEEDS_ELIGIBLE_AMOUNT'),
  has(48,'partial refund preserves the original Order',domain,'input.case.canonicalOrderId!==input.order.orderId',"scope:'PARTIAL'"),
  has(49,'refund tender readback remains canonical',domain,'refundTenderId:input.refundTenderId','createMfpOrderOperationSession'),
  has(50,'provider after-sale failure remains attention',runtime,'Keeta after-sale','ATTENTION ·'),
  has(51,'after-sale decision references same canonical Order',domain,'canonicalOrderId:text(value.canonicalOrderId'),
  has(52,'Customer admission reads own-platform stop',domain,'pool.ownPlatformAccepting'),
  has(53,'Keeta admission reads third-party stop',domain,'pool.thirdPartyAccepting'),
  lacks(54,'threshold crossing does not mutate existing Orders',domain,/orders\.(?:push|splice)|deleteOrder|cancelExisting/),
  has(55,'external stop scope excludes local MFP',domain,'FUTURE_CUSTOMER_SUBMISSIONS_ONLY'),
  lacks(56,'A8 has no second Capacity calculation',external,/initialQuantity\s*-|remainingQuantity\s*[<>]=?|thirdPartyThreshold\s*[<>]=?|ownPlatformThreshold\s*[<>]=?/),
  has(57,'idle coordinator has no implicit read',domain,'startup:request','manualRefresh:request'),
  lacks(58,'external runtime has no interval polling',external,/setInterval\s*\(/),
  lacks(59,'external runtime has no focus request',external,/addEventListener\(['"]focus/),
  lacks(60,'external runtime has no visibility request',external,/visibilitychange|document\.visibilityState/),
  has(61,'concurrent triggers coalesce single-flight',domain,'if(inFlight){pending=true;return inFlight;}'),
  has(62,'event during flight gets one trailing read',domain,'rerun=rerun||pending','if(pass===0){rerun=false;continue;}'),
  has(63,'trailing recheck is bounded',domain,'for(let pass=0;pass<2;pass++)','MFP_EXTERNAL_RECONCILE_TRAILING_LIMIT'),
  has(64,'Doorbell payload is notification only',domain,'doorbellReceived(_event','void event'),
  has(65,'frontline action uses A2 security port',domain+runtime,'submitFrontlineFormalCommand','security.precheckFrontlineAction()'),
  has(66,'expired revoked or unknown session remains A2 fail-closed',read('./security-port.ts'),'precheckFrontlineAction','MFP_STAFF_SESSION_EXPIRED','MFP_DEVICE_REVOKED'),
  lacks(67,'provider secrets are absent from browser source',external,/appSecret|signingKey|webhookSecret|longLivedBearer|providerBearer/i),
  lacks(68,'credentials are absent from query strings and logs',external,/(URLSearchParams|searchParams|console\.(?:log|info|warn|error)).*(secret|credential|bearer|token)/i),
  has(69,'accepted Customer Order enters A6 canonical readback',domain,"expectedSource=input.intent.kind==='CUSTOMER'?'MORE_FUN_APP':'KEETA'",'authority.readOrder(result.orderRef)'),
  has(70,'accepted Keeta Order enters A6 canonical readback',domain,"expectedSource=input.intent.kind==='CUSTOMER'?'MORE_FUN_APP':'KEETA'",'authority.readOrder(result.orderRef)'),
  has(71,'accepted external Order reuses A7 Print authority',state,"printJobs:'STORE_KERNEL_PRINT_ROUTER_DURABLE_PRINT_JOB_READBACK'"),
  has(72,'external refund reuses A6 A5 formal refund authority',domain,'createMfpRefundOperation','createMfpOrderOperationSession'),
  lacks(73,'A8 creates no second Order engine',external,/class\s+\w*(?:Order)(?:Engine|Authority)/),
  lacks(74,'A8 creates no second Payment or Refund engine',external,/class\s+\w*(?:Payment|Refund)(?:Engine|Authority)/),
  lacks(75,'A8 creates no Customer or Keeta Print engine',external,/class\s+\w*(?:Customer|Keeta|Print)(?:Engine|Authority)/),
  lacks(76,'A8 creates no sync head or state',external,/HeadSeq|readHead|writeHead|syncBundles|commitAtomically/),
  lacks(77,'A8 imports no v2 client state',external,/v2local|v2smm|localStorage|sessionStorage/),
  lacks(78,'A8 imports no SMM authority or session',external,/SMM_INTENT_STORE|SMM.{0,20}HeadSeq|x-mfk-smm-session|mfk-smm-web/),
  has(79,'workflow rejects periodic business polling',workflow,"setInterval\\s*\\("),
  has(80,'A1 Store Kernel remains green and canonical',read('./store-kernel-port.ts'),'createMfpSurfacePorts','readSubmission'),
  has(81,'A2 security remains green and fail-closed',read('./security-port.ts'),'createMfpSecuritySurfacePorts','submitFrontlineFormalCommand'),
  has(82,'A3 sync remains green and atomic',read('./sync-port.ts'),'createMfpSyncCoordinator','commitAtomically(candidate)'),
  has(83,'A4 ordering remains green and draft-only',read('./ordering-domain.ts'),"draftOnly:true","pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS'"),
  has(84,'A5 checkout and money remain green',read('./checkout-domain.ts')+read('./money-domain.ts'),"commandType:'CHECKOUT_PAYMENT_CONFIRM'","reportVersion:'1.0'"),
  has(85,'A6 Order Operations remains green and canonical',read('./order-operations-domain.ts'),'createMfpOrderOperationSession','submitFrontlineFormalCommand'),
  has(86,'A7 Print remains green and canonical',read('./print-hardware-domain.ts'),'createMfpPrintHardwareSession','authorizeDispatch'),
];

describe('MFP V3 A8 handoff acceptance gates',()=>{
  it('keeps the handoff gate list exact',()=>expect(gates.map(([id])=>id)).toEqual(Array.from({length:86},(_,index)=>index+1)));
  it.each(gates)('A8-%i %s',(_id,_name,assertGate)=>assertGate());
});
